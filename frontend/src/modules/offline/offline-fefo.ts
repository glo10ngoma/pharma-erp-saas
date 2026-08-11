import {
  type OfflineAllocationConflict,
  type OfflineAllocationConsumption,
  type OfflineAllocationSnapshot,
  type OfflineAllocationStatus,
  type OfflineStockAllocation,
} from './offline-types';

export function getOfflineAvailableQuantity(allocation: Pick<OfflineStockAllocation, 'serverAllocatedQuantity' | 'serverConsumedQuantity' | 'localPendingConsumption' | 'allocationStatus'>) {
  if (allocation.allocationStatus !== 'ACTIVE') return 0;
  return Math.max(
    0,
    Number(allocation.serverAllocatedQuantity ?? 0)
      - Number(allocation.serverConsumedQuantity ?? 0)
      - Number(allocation.localPendingConsumption ?? 0),
  );
}

export function getServerAvailableQuantity(allocation: Pick<OfflineStockAllocation, 'serverAllocatedQuantity' | 'serverConsumedQuantity'>) {
  return Math.max(0, Number(allocation.serverAllocatedQuantity ?? 0) - Number(allocation.serverConsumedQuantity ?? 0));
}

export function isOfflineAllocationVendable(allocation: OfflineStockAllocation, today = new Date()) {
  if (allocation.allocationStatus !== 'ACTIVE') return false;
  if (allocation.isBlocked) return false;
  if (getOfflineAvailableQuantity(allocation) <= 0) return false;
  return compareDateOnly(allocation.expiryDate, today) > 0;
}

export function sortOfflineAllocationsByFefo<T extends Pick<OfflineStockAllocation, 'expiryDate' | 'lotNumber'>>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const expiry = compareDateOnly(a.expiryDate, b.expiryDate);
    if (expiry !== 0) return expiry;
    return String(a.lotNumber ?? '').localeCompare(String(b.lotNumber ?? ''));
  });
}

export function createOfflineAllocationSnapshot(
  allocations: OfflineStockAllocation[],
  tenantId: string,
  siteId: string,
  workstationId?: string | null,
): OfflineAllocationSnapshot {
  const totalAllocated = allocations.reduce((sum, allocation) => sum + Number(allocation.serverAllocatedQuantity ?? 0), 0);
  const totalConsumed = allocations.reduce((sum, allocation) => sum + Number(allocation.serverConsumedQuantity ?? 0) + Number(allocation.localPendingConsumption ?? 0), 0);
  const totalAvailable = allocations.reduce((sum, allocation) => sum + getOfflineAvailableQuantity(allocation), 0);
  return {
    generatedAt: new Date().toISOString(),
    tenantId,
    siteId,
    workstationId: workstationId ?? null,
    allocations,
    totalAllocated,
    totalConsumed,
    totalAvailable,
  };
}

export function allocateOfflineQuantity(
  allocations: OfflineStockAllocation[],
  articleId: string,
  requestedQuantity: number,
  today = new Date(),
): { consumptions: OfflineAllocationConsumption[]; conflict: OfflineAllocationConflict | null; allocatedQuantity: number; shortageQuantity: number } {
  const relevant = sortOfflineAllocationsByFefo(
    allocations.filter((allocation) => allocation.articleId === articleId && isOfflineAllocationVendable(allocation, today)),
  );
  const consumptions: OfflineAllocationConsumption[] = [];
  let remaining = Math.max(0, Number(requestedQuantity ?? 0));

  for (const allocation of relevant) {
    if (remaining <= 0) break;
    const available = getOfflineAvailableQuantity(allocation);
    if (available <= 0) continue;
    const consumed = Math.min(available, remaining);
    consumptions.push({
      operationId: crypto.randomUUID(),
      localSaleId: '',
      workstationId: allocation.workstationId,
      siteId: allocation.siteId,
      tenantId: allocation.tenantId,
      articleId: allocation.articleId,
      lotId: allocation.lotId,
      lotNumber: allocation.lotNumber,
      expiryDate: allocation.expiryDate,
      quantity: consumed,
      allocationVersion: allocation.serverVersion,
      consumedAt: new Date().toISOString(),
    });
    remaining -= consumed;
  }

  const allocatedQuantity = consumptions.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
  const shortageQuantity = Math.max(0, requestedQuantity - allocatedQuantity);
  const conflict = shortageQuantity > 0 ? buildAllocationConflict(articleId, requestedQuantity, allocatedQuantity, relevant) : null;

  return { consumptions, conflict, allocatedQuantity, shortageQuantity };
}

export function markAllocationConsumed(allocation: OfflineStockAllocation, quantity: number) {
  const nextPending = Math.max(0, Number(allocation.localPendingConsumption ?? 0) + Number(quantity ?? 0));
  const nextStatus: OfflineAllocationStatus = getServerAvailableQuantity(allocation) - nextPending <= 0
    ? 'EXHAUSTED'
    : allocation.allocationStatus;
  return {
    ...allocation,
    localPendingConsumption: nextPending,
    allocationStatus: nextStatus,
  } satisfies OfflineStockAllocation;
}

export function normalizeAllocationStatus(status: string | null | undefined): OfflineAllocationStatus {
  if (status === 'ACTIVE' || status === 'EXHAUSTED' || status === 'SUSPENDED' || status === 'REVOKED') return status;
  return 'ACTIVE';
}

export function isExpiredForOffline(expiryDate: string | Date, today = new Date()) {
  return compareDateOnly(expiryDate, today) <= 0;
}

function compareDateOnly(left: string | Date, right: string | Date) {
  const leftDate = toDateOnly(left);
  const rightDate = toDateOnly(right);
  return leftDate.getTime() - rightDate.getTime();
}

function toDateOnly(value: string | Date) {
  const normalized = value instanceof Date
    ? value
    : new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(normalized.getTime())) throw new Error('INVALID_OFFLINE_EXPIRY_DATE');
  return new Date(normalized.getFullYear(), normalized.getMonth(), normalized.getDate());
}

function buildAllocationConflict(
  articleId: string,
  requestedQuantity: number,
  allocatedQuantity: number,
  relevant: OfflineStockAllocation[],
): OfflineAllocationConflict {
  const exhausted = relevant.length === 0;
  return {
    code: exhausted ? 'ALLOCATION_EXHAUSTED' : 'ALLOCATION_MISMATCH',
    message: exhausted
      ? 'Stock offline insuffisant sur ce poste.'
      : 'La demande dépasse les allocations offline disponibles.',
    articleId,
    requestedQuantity,
    availableQuantity: allocatedQuantity,
  };
}
