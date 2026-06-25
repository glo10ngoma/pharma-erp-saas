import { Fragment, FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Article, articlesService } from '../../services/articles.service';
import { apiErrorMessage } from '../../services/apiError';
import { codeGeneratorService } from '../../services/codeGenerator.service';
import { purchasesService } from '../../services/purchases.service';
import { referenceService } from '../../services/reference.service';
import { sitesService } from '../../services/sites.service';
import { stocksService } from '../../services/stocks.service';
import { formatMoney } from '../../utils/money';

type PurchaseForm = { purchaseNumber: string; supplierId: string; siteId: string; purchaseDate: string; currencyCode: string; exchangeRate: string; observation: string };
type PurchaseDraftLine = { id: string; articleId: string; articleQuery: string; lotNumber: string; expiryDate: string; quantity: string; purchaseUnitPrice: string; sellingUnitPrice: string };
type LineIssue = { level: 'valid' | 'warning' | 'danger'; message: string; blocksSave: boolean };

const initialForm = (): PurchaseForm => ({ purchaseNumber: '', supplierId: '', siteId: '', purchaseDate: new Date().toISOString().slice(0, 10), currencyCode: 'USD', exchangeRate: '1', observation: '' });
const newLine = (): PurchaseDraftLine => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, articleId: '', articleQuery: '', lotNumber: '', expiryDate: '', quantity: '1', purchaseUnitPrice: '', sellingUnitPrice: '' });

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
function lineTotal(line: PurchaseDraftLine) { return Number(line.quantity || 0) * Number(line.purchaseUnitPrice || 0); }
function lineSaleTotal(line: PurchaseDraftLine) { return Number(line.quantity || 0) * Number(line.sellingUnitPrice || 0); }
function issueForLine(line: PurchaseDraftLine): LineIssue {
  if (!line.articleId) return { level: 'warning', message: 'Article absent.', blocksSave: true };
  if (!line.lotNumber.trim()) return { level: 'warning', message: 'Lot manquant.', blocksSave: true };
  if (!line.expiryDate) return { level: 'warning', message: 'Expiration manquante.', blocksSave: true };
  if (Number(line.quantity) <= 0) return { level: 'danger', message: 'Quantite <= 0.', blocksSave: true };
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
  const [form, setForm] = useState<PurchaseForm>(initialForm);
  const [draftLines, setDraftLines] = useState<PurchaseDraftLine[]>([]);
  const [quickLine, setQuickLine] = useState<PurchaseDraftLine>(newLine());
  const [selectedLineId, setSelectedLineId] = useState('');
  const [activeAutocomplete, setActiveAutocomplete] = useState('');
  const [clientError, setClientError] = useState('');

  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: async () => (await referenceService.suppliers.getAll()).data });
  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const articles = useQuery({ queryKey: ['articles'], queryFn: async () => (await articlesService.getAll({ limit: 500 })).data.items });
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await referenceService.categories.getAll()).data });
  const forms = useQuery({ queryKey: ['galenic-forms'], queryFn: async () => (await referenceService.galenicForms.getAll()).data });
  const stocks = useQuery({ queryKey: ['stocks'], queryFn: async () => (await stocksService.getAll()).data });
  const nextCode = useQuery({ queryKey: ['next-code', 'purchases', 'page'], queryFn: async () => (await codeGeneratorService.next('purchases')).data.code });

  useEffect(() => { if (!form.purchaseNumber && nextCode.data) setForm((current) => ({ ...current, purchaseNumber: nextCode.data ?? '' })); }, [form.purchaseNumber, nextCode.data]);

  const articleById = useMemo(() => new Map((articles.data ?? []).map((article) => [article.articleId, article])), [articles.data]);
  const categoryById = useMemo(() => new Map((categories.data ?? []).map((category) => [category.categoryId, category.categoryName])), [categories.data]);
  const formById = useMemo(() => new Map((forms.data ?? []).map((item) => [item.formId, item.formName])), [forms.data]);
  const stockByArticle = useMemo(() => {
    const map = new Map<string, number>();
    for (const stock of stocks.data ?? []) map.set(stock.articleId, (map.get(stock.articleId) ?? 0) + stock.quantityAvailable);
    return map;
  }, [stocks.data]);
  const lineIssues = useMemo(() => new Map(draftLines.map((line) => [line.id, issueForLine(line)])), [draftLines]);
  const quickIssue = useMemo(() => issueForLine(quickLine), [quickLine]);
  const hasBlockingError = draftLines.length === 0 || [...lineIssues.values()].some((issue) => issue.blocksSave);
  const totals = useMemo(() => {
    const articleIds = new Set<string>();
    return draftLines.reduce((acc, line) => {
      if (line.articleId) articleIds.add(line.articleId);
      const quantity = Number(line.quantity || 0);
      acc.quantity += Number.isFinite(quantity) ? quantity : 0;
      acc.purchase += lineTotal(line);
      acc.sale += lineSaleTotal(line);
      acc.articleCount = articleIds.size;
      return acc;
    }, { articleCount: 0, quantity: 0, purchase: 0, sale: 0 });
  }, [draftLines]);
  const currentSupplier = suppliers.data?.find((supplier) => supplier.supplierId === form.supplierId);
  const currentSite = sites.data?.find((site) => site.siteId === form.siteId);

  const create = useMutation({
    mutationFn: async () => {
      const purchase = (await purchasesService.create({ purchaseNumber: form.purchaseNumber.trim() || undefined, supplierId: form.supplierId, siteId: form.siteId, purchaseDate: form.purchaseDate, exchangeRate: Number(form.exchangeRate || 1) })).data;
      for (const line of draftLines) {
        await purchasesService.addItem(purchase.purchaseId, { articleId: line.articleId, lotNumber: line.lotNumber.trim(), expiryDate: line.expiryDate, quantity: Number(line.quantity), purchaseUnitPrice: Number(line.purchaseUnitPrice), sellingUnitPrice: Number(line.sellingUnitPrice || 0) });
      }
      return purchase;
    },
    onSuccess: (purchase) => navigate(`/purchases/${purchase.purchaseId}`),
  });

  function update<K extends keyof PurchaseForm>(key: K, value: PurchaseForm[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function updateLine(id: string, patch: Partial<PurchaseDraftLine>) { setDraftLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line)); }
  function updateQuickLine(patch: Partial<PurchaseDraftLine>) { setQuickLine((current) => ({ ...current, ...patch })); }
  function focusCell(row: number, col: number) { document.querySelector<HTMLElement>(`[data-grid-cell="${row}-${col}"]`)?.focus(); }
  function addLine(afterId?: string) {
    const line = newLine();
    setDraftLines((current) => {
      if (!afterId) return [...current, line];
      const index = current.findIndex((item) => item.id === afterId);
      return index === -1 ? [...current, line] : [...current.slice(0, index + 1), line, ...current.slice(index + 1)];
    });
    setSelectedLineId(line.id);
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
    setDraftLines((current) => {
      const index = current.findIndex((item) => item.id === selectedLineId);
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
    setSelectedLineId(copy.id);
  }
  function removeLine(id: string) { setDraftLines((current) => current.filter((line) => line.id !== id)); }
  function removeSelectedLine() { if (selectedLineId) removeLine(selectedLineId); }
  function selectArticle(lineId: string, article: Article) {
    const sameArticleCount = draftLines.filter((line) => line.articleId === article.articleId).length + (quickLine.articleId === article.articleId ? 1 : 0) + 1;
    const patch = { articleId: article.articleId, articleQuery: `${article.articleCode} - ${article.commercialName}`, lotNumber: `${lotBase(article, form.purchaseDate)}-${String(sameArticleCount).padStart(3, '0')}`, sellingUnitPrice: article.sellingPrice ? String(article.sellingPrice) : '' };
    if (lineId === quickLine.id) updateQuickLine(patch); else updateLine(lineId, patch);
    setActiveAutocomplete('');
  }
  function articleSuggestions(line: PurchaseDraftLine) {
    const query = line.articleQuery.trim().toLowerCase();
    const source = articles.data ?? [];
    if (!query) return source.slice(0, 8);
    return source.filter((article) => [article.articleCode, article.commercialName, article.dci, article.dosage].some((value) => String(value ?? '').toLowerCase().includes(query))).slice(0, 8);
  }
  function validateDraftLines() {
    if (draftLines.length === 0) return 'Ajoutez au moins une ligne achat.';
    const blocking = draftLines.map((line, index) => ({ issue: issueForLine(line), index })).find(({ issue }) => issue.blocksSave);
    return blocking ? `Ligne ${blocking.index + 1}: ${blocking.issue.message}` : '';
  }
  function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const error = validateDraftLines();
    if (error) { setClientError(error); return; }
    setClientError('');
    create.mutate();
  }
  function handleGridKey(event: KeyboardEvent<HTMLElement>, row: number, col: number, lineId: string) {
    if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); if (!hasBlockingError && !create.isPending) submit(); return; }
    if (event.ctrlKey && event.key.toLowerCase() === 'l') { event.preventDefault(); addLine(lineId); return; }
    if (event.ctrlKey && event.key === 'Delete') { event.preventDefault(); lineId === quickLine.id ? setQuickLine(newLine()) : removeLine(lineId); return; }
    if (event.key === 'Escape') { event.preventDefault(); navigate('/purchases'); return; }
    if (event.key === 'Enter') { event.preventDefault(); if (lineId === quickLine.id) commitQuickLine(); else focusCell(Math.min(row + 1, draftLines.length), col); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); focusCell(Math.min(row + 1, draftLines.length), col); }
    if (event.key === 'ArrowUp') { event.preventDefault(); focusCell(Math.max(row - 1, 0), col); }
  }

  return (
    <form className="purchase-page purchase-form purchase-erp-window" onSubmit={submit}>
      <div className="breadcrumb"><Link to="/purchases">Achats</Link><span>&gt;</span><strong>Nouvel Achat</strong></div>
      {(create.isError || clientError) && <p className="form-error">{clientError || apiErrorMessage(create.error)}</p>}
      <div className="purchase-sticky-header purchase-page-header">
        <div><span>Code</span><strong>{form.purchaseNumber || 'ACH-...'}</strong></div>
        <div><span>Fournisseur</span><strong>{currentSupplier?.supplierName ?? '-'}</strong></div>
        <div><span>Date</span><strong>{form.purchaseDate}</strong></div>
        <div><span>Site</span><strong>{currentSite?.siteName ?? '-'}</strong></div>
        <div><span>Devise</span><strong>{form.currencyCode}</strong></div>
        <div><span>Total</span><strong>{formatMoney(totals.purchase, form.currencyCode)}</strong></div>
        <div><span>Statut</span><strong><span className="badge badge-warning">DRAFT</span></strong></div>
      </div>
      <section className="card compact-card">
        <div className="form-grid purchase-page-fields">
          <Field label="Code"><input className="input compact-input" placeholder="ACH-000001" value={form.purchaseNumber} onChange={(event) => update('purchaseNumber', event.target.value)} required /></Field>
          <Field label="Fournisseur"><select className="input compact-input" value={form.supplierId} onChange={(event) => update('supplierId', event.target.value)} required><option value="">Fournisseur</option>{(suppliers.data ?? []).map((supplier) => <option key={supplier.supplierId} value={supplier.supplierId}>{supplier.supplierName}</option>)}</select></Field>
          <Field label="Date"><input className="input compact-input" type="date" value={form.purchaseDate} onChange={(event) => update('purchaseDate', event.target.value)} required /></Field>
          <Field label="Site"><select className="input compact-input" value={form.siteId} onChange={(event) => update('siteId', event.target.value)} required><option value="">Site</option>{(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}</select></Field>
          <Field label="Devise"><select className="input compact-input" value={form.currencyCode} disabled><option value="USD">USD</option></select></Field>
          <Field label="Taux"><input className="input compact-input" type="number" min="1" step="0.0001" placeholder="1" value={form.exchangeRate} onChange={(event) => update('exchangeRate', event.target.value)} required /></Field>
        </div>
      </section>
      <section className="card compact-card purchase-page-grid">
        <div className="erp-toolbar compact-toolbar">
          <button className="ghost-button compact-button" type="button" onClick={() => addLine()}>+ Ligne</button>
          <button className="ghost-button compact-button" type="button" onClick={duplicateSelectedLine} disabled={!selectedLineId}>Dupliquer</button>
          <button className="ghost-button compact-button" type="button" onClick={removeSelectedLine} disabled={!selectedLineId}>Supprimer</button>
          <button className="ghost-button compact-button" type="button" disabled>Importer CSV</button>
          <button className="ghost-button compact-button" type="button" disabled>Exporter CSV</button>
        </div>
        <div className="table-wrap erp-grid-wrap page-grid-wrap">
          <table className="data-table purchase-lines-table erp-grid compact-grid">
            <thead><tr><th></th><th>Article</th><th>Lot</th><th>Expiration</th><th>Qte</th><th>PA</th><th>PV</th><th>Total</th><th>Infos</th><th></th></tr></thead>
            <tbody>
              {draftLines.map((line, rowIndex) => <PurchaseGridRow key={line.id} activeAutocomplete={activeAutocomplete} article={articleById.get(line.articleId)} categoryById={categoryById} currencyCode={form.currencyCode} formById={formById} handleGridKey={handleGridKey} issue={lineIssues.get(line.id) ?? issueForLine(line)} line={line} removeLine={removeLine} rowIndex={rowIndex} selectArticle={selectArticle} selected={selectedLineId === line.id} setActiveAutocomplete={setActiveAutocomplete} setSelectedLineId={setSelectedLineId} stockByArticle={stockByArticle} suggestions={articleSuggestions(line)} updateLine={(patch) => updateLine(line.id, patch)} />)}
              <QuickEntryRow activeAutocomplete={activeAutocomplete} article={articleById.get(quickLine.articleId)} categoryById={categoryById} commitQuickLine={commitQuickLine} currencyCode={form.currencyCode} formById={formById} handleGridKey={handleGridKey} issue={quickIssue} line={quickLine} rowIndex={draftLines.length} selectArticle={selectArticle} setActiveAutocomplete={setActiveAutocomplete} setSelectedLineId={setSelectedLineId} stockByArticle={stockByArticle} suggestions={articleSuggestions(quickLine)} updateQuickLine={updateQuickLine} />
            </tbody>
          </table>
        </div>
      </section>
      <section className="purchase-totals premium-summary compact-summary">
        <div className="form-summary"><span>Lignes</span><strong>{draftLines.length}</strong></div>
        <div className="form-summary"><span>Qte</span><strong>{totals.quantity}</strong></div>
        <div className="form-summary"><span>Achat</span><strong>{formatMoney(totals.purchase, form.currencyCode)}</strong></div>
        <div className="form-summary"><span>Vente</span><strong>{formatMoney(totals.sale, form.currencyCode)}</strong></div>
        <div className="form-summary"><span>Marge</span><strong>{formatMoney(totals.sale - totals.purchase, form.currencyCode)}</strong></div>
      </section>
      <div className="page-actions">
        <Link className="ghost-button compact-button" to="/purchases">Annuler</Link>
        <button className="button compact-button" disabled={create.isPending || suppliers.isLoading || sites.isLoading || articles.isLoading || hasBlockingError}>{create.isPending ? 'Enregistrement...' : 'Enregistrer Brouillon'}</button>
        <button className="button compact-button" type="button" disabled title="Disponible apres creation du brouillon">Valider Achat</button>
      </div>
    </form>
  );
}

function PurchaseGridRow(props: { activeAutocomplete: string; article?: Article; categoryById: Map<string, string>; currencyCode: string; formById: Map<string, string>; handleGridKey: (event: KeyboardEvent<HTMLElement>, row: number, col: number, lineId: string) => void; issue: LineIssue; line: PurchaseDraftLine; removeLine: (id: string) => void; rowIndex: number; selectArticle: (lineId: string, article: Article) => void; selected: boolean; setActiveAutocomplete: (id: string) => void; setSelectedLineId: (id: string) => void; stockByArticle: Map<string, number>; suggestions: Article[]; updateLine: (patch: Partial<PurchaseDraftLine>) => void }) {
  const { activeAutocomplete, article, categoryById, currencyCode, formById, handleGridKey, issue, line, removeLine, rowIndex, selectArticle, selected, setActiveAutocomplete, setSelectedLineId, stockByArticle, suggestions, updateLine } = props;
  return <Fragment><tr className={`erp-grid-row line-${issue.level} ${selected ? 'selected' : ''}`} onClick={() => setSelectedLineId(line.id)}>
    <td><span className={`line-indicator ${issue.level}`}></span></td>
    <ArticleCell activeAutocomplete={activeAutocomplete} article={article} formById={formById} line={line} rowIndex={rowIndex} selectArticle={selectArticle} setActiveAutocomplete={setActiveAutocomplete} setSelectedLineId={setSelectedLineId} suggestions={suggestions} updateLine={updateLine} handleGridKey={handleGridKey} />
    <td><input className="input compact-input" data-grid-cell={`${rowIndex}-1`} placeholder="Lot" value={line.lotNumber} onKeyDown={(event) => handleGridKey(event, rowIndex, 1, line.id)} onChange={(event) => updateLine({ lotNumber: event.target.value })} /></td>
    <td><input className="input compact-input" data-grid-cell={`${rowIndex}-2`} type="date" value={line.expiryDate} onKeyDown={(event) => handleGridKey(event, rowIndex, 2, line.id)} onChange={(event) => updateLine({ expiryDate: event.target.value })} /></td>
    <td><input className="input compact-input numeric-cell" data-grid-cell={`${rowIndex}-3`} type="number" min="0.001" step="0.001" placeholder="Qte" value={line.quantity} onKeyDown={(event) => handleGridKey(event, rowIndex, 3, line.id)} onChange={(event) => updateLine({ quantity: event.target.value })} /></td>
    <td><input className="input compact-input numeric-cell" data-grid-cell={`${rowIndex}-4`} type="number" min="0.01" step="0.01" placeholder="PA" value={line.purchaseUnitPrice} onKeyDown={(event) => handleGridKey(event, rowIndex, 4, line.id)} onChange={(event) => updateLine({ purchaseUnitPrice: event.target.value })} /></td>
    <td><input className="input compact-input numeric-cell" data-grid-cell={`${rowIndex}-5`} type="number" min="0" step="0.01" placeholder="PV" value={line.sellingUnitPrice} onKeyDown={(event) => handleGridKey(event, rowIndex, 5, line.id)} onChange={(event) => updateLine({ sellingUnitPrice: event.target.value })} /></td>
    <td className="numeric-text"><strong>{formatMoney(lineTotal(line), currencyCode)}</strong></td>
    <td className="article-readonly"><span>{categoryById.get(article?.categoryId ?? '') ?? '-'}</span><span>{formById.get(article?.formId ?? '') ?? '-'}</span><span>Stock: {article ? (stockByArticle.get(article.articleId) ?? article.stockAvailable ?? 0) : '-'}</span><span>Min: {article?.defaultStockMin ?? '-'}</span></td>
    <td><button className="ghost-button compact-button" type="button" onClick={() => removeLine(line.id)}>X</button></td>
  </tr>{issue.level !== 'valid' && <tr className="line-message-row"><td className={`line-message ${issue.level}`} colSpan={10}>{issue.message}</td></tr>}</Fragment>;
}

function ArticleCell({ activeAutocomplete, formById, handleGridKey, line, rowIndex, selectArticle, setActiveAutocomplete, setSelectedLineId, suggestions, updateLine }: { activeAutocomplete: string; article?: Article; formById: Map<string, string>; handleGridKey: (event: KeyboardEvent<HTMLElement>, row: number, col: number, lineId: string) => void; line: PurchaseDraftLine; rowIndex: number; selectArticle: (lineId: string, article: Article) => void; setActiveAutocomplete: (id: string) => void; setSelectedLineId: (id: string) => void; suggestions: Article[]; updateLine: (patch: Partial<PurchaseDraftLine>) => void }) {
  const isOpen = activeAutocomplete === line.id;

  return <td className="autocomplete-cell sticky-article-cell">
    <input
      className="input compact-input"
      data-grid-cell={`${rowIndex}-0`}
      placeholder="Code, nom, DCI..."
      value={line.articleQuery}
      onBlur={() => window.setTimeout(() => setActiveAutocomplete(''), 120)}
      onFocus={() => { setSelectedLineId(line.id); setActiveAutocomplete(line.id); }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && isOpen && suggestions[0]) {
          event.preventDefault();
          selectArticle(line.id, suggestions[0]);
          return;
        }
        handleGridKey(event, rowIndex, 0, line.id);
      }}
      onChange={(event) => {
        setActiveAutocomplete(line.id);
        updateLine({ articleQuery: event.target.value, articleId: '' });
      }}
    />
    {isOpen && suggestions.length > 0 && <div className="autocomplete-menu">
      {suggestions.map((suggestion) => <button type="button" key={suggestion.articleId} onMouseDown={(event) => { event.preventDefault(); selectArticle(line.id, suggestion); }}>
        <strong>{suggestion.articleCode}</strong>
        <span>{suggestion.commercialName}</span>
        <small>{formById.get(suggestion.formId ?? '') ?? '-'} | {suggestion.dosage ?? '-'}</small>
      </button>)}
    </div>}
  </td>;
}

function QuickEntryRow(props: { activeAutocomplete: string; article?: Article; categoryById: Map<string, string>; commitQuickLine: () => void; currencyCode: string; formById: Map<string, string>; handleGridKey: (event: KeyboardEvent<HTMLElement>, row: number, col: number, lineId: string) => void; issue: LineIssue; line: PurchaseDraftLine; rowIndex: number; selectArticle: (lineId: string, article: Article) => void; setActiveAutocomplete: (id: string) => void; setSelectedLineId: (id: string) => void; stockByArticle: Map<string, number>; suggestions: Article[]; updateQuickLine: (patch: Partial<PurchaseDraftLine>) => void }) {
  const { activeAutocomplete, categoryById, commitQuickLine, currencyCode, formById, handleGridKey, issue, line, rowIndex, selectArticle, setActiveAutocomplete, setSelectedLineId, stockByArticle, suggestions, updateQuickLine } = props;
  return <PurchaseGridRow activeAutocomplete={activeAutocomplete} article={props.article} categoryById={categoryById} currencyCode={currencyCode} formById={formById} handleGridKey={handleGridKey} issue={issue} line={line} removeLine={() => updateQuickLine(newLine())} rowIndex={rowIndex} selectArticle={selectArticle} selected={false} setActiveAutocomplete={setActiveAutocomplete} setSelectedLineId={setSelectedLineId} stockByArticle={stockByArticle} suggestions={suggestions} updateLine={updateQuickLine} />;
}
