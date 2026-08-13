import { apiClient } from './apiClient';
import {
  type OfflineSyncOperationPayload,
  type PosSyncBootstrapPayload,
  type PosSyncChangesPayload,
} from '../modules/offline/offline-types';

export type PosSyncPingResponse = {
  status: 'OK';
  serverTime: string;
  appVersion: string;
};

export type RegisterPosWorkstationPayload = {
  deviceId: string;
  workstationName: string;
  siteId: string;
  appVersion?: string;
};

export type PosSyncRegisteredWorkstation = {
  workstationId: string;
  siteId: string;
  siteCode: string | null;
  siteName: string | null;
  workstationCode: string | null;
  workstationName: string;
  workstationType: string;
  deviceUuid: string | null;
  offlineStatus: string;
  syncState: string;
  updatedAt: string | null;
};

export type PosSyncBootstrapParams = {
  workstationId?: string;
  deviceId?: string;
};

export type PosSyncChangesParams = {
  workstationId?: string;
  deviceId?: string;
  cursor?: string;
};

export type PosSyncHeartbeatPayload = {
  workstationId?: string;
  deviceId?: string;
  appVersion?: string;
  localDbVersion?: string;
  syncCursor?: string | null;
  pendingCount?: number;
  conflictCount?: number;
  snapshotStatus?: string;
  lastSyncAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
};

export type PosSyncOperationsPayload = {
  operations: OfflineSyncOperationPayload[];
};

export type PosSyncOperationAllocationAck = {
  allocationId: string;
  lotId: string;
  acknowledgedQuantity: number;
  serverConsumedQuantity: number;
  availableQuantity: number;
  serverVersion: number;
  status: string;
};

export type PosSyncOperationResult = {
  operationId: string;
  localSaleId?: string | null;
  status: 'SYNCED' | 'ALREADY_PROCESSED' | 'CONFLICT';
  serverSaleId?: string | null;
  serverSaleNumber?: string | null;
  serverCashSessionId?: string | null;
  serverSessionReference?: string | null;
  serverMovementId?: string | null;
  serverVersion?: number | null;
  serverOpenedAt?: string | null;
  serverClosedAt?: string | null;
  serverExpectedUsd?: number | null;
  serverExpectedCdf?: number | null;
  serverDeclaredUsd?: number | null;
  serverDeclaredCdf?: number | null;
  serverDifferenceUsd?: number | null;
  serverDifferenceCdf?: number | null;
  allocations?: PosSyncOperationAllocationAck[];
  errorCode?: string | null;
  message?: string | null;
};

export type PosSyncOperationsResponse = {
  serverTime: string;
  results: PosSyncOperationResult[];
};

export type PosSyncEngineStatus =
  | 'IDLE'
  | 'CHECKING'
  | 'SYNCING'
  | 'BACKOFF'
  | 'OFFLINE'
  | 'DEGRADED'
  | 'CONFLICT'
  | 'ERROR';

export type PosSyncAdminQuery = {
  siteId?: string;
  workstationId?: string;
  status?: string;
  conflictStatus?: string;
  severity?: string;
  search?: string;
};

export type PosSyncHeartbeatResponse = {
  workstationId: string;
  status: string;
  serverTime: string;
};

export type PosSyncAdminDashboard = {
  workstations: {
    total: number;
    online: number;
    offline: number;
    degraded: number;
    stale: number;
    revoked: number;
  };
  queue: {
    pending: number;
    conflicts: number;
  };
  allocations: {
    active: number;
    reservedQuantity: number;
    freeOnlineQuantity: number;
  };
};

export type PosSyncAdminWorkstation = {
  workstationId: string;
  workstationCode: string | null;
  workstationName: string;
  workstationType: string;
  siteId: string | null;
  siteName: string | null;
  deviceId: string | null;
  isActive: boolean;
  offlineStatus: string;
  syncState: string;
  snapshotStatus: string;
  pendingCount: number;
  conflictCount: number;
  appVersion: string | null;
  localDbVersion: string | null;
  userId: string | null;
  userName: string | null;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  status: string;
  allocationSummary?: {
    total: number;
    reservedQuantity: number;
  };
  openConflicts?: number;
};

export type PosSyncAdminConflict = {
  conflictId: string;
  tenantId: string;
  siteId: string | null;
  siteName: string | null;
  workstationId: string | null;
  workstationName: string | null;
  operationId: string;
  localSaleId: string | null;
  offlineReference: string | null;
  conflictCode: string;
  status: string;
  severity: string;
  message: string;
  localPayload: Record<string, unknown>;
  serverContext: Record<string, unknown>;
  resolutionType: string | null;
  resolutionPayload: Record<string, unknown> | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolvedByName: string | null;
};

export type PosSyncAdminLogEntry = {
  eventAt: string;
  eventType: string;
  level: string;
  siteName: string | null;
  workstationName: string | null;
  message: string;
};

export type PosSyncRevokedWorkstationResponse = PosSyncAdminWorkstation;

export type ResolvePosSyncConflictPayload = {
  resolutionType:
    | 'UNDER_REVIEW'
    | 'MANUAL_REVIEW_COMPLETED'
    | 'DISMISS'
    | 'CANCEL_SYNC_OPERATION'
    | 'REASSIGN_CASH_SESSION';
  note?: string;
  targetCashSessionId?: string;
  payload?: Record<string, unknown>;
};

export const posSyncService = {
  ping: () => apiClient.get<PosSyncPingResponse>('/pos-sync/ping'),
  registerWorkstation: (payload: RegisterPosWorkstationPayload) =>
    apiClient.post<PosSyncRegisteredWorkstation>('/pos-sync/workstations/register', payload),
  bootstrap: (params: PosSyncBootstrapParams) =>
    apiClient.get<PosSyncBootstrapPayload>('/pos-sync/bootstrap', { params }),
  getChanges: (params: PosSyncChangesParams) =>
    apiClient.get<PosSyncChangesPayload>('/pos-sync/changes', { params }),
  heartbeat: (payload: PosSyncHeartbeatPayload) =>
    apiClient.post<PosSyncHeartbeatResponse>('/pos-sync/heartbeat', payload),
  pushOperations: (payload: PosSyncOperationsPayload) =>
    apiClient.post<PosSyncOperationsResponse>('/pos-sync/operations', payload),
  getAdminDashboard: (params: PosSyncAdminQuery = {}) =>
    apiClient.get<PosSyncAdminDashboard>('/pos-sync/admin/dashboard', { params }),
  getAdminWorkstations: (params: PosSyncAdminQuery = {}) =>
    apiClient.get<PosSyncAdminWorkstation[]>('/pos-sync/admin/workstations', { params }),
  getAdminWorkstation: (id: string) =>
    apiClient.get<PosSyncAdminWorkstation>(`/pos-sync/admin/workstations/${id}`),
  revokeWorkstation: (id: string) =>
    apiClient.post<PosSyncRevokedWorkstationResponse>(`/pos-sync/admin/workstations/${id}/revoke`, {}),
  getAdminConflicts: (params: PosSyncAdminQuery = {}) =>
    apiClient.get<PosSyncAdminConflict[]>('/pos-sync/admin/conflicts', { params }),
  getAdminConflict: (id: string) =>
    apiClient.get<PosSyncAdminConflict>(`/pos-sync/admin/conflicts/${id}`),
  resolveConflict: (id: string, payload: ResolvePosSyncConflictPayload) =>
    apiClient.post<PosSyncAdminConflict>(`/pos-sync/admin/conflicts/${id}/resolve`, payload),
  getAdminLogs: (params: PosSyncAdminQuery = {}) =>
    apiClient.get<PosSyncAdminLogEntry[]>('/pos-sync/admin/logs', { params }),
};
