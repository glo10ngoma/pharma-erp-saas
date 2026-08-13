import { formatMoney } from '../../utils/money';
import {
  allocateOfflineQuantity,
  getOfflineAvailableQuantity,
  isExpiredForOffline,
  isOfflineAllocationVendable,
  sortOfflineAllocationsByFefo,
} from './offline-fefo';
import {
  readOfflineActivityLog,
  readOfflineCart,
  readOfflineCarts,
  readOfflineDraftReservations,
  readOfflineSnapshot,
  saveOfflineCart,
  saveOfflineCarts,
  writeOfflineDraftReservations,
} from './offline-storage';
import {
  type OfflineActivityLogEntry,
  type OfflineCart,
  type OfflineCartErrorCode,
  type OfflineCartItem,
  type OfflineCartLotAllocation,
  type OfflineCartQuotaBreakdown,
  type OfflineCartStatus,
  type OfflineDraftReservation,
  type OfflineLocalSnapshot,
  type OfflinePosArticle,
  type OfflinePosCustomer,
  type OfflineSaleDraftOperation,
  type OfflineStockAllocation,
} from './offline-types';
import { getStableDeviceId } from './offline-bootstrap';

const COUNTER_CUSTOMER_CODE = 'CASH-COUNTER';

export type LocalCatalogSearchResult = {
  article: OfflinePosArticle;
  nextLot: OfflineStockAllocation | null;
  offlineAvailableQuantity: number;
  unitPrice: number | null;
  status: 'READY' | 'INACTIVE' | 'NO_PRICE' | 'NO_QUOTA';
};

export type OfflineCartContext = {
  snapshot: OfflineLocalSnapshot;
  carts: OfflineCart[];
  reservations: OfflineDraftReservation[];
};

export function normalizeOfflineSearch(value: string) {
  return value.trim().toLowerCase();
}

export function searchOfflineArticles(
  snapshot: OfflineLocalSnapshot,
  carts: OfflineCart[],
  reservations: OfflineDraftReservation[],
  query: string,
  limit = 20,
) {
  const needle = normalizeOfflineSearch(query);
  return snapshot.articles
    .filter((article) => {
      if (!needle) return true;
      return [article.commercialName, article.articleCode, article.barcode ?? '']
        .some((value) => normalizeOfflineSearch(String(value)).includes(needle));
    })
    .map((article) => buildCatalogSearchResult(article, snapshot, carts, reservations))
    .sort((left, right) => {
      const leftExact = Number(
        needle.length > 0 && (
          normalizeOfflineSearch(left.article.barcode ?? '') === needle
          || normalizeOfflineSearch(left.article.articleCode) === needle
        ),
      );
      const rightExact = Number(
        needle.length > 0 && (
          normalizeOfflineSearch(right.article.barcode ?? '') === needle
          || normalizeOfflineSearch(right.article.articleCode) === needle
        ),
      );
      if (leftExact !== rightExact) return rightExact - leftExact;
      return left.article.commercialName.localeCompare(right.article.commercialName);
    })
    .slice(0, limit);
}

export function searchOfflineCustomers(snapshot: OfflineLocalSnapshot, query: string, limit = 20) {
  const needle = normalizeOfflineSearch(query);
  return snapshot.customers
    .filter((customer) => {
      if (!needle) return true;
      return [customer.customerCode, customer.name, customer.phone ?? '']
        .some((value) => normalizeOfflineSearch(String(value)).includes(needle));
    })
    .slice(0, limit);
}

export async function ensureOfflineCart(options?: { cartId?: string | null }) {
  const context = await loadCartContext();
  const workstation = context.snapshot.workstation;
  const auth = context.snapshot.auth;
  const settings = context.snapshot.settings;
  if (!workstation || !auth || !settings) {
    throw new Error('CATALOG_EMPTY');
  }

  const activeCarts = context.carts
    .filter((cart) => cart.workstationId === workstation.workstationId && cart.status !== 'CANCELLED')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  if (options?.cartId) {
    const requested = activeCarts.find((cart) => cart.cartId === options.cartId);
    if (requested) {
      const validated = validateOfflineCart(requested, context);
      await persistValidatedCartIfNeeded(requested, validated, context.reservations);
      return validated;
    }
  }

  if (activeCarts[0]) {
    const validated = validateOfflineCart(activeCarts[0], context);
    await persistValidatedCartIfNeeded(activeCarts[0], validated, context.reservations);
    return validated;
  }

  const now = new Date().toISOString();
  const cart = recalculateCart({
    cartId: crypto.randomUUID(),
    offlineReference: buildOfflineReference(workstation.workstationCode ?? workstation.workstationName),
    tenantId: auth.tenantId,
    siteId: workstation.siteId,
    workstationId: workstation.workstationId,
    deviceId: workstation.deviceId || getStableDeviceId(),
    userId: auth.userId,
    customerId: null,
    customerNameSnapshot: findCounterCustomer(context.snapshot)?.name ?? 'Client comptoir',
    currency: settings.defaultCurrency,
    exchangeRateSnapshot: settings.exchangeRate?.rate ?? null,
    status: 'DRAFT',
    saveState: 'SAVED',
    note: null,
    subtotal: 0,
    total: 0,
    itemCount: 0,
    quantityTotal: 0,
    items: [],
    blockedReasons: [],
    createdAt: now,
    updatedAt: now,
  });

  await saveOfflineCart(
    cart,
    [],
    [createActivityLog('cart.created', cart.cartId, `Brouillon ${cart.offlineReference} cree localement.`)],
  );
  return cart;
}

export async function createNewOfflineCart() {
  const context = await loadCartContext();
  const workstation = context.snapshot.workstation;
  const auth = context.snapshot.auth;
  const settings = context.snapshot.settings;
  if (!workstation || !auth || !settings) {
    throw new Error('CATALOG_EMPTY');
  }

  const now = new Date().toISOString();
  const cart = recalculateCart({
    cartId: crypto.randomUUID(),
    offlineReference: buildOfflineReference(workstation.workstationCode ?? workstation.workstationName),
    tenantId: auth.tenantId,
    siteId: workstation.siteId,
    workstationId: workstation.workstationId,
    deviceId: workstation.deviceId || getStableDeviceId(),
    userId: auth.userId,
    customerId: null,
    customerNameSnapshot: findCounterCustomer(context.snapshot)?.name ?? 'Client comptoir',
    currency: settings.defaultCurrency,
    exchangeRateSnapshot: settings.exchangeRate?.rate ?? null,
    status: 'DRAFT',
    saveState: 'SAVED',
    note: null,
    subtotal: 0,
    total: 0,
    itemCount: 0,
    quantityTotal: 0,
    items: [],
    blockedReasons: [],
    createdAt: now,
    updatedAt: now,
  });
  await saveOfflineCart(
    cart,
    [],
    [createActivityLog('cart.created', cart.cartId, `Nouveau brouillon ${cart.offlineReference} cree localement.`)],
  );
  return cart;
}

export async function listOfflineDrafts() {
  const context = await loadCartContext();
  const nextCarts = context.carts
    .map((cart) => validateOfflineCart(cart, context))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  if (hasCartDiff(context.carts, nextCarts)) {
    await saveOfflineCarts(nextCarts);
  }

  return nextCarts;
}

export async function cancelOfflineCart(cartId: string) {
  const context = await loadCartContext();
  const cart = context.carts.find((row) => row.cartId === cartId);
  if (!cart) return null;

  const cancelled = recalculateCart({
    ...cart,
    status: 'CANCELLED' as OfflineCartStatus,
    blockedReasons: [],
    updatedAt: new Date().toISOString(),
    saveState: 'SAVED',
  });

  const remainingReservations = context.reservations.filter((entry) => entry.cartId !== cartId);
  const nextCarts = context.carts.map((row) => (row.cartId === cartId ? cancelled : row));
  await saveOfflineCart(cancelled, [], [
    createActivityLog('reservation.released', cartId, `Reservations liberees pour ${cart.offlineReference}.`),
    createActivityLog('cart.cancelled', cartId, `Brouillon ${cart.offlineReference} annule.`),
  ]);
  await saveOfflineCarts(nextCarts);
  await writeOfflineDraftReservations(remainingReservations);
  return cancelled;
}

export async function updateOfflineCartCustomer(cartId: string, customer: OfflinePosCustomer | null) {
  const [cart, reservations] = await Promise.all([requireCart(cartId), readOfflineDraftReservations()]);
  const updated = recalculateCart({
    ...cart,
    customerId: customer?.customerId ?? null,
    customerNameSnapshot: customer?.name ?? 'Client comptoir',
    updatedAt: new Date().toISOString(),
  });
  await saveOfflineCart(updated, reservations.filter((entry) => entry.cartId === cartId), []);
  return updated;
}

export async function setOfflineCartNote(cartId: string, note: string) {
  const [cart, reservations] = await Promise.all([requireCart(cartId), readOfflineDraftReservations()]);
  const updated = recalculateCart({
    ...cart,
    note: note.trim() || null,
    updatedAt: new Date().toISOString(),
  });
  await saveOfflineCart(updated, reservations.filter((entry) => entry.cartId === cartId), []);
  return updated;
}

export async function addOrIncrementOfflineCartItem(params: {
  cartId: string;
  articleId: string;
  quantityDelta?: number;
  replaceQuantity?: number;
}) {
  const context = await loadCartContext();
  const cart = context.carts.find((row) => row.cartId === params.cartId);
  if (!cart) throw new Error('CART_BLOCKED');

  const article = context.snapshot.articles.find((row) => row.articleId === params.articleId);
  if (!article) throw new Error('ARTICLE_NOT_FOUND');
  if (!article.isActive) throw new Error('ARTICLE_INACTIVE');

  const existing = cart.items.find((item) => item.articleId === params.articleId);
  const requestedQuantity = params.replaceQuantity ?? Number(existing?.quantity ?? 0) + Number(params.quantityDelta ?? 1);
  if (!Number.isFinite(requestedQuantity)) {
    throw new Error('OFFLINE_ALLOCATION_INSUFFICIENT');
  }

  return upsertOfflineCartItem(cart, article, Math.max(0, requestedQuantity), context);
}

export async function removeOfflineCartItem(cartId: string, localItemId: string) {
  const context = await loadCartContext();
  const cart = context.carts.find((row) => row.cartId === cartId);
  if (!cart) throw new Error('CART_BLOCKED');

  const removedItem = cart.items.find((item) => item.localItemId === localItemId);
  const nextCart = recalculateCart({
    ...cart,
    items: cart.items.filter((item) => item.localItemId !== localItemId),
    updatedAt: new Date().toISOString(),
  });
  const nextReservations = context.reservations.filter((entry) => entry.cartId !== cartId);
  await saveOfflineCart(nextCart, [], [
    createActivityLog('cart.item_removed', cartId, `Ligne retiree du brouillon ${cart.offlineReference}.`),
    createActivityLog('reservation.released', cartId, `Reservations liberees pour ${removedItem?.articleName ?? 'la ligne supprimee'}.`),
  ]);
  await writeOfflineDraftReservations(nextReservations);
  return nextCart;
}

export async function getOfflineCartPageModel(cartId?: string | null) {
  const context = await loadCartContext();
  const ensuredCart = await ensureOfflineCart({ cartId });
  const quotaBreakdown = buildQuotaBreakdown(context.snapshot, context.reservations, ensuredCart.cartId);
  const activityLog = await readOfflineActivityLog();

  return {
    snapshot: context.snapshot,
    cart: ensuredCart,
    drafts: context.carts
      .map((draft) => draft.cartId === ensuredCart.cartId ? ensuredCart : validateOfflineCart(draft, context))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    customers: context.snapshot.customers,
    activityLog: activityLog
      .filter((entry) => entry.cartId === ensuredCart.cartId)
      .slice()
      .reverse()
      .slice(0, 20),
    quotaBreakdown,
    reservations: context.reservations,
  };
}

export function buildOfflineSaleDraftOperation(cart: OfflineCart): OfflineSaleDraftOperation {
  return {
    operationType: 'SALE_DRAFT_CREATE',
    operationId: crypto.randomUUID(),
    cartId: cart.cartId,
    offlineReference: cart.offlineReference,
    tenantId: cart.tenantId,
    siteId: cart.siteId,
    workstationId: cart.workstationId,
    deviceId: cart.deviceId,
    userId: cart.userId,
    customerId: cart.customerId,
    currency: cart.currency,
    exchangeRateSnapshot: cart.exchangeRateSnapshot,
    createdAt: cart.createdAt,
    items: cart.items.map((item) => ({
      articleId: item.articleId,
      quantity: item.quantity,
      unitPriceSnapshot: item.unitPriceSnapshot,
      allocations: item.lotAllocations.map((allocation) => ({
        allocationId: allocation.allocationId,
        lotId: allocation.lotId,
        quantity: allocation.quantity,
        allocationServerVersion: allocation.allocationServerVersion,
      })),
    })),
  };
}

export function mapOfflineError(error: unknown) {
  const code = error instanceof Error ? error.message : 'LOCAL_STORAGE_ERROR';
  const messages: Record<OfflineCartErrorCode | string, string> = {
    CATALOG_EMPTY: 'Le catalogue local est vide. Lancez une synchronisation.',
    ARTICLE_NOT_FOUND: 'Article introuvable dans le catalogue local.',
    ARTICLE_INACTIVE: 'Cet article est inactif dans le snapshot local.',
    PRICE_MISSING: 'Prix de vente indisponible dans le snapshot local.',
    OFFLINE_ALLOCATION_INSUFFICIENT: 'Quantite offline insuffisante sur ce poste.',
    ALLOCATION_REVOKED: 'Une allocation du brouillon a ete revoquee.',
    ALLOCATION_SUSPENDED: 'Une allocation du brouillon est suspendue.',
    LOT_BLOCKED: 'Le lot est bloque dans le snapshot local.',
    LOT_EXPIRED: 'Le lot est expire dans le snapshot local.',
    LOT_EXPIRY_DATE_INVALID: 'La date d expiration du lot est invalide.',
    CART_BLOCKED: 'Le brouillon est bloque et doit etre corrige.',
    CASH_SESSION_REQUIRED: 'Ouvrez la caisse avant d encaisser une vente.',
    PAYMENT_REQUIRED: 'Saisissez un montant USD ou CDF avant de valider hors ligne.',
    PAYMENT_INSUFFICIENT: 'Le paiement saisi est insuffisant pour finaliser la vente offline.',
    EXCHANGE_RATE_REQUIRED: 'Un taux local valide est requis pour accepter un paiement en CDF hors ligne.',
    LOCAL_STORAGE_ERROR: 'Impossible d enregistrer localement ce brouillon.',
    OFFLINE_AUTH_EXPIRED: 'L autorisation hors ligne de ce poste a expire. Reconnectez-vous a Internet.',
    WORKSTATION_REVOKED: 'Ce poste n est plus autorise a effectuer des ventes hors ligne.',
    SNAPSHOT_EXPIRED: 'Les donnees locales sont trop anciennes. Reconnectez Internet puis synchronisez.',
    STORAGE_CRITICAL: 'Le stockage local du poste est presque plein. Contactez un responsable.',
    RECOVERY_REQUIRED: 'Une verification locale est requise avant de continuer les ventes hors ligne.',
    SYNC_CONFLICT: 'Une operation necessite la verification d un responsable.',
    INTERNAL_SERVER_ERROR: 'Une erreur technique est survenue. La vente locale reste conservee si elle a ete encaissee.',
  };
  return messages[code as OfflineCartErrorCode] ?? code;
}

export function formatQuotaAlert(available: number) {
  if (available <= 0) return 'Quota offline epuise sur ce poste.';
  if (available <= 2) return `Quota offline faible : ${available} unite(s) restante(s).`;
  return null;
}

export function formatOfflineCartStatus(status: OfflineCartStatus) {
  if (status === 'DRAFT') return 'Brouillon';
  if (status === 'READY') return 'Pret';
  if (status === 'BLOCKED') return 'Bloque';
  return 'Annule';
}

export function formatOfflineCartTotal(cart: OfflineCart) {
  return formatMoney(cart.total, cart.currency);
}

export async function getOfflineActivityFeed(cartId?: string | null) {
  const feed = await readOfflineActivityLog();
  return feed
    .filter((entry) => !cartId || entry.cartId === cartId)
    .slice()
    .reverse();
}

export function findCounterCustomer(snapshot: OfflineLocalSnapshot) {
  return snapshot.customers.find((customer) => normalizeOfflineSearch(customer.customerCode) === normalizeOfflineSearch(COUNTER_CUSTOMER_CODE))
    ?? null;
}

function buildCatalogSearchResult(
  article: OfflinePosArticle,
  snapshot: OfflineLocalSnapshot,
  carts: OfflineCart[],
  reservations: OfflineDraftReservation[],
): LocalCatalogSearchResult {
  const quotaRows = buildQuotaBreakdown(snapshot, reservations, null).filter((row) => row.articleId === article.articleId);
  const vendableAllocations = sortOfflineAllocationsByFefo(
    snapshot.allocations.filter((allocation) => allocation.articleId === article.articleId && isAllocationVendableForCart(allocation, quotaRows)),
  );
  const offlineAvailableQuantity = quotaRows.reduce((sum, row) => sum + row.availableForCart, 0);
  const unitPrice = resolveUnitPrice(article, snapshot);

  let status: LocalCatalogSearchResult['status'] = 'READY';
  if (!article.isActive) status = 'INACTIVE';
  else if (!Number.isFinite(unitPrice) || unitPrice <= 0) status = 'NO_PRICE';
  else if (offlineAvailableQuantity <= 0) status = 'NO_QUOTA';

  return {
    article,
    nextLot: vendableAllocations[0] ?? null,
    offlineAvailableQuantity,
    unitPrice: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : null,
    status,
  };
}

async function upsertOfflineCartItem(
  cart: OfflineCart,
  article: OfflinePosArticle,
  quantity: number,
  context: OfflineCartContext,
) {
  if (quantity <= 0) {
    const existing = cart.items.find((item) => item.articleId === article.articleId);
    if (!existing) return cart;
    return removeOfflineCartItem(cart.cartId, existing.localItemId);
  }

  const price = resolveUnitPrice(article, context.snapshot);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('PRICE_MISSING');
  }

  const adjustedAllocations = buildAllocationsForCart(context.snapshot.allocations, context.reservations, cart.cartId);
  const result = allocateOfflineQuantity(adjustedAllocations, article.articleId, quantity);
  if (result.conflict) {
    throw new Error('OFFLINE_ALLOCATION_INSUFFICIENT');
  }

  const existing = cart.items.find((item) => item.articleId === article.articleId);
  const now = new Date().toISOString();
  const normalizedAllocations: OfflineCartLotAllocation[] = result.consumptions.map((line) => ({
    allocationId: findAllocationIdForConsumption(adjustedAllocations, line.lotId, line.lotNumber, line.allocationVersion),
    lotId: line.lotId,
    lotNumber: line.lotNumber,
    expiryDate: line.expiryDate,
    quantity: line.quantity,
    allocationServerVersion: line.allocationVersion,
  }));

  const nextItem: OfflineCartItem = {
    localItemId: existing?.localItemId ?? crypto.randomUUID(),
    articleId: article.articleId,
    articleCode: article.articleCode,
    articleName: article.commercialName,
    barcode: article.barcode,
    quantity,
    unitPriceSnapshot: price,
    priceSource: Number.isFinite(Number(article.defaultSellingPrice)) && Number(article.defaultSellingPrice) > 0 ? 'ARTICLE_DEFAULT' : 'LOT_FEFO',
    priceVersion: article.updatedAt,
    lineTotal: roundMoney(quantity * price),
    salesUnit: article.salesUnit,
    packaging: article.packaging,
    packagingQuantity: article.packagingQuantity,
    lotAllocations: normalizedAllocations,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const stagedCart = {
    ...cart,
    items: [...cart.items.filter((item) => item.articleId !== article.articleId), nextItem]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    updatedAt: now,
    saveState: 'SAVED' as const,
  };
  const nextCart = validateOfflineCart(recalculateCart(stagedCart), {
    snapshot: context.snapshot,
    carts: context.carts.map((row) => (row.cartId === cart.cartId ? stagedCart : row)),
    reservations: [
      ...context.reservations.filter((entry) => entry.cartId !== cart.cartId),
      ...normalizedAllocations.map((allocation) => ({
        reservationId: `${cart.cartId}:${allocation.allocationId}`,
        cartId: cart.cartId,
        allocationId: allocation.allocationId,
        lotId: allocation.lotId,
        quantity: allocation.quantity,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      })),
    ],
  });

  const nextReservations = context.reservations.filter((entry) => entry.cartId !== cart.cartId);
  const ownReservations = normalizedAllocations.map((allocation) => ({
    reservationId: `${cart.cartId}:${allocation.allocationId}`,
    cartId: cart.cartId,
    allocationId: allocation.allocationId,
    lotId: allocation.lotId,
    quantity: allocation.quantity,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }));

  await saveOfflineCart(nextCart, ownReservations, [
    createActivityLog(existing ? 'cart.quantity_changed' : 'cart.item_added', cart.cartId, `${article.commercialName} x${quantity} enregistre localement.`),
    createActivityLog('fefo.recalculated', cart.cartId, `FEFO local recalcule pour ${article.commercialName}.`),
    createActivityLog('reservation.created', cart.cartId, `${ownReservations.length} reservation(s) locale(s) mises a jour.`),
  ]);
  await writeOfflineDraftReservations([...nextReservations, ...ownReservations]);
  return nextCart;
}

function buildOfflineReference(workstationCode: string) {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `OFF-${workstationCode.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase()}-${stamp}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

function resolveUnitPrice(article: OfflinePosArticle, snapshot: OfflineLocalSnapshot) {
  if (Number.isFinite(Number(article.defaultSellingPrice)) && Number(article.defaultSellingPrice) > 0) {
    return Number(article.defaultSellingPrice);
  }

  const lotPrice = snapshot.lots
    .filter((lot) => lot.articleId === article.articleId && Number(lot.sellingPrice) > 0)
    .sort((left, right) => String(left.expiryDate).localeCompare(String(right.expiryDate)))[0]?.sellingPrice;

  return Number(lotPrice ?? NaN);
}

function buildAllocationsForCart(
  allocations: OfflineStockAllocation[],
  reservations: OfflineDraftReservation[],
  cartId: string | null,
) {
  const reservedByAllocation = new Map<string, number>();
  for (const entry of reservations) {
    if (entry.cartId === cartId) continue;
    reservedByAllocation.set(entry.allocationId, (reservedByAllocation.get(entry.allocationId) ?? 0) + Number(entry.quantity ?? 0));
  }

  return allocations.map((allocation) => ({
    ...allocation,
    localPendingConsumption: Number(allocation.localPendingConsumption ?? 0) + (reservedByAllocation.get(allocation.allocationId) ?? 0),
  }));
}

export function buildQuotaBreakdown(
  snapshot: OfflineLocalSnapshot,
  reservations: OfflineDraftReservation[],
  currentCartId: string | null,
): OfflineCartQuotaBreakdown[] {
  const reservedByAllocation = new Map<string, number>();
  for (const entry of reservations) {
    if (entry.cartId === currentCartId) continue;
    reservedByAllocation.set(entry.allocationId, (reservedByAllocation.get(entry.allocationId) ?? 0) + Number(entry.quantity ?? 0));
  }

  return snapshot.allocations.map((allocation) => {
    const reservedInOtherDrafts = reservedByAllocation.get(allocation.allocationId) ?? 0;
    const baseAvailable = getOfflineAvailableQuantity(allocation);
    return {
      allocationId: allocation.allocationId,
      articleId: allocation.articleId,
      lotId: allocation.lotId,
      lotNumber: allocation.lotNumber,
      expiryDate: allocation.expiryDate,
      serverAllocatedQuantity: allocation.serverAllocatedQuantity,
      serverConsumedQuantity: allocation.serverConsumedQuantity,
      localPendingConsumption: allocation.localPendingConsumption,
      reservedInOtherDrafts,
      availableForCart: Math.max(0, baseAvailable - reservedInOtherDrafts),
      status: allocation.allocationStatus,
      isBlocked: allocation.isBlocked,
    };
  });
}

function validateOfflineCart(cart: OfflineCart, context: OfflineCartContext): OfflineCart {
  const reasons = new Set<string>();
  const articleMap = new Map(context.snapshot.articles.map((item) => [item.articleId, item]));
  const lotMap = new Map(context.snapshot.lots.map((item) => [item.lotId, item]));
  const quota = buildQuotaBreakdown(context.snapshot, context.reservations, cart.cartId);
  const quotaByAllocation = new Map(quota.map((item) => [item.allocationId, item]));

  for (const item of cart.items) {
    const article = articleMap.get(item.articleId);
    if (!article) reasons.add('ARTICLE_NOT_FOUND');
    else if (!article.isActive) reasons.add('ARTICLE_INACTIVE');
    if (!Number.isFinite(Number(item.unitPriceSnapshot)) || Number(item.unitPriceSnapshot) <= 0) {
      reasons.add('PRICE_MISSING');
    }

    let requestedFromLots = 0;
    for (const allocation of item.lotAllocations) {
      requestedFromLots += Number(allocation.quantity ?? 0);
      const lot = lotMap.get(allocation.lotId);
      const allocationQuota = quotaByAllocation.get(allocation.allocationId);

      if (!lot) {
        reasons.add('ALLOCATION_REVOKED');
        continue;
      }

      if (lot.isBlocked) reasons.add('LOT_BLOCKED');
      try {
        if (isExpiredForOffline(lot.expiryDate, new Date())) reasons.add('LOT_EXPIRED');
      } catch {
        reasons.add('LOT_EXPIRY_DATE_INVALID');
      }

      if (!allocationQuota) reasons.add('ALLOCATION_REVOKED');
      else if (allocationQuota.status === 'REVOKED') reasons.add('ALLOCATION_REVOKED');
      else if (allocationQuota.status === 'SUSPENDED') reasons.add('ALLOCATION_SUSPENDED');
      else if (allocation.quantity > allocationQuota.availableForCart) reasons.add('OFFLINE_ALLOCATION_INSUFFICIENT');
    }

    if (requestedFromLots !== item.quantity) {
      reasons.add('OFFLINE_ALLOCATION_INSUFFICIENT');
    }
  }

  return recalculateCart({
    ...cart,
    status: reasons.size > 0 ? 'BLOCKED' : cart.items.length > 0 ? 'READY' : 'DRAFT',
    blockedReasons: Array.from(reasons).map(mapOfflineError),
  });
}

function recalculateCart(cart: OfflineCart): OfflineCart {
  const subtotal = roundMoney(cart.items.reduce((sum, item) => sum + Number(item.lineTotal ?? 0), 0));
  const quantityTotal = cart.items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
  return {
    ...cart,
    subtotal,
    total: subtotal,
    itemCount: cart.items.length,
    quantityTotal,
  };
}

function hasCartDiff(previous: OfflineCart[], next: OfflineCart[]) {
  return JSON.stringify(previous) !== JSON.stringify(next);
}

async function loadCartContext(): Promise<OfflineCartContext> {
  const [snapshot, carts, reservations] = await Promise.all([
    readOfflineSnapshot(),
    readOfflineCarts(),
    readOfflineDraftReservations(),
  ]);
  return { snapshot, carts, reservations };
}

async function requireCart(cartId: string) {
  const cart = await readOfflineCart(cartId);
  if (!cart) throw new Error('CART_BLOCKED');
  return cart;
}

async function persistValidatedCartIfNeeded(
  original: OfflineCart,
  validated: OfflineCart,
  reservations: OfflineDraftReservation[],
) {
  if (JSON.stringify(original) === JSON.stringify(validated)) return;
  await saveOfflineCart(validated, reservations.filter((entry) => entry.cartId === validated.cartId), []);
}

function createActivityLog(type: OfflineActivityLogEntry['type'], cartId: string, message: string): OfflineActivityLogEntry {
  return {
    localId: crypto.randomUUID(),
    cartId,
    type,
    message,
    createdAt: new Date().toISOString(),
  };
}

function isAllocationVendableForCart(allocation: OfflineStockAllocation, quotaRows: OfflineCartQuotaBreakdown[]) {
  const quota = quotaRows.find((row) => row.allocationId === allocation.allocationId);
  return Boolean(quota)
    && allocation.allocationStatus === 'ACTIVE'
    && !allocation.isBlocked
    && (quota?.availableForCart ?? 0) > 0;
}

function findAllocationIdForConsumption(
  allocations: OfflineStockAllocation[],
  lotId: string,
  lotNumber: string,
  allocationVersion: number,
) {
  return allocations.find((allocation) =>
    allocation.lotId === lotId
    && allocation.lotNumber === lotNumber
    && allocation.serverVersion === allocationVersion,
  )?.allocationId ?? crypto.randomUUID();
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
