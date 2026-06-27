import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { FloatingSearchPopover } from '../../components/FloatingSearchPopover';
import { Article, articlesService } from '../../services/articles.service';
import { apiErrorMessage } from '../../services/apiError';
import { cashService } from '../../services/cash.service';
import { insuranceService } from '../../services/insurance.service';
import { lotsService } from '../../services/lots.service';
import { referenceService } from '../../services/reference.service';
import { salesService } from '../../services/sales.service';
import { sitesService } from '../../services/sites.service';
import { stocksService } from '../../services/stocks.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';

type PosForm = {
  siteId: string;
  saleType: 'CASH' | 'INSURANCE';
  customerId: string;
  exchangeRate: string;
  membershipId: string;
};

const initialForm = (): PosForm => ({ siteId: '', saleType: 'CASH', customerId: '', exchangeRate: '1', membershipId: '' });

export function PosPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { currentUser } = useAuth();
  const [form, setForm] = useState<PosForm>(initialForm);
  const [sale, setSale] = useState<any>(null);
  const [articleQuery, setArticleQuery] = useState('');
  const [articlePopoverOpen, setArticlePopoverOpen] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [quantityArticle, setQuantityArticle] = useState<Article | null>(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [selectedLineId, setSelectedLineId] = useState('');
  const [clientError, setClientError] = useState('');
  const [cashMode, setCashMode] = useState(() => localStorage.getItem('posCashMode') === 'true');
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);
  const paymentInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const articles = useQuery({ queryKey: ['articles', 'pos'], queryFn: async () => (await articlesService.getAll({ limit: 100 })).data.items });
  const lots = useQuery({ queryKey: ['lots', 'pos'], queryFn: async () => (await lotsService.getAll()).data });
  const stocks = useQuery({ queryKey: ['stocks', 'pos'], queryFn: async () => (await stocksService.getAll()).data });
  const customers = useQuery({ queryKey: ['customers'], queryFn: async () => (await referenceService.customers.getAll()).data });
  const memberships = useQuery({ queryKey: ['customer-memberships', form.customerId], queryFn: async () => (await insuranceService.memberships.getByCustomer(form.customerId)).data, enabled: Boolean(form.customerId) });
  const currentCashSession = useQuery({ queryKey: ['cash-current', form.siteId], queryFn: async () => (await cashService.getCurrentSession(form.siteId)).data, enabled: Boolean(form.siteId) });

  const currentSite = useMemo(() => (sites.data ?? []).find((site) => site.siteId === form.siteId), [form.siteId, sites.data]);
  const sellableLotById = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return new Map((lots.data ?? [])
      .filter((lot) => !lot.isBlocked && String(lot.expiryDate).slice(0, 10) > today)
      .map((lot) => [lot.lotId, lot]));
  }, [lots.data]);
  const sellableStocks = useMemo(() => (stocks.data ?? []).filter((stock) => {
    if (form.siteId && stock.siteId !== form.siteId) return false;
    if (Number(stock.quantityAvailable ?? 0) <= 0) return false;
    return sellableLotById.has(stock.lotId);
  }), [form.siteId, sellableLotById, stocks.data]);
  const stockByArticle = useMemo(() => {
    const map = new Map<string, number>();
    for (const stock of sellableStocks) map.set(stock.articleId, (map.get(stock.articleId) ?? 0) + Number(stock.quantityAvailable ?? 0));
    return map;
  }, [sellableStocks]);
  const fefoByArticle = useMemo(() => {
    const map = new Map<string, { lot: string; expiry: string }>();
    const rows = [...sellableStocks].sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)));
    for (const stock of rows) if (!map.has(stock.articleId)) map.set(stock.articleId, { lot: stock.lotNumber, expiry: stock.expiryDate });
    return map;
  }, [sellableStocks]);
  const posArticles = useMemo<Article[]>(() => {
    const articleById = new Map((articles.data ?? []).map((article) => [article.articleId, article]));
    const rows = new Map<string, Article>();
    for (const stock of sellableStocks) {
      const article = articleById.get(stock.articleId);
      if (rows.has(stock.articleId)) continue;
      rows.set(stock.articleId, {
        articleId: stock.articleId,
        articleCode: article?.articleCode ?? stock.articleCode ?? '',
        commercialName: article?.commercialName ?? stock.commercialName ?? '',
        dci: article?.dci ?? null,
        barcode: article?.barcode ?? null,
        categoryId: article?.categoryId ?? null,
        subCategoryId: article?.subCategoryId ?? null,
        formId: article?.formId ?? null,
        routeId: article?.routeId ?? null,
        productTypeId: article?.productTypeId ?? null,
        dosage: article?.dosage ?? null,
        atcCode: article?.atcCode ?? null,
        prescriptionRequired: article?.prescriptionRequired ?? false,
        defaultStockMin: article?.defaultStockMin ?? Number(stock.stockMin ?? 0),
        defaultStockMax: article?.defaultStockMax ?? Number(stock.stockMax ?? 0),
        isActive: article?.isActive ?? true,
        stockAvailable: stockByArticle.get(stock.articleId) ?? 0,
        sellingPrice: article?.sellingPrice ?? sellableLotById.get(stock.lotId)?.sellingPrice ?? 0,
      });
    }
    return Array.from(rows.values()).sort((a, b) => a.commercialName.localeCompare(b.commercialName));
  }, [articles.data, sellableLotById, sellableStocks, stockByArticle]);
  const articleSuggestions = useMemo(() => {
    const query = articleQuery.trim().toLowerCase();
    if (!query) return posArticles.slice(0, 80);
    return prioritizeExactBarcode(posArticles.filter((article) =>
      [article.articleCode, article.commercialName, article.dci, article.dosage, article.barcode]
        .some((value) => String(value ?? '').toLowerCase().includes(query)),
    ), articleQuery);
  }, [articleQuery, posArticles]);

  const items = sale?.items ?? [];
  const currencyCode = sale?.currencyCode ?? 'USD';
  const currencySymbol = sale?.currencySymbol;
  const subtotal = Number(sale?.subtotal ?? sale?.totalAmount ?? 0);
  const discount = Number(sale?.discountAmount ?? 0);
  const total = Number(sale?.totalAmount ?? 0);
  const patientPayable = Number(sale?.customerPayableAmount ?? total);
  const insuranceAmount = Number(sale?.insuranceCoveredAmount ?? 0);
  const paid = Number(amountPaid || 0);
  const changeDue = Math.max(0, paid - patientPayable);
  const quantityTotal = items.reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0);

  const createDraft = useMutation({
    mutationFn: async () => (await salesService.create({ siteId: form.siteId, saleType: form.saleType, customerId: form.customerId || undefined, exchangeRate: 1 })).data,
    onSuccess: (created) => {
      setSale(created);
      setAmountPaid(String(created.customerPayableAmount ?? created.totalAmount ?? 0));
      setTimeout(() => focusArticleSearch(), 0);
    },
  });
  const addItem = useMutation({
    mutationFn: ({ articleId, lineQuantity }: { articleId: string; lineQuantity: number }) =>
      salesService.addItemFefo(sale.saleId, { articleId, quantity: lineQuantity }),
    onSuccess: (response) => {
      setSale(response.data);
      setAmountPaid(String(response.data.customerPayableAmount ?? response.data.totalAmount ?? 0));
      setArticleQuery('');
      setQuantity('1');
      setQuantityArticle(null);
      setClientError('');
      playBeep('success');
      setTimeout(() => focusArticleSearch(), 0);
    },
    onError: () => {
      playBeep('error');
      setTimeout(() => focusArticleSearch(), 0);
    },
  });
  const removeItem = useMutation({
    mutationFn: (itemId: string) => salesService.removeItem(sale.saleId, itemId),
    onSuccess: (response) => {
      setSale(response.data);
      setAmountPaid(String(response.data.customerPayableAmount ?? response.data.totalAmount ?? 0));
    },
  });
  const applyInsurance = useMutation({
    mutationFn: () => salesService.applyInsurance(sale.saleId, { membershipId: form.membershipId }),
    onSuccess: (response) => {
      setSale(response.data);
      setAmountPaid(String(response.data.customerPayableAmount));
    },
  });
  const validate = useMutation({
    mutationFn: (overrideAmount?: number) => salesService.validate(sale.saleId, { amountPaid: Number(overrideAmount ?? amountPaid ?? 0) }),
    onSuccess: async (response) => {
      setSale(response.data);
      await qc.invalidateQueries({ queryKey: ['sales'] });
      await qc.invalidateQueries({ queryKey: ['stocks'] });
      playBeep('sale');
      setTimeout(() => {
        window.print();
        prepareNextSale();
      }, 0);
    },
    onError: () => playBeep('error'),
  });
  const cancel = useMutation({ mutationFn: () => salesService.cancel(sale.saleId), onSuccess: () => prepareNextSale() });

  useEffect(() => {
    if (!currentUser?.siteId) return;
    setForm((current) => current.siteId === currentUser.siteId ? current : { ...current, siteId: currentUser.siteId ?? '', exchangeRate: '1' });
  }, [currentUser?.siteId]);

  useEffect(() => {
    if (!form.siteId || sale || createDraft.isPending || createDraft.isSuccess) return;
    if (form.saleType === 'INSURANCE' && !form.customerId) return;
    createDraft.mutate();
  }, [form.customerId, form.saleType, form.siteId, sale, createDraft.isPending, createDraft.isSuccess]);

  useEffect(() => {
    if (quantityArticle) setTimeout(() => quantityInputRef.current?.focus(), 0);
  }, [quantityArticle]);

  useEffect(() => {
    document.documentElement.classList.toggle('pos-cash-mode-active', cashMode);
    localStorage.setItem('posCashMode', String(cashMode));
    return () => document.documentElement.classList.remove('pos-cash-mode-active');
  }, [cashMode]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'F2') { event.preventDefault(); focusArticleSearch(); setArticlePopoverOpen(true); }
      if (event.key === 'F4') { event.preventDefault(); openQuantityForCurrentScan(); }
      if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); quickCheckout(); }
      if (event.ctrlKey && event.key.toLowerCase() === 'l') { event.preventDefault(); focusArticleSearch(); setArticlePopoverOpen(true); }
      if (event.ctrlKey && event.key === 'Delete' && selectedLineId) { event.preventDefault(); removeItem.mutate(selectedLineId); }
      if (event.key === 'Escape' && quantityArticle) { event.preventDefault(); closeQuantityBox(); }
      if (event.key === 'Enter' && event.target === scanInputRef.current && !articleQuery.trim() && items.length > 0) {
        event.preventDefault();
        focusPayment();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function update<K extends keyof PosForm>(key: K, value: PosForm[K]) {
    setForm((current) => ({ ...current, [key]: value, ...(key === 'saleType' && value === 'CASH' ? { membershipId: '' } : {}) }));
  }
  function focusArticleSearch() {
    scanInputRef.current?.focus();
  }
  function focusPayment() {
    paymentInputRef.current?.focus();
  }
  function startSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sale && form.siteId) createDraft.mutate();
  }
  function selectArticle(article: Article) {
    if (!sale?.saleId) { setClientError('Vente en preparation. Reessayez dans un instant.'); return; }
    addArticleQuick(article, 1);
    setArticlePopoverOpen(false);
  }
  function handleArticleKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter') {
      if (!articleQuery.trim() && items.length > 0) {
        event.preventDefault();
        focusPayment();
        return;
      }
      const parsed = parseScan(articleQuery, posArticles);
      if (parsed) {
        event.preventDefault();
        addArticleQuick(parsed.article, parsed.quantity);
      }
    }
  }
  function confirmQuantity(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!quantityArticle) return;
    const requested = Number(quantity || 0);
    const available = Number(stockByArticle.get(quantityArticle.articleId) ?? quantityArticle.stockAvailable ?? 0);
    if (!Number.isFinite(requested) || requested <= 0) { setClientError('Quantite invalide.'); return; }
    if (requested > available) { setClientError(`Stock insuffisant. Disponible : ${available}.`); return; }
    setClientError('');
    addArticleQuick(quantityArticle, requested);
  }
  function canValidate(amount = paid) {
    return Boolean(sale?.saleId && sale.status === 'DRAFT' && items.length > 0 && !validate.isPending && amount >= patientPayable);
  }
  function closeQuantityBox() {
    setQuantityArticle(null);
    setQuantity('1');
    setTimeout(() => focusArticleSearch(), 0);
  }
  function prepareNextSale() {
    setSale(null);
    setArticleQuery('');
    setQuantity('1');
    setQuantityArticle(null);
    setAmountPaid('');
    setSelectedLineId('');
    setClientError('');
    setForm((current) => ({ ...current, saleType: 'CASH', customerId: '', membershipId: '', exchangeRate: '1' }));
    createDraft.reset();
    validate.reset();
    setTimeout(() => focusArticleSearch(), 0);
  }
  function addArticleQuick(article: Article, lineQuantity: number) {
    if (!sale?.saleId) { setClientError('Vente en preparation. Reessayez dans un instant.'); playBeep('error'); return; }
    const available = Number(stockByArticle.get(article.articleId) ?? article.stockAvailable ?? 0);
    if (lineQuantity > available) {
      setClientError(`Stock insuffisant. Disponible : ${available}.`);
      playBeep('error');
      setTimeout(() => focusArticleSearch(), 0);
      return;
    }
    setClientError('');
    addItem.mutate({ articleId: article.articleId, lineQuantity });
  }
  function openQuantityForCurrentScan() {
    const parsed = parseScan(articleQuery, posArticles);
    const article = parsed?.article ?? articleSuggestions[0];
    if (!article) { playBeep('error'); return; }
    setQuantity(String(parsed?.quantity ?? 1));
    setQuantityArticle(article);
    setArticlePopoverOpen(false);
  }
  function quickCheckout() {
    const amount = amountPaid ? Number(amountPaid) : patientPayable;
    if (!amountPaid) setAmountPaid(String(patientPayable));
    if (!canValidate(amount)) {
      setClientError(amount < patientPayable ? 'Paiement insuffisant.' : 'Aucune vente a encaisser.');
      playBeep('error');
      if (items.length > 0) focusPayment();
      return;
    }
    setClientError('');
    validate.mutate(amount);
  }
  function playBeep(kind: 'success' | 'error' | 'sale') {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioRef.current ?? new AudioContextClass();
      audioRef.current = context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const frequency = kind === 'error' ? 180 : kind === 'sale' ? 880 : 660;
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      gain.gain.value = 0.045;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + (kind === 'sale' ? 0.16 : 0.09));
    } catch {
      // Browser audio can be blocked before user interaction; POS flow must continue.
    }
  }
  function printDraft() {
    window.print();
  }

  const mutationError = createDraft.error || addItem.error || removeItem.error || applyInsurance.error || validate.error || cancel.error;
  const showError = Boolean(clientError || mutationError);
  const error = clientError || (mutationError ? apiErrorMessage(mutationError) : '');

  return (
    <div className={`pos-page purchase-erp-window ${cashMode ? 'pos-page-cash-mode' : ''}`}>
      <div className="breadcrumb"><Link to="/sales">Ventes</Link><span>&gt;</span><strong>POS</strong></div>
      <div className="toolbar pos-toolbar">
        <div>
          <h1>POS</h1>
          <p className="muted">Caisse rapide FEFO : scanner, quantite, encaisser.</p>
        </div>
        <div className="pos-cash-status">
          <button className="ghost-button compact-button" type="button" onClick={() => setCashMode((value) => !value)}>
            {cashMode ? 'Quitter mode caisse' : 'Mode caisse'}
          </button>
          <span className={`badge ${currentCashSession.data ? 'badge-success' : 'badge-warning'}`}>{currentCashSession.data ? 'Caisse ouverte' : 'Caisse non ouverte'}</span>
          <small>{currentCashSession.data ? `${currentCashSession.data.registerName ?? 'Caisse'} - Ouverture ${formatMoney(currentCashSession.data.openingBalance, currencyCode, currencySymbol)}` : 'Ouvrez une session caisse pour lier automatiquement les paiements CASH.'}</small>
        </div>
      </div>
      {showError && <p className="form-error">{error}</p>}

      <form className="card compact-card pos-header-grid" onSubmit={startSale}>
        <label><span>Vente no</span><input className="input compact-input" value={sale?.saleNumber ?? 'Auto'} disabled /></label>
        <label><span>Client</span><select className="input compact-input" value={form.customerId} disabled={Boolean(sale)} onChange={(event) => update('customerId', event.target.value)} required={form.saleType === 'INSURANCE'}><option value="">Client comptoir</option>{(customers.data ?? []).map((customer) => <option key={customer.customerId} value={customer.customerId}>{customer.customerName}</option>)}</select></label>
        <label><span>Type</span><select className="input compact-input" value={form.saleType} disabled={Boolean(sale)} onChange={(event) => update('saleType', event.target.value as PosForm['saleType'])}><option value="CASH">CASH</option><option value="INSURANCE">INSURANCE</option></select></label>
        <label><span>Assurance</span><select className="input compact-input" value={form.membershipId} disabled={form.saleType !== 'INSURANCE' || !sale || sale.status !== 'DRAFT'} onChange={(event) => update('membershipId', event.target.value)}><option value="">Membership / Plan</option>{(memberships.data ?? []).filter((membership) => membership.isActive).map((membership) => <option key={membership.membershipId} value={membership.membershipId}>{membership.organizationName} - {membership.planName} ({membership.coveragePercent}%)</option>)}</select></label>
        <label><span>Site</span><input className="input compact-input" value={currentSite?.siteName ?? form.siteId ?? 'Site utilisateur'} disabled /></label>
        <label><span>Devise</span><input className="input compact-input" value="USD" disabled /></label>
        <label><span>Taux</span><input className="input compact-input" value="1" disabled /></label>
        {!sale ? <span className="badge badge-warning">{createDraft.isPending ? 'Preparation...' : 'En attente'}</span> : <span className={`badge ${sale.status === 'VALIDATED' ? 'badge-success' : 'badge-warning'}`}>{sale.status}</span>}
      </form>

      <section className="card compact-card pos-workspace">
        <div className="pos-search-row">
          <FloatingSearchPopover
            columns={[
              { header: 'Code', render: (article) => article.articleCode },
              { header: 'Barcode', render: (article) => article.barcode ?? '-' },
              { header: 'Nom', render: (article) => <strong>{article.commercialName}</strong> },
              { header: 'DCI', render: (article) => article.dci ?? '-' },
              { header: 'Dosage', render: (article) => article.dosage ?? '-' },
              { header: 'Stock', render: (article) => stockByArticle.get(article.articleId) ?? article.stockAvailable ?? 0 },
              { header: 'Prix vente', render: (article) => formatMoney(article.sellingPrice ?? 0, currencyCode, currencySymbol) },
              { header: 'Lot FEFO', render: (article) => fefoByArticle.get(article.articleId)?.lot ?? '-' },
            ]}
            getKey={(article) => article.articleId}
            inputClassName="input pos-article-input"
            inputRef={scanInputRef}
            onChange={setArticleQuery}
            onClose={() => setArticlePopoverOpen(false)}
            onFallbackKeyDown={handleArticleKeys}
            onOpen={() => setArticlePopoverOpen(true)}
            onSelect={selectArticle}
            open={articlePopoverOpen}
            placeholder="Scanner code-barres ou rechercher article..."
            searchPlaceholder="Rechercher (code, nom, DCI, dosage, barcode...)"
            suggestions={articleSuggestions}
            value={articleQuery}
          />
          {form.saleType === 'INSURANCE' && <button className="ghost-button compact-button" type="button" disabled={!form.membershipId || items.length === 0 || applyInsurance.isPending || sale?.status !== 'DRAFT'} onClick={() => applyInsurance.mutate()}>{applyInsurance.isPending ? 'Application...' : 'Appliquer assurance'}</button>}
        </div>

        <div className="table-wrap pos-grid-wrap">
          <table className="data-table pos-lines-table">
            <thead><tr><th>Article</th><th>Lot FEFO</th><th>Exp</th><th>Qte</th><th>Prix</th><th>Total</th><th>Actions</th></tr></thead>
            <tbody>{items.length === 0 ? <tr><td colSpan={7}><p className="empty-state">Aucun article. Utilisez F2, scannez ou recherchez un produit.</p></td></tr> : items.map((item: any) => (
              <tr className={selectedLineId === item.saleItemId ? 'selected-row' : ''} key={item.saleItemId} onClick={() => setSelectedLineId(item.saleItemId)}>
                <td><strong>{item.commercialName}</strong><small>{item.articleCode ?? ''}</small></td>
                <td>{item.lotNumber ?? '-'}</td>
                <td>{item.expiryDate ? formatDate(item.expiryDate) : '-'}</td>
                <td className="quantity-cell">{item.quantity}</td>
                <td className="numeric-text">{formatMoney(item.unitPrice, currencyCode, currencySymbol)}</td>
                <td className="numeric-text"><strong>{formatMoney(item.lineTotal, currencyCode, currencySymbol)}</strong></td>
                <td><button aria-label="Supprimer ligne" className="ghost-button compact-button row-action-button icon-only danger" type="button" disabled={sale?.status !== 'DRAFT' || removeItem.isPending} onClick={(event) => { event.stopPropagation(); removeItem.mutate(item.saleItemId); }}><TrashIcon /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      <p className="muted pos-scan-help">Scanner un code-barres ou taper un nom/code/DCI. Entree sans texte passe au paiement.</p>

      <section className="card compact-card pos-summary-panel">
        <div className="pos-summary-grid">
          <Summary label="Articles" value={String(items.length)} />
          <Summary label="Qte totale" value={String(quantityTotal)} />
          <Summary label="Sous-total" value={formatMoney(subtotal, currencyCode, currencySymbol)} />
          <Summary label="Remise" value={formatMoney(discount, currencyCode, currencySymbol)} />
          <Summary label="Total" value={formatMoney(total, currencyCode, currencySymbol)} strong />
          <Summary label="Part assurance" value={formatMoney(insuranceAmount, currencyCode, currencySymbol)} />
          <Summary label="Part patient" value={formatMoney(patientPayable, currencyCode, currencySymbol)} strong />
          <label className="pos-paid-field"><span>Paye</span><input ref={paymentInputRef} className="input compact-input numeric-cell" type="number" min="0" step="0.01" value={amountPaid} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); quickCheckout(); } }} onChange={(event) => setAmountPaid(event.target.value)} /></label>
          <Summary label="Monnaie" value={formatMoney(changeDue, currencyCode, currencySymbol)} strong />
        </div>
        <div className="page-actions pos-checkout-actions">
          <button className="ghost-button compact-button" type="button" disabled={!sale || sale.status !== 'DRAFT'} onClick={() => cancel.mutate()}>Annuler vente</button>
          <button className="ghost-button compact-button" type="button" disabled={!sale} onClick={printDraft}>Imprimer facture</button>
          <div className="pos-checkout-total">
            <span>Total a encaisser</span>
            <strong>{formatMoney(patientPayable, currencyCode, currencySymbol)}</strong>
          </div>
          <button className="button pos-checkout-button" type="button" disabled={!canValidate(amountPaid ? paid : patientPayable)} onClick={quickCheckout}>{validate.isPending ? 'ENCAISSEMENT...' : 'ENCAISSER'}</button>
        </div>
      </section>

      <div className="print-invoice">
        <h1>PharmaERP</h1>
        <p>Facture {sale?.saleNumber ?? '-'}</p>
        <p>Date: {sale?.saleDate ? formatDate(sale.saleDate) : '-'}</p>
        <p>Client: {(customers.data ?? []).find((customer) => customer.customerId === form.customerId)?.customerName ?? 'Comptoir'}</p>
        <table><tbody>{items.map((item: any) => <tr key={item.saleItemId}><td>{item.commercialName}</td><td>{item.quantity}</td><td>{formatMoney(item.lineTotal, currencyCode, currencySymbol)}</td></tr>)}</tbody></table>
        <h2>Total: {formatMoney(total, currencyCode, currencySymbol)}</h2>
        <p>Paye: {formatMoney(paid, currencyCode, currencySymbol)}</p>
        <p>Merci pour votre confiance.</p>
      </div>

      {quantityArticle && (
        <div className="modal-backdrop pos-quantity-backdrop" role="dialog" aria-modal="true">
          <form className="modal-panel pos-quantity-panel" onSubmit={confirmQuantity}>
            <div className="modal-header">
              <div>
                <h2>Quantite</h2>
                <p className="muted">{quantityArticle.articleCode} - {quantityArticle.commercialName}</p>
              </div>
              <button className="ghost-button compact-button" type="button" onClick={closeQuantityBox}>Fermer</button>
            </div>
            <div className="detail-grid">
              <div><span>Lot FEFO</span><strong>{fefoByArticle.get(quantityArticle.articleId)?.lot ?? '-'}</strong></div>
              <div><span>Stock disponible</span><strong>{stockByArticle.get(quantityArticle.articleId) ?? quantityArticle.stockAvailable ?? 0}</strong></div>
              <div><span>Prix</span><strong>{formatMoney(quantityArticle.sellingPrice ?? 0, currencyCode, currencySymbol)}</strong></div>
            </div>
            <label className="pos-paid-field">
              <span>Quantite</span>
              <input
                ref={quantityInputRef}
                className="input compact-input numeric-cell"
                type="number"
                min="0.001"
                step="0.001"
                value={quantity}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    confirmQuantity();
                  }
                }}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={closeQuantityBox}>Annuler</button>
              <button className="button" type="submit" disabled={addItem.isPending}>{addItem.isPending ? 'Ajout...' : 'Ajouter'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function TrashIcon() {
  return <svg aria-hidden="true" className="row-action-icon" focusable="false" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M9 10v8M15 10v8M6 6l1 14h10l1-14" /></svg>;
}

function prioritizeExactBarcode(articles: Article[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return articles;
  return [...articles].sort((a, b) => Number(String(b.barcode ?? '').toLowerCase() === needle) - Number(String(a.barcode ?? '').toLowerCase() === needle));
}

function parseScan(raw: string, articles: Article[]) {
  const value = raw.trim();
  if (!value) return null;
  const exact = findExactArticle(value, articles);
  if (exact) return { article: exact, quantity: 1 };

  const separated = value.match(/^(\d+(?:[.,]\d+)?)\s*(?:x|\*|-|\s)\s*(.+)$/i);
  if (separated) {
    const quantity = Number(separated[1].replace(',', '.'));
    const article = findExactArticle(separated[2], articles);
    if (article && quantity > 0) return { article, quantity };
  }

  for (let size = 1; size <= 2 && size < value.length; size += 1) {
    const quantity = Number(value.slice(0, size));
    const article = findExactArticle(value.slice(size), articles);
    if (article && quantity > 0) return { article, quantity };
  }

  return null;
}

function findExactArticle(raw: string, articles: Article[]) {
  const value = raw.trim().toLowerCase();
  return articles.find((article) =>
    [article.articleCode, article.barcode].some((candidate) => String(candidate ?? '').trim().toLowerCase() === value),
  ) ?? null;
}

function Summary({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className="form-summary pos-summary-item"><span>{label}</span><strong className={strong ? 'pos-total-text' : ''}>{value}</strong></div>;
}
