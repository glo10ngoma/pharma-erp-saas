import {
  type OfflineAuthSnapshot,
  type OfflineLocalSnapshot,
  type OfflinePosArticle,
  type OfflinePosCustomer,
  type OfflinePosLot,
  type OfflinePosSettings,
  type OfflineSnapshotStatus,
  type OfflineStockAllocation,
  type OfflineSyncConflictEntry,
  type OfflineSyncLogEntry,
  type OfflineSyncQueueEntry,
  type OfflineSyncState,
  type OfflineWorkstationSnapshot,
  type PosSyncBootstrapPayload,
  type PosSyncChangesPayload,
} from './offline-types';
import { normalizeAllocationStatus } from './offline-fefo';

const DB_NAME = 'PharmaErpPosDb';
const DB_VERSION = 2;
const ARTICLES_STORE = 'offline_articles';
const LOTS_STORE = 'offline_lots';
const ALLOCATIONS_STORE = 'offline_allocations';
const CUSTOMERS_STORE = 'offline_customers';
const SETTINGS_STORE = 'offline_settings';
const AUTH_STORE = 'auth_snapshot';
const WORKSTATION_STORE = 'workstation';
const SYNC_STATE_STORE = 'sync_state';
const SYNC_QUEUE_STORE = 'sync_queue';
const SYNC_LOG_STORE = 'sync_log';
const SYNC_CONFLICTS_STORE = 'sync_conflicts';

export async function readOfflineArticles() {
  const db = await openOfflineDatabase();
  return readAll<OfflinePosArticle>(db, ARTICLES_STORE);
}

export async function readOfflineLots() {
  const db = await openOfflineDatabase();
  return readAll<OfflinePosLot>(db, LOTS_STORE);
}

export async function readOfflineAllocations(): Promise<OfflineStockAllocation[]> {
  const db = await openOfflineDatabase();
  const rows = await readAll<OfflineStockAllocation>(db, ALLOCATIONS_STORE);
  return rows.map(normalizeAllocation);
}

export async function readOfflineCustomers() {
  const db = await openOfflineDatabase();
  return readAll<OfflinePosCustomer>(db, CUSTOMERS_STORE);
}

export async function readOfflineSettings() {
  const db = await openOfflineDatabase();
  const rows = await readAll<OfflinePosSettings>(db, SETTINGS_STORE);
  return rows[0] ?? null;
}

export async function readAuthSnapshot() {
  const db = await openOfflineDatabase();
  const rows = await readAll<OfflineAuthSnapshot>(db, AUTH_STORE);
  return rows[0] ?? null;
}

export async function readWorkstationSnapshot() {
  const db = await openOfflineDatabase();
  const rows = await readAll<OfflineWorkstationSnapshot>(db, WORKSTATION_STORE);
  return rows[0] ?? null;
}

export async function readSyncState() {
  const db = await openOfflineDatabase();
  const rows = await readAll<OfflineSyncState>(db, SYNC_STATE_STORE);
  return rows[0] ?? null;
}

export async function readOfflineSyncQueue(): Promise<OfflineSyncQueueEntry[]> {
  const db = await openOfflineDatabase();
  return readAll<OfflineSyncQueueEntry>(db, SYNC_QUEUE_STORE);
}

export async function readOfflineSyncLog() {
  const db = await openOfflineDatabase();
  return readAll<OfflineSyncLogEntry>(db, SYNC_LOG_STORE);
}

export async function readOfflineConflicts() {
  const db = await openOfflineDatabase();
  return readAll<OfflineSyncConflictEntry>(db, SYNC_CONFLICTS_STORE);
}

export async function writeOfflineSyncState(syncState: OfflineSyncState) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(SYNC_STATE_STORE, 'readwrite');
  await replaceAll(tx.objectStore(SYNC_STATE_STORE), [syncState]);
  await txDone(tx);
}

export async function readOfflineSnapshot(): Promise<OfflineLocalSnapshot> {
  const [
    articles,
    lots,
    allocations,
    customers,
    settings,
    auth,
    workstation,
    syncState,
  ] = await Promise.all([
    readOfflineArticles(),
    readOfflineLots(),
    readOfflineAllocations(),
    readOfflineCustomers(),
    readOfflineSettings(),
    readAuthSnapshot(),
    readWorkstationSnapshot(),
    readSyncState(),
  ]);

  return { articles, lots, allocations, customers, settings, auth, workstation, syncState };
}

export async function writeOfflineAllocations(rows: OfflineStockAllocation[]) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(ALLOCATIONS_STORE, 'readwrite');
  const store = tx.objectStore(ALLOCATIONS_STORE);
  await clearStore(store);
  for (const row of rows) {
    await putStore(store, normalizeAllocation(row));
  }
  await txDone(tx);
}

export async function clearOfflineAllocations() {
  const db = await openOfflineDatabase();
  const tx = db.transaction(ALLOCATIONS_STORE, 'readwrite');
  await clearStore(tx.objectStore(ALLOCATIONS_STORE));
  await txDone(tx);
}

export async function clearOfflineSnapshot() {
  const db = await openOfflineDatabase();
  const tx = db.transaction(
    [
      ARTICLES_STORE,
      LOTS_STORE,
      ALLOCATIONS_STORE,
      CUSTOMERS_STORE,
      SETTINGS_STORE,
      AUTH_STORE,
      WORKSTATION_STORE,
      SYNC_STATE_STORE,
    ],
    'readwrite',
  );
  for (const storeName of [ARTICLES_STORE, LOTS_STORE, ALLOCATIONS_STORE, CUSTOMERS_STORE, SETTINGS_STORE, AUTH_STORE, WORKSTATION_STORE, SYNC_STATE_STORE]) {
    await clearStore(tx.objectStore(storeName));
  }
  await txDone(tx);
}

export async function clearOfflineSyncQueue() {
  const db = await openOfflineDatabase();
  const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
  await clearStore(tx.objectStore(SYNC_QUEUE_STORE));
  await txDone(tx);
}

export async function appendOfflineSyncQueueEntry(entry: Omit<OfflineSyncQueueEntry, 'localId' | 'createdAt' | 'updatedAt'>) {
  const db = await openOfflineDatabase();
  const now = new Date().toISOString();
  const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
  await putStore(tx.objectStore(SYNC_QUEUE_STORE), {
    ...entry,
    localId: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  } satisfies OfflineSyncQueueEntry);
  await txDone(tx);
}

export async function appendSyncLog(entry: Omit<OfflineSyncLogEntry, 'localId' | 'createdAt'>) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(SYNC_LOG_STORE, 'readwrite');
  await putStore(tx.objectStore(SYNC_LOG_STORE), {
    ...entry,
    localId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  } satisfies OfflineSyncLogEntry);
  await txDone(tx);
}

export async function appendSyncConflict(entry: Omit<OfflineSyncConflictEntry, 'localId' | 'createdAt'>) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(SYNC_CONFLICTS_STORE, 'readwrite');
  await putStore(tx.objectStore(SYNC_CONFLICTS_STORE), {
    ...entry,
    localId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  } satisfies OfflineSyncConflictEntry);
  await txDone(tx);
}

export async function persistBootstrapSnapshot(
  payload: PosSyncBootstrapPayload,
  auth: OfflineAuthSnapshot,
  workstation: OfflineWorkstationSnapshot,
  syncState: OfflineSyncState,
) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(
    [
      ARTICLES_STORE,
      LOTS_STORE,
      ALLOCATIONS_STORE,
      CUSTOMERS_STORE,
      SETTINGS_STORE,
      AUTH_STORE,
      WORKSTATION_STORE,
      SYNC_STATE_STORE,
    ],
    'readwrite',
  );

  await replaceAll(tx.objectStore(ARTICLES_STORE), payload.articles.map((row) => ({
    localKey: `${payload.tenant.tenantId}:${row.articleId}`,
    tenantId: payload.tenant.tenantId,
    articleId: row.articleId,
    articleCode: row.articleCode,
    commercialName: row.commercialName,
    barcode: row.barcode,
    isActive: row.isActive,
    salesUnit: row.salesUnit,
    packaging: row.packaging,
    packagingQuantity: row.packagingQuantity,
    defaultSellingPrice: row.defaultSellingPrice,
    updatedAt: row.updatedAt,
    lastSyncedAt: payload.serverTime,
  } satisfies OfflinePosArticle)));

  await replaceAll(tx.objectStore(LOTS_STORE), payload.lots.map((row) => ({
    localKey: `${payload.tenant.tenantId}:${row.lotId}`,
    tenantId: payload.tenant.tenantId,
    articleId: row.articleId,
    lotId: row.lotId,
    lotNumber: row.lotNumber,
    expiryDate: row.expiryDate,
    isBlocked: row.isBlocked,
    blockReason: row.blockReason,
    sellingPrice: row.sellingPrice,
    updatedAt: row.updatedAt,
    lastSyncedAt: payload.serverTime,
  } satisfies OfflinePosLot)));

  const currentAllocations = await readAllFromTransaction<OfflineStockAllocation>(tx.objectStore(ALLOCATIONS_STORE));
  const pendingByAllocationId = new Map(currentAllocations.map((row) => [row.allocationId, Math.max(0, Number(row.localPendingConsumption ?? 0))]));
  await replaceAll(tx.objectStore(ALLOCATIONS_STORE), payload.offlineAllocations.map((row) => normalizeAllocation({
    localId: row.allocationId,
    allocationId: row.allocationId,
    tenantId: payload.tenant.tenantId,
    siteId: row.siteId,
    workstationId: row.workstationId,
    articleId: row.articleId,
    lotId: row.lotId,
    lotNumber: payload.lots.find((lot) => lot.lotId === row.lotId)?.lotNumber ?? row.lotId,
    expiryDate: payload.lots.find((lot) => lot.lotId === row.lotId)?.expiryDate ?? '',
    isBlocked: payload.lots.find((lot) => lot.lotId === row.lotId)?.isBlocked ?? false,
    blockingReason: payload.lots.find((lot) => lot.lotId === row.lotId)?.blockReason ?? null,
    serverAllocatedQuantity: row.serverAllocatedQuantity,
    serverConsumedQuantity: row.serverConsumedQuantity,
    localPendingConsumption: pendingByAllocationId.get(row.allocationId) ?? 0,
    allocationStatus: normalizeAllocationStatus(row.status),
    serverVersion: row.serverVersion,
    updatedAt: row.updatedAt,
    lastSyncedAt: payload.serverTime,
  })));

  await replaceAll(tx.objectStore(CUSTOMERS_STORE), payload.customers.map((row) => ({
    localKey: `${payload.tenant.tenantId}:${row.customerId}`,
    tenantId: payload.tenant.tenantId,
    customerId: row.customerId,
    customerCode: row.customerCode,
    name: row.name,
    phone: row.phone,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
    lastSyncedAt: payload.serverTime,
  } satisfies OfflinePosCustomer)));

  await replaceAll(tx.objectStore(SETTINGS_STORE), [{
    key: 'pos-settings',
    tenantId: payload.tenant.tenantId,
    defaultCurrency: payload.settings.currency,
    supportedCurrencies: payload.settings.supportedCurrencies,
    offlineAuthorizationHours: payload.settings.offlineAuthorizationHours,
    allocationPolicy: payload.settings.allocationPolicy,
    timezone: payload.settings.timezone,
    exchangeRate: payload.settings.exchangeRate,
    lastSyncedAt: payload.serverTime,
  } satisfies OfflinePosSettings]);

  await replaceAll(tx.objectStore(AUTH_STORE), [auth]);
  await replaceAll(tx.objectStore(WORKSTATION_STORE), [workstation]);
  await replaceAll(tx.objectStore(SYNC_STATE_STORE), [syncState]);

  await txDone(tx);
}

export async function applyPosChanges(
  changesPayload: PosSyncChangesPayload,
  context: {
    tenantId: string;
    siteId: string;
    workstationId: string;
    syncState: OfflineSyncState;
  },
) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(
    [ARTICLES_STORE, LOTS_STORE, ALLOCATIONS_STORE, CUSTOMERS_STORE, SETTINGS_STORE, SYNC_STATE_STORE],
    'readwrite',
  );

  const articleStore = tx.objectStore(ARTICLES_STORE);
  const lotStore = tx.objectStore(LOTS_STORE);
  const allocationStore = tx.objectStore(ALLOCATIONS_STORE);
  const customerStore = tx.objectStore(CUSTOMERS_STORE);
  const settingsStore = tx.objectStore(SETTINGS_STORE);

  const currentArticles = new Map((await readAllFromTransaction<OfflinePosArticle>(articleStore)).map((row) => [row.articleId, row]));
  const currentLots = new Map((await readAllFromTransaction<OfflinePosLot>(lotStore)).map((row) => [row.lotId, row]));
  const currentAllocations = new Map((await readAllFromTransaction<OfflineStockAllocation>(allocationStore)).map((row) => [row.allocationId, row]));
  const currentCustomers = new Map((await readAllFromTransaction<OfflinePosCustomer>(customerStore)).map((row) => [row.customerId, row]));
  const currentSettings = (await readAllFromTransaction<OfflinePosSettings>(settingsStore))[0] ?? null;

  for (const row of changesPayload.changes.articles) {
    currentArticles.set(row.articleId, {
      localKey: `${context.tenantId}:${row.articleId}`,
      tenantId: context.tenantId,
      articleId: row.articleId,
      articleCode: row.articleCode,
      commercialName: row.commercialName,
      barcode: row.barcode,
      isActive: row.operation === 'DEACTIVATE' ? false : row.isActive,
      salesUnit: row.salesUnit,
      packaging: row.packaging,
      packagingQuantity: row.packagingQuantity,
      defaultSellingPrice: row.defaultSellingPrice,
      updatedAt: row.updatedAt,
      lastSyncedAt: changesPayload.serverTime,
    });
  }

  for (const row of changesPayload.changes.lots) {
    currentLots.set(row.lotId, {
      localKey: `${context.tenantId}:${row.lotId}`,
      tenantId: context.tenantId,
      articleId: row.articleId,
      lotId: row.lotId,
      lotNumber: row.lotNumber,
      expiryDate: row.expiryDate,
      isBlocked: row.operation === 'REVOKE' ? true : row.isBlocked,
      blockReason: row.blockReason,
      sellingPrice: row.sellingPrice,
      updatedAt: row.updatedAt,
      lastSyncedAt: changesPayload.serverTime,
    });
  }

  for (const row of changesPayload.changes.allocations) {
    const current = currentAllocations.get(row.allocationId);
    const lot = currentLots.get(row.lotId);
    currentAllocations.set(row.allocationId, normalizeAllocation({
      localId: row.allocationId,
      allocationId: row.allocationId,
      tenantId: context.tenantId,
      siteId: row.siteId,
      workstationId: row.workstationId,
      articleId: row.articleId,
      lotId: row.lotId,
      lotNumber: lot?.lotNumber ?? current?.lotNumber ?? row.lotId,
      expiryDate: lot?.expiryDate ?? current?.expiryDate ?? '',
      isBlocked: lot?.isBlocked ?? current?.isBlocked ?? false,
      blockingReason: lot?.blockReason ?? current?.blockingReason ?? null,
      serverAllocatedQuantity: row.serverAllocatedQuantity,
      serverConsumedQuantity: row.serverConsumedQuantity,
      localPendingConsumption: current?.localPendingConsumption ?? 0,
      allocationStatus: normalizeAllocationStatus(row.operation === 'REVOKE' ? 'REVOKED' : row.status),
      serverVersion: row.serverVersion,
      updatedAt: row.updatedAt,
      lastSyncedAt: changesPayload.serverTime,
    }));
  }

  for (const row of changesPayload.changes.customers) {
    currentCustomers.set(row.customerId, {
      localKey: `${context.tenantId}:${row.customerId}`,
      tenantId: context.tenantId,
      customerId: row.customerId,
      customerCode: row.customerCode,
      name: row.name,
      phone: row.phone,
      isActive: row.operation === 'DEACTIVATE' ? false : row.isActive,
      updatedAt: row.updatedAt,
      lastSyncedAt: changesPayload.serverTime,
    });
  }

  if (changesPayload.changes.settings.length > 0) {
    const last = changesPayload.changes.settings[changesPayload.changes.settings.length - 1];
    await replaceAll(settingsStore, [{
      key: 'pos-settings',
      tenantId: context.tenantId,
      defaultCurrency: currentSettings?.defaultCurrency ?? 'USD',
      supportedCurrencies: currentSettings?.supportedCurrencies ?? ['USD', 'CDF'],
      offlineAuthorizationHours: currentSettings?.offlineAuthorizationHours ?? 24,
      allocationPolicy: currentSettings?.allocationPolicy ?? 'STRICT_PER_WORKSTATION_LOT',
      timezone: currentSettings?.timezone ?? 'Africa/Kinshasa',
      exchangeRate: {
        fromCurrency: 'USD',
        toCurrency: 'CDF',
        rate: last.exchangeRate,
        effectiveDate: last.updatedAt,
        updatedAt: last.updatedAt,
      },
      lastSyncedAt: changesPayload.serverTime,
    } satisfies OfflinePosSettings]);
  }

  await replaceAll(articleStore, Array.from(currentArticles.values()));
  await replaceAll(lotStore, Array.from(currentLots.values()));
  await replaceAll(allocationStore, Array.from(currentAllocations.values()).map(normalizeAllocation));
  await replaceAll(customerStore, Array.from(currentCustomers.values()));
  await replaceAll(tx.objectStore(SYNC_STATE_STORE), [{
    ...context.syncState,
    syncCursor: changesPayload.nextCursor,
    serverTime: changesPayload.serverTime,
    lastSuccessfulSyncAt: changesPayload.serverTime,
    lastAttemptAt: changesPayload.serverTime,
  } satisfies OfflineSyncState]);

  await txDone(tx);
}

export async function seedOfflineAllocationFixtures(rows: OfflineStockAllocation[]) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(ALLOCATIONS_STORE, 'readwrite');
  await replaceAll(tx.objectStore(ALLOCATIONS_STORE), rows.map(normalizeAllocation));
  await txDone(tx);
}

async function openOfflineDatabase() {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB not available');
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Offline DB open failed'));
    request.onupgradeneeded = () => {
      const db = request.result;
      const upgradeTransaction = request.transaction;
      ensureObjectStore(db, upgradeTransaction, ARTICLES_STORE, 'localKey', [['byTenant', 'tenantId'], ['byArticle', 'articleId']]);
      ensureObjectStore(db, upgradeTransaction, LOTS_STORE, 'localKey', [['byTenant', 'tenantId'], ['byLot', 'lotId'], ['byArticle', 'articleId']]);
      ensureObjectStore(db, upgradeTransaction, ALLOCATIONS_STORE, 'localId', [['byTenant', 'tenantId'], ['bySite', 'siteId'], ['byWorkstation', 'workstationId'], ['byArticle', 'articleId'], ['byLot', 'lotId'], ['byStatus', 'allocationStatus']]);
      ensureObjectStore(db, upgradeTransaction, CUSTOMERS_STORE, 'localKey', [['byTenant', 'tenantId'], ['byCustomer', 'customerId']]);
      ensureObjectStore(db, upgradeTransaction, SETTINGS_STORE, 'key');
      ensureObjectStore(db, upgradeTransaction, AUTH_STORE, 'id');
      ensureObjectStore(db, upgradeTransaction, WORKSTATION_STORE, 'id');
      ensureObjectStore(db, upgradeTransaction, SYNC_STATE_STORE, 'id');
      ensureObjectStore(db, upgradeTransaction, SYNC_QUEUE_STORE, 'localId', [['byOperation', 'operationId'], ['byStatus', 'status'], ['byWorkstation', 'workstationId']]);
      ensureObjectStore(db, upgradeTransaction, SYNC_LOG_STORE, 'localId', [['byType', 'type'], ['byStatus', 'status']]);
      ensureObjectStore(db, upgradeTransaction, SYNC_CONFLICTS_STORE, 'localId', [['byCode', 'code'], ['byLot', 'lotId']]);
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function ensureObjectStore(
  db: IDBDatabase,
  upgradeTransaction: IDBTransaction | null,
  name: string,
  keyPath: string,
  indexes: Array<[string, string]> = [],
) {
  const store = db.objectStoreNames.contains(name)
    ? upgradeTransaction?.objectStore(name)
    : db.createObjectStore(name, { keyPath });
  if (!store) return;
  const target = store;
  for (const [indexName, field] of indexes) {
    if (!target.indexNames.contains(indexName)) target.createIndex(indexName, field, { unique: false });
  }
}

function normalizeAllocation(row: OfflineStockAllocation): OfflineStockAllocation {
  const normalizedStatus = normalizeAllocationStatus(row.allocationStatus);
  const serverAllocatedQuantity = Math.max(0, Number(row.serverAllocatedQuantity ?? 0));
  const serverConsumedQuantity = Math.max(0, Number(row.serverConsumedQuantity ?? 0));
  const localPendingConsumption = Math.max(0, Number(row.localPendingConsumption ?? 0));
  return {
    ...row,
    allocationId: row.allocationId ?? row.localId,
    localId: row.localId ?? row.allocationId,
    blockingReason: row.blockingReason ?? null,
    serverAllocatedQuantity,
    serverConsumedQuantity: Math.min(serverConsumedQuantity, serverAllocatedQuantity),
    localPendingConsumption,
    allocationStatus: normalizedStatus === 'ACTIVE' && serverAllocatedQuantity - serverConsumedQuantity - localPendingConsumption <= 0
      ? 'EXHAUSTED'
      : normalizedStatus,
    updatedAt: row.updatedAt ?? null,
    lastSyncedAt: row.lastSyncedAt ?? null,
  };
}

async function replaceAll<T>(store: IDBObjectStore, rows: T[]) {
  await clearStore(store);
  for (const row of rows) await putStore(store, row);
}

async function readAll<T>(db: IDBDatabase, storeName: string) {
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onerror = () => reject(request.error ?? new Error(`Failed to read ${storeName}`));
    request.onsuccess = () => resolve(request.result as T[]);
  });
}

async function readAllFromTransaction<T>(store: IDBObjectStore) {
  return new Promise<T[]>((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error ?? new Error('Failed to read transaction store'));
    request.onsuccess = () => resolve(request.result as T[]);
  });
}

async function putStore<T>(store: IDBObjectStore, value: T) {
  return new Promise<void>((resolve, reject) => {
    const request = store.put(value);
    request.onerror = () => reject(request.error ?? new Error('Failed to persist offline record'));
    request.onsuccess = () => resolve();
  });
}

async function clearStore(store: IDBObjectStore) {
  return new Promise<void>((resolve, reject) => {
    const request = store.clear();
    request.onerror = () => reject(request.error ?? new Error('Failed to clear offline store'));
    request.onsuccess = () => resolve();
  });
}

async function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Offline transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('Offline transaction aborted'));
  });
}

export function createDefaultSyncState(overrides: Partial<OfflineSyncState> = {}): OfflineSyncState {
  return {
    id: 'sync-state',
    tenantId: null,
    siteId: null,
    workstationId: null,
    bootstrapVersion: null,
    syncCursor: null,
    serverTime: null,
    lastSuccessfulSyncAt: null,
    lastAttemptAt: null,
    snapshotStatus: 'UNKNOWN',
    networkStatus: 'OFFLINE',
    lastErrorCode: null,
    lastErrorMessage: null,
    ...overrides,
  };
}

export function computeSnapshotStatus(params: {
  lastSuccessfulSyncAt?: string | null;
  offlineAuthorizationExpiresAt?: string | null;
  workstationStatus?: string | null;
  freshThresholdMinutes: number;
  now?: Date;
}): OfflineSnapshotStatus {
  const now = params.now ?? new Date();
  if (params.workstationStatus === 'REVOKED') return 'REVOKED';
  if (!params.lastSuccessfulSyncAt) return 'UNKNOWN';
  if (params.offlineAuthorizationExpiresAt && new Date(params.offlineAuthorizationExpiresAt).getTime() <= now.getTime()) return 'EXPIRED';
  const ageMinutes = (now.getTime() - new Date(params.lastSuccessfulSyncAt).getTime()) / 60000;
  return ageMinutes < params.freshThresholdMinutes ? 'FRESH' : 'STALE';
}
