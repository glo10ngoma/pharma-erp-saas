import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { FloatingSearchPopover } from '../../components/FloatingSearchPopover';
import { formatDate, formatDateTime } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import {
  addOrIncrementOfflineCartItem,
  buildOfflineArticleSearchIndex,
  buildQuotaBreakdown,
  createNewOfflineCart,
  findExactOfflineArticleMatch,
  findCounterCustomer,
  formatOfflineCartStatus,
  formatQuotaAlert,
  getOfflineCartPageModel,
  mapOfflineError,
  normalizeOfflineSearch,
  persistOfflineCartWritePlan,
  prepareOfflineCartItemUpdateWithContext,
  searchOfflineArticles,
  searchOfflineCustomers,
  setOfflineCartNote,
  updateOfflineCartCustomer,
  updateOfflineCartSaleConfiguration,
  type LocalCatalogSearchResult,
} from './offline-cart';
import {
  buildOfflineCashSettlement,
  finalizeOfflineCashSale,
} from './offline-sale';
import { canAttachOfflineCashSale } from './offline-cash';
import { notifyOfflineSaleQueued } from './sync-engine';
import { OfflineNetworkBanner, OfflineReceiptTicket, OfflineWorkspaceLayout, mapOfflineSellerMessage, printOfflineReceipt } from './offline-ui';
import {
  calculateAuthorizationState,
  calculateSnapshotFreshness,
  type OfflineSnapshotViewModel,
} from './offline-bootstrap';
import { ensureOfflineEnvironmentReady, type OfflineEnvironmentState } from './offline-environment';
import { type OfflineCart, type OfflineCustomerMembership, type OfflinePosCustomer, type OfflineSale } from './offline-types';
import { useSyncEngine } from './useSyncEngine';

type OfflinePageModel = Awaited<ReturnType<typeof getOfflineCartPageModel>>;
type OfflinePosInitState = 'LOADING' | OfflineEnvironmentState | 'ERROR';

const emptyViewModel: OfflineSnapshotViewModel = {
  snapshot: {
    articles: [],
    lots: [],
    allocations: [],
    customers: [],
    organizations: [],
    insurancePlans: [],
    memberships: [],
    settings: null,
    auth: null,
    workstation: null,
    cashSession: null,
    syncState: null,
  },
  queue: [],
  syncLog: [],
  conflicts: [],
  authorizationState: 'UNAUTHORIZED',
  snapshotStatus: 'UNKNOWN',
  networkStatus: 'OFFLINE',
};

export function OfflinePosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCartId = searchParams.get('draft');
  const [viewModel, setViewModel] = useState<OfflineSnapshotViewModel>(emptyViewModel);
  const [pageModel, setPageModel] = useState<OfflinePageModel | null>(null);
  const [initState, setInitState] = useState<OfflinePosInitState>('LOADING');
  const [initError, setInitError] = useState('');
  const [articleQuery, setArticleQuery] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [articleOpen, setArticleOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [articleHighlightedIndex, setArticleHighlightedIndex] = useState(0);
  const [message, setMessage] = useState('Le panier offline reste local a ce poste et n envoie aucune vente.');
  const [saveLabel, setSaveLabel] = useState<'SAVED' | 'SAVING' | 'ERROR'>('SAVED');
  const [busyAction, setBusyAction] = useState<'NEW' | 'ITEM' | 'CUSTOMER' | 'NOTE' | 'CHECKOUT' | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [amountPaidUsd, setAmountPaidUsd] = useState('');
  const [amountPaidCdf, setAmountPaidCdf] = useState('');
  const [amountReturnedUsd, setAmountReturnedUsd] = useState('');
  const [amountReturnedCdf, setAmountReturnedCdf] = useState('');
  const [lastReceiptSale, setLastReceiptSale] = useState<OfflineSale | null>(null);
  const articleInputRef = useRef<HTMLInputElement | null>(null);
  const customerInputRef = useRef<HTMLInputElement | null>(null);
  const membershipInputRef = useRef<HTMLSelectElement | null>(null);
  const amountPaidUsdRef = useRef<HTMLInputElement | null>(null);
  const amountPaidCdfRef = useRef<HTMLInputElement | null>(null);
  const amountReturnedUsdRef = useRef<HTMLInputElement | null>(null);
  const amountReturnedCdfRef = useRef<HTMLInputElement | null>(null);
  const noteSaveTimer = useRef<number | null>(null);
  const autoExactSelectionRef = useRef<string | null>(null);
  const returnedValuesAutofilledRef = useRef(false);
  const addToCartMetricsRef = useRef<Record<string, number>>({});
  const syncEngine = useSyncEngine();

  async function refresh(cartId?: string | null) {
    setInitState('LOADING');
    setInitError('');
    try {
      const environment = await ensureOfflineEnvironmentReady({
        cartId: cartId ?? selectedCartId,
      });
      setViewModel(environment.viewModel);
      setPageModel(environment.pageModel);
      setNoteDraft(environment.pageModel?.cart.note ?? '');
      setSaveLabel('SAVED');
      setInitState(environment.state);
      if (environment.message) {
        setInitError(environment.message);
      }
      const nextCartId = environment.pageModel?.cart.cartId ?? null;
      if (nextCartId && nextCartId !== selectedCartId) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('draft', nextCartId);
        setSearchParams(nextParams, { replace: true });
      }
    } catch (error) {
      setPageModel(null);
      setViewModel(emptyViewModel);
      setInitState('ERROR');
      setInitError(mapOfflineSellerMessage(error));
    }
  }

  useEffect(() => {
    void refresh(selectedCartId);
  }, [selectedCartId]);

  useEffect(() => {
    function handleOnline() {
      void refresh(selectedCartId);
    }
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [selectedCartId]);

  useEffect(() => () => {
    if (noteSaveTimer.current) window.clearTimeout(noteSaveTimer.current);
  }, []);

  useEffect(() => {
    function handleKeys(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTextArea = target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (event.key === 'F2') {
        event.preventDefault();
        articleInputRef.current?.focus();
      }
      if (event.key === 'F4' && !isTextArea) {
        event.preventDefault();
        focusPrimaryPaymentField();
      }
      if (event.key === 'F8') {
        event.preventDefault();
        if (canFinalizeOfflineSale && busyAction === null) {
          void handleFinalizeOfflineSale();
          return;
        }
        if (checkoutDisabledReason) setMessage(checkoutDisabledReason);
        focusCheckoutBlockingField();
      }
    }
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  });

  const cart = pageModel?.cart ?? null;
  const snapshot = pageModel?.snapshot ?? viewModel.snapshot;
  const settings = snapshot.settings;
  const workstation = snapshot.workstation;
  const auth = snapshot.auth;
  const draftCounterCustomer = useMemo(() => findCounterCustomer(snapshot), [snapshot]);

  const cartContext = useMemo(
    () => ({
      snapshot,
      carts: pageModel?.drafts ?? [],
      reservations: pageModel?.reservations ?? [],
    }),
    [pageModel?.drafts, pageModel?.reservations, snapshot],
  );
  const articleSearchIndex = useMemo(
    () => buildOfflineArticleSearchIndex(snapshot, pageModel?.reservations ?? [], cart?.cartId ?? null),
    [cart?.cartId, pageModel?.reservations, snapshot],
  );
  const articleResults = useMemo(
    () => articleQuery.trim().length >= 1 ? searchOfflineArticles(articleSearchIndex, articleQuery, 8) : [],
    [articleQuery, articleSearchIndex],
  );
  const exactArticleMatch = useMemo<LocalCatalogSearchResult | null>(
    () => articleQuery.trim().length >= 1 ? findExactOfflineArticleMatch(articleSearchIndex, articleQuery) : null,
    [articleQuery, articleSearchIndex],
  );
  const customerResults = useMemo(
    () => searchOfflineCustomers(snapshot, customerQuery, 20),
    [customerQuery, snapshot],
  );

  const quotaSummary = useMemo(() => {
    const rows = pageModel?.quotaBreakdown ?? [];
    const totalAvailable = rows.reduce((sum, row) => sum + row.availableForCart, 0);
    const reservedElsewhere = rows.reduce((sum, row) => sum + row.reservedInOtherDrafts, 0);
    const serverAllocated = rows.reduce((sum, row) => sum + row.serverAllocatedQuantity, 0);
    const serverConsumed = rows.reduce((sum, row) => sum + row.serverConsumedQuantity, 0);
    const cartReserved = cart?.items.reduce(
      (sum, item) => sum + item.lotAllocations.reduce((lotSum, lot) => lotSum + lot.quantity, 0),
      0,
    ) ?? 0;
    return { totalAvailable, reservedElsewhere, serverAllocated, serverConsumed, cartReserved };
  }, [cart, pageModel?.quotaBreakdown]);

  const snapshotStatus = calculateSnapshotFreshness(snapshot.syncState, snapshot.auth, snapshot.workstation);
  const authorizationState = calculateAuthorizationState(snapshot.auth, snapshot.workstation);
  const quotaAlert = formatQuotaAlert(quotaSummary.totalAvailable);
  const cartTotal = cart?.total ?? 0;
  const cartExchangeRate = settings?.exchangeRate?.rate ?? cart?.exchangeRateSnapshot ?? null;
  const insuranceMemberships = useMemo(
    () => snapshot.memberships.filter((membership) => membership.customerId === cart?.customerId && membership.isActive),
    [cart?.customerId, snapshot.memberships],
  );
  const selectedMembership = useMemo(
    () => insuranceMemberships.find((membership) => membership.membershipId === cart?.membershipId) ?? null,
    [cart?.membershipId, insuranceMemberships],
  );
  const settlementPreview = buildOfflineCashSettlement({
    payableUsd: cart?.patientShareUsd ?? cartTotal,
    exchangeRate: cartExchangeRate,
    amountPaidUsd: Number(amountPaidUsd || 0),
    amountPaidCdf: Number(amountPaidCdf || 0),
    amountReturnedUsd: Number(amountReturnedUsd || 0),
    amountReturnedCdf: Number(amountReturnedCdf || 0),
  });
  const requiresCashSessionForSettlement =
    settlementPreview.amountPaidUsd > 0
    || settlementPreview.amountPaidCdf > 0
    || settlementPreview.amountReturnedUsd > 0
    || settlementPreview.amountReturnedCdf > 0;
  const hasCart = Boolean(cart);
  const itemCount = cart?.items.length ?? 0;
  const cartStatus = cart?.status ?? 'DRAFT';
  const cartBlockingReasons = cart?.blockedReasons ?? [];
  const cashSessionStatus = snapshot.cashSession?.status ?? 'NONE';
  const cashSessionAttachable = canAttachOfflineCashSale(snapshot.cashSession);
  const saleType = cart?.saleType ?? 'CASH';
  const saleMode = cart?.saleMode ?? 'IMMEDIATE';
  const membershipValid = saleType !== 'INSURANCE' || Boolean(cart?.membershipId);
  const patientShareUsd = cart?.patientShareUsd ?? cartTotal;
  const insuranceShareUsd = cart?.insuranceShareUsd ?? 0;
  const amountDueUsd = patientShareUsd;
  const amountDueCdf = cartExchangeRate ? Math.round(amountDueUsd * cartExchangeRate) : 0;
  const paidEquivalentUsd = settlementPreview.netTotalEquivalentUsd;
  const paymentValid =
    (saleType === 'INSURANCE' && patientShareUsd <= 0)
    || settlementPreview.amountPaidUsd > 0
    || settlementPreview.amountPaidCdf > 0;
  const returnedAmountValid =
    settlementPreview.amountReturnedUsd <= settlementPreview.amountPaidUsd
    && settlementPreview.amountReturnedCdf <= settlementPreview.amountPaidCdf
    && (
      settlementPreview.amountReturnedUsd <= 0
      && settlementPreview.amountReturnedCdf <= 0
      || settlementPreview.amountPaidUsd > 0
      || settlementPreview.amountPaidCdf > 0
    );
  const canFinalizeOfflineSale =
    hasCart
    && itemCount > 0
    && cartStatus !== 'BLOCKED'
    && authorizationState === 'AUTHORIZED'
    && membershipValid
    && paymentValid
    && (
      requiresCashSessionForSettlement
        ? cashSessionAttachable
        : true
    )
    && settlementPreview.settlementDifferenceUsd >= -0.02
    && returnedAmountValid;
  const checkoutDisabledReason = useMemo(() => {
    if (!hasCart) return 'Chargement du brouillon local.';
    if (itemCount <= 0) return null;
    if (cartStatus === 'BLOCKED') {
      return cartBlockingReasons[0] ? `Vente bloquee : ${cartBlockingReasons[0]}` : 'Vente bloquee : stock indisponible.';
    }
    if (authorizationState === 'REVOKED') return 'Ce poste a ete revoque.';
    if (authorizationState !== 'AUTHORIZED') return 'Ce poste n est pas autorise pour la vente hors ligne.';
    if (!membershipValid) return 'Selectionnez une assurance / mutuelle.';
    if (!paymentValid) return 'Montant paye insuffisant ou absent.';
    if (requiresCashSessionForSettlement && !cashSessionAttachable) {
      return snapshot.cashSession
        ? 'La session locale restauree n est pas encore utilisable pour encaisser.'
        : 'Ouvrez la caisse avant d encaisser une vente.';
    }
    if (settlementPreview.settlementDifferenceUsd < -0.02) return 'Montant paye insuffisant.';
    if (!returnedAmountValid) return 'Les montants rendus depassent les montants encaisses.';
    return null;
  }, [
    authorizationState,
    cartBlockingReasons,
    cartStatus,
    cashSessionAttachable,
    hasCart,
    itemCount,
    membershipValid,
    paymentValid,
    requiresCashSessionForSettlement,
    returnedAmountValid,
    settlementPreview.settlementDifferenceUsd,
    snapshot.cashSession,
  ]);

  function isPrimaryCdfCurrency() {
    return cart?.currency === 'CDF';
  }

  function focusPrimaryPaymentField() {
    const primaryInput = isPrimaryCdfCurrency() ? amountPaidCdfRef.current : amountPaidUsdRef.current;
    const secondaryInput = isPrimaryCdfCurrency() ? amountPaidUsdRef.current : amountPaidCdfRef.current;
    const primaryAmount = isPrimaryCdfCurrency() ? Number(amountPaidCdf || 0) : Number(amountPaidUsd || 0);

    if (primaryAmount > 0 && settlementPreview.settlementDifferenceUsd < -0.02) {
      secondaryInput?.focus();
      return;
    }
    primaryInput?.focus();
  }

  function focusCheckoutBlockingField() {
    if (!membershipValid) {
      membershipInputRef.current?.focus();
      return;
    }
    if (!paymentValid || settlementPreview.settlementDifferenceUsd < -0.02) {
      focusPrimaryPaymentField();
      return;
    }
    if (!returnedAmountValid) {
      if (settlementPreview.amountReturnedUsd > settlementPreview.amountPaidUsd) {
        amountReturnedUsdRef.current?.focus();
        return;
      }
      amountReturnedCdfRef.current?.focus();
    }
  }

  function setSuggestedReturnedAmounts(nextPaidUsd: string, nextPaidCdf: string) {
    if (!cart) return;
    const nextPreview = buildOfflineCashSettlement({
      payableUsd: cart.patientShareUsd ?? cartTotal,
      exchangeRate: cartExchangeRate,
      amountPaidUsd: Number(nextPaidUsd || 0),
      amountPaidCdf: Number(nextPaidCdf || 0),
    });
    const hasUsdPayment = nextPreview.amountPaidUsd > 0;
    const hasCdfPayment = nextPreview.amountPaidCdf > 0;

    if (hasUsdPayment && !hasCdfPayment) {
      setAmountReturnedUsd(nextPreview.suggestedChangeUsd > 0 ? nextPreview.suggestedChangeUsd.toFixed(2) : '');
      setAmountReturnedCdf('');
      returnedValuesAutofilledRef.current = true;
      return;
    }
    if (hasCdfPayment && !hasUsdPayment) {
      setAmountReturnedUsd('');
      setAmountReturnedCdf(nextPreview.suggestedChangeCdf > 0 ? String(Math.round(nextPreview.suggestedChangeCdf)) : '');
      returnedValuesAutofilledRef.current = true;
      return;
    }
    if (returnedValuesAutofilledRef.current) {
      setAmountReturnedUsd('');
      setAmountReturnedCdf('');
      returnedValuesAutofilledRef.current = false;
    }
  }

  function handlePaidUsdChange(value: string) {
    setAmountPaidUsd(value);
    setSuggestedReturnedAmounts(value, amountPaidCdf);
  }

  function handlePaidCdfChange(value: string) {
    setAmountPaidCdf(value);
    setSuggestedReturnedAmounts(amountPaidUsd, value);
  }

  function handleReturnedUsdChange(value: string) {
    returnedValuesAutofilledRef.current = false;
    setAmountReturnedUsd(value);
  }

  function handleReturnedCdfChange(value: string) {
    returnedValuesAutofilledRef.current = false;
    setAmountReturnedCdf(value);
  }

  function resetForNextSale() {
    setArticleQuery('');
    setArticleOpen(false);
    setCustomerQuery('');
    setCustomerOpen(false);
    setNoteDraft('');
    setAmountPaidUsd('');
    setAmountPaidCdf('');
    setAmountReturnedUsd('');
    setAmountReturnedCdf('');
    returnedValuesAutofilledRef.current = false;
  }

  function updateLocalCartState(nextCart: OfflineCart, nextReservations: OfflinePageModel['reservations']) {
    setPageModel((current) => {
      if (!current) return current;
      const nextDrafts = current.drafts.some((draft) => draft.cartId === nextCart.cartId)
        ? current.drafts.map((draft) => (draft.cartId === nextCart.cartId ? nextCart : draft))
        : [nextCart, ...current.drafts];
      return {
        ...current,
        cart: nextCart,
        drafts: nextDrafts,
        reservations: nextReservations,
        quotaBreakdown: buildQuotaBreakdown(snapshot, nextReservations, nextCart.cartId),
      };
    });
  }

  function beginPerfMeasure(label: string) {
    if (typeof performance === 'undefined') return 0;
    performance.mark(`${label}:start`);
    return performance.now();
  }

  function endPerfMeasure(label: string, start: number) {
    if (typeof performance === 'undefined') return 0;
    const end = performance.now();
    performance.mark(`${label}:end`);
    performance.measure(label, `${label}:start`, `${label}:end`);
    return end - start;
  }

  function handleArticleQueryChange(value: string) {
    setArticleQuery(value);
    setArticleOpen(value.trim().length >= 1);
  }

  useEffect(() => {
    setArticleHighlightedIndex(0);
  }, [articleQuery, articleResults.length]);

  function handleArticleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setArticleOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setArticleOpen(articleQuery.trim().length >= 1);
      setArticleHighlightedIndex((index) => Math.min(index + 1, Math.max(articleResults.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setArticleHighlightedIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter' && articleOpen && articleResults[articleHighlightedIndex]) {
      event.preventDefault();
      void handleSelectArticle(articleResults[articleHighlightedIndex], 1);
    }
  }

  function getArticleResultStatusLabel(result: LocalCatalogSearchResult) {
    if (result.status === 'READY') return `${result.offlineAvailableQuantity} dispo`;
    if (result.status === 'INACTIVE') return 'Inactif';
    if (result.status === 'NO_PRICE') return 'Prix indisponible';
    return 'Quota epuise';
  }

  useEffect(() => {
    if (!cart || !exactArticleMatch || exactArticleMatch.status !== 'READY') return;
    const normalized = normalizeOfflineSearch(articleQuery);
    if (!normalized) {
      autoExactSelectionRef.current = null;
      return;
    }
    const selectionKey = `${cart.cartId}:${normalized}`;
    if (autoExactSelectionRef.current === selectionKey) return;
    autoExactSelectionRef.current = selectionKey;
    void handleSelectArticle(exactArticleMatch, 1);
  }, [articleQuery, cart, exactArticleMatch]);

  useEffect(() => {
    if (!articleQuery.trim()) autoExactSelectionRef.current = null;
  }, [articleQuery]);

  async function handleSelectArticle(result: LocalCatalogSearchResult, quantityDelta = 1) {
    if (!cart) return;
    if (result.status !== 'READY') {
      setMessage(
        result.status === 'INACTIVE'
          ? 'Article inactif dans le snapshot local.'
          : result.status === 'NO_PRICE'
            ? 'Prix de vente indisponible dans le snapshot local.'
            : 'Quota offline epuise sur ce poste.',
      );
      return;
    }
    setBusyAction('ITEM');
    setSaveLabel('SAVING');
    try {
      const totalStart = beginPerfMeasure('offline-pos:add-to-cart');
      const lookupStart = typeof performance !== 'undefined' ? performance.now() : 0;
      const articleLookupMs = typeof performance !== 'undefined' ? performance.now() - lookupStart : 0;
      const fefoStart = typeof performance !== 'undefined' ? performance.now() : 0;
      const prepared = prepareOfflineCartItemUpdateWithContext({
        cartId: cart.cartId,
        articleId: result.article.articleId,
        quantityDelta,
      }, cartContext);
      const fefoSelectionMs = typeof performance !== 'undefined' ? performance.now() - fefoStart : 0;
      const cartUpdateStart = typeof performance !== 'undefined' ? performance.now() : 0;
      flushSync(() => {
        updateLocalCartState(prepared.cart, prepared.mergedReservations);
        setMessage(`${result.article.commercialName} ajoute au brouillon ${prepared.cart.offlineReference}.`);
        setArticleQuery('');
        setArticleOpen(false);
      });
      const cartUpdateMs = typeof performance !== 'undefined' ? performance.now() - cartUpdateStart : 0;
      setTimeout(() => articleInputRef.current?.focus(), 0);
      setBusyAction(null);
      void (async () => {
        const persistenceStart = typeof performance !== 'undefined' ? performance.now() : 0;
        try {
          await persistOfflineCartWritePlan(prepared);
          const indexedDbSaveMs = typeof performance !== 'undefined' ? performance.now() - persistenceStart : 0;
          const renderMs = endPerfMeasure('offline-pos:add-to-cart', totalStart) - articleLookupMs - fefoSelectionMs - cartUpdateMs - indexedDbSaveMs;
          addToCartMetricsRef.current = {
            ARTICLE_LOOKUP_MS: Number(articleLookupMs.toFixed(2)),
            FEFO_SELECTION_MS: Number(fefoSelectionMs.toFixed(2)),
            CART_UPDATE_MS: Number(cartUpdateMs.toFixed(2)),
            INDEXEDDB_SAVE_MS: Number(indexedDbSaveMs.toFixed(2)),
            RENDER_MS: Number(Math.max(0, renderMs).toFixed(2)),
            TOTAL_ADD_TO_CART_MS: Number((articleLookupMs + fefoSelectionMs + cartUpdateMs + indexedDbSaveMs + Math.max(0, renderMs)).toFixed(2)),
          };
          setSaveLabel('SAVED');
        } catch (error) {
          setSaveLabel('ERROR');
          setMessage(mapOfflineError(error));
          await refresh(prepared.cart.cartId);
        }
      })();
    } catch (error) {
      setSaveLabel('ERROR');
      setMessage(mapOfflineError(error));
      setBusyAction(null);
    }
  }

  async function handleQuantityChange(item: OfflineCart['items'][number], nextQuantity: number) {
    if (!cart) return;
    setBusyAction('ITEM');
    setSaveLabel('SAVING');
    try {
      const prepared = prepareOfflineCartItemUpdateWithContext({
        cartId: cart.cartId,
        articleId: item.articleId,
        replaceQuantity: nextQuantity,
      }, cartContext);
      updateLocalCartState(prepared.cart, prepared.mergedReservations);
      setMessage(`${item.articleName} mis a jour localement.`);
      await persistOfflineCartWritePlan(prepared);
      setSaveLabel('SAVED');
    } catch (error) {
      setSaveLabel('ERROR');
      setMessage(mapOfflineError(error));
      await refresh(cart.cartId);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSelectCustomer(customer: OfflinePosCustomer | null) {
    if (!cart) return;
    setBusyAction('CUSTOMER');
    setSaveLabel('SAVING');
    try {
      const updated = await updateOfflineCartCustomer(cart.cartId, customer);
      setCustomerQuery('');
      setCustomerOpen(false);
      setMessage(`Client du brouillon: ${updated.customerNameSnapshot ?? 'Client comptoir'}.`);
      await refresh(updated.cartId);
      setTimeout(() => articleInputRef.current?.focus(), 0);
    } catch (error) {
      setSaveLabel('ERROR');
      setMessage(mapOfflineError(error));
    } finally {
      setBusyAction(null);
    }
  }

  function handleNoteChange(value: string) {
    setNoteDraft(value);
    if (!cart) return;
    setSaveLabel('SAVING');
    if (noteSaveTimer.current) window.clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = window.setTimeout(async () => {
      setBusyAction('NOTE');
      try {
        await setOfflineCartNote(cart.cartId, value);
        await refresh(cart.cartId);
      } catch (error) {
        setSaveLabel('ERROR');
        setMessage(mapOfflineError(error));
      } finally {
        setBusyAction(null);
      }
    }, 350);
  }

  async function handleNewDraft() {
    setBusyAction('NEW');
    try {
      const next = await createNewOfflineCart();
      setMessage(`Nouveau brouillon ${next.offlineReference} cree localement.`);
      resetForNextSale();
      await refresh(next.cartId);
      setTimeout(() => articleInputRef.current?.focus(), 0);
    } catch (error) {
      setMessage(mapOfflineError(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleFinalizeOfflineSale() {
    if (!cart || busyAction !== null || !canFinalizeOfflineSale) {
      if (checkoutDisabledReason) setMessage(checkoutDisabledReason);
      focusCheckoutBlockingField();
      return;
    }
    setBusyAction('CHECKOUT');
    try {
      const result = await finalizeOfflineCashSale(cart.cartId, {
        amountPaidUsd: Number(amountPaidUsd || 0),
        amountPaidCdf: Number(amountPaidCdf || 0),
        amountReturnedUsd: Number(amountReturnedUsd || 0),
        amountReturnedCdf: Number(amountReturnedCdf || 0),
        note: noteDraft,
      });
      await notifyOfflineSaleQueued();
      resetForNextSale();
      flushSync(() => {
        setLastReceiptSale(result.sale);
      });
      setMessage(`Vente offline ${result.sale.offlineReference} validee localement. Ticket pret a imprimer.`);
      try {
        printOfflineReceipt({
          sale: result.sale,
          siteName: workstation?.siteName ?? null,
          sellerName: auth?.displayName ?? null,
          workstationName: workstation?.workstationName ?? null,
        });
      } catch {
        setMessage('Vente enregistree. Impression impossible. Vous pouvez reimprimer le ticket.');
      }
      await refresh(null);
      setTimeout(() => articleInputRef.current?.focus(), 0);
    } catch (error) {
      setMessage(mapOfflineSellerMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleClearCart() {
    if (!cart || cart.items.length === 0) return;
    setBusyAction('ITEM');
    try {
      for (const item of cart.items) {
        await addOrIncrementOfflineCartItem({
          cartId: cart.cartId,
          articleId: item.articleId,
          replaceQuantity: 0,
        });
      }
      setMessage('Panier vide localement.');
      await refresh(cart.cartId);
    } catch (error) {
      setMessage(mapOfflineError(error));
    } finally {
      setBusyAction(null);
    }
  }

  function applyExactPayment() {
    if (!cart) return;
    if (Number(amountPaidUsd || 0) > 0 && Number(amountPaidCdf || 0) > 0) {
      setMessage('Un paiement mixte est deja saisi. Ajustez les montants sans les ecraser.');
      return;
    }
    if (isPrimaryCdfCurrency()) {
      setAmountPaidUsd('');
      setAmountPaidCdf(String(amountDueCdf));
    } else {
      setAmountPaidUsd((cart.patientShareUsd ?? cartTotal).toFixed(2));
      setAmountPaidCdf('');
    }
    setAmountReturnedUsd('');
    setAmountReturnedCdf('');
    returnedValuesAutofilledRef.current = true;
  }

  async function handleSelectSaleType(nextSaleType: 'CASH' | 'INSURANCE') {
    if (!cart) return;
    if (nextSaleType === cart.saleType) return;
    setBusyAction('CUSTOMER');
    try {
      const updated = await updateOfflineCartSaleConfiguration(cart.cartId, { saleType: nextSaleType });
      setMessage(
        nextSaleType === 'INSURANCE'
          ? updated.customerId
            ? 'Vente assurance active. Selectionnez une mutuelle du client.'
            : 'Vente assurance active. Selectionnez un client assure.'
          : 'Type de vente offline: Cash.',
      );
      await refresh(updated.cartId);
    } catch (error) {
      setMessage(mapOfflineError(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSelectSaleMode(nextSaleMode: 'IMMEDIATE' | 'ADVANCE') {
    if (!cart) return;
    if (nextSaleMode === cart.saleMode) return;
    setBusyAction('CUSTOMER');
    try {
      const updated = await updateOfflineCartSaleConfiguration(cart.cartId, { saleMode: nextSaleMode });
      setMessage(
        nextSaleMode === 'ADVANCE'
          ? 'Paiement en avance offline actif: la vente est encaissee maintenant et livree plus tard.'
          : 'Mode de vente offline: Vente immediate.',
      );
      await refresh(updated.cartId);
    } catch (error) {
      setMessage(mapOfflineError(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSelectMembership(membershipId: string | null) {
    if (!cart) return;
    setBusyAction('CUSTOMER');
    try {
      const updated = await updateOfflineCartSaleConfiguration(cart.cartId, { membershipId });
      setMessage(membershipId ? 'Mutuelle offline appliquee au brouillon local.' : 'Mutuelle retiree du brouillon local.');
      await refresh(updated.cartId);
    } catch (error) {
      setMessage(mapOfflineError(error));
    } finally {
      setBusyAction(null);
    }
  }

  function handlePrintReceipt() {
    if (!lastReceiptSale) return;
    try {
      printOfflineReceipt({
        sale: lastReceiptSale,
        siteName: workstation?.siteName ?? null,
        sellerName: auth?.displayName ?? null,
        workstationName: workstation?.workstationName ?? null,
      });
    } catch {
      setMessage('Vente enregistree. Impression impossible. Vous pouvez reimprimer le ticket.');
    }
  }

  if (!pageModel || !cart) {
    const actionRequired = initState === 'ACTION_REQUIRED';
    const revoked = initState === 'REVOKED';
    const offlineReady = initState === 'OFFLINE_READY';
    const hasError = initState === 'ERROR';
    return (
      <section className="offline-page">
        <header className="page-heading">
          <div>
            <span className="breadcrumb">POS</span>
            <h1>POS</h1>
            <p>
              {revoked
                ? 'Le poste a ete revoque. Les nouvelles ventes hors ligne sont bloquees.'
                : actionRequired
                  ? 'Le poste a besoin d une preparation ou d une verification automatique.'
                  : offlineReady
                    ? 'Le poste reste disponible hors ligne avec les donnees locales deja preparees.'
                    : hasError
                      ? 'Impossible d initialiser le POS.'
                      : 'Preparation automatique du POS en cours.'}
            </p>
          </div>
        </header>
        {initState === 'LOADING' ? (
          <p className="loading-state">Chargement du POS...</p>
        ) : (
          <section className="card offline-panel offline-setup-required">
            <h2>
              {revoked
                ? 'Action requise'
                : actionRequired
                  ? 'Preparation incomplete'
                  : offlineReady
                    ? 'POS pret hors ligne'
                    : 'Initialisation impossible'}
            </h2>
            <p>
              {revoked
                ? initError || 'Le poste n est plus autorise. Contactez un responsable.'
                : actionRequired
                  ? initError || 'La preparation automatique n a pas pu aboutir pour le moment.'
                  : offlineReady
                    ? initError || 'Le poste peut continuer a vendre hors ligne avec le dernier snapshot disponible.'
                    : initError || 'Une erreur locale empeche le demarrage du POS.'}
            </p>
            <div className="offline-panel-actions">
              {actionRequired || revoked ? (
                <Link className="ghost-button compact-button" to="/offline-admin/workstations">
                  Ouvrir le support offline
                </Link>
              ) : null}
              <button className="ghost-button compact-button" type="button" onClick={() => void refresh(selectedCartId)}>
                Reessayer
              </button>
            </div>
          </section>
        )}
      </section>
    );
  }

  return (
    <OfflineWorkspaceLayout
      mode="seller"
      viewModel={viewModel}
      syncEngine={syncEngine}
      cashSession={snapshot.cashSession}
      title="POS"
      exitTo="/reports/dashboard"
      topActions={(
        <Link className="ghost-button compact-button" to="/offline/drafts">
          Brouillons
        </Link>
      )}
    >
      <section className="offline-page offline-pos-page offline-pos-page-fixed">
        <OfflineNetworkBanner viewModel={viewModel} syncEngine={syncEngine} />

        <section className="card offline-panel offline-pos-summary-strip">
          <span className={`badge compact-badge ${cart.status === 'READY' ? 'badge-success' : cart.status === 'BLOCKED' ? 'badge-danger' : 'badge-warning'}`}>
            {formatOfflineCartStatus(cart.status)}
          </span>
          <span className={`badge compact-badge ${saveLabel === 'ERROR' ? 'badge-danger' : saveLabel === 'SAVING' ? 'badge-warning' : 'badge-success'}`}>
            {saveLabel === 'SAVING' ? 'Enregistrement...' : saveLabel === 'ERROR' ? 'Erreur locale' : 'Enregistre localement'}
          </span>
          <span className="offline-pos-summary-field">
            <small>Vente</small>
            <strong>{formatSaleReference(cart.offlineReference)}</strong>
          </span>
          <span className="offline-pos-summary-field">
            <small>Poste</small>
            <strong>{workstation?.workstationName ?? '-'}</strong>
          </span>
          <span className="offline-pos-summary-field">
            <small>Site</small>
            <strong>{formatSiteLabel(workstation?.siteName ?? workstation?.siteId ?? '-')}</strong>
          </span>
          <span className="offline-pos-summary-field">
            <small>Devise</small>
            <strong>{cart.currency}</strong>
          </span>
          <span className="offline-pos-summary-field">
            <small>Taux local</small>
            <strong>{settings?.exchangeRate?.rate ? `1 USD = ${Number(settings.exchangeRate.rate).toLocaleString('fr-FR')} FC` : '-'}</strong>
          </span>
        </section>

        <section className="offline-pos-grid offline-pos-grid-premium offline-pos-grid-fullscreen">
          <aside className="offline-pos-cart-column">
            <section className="card offline-panel offline-cart-panel offline-cart-panel-premium offline-cart-panel-fullscreen offline-cart-panel-accent">
              <div className="offline-panel-heading offline-cart-panel-heading">
                <h3>Panier ({cart.itemCount})</h3>
              </div>
              <button className="ghost-button compact-button offline-cart-clear-button" type="button" onClick={() => void handleClearCart()} disabled={busyAction !== null || cart.items.length === 0}>
                <TrashIcon />
                <span>Vider</span>
              </button>
              {cart.items.length === 0 ? (
                <div className="offline-cart-empty-state">
                  <div className="offline-cart-empty-icon">Panier</div>
                  <strong>Aucun article dans le panier</strong>
                  <p>Scannez ou recherchez un article pour commencer.</p>
                </div>
              ) : (
                <div className="table-wrap offline-cart-table-wrap offline-cart-table-wrap-fullscreen">
                  <table className="data-table offline-cart-table offline-cart-table-compact">
                    <thead>
                      <tr>
                        <th>Article / lot</th>
                        <th>Qte</th>
                        <th>PU</th>
                        <th>Total</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.items.map((item) => (
                        <tr key={item.localItemId}>
                          <td>
                            <strong>{formatDisplayArticleName(item.articleName, item.articleCode)}</strong>
                            <div className="offline-row-meta">{formatLotLabel(item.lotAllocations[0]?.lotNumber ?? item.articleCode)}</div>
                          </td>
                          <td>
                            <input
                              aria-label={`Quantite ${formatDisplayArticleName(item.articleName, item.articleCode)}`}
                              className="offline-cart-qty-input"
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(event) => {
                                const nextQuantity = Number.parseInt(event.target.value || '0', 10);
                                if (Number.isFinite(nextQuantity) && nextQuantity >= 0 && nextQuantity !== item.quantity) {
                                  void handleQuantityChange(item, nextQuantity);
                                }
                              }}
                            />
                          </td>
                          <td>{formatMoney(item.unitPriceSnapshot, cart.currency)}</td>
                          <td>{formatMoney(item.lineTotal, cart.currency)}</td>
                          <td>
                            <button
                              aria-label="Retirer l article"
                              className="ghost-button compact-button row-action-button icon-only danger offline-cart-remove-button"
                              type="button"
                              onClick={() => void handleQuantityChange(item, 0)}
                              disabled={busyAction !== null}
                              title="Retirer l article"
                            >
                              <TrashIcon />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="offline-cart-footer">
                <div>
                  <strong>{cart.itemCount}</strong>
                  <span>article(s)</span>
                </div>
                <div>
                  <strong>{formatMoney(cart.total, 'USD')}</strong>
                  <span>{settings?.exchangeRate?.rate ? `${Math.round(cart.total * settings.exchangeRate.rate).toLocaleString('fr-FR')} FC` : '-'}</span>
                </div>
              </div>
            </section>
          </aside>

          <div className="offline-pos-left offline-pos-center-column">
            {cart.blockedReasons.length > 0 ? (
              <section className="card offline-panel offline-pos-alert-strip">
                <div className="offline-warning-list">
                  {cart.blockedReasons.map((reason) => <p key={reason}>{reason}</p>)}
                </div>
              </section>
            ) : null}

            <section className="offline-pos-control-grid">
              <section className="card offline-panel offline-client-card">
                <div className="offline-panel-heading">
                  <h3>Client</h3>
                </div>
                <FloatingSearchPopover
                  columns={[
                    { header: 'Code', render: (item: OfflinePosCustomer) => item.customerCode },
                    { header: 'Nom', render: (item: OfflinePosCustomer) => <strong>{item.name}</strong> },
                    { header: 'Telephone', render: (item: OfflinePosCustomer) => item.phone ?? '-' },
                  ]}
                  getKey={(item) => item.customerId}
                  inputRef={customerInputRef}
                  open={customerOpen}
                  value={customerQuery}
                  placeholder={cart.customerNameSnapshot ?? 'Client comptoir'}
                  searchPlaceholder="Nom, code ou telephone"
                  suggestions={customerResults}
                  emptyText="Aucun client local disponible"
                  onOpen={() => setCustomerOpen(true)}
                  onClose={() => setCustomerOpen(false)}
                  onChange={setCustomerQuery}
                  onSelect={(item) => void handleSelectCustomer(item)}
                />
              </section>

              <section className="card offline-panel offline-choice-card">
                <div className="offline-panel-heading"><h3>Type de vente</h3></div>
                <div className="offline-segmented-control">
                  <button
                    type="button"
                    className={cart.saleType === 'CASH' ? 'is-active' : ''}
                    onClick={() => handleSelectSaleType('CASH')}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    className={cart.saleType === 'INSURANCE' ? 'is-active' : ''}
                    onClick={() => handleSelectSaleType('INSURANCE')}
                  >
                    Assurance
                  </button>
                </div>
                <small className="offline-choice-hint">
                  {cart.saleType === 'INSURANCE'
                    ? selectedMembership
                      ? `Couverture locale: ${Number(selectedMembership.coveragePercent ?? 0).toLocaleString('fr-FR')} %.`
                      : 'Selectionnez une mutuelle active du client.'
                    : 'Flux comptoir rapide actif sur ce brouillon.'}
                </small>
              </section>

              <section className="card offline-panel offline-choice-card">
                <div className="offline-panel-heading"><h3>Mode de vente</h3></div>
                <div className="offline-segmented-control">
                  <button
                    type="button"
                    className={cart.saleMode === 'IMMEDIATE' ? 'is-active' : ''}
                    onClick={() => handleSelectSaleMode('IMMEDIATE')}
                  >
                    Vente immediate
                  </button>
                  <button
                    type="button"
                    className={cart.saleMode === 'ADVANCE' ? 'is-active' : ''}
                    onClick={() => handleSelectSaleMode('ADVANCE')}
                  >
                    Paiement en avance
                  </button>
                </div>
                <small className="offline-choice-hint">
                  {cart.saleMode === 'ADVANCE'
                    ? 'Encaissement maintenant, stock sorti plus tard a la confirmation de retrait.'
                    : 'Livraison immediate sur le stock local du poste.'}
                </small>
              </section>

              <section className="card offline-panel offline-choice-card">
                <div className="offline-panel-heading"><h3>Assurance / Mutuelle</h3></div>
                <select
                  ref={membershipInputRef}
                  className="input compact-input"
                  disabled={cart.saleType !== 'INSURANCE'}
                  value={cart.membershipId ?? ''}
                  title={cart.saleType !== 'INSURANCE' ? 'Passez le type de vente a Assurance pour selectionner une mutuelle.' : undefined}
                  onChange={(event) => void handleSelectMembership(event.target.value || null)}
                >
                  <option value="">
                    {cart.saleType !== 'INSURANCE'
                      ? 'Disponible en mode Assurance'
                      : !cart.customerId
                        ? 'Selectionnez d abord un client'
                        : insuranceMemberships.length === 0
                          ? 'Aucune mutuelle locale active'
                          : 'Selectionner une mutuelle'}
                  </option>
                  {insuranceMemberships.map((membership: OfflineCustomerMembership) => (
                    <option key={membership.membershipId} value={membership.membershipId}>
                      {formatInsuranceMembershipLabel(membership)}
                    </option>
                  ))}
                </select>
                <small className="offline-choice-hint">
                  {cart.saleType === 'INSURANCE'
                    ? selectedMembership
                      ? `Part patient ${formatMoney(cart.patientShareUsd, 'USD')} / part assurance ${formatMoney(cart.insuranceShareUsd, 'USD')}.`
                      : 'Le snapshot local embarque les mutuelles actives du client selectionne.'
                    : 'Ce select reste inactif tant que le type Cash est choisi.'}
                </small>
              </section>
            </section>

              <section className="card offline-panel offline-search-card">
                <div className="offline-panel-heading">
                  <div>
                    <h3>Rechercher un article</h3>
                    <span className="offline-row-meta">Scannez un code-barres ou tapez un nom/code. F2 ramene le focus.</span>
                  </div>
                </div>
              <div className="offline-local-search">
                <input
                  ref={articleInputRef}
                  className="input compact-input offline-local-search-input"
                  type="search"
                  value={articleQuery}
                  placeholder="Scanner code-barres ou rechercher article..."
                  role="combobox"
                  aria-expanded={articleOpen && articleQuery.trim().length >= 1}
                  aria-controls="offline-article-results"
                  onFocus={() => setArticleOpen(articleQuery.trim().length >= 1)}
                  onChange={(event) => handleArticleQueryChange(event.target.value)}
                  onKeyDown={handleArticleSearchKeyDown}
                />
                {articleOpen && articleQuery.trim().length >= 1 && (
                  <div className="offline-local-search-results" id="offline-article-results" role="listbox">
                    {articleResults.length === 0 && (
                      <div className="offline-local-search-empty">Aucun article local disponible</div>
                    )}
                    {articleResults.map((result, index) => (
                      <button
                        className={`offline-local-search-option ${index === articleHighlightedIndex ? 'selected' : ''} ${result.status !== 'READY' ? 'is-disabled' : ''}`}
                        type="button"
                        key={result.article.articleId}
                        role="option"
                        aria-selected={index === articleHighlightedIndex}
                        disabled={result.status !== 'READY'}
                        onMouseEnter={() => setArticleHighlightedIndex(index)}
                        onClick={() => void handleSelectArticle(result, 1)}
                      >
                        <span>
                          <strong>{formatDisplayArticleName(result.article.commercialName, result.article.articleCode)}</strong>
                          <small>{formatDisplayCode(result.article.articleCode)}</small>
                        </span>
                        <span>{result.unitPrice ? formatMoney(result.unitPrice, cart.currency) : '-'}</span>
                        <span>{getArticleResultStatusLabel(result)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="offline-search-help">
                <span>Le lot FEFO est applique automatiquement.</span>
                <span>Entrer = selectionner, F4 = paiement, F8 = encaisser.</span>
              </div>

              <div className="offline-pos-footer-actions">
                <button className="ghost-button compact-button offline-draft-save-button" type="button" onClick={() => setMessage('Le brouillon est deja enregistre localement.')} disabled={busyAction !== null}>
                  Enregistrer au brouillon
                </button>
                <button className="ghost-button compact-button offline-cancel-button" type="button" onClick={() => void handleClearCart()} disabled={busyAction !== null || cart.items.length === 0}>
                  Annuler la vente
                </button>
              </div>
            </section>
          </div>

          <aside className="offline-pos-right offline-pos-right-premium offline-pos-payment-column">
            <section className="card offline-panel offline-payment-hero">
              <div className="offline-payment-hero-label">Total a payer</div>
              <div className="offline-payment-hero-amount">{formatMoney(cart.patientShareUsd, 'USD')}</div>
              <div className="offline-payment-hero-fc">
                {settings?.exchangeRate?.rate ? `${Math.round(cart.patientShareUsd * settings.exchangeRate.rate).toLocaleString('fr-FR')} FC` : '-'}
              </div>
            </section>

            <section className="card offline-panel offline-payment-card">
              <div className="offline-payment-settlement-card">
                <div className="offline-panel-heading offline-payment-card-heading">
                  <h3>Reglement</h3>
                </div>
                <button className="ghost-button compact-button offline-payment-exact-button" type="button" onClick={applyExactPayment}>
                  Paiement exact
                </button>
                <div className="detail-grid compact-detail-grid">
                  <label>
                    <span>PAYE USD</span>
                    <input ref={amountPaidUsdRef} className="input compact-input" type="number" min="0" step="0.01" value={amountPaidUsd} onChange={(event) => handlePaidUsdChange(event.target.value)} />
                  </label>
                  <label>
                    <span>PAYE FC</span>
                    <input ref={amountPaidCdfRef} className="input compact-input" type="number" min="0" step="1" value={amountPaidCdf} onChange={(event) => handlePaidCdfChange(event.target.value)} />
                  </label>
                </div>
                <div className="detail-grid compact-detail-grid">
                  <label>
                    <span>A RENDRE USD</span>
                    <input className="input compact-input" type="text" value={formatMoney(settlementPreview.suggestedChangeUsd, 'USD')} readOnly />
                  </label>
                  <label>
                    <span>A RENDRE FC</span>
                    <input className="input compact-input" type="text" value={`${Math.round(settlementPreview.suggestedChangeCdf).toLocaleString('fr-FR')} FC`} readOnly />
                  </label>
                </div>
                <div className="detail-grid compact-detail-grid">
                  <label>
                    <span>Rendu USD</span>
                    <input ref={amountReturnedUsdRef} className="input compact-input" type="number" min="0" step="0.01" value={amountReturnedUsd} onChange={(event) => handleReturnedUsdChange(event.target.value)} />
                  </label>
                  <label>
                    <span>Rendu FC</span>
                    <input ref={amountReturnedCdfRef} className="input compact-input" type="number" min="0" step="1" value={amountReturnedCdf} onChange={(event) => handleReturnedCdfChange(event.target.value)} />
                  </label>
                </div>
              </div>
              <div className="offline-payment-readonly">
                <h4>Informations</h4>
                <div className="offline-payment-readonly-row">
                  <span>Part patient</span>
                  <strong>{formatMoney(cart.patientShareUsd, 'USD')}</strong>
                  <strong>{settings?.exchangeRate?.rate ? `${Math.round(cart.patientShareUsd * settings.exchangeRate.rate).toLocaleString('fr-FR')} FC` : '-'}</strong>
                </div>
                <div className="offline-payment-readonly-row">
                  <span>Part assurance</span>
                  <strong>{formatMoney(cart.insuranceShareUsd, 'USD')}</strong>
                  <strong>{settings?.exchangeRate?.rate ? `${Math.round(cart.insuranceShareUsd * settings.exchangeRate.rate).toLocaleString('fr-FR')} FC` : '-'}</strong>
                </div>
              </div>
              <label className="offline-payment-note">
                <span>NOTE</span>
                <textarea
                  className="input compact-input offline-note-input"
                  rows={3}
                  value={noteDraft}
                  onChange={(event) => handleNoteChange(event.target.value)}
                />
              </label>
              {requiresCashSessionForSettlement && !canAttachOfflineCashSale(snapshot.cashSession) ? (
                <div className="offline-warning-text">
                  {snapshot.cashSession
                    ? 'La session locale restauree n est pas encore utilisable pour encaisser. Ouvrez ou reprenez une caisse offline active.'
                    : 'Ouvrez la caisse avant d encaisser une vente.'}
                </div>
              ) : null}
              {lastReceiptSale ? (
                <div className="offline-panel-actions">
                  <button className="ghost-button compact-button" type="button" onClick={handlePrintReceipt}>
                    Imprimer ticket
                  </button>
                </div>
              ) : null}
              {!canFinalizeOfflineSale && checkoutDisabledReason ? (
                <div className="offline-warning-text" role="status">
                  {checkoutDisabledReason}
                </div>
              ) : null}
              <button className="button compact-button offline-checkout-button offline-checkout-button-inline offline-payment-checkout-button" type="button" onClick={() => void handleFinalizeOfflineSale()} disabled={busyAction !== null || !canFinalizeOfflineSale}>
                <span>{busyAction === 'CHECKOUT' ? 'ENCAISSEMENT...' : 'ENCAISSER'}</span>
                <span className="offline-checkout-shortcut">F8</span>
              </button>
            </section>
          </aside>
        </section>
      </section>
      <OfflineReceiptTicket
        sale={lastReceiptSale}
        siteName={workstation?.siteName ?? null}
        sellerName={auth?.displayName ?? null}
        workstationName={workstation?.workstationName ?? null}
      />
    </OfflineWorkspaceLayout>
  );
}

function authorizationLabel(status: ReturnType<typeof calculateAuthorizationState>) {
  if (status === 'AUTHORIZED') return 'Poste autorise';
  if (status === 'REVOKED') return 'Poste revoque';
  return 'Poste non autorise';
}

function formatSyncEngineStatus(status: ReturnType<typeof useSyncEngine>['currentStatus']) {
  switch (status) {
    case 'CHECKING':
      return 'Verification';
    case 'SYNCING':
      return 'Synchronisation';
    case 'BACKOFF':
      return 'Reprise differee';
    case 'OFFLINE':
      return 'Hors ligne';
    case 'DEGRADED':
      return 'Degrade';
    case 'CONFLICT':
      return 'Conflit';
    case 'ERROR':
      return 'Erreur';
    default:
      return 'Pret';
  }
}

function renderSyncSummary(syncEngine: ReturnType<typeof useSyncEngine>) {
  if (syncEngine.currentStatus === 'SYNCING') {
    return `Synchronisation en cours. ${syncEngine.pendingCount} operation(s) encore en attente.`;
  }
  if (syncEngine.currentStatus === 'OFFLINE') {
    return `Hors ligne - ${syncEngine.pendingCount} operation(s) en attente.`;
  }
  if (syncEngine.currentStatus === 'DEGRADED' || syncEngine.currentStatus === 'BACKOFF') {
    return syncEngine.nextRetryAt
      ? `Backend indisponible, reprise automatique prevue vers ${formatDateTime(syncEngine.nextRetryAt)}.`
      : 'Backend indisponible, reprise automatique active.';
  }
  if (syncEngine.conflictCount > 0) {
    return `${syncEngine.conflictCount} conflit(s) necessitent une verification responsable.`;
  }
  if (syncEngine.pendingCount > 0) {
    return `${syncEngine.pendingCount} operation(s) restent a synchroniser.`;
  }
  return 'Tout est synchronise ou pret a etre synchronise automatiquement.';
}

function formatDisplayCode(code: string) {
  const normalized = code.replace(/^OFF-STG-(FIELD-|FLD-)?/i, '');
  const compact = normalized.split('-').filter(Boolean).join('-');
  return compact.length > 18 ? compact.slice(-18) : compact;
}

function formatInsuranceMembershipLabel(membership: OfflineCustomerMembership) {
  const plan = membership.planName?.trim();
  const organization = membership.organizationName?.trim();
  const number = membership.memberNumber?.trim() || membership.employeeNumber?.trim();
  const segments = [
    plan || organization || 'Mutuelle',
    number ? `#${number}` : null,
    membership.coveragePercent !== null && membership.coveragePercent !== undefined
      ? `${Number(membership.coveragePercent).toLocaleString('fr-FR')} %`
      : null,
  ].filter(Boolean);
  return segments.join(' - ');
}

function formatDisplayArticleName(name: string, fallbackCode?: string) {
  const normalized = name.replace(/^OFF-STG[\s-]*(FIELD|FLD)?[\s-]*/i, '').trim();
  if (!normalized) return fallbackCode ? formatDisplayCode(fallbackCode) : name;
  return normalized.replace(/\s{2,}/g, ' ');
}

function formatSaleReference(reference: string) {
  const normalized = reference.replace(/^OFF-/i, '');
  return normalized.length > 16 ? normalized.slice(0, 16) : normalized;
}

function formatLotLabel(value: string) {
  const compact = value.replace(/^OFF-STG-(FIELD-|FLD-)?/i, '');
  return `Lot ${compact.length > 16 ? compact.slice(-16) : compact}`;
}

function TrashIcon() {
  return <svg aria-hidden="true" className="row-action-icon" focusable="false" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M9 10v8M15 10v8M6 6l1 14h10l1-14" /></svg>;
}

function formatSiteLabel(value: string) {
  return value.replace(/^OFF-STG\s+/i, '');
}
