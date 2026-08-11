import { type OfflineStockAllocation } from './offline-types';

export function buildOfflineAllocationFixtures(): OfflineStockAllocation[] {
  const base = new Date('2026-08-11T08:00:00.000Z');
  const plusDays = (days: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + days).toISOString().slice(0, 10);

  return [
    fixture('demo-1', 'tenant-demo', 'site-demo-1', 'ws-pos-01', 'art-para-500', 'lot-para-a', 'PARA-A-001', plusDays(60), 8, 2, 1, 'ACTIVE', 3, '2026-08-11T08:00:00.000Z'),
    fixture('demo-2', 'tenant-demo', 'site-demo-1', 'ws-pos-01', 'art-para-500', 'lot-para-b', 'PARA-B-001', plusDays(30), 4, 1, 0, 'ACTIVE', 3, '2026-08-11T08:00:00.000Z'),
    fixture('demo-3', 'tenant-demo', 'site-demo-1', 'ws-pos-02', 'art-para-500', 'lot-para-c', 'PARA-C-001', plusDays(10), 5, 5, 0, 'EXHAUSTED', 4, '2026-08-11T08:00:00.000Z'),
    fixture('demo-4', 'tenant-demo', 'site-demo-1', 'ws-pos-02', 'art-amox-500', 'lot-amox-a', 'AMOX-A-001', plusDays(22), 12, 1, 2, 'ACTIVE', 2, '2026-08-11T08:00:00.000Z'),
    fixture('demo-5', 'tenant-demo', 'site-demo-1', 'ws-pos-03', 'art-amox-500', 'lot-amox-b', 'AMOX-B-001', plusDays(7), 3, 0, 0, 'SUSPENDED', 2, '2026-08-11T08:00:00.000Z', false, 'Quarantaine'),
    fixture('demo-6', 'tenant-demo', 'site-demo-1', 'ws-pos-03', 'art-ors', 'lot-ors-a', 'ORS-A-001', plusDays(-1), 9, 2, 0, 'ACTIVE', 1, '2026-08-11T08:00:00.000Z'),
    fixture('demo-7', 'tenant-demo', 'site-demo-1', 'ws-pos-03', 'art-cotton', 'lot-cotton', 'COT-001', plusDays(90), 20, 6, 0, 'REVOKED', 5, '2026-08-11T08:00:00.000Z'),
    fixture('demo-8', 'tenant-demo', 'site-demo-2', 'ws-backoffice', 'art-para-500', 'lot-para-d', 'PARA-D-001', plusDays(120), 30, 12, 4, 'ACTIVE', 6, '2026-08-11T08:00:00.000Z'),
  ];
}

function fixture(
  allocationId: string,
  tenantId: string,
  siteId: string,
  workstationId: string,
  articleId: string,
  lotId: string,
  lotNumber: string,
  expiryDate: string,
  serverAllocatedQuantity: number,
  serverConsumedQuantity: number,
  localPendingConsumption: number,
  allocationStatus: OfflineStockAllocation['allocationStatus'],
  serverVersion: number,
  lastSyncedAt: string,
  isBlocked = false,
  blockingReason?: string,
): OfflineStockAllocation {
  return {
    localId: allocationId,
    allocationId,
    tenantId,
    siteId,
    workstationId,
    articleId,
    lotId,
    lotNumber,
    expiryDate,
    isBlocked,
    blockingReason: blockingReason ?? null,
    serverAllocatedQuantity,
    serverConsumedQuantity,
    localPendingConsumption,
    allocationStatus,
    serverVersion,
    updatedAt: lastSyncedAt,
    lastSyncedAt,
  };
}
