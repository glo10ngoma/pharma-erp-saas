export type OfflineAllocationStatus = 'ACTIVE' | 'EXHAUSTED' | 'SUSPENDED' | 'REVOKED';
export type OfflineNetworkStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE';
export type OfflineSnapshotStatus = 'FRESH' | 'STALE' | 'EXPIRED' | 'REVOKED' | 'UNKNOWN';
export type OfflineAuthorizationState = 'VALID' | 'EXPIRING' | 'EXPIRED';

export type OfflineAllocationConflictCode =
  | 'ALLOCATION_EXHAUSTED'
  | 'ALLOCATION_MISMATCH'
  | 'ALLOCATION_VERSION_STALE'
  | 'ALLOCATION_REVOKED'
  | 'LOT_BLOCKED_AFTER_OFFLINE_SALE'
  | 'WORKSTATION_REVOKED';

export interface OfflinePosArticle {
  localKey: string;
  tenantId: string;
  articleId: string;
  articleCode: string;
  commercialName: string;
  barcode: string | null;
  isActive: boolean;
  salesUnit: string | null;
  packaging: string | null;
  packagingQuantity: number | null;
  defaultSellingPrice: number | null;
  updatedAt: string | null;
  lastSyncedAt: string | null;
}

export interface OfflinePosLot {
  localKey: string;
  tenantId: string;
  articleId: string;
  lotId: string;
  lotNumber: string;
  expiryDate: string;
  isBlocked: boolean;
  blockReason: string | null;
  sellingPrice: number | null;
  updatedAt: string | null;
  lastSyncedAt: string | null;
}

export interface OfflineStockAllocation {
  localId: string;
  allocationId: string;
  tenantId: string;
  siteId: string;
  workstationId: string;
  articleId: string;
  lotId: string;
  lotNumber: string;
  expiryDate: string;
  isBlocked: boolean;
  blockingReason: string | null;
  serverAllocatedQuantity: number;
  serverConsumedQuantity: number;
  localPendingConsumption: number;
  allocationStatus: OfflineAllocationStatus;
  serverVersion: number;
  updatedAt: string | null;
  lastSyncedAt: string | null;
}

export interface OfflinePosCustomer {
  localKey: string;
  tenantId: string;
  customerId: string;
  customerCode: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  updatedAt: string | null;
  lastSyncedAt: string | null;
}

export interface OfflineExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number | null;
  effectiveDate: string | null;
  updatedAt: string | null;
}

export interface OfflinePosSettings {
  key: 'pos-settings';
  tenantId: string;
  defaultCurrency: string;
  supportedCurrencies: string[];
  offlineAuthorizationHours: number;
  allocationPolicy: string;
  timezone: string;
  exchangeRate: OfflineExchangeRate | null;
  lastSyncedAt: string | null;
}

export interface OfflineAuthSnapshot {
  id: 'auth';
  tenantId: string;
  siteId: string | null;
  userId: string;
  displayName: string;
  role: string;
  permissions: string[];
  lastServerValidationAt: string | null;
  offlineAuthorizationExpiresAt: string | null;
}

export interface OfflineWorkstationSnapshot {
  id: 'workstation';
  tenantId: string;
  siteId: string;
  siteCode: string | null;
  siteName: string | null;
  workstationId: string;
  workstationCode: string | null;
  workstationName: string;
  deviceId: string;
  status: string;
  syncState: string;
  appVersion: string | null;
  updatedAt: string | null;
}

export interface OfflineSyncState {
  id: 'sync-state';
  tenantId: string | null;
  siteId: string | null;
  workstationId: string | null;
  bootstrapVersion: string | null;
  syncCursor: string | null;
  serverTime: string | null;
  lastSuccessfulSyncAt: string | null;
  lastAttemptAt: string | null;
  snapshotStatus: OfflineSnapshotStatus;
  networkStatus: OfflineNetworkStatus;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

export interface OfflineSyncQueueEntry {
  localId: string;
  operationId: string;
  workstationId: string;
  tenantId: string;
  siteId: string;
  payload: OfflineAllocationConsumption[];
  status: 'PENDING' | 'SYNCED' | 'CONFLICT';
  createdAt: string;
  updatedAt: string;
}

export interface OfflineSyncLogEntry {
  localId: string;
  type: 'PING' | 'REGISTER' | 'BOOTSTRAP' | 'CHANGES';
  status: 'SUCCESS' | 'ERROR';
  message: string;
  createdAt: string;
}

export interface OfflineSyncConflictEntry {
  localId: string;
  code: OfflineAllocationConflictCode;
  message: string;
  articleId?: string;
  lotId?: string;
  workstationId?: string;
  createdAt: string;
}

export interface OfflineAllocationSnapshot {
  generatedAt: string;
  tenantId: string;
  siteId: string;
  workstationId?: string | null;
  allocations: OfflineStockAllocation[];
  totalAllocated: number;
  totalConsumed: number;
  totalAvailable: number;
}

export interface OfflineAllocationTransfer {
  transferId: string;
  tenantId: string;
  siteId: string;
  fromWorkstationId: string;
  toWorkstationId: string;
  lotId: string;
  quantity: number;
  createdAt: string;
  status: 'PENDING' | 'APPLIED' | 'REJECTED';
}

export interface OfflineAllocationConsumption {
  operationId: string;
  localSaleId: string;
  workstationId: string;
  siteId: string;
  tenantId: string;
  articleId: string;
  lotId: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
  allocationVersion: number;
  consumedAt: string;
}

export interface OfflineAllocationConflict {
  code: OfflineAllocationConflictCode;
  message: string;
  articleId?: string;
  lotId?: string;
  workstationId?: string;
  requestedQuantity?: number;
  availableQuantity?: number;
}

export interface PosSyncWorkstation {
  workstationId: string;
  workstationName: string;
  deviceId: string | null;
  status: string;
}

export interface PosSyncBootstrapPayload {
  serverTime: string;
  syncCursor: string;
  bootstrapVersion: string;
  tenant: {
    tenantId: string;
    tenantCode: string;
    tenantName: string;
  };
  site: {
    siteId: string;
    siteCode: string;
    siteName: string;
  };
  workstation: PosSyncWorkstation;
  user: {
    userId: string;
    displayName: string;
    role: string;
  };
  permissions: string[];
  settings: {
    currency: string;
    exchangeRate: OfflineExchangeRate | null;
    offlineAuthorizationHours: number;
    allocationPolicy: string;
    timezone: string;
    supportedCurrencies: string[];
  };
  articles: Array<{
    articleId: string;
    articleCode: string;
    commercialName: string;
    barcode: string | null;
    isActive: boolean;
    salesUnit: string | null;
    packaging: string | null;
    packagingQuantity: number | null;
    defaultSellingPrice: number | null;
    updatedAt: string | null;
  }>;
  lots: Array<{
    lotId: string;
    articleId: string;
    lotNumber: string;
    expiryDate: string;
    isBlocked: boolean;
    blockReason: string | null;
    sellingPrice: number | null;
    updatedAt: string | null;
  }>;
  offlineAllocations: Array<{
    allocationId: string;
    workstationId: string;
    siteId: string;
    articleId: string;
    lotId: string;
    serverAllocatedQuantity: number;
    serverConsumedQuantity: number;
    availableQuantityServer: number;
    status: OfflineAllocationStatus;
    serverVersion: number;
    updatedAt: string | null;
  }>;
  customers: Array<{
    customerId: string;
    customerCode: string;
    name: string;
    phone: string | null;
    isActive: boolean;
    updatedAt: string | null;
  }>;
}

export interface PosSyncChangesPayload {
  serverTime: string;
  previousCursor: string | null;
  nextCursor: string;
  hasMore: boolean;
  changes: {
    articles: Array<PosSyncBootstrapPayload['articles'][number] & { operation: 'UPSERT' | 'DEACTIVATE' }>;
    lots: Array<PosSyncBootstrapPayload['lots'][number] & { operation: 'UPSERT' | 'REVOKE' }>;
    allocations: Array<PosSyncBootstrapPayload['offlineAllocations'][number] & { operation: 'UPSERT' | 'REVOKE' }>;
    customers: Array<PosSyncBootstrapPayload['customers'][number] & { operation: 'UPSERT' | 'DEACTIVATE' }>;
    settings: Array<{ operation: 'UPSERT'; exchangeRate: number | null; updatedAt: string | null }>;
  };
}

export interface OfflineLocalSnapshot {
  articles: OfflinePosArticle[];
  lots: OfflinePosLot[];
  allocations: OfflineStockAllocation[];
  customers: OfflinePosCustomer[];
  settings: OfflinePosSettings | null;
  auth: OfflineAuthSnapshot | null;
  workstation: OfflineWorkstationSnapshot | null;
  syncState: OfflineSyncState | null;
}
