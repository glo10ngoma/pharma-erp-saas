export type OfflineAllocationStatus = 'ACTIVE' | 'EXHAUSTED' | 'SUSPENDED' | 'REVOKED';
export type OfflineNetworkStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE';
export type OfflineSnapshotStatus = 'FRESH' | 'STALE' | 'EXPIRED' | 'REVOKED' | 'UNKNOWN';
export type OfflineAuthorizationState = 'AUTHORIZED' | 'REVOKED' | 'UNAUTHORIZED';
export type OfflineRecoveryStatus = 'HEALTHY' | 'DEGRADED' | 'RECOVERY_REQUIRED' | 'BLOCKED';
export type OfflineStorageStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
export type OfflineIntegrityIssueLevel = 'INFO' | 'WARNING' | 'CRITICAL';
export type OfflineCartStatus = 'DRAFT' | 'READY' | 'BLOCKED' | 'CANCELLED';
export type OfflineCartSaveState = 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR';
export type OfflinePriceSource = 'ARTICLE_DEFAULT' | 'LOT_FEFO';
export type OfflineSaleStatus = 'LOCAL_VALIDATED' | 'PENDING_SYNC' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'FAILED';
export type OfflinePaymentStatus = 'CAPTURED_LOCAL' | 'SYNCED';
export type OfflineSaleType = 'CASH' | 'INSURANCE';
export type OfflineSaleMode = 'IMMEDIATE' | 'ADVANCE';
export type OfflinePendingConsumptionStatus = 'PENDING' | 'SYNCED' | 'CONFLICT';
export type OfflineSyncQueueStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'FAILED';
export type OfflineCashSessionStatus =
  | 'LOCAL_OPEN'
  | 'OPEN_PENDING_SYNC'
  | 'OPEN_SYNCED'
  | 'LOCAL_CLOSING'
  | 'CLOSED_PENDING_SYNC'
  | 'CLOSED_SYNCED'
  | 'CONFLICT'
  | 'FAILED'
  | 'CANCELLED_BEFORE_USE';
export type OfflineCashMovementType =
  | 'OPENING_BALANCE'
  | 'SALE_CASH_IN'
  | 'EXPENSE_OUT'
  | 'CLOSING_DECLARATION';
export type OfflineCashMovementStatus = 'CAPTURED_LOCAL' | 'PENDING_SYNC' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'FAILED';
export type OfflineSyncQueueOperationType = 'SALE_VALIDATE' | 'CASH_SESSION_OPEN' | 'CASH_EXPENSE' | 'CASH_SESSION_CLOSE';
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
  | 'sale.sync_conflict'
  | 'cash.session_opened_local'
  | 'cash.expense_captured_local'
  | 'cash.session_closed_local'
  | 'cash.session_synced'
  | 'cash.session_conflict';
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
  | 'WORKSTATION_REVOKED'
  | 'CASH_SESSION_ALREADY_OPEN'
  | 'CASH_SESSION_NOT_FOUND'
  | 'CASH_SESSION_CLOSED'
  | 'CASH_SESSION_REVOKED'
  | 'CASH_SESSION_WORKSTATION_MISMATCH'
  | 'CASH_EXPECTED_BALANCE_MISMATCH'
  | 'CASH_MOVEMENT_MISSING'
  | 'CASH_EXPENSE_REPLAY_CONFLICT'
  | 'CASH_CLOSE_DEPENDENCY_PENDING';

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

export interface OfflineInsuranceOrganization {
  localKey: string;
  tenantId: string;
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  organizationType: string;
  isActive: boolean;
  updatedAt: string | null;
  lastSyncedAt: string | null;
}

export interface OfflineInsurancePlan {
  localKey: string;
  tenantId: string;
  organizationId: string;
  planId: string;
  planCode: string;
  planName: string;
  coveragePercent: number;
  patientCopayPercent: number;
  monthlyLimit: number | null;
  annualLimit: number | null;
  requiresAuthorization: boolean;
  isActive: boolean;
  updatedAt: string | null;
  lastSyncedAt: string | null;
}

export interface OfflineCustomerMembership {
  localKey: string;
  tenantId: string;
  customerId: string;
  customerName: string | null;
  organizationId: string;
  organizationName: string | null;
  planId: string | null;
  planName: string | null;
  membershipId: string;
  memberNumber: string | null;
  employeeNumber: string | null;
  relationshipType: string | null;
  coveragePercent: number | null;
  validFrom: string | null;
  validTo: string | null;
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
  localCashSessionId: string;
  offlineCashReference: string;
  tenantId: string;
  siteId: string;
  workstationId: string | null;
  userId: string;
  deviceId: string | null;
  serverCashSessionId: string | null;
  serverSessionReference: string | null;
  status: OfflineCashSessionStatus;
  openedAt: string;
  openedLocallyAt: string;
  serverOpenedAt: string | null;
  closedLocallyAt: string | null;
  serverClosedAt: string | null;
  syncedAt: string | null;
  openingBalanceUsd: number;
  openingBalanceCdf: number;
  cashSalesUsd: number;
  cashSalesCdf: number;
  expensesUsd: number;
  expensesCdf: number;
  refundsUsd: number;
  refundsCdf: number;
  expectedClosingUsd: number;
  expectedClosingCdf: number;
  declaredClosingUsd: number | null;
  declaredClosingCdf: number | null;
  differenceUsd: number | null;
  differenceCdf: number | null;
  localExpectedClosingUsd: number;
  localExpectedClosingCdf: number;
  serverExpectedClosingUsd: number | null;
  serverExpectedClosingCdf: number | null;
  serverDifferenceUsd: number | null;
  serverDifferenceCdf: number | null;
  openingOperationId: string;
  closingOperationId: string | null;
  serverVersion: number;
  note: string | null;
  updatedAt: string | null;
  lastSyncedAt: string | null;
}

export interface OfflineCashMovement {
  localMovementId: string;
  localCashSessionId: string;
  tenantId: string;
  siteId: string;
  workstationId: string | null;
  userId: string;
  serverMovementId: string | null;
  operationId: string;
  movementType: OfflineCashMovementType;
  currency: 'USD' | 'CDF';
  amount: number;
  sourceType: 'CASH_SESSION' | 'SALE' | 'EXPENSE' | 'CLOSE';
  sourceId: string | null;
  reference: string | null;
  description: string | null;
  createdLocallyAt: string;
  syncedAt: string | null;
  status: OfflineCashMovementStatus;
}

export interface OfflineCashCount {
  countId: string;
  localCashSessionId: string;
  declaredUsd: number;
  declaredCdf: number;
  expectedUsd: number;
  expectedCdf: number;
  differenceUsd: number;
  differenceCdf: number;
  countedAt: string;
  countedBy: string;
  note: string | null;
}

export interface OfflineCashReconciliationEvent {
  eventId: string;
  localCashSessionId: string;
  operationId: string | null;
  code: string;
  message: string;
  localExpectedUsd: number | null;
  localExpectedCdf: number | null;
  serverExpectedUsd: number | null;
  serverExpectedCdf: number | null;
  createdAt: string;
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

export interface OfflineMetadataRecord {
  id: 'metadata';
  applicationVersion: string;
  offlineDbVersion: number;
  snapshotSchemaVersion: number;
  lastMigrationAt: string;
  lastRecoveryCheckAt: string | null;
  recoveryStatus: OfflineRecoveryStatus;
  recoveryReason: string | null;
}

export interface OfflineSyncQueueEntry {
  localId: string;
  operationId: string;
  operationType: OfflineSyncQueueOperationType;
  workstationId: string;
  tenantId: string;
  siteId: string;
  payload: OfflineSyncOperationPayload;
  status: OfflineSyncQueueStatus;
  relatedLocalSaleId?: string | null;
  relatedLocalCashSessionId?: string | null;
  dependsOnOperationId?: string | null;
  dependencyGroup?: string | null;
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
  saleType: OfflineSaleType;
  saleMode: OfflineSaleMode;
  organizationId: string | null;
  organizationNameSnapshot: string | null;
  planId: string | null;
  planNameSnapshot: string | null;
  membershipId: string | null;
  membershipNumberSnapshot: string | null;
  coveragePercentSnapshot: number | null;
  patientShareUsd: number;
  insuranceShareUsd: number;
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
  saleType: OfflineSaleType;
  saleMode: OfflineSaleMode;
  organizationId: string | null;
  planId: string | null;
  membershipId: string | null;
  coveragePercentSnapshot: number | null;
  patientShareUsd: number;
  insuranceShareUsd: number;
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
  localCashSessionId: string;
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
  localCashSessionId: string;
  cashSessionOpenOperationId: string | null;
  customerId: string | null;
  customerNameSnapshot: string | null;
  saleType: OfflineSaleType;
  saleMode: OfflineSaleMode;
  organizationId: string | null;
  organizationNameSnapshot: string | null;
  planId: string | null;
  planNameSnapshot: string | null;
  membershipId: string | null;
  membershipNumberSnapshot: string | null;
  coveragePercentSnapshot: number | null;
  patientShareUsd: number;
  insuranceShareUsd: number;
  currency: 'USD';
  exchangeRateSnapshot: number | null;
  paymentSettlement: OfflinePaymentSettlement;
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
  cashSessionId: string | null;
  localCashSessionId: string;
  cashSessionOpenOperationId: string | null;
  customerId: string | null;
  organizationId: string | null;
  planId: string | null;
  membershipId: string | null;
  coveragePercentSnapshot: number | null;
  currency: 'USD';
  exchangeRateSnapshot: number | null;
  createdAt: string;
  validatedAt: string;
  saleMode: OfflineSaleMode;
  saleType: OfflineSaleType;
  patientShareUsd: number;
  insuranceShareUsd: number;
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

export interface OfflineCashSessionOpenOperation {
  operationType: 'CASH_SESSION_OPEN';
  operationId: string;
  localCashSessionId: string;
  offlineCashReference: string;
  tenantId: string;
  siteId: string;
  workstationId: string;
  deviceId: string;
  userId: string;
  openingBalanceUsd: number;
  openingBalanceCdf: number;
  note: string | null;
  openedLocallyAt: string;
}

export interface OfflineCashExpenseOperation {
  operationType: 'CASH_EXPENSE';
  operationId: string;
  localCashSessionId: string;
  offlineCashReference: string;
  tenantId: string;
  siteId: string;
  workstationId: string;
  deviceId: string;
  userId: string;
  serverCashSessionId: string | null;
  cashSessionOpenOperationId: string | null;
  localMovementId: string;
  amount: number;
  currency: 'USD' | 'CDF';
  expenseCategory: string;
  description: string;
  createdLocallyAt: string;
}

export interface OfflineCashSessionCloseOperation {
  operationType: 'CASH_SESSION_CLOSE';
  operationId: string;
  localCashSessionId: string;
  offlineCashReference: string;
  tenantId: string;
  siteId: string;
  workstationId: string;
  deviceId: string;
  userId: string;
  serverCashSessionId: string | null;
  cashSessionOpenOperationId: string | null;
  declaredClosingUsd: number;
  declaredClosingCdf: number;
  expectedClosingUsd: number;
  expectedClosingCdf: number;
  differenceUsd: number;
  differenceCdf: number;
  note: string | null;
  closedLocallyAt: string;
}

export type OfflineSyncOperationPayload =
  | OfflineSaleValidateOperation
  | OfflineCashSessionOpenOperation
  | OfflineCashExpenseOperation
  | OfflineCashSessionCloseOperation;

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
    sessionReference?: string | null;
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
  organizations: Array<{
    organizationId: string;
    organizationCode: string;
    organizationName: string;
    organizationType: string;
    isActive: boolean;
    updatedAt: string | null;
  }>;
  insurancePlans: Array<{
    planId: string;
    organizationId: string;
    planCode: string;
    planName: string;
    coveragePercent: number;
    patientCopayPercent: number;
    monthlyLimit: number | null;
    annualLimit: number | null;
    requiresAuthorization: boolean;
    isActive: boolean;
    updatedAt: string | null;
  }>;
  memberships: Array<{
    membershipId: string;
    customerId: string;
    customerName: string | null;
    organizationId: string;
    organizationName: string | null;
    planId: string | null;
    planName: string | null;
    coveragePercent: number | null;
    memberNumber: string | null;
    employeeNumber: string | null;
    relationshipType: string | null;
    validFrom: string | null;
    validTo: string | null;
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
    organizations?: Array<PosSyncBootstrapPayload['organizations'][number] & { operation: 'UPSERT' | 'DEACTIVATE' }>;
    insurancePlans?: Array<PosSyncBootstrapPayload['insurancePlans'][number] & { operation: 'UPSERT' | 'DEACTIVATE' }>;
    memberships?: Array<PosSyncBootstrapPayload['memberships'][number] & { operation: 'UPSERT' | 'DEACTIVATE' }>;
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
  organizations: OfflineInsuranceOrganization[];
  insurancePlans: OfflineInsurancePlan[];
  memberships: OfflineCustomerMembership[];
  settings: OfflinePosSettings | null;
  auth: OfflineAuthSnapshot | null;
  workstation: OfflineWorkstationSnapshot | null;
  cashSession: OfflineCashSessionSnapshot | null;
  syncState: OfflineSyncState | null;
}
