import {
  readOfflineActivityLog,
  readOfflineCashMovements,
  readOfflineCashSessions,
  readOfflineCarts,
  readOfflineConflicts,
  readOfflineDraftReservations,
  readOfflineMetadata,
  readOfflinePayments,
  readOfflinePendingConsumptions,
  readOfflineSales,
  readOfflineSnapshot,
  readOfflineSyncLog,
  readOfflineSyncQueue,
  resetStaleSyncingQueueEntries,
  writeOfflineMetadata,
} from './offline-storage';
import { OFFLINE_DB_VERSION, OFFLINE_RETENTION_DAYS, OFFLINE_STORAGE_THRESHOLDS } from './offline-config';
import { type OfflineIntegrityIssueLevel, type OfflineRecoveryStatus, type OfflineStorageStatus } from './offline-types';

export type OfflineIntegrityIssue = {
  level: OfflineIntegrityIssueLevel;
  code: string;
  message: string;
};

export type OfflineRecoveryReport = {
  status: OfflineRecoveryStatus;
  issues: OfflineIntegrityIssue[];
  actions: string[];
  checkedAt: string;
};

export type OfflineStorageReport = {
  status: OfflineStorageStatus;
  usage: number | null;
  quota: number | null;
  usageRatio: number | null;
  persisted: boolean | null;
  checkedAt: string;
};

export type OfflineRetentionReport = {
  deletedCounts: Record<string, number>;
  skippedCritical: number;
  freedEstimate: number | null;
  ranAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function ageLimit(days: number) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function isOlderThan(value: string | null | undefined, limitMs: number) {
  if (!value) return false;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) && parsed < limitMs;
}

function levelToStatus(levels: OfflineIntegrityIssueLevel[]): OfflineRecoveryStatus {
  if (levels.includes('CRITICAL')) return 'RECOVERY_REQUIRED';
  if (levels.includes('WARNING')) return 'DEGRADED';
  return 'HEALTHY';
}

export async function runOfflineIntegrityCheck(): Promise<OfflineIntegrityIssue[]> {
  const [queue, sales, payments, consumptions, sessions, movements, carts, reservations] = await Promise.all([
    readOfflineSyncQueue(),
    readOfflineSales(),
    readOfflinePayments(),
    readOfflinePendingConsumptions(),
    readOfflineCashSessions(),
    readOfflineCashMovements(),
    readOfflineCarts(),
    readOfflineDraftReservations(),
  ]);

  const issues: OfflineIntegrityIssue[] = [];
  const saleIds = new Set(sales.map((sale) => sale.localSaleId));
  const queueSaleIds = new Set(queue.map((entry) => entry.relatedLocalSaleId).filter(Boolean));
  const sessionIds = new Set(sessions.map((session) => session.localCashSessionId));
  const cartIds = new Set(carts.map((cart) => cart.cartId));

  for (const sale of sales) {
    if (sale.syncStatus !== 'SYNCED' && !queueSaleIds.has(sale.localSaleId)) {
      issues.push({
        level: 'CRITICAL',
        code: 'SALE_WITHOUT_QUEUE',
        message: `Vente locale ${sale.offlineReference} sans operation de synchronisation.`,
      });
    }
    if (!payments.some((payment) => payment.localSaleId === sale.localSaleId)) {
      issues.push({
        level: 'CRITICAL',
        code: 'SALE_WITHOUT_PAYMENT',
        message: `Vente locale ${sale.offlineReference} sans paiement local.`,
      });
    }
    if (sale.localCashSessionId && !sessionIds.has(sale.localCashSessionId)) {
      issues.push({
        level: 'CRITICAL',
        code: 'SALE_WITHOUT_CASH_SESSION',
        message: `Vente locale ${sale.offlineReference} liee a une session caisse absente.`,
      });
    }
  }

  for (const entry of queue) {
    if (entry.relatedLocalSaleId && !saleIds.has(entry.relatedLocalSaleId)) {
      issues.push({
        level: 'CRITICAL',
        code: 'QUEUE_WITHOUT_SALE',
        message: `Operation ${entry.operationId} liee a une vente locale absente.`,
      });
    }
  }

  for (const consumption of consumptions) {
    if (!saleIds.has(consumption.localSaleId)) {
      issues.push({
        level: 'CRITICAL',
        code: 'CONSUMPTION_WITHOUT_SALE',
        message: `Consommation locale ${consumption.pendingConsumptionId} sans vente locale.`,
      });
    }
  }

  for (const movement of movements) {
    if (movement.localCashSessionId && !sessionIds.has(movement.localCashSessionId)) {
      issues.push({
        level: 'WARNING',
        code: 'CASH_MOVEMENT_WITHOUT_SESSION',
        message: `Mouvement caisse ${movement.reference ?? movement.localMovementId} lie a une session locale absente.`,
      });
    }
  }

  for (const reservation of reservations) {
    if (!cartIds.has(reservation.cartId)) {
      issues.push({
        level: 'WARNING',
        code: 'DRAFT_RESERVATION_WITHOUT_CART',
        message: `Reservation brouillon ${reservation.reservationId} sans panier local.`,
      });
    }
  }

  return issues;
}

export async function runOfflineRecovery(): Promise<OfflineRecoveryReport> {
  const checkedAt = nowIso();
  await resetStaleSyncingQueueEntries();
  const issues = await runOfflineIntegrityCheck();
  const status = levelToStatus(issues.map((issue) => issue.level));
  const actions = status === 'HEALTHY'
    ? ['Aucune action requise.']
    : issues.filter((issue) => issue.level !== 'INFO').slice(0, 6).map((issue) => issue.message);

  await writeOfflineMetadata({
    ...(await readOfflineMetadata()),
    offlineDbVersion: OFFLINE_DB_VERSION,
    recoveryStatus: status,
    recoveryReason: status === 'HEALTHY' ? null : issues[0]?.code ?? 'OFFLINE_RECOVERY_REQUIRED',
    lastRecoveryCheckAt: checkedAt,
  });

  return { status, issues, actions, checkedAt };
}

export async function getOfflineStorageReport(): Promise<OfflineStorageReport> {
  const checkedAt = nowIso();
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { status: 'UNKNOWN', usage: null, quota: null, usageRatio: null, persisted: null, checkedAt };
  }

  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage ?? null;
  const quota = estimate.quota ?? null;
  const usageRatio = usage !== null && quota ? usage / quota : null;
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : null;
  const status: OfflineStorageStatus = usageRatio === null
    ? 'UNKNOWN'
    : usageRatio >= OFFLINE_STORAGE_THRESHOLDS.criticalUsageRatio
      ? 'CRITICAL'
      : usageRatio >= OFFLINE_STORAGE_THRESHOLDS.warningUsageRatio
        ? 'WARNING'
        : 'HEALTHY';

  return { status, usage, quota, usageRatio, persisted, checkedAt };
}

export async function requestOfflinePersistence() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export async function previewOfflineRetention(): Promise<OfflineRetentionReport> {
  const [queue, sales, logs, conflicts] = await Promise.all([
    readOfflineSyncQueue(),
    readOfflineSales(),
    readOfflineSyncLog(),
    readOfflineConflicts(),
  ]);
  const queueLimit = ageLimit(OFFLINE_RETENTION_DAYS.syncedQueue);
  const saleLimit = ageLimit(OFFLINE_RETENTION_DAYS.syncedSales);
  const logLimit = ageLimit(OFFLINE_RETENTION_DAYS.activityLogs);
  const conflictLimit = ageLimit(OFFLINE_RETENTION_DAYS.resolvedConflicts);

  return {
    deletedCounts: {
      syncQueue: queue.filter((row) => row.status === 'SYNCED' && isOlderThan(row.updatedAt, queueLimit)).length,
      sales: sales.filter((row) => row.syncStatus === 'SYNCED' && isOlderThan(row.syncedAt ?? row.validatedAt, saleLimit)).length,
      syncLog: logs.filter((row) => isOlderThan(row.createdAt, logLimit)).length,
      resolvedConflicts: conflicts.filter((row) => row.status === 'RESOLVED' && isOlderThan(row.updatedAt ?? row.createdAt, conflictLimit)).length,
    },
    skippedCritical: queue.filter((row) => row.status !== 'SYNCED').length + sales.filter((row) => row.syncStatus !== 'SYNCED').length,
    freedEstimate: null,
    ranAt: nowIso(),
  };
}

export async function runOfflineRetention(): Promise<OfflineRetentionReport> {
  return previewOfflineRetention();
}

export async function buildOfflineDiagnosticExport() {
  const [snapshot, queue, sales, payments, consumptions, conflicts, metadata, storage, recovery, retention] = await Promise.all([
    readOfflineSnapshot(),
    readOfflineSyncQueue(),
    readOfflineSales(),
    readOfflinePayments(),
    readOfflinePendingConsumptions(),
    readOfflineConflicts(),
    readOfflineMetadata(),
    getOfflineStorageReport(),
    runOfflineRecovery(),
    previewOfflineRetention(),
  ]);
  const activity = await readOfflineActivityLog();

  return {
    generatedAt: nowIso(),
    metadata,
    storage,
    recovery,
    retention,
    workstation: snapshot.workstation ? {
      workstationId: snapshot.workstation.workstationId,
      workstationName: snapshot.workstation.workstationName,
      deviceId: snapshot.workstation.deviceId,
      tenantId: snapshot.workstation.tenantId,
      siteId: snapshot.workstation.siteId,
      status: snapshot.workstation.status,
    } : null,
    snapshot: {
      articles: snapshot.articles.length,
      lots: snapshot.lots.length,
      allocations: snapshot.allocations.length,
      customers: snapshot.customers.length,
      snapshotStatus: snapshot.syncState?.snapshotStatus ?? 'UNKNOWN',
      syncCursorPresent: Boolean(snapshot.syncState?.syncCursor),
      lastSuccessfulSyncAt: snapshot.syncState?.lastSuccessfulSyncAt ?? null,
    },
    counts: {
      queue: queue.length,
      pendingQueue: queue.filter((row) => row.status === 'PENDING').length,
      syncingQueue: queue.filter((row) => row.status === 'SYNCING').length,
      sales: sales.length,
      payments: payments.length,
      pendingConsumptions: consumptions.length,
      conflicts: conflicts.length,
      activity: activity.length,
    },
  };
}
