import {
  type OfflineActivityLogEntry,
  type OfflineAuthSnapshot,
  type OfflineCart,
  type OfflineCashCount,
  type OfflineCashMovement,
  type OfflineCashReconciliationEvent,
  type OfflineCashSessionSnapshot,
  type OfflineDraftReservation,
  type OfflineLocalSnapshot,
  type OfflineMetadataRecord,
  type OfflinePayment,
  type OfflineInsuranceOrganization,
  type OfflineInsurancePlan,
  type OfflinePosArticle,
  type OfflinePosCustomer,
  type OfflinePosLot,
  type OfflinePosSettings,
  type OfflineCustomerMembership,
  type OfflinePendingConsumption,
  type OfflineSale,
  type OfflineSaleValidateOperation,
  type OfflineSnapshotStatus,
  type OfflineStockAllocation,
  type OfflineSyncOperationPayload,
  type OfflineSyncConflictEntry,
  type OfflineSyncLogEntry,
  type OfflineSyncQueueEntry,
  type OfflineSyncState,
  type OfflineWorkstationSnapshot,
  type PosSyncBootstrapPayload,
  type PosSyncChangesPayload,
} from './offline-types';
import { normalizeAllocationStatus } from './offline-fefo';
import { type PosSyncOperationAllocationAck, type PosSyncOperationResult } from '../../services/posSync.service';
import { OFFLINE_APP_VERSION, OFFLINE_DB_NAME, OFFLINE_DB_VERSION, OFFLINE_SNAPSHOT_SCHEMA_VERSION } from './offline-config';

const ARTICLES_STORE = 'offline_articles';
const LOTS_STORE = 'offline_lots';
const ALLOCATIONS_STORE = 'offline_allocations';
const CUSTOMERS_STORE = 'offline_customers';
const ORGANIZATIONS_STORE = 'offline_organizations';
const INSURANCE_PLANS_STORE = 'offline_insurance_plans';
const MEMBERSHIPS_STORE = 'offline_memberships';
const SETTINGS_STORE = 'offline_settings';
const AUTH_STORE = 'auth_snapshot';
const WORKSTATION_STORE = 'workstation';
const CASH_SESSION_STORE = 'offline_cash_sessions';
const CASH_MOVEMENTS_STORE = 'offline_cash_movements';
const CASH_COUNTS_STORE = 'offline_cash_counts';
const CASH_RECONCILIATION_EVENTS_STORE = 'offline_cash_reconciliation_events';
const SYNC_STATE_STORE = 'sync_state';
const SYNC_QUEUE_STORE = 'sync_queue';
const SYNC_LOG_STORE = 'sync_log';
const SYNC_CONFLICTS_STORE = 'sync_conflicts';
const CARTS_STORE = 'offline_carts';
const DRAFT_RESERVATIONS_STORE = 'offline_draft_reservations';
const ACTIVITY_LOG_STORE = 'offline_activity_log';
const OFFLINE_SALES_STORE = 'offline_sales';
const OFFLINE_PAYMENTS_STORE = 'offline_payments';
const OFFLINE_PENDING_CONSUMPTIONS_STORE = 'offline_pending_consumptions';
const OFFLINE_METADATA_STORE = 'offline_metadata';

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

export async function readOfflineOrganizations() {
  const db = await openOfflineDatabase();
  return readAll<OfflineInsuranceOrganization>(db, ORGANIZATIONS_STORE);
}

export async function readOfflineInsurancePlans() {
  const db = await openOfflineDatabase();
  return readAll<OfflineInsurancePlan>(db, INSURANCE_PLANS_STORE);
}

export async function readOfflineMemberships() {
  const db = await openOfflineDatabase();
  return readAll<OfflineCustomerMembership>(db, MEMBERSHIPS_STORE);
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

export async function readOfflineCashSession() {
  const db = await openOfflineDatabase();
  const rows = await readAll<OfflineCashSessionSnapshot>(db, CASH_SESSION_STORE);
  return selectActiveOfflineCashSession(rows);
}

export async function readOfflineCashSessions() {
  const db = await openOfflineDatabase();
  const rows = await readAll<OfflineCashSessionSnapshot>(db, CASH_SESSION_STORE);
  return rows.sort((left, right) => sortByMostRecent(right.updatedAt ?? right.openedLocallyAt, left.updatedAt ?? left.openedLocallyAt));
}

export async function readOfflineCashMovements() {
  const db = await openOfflineDatabase();
  const rows = await readAll<OfflineCashMovement>(db, CASH_MOVEMENTS_STORE);
  return rows.sort((left, right) => sortByMostRecent(right.createdLocallyAt, left.createdLocallyAt));
}

export async function readOfflineCashCounts() {
  const db = await openOfflineDatabase();
  const rows = await readAll<OfflineCashCount>(db, CASH_COUNTS_STORE);
  return rows.sort((left, right) => sortByMostRecent(right.countedAt, left.countedAt));
}

export async function readOfflineCashReconciliationEvents() {
  const db = await openOfflineDatabase();
  const rows = await readAll<OfflineCashReconciliationEvent>(db, CASH_RECONCILIATION_EVENTS_STORE);
  return rows.sort((left, right) => sortByMostRecent(right.createdAt, left.createdAt));
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

export async function readOfflineCarts() {
  const db = await openOfflineDatabase();
  return readAll<OfflineCart>(db, CARTS_STORE);
}

export async function readOfflineCart(cartId: string) {
  const carts = await readOfflineCarts();
  return carts.find((cart) => cart.cartId === cartId) ?? null;
}

export async function readOfflineDraftReservations() {
  const db = await openOfflineDatabase();
  return readAll<OfflineDraftReservation>(db, DRAFT_RESERVATIONS_STORE);
}

export async function readOfflineActivityLog() {
  const db = await openOfflineDatabase();
  return readAll<OfflineActivityLogEntry>(db, ACTIVITY_LOG_STORE);
}

export async function readOfflineSales() {
  const db = await openOfflineDatabase();
  return readAll<OfflineSale>(db, OFFLINE_SALES_STORE);
}

export async function readOfflinePayments() {
  const db = await openOfflineDatabase();
  return readAll<OfflinePayment>(db, OFFLINE_PAYMENTS_STORE);
}

export async function readOfflinePendingConsumptions() {
  const db = await openOfflineDatabase();
  return readAll<OfflinePendingConsumption>(db, OFFLINE_PENDING_CONSUMPTIONS_STORE);
}

export async function readOfflineMetadata() {
  const db = await openOfflineDatabase();
  const rows = await readAll<OfflineMetadataRecord>(db, OFFLINE_METADATA_STORE);
  return rows[0] ?? createDefaultOfflineMetadata();
}

export async function writeOfflineMetadata(metadata: OfflineMetadataRecord) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(OFFLINE_METADATA_STORE, 'readwrite');
  await replaceAll(tx.objectStore(OFFLINE_METADATA_STORE), [metadata]);
  await txDone(tx);
}

export async function writeOfflineDraftReservations(rows: OfflineDraftReservation[]) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(DRAFT_RESERVATIONS_STORE, 'readwrite');
  await replaceAll(tx.objectStore(DRAFT_RESERVATIONS_STORE), rows);
  await txDone(tx);
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
    organizations,
    insurancePlans,
    memberships,
    settings,
    auth,
    workstation,
    cashSession,
    syncState,
  ] = await Promise.all([
    readOfflineArticles(),
    readOfflineLots(),
    readOfflineAllocations(),
    readOfflineCustomers(),
    readOfflineOrganizations(),
    readOfflineInsurancePlans(),
    readOfflineMemberships(),
    readOfflineSettings(),
    readAuthSnapshot(),
    readWorkstationSnapshot(),
    readOfflineCashSession(),
    readSyncState(),
  ]);

  return {
    articles,
    lots,
    allocations,
    customers,
    organizations,
    insurancePlans,
    memberships,
    settings,
    auth,
    workstation,
    cashSession,
    syncState,
  };
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
      ORGANIZATIONS_STORE,
      INSURANCE_PLANS_STORE,
      MEMBERSHIPS_STORE,
      SETTINGS_STORE,
      AUTH_STORE,
      WORKSTATION_STORE,
      CASH_SESSION_STORE,
      CASH_MOVEMENTS_STORE,
      CASH_COUNTS_STORE,
      CASH_RECONCILIATION_EVENTS_STORE,
      SYNC_STATE_STORE,
    ],
    'readwrite',
  );
  for (const storeName of [
    ARTICLES_STORE,
    LOTS_STORE,
    ALLOCATIONS_STORE,
    CUSTOMERS_STORE,
    ORGANIZATIONS_STORE,
    INSURANCE_PLANS_STORE,
    MEMBERSHIPS_STORE,
    SETTINGS_STORE,
    AUTH_STORE,
    WORKSTATION_STORE,
    CASH_SESSION_STORE,
    CASH_MOVEMENTS_STORE,
    CASH_COUNTS_STORE,
    CASH_RECONCILIATION_EVENTS_STORE,
    SYNC_STATE_STORE,
  ]) {
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

export async function saveOfflineSyncQueue(rows: OfflineSyncQueueEntry[]) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
  await replaceAll(tx.objectStore(SYNC_QUEUE_STORE), rows);
  await txDone(tx);
}

export async function resetStaleSyncingQueueEntries(maxAgeMs = 5 * 60 * 1000) {
  const rows = await readOfflineSyncQueue();
  const now = Date.now();
  const nextRows = rows.map((row) => {
    if (row.status !== 'SYNCING') return row;
    const updatedAtMs = new Date(row.updatedAt).getTime();
    if (Number.isNaN(updatedAtMs) || now - updatedAtMs < maxAgeMs) return row;
    return {
      ...row,
      status: 'PENDING' as const,
      updatedAt: new Date().toISOString(),
      lastErrorCode: row.lastErrorCode ?? 'SYNC_RECOVERED_AFTER_RELOAD',
      lastErrorMessage: row.lastErrorMessage ?? 'Operation remise en attente apres reprise locale.',
    };
  });
  await saveOfflineSyncQueue(nextRows);
  return nextRows;
}

export async function saveOfflineCart(cart: OfflineCart, reservations: OfflineDraftReservation[], activityEntries: OfflineActivityLogEntry[] = []) {
  const db = await openOfflineDatabase();
  const tx = db.transaction([CARTS_STORE, DRAFT_RESERVATIONS_STORE, ACTIVITY_LOG_STORE], 'readwrite');
  const cartStore = tx.objectStore(CARTS_STORE);
  const reservationStore = tx.objectStore(DRAFT_RESERVATIONS_STORE);
  const activityStore = tx.objectStore(ACTIVITY_LOG_STORE);

  await putStore(cartStore, cart);

  const allReservations = await readAllFromTransaction<OfflineDraftReservation>(reservationStore);
  await clearStore(reservationStore);
  for (const row of allReservations.filter((entry) => entry.cartId !== cart.cartId)) {
    await putStore(reservationStore, row);
  }
  for (const reservation of reservations) {
    await putStore(reservationStore, reservation);
  }

  for (const entry of activityEntries) {
    await putStore(activityStore, entry);
  }

  await txDone(tx);
}

export async function saveOfflineCarts(carts: OfflineCart[]) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(CARTS_STORE, 'readwrite');
  await replaceAll(tx.objectStore(CARTS_STORE), carts);
  await txDone(tx);
}

export async function saveOfflineSales(rows: OfflineSale[]) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(OFFLINE_SALES_STORE, 'readwrite');
  await replaceAll(tx.objectStore(OFFLINE_SALES_STORE), rows);
  await txDone(tx);
}

export async function saveOfflinePayments(rows: OfflinePayment[]) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(OFFLINE_PAYMENTS_STORE, 'readwrite');
  await replaceAll(tx.objectStore(OFFLINE_PAYMENTS_STORE), rows);
  await txDone(tx);
}

export async function saveOfflinePendingConsumptions(rows: OfflinePendingConsumption[]) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(OFFLINE_PENDING_CONSUMPTIONS_STORE, 'readwrite');
  await replaceAll(tx.objectStore(OFFLINE_PENDING_CONSUMPTIONS_STORE), rows);
  await txDone(tx);
}

export async function saveOfflineCashSessions(rows: OfflineCashSessionSnapshot[]) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(CASH_SESSION_STORE, 'readwrite');
  await replaceAll(tx.objectStore(CASH_SESSION_STORE), rows);
  await txDone(tx);
}

export async function saveOfflineCashMovements(rows: OfflineCashMovement[]) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(CASH_MOVEMENTS_STORE, 'readwrite');
  await replaceAll(tx.objectStore(CASH_MOVEMENTS_STORE), rows);
  await txDone(tx);
}

export async function saveOfflineCashCounts(rows: OfflineCashCount[]) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(CASH_COUNTS_STORE, 'readwrite');
  await replaceAll(tx.objectStore(CASH_COUNTS_STORE), rows);
  await txDone(tx);
}

export async function saveOfflineCashReconciliationEvents(rows: OfflineCashReconciliationEvent[]) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(CASH_RECONCILIATION_EVENTS_STORE, 'readwrite');
  await replaceAll(tx.objectStore(CASH_RECONCILIATION_EVENTS_STORE), rows);
  await txDone(tx);
}

export async function persistValidatedOfflineSale(params: {
  sale: OfflineSale;
  payment: OfflinePayment;
  pendingConsumptions: OfflinePendingConsumption[];
  cashSession?: OfflineCashSessionSnapshot | null;
  cashMovements?: OfflineCashMovement[];
  queueEntry: Omit<OfflineSyncQueueEntry, 'localId' | 'createdAt' | 'updatedAt'>;
  cartId: string;
  activityEntries?: OfflineActivityLogEntry[];
}) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(
    [
      CARTS_STORE,
      DRAFT_RESERVATIONS_STORE,
      ALLOCATIONS_STORE,
      CASH_SESSION_STORE,
      CASH_MOVEMENTS_STORE,
      OFFLINE_SALES_STORE,
      OFFLINE_PAYMENTS_STORE,
      OFFLINE_PENDING_CONSUMPTIONS_STORE,
      SYNC_QUEUE_STORE,
      ACTIVITY_LOG_STORE,
    ],
    'readwrite',
  );

  const cartsStore = tx.objectStore(CARTS_STORE);
  const reservationsStore = tx.objectStore(DRAFT_RESERVATIONS_STORE);
  const allocationsStore = tx.objectStore(ALLOCATIONS_STORE);
  const cashSessionStore = tx.objectStore(CASH_SESSION_STORE);
  const cashMovementsStore = tx.objectStore(CASH_MOVEMENTS_STORE);
  const salesStore = tx.objectStore(OFFLINE_SALES_STORE);
  const paymentsStore = tx.objectStore(OFFLINE_PAYMENTS_STORE);
  const pendingStore = tx.objectStore(OFFLINE_PENDING_CONSUMPTIONS_STORE);
  const queueStore = tx.objectStore(SYNC_QUEUE_STORE);
  const activityStore = tx.objectStore(ACTIVITY_LOG_STORE);

  const [carts, reservations, allocations, cashSessions, cashMovements, sales, payments, pendingRows] = await Promise.all([
    readAllFromTransaction<OfflineCart>(cartsStore),
    readAllFromTransaction<OfflineDraftReservation>(reservationsStore),
    readAllFromTransaction<OfflineStockAllocation>(allocationsStore),
    readAllFromTransaction<OfflineCashSessionSnapshot>(cashSessionStore),
    readAllFromTransaction<OfflineCashMovement>(cashMovementsStore),
    readAllFromTransaction<OfflineSale>(salesStore),
    readAllFromTransaction<OfflinePayment>(paymentsStore),
    readAllFromTransaction<OfflinePendingConsumption>(pendingStore),
  ]);

  const nextCarts = carts.map((cart) => cart.cartId === params.cartId
    ? { ...cart, status: 'CANCELLED', saveState: 'SAVED', updatedAt: params.sale.validatedAt, blockedReasons: [] }
    : cart);
  const nextReservations = reservations.filter((entry) => entry.cartId !== params.cartId);
  const pendingByAllocation = new Map<string, number>();
  for (const row of params.pendingConsumptions) {
    pendingByAllocation.set(row.allocationId, (pendingByAllocation.get(row.allocationId) ?? 0) + row.quantity);
  }
  const nextAllocations = allocations.map((row) => {
    const extra = pendingByAllocation.get(row.allocationId) ?? 0;
    if (extra <= 0) return normalizeAllocation(row);
    return normalizeAllocation({
      ...row,
      localPendingConsumption: Number(row.localPendingConsumption ?? 0) + extra,
    });
  });
  const nextSales = [...sales.filter((row) => row.localSaleId !== params.sale.localSaleId), params.sale];
  const nextPayments = [...payments.filter((row) => row.offlinePaymentId !== params.payment.offlinePaymentId), params.payment];
  const nextPendingRows = [
    ...pendingRows.filter((row) => row.localSaleId !== params.sale.localSaleId),
    ...params.pendingConsumptions,
  ];
  const nextCashSessions = params.cashSession
    ? cashSessions.map((row) => row.localCashSessionId === params.cashSession?.localCashSessionId ? params.cashSession : row)
    : cashSessions;
  const nextCashMovements = params.cashMovements && params.cashMovements.length > 0
    ? [
        ...cashMovements.filter((row) => !params.cashMovements?.some((movement) => movement.localMovementId === row.localMovementId)),
        ...params.cashMovements,
      ]
    : cashMovements;

  await replaceAll(cartsStore, nextCarts);
  await replaceAll(reservationsStore, nextReservations);
  await replaceAll(allocationsStore, nextAllocations);
  await replaceAll(cashSessionStore, nextCashSessions);
  await replaceAll(cashMovementsStore, nextCashMovements);
  await replaceAll(salesStore, nextSales);
  await replaceAll(paymentsStore, nextPayments);
  await replaceAll(pendingStore, nextPendingRows);

  const now = params.sale.validatedAt;
  await putStore(queueStore, {
    ...params.queueEntry,
    localId: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  } satisfies OfflineSyncQueueEntry);

  for (const entry of params.activityEntries ?? []) {
    await putStore(activityStore, entry);
  }

  await txDone(tx);
}

export async function updateOfflineSyncOperationResult(params: {
  operationId: string;
  nextStatus: OfflineSyncQueueEntry['status'];
  result?: PosSyncOperationResult | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(
    [
      SYNC_QUEUE_STORE,
      OFFLINE_SALES_STORE,
      OFFLINE_PENDING_CONSUMPTIONS_STORE,
      ALLOCATIONS_STORE,
      CASH_SESSION_STORE,
      CASH_MOVEMENTS_STORE,
      CASH_RECONCILIATION_EVENTS_STORE,
      ACTIVITY_LOG_STORE,
    ],
    'readwrite',
  );
  const queueStore = tx.objectStore(SYNC_QUEUE_STORE);
  const salesStore = tx.objectStore(OFFLINE_SALES_STORE);
  const pendingStore = tx.objectStore(OFFLINE_PENDING_CONSUMPTIONS_STORE);
  const allocationsStore = tx.objectStore(ALLOCATIONS_STORE);
  const cashSessionStore = tx.objectStore(CASH_SESSION_STORE);
  const cashMovementsStore = tx.objectStore(CASH_MOVEMENTS_STORE);
  const reconciliationStore = tx.objectStore(CASH_RECONCILIATION_EVENTS_STORE);
  const activityStore = tx.objectStore(ACTIVITY_LOG_STORE);

  const [queueEntries, sales, pendingRows, allocations, cashSessions, cashMovements, reconciliationEvents] = await Promise.all([
    readAllFromTransaction<OfflineSyncQueueEntry>(queueStore),
    readAllFromTransaction<OfflineSale>(salesStore),
    readAllFromTransaction<OfflinePendingConsumption>(pendingStore),
    readAllFromTransaction<OfflineStockAllocation>(allocationsStore),
    readAllFromTransaction<OfflineCashSessionSnapshot>(cashSessionStore),
    readAllFromTransaction<OfflineCashMovement>(cashMovementsStore),
    readAllFromTransaction<OfflineCashReconciliationEvent>(reconciliationStore),
  ]);
  const queueEntry = queueEntries.find((row) => row.operationId === params.operationId);
  if (!queueEntry) {
    await txDone(tx);
    return;
  }

  const now = new Date().toISOString();
  await replaceAll(queueStore, queueEntries.map((row) => row.operationId === params.operationId ? {
    ...row,
    status: params.nextStatus,
    updatedAt: now,
    lastErrorCode: params.errorCode ?? null,
    lastErrorMessage: params.errorMessage ?? null,
  } : row));

  const result = params.result ?? null;
  const saleId = 'localSaleId' in queueEntry.payload ? queueEntry.payload.localSaleId : null;

  if (queueEntry.operationType === 'SALE_VALIDATE' && saleId) {
    await replaceAll(salesStore, sales.map((row) => row.localSaleId === saleId ? {
      ...row,
      status: params.nextStatus === 'SYNCED' ? 'SYNCED' : params.nextStatus === 'CONFLICT' ? 'CONFLICT' : row.status,
      syncStatus: params.nextStatus,
      serverSaleId: result?.serverSaleId ?? row.serverSaleId,
      serverSaleNumber: result?.serverSaleNumber ?? row.serverSaleNumber,
      syncedAt: params.nextStatus === 'SYNCED' ? now : row.syncedAt,
    } : row));

    if (params.nextStatus === 'SYNCED') {
      const allocationAcks = new Map((result?.allocations ?? []).map((entry) => [entry.allocationId, entry]));
      await replaceAll(allocationsStore, allocations.map((row) => {
        const ack = allocationAcks.get(row.allocationId);
        if (!ack) return normalizeAllocation(row);
        return normalizeAllocation({
          ...row,
          serverConsumedQuantity: Math.max(Number(row.serverConsumedQuantity ?? 0), Number(ack.serverConsumedQuantity ?? 0)),
          localPendingConsumption: Math.max(0, Number(row.localPendingConsumption ?? 0) - Number(ack.acknowledgedQuantity ?? 0)),
          allocationStatus: normalizeAllocationStatus(ack.status),
          serverVersion: Math.max(Number(row.serverVersion ?? 0), Number(ack.serverVersion ?? 0)),
          updatedAt: now,
          lastSyncedAt: now,
        });
      }));
      await replaceAll(pendingStore, pendingRows.map((row) => row.localSaleId === saleId ? {
        ...row,
        status: 'SYNCED',
        syncedAt: now,
      } : row));
    }

    await putStore(activityStore, {
      localId: crypto.randomUUID(),
      cartId: null,
      saleId,
      type: params.nextStatus === 'SYNCED' ? 'sale.synced' : 'sale.sync_conflict',
      message: params.nextStatus === 'SYNCED'
        ? `Vente offline ${saleId} synchronisee sur le serveur.`
        : `Conflit de synchronisation offline ${saleId}: ${params.errorMessage ?? params.errorCode ?? 'inconnu'}.`,
      createdAt: now,
    } satisfies OfflineActivityLogEntry);
  }

  if (queueEntry.operationType === 'CASH_SESSION_OPEN') {
    const operation = queueEntry.payload as Extract<OfflineSyncOperationPayload, { operationType: 'CASH_SESSION_OPEN' }>;
    const nextSessions = cashSessions.map((row) => {
      if (row.localCashSessionId !== operation.localCashSessionId) return row;
      if (params.nextStatus === 'SYNCED') {
        return {
          ...row,
          status: 'OPEN_SYNCED',
          serverCashSessionId: result?.serverCashSessionId ?? row.serverCashSessionId,
          serverSessionReference: result?.serverSessionReference ?? row.serverSessionReference,
          serverOpenedAt: result?.serverOpenedAt ?? row.serverOpenedAt ?? now,
          serverVersion: Math.max(Number(row.serverVersion ?? 0), Number(result?.serverVersion ?? 0)),
          syncedAt: now,
          lastSyncedAt: now,
          updatedAt: now,
        };
      }
      if (params.nextStatus === 'CONFLICT') {
        return { ...row, status: 'CONFLICT', updatedAt: now };
      }
      return { ...row, updatedAt: now };
    });
    const nextMovements = cashMovements.map((row) =>
      row.operationId === operation.operationId
        ? {
            ...row,
            status: params.nextStatus === 'SYNCED' ? 'SYNCED' : params.nextStatus === 'CONFLICT' ? 'CONFLICT' : row.status,
            syncedAt: params.nextStatus === 'SYNCED' ? now : row.syncedAt,
          }
        : row,
    );
    await replaceAll(cashSessionStore, nextSessions);
    await replaceAll(cashMovementsStore, nextMovements);
    await putStore(activityStore, {
      localId: crypto.randomUUID(),
      cartId: null,
      saleId: null,
      type: params.nextStatus === 'SYNCED' ? 'cash.session_synced' : 'cash.session_conflict',
      message: params.nextStatus === 'SYNCED'
        ? `Session offline ${operation.offlineCashReference} synchronisee.`
        : `Conflit session offline ${operation.offlineCashReference}: ${params.errorMessage ?? params.errorCode ?? 'inconnu'}.`,
      createdAt: now,
    } satisfies OfflineActivityLogEntry);
  }

  if (queueEntry.operationType === 'CASH_EXPENSE') {
    const operation = queueEntry.payload as Extract<OfflineSyncOperationPayload, { operationType: 'CASH_EXPENSE' }>;
    const nextMovements = cashMovements.map((row) =>
      row.localMovementId === operation.localMovementId
        ? {
            ...row,
            serverMovementId: result?.serverMovementId ?? row.serverMovementId,
            status: params.nextStatus === 'SYNCED' ? 'SYNCED' : params.nextStatus === 'CONFLICT' ? 'CONFLICT' : row.status,
            syncedAt: params.nextStatus === 'SYNCED' ? now : row.syncedAt,
          }
        : row,
    );
    const nextSessions = cashSessions.map((row) =>
      row.localCashSessionId === operation.localCashSessionId && params.nextStatus === 'SYNCED'
        ? {
            ...row,
            serverCashSessionId: result?.serverCashSessionId ?? row.serverCashSessionId,
            serverVersion: Math.max(Number(row.serverVersion ?? 0), Number(result?.serverVersion ?? 0)),
            lastSyncedAt: now,
            updatedAt: now,
          }
        : row.localCashSessionId === operation.localCashSessionId && params.nextStatus === 'CONFLICT'
          ? { ...row, status: 'CONFLICT', updatedAt: now }
          : row
    );
    await replaceAll(cashMovementsStore, nextMovements);
    await replaceAll(cashSessionStore, nextSessions);
  }

  if (queueEntry.operationType === 'CASH_SESSION_CLOSE') {
    const operation = queueEntry.payload as Extract<OfflineSyncOperationPayload, { operationType: 'CASH_SESSION_CLOSE' }>;
    const nextSessions = cashSessions.map((row) => {
      if (row.localCashSessionId !== operation.localCashSessionId) return row;
      if (params.nextStatus === 'SYNCED') {
        return {
          ...row,
          status: 'CLOSED_SYNCED',
          serverCashSessionId: result?.serverCashSessionId ?? row.serverCashSessionId,
          serverSessionReference: result?.serverSessionReference ?? row.serverSessionReference,
          serverClosedAt: result?.serverClosedAt ?? row.serverClosedAt ?? now,
          serverExpectedClosingUsd: result?.serverExpectedUsd ?? row.serverExpectedClosingUsd,
          serverExpectedClosingCdf: result?.serverExpectedCdf ?? row.serverExpectedClosingCdf,
          serverDifferenceUsd: result?.serverDifferenceUsd ?? row.serverDifferenceUsd,
          serverDifferenceCdf: result?.serverDifferenceCdf ?? row.serverDifferenceCdf,
          declaredClosingUsd: result?.serverDeclaredUsd ?? row.declaredClosingUsd,
          declaredClosingCdf: result?.serverDeclaredCdf ?? row.declaredClosingCdf,
          serverVersion: Math.max(Number(row.serverVersion ?? 0), Number(result?.serverVersion ?? 0)),
          syncedAt: now,
          lastSyncedAt: now,
          updatedAt: now,
        };
      }
      if (params.nextStatus === 'CONFLICT') {
        return { ...row, status: 'CONFLICT', updatedAt: now };
      }
      return { ...row, updatedAt: now };
    });
    const nextMovements = cashMovements.map((row) =>
      row.operationId === operation.operationId
        ? {
            ...row,
            status: params.nextStatus === 'SYNCED' ? 'SYNCED' : params.nextStatus === 'CONFLICT' ? 'CONFLICT' : row.status,
            syncedAt: params.nextStatus === 'SYNCED' ? now : row.syncedAt,
          }
        : row,
    );
    await replaceAll(cashSessionStore, nextSessions);
    await replaceAll(cashMovementsStore, nextMovements);

    if (params.nextStatus === 'CONFLICT' && (params.errorCode ?? result?.errorCode) === 'CASH_EXPECTED_BALANCE_MISMATCH') {
      await replaceAll(reconciliationStore, [
        ...reconciliationEvents,
        {
          eventId: crypto.randomUUID(),
          localCashSessionId: operation.localCashSessionId,
          operationId: operation.operationId,
          code: 'CASH_EXPECTED_BALANCE_MISMATCH',
          message: params.errorMessage ?? result?.message ?? 'Ecart entre le theorique local et le theorique serveur.',
          localExpectedUsd: operation.expectedClosingUsd,
          localExpectedCdf: operation.expectedClosingCdf,
          serverExpectedUsd: result?.serverExpectedUsd ?? null,
          serverExpectedCdf: result?.serverExpectedCdf ?? null,
          createdAt: now,
        } satisfies OfflineCashReconciliationEvent,
      ]);
    }
    await putStore(activityStore, {
      localId: crypto.randomUUID(),
      cartId: null,
      saleId: null,
      type: params.nextStatus === 'SYNCED' ? 'cash.session_synced' : 'cash.session_conflict',
      message: params.nextStatus === 'SYNCED'
        ? `Fermeture offline ${operation.offlineCashReference} synchronisee.`
        : `Conflit fermeture offline ${operation.offlineCashReference}: ${params.errorMessage ?? params.errorCode ?? 'inconnu'}.`,
      createdAt: now,
    } satisfies OfflineActivityLogEntry);
  }

  await txDone(tx);
}

export async function updateOfflineSyncReplayResult(params: {
  operationId: string;
  localSaleId: string;
  nextStatus: OfflineSyncQueueEntry['status'];
  serverSaleId?: string | null;
  serverSaleNumber?: string | null;
  allocations?: PosSyncOperationAllocationAck[];
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  await updateOfflineSyncOperationResult({
    operationId: params.operationId,
    nextStatus: params.nextStatus,
    result: {
      operationId: params.operationId,
      localSaleId: params.localSaleId,
      status: params.nextStatus === 'CONFLICT' ? 'CONFLICT' : 'SYNCED',
      serverSaleId: params.serverSaleId ?? null,
      serverSaleNumber: params.serverSaleNumber ?? null,
      allocations: params.allocations ?? [],
      errorCode: params.errorCode ?? null,
      message: params.errorMessage ?? null,
    },
    errorCode: params.errorCode ?? null,
    errorMessage: params.errorMessage ?? null,
  });
}

export async function appendOfflineActivityLog(entry: Omit<OfflineActivityLogEntry, 'localId' | 'createdAt'>) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(ACTIVITY_LOG_STORE, 'readwrite');
  await putStore(tx.objectStore(ACTIVITY_LOG_STORE), {
    ...entry,
    localId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  } satisfies OfflineActivityLogEntry);
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

export async function patchOfflineSyncQueueEntry(
  operationId: string,
  mutate: (entry: OfflineSyncQueueEntry) => OfflineSyncQueueEntry,
) {
  const rows = await readOfflineSyncQueue();
  const nextRows = rows.map((row) => (row.operationId === operationId ? mutate(row) : row));
  await saveOfflineSyncQueue(nextRows);
  return nextRows.find((row) => row.operationId === operationId) ?? null;
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
      ORGANIZATIONS_STORE,
      INSURANCE_PLANS_STORE,
      MEMBERSHIPS_STORE,
      SETTINGS_STORE,
      AUTH_STORE,
      WORKSTATION_STORE,
      CASH_SESSION_STORE,
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

  await replaceAll(tx.objectStore(ORGANIZATIONS_STORE), payload.organizations.map((row) => ({
    localKey: `${payload.tenant.tenantId}:${row.organizationId}`,
    tenantId: payload.tenant.tenantId,
    organizationId: row.organizationId,
    organizationCode: row.organizationCode,
    organizationName: row.organizationName,
    organizationType: row.organizationType,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
    lastSyncedAt: payload.serverTime,
  } satisfies OfflineInsuranceOrganization)));

  await replaceAll(tx.objectStore(INSURANCE_PLANS_STORE), payload.insurancePlans.map((row) => ({
    localKey: `${payload.tenant.tenantId}:${row.planId}`,
    tenantId: payload.tenant.tenantId,
    organizationId: row.organizationId,
    planId: row.planId,
    planCode: row.planCode,
    planName: row.planName,
    coveragePercent: row.coveragePercent,
    patientCopayPercent: row.patientCopayPercent,
    monthlyLimit: row.monthlyLimit,
    annualLimit: row.annualLimit,
    requiresAuthorization: row.requiresAuthorization,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
    lastSyncedAt: payload.serverTime,
  } satisfies OfflineInsurancePlan)));

  await replaceAll(tx.objectStore(MEMBERSHIPS_STORE), payload.memberships.map((row) => ({
    localKey: `${payload.tenant.tenantId}:${row.membershipId}`,
    tenantId: payload.tenant.tenantId,
    customerId: row.customerId,
    customerName: row.customerName,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    planId: row.planId,
    planName: row.planName,
    membershipId: row.membershipId,
    memberNumber: row.memberNumber,
    employeeNumber: row.employeeNumber,
    relationshipType: row.relationshipType,
    coveragePercent: row.coveragePercent,
    validFrom: row.validFrom,
    validTo: row.validTo,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
    lastSyncedAt: payload.serverTime,
  } satisfies OfflineCustomerMembership)));

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
  const currentCashSessions = await readAllFromTransaction<OfflineCashSessionSnapshot>(tx.objectStore(CASH_SESSION_STORE));
  const nextCashSessions = payload.cashSession
    ? mergeServerCashSession(currentCashSessions, payload.tenant.tenantId, payload.serverTime, payload.cashSession, workstation.deviceId)
    : currentCashSessions;
  await replaceAll(tx.objectStore(CASH_SESSION_STORE), nextCashSessions);
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
    [ARTICLES_STORE, LOTS_STORE, ALLOCATIONS_STORE, CUSTOMERS_STORE, ORGANIZATIONS_STORE, INSURANCE_PLANS_STORE, MEMBERSHIPS_STORE, SETTINGS_STORE, CASH_SESSION_STORE, SYNC_STATE_STORE],
    'readwrite',
  );

  const articleStore = tx.objectStore(ARTICLES_STORE);
  const lotStore = tx.objectStore(LOTS_STORE);
  const allocationStore = tx.objectStore(ALLOCATIONS_STORE);
  const customerStore = tx.objectStore(CUSTOMERS_STORE);
  const organizationStore = tx.objectStore(ORGANIZATIONS_STORE);
  const insurancePlanStore = tx.objectStore(INSURANCE_PLANS_STORE);
  const membershipsStore = tx.objectStore(MEMBERSHIPS_STORE);
  const settingsStore = tx.objectStore(SETTINGS_STORE);
  const cashSessionStore = tx.objectStore(CASH_SESSION_STORE);
  const conflictsStore = tx.objectStore(SYNC_CONFLICTS_STORE);

  const currentArticles = new Map((await readAllFromTransaction<OfflinePosArticle>(articleStore)).map((row) => [row.articleId, row]));
  const currentLots = new Map((await readAllFromTransaction<OfflinePosLot>(lotStore)).map((row) => [row.lotId, row]));
  const currentAllocations = new Map((await readAllFromTransaction<OfflineStockAllocation>(allocationStore)).map((row) => [row.allocationId, row]));
  const currentCustomers = new Map((await readAllFromTransaction<OfflinePosCustomer>(customerStore)).map((row) => [row.customerId, row]));
  const currentOrganizations = new Map((await readAllFromTransaction<OfflineInsuranceOrganization>(organizationStore)).map((row) => [row.organizationId, row]));
  const currentInsurancePlans = new Map((await readAllFromTransaction<OfflineInsurancePlan>(insurancePlanStore)).map((row) => [row.planId, row]));
  const currentMemberships = new Map((await readAllFromTransaction<OfflineCustomerMembership>(membershipsStore)).map((row) => [row.membershipId, row]));
  const currentSettings = (await readAllFromTransaction<OfflinePosSettings>(settingsStore))[0] ?? null;
  const currentConflicts = new Map((await readAllFromTransaction<OfflineSyncConflictEntry>(conflictsStore)).map((row) => [row.conflictId ?? row.localId, row]));

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

  for (const row of changesPayload.changes.organizations ?? []) {
    currentOrganizations.set(row.organizationId, {
      localKey: `${context.tenantId}:${row.organizationId}`,
      tenantId: context.tenantId,
      organizationId: row.organizationId,
      organizationCode: row.organizationCode,
      organizationName: row.organizationName,
      organizationType: row.organizationType,
      isActive: row.operation === 'DEACTIVATE' ? false : row.isActive,
      updatedAt: row.updatedAt,
      lastSyncedAt: changesPayload.serverTime,
    });
  }

  for (const row of changesPayload.changes.insurancePlans ?? []) {
    currentInsurancePlans.set(row.planId, {
      localKey: `${context.tenantId}:${row.planId}`,
      tenantId: context.tenantId,
      organizationId: row.organizationId,
      planId: row.planId,
      planCode: row.planCode,
      planName: row.planName,
      coveragePercent: row.coveragePercent,
      patientCopayPercent: row.patientCopayPercent,
      monthlyLimit: row.monthlyLimit,
      annualLimit: row.annualLimit,
      requiresAuthorization: row.requiresAuthorization,
      isActive: row.operation === 'DEACTIVATE' ? false : row.isActive,
      updatedAt: row.updatedAt,
      lastSyncedAt: changesPayload.serverTime,
    });
  }

  for (const row of changesPayload.changes.memberships ?? []) {
    currentMemberships.set(row.membershipId, {
      localKey: `${context.tenantId}:${row.membershipId}`,
      tenantId: context.tenantId,
      customerId: row.customerId,
      customerName: row.customerName,
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      planId: row.planId,
      planName: row.planName,
      membershipId: row.membershipId,
      memberNumber: row.memberNumber,
      employeeNumber: row.employeeNumber ?? null,
      relationshipType: row.relationshipType ?? null,
      coveragePercent: row.coveragePercent,
      validFrom: row.validFrom,
      validTo: row.validTo,
      isActive: row.operation === 'DEACTIVATE' ? false : row.isActive,
      updatedAt: row.updatedAt,
      lastSyncedAt: changesPayload.serverTime,
    });
  }

  for (const row of changesPayload.changes.conflicts ?? []) {
    const conflictKey = row.conflictId;
    if (row.operation === 'RESOLVE') {
      currentConflicts.delete(conflictKey);
      continue;
    }
    const existing = currentConflicts.get(conflictKey);
    currentConflicts.set(conflictKey, {
      localId: existing?.localId ?? crypto.randomUUID(),
      conflictId: row.conflictId,
      operationId: row.operationId,
      localSaleId: row.localSaleId,
      offlineReference: row.offlineReference,
      code: row.conflictCode as OfflineSyncConflictEntry['code'],
      message: row.message,
      status: row.status,
      severity: row.severity,
      resolutionType: row.resolutionType,
      workstationId: row.workstationId ?? undefined,
      createdAt: existing?.createdAt ?? row.updatedAt,
      updatedAt: row.updatedAt,
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

  if ('cashSession' in changesPayload.changes) {
    const row = changesPayload.changes.cashSession;
    const currentCashSessions = await readAllFromTransaction<OfflineCashSessionSnapshot>(cashSessionStore);
    const nextCashSessions = row
      ? mergeServerCashSession(currentCashSessions, context.tenantId, changesPayload.serverTime, row, null)
      : currentCashSessions;
    await replaceAll(cashSessionStore, nextCashSessions);
  }

  await replaceAll(articleStore, Array.from(currentArticles.values()));
  await replaceAll(lotStore, Array.from(currentLots.values()));
  await replaceAll(allocationStore, Array.from(currentAllocations.values()).map(normalizeAllocation));
  await replaceAll(customerStore, Array.from(currentCustomers.values()));
  await replaceAll(organizationStore, Array.from(currentOrganizations.values()));
  await replaceAll(insurancePlanStore, Array.from(currentInsurancePlans.values()));
  await replaceAll(membershipsStore, Array.from(currentMemberships.values()));
  await replaceAll(conflictsStore, Array.from(currentConflicts.values()));
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
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Offline DB open failed'));
    request.onupgradeneeded = () => {
      const db = request.result;
      const upgradeTransaction = request.transaction;
      ensureObjectStore(db, upgradeTransaction, ARTICLES_STORE, 'localKey', [['byTenant', 'tenantId'], ['byArticle', 'articleId']]);
      ensureObjectStore(db, upgradeTransaction, LOTS_STORE, 'localKey', [['byTenant', 'tenantId'], ['byLot', 'lotId'], ['byArticle', 'articleId']]);
      ensureObjectStore(db, upgradeTransaction, ALLOCATIONS_STORE, 'localId', [['byTenant', 'tenantId'], ['bySite', 'siteId'], ['byWorkstation', 'workstationId'], ['byArticle', 'articleId'], ['byLot', 'lotId'], ['byStatus', 'allocationStatus']]);
      ensureObjectStore(db, upgradeTransaction, CUSTOMERS_STORE, 'localKey', [['byTenant', 'tenantId'], ['byCustomer', 'customerId']]);
      ensureObjectStore(db, upgradeTransaction, ORGANIZATIONS_STORE, 'localKey', [['byTenant', 'tenantId'], ['byOrganization', 'organizationId']]);
      ensureObjectStore(db, upgradeTransaction, INSURANCE_PLANS_STORE, 'localKey', [['byTenant', 'tenantId'], ['byOrganization', 'organizationId'], ['byPlan', 'planId']]);
      ensureObjectStore(db, upgradeTransaction, MEMBERSHIPS_STORE, 'localKey', [['byTenant', 'tenantId'], ['byMembership', 'membershipId'], ['byCustomer', 'customerId'], ['byOrganization', 'organizationId'], ['byPlan', 'planId']]);
      ensureObjectStore(db, upgradeTransaction, SETTINGS_STORE, 'key');
      ensureObjectStore(db, upgradeTransaction, AUTH_STORE, 'id');
      ensureObjectStore(db, upgradeTransaction, WORKSTATION_STORE, 'id');
      ensureObjectStore(db, upgradeTransaction, CASH_SESSION_STORE, 'cashSessionId', [['byWorkstation', 'workstationId'], ['byUser', 'userId'], ['byStatus', 'status']]);
      ensureObjectStore(db, upgradeTransaction, CASH_MOVEMENTS_STORE, 'localMovementId', [['bySession', 'localCashSessionId'], ['byOperation', 'operationId'], ['byStatus', 'status']]);
      ensureObjectStore(db, upgradeTransaction, CASH_COUNTS_STORE, 'countId', [['bySession', 'localCashSessionId'], ['byCountedAt', 'countedAt']]);
      ensureObjectStore(db, upgradeTransaction, CASH_RECONCILIATION_EVENTS_STORE, 'eventId', [['bySession', 'localCashSessionId'], ['byOperation', 'operationId'], ['byCreatedAt', 'createdAt']]);
      ensureObjectStore(db, upgradeTransaction, SYNC_STATE_STORE, 'id');
      ensureObjectStore(db, upgradeTransaction, SYNC_QUEUE_STORE, 'localId', [['byOperation', 'operationId'], ['byStatus', 'status'], ['byWorkstation', 'workstationId']]);
      ensureObjectStore(db, upgradeTransaction, SYNC_LOG_STORE, 'localId', [['byType', 'type'], ['byStatus', 'status']]);
      ensureObjectStore(db, upgradeTransaction, SYNC_CONFLICTS_STORE, 'localId', [['byCode', 'code'], ['byLot', 'lotId']]);
      ensureObjectStore(db, upgradeTransaction, CARTS_STORE, 'cartId', [['byStatus', 'status'], ['byWorkstation', 'workstationId'], ['byUpdatedAt', 'updatedAt']]);
      ensureObjectStore(db, upgradeTransaction, DRAFT_RESERVATIONS_STORE, 'reservationId', [['byCart', 'cartId'], ['byAllocation', 'allocationId'], ['byLot', 'lotId']]);
      ensureObjectStore(db, upgradeTransaction, ACTIVITY_LOG_STORE, 'localId', [['byCart', 'cartId'], ['byType', 'type'], ['byCreatedAt', 'createdAt']]);
      ensureObjectStore(db, upgradeTransaction, OFFLINE_SALES_STORE, 'localSaleId', [['byStatus', 'status'], ['bySyncStatus', 'syncStatus'], ['byValidatedAt', 'validatedAt']]);
      ensureObjectStore(db, upgradeTransaction, OFFLINE_PAYMENTS_STORE, 'offlinePaymentId', [['bySale', 'localSaleId'], ['byStatus', 'status']]);
      ensureObjectStore(db, upgradeTransaction, OFFLINE_PENDING_CONSUMPTIONS_STORE, 'pendingConsumptionId', [['bySale', 'localSaleId'], ['byOperation', 'operationId'], ['byAllocation', 'allocationId'], ['byStatus', 'status']]);
      ensureObjectStore(db, upgradeTransaction, OFFLINE_METADATA_STORE, 'id');
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

function selectActiveOfflineCashSession(rows: OfflineCashSessionSnapshot[]) {
  const priority: OfflineCashSessionSnapshot['status'][] = [
    'LOCAL_OPEN',
    'OPEN_PENDING_SYNC',
    'OPEN_SYNCED',
    'LOCAL_CLOSING',
    'CLOSED_PENDING_SYNC',
    'CLOSED_SYNCED',
    'CONFLICT',
    'FAILED',
    'CANCELLED_BEFORE_USE',
  ];
  const byPriority = rows
    .slice()
    .sort((left, right) => {
      const priorityDelta = priority.indexOf(left.status) - priority.indexOf(right.status);
      if (priorityDelta !== 0) return priorityDelta;
      return sortByMostRecent(right.updatedAt ?? right.openedLocallyAt, left.updatedAt ?? left.openedLocallyAt);
    });
  return byPriority[0] ?? null;
}

function sortByMostRecent(left: string | null | undefined, right: string | null | undefined) {
  const leftMs = left ? new Date(left).getTime() : 0;
  const rightMs = right ? new Date(right).getTime() : 0;
  return leftMs - rightMs;
}

function mergeServerCashSession(
  currentRows: OfflineCashSessionSnapshot[],
  tenantId: string,
  serverTime: string,
  row: {
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
  },
  deviceId: string | null,
) {
  const existingIndex = currentRows.findIndex((entry) => entry.serverCashSessionId === row.cashSessionId || entry.cashSessionId === row.cashSessionId);
  const next = {
    ...(existingIndex >= 0 ? currentRows[existingIndex] : null),
    cashSessionId: existingIndex >= 0 ? currentRows[existingIndex].cashSessionId : row.cashSessionId,
    localCashSessionId: existingIndex >= 0 ? currentRows[existingIndex].localCashSessionId : row.cashSessionId,
    offlineCashReference: existingIndex >= 0 ? currentRows[existingIndex].offlineCashReference : (row.sessionReference ?? row.cashSessionId),
    tenantId,
    siteId: row.siteId,
    workstationId: row.workstationId,
    userId: row.userId,
    deviceId: existingIndex >= 0 ? currentRows[existingIndex].deviceId : deviceId,
    serverCashSessionId: row.cashSessionId,
    serverSessionReference: row.sessionReference ?? null,
    status: row.status === 'OPEN' ? 'OPEN_SYNCED' : 'CLOSED_SYNCED',
    openedAt: row.openedAt,
    openedLocallyAt: existingIndex >= 0 ? currentRows[existingIndex].openedLocallyAt : row.openedAt,
    serverOpenedAt: row.openedAt,
    closedLocallyAt: existingIndex >= 0 ? currentRows[existingIndex].closedLocallyAt : null,
    serverClosedAt: row.status === 'CLOSED' ? row.updatedAt ?? serverTime : null,
    syncedAt: serverTime,
    openingBalanceUsd: row.openingBalanceUsd,
    openingBalanceCdf: row.openingBalanceCdf,
    cashSalesUsd: existingIndex >= 0 ? currentRows[existingIndex].cashSalesUsd : 0,
    cashSalesCdf: existingIndex >= 0 ? currentRows[existingIndex].cashSalesCdf : 0,
    expensesUsd: existingIndex >= 0 ? currentRows[existingIndex].expensesUsd : 0,
    expensesCdf: existingIndex >= 0 ? currentRows[existingIndex].expensesCdf : 0,
    refundsUsd: existingIndex >= 0 ? currentRows[existingIndex].refundsUsd : 0,
    refundsCdf: existingIndex >= 0 ? currentRows[existingIndex].refundsCdf : 0,
    expectedClosingUsd: existingIndex >= 0 ? currentRows[existingIndex].expectedClosingUsd : row.openingBalanceUsd,
    expectedClosingCdf: existingIndex >= 0 ? currentRows[existingIndex].expectedClosingCdf : row.openingBalanceCdf,
    declaredClosingUsd: existingIndex >= 0 ? currentRows[existingIndex].declaredClosingUsd : null,
    declaredClosingCdf: existingIndex >= 0 ? currentRows[existingIndex].declaredClosingCdf : null,
    differenceUsd: existingIndex >= 0 ? currentRows[existingIndex].differenceUsd : null,
    differenceCdf: existingIndex >= 0 ? currentRows[existingIndex].differenceCdf : null,
    localExpectedClosingUsd: existingIndex >= 0 ? currentRows[existingIndex].localExpectedClosingUsd : row.openingBalanceUsd,
    localExpectedClosingCdf: existingIndex >= 0 ? currentRows[existingIndex].localExpectedClosingCdf : row.openingBalanceCdf,
    serverExpectedClosingUsd: existingIndex >= 0 ? currentRows[existingIndex].serverExpectedClosingUsd : null,
    serverExpectedClosingCdf: existingIndex >= 0 ? currentRows[existingIndex].serverExpectedClosingCdf : null,
    serverDifferenceUsd: existingIndex >= 0 ? currentRows[existingIndex].serverDifferenceUsd : null,
    serverDifferenceCdf: existingIndex >= 0 ? currentRows[existingIndex].serverDifferenceCdf : null,
    openingOperationId: existingIndex >= 0 ? currentRows[existingIndex].openingOperationId : row.cashSessionId,
    closingOperationId: existingIndex >= 0 ? currentRows[existingIndex].closingOperationId : null,
    serverVersion: row.serverVersion,
    note: existingIndex >= 0 ? currentRows[existingIndex].note : null,
    updatedAt: row.updatedAt,
    lastSyncedAt: serverTime,
  } satisfies OfflineCashSessionSnapshot;

  if (existingIndex >= 0) {
    const nextRows = currentRows.slice();
    nextRows[existingIndex] = next;
    return nextRows;
  }
  return [...currentRows, next];
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

export function createDefaultOfflineMetadata(overrides: Partial<OfflineMetadataRecord> = {}): OfflineMetadataRecord {
  return {
    id: 'metadata',
    applicationVersion: OFFLINE_APP_VERSION,
    offlineDbVersion: OFFLINE_DB_VERSION,
    snapshotSchemaVersion: OFFLINE_SNAPSHOT_SCHEMA_VERSION,
    lastMigrationAt: new Date().toISOString(),
    lastRecoveryCheckAt: null,
    recoveryStatus: 'HEALTHY',
    recoveryReason: null,
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
