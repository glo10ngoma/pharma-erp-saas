import { authService, type AuthUser } from '../../services/auth.service';
import {
  posSyncService,
  type PosSyncPingResponse,
  type PosSyncRegisteredWorkstation,
} from '../../services/posSync.service';
import {
  appendSyncLog,
  applyPosChanges,
  computeSnapshotStatus,
  createDefaultSyncState,
  persistBootstrapSnapshot,
  readOfflineConflicts,
  readOfflineSnapshot,
  readOfflineSyncLog,
  readOfflineSyncQueue,
  writeOfflineSyncState,
} from './offline-storage';
import {
  type OfflineAuthorizationState,
  type OfflineAuthSnapshot,
  type OfflineLocalSnapshot,
  type OfflineNetworkStatus,
  type OfflineSyncConflictEntry,
  type OfflineSyncLogEntry,
  type OfflineSyncQueueEntry,
  type OfflineSyncState,
  type OfflineWorkstationSnapshot,
  type PosSyncBootstrapPayload,
  type PosSyncChangesPayload,
} from './offline-types';

export const OFFLINE_DB_FRESH_MINUTES = 15;
export const OFFLINE_AUTH_EXPIRING_MINUTES = 60;
const DEVICE_ID_STORAGE_KEY = 'deviceUuid';

export type OfflineSnapshotViewModel = {
  snapshot: OfflineLocalSnapshot;
  queue: OfflineSyncQueueEntry[];
  syncLog: OfflineSyncLogEntry[];
  conflicts: OfflineSyncConflictEntry[];
  authorizationState: OfflineAuthorizationState;
  snapshotStatus: OfflineSyncState['snapshotStatus'];
  networkStatus: OfflineNetworkStatus;
};

export function getStableDeviceId() {
  const current = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (current) return current;
  const next = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, next);
  return next;
}

export function getDefaultWorkstationName() {
  return `POS ${getStableDeviceId().slice(0, 8).toUpperCase()}`;
}

export async function pingPosSync() {
  if (!navigator.onLine) {
    return {
      networkStatus: 'OFFLINE' as const,
      ping: null,
    };
  }

  try {
    const response = await posSyncService.ping();
    return {
      networkStatus: 'ONLINE' as const,
      ping: response.data,
    };
  } catch {
    return {
      networkStatus: 'DEGRADED' as const,
      ping: null,
    };
  }
}

export async function loadLocalSnapshot(): Promise<OfflineSnapshotViewModel> {
  const [snapshot, queue, syncLog, conflicts, pingState] = await Promise.all([
    readOfflineSnapshot(),
    readOfflineSyncQueue(),
    readOfflineSyncLog(),
    readOfflineConflicts(),
    pingPosSync(),
  ]);

  const snapshotStatus = calculateSnapshotFreshness(snapshot.syncState, snapshot.auth, snapshot.workstation);
  const authorizationState = calculateAuthorizationState(snapshot.auth);

  return {
    snapshot: {
      ...snapshot,
      syncState: snapshot.syncState
        ? { ...snapshot.syncState, snapshotStatus, networkStatus: pingState.networkStatus }
        : snapshot.syncState,
    },
    queue,
    syncLog,
    conflicts,
    authorizationState,
    snapshotStatus,
    networkStatus: pingState.networkStatus,
  };
}

export async function bootstrapFromServer(options: {
  siteId?: string | null;
  workstationId?: string | null;
  workstationName?: string;
}) {
  const pingState = await pingPosSync();

  try {
    if (pingState.networkStatus !== 'ONLINE') {
      throw new Error('POS_SYNC_BACKEND_UNREACHABLE');
    }

    const me = await authService.me();
    const localSnapshot = await readOfflineSnapshot();
    const siteId = options.siteId ?? localSnapshot.workstation?.siteId ?? me.data.siteId ?? '';
    if (!siteId) {
      throw new Error('POS_SYNC_SITE_REQUIRED');
    }

    const deviceId = getStableDeviceId();
    const registered = await posSyncService.registerWorkstation({
      deviceId,
      siteId,
      workstationName: options.workstationName?.trim() || localSnapshot.workstation?.workstationName || getDefaultWorkstationName(),
      appVersion: import.meta.env.VITE_APP_VERSION ?? 'web',
    });

    const bootstrap = await posSyncService.bootstrap({
      workstationId: options.workstationId ?? registered.data.workstationId,
      deviceId,
    });
    validateBootstrapPayload(bootstrap.data);

    const authSnapshot = buildAuthSnapshot(me.data, bootstrap.data.serverTime, bootstrap.data.settings.offlineAuthorizationHours);
    const workstationSnapshot = buildWorkstationSnapshot(bootstrap.data, registered.data);
    const syncState = createDefaultSyncState({
      tenantId: bootstrap.data.tenant.tenantId,
      siteId: bootstrap.data.site.siteId,
      workstationId: bootstrap.data.workstation.workstationId,
      bootstrapVersion: bootstrap.data.bootstrapVersion,
      syncCursor: bootstrap.data.syncCursor,
      serverTime: bootstrap.data.serverTime,
      lastSuccessfulSyncAt: bootstrap.data.serverTime,
      lastAttemptAt: bootstrap.data.serverTime,
      networkStatus: pingState.networkStatus,
    });
    const snapshotStatus = calculateSnapshotFreshness(syncState, authSnapshot, workstationSnapshot);

    await persistBootstrapSnapshot(
      bootstrap.data,
      authSnapshot,
      workstationSnapshot,
      {
        ...syncState,
        snapshotStatus,
      },
    );

    await appendSyncLog({
      type: 'BOOTSTRAP',
      status: 'SUCCESS',
      message: `Bootstrap applique pour ${bootstrap.data.workstation.workstationName}.`,
    });

    return {
      payload: bootstrap.data,
      authSnapshot,
      workstationSnapshot,
      syncState: {
        ...syncState,
        snapshotStatus,
      },
      ping: pingState.ping,
    };
  } catch (error) {
    await persistFailureState('BOOTSTRAP', error, pingState.networkStatus);
    throw error;
  }
}

export async function applyChanges(options?: { workstationId?: string | null }) {
  const pingState = await pingPosSync();
  try {
    if (pingState.networkStatus !== 'ONLINE') {
      throw new Error('POS_SYNC_BACKEND_UNREACHABLE');
    }

    const localSnapshot = await readOfflineSnapshot();
    const workstationId = options?.workstationId ?? localSnapshot.workstation?.workstationId ?? '';
    const tenantId = localSnapshot.auth?.tenantId ?? localSnapshot.workstation?.tenantId ?? '';
    const siteId = localSnapshot.workstation?.siteId ?? localSnapshot.auth?.siteId ?? '';
    const syncState = localSnapshot.syncState ?? createDefaultSyncState();

    if (!workstationId || !tenantId || !siteId) {
      throw new Error('POS_SYNC_LOCAL_CONTEXT_MISSING');
    }

    const response = await posSyncService.getChanges({
      workstationId,
      deviceId: getStableDeviceId(),
      cursor: syncState.syncCursor ?? undefined,
    });
    validateChangesPayload(response.data);

    await applyPosChanges(response.data, {
      tenantId,
      siteId,
      workstationId,
      syncState: {
        ...syncState,
        lastAttemptAt: response.data.serverTime,
        networkStatus: pingState.networkStatus,
      },
    });

    const updatedSnapshot = await readOfflineSnapshot();
    const nextSnapshotStatus = calculateSnapshotFreshness(
      updatedSnapshot.syncState,
      updatedSnapshot.auth,
      updatedSnapshot.workstation,
    );

    if (updatedSnapshot.syncState) {
      await writeOfflineSyncState({
        ...updatedSnapshot.syncState,
        networkStatus: pingState.networkStatus,
        snapshotStatus: nextSnapshotStatus,
        lastErrorCode: null,
        lastErrorMessage: null,
      });
    }

    await appendSyncLog({
      type: 'CHANGES',
      status: 'SUCCESS',
      message: `Changements descendants appliques (${countChanges(response.data)} elements).`,
    });

    return response.data;
  } catch (error) {
    await persistFailureState('CHANGES', error, pingState.networkStatus);
    throw error;
  }
}

export function calculateSnapshotFreshness(
  syncState: OfflineSyncState | null,
  auth: OfflineAuthSnapshot | null,
  workstation: OfflineWorkstationSnapshot | null,
) {
  return computeSnapshotStatus({
    lastSuccessfulSyncAt: syncState?.lastSuccessfulSyncAt ?? null,
    offlineAuthorizationExpiresAt: auth?.offlineAuthorizationExpiresAt ?? null,
    workstationStatus: workstation?.status ?? null,
    freshThresholdMinutes: OFFLINE_DB_FRESH_MINUTES,
  });
}

export function calculateAuthorizationState(auth: OfflineAuthSnapshot | null, now = new Date()): OfflineAuthorizationState {
  if (!auth?.offlineAuthorizationExpiresAt) return 'EXPIRED';
  const expiresAt = new Date(auth.offlineAuthorizationExpiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  const diffMinutes = (expiresAt.getTime() - now.getTime()) / 60000;
  return diffMinutes <= OFFLINE_AUTH_EXPIRING_MINUTES ? 'EXPIRING' : 'VALID';
}

export function validateBootstrapPayload(payload: PosSyncBootstrapPayload) {
  if (!payload?.tenant?.tenantId) throw new Error('INVALID_POS_BOOTSTRAP_TENANT');
  if (!payload?.site?.siteId) throw new Error('INVALID_POS_BOOTSTRAP_SITE');
  if (!payload?.workstation?.workstationId) throw new Error('INVALID_POS_BOOTSTRAP_WORKSTATION');
  if (!Array.isArray(payload.permissions)) throw new Error('INVALID_POS_BOOTSTRAP_PERMISSIONS');
  if (!Array.isArray(payload.articles) || !Array.isArray(payload.lots) || !Array.isArray(payload.offlineAllocations)) {
    throw new Error('INVALID_POS_BOOTSTRAP_COLLECTIONS');
  }

  for (const row of payload.offlineAllocations) {
    if (!row.allocationId || !row.articleId || !row.lotId) throw new Error('INVALID_POS_BOOTSTRAP_ALLOCATION_ID');
    assertFiniteNumber(row.serverAllocatedQuantity, 'INVALID_POS_BOOTSTRAP_ALLOCATED_QUANTITY');
    assertFiniteNumber(row.serverConsumedQuantity, 'INVALID_POS_BOOTSTRAP_CONSUMED_QUANTITY');
    assertFiniteNumber(row.availableQuantityServer, 'INVALID_POS_BOOTSTRAP_AVAILABLE_QUANTITY');
    assertFiniteNumber(row.serverVersion, 'INVALID_POS_BOOTSTRAP_SERVER_VERSION');
  }

  for (const row of payload.lots) {
    if (!row.lotId || !row.articleId || !row.lotNumber) throw new Error('INVALID_POS_BOOTSTRAP_LOT');
    assertDateString(row.expiryDate, 'INVALID_POS_BOOTSTRAP_EXPIRY_DATE');
  }

  return true;
}

export function validateChangesPayload(payload: PosSyncChangesPayload) {
  if (!payload?.nextCursor) throw new Error('INVALID_POS_CHANGES_CURSOR');
  if (!payload?.changes) throw new Error('INVALID_POS_CHANGES_PAYLOAD');
  return true;
}

function buildAuthSnapshot(user: AuthUser, serverTime: string, offlineAuthorizationHours: number): OfflineAuthSnapshot {
  const expiresAt = new Date(serverTime);
  expiresAt.setHours(expiresAt.getHours() + offlineAuthorizationHours);

  return {
    id: 'auth',
    tenantId: user.tenantId,
    siteId: user.siteId ?? null,
    userId: user.id,
    displayName: user.fullName,
    role: user.role,
    permissions: user.permissions ?? [],
    lastServerValidationAt: serverTime,
    offlineAuthorizationExpiresAt: expiresAt.toISOString(),
  };
}

function buildWorkstationSnapshot(
  payload: PosSyncBootstrapPayload,
  registered: PosSyncRegisteredWorkstation,
): OfflineWorkstationSnapshot {
  return {
    id: 'workstation',
    tenantId: payload.tenant.tenantId,
    siteId: payload.site.siteId,
    siteCode: payload.site.siteCode,
    siteName: payload.site.siteName,
    workstationId: payload.workstation.workstationId,
    workstationCode: registered.workstationCode,
    workstationName: payload.workstation.workstationName,
    deviceId: payload.workstation.deviceId ?? getStableDeviceId(),
    status: payload.workstation.status,
    syncState: registered.syncState,
    appVersion: import.meta.env.VITE_APP_VERSION ?? 'web',
    updatedAt: registered.updatedAt,
  };
}

function countChanges(payload: PosSyncChangesPayload) {
  return payload.changes.articles.length
    + payload.changes.lots.length
    + payload.changes.allocations.length
    + payload.changes.customers.length
    + payload.changes.settings.length;
}

async function persistFailureState(
  type: OfflineSyncLogEntry['type'],
  error: unknown,
  networkStatus: OfflineNetworkStatus,
) {
  const snapshot = await readOfflineSnapshot();
  const message = extractErrorMessage(error);
  if (snapshot.syncState) {
    await writeOfflineSyncState({
      ...snapshot.syncState,
      networkStatus,
      lastAttemptAt: new Date().toISOString(),
      lastErrorCode: message,
      lastErrorMessage: message,
    });
  }
  await appendSyncLog({
    type,
    status: 'ERROR',
    message,
  });
}

function assertFiniteNumber(value: unknown, errorCode: string) {
  if (!Number.isFinite(Number(value))) throw new Error(errorCode);
}

function assertDateString(value: unknown, errorCode: string) {
  if (typeof value !== 'string' && !(value instanceof Date)) throw new Error(errorCode);
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error(errorCode);
}

export function getCurrentOfflinePingLabel(ping: PosSyncPingResponse | null) {
  if (!ping) return '-';
  return `${ping.status} - ${ping.serverTime}`;
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'POS_SYNC_UNKNOWN_ERROR';
}
