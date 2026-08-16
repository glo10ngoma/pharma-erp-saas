import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { FloatingSearchPopover } from '../../components/FloatingSearchPopover';
import { formatDate, formatDateTime } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import {
  addOrIncrementOfflineCartItem,
  createNewOfflineCart,
  findCounterCustomer,
  formatOfflineCartStatus,
  formatQuotaAlert,
  getOfflineCartPageModel,
  mapOfflineError,
  searchOfflineArticles,
  searchOfflineCustomers,
  setOfflineCartNote,
  updateOfflineCartCustomer,
  type LocalCatalogSearchResult,
} from './offline-cart';
import {
  buildOfflineCashSettlement,
  finalizeOfflineCashSale,
} from './offline-sale';
import { canAttachOfflineCashSale } from './offline-cash';
import { notifyOfflineSaleQueued, runSync } from './sync-engine';
import { OfflineNetworkBanner, OfflineReceiptTicket, OfflineWorkspaceLayout, mapOfflineSellerMessage, printOfflineReceipt } from './offline-ui';
import {
  calculateAuthorizationState,
  calculateSnapshotFreshness,
  loadLocalSnapshot,
  type OfflineSnapshotViewModel,
} from './offline-bootstrap';
import { type OfflineCart, type OfflinePosCustomer, type OfflineSale } from './offline-types';
import { useSyncEngine } from './useSyncEngine';

type OfflinePageModel = Awaited<ReturnType<typeof getOfflineCartPageModel>>;
type OfflinePosInitState = 'LOADING' | 'SETUP_REQUIRED' | 'READY' | 'RECOVERY_REQUIRED' | 'ERROR';

const emptyViewModel: OfflineSnapshotViewModel = {
  snapshot: {
    articles: [],
    lots: [],
    allocations: [],
    customers: [],
    settings: null,
    auth: null,
    workstation: null,
    cashSession: null,
    syncState: null,
  },
  queue: [],
  syncLog: [],
  conflicts: [],
  authorizationState: 'EXPIRED',
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
  const [message, setMessage] = useState('Le panier offline reste local a ce poste et n envoie aucune vente.');
  const [saveLabel, setSaveLabel] = useState<'SAVED' | 'SAVING' | 'ERROR'>('SAVED');
  const [busyAction, setBusyAction] = useState<'NEW' | 'ITEM' | 'CUSTOMER' | 'NOTE' | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [amountPaidUsd, setAmountPaidUsd] = useState('');
  const [amountPaidCdf, setAmountPaidCdf] = useState('');
  const [lastReceiptSale, setLastReceiptSale] = useState<OfflineSale | null>(null);
  const articleInputRef = useRef<HTMLInputElement | null>(null);
  const customerInputRef = useRef<HTMLInputElement | null>(null);
  const amountPaidCdfRef = useRef<HTMLInputElement | null>(null);
  const noteSaveTimer = useRef<number | null>(null);
  const syncEngine = useSyncEngine();

  async function refresh(cartId?: string | null) {
    setInitState('LOADING');
    setInitError('');
    try {
      const [localView, cartView] = await Promise.all([
        loadLocalSnapshot(),
        getOfflineCartPageModel(cartId ?? selectedCartId),
      ]);
      setViewModel(localView);
      setPageModel(cartView);
      setNoteDraft(cartView.cart.note ?? '');
      setSaveLabel('SAVED');
      setInitState('READY');
      const nextCartId = cartView.cart.cartId;
      if (nextCartId !== selectedCartId) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('draft', nextCartId);
        setSearchParams(nextParams, { replace: true });
      }
    } catch (error) {
      setPageModel(null);
      try {
        const localView = await loadLocalSnapshot();
        setViewModel(localView);
        const needsSetup = !localView.snapshot.workstation?.workstationId
          || !localView.snapshot.auth
          || !localView.snapshot.settings
          || localView.snapshot.articles.length === 0;
        const recoveryRequired = localView.snapshotStatus === 'REVOKED'
          || localView.snapshot.syncState?.snapshotStatus === 'REVOKED'
          || String(error instanceof Error ? error.message : error).includes('RECOVERY_REQUIRED');
        setInitState(recoveryRequired ? 'RECOVERY_REQUIRED' : needsSetup ? 'SETUP_REQUIRED' : 'ERROR');
        setInitError(mapOfflineSellerMessage(error));
      } catch (snapshotError) {
        setViewModel(emptyViewModel);
        setInitState('ERROR');
        setInitError(mapOfflineSellerMessage(snapshotError));
      }
    }
  }

  useEffect(() => {
    void refresh(selectedCartId);
  }, [selectedCartId]);

  useEffect(() => () => {
    if (noteSaveTimer.current) window.clearTimeout(noteSaveTimer.current);
  }, []);

  useEffect(() => {
    function handleKeys(event: KeyboardEvent) {
      if (event.key === 'F2') {
        event.preventDefault();
        articleInputRef.current?.focus();
      }
      if (event.key === 'F4') {
        event.preventDefault();
        amountPaidCdfRef.current?.focus();
      }
      if (event.key === 'F8') {
        event.preventDefault();
        if (canFinalizeOfflineSale && busyAction === null) void handleFinalizeOfflineSale();
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

  const articleResults = useMemo(
    () => searchOfflineArticles(snapshot, pageModel?.drafts ?? [], pageModel?.reservations ?? [], articleQuery, 20),
    [articleQuery, pageModel?.drafts, pageModel?.reservations, snapshot],
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
  const authorizationState = calculateAuthorizationState(snapshot.auth);
  const quotaAlert = formatQuotaAlert(quotaSummary.totalAvailable);
  const cartTotal = cart?.total ?? 0;
  const cartExchangeRate = settings?.exchangeRate?.rate ?? cart?.exchangeRateSnapshot ?? null;
  const settlementPreview = buildOfflineCashSettlement({
    totalUsd: cartTotal,
    exchangeRate: cartExchangeRate,
    amountPaidUsd: Number(amountPaidUsd || 0),
    amountPaidCdf: Number(amountPaidCdf || 0),
  });
  const canFinalizeOfflineSale =
    !!cart
    && cart.items.length > 0
    && cart.status !== 'BLOCKED'
    && authorizationState !== 'EXPIRED'
    && canAttachOfflineCashSale(snapshot.cashSession)
    && (settlementPreview.amountPaidUsd > 0 || settlementPreview.amountPaidCdf > 0)
    && settlementPreview.settlementDifferenceUsd >= -0.02;

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
      const updated = await addOrIncrementOfflineCartItem({
        cartId: cart.cartId,
        articleId: result.article.articleId,
        quantityDelta,
      });
      setMessage(`${result.article.commercialName} ajoute au brouillon ${updated.offlineReference}.`);
      setArticleQuery('');
      setArticleOpen(false);
      await refresh(updated.cartId);
      setTimeout(() => articleInputRef.current?.focus(), 0);
    } catch (error) {
      setSaveLabel('ERROR');
      setMessage(mapOfflineError(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleQuantityChange(item: OfflineCart['items'][number], nextQuantity: number) {
    if (!cart) return;
    setBusyAction('ITEM');
    setSaveLabel('SAVING');
    try {
      const updated = await addOrIncrementOfflineCartItem({
        cartId: cart.cartId,
        articleId: item.articleId,
        replaceQuantity: nextQuantity,
      });
      setMessage(`${item.articleName} mis a jour localement.`);
      await refresh(updated.cartId);
    } catch (error) {
      setSaveLabel('ERROR');
      setMessage(mapOfflineError(error));
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
      setArticleQuery('');
      setCustomerQuery('');
      await refresh(next.cartId);
      setTimeout(() => articleInputRef.current?.focus(), 0);
    } catch (error) {
      setMessage(mapOfflineError(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleFinalizeOfflineSale() {
    if (!cart) return;
    setBusyAction('NOTE');
    try {
      const result = await finalizeOfflineCashSale(cart.cartId, {
        amountPaidUsd: Number(amountPaidUsd || 0),
        amountPaidCdf: Number(amountPaidCdf || 0),
        note: noteDraft,
      });
      await notifyOfflineSaleQueued();
      setAmountPaidUsd('');
      setAmountPaidCdf('');
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
    setAmountPaidUsd(cartTotal.toFixed(2));
    setAmountPaidCdf('');
  }

  function addCdfShortcut(amount: number) {
    const current = Number(amountPaidCdf || 0);
    setAmountPaidCdf(String(current + amount));
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
    const setupRequired = initState === 'SETUP_REQUIRED';
    const recoveryRequired = initState === 'RECOVERY_REQUIRED';
    const hasError = initState === 'ERROR';
    return (
      <section className="offline-page">
        <header className="page-heading">
          <div>
            <span className="breadcrumb">Offline</span>
            <h1>POS Offline</h1>
            <p>
              {setupRequired
                ? 'Ce poste doit etre prepare avant d utiliser le POS Offline.'
                : recoveryRequired
                  ? 'Une verification locale est requise avant de continuer les ventes hors ligne.'
                  : hasError
                    ? 'Impossible d initialiser le POS Offline.'
                    : 'Chargement du snapshot local et des brouillons persistants.'}
            </p>
          </div>
        </header>
        {initState === 'LOADING' ? (
          <p className="loading-state">Chargement du POS Offline...</p>
        ) : (
          <section className="card offline-panel offline-setup-required">
            <h2>
              {setupRequired
                ? 'Poste non prepare'
                : recoveryRequired
                  ? 'Verification requise'
                  : 'Initialisation impossible'}
            </h2>
            <p>
              {setupRequired
                ? 'Ce poste doit etre prepare avant d utiliser le POS Offline.'
                : recoveryRequired
                  ? 'Ouvrez la page Poste pour verifier le stockage local, le snapshot et les donnees en attente.'
                  : initError || 'Une erreur locale empeche le demarrage du POS Offline.'}
            </p>
            <div className="offline-panel-actions">
              <Link className="button compact-button" to="/offline/poste">
                Preparer ce poste
              </Link>
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
      title="Point de vente"
      subtitle="Caisse rapide hors ligne, scanner-ready et synchronisation automatique au retour du reseau."
      topActions={(
        <>
          <button className="ghost-button compact-button" type="button" onClick={() => articleInputRef.current?.focus()}>
            Scanner
          </button>
          <Link className="ghost-button compact-button" to="/offline/drafts">
            Brouillons
          </Link>
        </>
      )}
    >
      <section className="offline-page offline-pos-page offline-pos-page-fixed">
        <OfflineNetworkBanner viewModel={viewModel} syncEngine={syncEngine} />

        <section className="offline-kpis offline-kpis-compact">
          <div className="card offline-kpi"><span>Statut</span><strong>{formatOfflineCartStatus(cart.status)}</strong><small>Vente en cours</small></div>
          <div className="card offline-kpi"><span>Articles</span><strong>{cart.itemCount}</strong><small>ligne(s)</small></div>
          <div className="card offline-kpi"><span>Quantite</span><strong>{cart.quantityTotal}</strong><small>unite(s)</small></div>
          <div className="card offline-kpi"><span>Total USD</span><strong>{formatMoney(cart.total, 'USD')}</strong></div>
          <div className="card offline-kpi"><span>Total FC</span><strong>{settings?.exchangeRate?.rate ? `${Math.round(cart.total * settings.exchangeRate.rate).toLocaleString('fr-FR')} FC` : '-'}</strong></div>
        </section>

        <section className="offline-pos-grid offline-pos-grid-premium">
        <div className="offline-pos-left">
          <section className="card offline-panel offline-pos-context offline-pos-context-premium">
            <div className="offline-pos-context-grid">
              <div>
                <span className="offline-caption">Vente</span>
                <strong>{cart.offlineReference}</strong>
              </div>
              <div>
                <span className="offline-caption">Poste</span>
                <strong>{workstation?.workstationName ?? '-'}</strong>
              </div>
              <div>
                <span className="offline-caption">Site</span>
                <strong>{workstation?.siteName ?? workstation?.siteId ?? '-'}</strong>
              </div>
              <div>
                <span className="offline-caption">Devise</span>
                <strong>{cart.currency}</strong>
              </div>
              <div>
                <span className="offline-caption">Taux local</span>
                <strong>{settings?.exchangeRate?.rate ? `1 USD = ${Number(settings.exchangeRate.rate).toLocaleString('fr-FR')} FC` : '-'}</strong>
              </div>
            </div>
            <div className="offline-pos-context-actions">
              <span className={`badge compact-badge ${cart.status === 'READY' ? 'badge-success' : cart.status === 'BLOCKED' ? 'badge-danger' : 'badge-neutral'}`}>
                {formatOfflineCartStatus(cart.status)}
              </span>
              <span className={`badge compact-badge ${saveLabel === 'ERROR' ? 'badge-danger' : saveLabel === 'SAVING' ? 'badge-warning' : 'badge-success'}`}>
                {saveLabel === 'SAVING' ? 'Enregistrement...' : saveLabel === 'ERROR' ? 'Erreur locale' : 'Enregistre localement'}
              </span>
            </div>
            {cart.blockedReasons.length > 0 ? (
              <div className="offline-warning-list">
                {cart.blockedReasons.map((reason) => <p key={reason}>{reason}</p>)}
              </div>
            ) : null}
          </section>

          <section className="offline-pos-control-grid">
            <section className="card offline-panel offline-client-card">
              <div className="offline-panel-heading">
                <h3>Client</h3>
                <button className="ghost-button compact-button" type="button" onClick={() => void handleSelectCustomer(draftCounterCustomer)} disabled={busyAction !== null}>
                  Afficher client
                </button>
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
                <button type="button" className="is-active">Cash</button>
                <button type="button" disabled title="Assurance indisponible sur ce flux hors ligne">Assurance</button>
              </div>
            </section>

            <section className="card offline-panel offline-choice-card">
              <div className="offline-panel-heading"><h3>Mode de vente</h3></div>
              <div className="offline-segmented-control">
                <button type="button" className="is-active">Vente immediate</button>
                <button type="button" disabled title="Paiement en avance indisponible sur ce flux hors ligne">Paiement en avance</button>
              </div>
            </section>

            <section className="card offline-panel offline-choice-card">
              <div className="offline-panel-heading"><h3>Assurance / Mutuelle</h3></div>
              <select className="input compact-input" disabled defaultValue="">
                <option value="">Rechercher une assurance...</option>
              </select>
            </section>
          </section>

          <section className="card offline-panel offline-search-card">
            <div className="offline-panel-heading">
              <div>
                <h3>Rechercher un article</h3>
                <span className="offline-row-meta">Scannez un code-barres ou tapez un nom/code. F2 ramene le focus.</span>
              </div>
              <button className="ghost-button compact-button" type="button" onClick={() => setArticleOpen(true)}>
                Voir tout
              </button>
            </div>
            <FloatingSearchPopover
              columns={[
                { header: 'Article', render: (item: LocalCatalogSearchResult) => <strong>{item.article.commercialName}</strong> },
                { header: 'Code', render: (item: LocalCatalogSearchResult) => item.article.articleCode },
                { header: 'Prix', render: (item: LocalCatalogSearchResult) => item.unitPrice ? formatMoney(item.unitPrice, cart.currency) : '-' },
                { header: 'Stock poste', render: (item: LocalCatalogSearchResult) => item.offlineAvailableQuantity },
              ]}
              getKey={(item) => item.article.articleId}
              inputRef={articleInputRef}
              open={articleOpen}
              value={articleQuery}
              placeholder="Scanner code-barres ou rechercher article..."
              searchPlaceholder="Rechercher localement (nom, code, barcode...)"
              suggestions={articleResults}
              emptyText="Aucun article local disponible"
              onOpen={() => setArticleOpen(true)}
              onClose={() => setArticleOpen(false)}
              onChange={setArticleQuery}
              onSelect={(item) => void handleSelectArticle(item, 1)}
            />
            <div className="offline-search-help">
              <span>Le lot FEFO est applique automatiquement.</span>
              <span>Entrer = selectionner, F4 = paiement, F8 = encaisser.</span>
            </div>
            {articleResults.length > 0 ? (
              <div className="offline-inline-results">
                {articleResults.slice(0, 4).map((result) => (
                  <button
                    key={result.article.articleId}
                    className={`offline-result-chip ${result.status !== 'READY' ? 'is-disabled' : ''}`}
                    type="button"
                    onClick={() => result.status === 'READY' && void handleSelectArticle(result, 1)}
                    disabled={result.status !== 'READY' || busyAction !== null}
                    title={
                      result.status === 'READY'
                        ? `${result.offlineAvailableQuantity} unite(s) offline disponibles`
                        : result.status === 'INACTIVE'
                          ? 'Article inactif'
                          : result.status === 'NO_PRICE'
                            ? 'Prix indisponible'
                            : 'Quota offline epuise'
                    }
                  >
                    <strong>{result.article.articleCode}</strong>
                    <span>{result.article.commercialName}</span>
                    <small>{result.offlineAvailableQuantity} dispo</small>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="offline-pos-footer-actions">
              <button className="ghost-button compact-button offline-draft-save-button" type="button" onClick={() => setMessage('Le brouillon est deja enregistre localement.')} disabled={busyAction !== null}>
                Enregistrer au brouillon
              </button>
              <div className="offline-checkout-actions offline-checkout-actions-premium">
                <button className="ghost-button compact-button" type="button" onClick={() => void handleClearCart()} disabled={busyAction !== null || cart.items.length === 0}>
                  Annuler la vente
                </button>
                <button className="button compact-button offline-checkout-button offline-checkout-button-inline" type="button" onClick={() => void handleFinalizeOfflineSale()} disabled={busyAction !== null || !canFinalizeOfflineSale}>
                  ENCAISSER
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside className="offline-pos-right offline-pos-right-premium">
          <section className="card offline-panel offline-cart-panel offline-cart-panel-premium">
            <div className="offline-panel-heading">
              <h3>Panier ({cart.itemCount})</h3>
              <button className="ghost-button compact-button offline-danger-link" type="button" onClick={() => void handleClearCart()} disabled={busyAction !== null || cart.items.length === 0}>
                Vider
              </button>
            </div>
            {cart.items.length === 0 ? (
              <div className="offline-cart-empty-state">
                <div className="offline-cart-empty-icon">Panier</div>
                <strong>Aucun article dans le panier</strong>
                <p>Scannez ou recherchez un article pour commencer.</p>
              </div>
            ) : (
              <div className="table-wrap offline-cart-table-wrap">
                <table className="data-table offline-cart-table offline-cart-table-compact">
                  <thead>
                    <tr>
                      <th>Article / lot</th>
                      <th>Qte</th>
                      <th>PA USD</th>
                      <th>Total USD</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.items.map((item) => (
                      <tr key={item.localItemId}>
                        <td>
                          <strong>{item.articleName}</strong>
                          <div className="offline-row-meta">{item.lotAllocations[0]?.lotNumber ?? item.articleCode}</div>
                        </td>
                        <td>{item.quantity}</td>
                        <td>{formatMoney(item.unitPriceSnapshot, cart.currency)}</td>
                        <td>{formatMoney(item.lineTotal, cart.currency)}</td>
                        <td>
                          <button
                            className="ghost-button compact-button offline-cart-remove-button"
                            type="button"
                            onClick={() => void handleQuantityChange(item, 0)}
                            disabled={busyAction !== null}
                          >
                            Retirer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card offline-panel offline-payment-hero">
            <div className="offline-payment-hero-label">Total a payer</div>
            <div className="offline-payment-hero-amount">{formatMoney(cart.total, 'USD')}</div>
            <div className="offline-payment-hero-fc">
              {settings?.exchangeRate?.rate ? `${Math.round(cart.total * settings.exchangeRate.rate).toLocaleString('fr-FR')} FC` : '-'}
            </div>
          </section>

          <section className="card offline-panel offline-payment-card">
            <div className="offline-panel-heading">
              <h3>Reglement</h3>
              <button className="ghost-button compact-button" type="button" onClick={applyExactPayment}>
                Paiement exact
              </button>
            </div>
            <div className="detail-grid compact-detail-grid">
              <label>
                <span>Paye USD</span>
                <input className="input compact-input" type="number" min="0" step="0.01" value={amountPaidUsd} onChange={(event) => setAmountPaidUsd(event.target.value)} />
              </label>
              <label>
                <span>Paye FC</span>
                <input ref={amountPaidCdfRef} className="input compact-input" type="number" min="0" step="1" value={amountPaidCdf} onChange={(event) => setAmountPaidCdf(event.target.value)} />
              </label>
            </div>
            <div className="offline-payment-shortcuts">
              {[1, 5, 10, 20].map((amount) => (
                <button key={amount} className="ghost-button compact-button" type="button" onClick={() => addCdfShortcut(amount * 1000)}>
                  +{amount}
                </button>
              ))}
            </div>
            <div className="detail-grid compact-detail-grid">
              <label>
                <span>A rendre USD</span>
                <input className="input compact-input" type="text" value={formatMoney(settlementPreview.suggestedChangeUsd, 'USD')} readOnly />
              </label>
              <label>
                <span>A rendre FC</span>
                <input className="input compact-input" type="text" value={`${Math.round(settlementPreview.suggestedChangeCdf).toLocaleString('fr-FR')} FC`} readOnly />
              </label>
            </div>
            {!canAttachOfflineCashSale(snapshot.cashSession) ? (
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
  if (status === 'VALID') return 'Valide';
  if (status === 'EXPIRING') return 'Expire bientot';
  return 'Expiree';
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
