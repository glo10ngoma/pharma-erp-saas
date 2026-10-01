import type { OfflineStockAllocation, PosSyncChangesPayload } from './offline-types';

export const PROBE_ARTICLE_CODE = 'DMC-SER-00002';
export const PROBE_ARTICLE_ID = 'c4ce1658-145b-4531-8059-dc45738712c1';
export const PROBE_ALLOCATION_ID = 'cea23721-ee1e-4601-90d8-69d5c04c8b23';

export function logPosClientAllocationProbe(stage: string, payload: Record<string, unknown>) {
  if (typeof console === 'undefined') return;
  console.log('POS_CLIENT_ALLOCATION_PROBE', {
    stage,
    articleCode: PROBE_ARTICLE_CODE,
    articleId: PROBE_ARTICLE_ID,
    allocationId: PROBE_ALLOCATION_ID,
    ...payload,
  });
}

export function summarizeProbeChangeAllocation(payload: PosSyncChangesPayload | null | undefined) {
  const row = payload?.changes?.allocations?.find((allocation) =>
    allocation.allocationId === PROBE_ALLOCATION_ID || allocation.articleId === PROBE_ARTICLE_ID,
  ) ?? null;
  if (!row) return null;
  const allocatedQuantity = Number(row.serverAllocatedQuantity ?? 0);
  const consumedQuantity = Number(row.serverConsumedQuantity ?? 0);
  return {
    allocationId: row.allocationId,
    articleId: row.articleId,
    lotId: row.lotId,
    allocatedQuantity,
    consumedQuantity,
    availableQuantity: Math.max(0, allocatedQuantity - consumedQuantity),
    status: row.status,
    serverVersion: row.serverVersion,
    operation: row.operation,
  };
}

export function summarizeProbeOfflineAllocation(rows: OfflineStockAllocation[]) {
  const row = rows.find((allocation) =>
    allocation.allocationId === PROBE_ALLOCATION_ID || allocation.articleId === PROBE_ARTICLE_ID,
  ) ?? null;
  if (!row) return null;
  const allocatedQuantity = Number(row.serverAllocatedQuantity ?? 0);
  const consumedQuantity = Number(row.serverConsumedQuantity ?? 0);
  const localPendingConsumption = Number(row.localPendingConsumption ?? 0);
  return {
    allocationId: row.allocationId,
    articleId: row.articleId,
    lotId: row.lotId,
    workstationId: row.workstationId,
    allocatedQuantity,
    consumedQuantity,
    localPendingConsumption,
    availableQuantity: Math.max(0, allocatedQuantity - consumedQuantity - localPendingConsumption),
    status: row.allocationStatus,
    serverVersion: row.serverVersion,
    updatedAt: row.updatedAt,
    lastSyncedAt: row.lastSyncedAt,
  };
}
