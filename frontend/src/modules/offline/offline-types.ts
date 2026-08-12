export type OfflineAllocationStatus = 'ACTIVE' | 'EXHAUSTED' | 'SUSPENDED' | 'REVOKED';
export type OfflineNetworkStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE';
export type OfflineSnapshotStatus = 'FRESH' | 'STALE' | 'EXPIRED' | 'REVOKED' | 'UNKNOWN';
export type OfflineAuthorizationState = 'VALID' | 'EXPIRING' | 'EXPIRED';
export type OfflineCartStatus = 'DRAFT' | 'READY' | 'BLOCKED' | 'CANCELLED';
export type OfflineCartSaveState = 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR';
export type OfflinePriceSource = 'ARTICLE_DEFAULT' | 'LOT_FEFO';
export type OfflineSaleStatus = 'LOCAL_VALIDATED' | 'PENDING_SYNC' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'FAILED';
export type OfflinePaymentStatus = 'CAPTURED_LOCAL' | 'SYNCED';
export type OfflinePendingConsumptionStatus = 'PENDING' | 'SYNCED' | 'CONFLICT';
export type OfflineSyncQueueStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'FAILED';
export type OfflineSyncQueueOperationType = 'SALE_VALIDATE';
export type OfflineActivityType =
  | 'cart.created'
  | 'cart.item_added'
  | 'cart.item_removed'
  | 'cart.quantity_changed'
  | 'cart.blocked'
  | 'cart.cancelled'
  | 'fefo.recalculated'
  | 'reservation.created'
  | 'reservation.released'
  | 'sale.validated_local'
  | 'sale.sync_queued'
  | 'sale.synced'
  | 'sale.sync_conflict';
export type OfflineCartErrorCode =
  | 'CATALOG_EMPTY'
  | 'ARTICLE_NOT_FOUND'
  | 'ARTICLE_INACTIVE'
  | 'PRICE_MISSING'
  | 'OFFLINE_ALLOCATION_INSUFFICIENT'
  | 'ALLOCATION_REVOKED'
  | 'ALLOCATION_SUSPENDED'
  | 'LOT_BLOCKED'
  | 'LOT_EXPIRED'
  | 'LOT_EXPIRY_DATE_INVALID'
  | 'CART_BLOCKED'
  | 'CASH_SESSION_REQUIRED'
  | 'PAYMENT_REQUIRED'
  | 'PAYMENT_INSUFFICIENT'
  | 'EXCHANGE_RATE_REQUIRED'
  | 'LOCAL_STORAGE_ERROR';

export type OfflineAllocationConflictCode =
  | 'ALLOCATION_EXHAUSTED'
  | 'ALLOCATION_MISMATCH'
  | 'ALLOCATION_VERSION_STALE'
  | 'ALLOCATION_REVOKED'
  | 'LOT_BLOCKED_AFTER_OFFLINE_SALE'
  | 'LOT_EXPIRED_AT_OFFLINE_SALE'
  | 'CASH_SESSION_CLOSED_AFTER_OFFLINE_SALE'
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

export interface OfflineCashSessionSnapshot {
  cashSessionId: string;
  tenantId: string;
  siteId: string;
  workstationId: string | null;
  userId: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  openingBalanceUsd: number;
  openingBalanceCdf: number;
  serverVersion: number;
  updatedAt: string | null;
  lastSyncedAt: string | null;
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
  operationType: OfflineSyncQueueOperationType;
  workstationId: string;
  tenantId: string;
  siteId: string;
  payload: OfflineSaleValidateOperation;
  status: OfflineSyncQueueStatus;
  relatedLocalSaleId?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
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
  conflictId?: string;
  operationId?: string;
  localSaleId?: string | null;
  offlineReference?: string | null;
  status?: string;
  severity?: string;
  resolutionType?: string | null;
  updatedAt?: string | null;
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

export interface OfflineCartLotAllocation {
  allocationId: string;
  lotId: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
  allocationServerVersion: number;
}

export interface OfflineCartItem {
  localItemId: string;
  articleId: string;
  articleCode: string;
  articleName: string;
  barcode: string | null;
  quantity: number;
  unitPriceSnapshot: number;
  priceSource: OfflinePriceSource;
  priceVersion: string | null;
  lineTotal: number;
  salesUnit: string | null;
  packaging: string | null;
  packagingQuantity: number | null;
  lotAllocations: OfflineCartLotAllocation[];
  createdAt: string;
  updatedAt: string;
}

export interface OfflineCart {
  cartId: string;
  offlineReference: string;
  tenantId: string;
  siteId: string;
  workstationId: string;
  deviceId: string;
  userId: string;
  customerId: string | null;
  customerNameSnapshot: string | null;
  currency: string;
  exchangeRateSnapshot: number | null;
  status: OfflineCartStatus;
  saveState: OfflineCartSaveState;
  note: string | null;
  subtotal: number;
  total: number;
  itemCount: number;
  quantityTotal: number;
  items: OfflineCartItem[];
  blockedReasons: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OfflineDraftReservation {
  reservationId: string;
  cartId: string;
  allocationId: string;
  lotId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineActivityLogEntry {
  localId: string;
  cartId: string | null;
  saleId?: string | null;
  type: OfflineActivityType;
  message: string;
  createdAt: string;
}

export interface OfflineCartQuotaBreakdown {
  allocationId: string;
  articleId: string;
  lotId: string;
  lotNumber: string;
  expiryDate: string;
  serverAllocatedQuantity: number;
  serverConsumedQuantity: number;
  localPendingConsumption: number;
  reservedInOtherDrafts: number;
  availableForCart: number;
  status: OfflineAllocationStatus;
  isBlocked: boolean;
}

export interface OfflineSaleDraftOperation {
  operationType: 'SALE_DRAFT_CREATE';
  operationId: string;
  cartId: string;
  offlineReference: string;
  tenantId: string;
  siteId: string;
  workstationId: string;
  deviceId: string;
  userId: string;
  customerId: string | null;
  currency: string;
  exchangeRateSnapshot: number | null;
  createdAt: string;
  items: Array<{
    articleId: string;
    quantity: number;
    unitPriceSnapshot: number;
    allocations: Array<{
      allocationId: string;
      lotId: string;
      quantity: number;
      allocationServerVersion: number;
    }>;
  }>;
}

export interface OfflinePendingConsumption {
  pendingConsumptionId: string;
  localSaleId: string;
  operationId: string;
  allocationId: string;
  articleId: string;
  lotId: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
  allocationServerVersion: number;
  tenantId: string;
  siteId: string;
  workstationId: string;
  status: OfflinePendingConsumptionStatus;
  consumedAt: string;
  syncedAt: string | null;
}

export interface OfflineSaleItem {
  localSaleItemId: string;
  articleId: string;
  articleCode: string;
  articleName: string;
  quantity: number;
  unitPriceSnapshot: number;
  lineTotal: number;
  salesUnit: string | null;
  packaging: string | null;
  packagingQuantity: number | null;
  lotAllocations: OfflineCartLotAllocation[];
}

export interface OfflinePaymentSettlement {
  amountPaidUsd: number;
  amountPaidCdf: number;
  amountReturnedUsd: number;
  amountReturnedCdf: number;
  suggestedChangeUsd: number;
  suggestedChangeCdf: number;
  netReceivedUsd: number;
  netReceivedCdf: number;
  netTotalEquivalentUsd: number;
  settlementDifferenceUsd: number;
}

export interface OfflinePayment {
  offlinePaymentId: string;
  localSaleId: string;
  tenantId: string;
  siteId: string;
  workstationId: string;
  cashSessionId: string;
  currencyCode: 'USD';
  exchangeRate: number | null;
  settlement: OfflinePaymentSettlement;
  note: string | null;
  status: OfflinePaymentStatus;
  createdAt: string;
  syncedAt: string | null;
}

export interface OfflineSale {
  localSaleId: string;
  offlineReference: string;
  tenantId: string;
  siteId: string;
  workstationId: string;
  deviceId: string;
  userId: string;
  cashSessionId: string;
  customerId: string | null;
  customerNameSnapshot: string | null;
  saleType: 'CASH';
  saleMode: 'IMMEDIATE';
  currency: 'USD';
  exchangeRateSnapshot: number | null;
  note: string | null;
  status: OfflineSaleStatus;
  syncStatus: OfflineSyncQueueStatus;
  serverSaleId: string | null;
  serverSaleNumber: string | null;
  subtotal: number;
  total: number;
  itemCount: number;
  quantityTotal: number;
  items: OfflineSaleItem[];
  createdAt: string;
  validatedAt: string;
  syncedAt: string | null;
}

export interface OfflineSaleValidateOperation {
  operationType: 'SALE_VALIDATE';
  operationId: string;
  localSaleId: string;
  offlineReference: string;
  tenantId: string;
  siteId: string;
  workstationId: string;
  deviceId: string;
  userId: string;
  cashSessionId: string;
  customerId: string | null;
  currency: 'USD';
  exchangeRateSnapshot: number | null;
  createdAt: string;
  validatedAt: string;
  saleMode: 'IMMEDIATE';
  saleType: 'CASH';
  note: string | null;
  subtotal: number;
  total: number;
  payment: OfflinePaymentSettlement;
  items: Array<{
    articleId: string;
    articleCode: string;
    articleName: string;
    quantity: number;
    unitPriceSnapshot: number;
    lotAllocations: Array<{
      allocationId: string;
      lotId: string;
      lotNumber: string;
      expiryDate: string;
      quantity: number;
      allocationServerVersion: number;
    }>;
  }>;
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
  cashSession: {
    cashSessionId: string;
    userId: string;
    siteId: string;
    workstationId: string | null;
    status: 'OPEN' | 'CLOSED';
    openedAt: string;
    openingBalanceUsd: number;
    openingBalanceCdf: number;
    serverVersion: number;
    updatedAt: string | null;
  } | null;
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
    conflicts: Array<{
      operation: 'UPSERT' | 'RESOLVE';
      conflictId: string;
      workstationId: string | null;
      operationId: string;
      localSaleId: string | null;
      offlineReference: string | null;
      conflictCode: OfflineAllocationConflictCode | string;
      status: string;
      severity: string;
      message: string;
      resolutionType: string | null;
      updatedAt: string;
    }>;
    cashSession?: PosSyncBootstrapPayload['cashSession'];
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
  cashSession: OfflineCashSessionSnapshot | null;
  syncState: OfflineSyncState | null;
}
