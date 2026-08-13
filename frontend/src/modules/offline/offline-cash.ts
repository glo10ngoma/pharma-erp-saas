import {
  appendOfflineActivityLog,
  appendOfflineSyncQueueEntry,
  readOfflineCashCounts,
  readOfflineCashMovements,
  readOfflineCashReconciliationEvents,
  readOfflineCashSession,
  readOfflineCashSessions,
  readOfflineSnapshot,
  saveOfflineCashCounts,
  saveOfflineCashMovements,
  saveOfflineCashReconciliationEvents,
  saveOfflineCashSessions,
} from './offline-storage';
import {
  calculateAuthorizationState,
} from './offline-bootstrap';
import {
  type OfflineCashCount,
  type OfflineCashMovement,
  type OfflineCashReconciliationEvent,
  type OfflineCashSessionCloseOperation,
  type OfflineCashSessionOpenOperation,
  type OfflineCashSessionSnapshot,
  type OfflineCashSessionStatus,
  type OfflineCashExpenseOperation,
} from './offline-types';

export const OFFLINE_CASH_ACTIVE_STATUSES: OfflineCashSessionStatus[] = [
  'LOCAL_OPEN',
  'OPEN_PENDING_SYNC',
  'OPEN_SYNCED',
  'LOCAL_CLOSING',
];

export function isOfflineCashSessionActive(status: OfflineCashSessionStatus) {
  return OFFLINE_CASH_ACTIVE_STATUSES.includes(status);
}

export function canAttachOfflineCashSale(session: OfflineCashSessionSnapshot | null) {
  return !!session && ['LOCAL_OPEN', 'OPEN_PENDING_SYNC', 'OPEN_SYNCED'].includes(session.status);
}

export function recalculateOfflineCashSessionTotals(
  session: OfflineCashSessionSnapshot,
  movements: OfflineCashMovement[],
) {
  const sessionMovements = movements.filter((row) => row.localCashSessionId === session.localCashSessionId);
  const next = { ...session };
  next.cashSalesUsd = sumMovement(sessionMovements, 'SALE_CASH_IN', 'USD');
  next.cashSalesCdf = sumMovement(sessionMovements, 'SALE_CASH_IN', 'CDF');
  next.expensesUsd = sumMovement(sessionMovements, 'EXPENSE_OUT', 'USD');
  next.expensesCdf = sumMovement(sessionMovements, 'EXPENSE_OUT', 'CDF');
  next.refundsUsd = 0;
  next.refundsCdf = 0;
  next.expectedClosingUsd = roundMoney(next.openingBalanceUsd + next.cashSalesUsd - next.expensesUsd - next.refundsUsd);
  next.expectedClosingCdf = roundMoney(next.openingBalanceCdf + next.cashSalesCdf - next.expensesCdf - next.refundsCdf);
  next.localExpectedClosingUsd = next.expectedClosingUsd;
  next.localExpectedClosingCdf = next.expectedClosingCdf;
  if (next.declaredClosingUsd !== null) {
    next.differenceUsd = roundMoney(next.declaredClosingUsd - next.expectedClosingUsd);
  }
  if (next.declaredClosingCdf !== null) {
    next.differenceCdf = roundMoney(next.declaredClosingCdf - next.expectedClosingCdf);
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

export async function openOfflineCashSession(input: {
  openingBalanceUsd: number;
  openingBalanceCdf: number;
  note?: string | null;
}) {
  const snapshot = await readOfflineSnapshot();
  if (!snapshot.auth || !snapshot.workstation) throw new Error('POS_SYNC_LOCAL_CONTEXT_MISSING');
  if (!snapshot.auth.permissions.includes('cash_sessions.open')) throw new Error('PERMISSION_DENIED');
  if (calculateAuthorizationState(snapshot.auth) === 'EXPIRED') throw new Error('OFFLINE_AUTH_EXPIRED');
  if (snapshot.workstation.status === 'REVOKED') throw new Error('WORKSTATION_REVOKED');

  const allSessions = await readOfflineCashSessions();
  const existingActive = allSessions.find(
    (row) =>
      row.tenantId === snapshot.auth?.tenantId
      && row.siteId === snapshot.workstation?.siteId
      && row.workstationId === snapshot.workstation?.workstationId
      && row.userId === snapshot.auth?.userId
      && isOfflineCashSessionActive(row.status),
  );
  if (existingActive) return existingActive;

  const knownServerSession = snapshot.cashSession && canAttachOfflineCashSale(snapshot.cashSession)
    ? snapshot.cashSession
    : null;
  if (knownServerSession) return knownServerSession;

  const now = new Date();
  const nowIso = now.toISOString();
  const dayKey = nowIso.slice(0, 10).replace(/-/g, '');
  const sameDayCount = allSessions.filter((row) => row.openedLocallyAt.slice(0, 10) === nowIso.slice(0, 10)).length + 1;
  const siteCode = (snapshot.workstation.siteCode ?? snapshot.workstation.siteId.slice(0, 3)).replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const workstationCode = (snapshot.workstation.workstationCode ?? snapshot.workstation.workstationName.slice(0, 6)).replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const localCashSessionId = crypto.randomUUID();
  const operationId = crypto.randomUUID();
  const offlineCashReference = `OFF-CASH-${siteCode}-${workstationCode}-${dayKey}-${String(sameDayCount).padStart(4, '0')}`;

  const session: OfflineCashSessionSnapshot = {
    cashSessionId: localCashSessionId,
    localCashSessionId,
    offlineCashReference,
    tenantId: snapshot.auth.tenantId,
    siteId: snapshot.workstation.siteId,
    workstationId: snapshot.workstation.workstationId,
    userId: snapshot.auth.userId,
    deviceId: snapshot.workstation.deviceId,
    serverCashSessionId: null,
    serverSessionReference: null,
    status: 'OPEN_PENDING_SYNC',
    openedAt: nowIso,
    openedLocallyAt: nowIso,
    serverOpenedAt: null,
    closedLocallyAt: null,
    serverClosedAt: null,
    syncedAt: null,
    openingBalanceUsd: roundMoney(input.openingBalanceUsd),
    openingBalanceCdf: roundMoney(input.openingBalanceCdf),
    cashSalesUsd: 0,
    cashSalesCdf: 0,
    expensesUsd: 0,
    expensesCdf: 0,
    refundsUsd: 0,
    refundsCdf: 0,
    expectedClosingUsd: roundMoney(input.openingBalanceUsd),
    expectedClosingCdf: roundMoney(input.openingBalanceCdf),
    declaredClosingUsd: null,
    declaredClosingCdf: null,
    differenceUsd: null,
    differenceCdf: null,
    localExpectedClosingUsd: roundMoney(input.openingBalanceUsd),
    localExpectedClosingCdf: roundMoney(input.openingBalanceCdf),
    serverExpectedClosingUsd: null,
    serverExpectedClosingCdf: null,
    serverDifferenceUsd: null,
    serverDifferenceCdf: null,
    openingOperationId: operationId,
    closingOperationId: null,
    serverVersion: 0,
    note: (input.note ?? '').trim() || null,
    updatedAt: nowIso,
    lastSyncedAt: null,
  };

  const openingMovements: OfflineCashMovement[] = [];
  if (session.openingBalanceUsd > 0) {
    openingMovements.push({
      localMovementId: crypto.randomUUID(),
      localCashSessionId,
      tenantId: session.tenantId,
      siteId: session.siteId,
      workstationId: session.workstationId,
      userId: session.userId,
      serverMovementId: null,
      operationId,
      movementType: 'OPENING_BALANCE',
      currency: 'USD',
      amount: session.openingBalanceUsd,
      sourceType: 'CASH_SESSION',
      sourceId: localCashSessionId,
      reference: offlineCashReference,
      description: 'Fonds d ouverture offline USD',
      createdLocallyAt: nowIso,
      syncedAt: null,
      status: 'PENDING_SYNC',
    });
  }
  if (session.openingBalanceCdf > 0) {
    openingMovements.push({
      localMovementId: crypto.randomUUID(),
      localCashSessionId,
      tenantId: session.tenantId,
      siteId: session.siteId,
      workstationId: session.workstationId,
      userId: session.userId,
      serverMovementId: null,
      operationId,
      movementType: 'OPENING_BALANCE',
      currency: 'CDF',
      amount: session.openingBalanceCdf,
      sourceType: 'CASH_SESSION',
      sourceId: localCashSessionId,
      reference: offlineCashReference,
      description: 'Fonds d ouverture offline CDF',
      createdLocallyAt: nowIso,
      syncedAt: null,
      status: 'PENDING_SYNC',
    });
  }

  const nextSessions = [...allSessions.filter((row) => row.localCashSessionId !== localCashSessionId), session];
  const currentMovements = await readOfflineCashMovements();
  await saveOfflineCashSessions(nextSessions);
  await saveOfflineCashMovements([...currentMovements, ...openingMovements]);

  const openOperation: OfflineCashSessionOpenOperation = {
    operationType: 'CASH_SESSION_OPEN',
    operationId,
    localCashSessionId,
    offlineCashReference,
    tenantId: session.tenantId,
    siteId: session.siteId,
    workstationId: session.workstationId ?? '',
    deviceId: session.deviceId ?? '',
    userId: session.userId,
    openingBalanceUsd: session.openingBalanceUsd,
    openingBalanceCdf: session.openingBalanceCdf,
    note: session.note,
    openedLocallyAt: session.openedLocallyAt,
  };

  await appendOfflineSyncQueueEntry({
    operationId,
    operationType: 'CASH_SESSION_OPEN',
    workstationId: session.workstationId ?? '',
    tenantId: session.tenantId,
    siteId: session.siteId,
    payload: openOperation,
    status: 'PENDING',
    relatedLocalCashSessionId: localCashSessionId,
    dependencyGroup: `CASH_SESSION:${localCashSessionId}`,
  });
  await appendOfflineActivityLog({
    cartId: null,
    type: 'cash.session_opened_local',
    message: `Session offline ${offlineCashReference} ouverte localement.`,
  });

  return session;
}

export async function createOfflineCashExpense(input: {
  localCashSessionId: string;
  amount: number;
  currency: 'USD' | 'CDF';
  expenseCategory: string;
  description: string;
}) {
  const snapshot = await readOfflineSnapshot();
  if (!snapshot.auth || !snapshot.workstation) throw new Error('POS_SYNC_LOCAL_CONTEXT_MISSING');
  if (!snapshot.auth.permissions.includes('cash_expenses.create')) throw new Error('PERMISSION_DENIED');
  if (!(input.amount > 0)) throw new Error('INVALID_EXPENSE_AMOUNT');

  const sessions = await readOfflineCashSessions();
  const session = sessions.find((row) => row.localCashSessionId === input.localCashSessionId);
  if (!session) throw new Error('CASH_SESSION_NOT_FOUND');
  if (!canAttachOfflineCashSale(session)) throw new Error('CASH_SESSION_CLOSED');

  const now = new Date().toISOString();
  const operationId = crypto.randomUUID();
  const movement: OfflineCashMovement = {
    localMovementId: crypto.randomUUID(),
    localCashSessionId: session.localCashSessionId,
    tenantId: session.tenantId,
    siteId: session.siteId,
    workstationId: session.workstationId,
    userId: session.userId,
    serverMovementId: null,
    operationId,
    movementType: 'EXPENSE_OUT',
    currency: input.currency,
    amount: roundMoney(input.amount),
    sourceType: 'EXPENSE',
    sourceId: null,
    reference: session.offlineCashReference,
    description: input.description,
    createdLocallyAt: now,
    syncedAt: null,
    status: 'PENDING_SYNC',
  };
  const movements = [...await readOfflineCashMovements(), movement];
  const nextSession = recalculateOfflineCashSessionTotals({ ...session, updatedAt: now }, movements);
  const nextSessions = sessions.map((row) => row.localCashSessionId === session.localCashSessionId ? nextSession : row);
  await saveOfflineCashMovements(movements);
  await saveOfflineCashSessions(nextSessions);

  const operation: OfflineCashExpenseOperation = {
    operationType: 'CASH_EXPENSE',
    operationId,
    localCashSessionId: session.localCashSessionId,
    offlineCashReference: session.offlineCashReference,
    tenantId: session.tenantId,
    siteId: session.siteId,
    workstationId: session.workstationId ?? '',
    deviceId: session.deviceId ?? '',
    userId: session.userId,
    serverCashSessionId: session.serverCashSessionId,
    cashSessionOpenOperationId: session.openingOperationId,
    localMovementId: movement.localMovementId,
    amount: movement.amount,
    currency: movement.currency,
    expenseCategory: input.expenseCategory,
    description: input.description,
    createdLocallyAt: now,
  };
  await appendOfflineSyncQueueEntry({
    operationId,
    operationType: 'CASH_EXPENSE',
    workstationId: session.workstationId ?? '',
    tenantId: session.tenantId,
    siteId: session.siteId,
    payload: operation,
    status: 'PENDING',
    relatedLocalCashSessionId: session.localCashSessionId,
    dependsOnOperationId: session.serverCashSessionId ? null : session.openingOperationId,
    dependencyGroup: `CASH_SESSION:${session.localCashSessionId}`,
  });
  await appendOfflineActivityLog({
    cartId: null,
    type: 'cash.expense_captured_local',
    message: `Depense offline ${input.currency} ${movement.amount} capturee sur ${session.offlineCashReference}.`,
  });
  return nextSession;
}

export async function closeOfflineCashSession(input: {
  localCashSessionId: string;
  declaredClosingUsd: number;
  declaredClosingCdf: number;
  note?: string | null;
}) {
  const snapshot = await readOfflineSnapshot();
  if (!snapshot.auth) throw new Error('POS_SYNC_LOCAL_CONTEXT_MISSING');
  if (!snapshot.auth.permissions.includes('cash_sessions.close')) throw new Error('PERMISSION_DENIED');

  const sessions = await readOfflineCashSessions();
  const session = sessions.find((row) => row.localCashSessionId === input.localCashSessionId);
  if (!session) throw new Error('CASH_SESSION_NOT_FOUND');
  if (!canAttachOfflineCashSale(session)) throw new Error('CASH_SESSION_CLOSED');

  const now = new Date().toISOString();
  const movements = await readOfflineCashMovements();
  const recalculated = recalculateOfflineCashSessionTotals(session, movements);
  const count: OfflineCashCount = {
    countId: crypto.randomUUID(),
    localCashSessionId: session.localCashSessionId,
    declaredUsd: roundMoney(input.declaredClosingUsd),
    declaredCdf: roundMoney(input.declaredClosingCdf),
    expectedUsd: recalculated.expectedClosingUsd,
    expectedCdf: recalculated.expectedClosingCdf,
    differenceUsd: roundMoney(input.declaredClosingUsd - recalculated.expectedClosingUsd),
    differenceCdf: roundMoney(input.declaredClosingCdf - recalculated.expectedClosingCdf),
    countedAt: now,
    countedBy: session.userId,
    note: (input.note ?? '').trim() || null,
  };
  const operationId = crypto.randomUUID();
  const closingMovementUsd: OfflineCashMovement = {
    localMovementId: crypto.randomUUID(),
    localCashSessionId: session.localCashSessionId,
    tenantId: session.tenantId,
    siteId: session.siteId,
    workstationId: session.workstationId,
    userId: session.userId,
    serverMovementId: null,
    operationId,
    movementType: 'CLOSING_DECLARATION',
    currency: 'USD',
    amount: count.declaredUsd,
    sourceType: 'CLOSE',
    sourceId: session.localCashSessionId,
    reference: session.offlineCashReference,
    description: 'Cloture caisse offline USD',
    createdLocallyAt: now,
    syncedAt: null,
    status: 'PENDING_SYNC',
  };
  const closingMovementCdf: OfflineCashMovement = {
    ...closingMovementUsd,
    localMovementId: crypto.randomUUID(),
    currency: 'CDF',
    amount: count.declaredCdf,
    description: 'Cloture caisse offline CDF',
  };
  const nextSession: OfflineCashSessionSnapshot = {
    ...recalculated,
    status: 'CLOSED_PENDING_SYNC',
    closedLocallyAt: now,
    declaredClosingUsd: count.declaredUsd,
    declaredClosingCdf: count.declaredCdf,
    differenceUsd: count.differenceUsd,
    differenceCdf: count.differenceCdf,
    closingOperationId: operationId,
    note: count.note ?? recalculated.note,
    updatedAt: now,
  };
  await saveOfflineCashSessions(sessions.map((row) => row.localCashSessionId === session.localCashSessionId ? nextSession : row));
  await saveOfflineCashMovements([...movements, closingMovementUsd, closingMovementCdf]);
  await saveOfflineCashCounts([...(await readOfflineCashCounts()), count]);

  const operation: OfflineCashSessionCloseOperation = {
    operationType: 'CASH_SESSION_CLOSE',
    operationId,
    localCashSessionId: session.localCashSessionId,
    offlineCashReference: session.offlineCashReference,
    tenantId: session.tenantId,
    siteId: session.siteId,
    workstationId: session.workstationId ?? '',
    deviceId: session.deviceId ?? '',
    userId: session.userId,
    serverCashSessionId: session.serverCashSessionId,
    cashSessionOpenOperationId: session.openingOperationId,
    declaredClosingUsd: count.declaredUsd,
    declaredClosingCdf: count.declaredCdf,
    expectedClosingUsd: count.expectedUsd,
    expectedClosingCdf: count.expectedCdf,
    differenceUsd: count.differenceUsd,
    differenceCdf: count.differenceCdf,
    note: count.note,
    closedLocallyAt: now,
  };
  await appendOfflineSyncQueueEntry({
    operationId,
    operationType: 'CASH_SESSION_CLOSE',
    workstationId: session.workstationId ?? '',
    tenantId: session.tenantId,
    siteId: session.siteId,
    payload: operation,
    status: 'PENDING',
    relatedLocalCashSessionId: session.localCashSessionId,
    dependsOnOperationId: session.serverCashSessionId ? null : session.openingOperationId,
    dependencyGroup: `CASH_SESSION:${session.localCashSessionId}`,
  });
  await appendOfflineActivityLog({
    cartId: null,
    type: 'cash.session_closed_local',
    message: `Session offline ${session.offlineCashReference} fermee localement.`,
  });
  return nextSession;
}

export async function appendOfflineCashReconciliationEvent(event: OfflineCashReconciliationEvent) {
  await saveOfflineCashReconciliationEvents([...(await readOfflineCashReconciliationEvents()), event]);
}

function sumMovement(rows: OfflineCashMovement[], movementType: OfflineCashMovement['movementType'], currency: OfflineCashMovement['currency']) {
  return roundMoney(rows.filter((row) => row.movementType === movementType && row.currency === currency).reduce((sum, row) => sum + row.amount, 0));
}

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
