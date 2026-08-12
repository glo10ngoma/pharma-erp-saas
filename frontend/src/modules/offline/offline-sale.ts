import { posSyncService } from '../../services/posSync.service';
import {
  ensureOfflineCart,
  mapOfflineError,
} from './offline-cart';
import {
  persistValidatedOfflineSale,
  readOfflineDraftReservations,
  readOfflinePayments,
  readOfflineSales,
  readOfflineSnapshot,
  readOfflineSyncQueue,
  updateOfflineSyncReplayResult,
} from './offline-storage';
import {
  type OfflineActivityLogEntry,
  type OfflinePayment,
  type OfflinePaymentSettlement,
  type OfflinePendingConsumption,
  type OfflineSale,
  type OfflineSaleValidateOperation,
} from './offline-types';

export type FinalizeOfflineCashSaleInput = {
  amountPaidUsd: number;
  amountPaidCdf: number;
  note?: string | null;
};

export function buildOfflineCashSettlement(params: {
  totalUsd: number;
  exchangeRate: number | null;
  amountPaidUsd: number;
  amountPaidCdf: number;
}): OfflinePaymentSettlement {
  const totalUsd = roundMoney(params.totalUsd);
  const rate = params.exchangeRate && params.exchangeRate > 0 ? Number(params.exchangeRate) : null;
  const amountPaidUsd = roundMoney(params.amountPaidUsd);
  const amountPaidCdf = roundMoney(params.amountPaidCdf);
  const paidUsdEquivalent = roundMoney(amountPaidUsd + (rate ? amountPaidCdf / rate : 0));
  const settlementDifferenceUsd = roundMoney(paidUsdEquivalent - totalUsd);
  const suggestedChangeUsd = settlementDifferenceUsd > 0 ? settlementDifferenceUsd : 0;
  const suggestedChangeCdf = rate ? roundMoney(suggestedChangeUsd * rate) : 0;

  return {
    amountPaidUsd,
    amountPaidCdf,
    amountReturnedUsd: 0,
    amountReturnedCdf: 0,
    suggestedChangeUsd,
    suggestedChangeCdf,
    netReceivedUsd: amountPaidUsd,
    netReceivedCdf: amountPaidCdf,
    netTotalEquivalentUsd: paidUsdEquivalent,
    settlementDifferenceUsd,
  };
}

export async function finalizeOfflineCashSale(cartId: string, input: FinalizeOfflineCashSaleInput) {
  const [snapshot, cart, reservations, sales, payments] = await Promise.all([
    readOfflineSnapshot(),
    ensureOfflineCart({ cartId }),
    readOfflineDraftReservations(),
    readOfflineSales(),
    readOfflinePayments(),
  ]);

  if (!snapshot.auth || !snapshot.workstation || !snapshot.settings) {
    throw new Error('CATALOG_EMPTY');
  }
  if (!snapshot.cashSession || snapshot.cashSession.status !== 'OPEN') {
    throw new Error('CASH_SESSION_REQUIRED');
  }
  if (!cart.items.length || cart.status === 'BLOCKED') {
    throw new Error('CART_BLOCKED');
  }

  const rate = snapshot.settings.exchangeRate?.rate ?? cart.exchangeRateSnapshot ?? null;
  if (Number(input.amountPaidCdf ?? 0) > 0 && (!rate || rate <= 0)) {
    throw new Error('EXCHANGE_RATE_REQUIRED');
  }

  const settlement = buildOfflineCashSettlement({
    totalUsd: cart.total,
    exchangeRate: rate,
    amountPaidUsd: Number(input.amountPaidUsd ?? 0),
    amountPaidCdf: Number(input.amountPaidCdf ?? 0),
  });

  if (settlement.amountPaidUsd <= 0 && settlement.amountPaidCdf <= 0) {
    throw new Error('PAYMENT_REQUIRED');
  }
  if (settlement.settlementDifferenceUsd < -0.02) {
    throw new Error('PAYMENT_INSUFFICIENT');
  }

  const validatedAt = new Date().toISOString();
  const operationId = crypto.randomUUID();
  const localSaleId = crypto.randomUUID();
  const offlineReference = `OFF-${cart.offlineReference}`;

  const pendingConsumptions: OfflinePendingConsumption[] = cart.items.flatMap((item) =>
    item.lotAllocations.map((allocation) => ({
      pendingConsumptionId: crypto.randomUUID(),
      localSaleId,
      operationId,
      allocationId: allocation.allocationId,
      articleId: item.articleId,
      lotId: allocation.lotId,
      lotNumber: allocation.lotNumber,
      expiryDate: allocation.expiryDate,
      quantity: allocation.quantity,
      allocationServerVersion: allocation.allocationServerVersion,
      tenantId: cart.tenantId,
      siteId: cart.siteId,
      workstationId: cart.workstationId,
      status: 'PENDING',
      consumedAt: validatedAt,
      syncedAt: null,
    })),
  );

  const operation: OfflineSaleValidateOperation = {
    operationType: 'SALE_VALIDATE',
    operationId,
    localSaleId,
    offlineReference,
    tenantId: cart.tenantId,
    siteId: cart.siteId,
    workstationId: cart.workstationId,
    deviceId: cart.deviceId,
    userId: cart.userId,
    cashSessionId: snapshot.cashSession.cashSessionId,
    customerId: cart.customerId,
    currency: 'USD',
    exchangeRateSnapshot: rate,
    createdAt: cart.createdAt,
    validatedAt,
    saleMode: 'IMMEDIATE',
    saleType: 'CASH',
    note: (input.note ?? cart.note ?? '').trim() || null,
    subtotal: cart.subtotal,
    total: cart.total,
    payment: settlement,
    items: cart.items.map((item) => ({
      articleId: item.articleId,
      articleCode: item.articleCode,
      articleName: item.articleName,
      quantity: item.quantity,
      unitPriceSnapshot: item.unitPriceSnapshot,
      lotAllocations: item.lotAllocations.map((allocation) => ({
        allocationId: allocation.allocationId,
        lotId: allocation.lotId,
        lotNumber: allocation.lotNumber,
        expiryDate: allocation.expiryDate,
        quantity: allocation.quantity,
        allocationServerVersion: allocation.allocationServerVersion,
      })),
    })),
  };

  const sale: OfflineSale = {
    localSaleId,
    offlineReference,
    tenantId: cart.tenantId,
    siteId: cart.siteId,
    workstationId: cart.workstationId,
    deviceId: cart.deviceId,
    userId: cart.userId,
    cashSessionId: snapshot.cashSession.cashSessionId,
    customerId: cart.customerId,
    customerNameSnapshot: cart.customerNameSnapshot,
    saleType: 'CASH',
    saleMode: 'IMMEDIATE',
    currency: 'USD',
    exchangeRateSnapshot: rate,
    note: operation.note,
    status: 'PENDING_SYNC',
    syncStatus: 'PENDING',
    serverSaleId: null,
    serverSaleNumber: null,
    subtotal: cart.subtotal,
    total: cart.total,
    itemCount: cart.itemCount,
    quantityTotal: cart.quantityTotal,
    items: cart.items.map((item) => ({
      localSaleItemId: item.localItemId,
      articleId: item.articleId,
      articleCode: item.articleCode,
      articleName: item.articleName,
      quantity: item.quantity,
      unitPriceSnapshot: item.unitPriceSnapshot,
      lineTotal: item.lineTotal,
      salesUnit: item.salesUnit,
      packaging: item.packaging,
      packagingQuantity: item.packagingQuantity,
      lotAllocations: item.lotAllocations,
    })),
    createdAt: cart.createdAt,
    validatedAt,
    syncedAt: null,
  };

  const payment: OfflinePayment = {
    offlinePaymentId: crypto.randomUUID(),
    localSaleId,
    tenantId: cart.tenantId,
    siteId: cart.siteId,
    workstationId: cart.workstationId,
    cashSessionId: snapshot.cashSession.cashSessionId,
    currencyCode: 'USD',
    exchangeRate: rate,
    settlement,
    note: operation.note,
    status: 'CAPTURED_LOCAL',
    createdAt: validatedAt,
    syncedAt: null,
  };

  const activityEntries: OfflineActivityLogEntry[] = [
    {
      localId: crypto.randomUUID(),
      cartId,
      saleId: localSaleId,
      type: 'sale.validated_local',
      message: `Vente offline ${offlineReference} validee localement.`,
      createdAt: validatedAt,
    },
    {
      localId: crypto.randomUUID(),
      cartId,
      saleId: localSaleId,
      type: 'sale.sync_queued',
      message: `Operation ${operationId} placee en file de synchronisation.`,
      createdAt: validatedAt,
    },
  ];

  await persistValidatedOfflineSale({
    sale,
    payment,
    pendingConsumptions,
    queueEntry: {
      operationId,
      operationType: 'SALE_VALIDATE',
      workstationId: cart.workstationId,
      tenantId: cart.tenantId,
      siteId: cart.siteId,
      payload: operation,
      status: 'PENDING',
      relatedLocalSaleId: localSaleId,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
    cartId,
    activityEntries,
  });

  return {
    sale,
    payment,
    pendingConsumptions,
    draftReservations: reservations.filter((entry) => entry.cartId === cartId),
    previousSalesCount: sales.length,
    previousPaymentsCount: payments.length,
  };
}

export async function syncPendingOfflineSales() {
  const queue = await readOfflineSyncQueue();
  const pending = queue.filter(
    (entry) => entry.operationType === 'SALE_VALIDATE' && (entry.status === 'PENDING' || entry.status === 'FAILED' || entry.status === 'SYNCING'),
  );
  const results: Array<{
    operationId: string;
    status: 'SYNCED' | 'CONFLICT' | 'FAILED';
    serverSaleId?: string | null;
    serverSaleNumber?: string | null;
    error?: string;
    errorCode?: string | null;
  }> = [];

  for (const entry of pending) {
    try {
      const response = await posSyncService.pushOperations({
        operations: [entry.payload],
      });
      const result = response.data.results[0];
      if (result?.status === 'SYNCED' || result?.status === 'ALREADY_PROCESSED') {
        await updateOfflineSyncReplayResult({
          operationId: entry.operationId,
          localSaleId: entry.payload.localSaleId,
          nextStatus: 'SYNCED',
          serverSaleId: result.serverSaleId ?? null,
          serverSaleNumber: result.serverSaleNumber ?? null,
          allocations: result.allocations ?? [],
        });
        results.push({
          operationId: entry.operationId,
          status: 'SYNCED',
          serverSaleId: result.serverSaleId ?? null,
          serverSaleNumber: result.serverSaleNumber ?? null,
        });
      } else {
        await updateOfflineSyncReplayResult({
          operationId: entry.operationId,
          localSaleId: entry.payload.localSaleId,
          nextStatus: 'CONFLICT',
          errorCode: result?.errorCode ?? 'SYNC_CONFLICT',
          errorMessage: result?.message ?? 'Conflit de synchronisation',
        });
        results.push({
          operationId: entry.operationId,
          status: 'CONFLICT',
          errorCode: result?.errorCode ?? 'SYNC_CONFLICT',
          error: result?.message ?? result?.errorCode ?? 'SYNC_CONFLICT',
        });
      }
    } catch (error) {
      const message = mapOfflineError(error);
      await updateOfflineSyncReplayResult({
        operationId: entry.operationId,
        localSaleId: entry.payload.localSaleId,
        nextStatus: 'FAILED',
        errorCode: 'SYNC_FAILED',
        errorMessage: message,
      });
      results.push({
        operationId: entry.operationId,
        status: 'FAILED',
        errorCode: 'SYNC_FAILED',
        error: message,
      });
    }
  }

  return results;
}

export async function listOfflineSalesHistory() {
  const sales = await readOfflineSales();
  return sales.slice().sort((left, right) => right.validatedAt.localeCompare(left.validatedAt));
}

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
