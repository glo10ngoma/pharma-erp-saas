import { Fragment, FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { FloatingSearchPopover } from '../../components/FloatingSearchPopover';
import { Article, articlesService } from '../../services/articles.service';
import { apiErrorMessage } from '../../services/apiError';
import { cashService } from '../../services/cash.service';
import { codeGeneratorService } from '../../services/codeGenerator.service';
import { purchasesService } from '../../services/purchases.service';
import { ProductUnitItem, referenceService } from '../../services/reference.service';
import { settingsService } from '../../services/settings.service';
import { sitesService } from '../../services/sites.service';
import { stocksService } from '../../services/stocks.service';
import { formatMoney } from '../../utils/money';

type PurchaseForm = {
  purchaseNumber: string;
  supplierId: string;
  siteId: string;
  purchaseDate: string;
  currencyCode: string;
  exchangeRate: string;
  paymentStatus: string;
  paymentSource: string;
  paymentMethod: string;
  cashSessionId: string;
  amountPaidUsd: string;
  amountPaidCdf: string;
  paymentReference: string;
  paymentNote: string;
  observation: string;
};
type PurchaseDraftLine = {
  id: string;
  articleId: string;
  articleQuery: string;
  purchaseUnitId: string;
  purchaseUnitQuery: string;
  conversionFactor: string;
  stockUnitId: string;
  stockUnitLabel: string;
  lotNumber: string;
  expiryDate: string;
  quantity: string;
  purchaseUnitPrice: string;
  sellingUnitPrice: string;
};
type LineIssue = { level: 'valid' | 'warning' | 'danger'; message: string; blocksSave: boolean };

const initialForm = (): PurchaseForm => ({
  purchaseNumber: '',
  supplierId: '',
  siteId: '',
  purchaseDate: new Date().toISOString().slice(0, 10),
  currencyCode: 'USD',
  exchangeRate: '1',
  paymentStatus: 'UNPAID',
  paymentSource: 'CREDIT',
  paymentMethod: 'CREDIT',
  cashSessionId: '',
  amountPaidUsd: '',
  amountPaidCdf: '',
  paymentReference: '',
  paymentNote: '',
  observation: '',
});
const newLine = (): PurchaseDraftLine => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  articleId: '',
  articleQuery: '',
  purchaseUnitId: '',
  purchaseUnitQuery: '',
  conversionFactor: '1',
  stockUnitId: '',
  stockUnitLabel: '',
  lotNumber: '',
  expiryDate: '',
  quantity: '1',
  purchaseUnitPrice: '',
  sellingUnitPrice: '',
});

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field-block compact-field"><span>{label}</span>{children}</label>;
}

function yyyymmdd(value: string) { return (value || new Date().toISOString().slice(0, 10)).replace(/-/g, ''); }
function lotBase(article: Article, purchaseDate: string) {
  const code = (article.articleCode || 'ART').replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase() || 'ART';
  return `${code}-${yyyymmdd(purchaseDate)}`;
}
function daysUntil(date: string) {
  if (!date) return null;
  const target = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}
function lineStockQuantity(line: PurchaseDraftLine) { return Number(line.quantity || 0) * Number(line.conversionFactor || 0); }
function lineTotal(line: PurchaseDraftLine) { return Number(line.quantity || 0) * Number(line.purchaseUnitPrice || 0); }
function lineSaleTotal(line: PurchaseDraftLine) { return lineStockQuantity(line) * Number(line.sellingUnitPrice || 0); }
function lineEquivalentUsd(line: PurchaseDraftLine, currencyCode: string, exchangeRate: number) {
  const total = lineTotal(line);
  if (currencyCode === 'CDF') return exchangeRate > 0 ? total / exchangeRate : 0;
  return total;
}
function issueForLine(line: PurchaseDraftLine): LineIssue {
  if (!line.articleId) return { level: 'warning', message: 'Article absent.', blocksSave: true };
  if (!line.purchaseUnitId && !line.purchaseUnitQuery.trim()) return { level: 'warning', message: "Unite d'achat manquante.", blocksSave: true };
  if (!line.lotNumber.trim()) return { level: 'warning', message: 'Lot manquant.', blocksSave: true };
  if (!line.expiryDate) return { level: 'warning', message: 'Expiration manquante.', blocksSave: true };
  if (Number(line.quantity) <= 0) return { level: 'danger', message: 'Quantite <= 0.', blocksSave: true };
  if (Number(line.conversionFactor) <= 0) return { level: 'danger', message: 'Facteur <= 0.', blocksSave: true };
  if (lineStockQuantity(line) <= 0) return { level: 'danger', message: 'Quantite stock invalide.', blocksSave: true };
  if (Number(line.purchaseUnitPrice) <= 0) return { level: 'danger', message: 'PA <= 0.', blocksSave: true };
  if (Number(line.sellingUnitPrice || 0) < 0) return { level: 'danger', message: 'PV invalide.', blocksSave: true };
  const days = daysUntil(line.expiryDate);
  if (days !== null && days < 0) return { level: 'danger', message: 'Expiration passee.', blocksSave: true };
  if (days !== null && days < 30) return { level: 'danger', message: 'Expiration < 30 jours.', blocksSave: false };
  if (days !== null && days < 90) return { level: 'warning', message: 'Expiration < 90 jours.', blocksSave: false };
  return { level: 'valid', message: 'Ligne valide.', blocksSave: false };
}

export function NewPurchasePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { permissions } = useAuth();
  const [form, setForm] = useState<PurchaseForm>(initialForm);
  const [draftLines, setDraftLines] = useState<PurchaseDraftLine[]>([]);
  const [quickLine, setQuickLine] = useState<PurchaseDraftLine>(newLine());
  const [articleOptions, setArticleOptions] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [selectedLineId, setSelectedLineId] = useState('');
  const [activeAutocomplete, setActiveAutocomplete] = useState('');
  const [activeUnitPopover, setActiveUnitPopover] = useState('');
  const [clientError, setClientError] = useState('');
  const canPayPurchase = permissions.includes('purchases.pay');

  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: async () => (await referenceService.suppliers.getAll()).data });
  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const productUnits = useQuery({ queryKey: ['product-units'], queryFn: async () => (await referenceService.productUnits.getAll()).data });
  const stocks = useQuery({ queryKey: ['stocks'], queryFn: async () => (await stocksService.getAll()).data });
  const nextCode = useQuery({ queryKey: ['next-code', 'purchases', 'page'], queryFn: async () => (await codeGeneratorService.next('purchases')).data.code });
  const exchangeRate = useQuery({ queryKey: ['exchange-rate'], queryFn: async () => (await settingsService.getExchangeRate()).data });
  const currentCashSession = useQuery({
    queryKey: ['cash-session-current', form.siteId],
    queryFn: async () => (await cashService.getCurrentSession(form.siteId)).data,
    enabled: Boolean(form.siteId),
  });

  useEffect(() => {
    let mounted = true;
    setArticlesLoading(true);
    articlesService.getAll({ limit: 100 })
      .then((response) => {
        const payload = response.data as unknown as { items?: Article[]; data?: { items?: Article[] } } | Article[];
        const items = Array.isArray(payload) ? payload : payload.items ?? payload.data?.items ?? [];
        if (mounted) setArticleOptions(items);
      })
      .finally(() => {
        if (mounted) setArticlesLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => { if (!form.purchaseNumber && nextCode.data) setForm((current) => ({ ...current, purchaseNumber: nextCode.data ?? '' })); }, [form.purchaseNumber, nextCode.data]);
  useEffect(() => {
    if (form.currencyCode === 'CDF' && exchangeRate.data?.rate && Number(form.exchangeRate || 0) <= 1) {
      setForm((current) => ({ ...current, exchangeRate: String(exchangeRate.data?.rate ?? 1) }));
    }
  }, [exchangeRate.data?.rate, form.currencyCode, form.exchangeRate]);
  useEffect(() => {
    if (form.paymentSource === 'CASH_REGISTER') {
      setForm((current) => ({ ...current, cashSessionId: currentCashSession.data?.cashSessionId ?? current.cashSessionId }));
    } else if (form.cashSessionId) {
      setForm((current) => ({ ...current, cashSessionId: '' }));
    }
  }, [currentCashSession.data?.cashSessionId, form.cashSessionId, form.paymentSource]);

  const articleById = useMemo(() => new Map(articleOptions.map((article) => [article.articleId, article])), [articleOptions]);
  const unitById = useMemo(() => new Map((productUnits.data ?? []).map((unit) => [unit.productUnitId, unit])), [productUnits.data]);
  const stockByArticle = useMemo(() => {
    const map = new Map<string, number>();
    for (const stock of stocks.data ?? []) map.set(stock.articleId, (map.get(stock.articleId) ?? 0) + stock.quantityAvailable);
    return map;
  }, [stocks.data]);
  const lineIssues = useMemo(() => new Map(draftLines.map((line) => [line.id, issueForLine(line)])), [draftLines]);
  const quickIssue = useMemo(() => issueForLine(quickLine), [quickLine]);
  const quickLineHasInput = useMemo(
    () => Boolean(
      quickLine.articleId
      || quickLine.articleQuery.trim()
      || quickLine.lotNumber.trim()
      || quickLine.expiryDate
      || Number(quickLine.quantity || 0) > 0
      || Number(quickLine.purchaseUnitPrice || 0) > 0
      || Number(quickLine.sellingUnitPrice || 0) > 0,
    ),
    [quickLine],
  );
  const normalizedLines = useMemo(
    () => (quickLineHasInput && !quickIssue.blocksSave ? [...draftLines, quickLine] : draftLines),
    [draftLines, quickIssue.blocksSave, quickLine, quickLineHasInput],
  );
  const totals = useMemo(() => {
    const articleIds = new Set<string>();
    const lines = normalizedLines;
    return lines.reduce((acc, line) => {
      if (line.articleId) articleIds.add(line.articleId);
      const quantity = Number(line.quantity || 0);
      acc.quantity += Number.isFinite(quantity) ? quantity : 0;
      acc.stockQuantity += lineStockQuantity(line);
      acc.purchase += lineTotal(line);
      acc.sale += lineSaleTotal(line);
      acc.articleCount = articleIds.size;
      return acc;
    }, { articleCount: 0, quantity: 0, stockQuantity: 0, purchase: 0, sale: 0 });
  }, [normalizedLines]);
  const numericExchangeRate = Number(form.exchangeRate || 1) || 1;
  const purchaseEquivalentUsd = useMemo(
    () => normalizedLines.reduce((sum, line) => sum + lineEquivalentUsd(line, form.currencyCode, numericExchangeRate), 0),
    [form.currencyCode, normalizedLines, numericExchangeRate],
  );
  const amountPaidUsd = Number(form.amountPaidUsd || 0);
  const amountPaidCdf = Number(form.amountPaidCdf || 0);
  const paidEquivalentUsd = amountPaidUsd + (numericExchangeRate > 0 ? amountPaidCdf / numericExchangeRate : 0);
  const remainingBalanceUsd = Math.max(purchaseEquivalentUsd - paidEquivalentUsd, 0);
  const paymentStatusLabel =
    remainingBalanceUsd <= 0 && paidEquivalentUsd > 0
      ? 'PAID'
      : paidEquivalentUsd > 0
        ? 'PARTIALLY_PAID'
        : 'UNPAID';
  const currentSupplier = suppliers.data?.find((supplier) => supplier.supplierId === form.supplierId);
  const currentSite = sites.data?.find((site) => site.siteId === form.siteId);

  const savePurchase = useMutation({
    mutationFn: async (validateNow: boolean) => {
      const lines = normalizedLines;
      const purchase = (await purchasesService.create({
        purchaseNumber: form.purchaseNumber.trim() || undefined,
        supplierId: form.supplierId,
        siteId: form.siteId,
        purchaseDate: form.purchaseDate,
        currencyCode: form.currencyCode,
        exchangeRate: numericExchangeRate,
        paymentStatus: canPayPurchase ? paymentStatusLabel : undefined,
        paymentSource: canPayPurchase ? form.paymentSource : undefined,
        paymentMethod: canPayPurchase ? form.paymentMethod : undefined,
        cashSessionId: canPayPurchase && form.paymentSource === 'CASH_REGISTER' ? form.cashSessionId || undefined : undefined,
        amountPaidUsd: canPayPurchase ? amountPaidUsd : undefined,
        amountPaidCdf: canPayPurchase ? amountPaidCdf : undefined,
        paymentReference: canPayPurchase ? form.paymentReference.trim() || undefined : undefined,
        paymentNote: canPayPurchase ? form.paymentNote.trim() || undefined : undefined,
      })).data;
      for (const [index, line] of lines.entries()) {
        await purchasesService.addItem(purchase.purchaseId, {
          articleId: line.articleId,
          lotNumber: line.lotNumber.trim(),
          expiryDate: line.expiryDate,
          quantity: lineStockQuantity(line),
          purchaseQuantity: Number(line.quantity),
          conversionFactor: Number(line.conversionFactor || 1),
          stockQuantity: lineStockQuantity(line),
          purchaseUnitId: line.purchaseUnitId || undefined,
          stockUnitId: line.stockUnitId || undefined,
          lineOrder: index + 1,
          purchaseUnitPrice: Number(line.purchaseUnitPrice),
          sellingUnitPrice: Number(line.sellingUnitPrice || 0),
        });
      }
      if (!validateNow) return purchase;
      return (await purchasesService.validate(purchase.purchaseId)).data;
    },
    onSuccess: async (purchase) => {
      await queryClient.invalidateQueries({ queryKey: ['purchases'] });
      await queryClient.invalidateQueries({ queryKey: ['purchase', purchase.purchaseId] });
      await queryClient.invalidateQueries({ queryKey: ['stocks'] });
      navigate(`/purchases/${purchase.purchaseId}`);
    },
  });

  useEffect(() => {
    if (form.currencyCode === 'USD' && form.exchangeRate !== '1') setForm((current) => ({ ...current, exchangeRate: '1' }));
  }, [form.currencyCode, form.exchangeRate]);

  function update<K extends keyof PurchaseForm>(key: K, value: PurchaseForm[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function updateLine(id: string, patch: Partial<PurchaseDraftLine>) { setDraftLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line)); }
  function updateQuickLine(patch: Partial<PurchaseDraftLine>) { setQuickLine((current) => ({ ...current, ...patch })); }
  function focusCell(row: number, col: number) { document.querySelector<HTMLElement>(`[data-grid-cell="${row}-${col}"]`)?.focus(); }
  function addLine() {
    const line = newLine();
    setDraftLines((current) => [...current, line]);
    setSelectedLineId(line.id);
    setTimeout(() => focusCell(draftLines.length, 0), 0);
  }
  function commitQuickLine() {
    const issue = issueForLine(quickLine);
    if (issue.blocksSave) { setClientError(`Ligne rapide: ${issue.message}`); return; }
    setDraftLines((current) => [...current, quickLine]);
    const next = newLine();
    setQuickLine(next);
    setSelectedLineId(next.id);
    setClientError('');
    setTimeout(() => focusCell(draftLines.length + 1, 0), 0);
  }
  function duplicateSelectedLine() {
    const line = draftLines.find((item) => item.id === selectedLineId);
    if (!line) return;
    const copy = { ...line, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
    setDraftLines((current) => [...current, copy]);
    setSelectedLineId(copy.id);
  }
  function removeLine(id: string) { setDraftLines((current) => current.filter((line) => line.id !== id)); }
  function removeSelectedLine() { if (selectedLineId) removeLine(selectedLineId); }
  function selectArticle(lineId: string, article: Article) {
    const sameArticleCount = draftLines.filter((line) => line.articleId === article.articleId).length + (quickLine.articleId === article.articleId ? 1 : 0) + 1;
    const purchaseUnitId = article.packagingUnitId ?? article.salesUnitId ?? '';
    const stockUnitId = article.salesUnitId ?? article.packagingUnitId ?? '';
    const patch = {
      articleId: article.articleId,
      articleQuery: `${article.articleCode} - ${article.commercialName}`,
      purchaseUnitId,
      purchaseUnitQuery: unitById.get(purchaseUnitId)?.unitLabel ?? article.packaging ?? '',
      conversionFactor: String(article.unitsPerPackage ?? 1),
      stockUnitId,
      stockUnitLabel: unitById.get(stockUnitId)?.unitLabel ?? article.packaging ?? 'Unite',
      lotNumber: `${lotBase(article, form.purchaseDate)}-${String(sameArticleCount).padStart(3, '0')}`,
      sellingUnitPrice: article.sellingPrice ? String(article.sellingPrice) : '',
    };
    if (lineId === quickLine.id) updateQuickLine(patch); else updateLine(lineId, patch);
    setActiveAutocomplete('');
    setTimeout(() => document.querySelector<HTMLElement>(`[data-grid-cell="${lineId === quickLine.id ? draftLines.length : draftLines.findIndex((line) => line.id === lineId)}-2"]`)?.focus(), 0);
  }
  function unitSuggestions(line: PurchaseDraftLine) {
    const query = line.purchaseUnitQuery.trim().toLowerCase();
    const source = (productUnits.data ?? []).filter((unit) => unit.isActive || unit.productUnitId === line.purchaseUnitId);
    if (!query) return source;
    return source.filter((unit) => [unit.unitCode, unit.unitLabel].some((value) => String(value ?? '').toLowerCase().includes(query)));
  }
  function selectPurchaseUnit(lineId: string, unit: ProductUnitItem) {
    const patch = { purchaseUnitId: unit.productUnitId, purchaseUnitQuery: unit.unitLabel };
    if (lineId === quickLine.id) updateQuickLine(patch); else updateLine(lineId, patch);
    setActiveUnitPopover('');
  }
  function articleSuggestions(line: PurchaseDraftLine) {
    const query = line.articleQuery.trim().toLowerCase();
    const source = articleOptions;
    if (!query) return source;
    return prioritizeExactBarcode(source.filter((article) => [article.articleCode, article.commercialName, article.dci, article.dosage, article.barcode].some((value) => String(value ?? '').toLowerCase().includes(query))), line.articleQuery);
  }
  function validatePurchaseDraft() {
    if (!form.supplierId) return 'Fournisseur manquant.';
    if (!form.siteId) return 'Site manquant.';
    if (form.currencyCode !== 'USD' && Number(form.exchangeRate || 0) <= 0) return 'Taux de change invalide.';
    if (canPayPurchase && form.paymentSource === 'CASH_REGISTER' && (amountPaidUsd > 0 || amountPaidCdf > 0) && !form.cashSessionId) return 'Session de caisse obligatoire.';
    if (quickLineHasInput && quickIssue.blocksSave) return `Ligne rapide: ${quickIssue.message}`;
    if (normalizedLines.length === 0) return 'Ajoutez au moins une ligne achat.';
    const blocking = normalizedLines.map((line, index) => ({ issue: issueForLine(line), index })).find(({ issue }) => issue.blocksSave);
    return blocking ? `Ligne ${blocking.index + 1}: ${blocking.issue.message}` : '';
  }
  function submit(event?: FormEvent<HTMLFormElement>, validateNow = false) {
    event?.preventDefault();
    const error = validatePurchaseDraft();
    if (error) { setClientError(error); return; }
    setClientError('');
    savePurchase.mutate(validateNow);
  }
  function handleGridKey(event: KeyboardEvent<HTMLElement>, row: number, col: number, lineId: string) {
    if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); if (!savePurchase.isPending) submit(); return; }
    if (event.ctrlKey && event.key.toLowerCase() === 'l') { event.preventDefault(); addLine(); return; }
    if (event.ctrlKey && event.key === 'Delete') { event.preventDefault(); lineId === quickLine.id ? setQuickLine(newLine()) : removeLine(lineId); return; }
    if (event.key === 'Escape') { event.preventDefault(); navigate('/purchases'); return; }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (lineId === quickLine.id) {
        commitQuickLine();
        return;
      }
      const currentLine = draftLines.find((line) => line.id === lineId);
      const currentIssue = currentLine ? (lineIssues.get(lineId) ?? issueForLine(currentLine)) : undefined;
      if (currentIssue && !currentIssue.blocksSave) {
        addLine();
        return;
      }
      focusCell(Math.min(row + 1, draftLines.length), col);
      return;
    }
    if (event.key === 'ArrowDown') { event.preventDefault(); focusCell(Math.min(row + 1, draftLines.length), col); }
    if (event.key === 'ArrowUp') { event.preventDefault(); focusCell(Math.max(row - 1, 0), col); }
  }

  return (
    <form className="purchase-page purchase-form purchase-erp-window" onSubmit={(event) => submit(event, false)}>
      <div className="breadcrumb"><Link to="/purchases">Achats</Link><span>&gt;</span><strong>Nouvel Achat</strong></div>
      {(savePurchase.isError || clientError) && <p className="form-error">{clientError || apiErrorMessage(savePurchase.error)}</p>}
      <div className="purchase-sticky-header purchase-page-header">
        <div><span>Code</span><strong>{form.purchaseNumber || 'ACH-...'}</strong></div>
        <div><span>Fournisseur</span><strong>{currentSupplier?.supplierName ?? '-'}</strong></div>
        <div><span>Date</span><strong>{form.purchaseDate}</strong></div>
        <div><span>Site</span><strong>{currentSite?.siteName ?? '-'}</strong></div>
        <div><span>Devise</span><strong>{form.currencyCode}</strong></div>
        <div><span>Total</span><strong>{formatMoney(totals.purchase, form.currencyCode)}</strong></div>
        <div><span>Reglement</span><strong>{canPayPurchase ? paymentStatusLabel : 'UNPAID'}</strong></div>
        <div><span>Statut</span><strong><span className="badge badge-warning">DRAFT</span></strong></div>
      </div>
      <section className="card compact-card">
        <div className="form-grid purchase-page-fields">
          <Field label="Code"><input className="input compact-input" placeholder="ACH-000001" value={form.purchaseNumber} onChange={(event) => update('purchaseNumber', event.target.value)} required /></Field>
          <Field label="Fournisseur"><select className="input compact-input" value={form.supplierId} onChange={(event) => update('supplierId', event.target.value)} required><option value="">Fournisseur</option>{(suppliers.data ?? []).map((supplier) => <option key={supplier.supplierId} value={supplier.supplierId}>{supplier.supplierName}</option>)}</select></Field>
          <Field label="Date"><input className="input compact-input" type="date" value={form.purchaseDate} onChange={(event) => update('purchaseDate', event.target.value)} required /></Field>
          <Field label="Site"><select className="input compact-input" value={form.siteId} onChange={(event) => update('siteId', event.target.value)} required><option value="">Site</option>{(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}</select></Field>
          <Field label="Devise"><select className="input compact-input" value={form.currencyCode} onChange={(event) => update('currencyCode', event.target.value)}><option value="USD">USD</option><option value="CDF">CDF</option></select></Field>
          <Field label="Taux"><input className="input compact-input" type="number" min={form.currencyCode === 'USD' ? '1' : '0.0001'} step="0.0001" placeholder="1" value={form.currencyCode === 'USD' ? '1' : form.exchangeRate} disabled={form.currencyCode === 'USD'} readOnly={form.currencyCode === 'USD'} onChange={(event) => update('exchangeRate', event.target.value)} required /></Field>
          {canPayPurchase ? (
            <>
              <Field label="Reglement"><select className="input compact-input" value={form.paymentStatus} onChange={(event) => update('paymentStatus', event.target.value)}><option value="UNPAID">UNPAID</option><option value="PARTIALLY_PAID">PARTIALLY_PAID</option><option value="PAID">PAID</option></select></Field>
              <Field label="Source"><select className="input compact-input" value={form.paymentSource} onChange={(event) => update('paymentSource', event.target.value)}><option value="CREDIT">CREDIT</option><option value="CASH_REGISTER">CASH_REGISTER</option><option value="BANK">BANK</option><option value="MOBILE_MONEY">MOBILE_MONEY</option><option value="OTHER">OTHER</option></select></Field>
              <Field label="Mode"><select className="input compact-input" value={form.paymentMethod} onChange={(event) => update('paymentMethod', event.target.value)}><option value="CREDIT">CREDIT</option><option value="CASH">CASH</option><option value="BANK_TRANSFER">BANK_TRANSFER</option><option value="MOBILE_MONEY">MOBILE_MONEY</option><option value="MIXED">MIXED</option><option value="OTHER">OTHER</option></select></Field>
              <Field label="Session caisse"><select className="input compact-input" value={form.cashSessionId} onChange={(event) => update('cashSessionId', event.target.value)} disabled={form.paymentSource !== 'CASH_REGISTER'}><option value="">{form.paymentSource === 'CASH_REGISTER' ? 'Session ouverte' : 'Sans caisse'}</option>{currentCashSession.data ? <option value={currentCashSession.data.cashSessionId}>{currentCashSession.data.registerName ?? 'Caisse'} - {currentCashSession.data.siteName ?? currentSite?.siteName ?? ''}</option> : null}</select></Field>
              <Field label="Paye USD"><input className="input compact-input" type="number" min="0" step="0.01" placeholder="0.00" value={form.amountPaidUsd} onChange={(event) => update('amountPaidUsd', event.target.value)} /></Field>
              <Field label="Paye CDF"><input className="input compact-input" type="number" min="0" step="0.01" placeholder="0" value={form.amountPaidCdf} onChange={(event) => update('amountPaidCdf', event.target.value)} /></Field>
              <Field label="Reference paiement"><input className="input compact-input" placeholder="Ref paiement" value={form.paymentReference} onChange={(event) => update('paymentReference', event.target.value)} /></Field>
              <Field label="Note"><input className="input compact-input" placeholder="Note" value={form.paymentNote} onChange={(event) => update('paymentNote', event.target.value)} /></Field>
            </>
          ) : (
            <div className="purchase-permission-note muted">Paiement fournisseur indisponible pour vos permissions. Vous pouvez creer et valider l'achat sans reglement.</div>
          )}
        </div>
      </section>
      <section className="card compact-card purchase-page-grid">
        <div className="erp-toolbar compact-toolbar purchase-toolbar">
          <button className="ghost-button compact-button" type="button" onClick={() => addLine()}>+ Ajouter ligne</button>
          <button className="ghost-button compact-button" type="button" onClick={duplicateSelectedLine} disabled={!selectedLineId}>Dupliquer</button>
          <button className="ghost-button compact-button" type="button" onClick={removeSelectedLine} disabled={!selectedLineId}>Supprimer</button>
          <button className="ghost-button compact-button" type="button" disabled>Importer CSV</button>
          <button className="ghost-button compact-button" type="button" disabled>Exporter CSV</button>
        </div>
        <div className="table-wrap erp-grid-wrap page-grid-wrap">
          <table className="data-table purchase-lines-table erp-grid compact-grid">
            <colgroup>
              <col className="purchase-col-status" />
              <col className="purchase-col-article" />
              <col className="purchase-col-unit" />
              <col className="purchase-col-qty" />
              <col className="purchase-col-factor" />
              <col className="purchase-col-stock-qty" />
              <col className="purchase-col-pa" />
              <col className="purchase-col-pv" />
              <col className="purchase-col-total" />
              <col className="purchase-col-lot" />
              <col className="purchase-col-expiry" />
              <col className="purchase-col-actions" />
            </colgroup>
            <thead><tr><th></th><th>Article</th><th>Unite achat</th><th>Qte achat</th><th>Facteur</th><th>Qte stock</th><th>PA</th><th>PV</th><th>Total</th><th>Lot</th><th>Expiration</th><th></th></tr></thead>
            <tbody>
              {draftLines.map((line, rowIndex) => <PurchaseGridRow key={line.id} activeAutocomplete={activeAutocomplete} activeUnitPopover={activeUnitPopover} article={articleById.get(line.articleId)} currencyCode={form.currencyCode} handleGridKey={handleGridKey} issue={lineIssues.get(line.id) ?? issueForLine(line)} line={line} removeLine={removeLine} rowIndex={rowIndex} selectArticle={selectArticle} selectPurchaseUnit={selectPurchaseUnit} selected={selectedLineId === line.id} setActiveAutocomplete={setActiveAutocomplete} setActiveUnitPopover={setActiveUnitPopover} setSelectedLineId={setSelectedLineId} stockByArticle={stockByArticle} suggestions={articleSuggestions(line)} unitSuggestions={unitSuggestions(line)} updateLine={(patch) => updateLine(line.id, patch)} />)}
              <QuickEntryRow activeAutocomplete={activeAutocomplete} activeUnitPopover={activeUnitPopover} article={articleById.get(quickLine.articleId)} commitQuickLine={commitQuickLine} currencyCode={form.currencyCode} handleGridKey={handleGridKey} issue={quickIssue} line={quickLine} rowIndex={draftLines.length} selectArticle={selectArticle} selectPurchaseUnit={selectPurchaseUnit} setActiveAutocomplete={setActiveAutocomplete} setActiveUnitPopover={setActiveUnitPopover} setSelectedLineId={setSelectedLineId} stockByArticle={stockByArticle} suggestions={articleSuggestions(quickLine)} unitSuggestions={unitSuggestions(quickLine)} updateQuickLine={updateQuickLine} />
            </tbody>
          </table>
        </div>
      </section>
      <section className="purchase-totals premium-summary compact-summary">
        <div className="form-summary"><span>Lignes</span><strong>{normalizedLines.length}</strong></div>
        <div className="form-summary"><span>Qte achat</span><strong>{totals.quantity}</strong></div>
        <div className="form-summary"><span>Qte stock</span><strong>{totals.stockQuantity}</strong></div>
        <div className="form-summary"><span>Achat</span><strong>{formatMoney(totals.purchase, form.currencyCode)}</strong></div>
        <div className="form-summary"><span>Eq. USD</span><strong>{formatMoney(purchaseEquivalentUsd, 'USD')}</strong></div>
        <div className="form-summary"><span>Vente</span><strong>{formatMoney(totals.sale, form.currencyCode)}</strong></div>
        <div className="form-summary"><span>Marge</span><strong>{formatMoney(totals.sale - totals.purchase, form.currencyCode)}</strong></div>
        <div className="form-summary"><span>Paye USD</span><strong>{formatMoney(canPayPurchase ? amountPaidUsd : 0, 'USD')}</strong></div>
        <div className="form-summary"><span>Paye CDF</span><strong>{formatMoney(canPayPurchase ? amountPaidCdf : 0, 'CDF')}</strong></div>
        <div className="form-summary"><span>Paye eq. USD</span><strong>{formatMoney(canPayPurchase ? paidEquivalentUsd : 0, 'USD')}</strong></div>
        <div className="form-summary"><span>Reste fournisseur</span><strong>{formatMoney(canPayPurchase ? remainingBalanceUsd : purchaseEquivalentUsd, 'USD')}</strong></div>
      </section>
      <section className="card compact-card purchase-payment-help">
        <p className="muted">Le stock augmentera lors de la validation de l'achat.</p>
        {canPayPurchase && form.paymentSource === 'CASH_REGISTER' && (amountPaidUsd > 0 || amountPaidCdf > 0) ? (
          <p className="muted">La caisse sera diminuee uniquement du montant reellement paye depuis la session selectionnee.</p>
        ) : null}
      </section>
      <div className="page-actions">
        <Link className="ghost-button compact-button" to="/purchases">Annuler</Link>
        <button className="button compact-button" type="button" onClick={() => submit(undefined, false)} disabled={savePurchase.isPending || suppliers.isLoading || sites.isLoading || articlesLoading}>{savePurchase.isPending ? 'Enregistrement...' : 'Enregistrer Brouillon'}</button>
        <button className="button compact-button" type="button" onClick={() => submit(undefined, true)} disabled={savePurchase.isPending || suppliers.isLoading || sites.isLoading || articlesLoading}>{savePurchase.isPending ? 'Validation...' : 'Valider Achat'}</button>
      </div>
    </form>
  );
}

function PlusIcon() {
  return <svg aria-hidden="true" className="row-action-icon" focusable="false" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>;
}

function TrashIcon() {
  return <svg aria-hidden="true" className="row-action-icon" focusable="false" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M9 10v8M15 10v8M6 6l1 14h10l1-14" /></svg>;
}

function PurchaseGridRow(props: { action?: ReactNode; activeAutocomplete: string; activeUnitPopover: string; article?: Article; currencyCode: string; handleGridKey: (event: KeyboardEvent<HTMLElement>, row: number, col: number, lineId: string) => void; issue: LineIssue; line: PurchaseDraftLine; removeLine: (id: string) => void; rowIndex: number; selectArticle: (lineId: string, article: Article) => void; selectPurchaseUnit: (lineId: string, unit: ProductUnitItem) => void; selected: boolean; setActiveAutocomplete: (id: string) => void; setActiveUnitPopover: (id: string) => void; setSelectedLineId: (id: string) => void; stockByArticle: Map<string, number>; suggestions: Article[]; unitSuggestions: ProductUnitItem[]; updateLine: (patch: Partial<PurchaseDraftLine>) => void }) {
  const { action, activeAutocomplete, activeUnitPopover, article, currencyCode, handleGridKey, issue, line, removeLine, rowIndex, selectArticle, selectPurchaseUnit, selected, setActiveAutocomplete, setActiveUnitPopover, setSelectedLineId, stockByArticle, suggestions, unitSuggestions, updateLine } = props;
  return <Fragment><tr className={`erp-grid-row line-${issue.level} ${selected ? 'selected' : ''}`} onClick={() => setSelectedLineId(line.id)}>
    <td><span className={`line-indicator ${issue.level}`}></span></td>
    <SharedArticleCell activeAutocomplete={activeAutocomplete} currencyCode={currencyCode} line={line} rowIndex={rowIndex} selectArticle={selectArticle} setActiveAutocomplete={setActiveAutocomplete} setSelectedLineId={setSelectedLineId} stockByArticle={stockByArticle} suggestions={suggestions} updateLine={updateLine} handleGridKey={handleGridKey} />
    <td className="unit-cell">
      <FloatingSearchPopover
        columns={[
          { header: 'Code', render: (unit) => unit.unitCode },
          { header: 'Unite', render: (unit) => unit.unitLabel },
        ]}
        dataGridCell={`${rowIndex}-1`}
        getKey={(unit) => unit.productUnitId}
        onChange={(value) => { setActiveUnitPopover(line.id); updateLine({ purchaseUnitQuery: value, purchaseUnitId: '' }); }}
        onClose={() => setActiveUnitPopover('')}
        onFallbackKeyDown={(event) => handleGridKey(event, rowIndex, 1, line.id)}
        onFocusNext={() => document.querySelector<HTMLElement>(`[data-grid-cell="${rowIndex}-2"]`)?.focus()}
        onOpen={() => { setSelectedLineId(line.id); setActiveUnitPopover(line.id); }}
        onSelect={(unit) => selectPurchaseUnit(line.id, unit)}
        open={activeUnitPopover === line.id}
        placeholder="Unite achat"
        searchPlaceholder="Rechercher unite d'achat..."
        suggestions={unitSuggestions}
        value={line.purchaseUnitQuery}
      />
    </td>
    <td><input className="input compact-input numeric-cell" data-grid-cell={`${rowIndex}-2`} type="number" min="0.001" step="0.001" placeholder="Qte achat" value={line.quantity} onKeyDown={(event) => handleGridKey(event, rowIndex, 2, line.id)} onChange={(event) => updateLine({ quantity: event.target.value })} /></td>
    <td><input className="input compact-input numeric-cell" data-grid-cell={`${rowIndex}-3`} type="number" min="0.0001" step="0.0001" placeholder="Facteur" value={line.conversionFactor} onKeyDown={(event) => handleGridKey(event, rowIndex, 3, line.id)} onChange={(event) => updateLine({ conversionFactor: event.target.value })} /></td>
    <td className="numeric-text"><strong>{lineStockQuantity(line)}</strong><small>{line.stockUnitLabel || 'Unite'}</small></td>
    <td><input className="input compact-input numeric-cell" data-grid-cell={`${rowIndex}-4`} type="number" min="0.01" step="0.01" placeholder="PA" value={line.purchaseUnitPrice} onKeyDown={(event) => handleGridKey(event, rowIndex, 4, line.id)} onChange={(event) => updateLine({ purchaseUnitPrice: event.target.value })} /></td>
    <td><input className="input compact-input numeric-cell" data-grid-cell={`${rowIndex}-5`} type="number" min="0" step="0.01" placeholder="PV" value={line.sellingUnitPrice} onKeyDown={(event) => handleGridKey(event, rowIndex, 5, line.id)} onChange={(event) => updateLine({ sellingUnitPrice: event.target.value })} /></td>
    <td className="numeric-text"><strong>{formatMoney(lineTotal(line), currencyCode)}</strong></td>
    <td><input className="input compact-input" data-grid-cell={`${rowIndex}-6`} placeholder="Lot" value={line.lotNumber} onKeyDown={(event) => handleGridKey(event, rowIndex, 6, line.id)} onChange={(event) => updateLine({ lotNumber: event.target.value })} /></td>
    <td><input className="input compact-input" data-grid-cell={`${rowIndex}-7`} type="date" value={line.expiryDate} onKeyDown={(event) => handleGridKey(event, rowIndex, 7, line.id)} onChange={(event) => updateLine({ expiryDate: event.target.value })} /></td>
    <td>{action ?? <button aria-label="Supprimer la ligne" className="ghost-button compact-button row-action-button icon-only danger" title="Supprimer la ligne" type="button" onClick={() => removeLine(line.id)}><TrashIcon /></button>}</td>
  </tr>{issue.level !== 'valid' && <tr className="line-message-row"><td className={`line-message ${issue.level}`} colSpan={12}>{issue.message}</td></tr>}</Fragment>;
}

function SharedArticleCell({ activeAutocomplete, currencyCode, handleGridKey, line, rowIndex, selectArticle, setActiveAutocomplete, setSelectedLineId, stockByArticle, suggestions, updateLine }: { activeAutocomplete: string; currencyCode: string; handleGridKey: (event: KeyboardEvent<HTMLElement>, row: number, col: number, lineId: string) => void; line: PurchaseDraftLine; rowIndex: number; selectArticle: (lineId: string, article: Article) => void; setActiveAutocomplete: (id: string) => void; setSelectedLineId: (id: string) => void; stockByArticle: Map<string, number>; suggestions: Article[]; updateLine: (patch: Partial<PurchaseDraftLine>) => void }) {
  const isOpen = activeAutocomplete === line.id;
  const updateArticleQuery = (value: string) => {
    setActiveAutocomplete(line.id);
    updateLine({ articleQuery: value, articleId: '' });
  };
  return <td className="autocomplete-cell sticky-article-cell">
    <FloatingSearchPopover
      columns={[
        { header: 'Code', render: (article) => article.articleCode },
        { header: 'Barcode', render: (article) => article.barcode ?? '-' },
        { header: 'Nom', render: (article) => <strong>{article.commercialName}</strong> },
        { header: 'DCI', render: (article) => article.dci ?? '-' },
        { header: 'Dosage', render: (article) => article.dosage ?? '-' },
        { header: 'Stock', render: (article) => stockByArticle.get(article.articleId) ?? article.stockAvailable ?? 0 },
        { header: 'Prix vente', render: (article) => formatMoney(article.sellingPrice ?? 0, currencyCode) },
      ]}
      dataGridCell={`${rowIndex}-0`}
      getKey={(article) => article.articleId}
      onChange={updateArticleQuery}
      onClose={() => setActiveAutocomplete('')}
      onFallbackKeyDown={(event) => handleGridKey(event, rowIndex, 0, line.id)}
      onFocusNext={() => document.querySelector<HTMLElement>(`[data-grid-cell="${rowIndex}-1"]`)?.focus()}
      onOpen={() => { setSelectedLineId(line.id); setActiveAutocomplete(line.id); }}
      onSelect={(article) => selectArticle(line.id, article)}
      open={isOpen}
      placeholder="Scanner code-barres ou rechercher article..."
      searchPlaceholder="Rechercher (code, nom, DCI, dosage, barcode...)"
      suggestions={suggestions}
      value={line.articleQuery}
    />
  </td>;
}

function prioritizeExactBarcode(articles: Article[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return articles;
  return [...articles].sort((a, b) => Number(String(b.barcode ?? '').toLowerCase() === needle) - Number(String(a.barcode ?? '').toLowerCase() === needle));
}

function QuickEntryRow(props: { activeAutocomplete: string; activeUnitPopover: string; article?: Article; commitQuickLine: () => void; currencyCode: string; handleGridKey: (event: KeyboardEvent<HTMLElement>, row: number, col: number, lineId: string) => void; issue: LineIssue; line: PurchaseDraftLine; rowIndex: number; selectArticle: (lineId: string, article: Article) => void; selectPurchaseUnit: (lineId: string, unit: ProductUnitItem) => void; setActiveAutocomplete: (id: string) => void; setActiveUnitPopover: (id: string) => void; setSelectedLineId: (id: string) => void; stockByArticle: Map<string, number>; suggestions: Article[]; unitSuggestions: ProductUnitItem[]; updateQuickLine: (patch: Partial<PurchaseDraftLine>) => void }) {
  const { activeAutocomplete, activeUnitPopover, commitQuickLine, currencyCode, handleGridKey, issue, line, rowIndex, selectArticle, selectPurchaseUnit, setActiveAutocomplete, setActiveUnitPopover, setSelectedLineId, stockByArticle, suggestions, unitSuggestions, updateQuickLine } = props;
  return <PurchaseGridRow action={<button aria-label="Ajouter la ligne" className="ghost-button compact-button row-action-button icon-only add" title="Ajouter la ligne" type="button" disabled={issue.blocksSave} onClick={commitQuickLine}><PlusIcon /></button>} activeAutocomplete={activeAutocomplete} activeUnitPopover={activeUnitPopover} article={props.article} currencyCode={currencyCode} handleGridKey={handleGridKey} issue={issue} line={line} removeLine={() => updateQuickLine(newLine())} rowIndex={rowIndex} selectArticle={selectArticle} selectPurchaseUnit={selectPurchaseUnit} selected={false} setActiveAutocomplete={setActiveAutocomplete} setActiveUnitPopover={setActiveUnitPopover} setSelectedLineId={setSelectedLineId} stockByArticle={stockByArticle} suggestions={suggestions} unitSuggestions={unitSuggestions} updateLine={updateQuickLine} />;
}
