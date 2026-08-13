import { posSyncService, type PosSyncEngineStatus } from '../../services/posSync.service';
import {
  appendSyncConflict,
  appendSyncLog,
  patchOfflineSyncQueueEntry,
  readOfflineCashSessions,
  readOfflineConflicts,
  readOfflineSnapshot,
  readOfflineSyncQueue,
  resetStaleSyncingQueueEntries,
  updateOfflineSyncOperationResult,
  writeOfflineSyncState,
} from './offline-storage';
import { applyChanges, getStableDeviceId, pingPosSync } from './offline-bootstrap';
import { type OfflineCashExpenseOperation, type OfflineCashSessionCloseOperation, type OfflineSaleValidateOperation, type OfflineSyncOperationPayload, type OfflineSyncQueueEntry } from './offline-types';

const AUTO_SYNC_INTERVAL_MS = 60_000;
const BACKOFF_STEPS_MS = [60_000, 120_000, 300_000, 600_000, 1_800_000] as const;

type SyncEngineState = {
  currentStatus: PosSyncEngineStatus;
  pendingCount: number;
  syncingCount: number;
  conflictCount: number;
  failedCount: number;
  lastSuccessfulSyncAt: string | null;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  currentOperationId: string | null;
};

type Subscriber = (state: SyncEngineState) => void;

const defaultState: SyncEngineState = {
  currentStatus: 'IDLE',
  pendingCount: 0,
  syncingCount: 0,
  conflictCount: 0,
  failedCount: 0,
  lastSuccessfulSyncAt: null,
  lastAttemptAt: null,
  nextRetryAt: null,
  currentOperationId: null,
};

let state: SyncEngineState = { ...defaultState };
let subscribers = new Set<Subscriber>();
let activeConsumers = 0;
let timer: number | null = null;
let heartbeatTimer: number | null = null;
let isRunning = false;
let isSyncing = false;
let backoffIndex = 0;
let activeRunId = 0;
let onlineHandler: (() => void) | null = null;
let visibilityHandler: (() => void) | null = null;

function publish() {
  subscribers.forEach((subscriber) => subscriber(state));
}

function setState(patch: Partial<SyncEngineState>) {
  state = { ...state, ...patch };
  publish();
}

async function refreshCounters() {
  const [queue, conflicts, snapshot] = await Promise.all([
    readOfflineSyncQueue(),
    readOfflineConflicts(),
    readOfflineSnapshot(),
  ]);
  setState({
    pendingCount: queue.filter((row) => row.status === 'PENDING').length,
    syncingCount: queue.filter((row) => row.status === 'SYNCING').length,
    conflictCount: queue.filter((row) => row.status === 'CONFLICT').length + conflicts.length,
    failedCount: queue.filter((row) => row.status === 'FAILED').length,
    lastSuccessfulSyncAt: snapshot.syncState?.lastSuccessfulSyncAt ?? state.lastSuccessfulSyncAt,
    lastAttemptAt: snapshot.syncState?.lastAttemptAt ?? state.lastAttemptAt,
  });
}

async function markQueueEntrySyncing(operationId: string) {
  await patchOfflineSyncQueueEntry(operationId, (row) => ({
    ...row,
    status: 'SYNCING',
    updatedAt: new Date().toISOString(),
  }));
  await refreshCounters();
}

async function syncHeartbeat() {
  const snapshot = await readOfflineSnapshot();
  if (!snapshot.workstation?.workstationId) return;
  try {
    await posSyncService.heartbeat({
      workstationId: snapshot.workstation.workstationId,
      deviceId: snapshot.workstation.deviceId ?? getStableDeviceId(),
      appVersion: snapshot.workstation.appVersion ?? import.meta.env.VITE_APP_VERSION ?? 'web',
      localDbVersion: '4',
      syncCursor: snapshot.syncState?.syncCursor ?? null,
      pendingCount: state.pendingCount,
      conflictCount: state.conflictCount,
      snapshotStatus: snapshot.syncState?.snapshotStatus ?? 'UNKNOWN',
      lastSyncAt: state.lastAttemptAt,
      lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
    });
  } catch {
    // heartbeat failures should not break the selling flow
  }
}

function scheduleNext(ms = AUTO_SYNC_INTERVAL_MS) {
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void runSync('timer');
  }, ms);
}

function scheduleBackoff() {
  const wait = BACKOFF_STEPS_MS[Math.min(backoffIndex, BACKOFF_STEPS_MS.length - 1)];
  const nextRetryAt = new Date(Date.now() + wait).toISOString();
  setState({ currentStatus: 'BACKOFF', nextRetryAt });
  scheduleNext(wait);
  backoffIndex += 1;
}

async function updateSyncStateError(code: string, message: string, networkStatus: 'ONLINE' | 'DEGRADED' | 'OFFLINE') {
  const snapshot = await readOfflineSnapshot();
  if (!snapshot.syncState) return;
  await writeOfflineSyncState({
    ...snapshot.syncState,
    networkStatus,
    lastAttemptAt: new Date().toISOString(),
    lastErrorCode: code,
    lastErrorMessage: message,
  });
}

async function clearSyncStateError() {
  const snapshot = await readOfflineSnapshot();
  if (!snapshot.syncState) return;
  await writeOfflineSyncState({
    ...snapshot.syncState,
    lastSuccessfulSyncAt: new Date().toISOString(),
    lastAttemptAt: new Date().toISOString(),
    lastErrorCode: null,
    lastErrorMessage: null,
  });
}

function isTechnicalError(message: string) {
  return ['NETWORK_ERROR', 'TIMEOUT', '502', '503', '504', 'ECONNRESET', 'POS_SYNC_BACKEND_UNREACHABLE'].some((code) =>
    message.includes(code),
  );
}

export async function runSync(trigger: 'manual' | 'timer' | 'online' | 'visibility' | 'sale') {
  if (isSyncing) return state;
  isSyncing = true;
  activeRunId += 1;
  const runId = activeRunId;

  setState({
    currentStatus: 'CHECKING',
    lastAttemptAt: new Date().toISOString(),
    nextRetryAt: null,
  });

  try {
    await resetStaleSyncingQueueEntries();
    await refreshCounters();
    const ping = await pingPosSync();

    if (ping.networkStatus === 'OFFLINE') {
      setState({ currentStatus: 'OFFLINE' });
      await updateSyncStateError('OFFLINE', 'Navigateur hors ligne.', 'OFFLINE');
      scheduleNext();
      return state;
    }

    if (ping.networkStatus === 'DEGRADED') {
      setState({ currentStatus: 'DEGRADED' });
      await updateSyncStateError('DEGRADED', 'Backend indisponible, snapshot local conserve.', 'DEGRADED');
      scheduleBackoff();
      return state;
    }

    setState({ currentStatus: 'SYNCING' });
    const results = await processPendingOfflineQueue();
    const conflicts = results.filter((row) => row.status === 'CONFLICT');
    const failures = results.filter((row) => row.status === 'FAILED');

    if (conflicts.length > 0) {
      for (const item of conflicts) {
        await appendSyncConflict({
          code: (item.errorCode ?? 'ALLOCATION_MISMATCH') as import('./offline-types').OfflineAllocationConflictCode,
          message: item.error ?? 'Conflit de synchronisation offline.',
          workstationId: undefined,
        });
      }
    }

    if (failures.length > 0) {
      const message = failures[0]?.error ?? 'Synchronisation offline echouee.';
      await appendSyncLog({
        type: 'CHANGES',
        status: 'ERROR',
        message,
      });
      await updateSyncStateError('SYNC_FAILED', message, 'ONLINE');
      if (isTechnicalError(message)) {
        scheduleBackoff();
      } else {
        setState({ currentStatus: 'ERROR' });
        scheduleNext();
      }
      return state;
    }

    await applyChanges();
    await clearSyncStateError();
    await refreshCounters();
    await syncHeartbeat();

    backoffIndex = 0;
    setState({
      currentStatus: (conflicts.length > 0 || state.conflictCount > 0) ? 'CONFLICT' : 'IDLE',
      lastSuccessfulSyncAt: new Date().toISOString(),
      nextRetryAt: null,
    });
    await appendSyncLog({
      type: 'CHANGES',
      status: 'SUCCESS',
      message:
        trigger === 'sale'
          ? 'Synchronisation auto lancee apres validation locale.'
          : 'Synchronisation automatique terminee.',
    });
    scheduleNext();
    return state;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SYNC_ENGINE_ERROR';
    await updateSyncStateError('SYNC_ENGINE_ERROR', message, 'DEGRADED');
    setState({ currentStatus: isTechnicalError(message) ? 'BACKOFF' : 'ERROR' });
    scheduleBackoff();
    return state;
  } finally {
    if (runId === activeRunId) {
      isSyncing = false;
      await refreshCounters();
    }
  }
}

type OfflineSyncProcessResult = {
  operationId: string;
  operationType: OfflineSyncQueueEntry['operationType'];
  status: 'SYNCED' | 'CONFLICT' | 'FAILED';
  error?: string;
  errorCode?: string | null;
};

export async function processPendingOfflineQueue() {
  const results: OfflineSyncProcessResult[] = [];
  while (true) {
    const queue = await readOfflineSyncQueue();
    const nextEntry = await selectNextEligibleEntry(queue);
    if (!nextEntry) break;

    await markQueueEntrySyncing(nextEntry.operationId);
    const preparedEntry = await prepareEntryForSend(nextEntry);

    try {
      const response = await posSyncService.pushOperations({
        operations: [preparedEntry.payload as OfflineSyncOperationPayload],
      });
      const result = response.data.results[0];
      if (result?.status === 'SYNCED' || result?.status === 'ALREADY_PROCESSED') {
        await updateOfflineSyncOperationResult({
          operationId: preparedEntry.operationId,
          nextStatus: 'SYNCED',
          result,
        });
        results.push({
          operationId: preparedEntry.operationId,
          operationType: preparedEntry.operationType,
          status: 'SYNCED',
        });
        continue;
      }

      await updateOfflineSyncOperationResult({
        operationId: preparedEntry.operationId,
        nextStatus: 'CONFLICT',
        result: result ?? null,
        errorCode: result?.errorCode ?? 'SYNC_CONFLICT',
        errorMessage: result?.message ?? 'Conflit de synchronisation',
      });
      results.push({
        operationId: preparedEntry.operationId,
        operationType: preparedEntry.operationType,
        status: 'CONFLICT',
        errorCode: result?.errorCode ?? 'SYNC_CONFLICT',
        error: result?.message ?? result?.errorCode ?? 'SYNC_CONFLICT',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SYNC_FAILED';
      await updateOfflineSyncOperationResult({
        operationId: preparedEntry.operationId,
        nextStatus: 'FAILED',
        errorCode: 'SYNC_FAILED',
        errorMessage: message,
      });
      results.push({
        operationId: preparedEntry.operationId,
        operationType: preparedEntry.operationType,
        status: 'FAILED',
        errorCode: 'SYNC_FAILED',
        error: message,
      });
      if (isTechnicalError(message)) break;
    }
  }
  return results;
}

async function selectNextEligibleEntry(queue: OfflineSyncQueueEntry[]) {
  const candidates = queue
    .filter((entry) => entry.status === 'PENDING' || entry.status === 'FAILED')
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  for (const entry of candidates) {
    if (await isEntryEligible(entry, queue)) return entry;
  }
  return null;
}

async function isEntryEligible(entry: OfflineSyncQueueEntry, queue: OfflineSyncQueueEntry[]) {
  if (entry.dependsOnOperationId) {
    const dependency = queue.find((row) => row.operationId === entry.dependsOnOperationId);
    if (!dependency || dependency.status !== 'SYNCED') return false;
  }

  if (entry.operationType === 'CASH_SESSION_CLOSE') {
    return canCloseSessionSync(entry.relatedLocalCashSessionId ?? null, queue, entry.operationId, entry.createdAt);
  }

  return true;
}

function canCloseSessionSync(
  localCashSessionId: string | null,
  queue: OfflineSyncQueueEntry[],
  currentOperationId: string,
  createdAt: string,
) {
  if (!localCashSessionId) return false;
  return queue
    .filter((row) =>
      row.relatedLocalCashSessionId === localCashSessionId
      && row.operationId !== currentOperationId
      && row.createdAt <= createdAt,
    )
    .every((row) => row.status === 'SYNCED');
}

async function prepareEntryForSend(entry: OfflineSyncQueueEntry) {
  if (!entry.relatedLocalCashSessionId) return entry;

  const sessions = await readOfflineCashSessions();
  const session = sessions.find((row) => row.localCashSessionId === entry.relatedLocalCashSessionId);
  if (!session?.serverCashSessionId) return entry;

  let nextPayload = entry.payload;
  if (entry.operationType === 'SALE_VALIDATE') {
    const payload = entry.payload as OfflineSaleValidateOperation;
    if (payload.cashSessionId !== session.serverCashSessionId) {
      nextPayload = { ...payload, cashSessionId: session.serverCashSessionId };
    }
  } else if (entry.operationType === 'CASH_EXPENSE') {
    const payload = entry.payload as OfflineCashExpenseOperation;
    if (payload.serverCashSessionId !== session.serverCashSessionId) {
      nextPayload = { ...payload, serverCashSessionId: session.serverCashSessionId };
    }
  } else if (entry.operationType === 'CASH_SESSION_CLOSE') {
    const payload = entry.payload as OfflineCashSessionCloseOperation;
    if (payload.serverCashSessionId !== session.serverCashSessionId) {
      nextPayload = { ...payload, serverCashSessionId: session.serverCashSessionId };
    }
  }

  if (nextPayload !== entry.payload) {
    const patched = await patchOfflineSyncQueueEntry(entry.operationId, (row) => ({
      ...row,
      payload: nextPayload,
      updatedAt: new Date().toISOString(),
    }));
    if (patched) return patched;
  }

  return entry;
}

async function startInternal() {
  if (isRunning) return;
  isRunning = true;
  await resetStaleSyncingQueueEntries();
  await refreshCounters();
  scheduleNext();
  if (heartbeatTimer) window.clearInterval(heartbeatTimer);
  heartbeatTimer = window.setInterval(() => {
    void syncHeartbeat();
  }, AUTO_SYNC_INTERVAL_MS);

  onlineHandler = () => {
    void runSync('online');
  };
  visibilityHandler = () => {
    if (document.visibilityState === 'visible') {
      const lastAttemptAt = state.lastAttemptAt ? new Date(state.lastAttemptAt).getTime() : 0;
      if (Date.now() - lastAttemptAt > AUTO_SYNC_INTERVAL_MS / 2) {
        void runSync('visibility');
      }
    }
  };
  window.addEventListener('online', onlineHandler);
  document.addEventListener('visibilitychange', visibilityHandler);
}

function stopInternal() {
  if (!isRunning) return;
  isRunning = false;
  if (timer) window.clearTimeout(timer);
  if (heartbeatTimer) window.clearInterval(heartbeatTimer);
  timer = null;
  heartbeatTimer = null;
  if (onlineHandler) window.removeEventListener('online', onlineHandler);
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
  onlineHandler = null;
  visibilityHandler = null;
}

export async function notifyOfflineSaleQueued() {
  await refreshCounters();
  void runSync('sale');
}

export function subscribeSyncEngine(subscriber: Subscriber) {
  subscribers.add(subscriber);
  subscriber(state);
  activeConsumers += 1;
  void startInternal();
  return () => {
    subscribers.delete(subscriber);
    activeConsumers = Math.max(0, activeConsumers - 1);
    if (activeConsumers === 0) stopInternal();
  };
}

export function getSyncEngineState() {
  return state;
}
