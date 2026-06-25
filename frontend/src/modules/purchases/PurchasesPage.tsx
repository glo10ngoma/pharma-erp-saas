import { Fragment, FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Article, articlesService } from '../../services/articles.service';
import { apiErrorMessage } from '../../services/apiError';
import { codeGeneratorService } from '../../services/codeGenerator.service';
import { purchasesService, Purchase } from '../../services/purchases.service';
import { referenceService } from '../../services/reference.service';
import { sitesService } from '../../services/sites.service';
import { stocksService } from '../../services/stocks.service';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { formatMoney } from '../../utils/money';

type PurchaseForm = {
  purchaseNumber: string;
  supplierId: string;
  siteId: string;
  purchaseDate: string;
  currencyCode: string;
  exchangeRate: string;
  observation: string;
};

type PurchaseDraftLine = {
  id: string;
  articleId: string;
  articleQuery: string;
  lotNumber: string;
  expiryDate: string;
  quantity: string;
  purchaseUnitPrice: string;
  sellingUnitPrice: string;
};

type LineIssue = {
  level: 'valid' | 'warning' | 'danger';
  message: string;
  blocksSave: boolean;
};

const initialForm = (): PurchaseForm => ({
  purchaseNumber: '',
  supplierId: '',
  siteId: '',
  purchaseDate: new Date().toISOString().slice(0, 10),
  currencyCode: 'USD',
  exchangeRate: '1',
  observation: '',
});

const newLine = (): PurchaseDraftLine => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  articleId: '',
  articleQuery: '',
  lotNumber: '',
  expiryDate: '',
  quantity: '1',
  purchaseUnitPrice: '',
  sellingUnitPrice: '',
});

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field-block">
      <span>{label}</span>
      {children}
    </label>
  );
}

function statusBadge(status: string) {
  if (status === 'VALIDATED') return 'badge-success';
  if (status === 'DRAFT') return 'badge-warning';
  return 'badge-muted';
}

function yyyymmdd(value: string) {
  return (value || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
}

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

function lineTotal(line: PurchaseDraftLine) {
  return Number(line.quantity || 0) * Number(line.purchaseUnitPrice || 0);
}

function lineSaleTotal(line: PurchaseDraftLine) {
  return Number(line.quantity || 0) * Number(line.sellingUnitPrice || 0);
}

function issueForLine(line: PurchaseDraftLine): LineIssue {
  if (!line.articleId) return { level: 'warning', message: 'Article absent.', blocksSave: true };
  if (!line.lotNumber.trim()) return { level: 'warning', message: 'Numero de lot manquant.', blocksSave: true };
  if (!line.expiryDate) return { level: 'warning', message: 'Date expiration manquante.', blocksSave: true };
  if (Number(line.quantity) <= 0) return { level: 'danger', message: 'Quantite <= 0.', blocksSave: true };
  if (Number(line.purchaseUnitPrice) <= 0) return { level: 'danger', message: 'Prix achat <= 0.', blocksSave: true };
  if (Number(line.sellingUnitPrice || 0) < 0) return { level: 'danger', message: 'Prix vente invalide.', blocksSave: true };
  const days = daysUntil(line.expiryDate);
  if (days !== null && days < 0) return { level: 'danger', message: 'Expiration passee.', blocksSave: true };
  if (days !== null && days < 30) return { level: 'danger', message: 'Expiration dans moins de 30 jours.', blocksSave: false };
  if (days !== null && days < 90) return { level: 'warning', message: 'Expiration dans moins de 90 jours.', blocksSave: false };
  return { level: 'valid', message: 'Ligne valide.', blocksSave: false };
}

export function PurchasesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState('');
  const [activeAutocomplete, setActiveAutocomplete] = useState('');
  const [form, setForm] = useState<PurchaseForm>(initialForm);
  const [draftLines, setDraftLines] = useState<PurchaseDraftLine[]>([]);
  const [quickLine, setQuickLine] = useState<PurchaseDraftLine>(newLine());
  const [clientError, setClientError] = useState('');

  const purchases = useQuery({ queryKey: ['purchases', status], queryFn: async () => (await purchasesService.getAll(status)).data });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: async () => (await referenceService.suppliers.getAll()).data });
  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const articles = useQuery({ queryKey: ['articles'], queryFn: async () => (await articlesService.getAll({ limit: 500 })).data.items });
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await referenceService.categories.getAll()).data });
  const forms = useQuery({ queryKey: ['galenic-forms'], queryFn: async () => (await referenceService.galenicForms.getAll()).data });
  const stocks = useQuery({ queryKey: ['stocks'], queryFn: async () => (await stocksService.getAll()).data });
  const nextCode = useQuery({ queryKey: ['next-code', 'purchases', createOpen], enabled: createOpen, queryFn: async () => (await codeGeneratorService.next('purchases')).data.code });
  const detail = useQuery({ queryKey: ['purchase', selectedPurchaseId], enabled: Boolean(selectedPurchaseId), queryFn: async () => (await purchasesService.getById(selectedPurchaseId as string)).data });

  const articleById = useMemo(() => new Map((articles.data ?? []).map((article) => [article.articleId, article])), [articles.data]);
  const categoryById = useMemo(() => new Map((categories.data ?? []).map((category) => [category.categoryId, category.categoryName])), [categories.data]);
  const formById = useMemo(() => new Map((forms.data ?? []).map((item) => [item.formId, item.formName])), [forms.data]);
  const stockByArticle = useMemo(() => {
    const map = new Map<string, number>();
    for (const stock of stocks.data ?? []) {
      map.set(stock.articleId, (map.get(stock.articleId) ?? 0) + stock.quantityAvailable);
    }
    return map;
  }, [stocks.data]);

  useEffect(() => {
    if (createOpen && !form.purchaseNumber && nextCode.data) {
      setForm((current) => ({ ...current, purchaseNumber: nextCode.data ?? '' }));
    }
  }, [createOpen, form.purchaseNumber, nextCode.data]);

  const rows = useMemo(() => filterRows(purchases.data ?? [], search, (purchase) => [
    purchase.purchaseNumber,
    purchase.supplierName,
    purchase.status,
    purchase.purchaseDate,
    purchase.siteName,
  ]), [purchases.data, search]);

  const lineIssues = useMemo(() => new Map(draftLines.map((line) => [line.id, issueForLine(line)])), [draftLines]);
  const quickIssue = useMemo(() => issueForLine(quickLine), [quickLine]);
  const hasBlockingError = draftLines.length === 0 || [...lineIssues.values()].some((issue) => issue.blocksSave);

  const totals = useMemo(() => {
    const articleIds = new Set<string>();
    return draftLines.reduce(
      (acc, line) => {
        if (line.articleId) articleIds.add(line.articleId);
        const quantity = Number(line.quantity || 0);
        acc.quantity += Number.isFinite(quantity) ? quantity : 0;
        acc.purchase += lineTotal(line);
        acc.sale += lineSaleTotal(line);
        acc.articleCount = articleIds.size;
        return acc;
      },
      { articleCount: 0, quantity: 0, purchase: 0, sale: 0 },
    );
  }, [draftLines]);

  const create = useMutation({
    mutationFn: async () => {
      const purchase = (await purchasesService.create({
        purchaseNumber: form.purchaseNumber.trim() || undefined,
        supplierId: form.supplierId,
        siteId: form.siteId,
        purchaseDate: form.purchaseDate,
        exchangeRate: Number(form.exchangeRate || 1),
      })).data;

      for (const line of draftLines) {
        await purchasesService.addItem(purchase.purchaseId, {
          articleId: line.articleId,
          lotNumber: line.lotNumber.trim(),
          expiryDate: line.expiryDate,
          quantity: Number(line.quantity),
          purchaseUnitPrice: Number(line.purchaseUnitPrice),
          sellingUnitPrice: Number(line.sellingUnitPrice || 0),
        });
      }
      return purchase;
    },
    onSuccess: async (purchase) => {
      setCreateOpen(false);
      resetDraft();
      setSelectedPurchaseId(purchase.purchaseId);
      await qc.invalidateQueries({ queryKey: ['purchases'] });
      await qc.invalidateQueries({ queryKey: ['purchase', purchase.purchaseId] });
    },
  });

  const validate = useMutation({
    mutationFn: (purchaseId: string) => purchasesService.validate(purchaseId),
    onSuccess: async (_result, purchaseId) => {
      await qc.invalidateQueries({ queryKey: ['purchases'] });
      await qc.invalidateQueries({ queryKey: ['purchase', purchaseId] });
    },
  });

  function resetDraft() {
    const first = newLine();
    setForm(initialForm());
    setDraftLines([]);
    setQuickLine(first);
    setSelectedLineId(first.id);
    setClientError('');
    setActiveAutocomplete('');
  }

  function update<K extends keyof PurchaseForm>(key: K, value: PurchaseForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateLine(id: string, patch: Partial<PurchaseDraftLine>) {
    setDraftLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  }

  function updateQuickLine(patch: Partial<PurchaseDraftLine>) {
    setQuickLine((current) => ({ ...current, ...patch }));
  }

  function addLine(afterId?: string) {
    const line = newLine();
    setDraftLines((current) => {
      if (!afterId) return [...current, line];
      const index = current.findIndex((item) => item.id === afterId);
      if (index === -1) return [...current, line];
      return [...current.slice(0, index + 1), line, ...current.slice(index + 1)];
    });
    setSelectedLineId(line.id);
    setTimeout(() => focusCell(draftLines.length, 0), 0);
  }

  function commitQuickLine() {
    const issue = issueForLine(quickLine);
    if (issue.blocksSave) {
      setClientError(`Ligne rapide: ${issue.message}`);
      return;
    }
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

  function removeLine(id: string) {
    setDraftLines((current) => {
      if (current.length === 1) return current;
      const next = current.filter((line) => line.id !== id);
      if (selectedLineId === id) setSelectedLineId(next[0]?.id ?? '');
      return next;
    });
  }

  function removeSelectedLine() {
    if (selectedLineId) removeLine(selectedLineId);
  }

  function closeCreate() {
    if (!create.isPending) {
      setCreateOpen(false);
      resetDraft();
    }
  }

  function selectArticle(lineId: string, article: Article) {
      const sameArticleCount = draftLines.filter((line) => line.articleId === article.articleId).length + (quickLine.articleId === article.articleId ? 1 : 0) + 1;
      const lotNumber = `${lotBase(article, form.purchaseDate)}-${String(sameArticleCount).padStart(3, '0')}`;
    const patch = {
      articleId: article.articleId,
      articleQuery: `${article.articleCode} - ${article.commercialName}`,
      lotNumber,
      sellingUnitPrice: article.sellingPrice ? String(article.sellingPrice) : '',
    };
    if (lineId === quickLine.id) updateQuickLine(patch);
    else updateLine(lineId, patch);
    setActiveAutocomplete('');
  }

  function articleSuggestions(line: PurchaseDraftLine) {
    const query = line.articleQuery.trim().toLowerCase();
    if (!query) return (articles.data ?? []).slice(0, 8);
    return (articles.data ?? []).filter((article) => [
      article.articleCode,
      article.commercialName,
      article.dci,
      article.dosage,
    ].some((value) => String(value ?? '').toLowerCase().includes(query))).slice(0, 8);
  }

  function validateDraftLines() {
    if (draftLines.length === 0) return 'Ajoutez au moins une ligne achat.';
    const blocking = draftLines.map((line, index) => ({ issue: issueForLine(line), index })).find(({ issue }) => issue.blocksSave);
    if (blocking) return `Ligne ${blocking.index + 1}: ${blocking.issue.message}`;
    return '';
  }

  function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const error = validateDraftLines();
    if (error) {
      setClientError(error);
      return;
    }
    setClientError('');
    create.mutate();
  }

  function focusCell(row: number, col: number) {
    const target = document.querySelector<HTMLElement>(`[data-grid-cell="${row}-${col}"]`);
    target?.focus();
  }

  function handleGridKey(event: KeyboardEvent<HTMLElement>, row: number, col: number, lineId: string) {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      if (!hasBlockingError && !create.isPending) submit();
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      addLine(lineId);
      return;
    }
    if (event.ctrlKey && event.key === 'Delete') {
      event.preventDefault();
      removeLine(lineId);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCreate();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (lineId === quickLine.id) {
        commitQuickLine();
        return;
      }
      if (row === draftLines.length - 1) addLine(lineId);
      setTimeout(() => focusCell(Math.min(row + 1, draftLines.length), col), 0);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusCell(Math.min(row + 1, draftLines.length - 1), col);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusCell(Math.max(row - 1, 0), col);
    }
    if (event.key === 'ArrowRight' && (event.currentTarget as HTMLInputElement).selectionStart === (event.currentTarget as HTMLInputElement).value?.length) {
      focusCell(row, Math.min(col + 1, 5));
    }
    if (event.key === 'ArrowLeft' && (event.currentTarget as HTMLInputElement).selectionStart === 0) {
      focusCell(row, Math.max(col - 1, 0));
    }
  }

  const selectedPurchase = detail.data;
  const detailItems = selectedPurchase?.items ?? [];
  const detailTotal = detailItems.reduce((sum, item) => sum + Number(item.lineTotal ?? 0), 0);
  const currentSupplier = suppliers.data?.find((supplier) => supplier.supplierId === form.supplierId);
  const currentSite = sites.data?.find((site) => site.siteId === form.siteId);

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Achats</h1>
          <p className="muted">Suivi des achats, lignes fournisseur et validation vers lots et stock.</p>
        </div>
        <button className="button" type="button" onClick={() => setCreateOpen(true)}>+ Nouvel Achat</button>
      </div>

      <div className="card purchase-filters">
        <SearchBox value={search} onChange={setSearch} placeholder="Rechercher par code, fournisseur, statut, date ou site..." />
        <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="DRAFT">Brouillon</option>
          <option value="VALIDATED">Valide</option>
        </select>
      </div>

      <div className="card">
        {purchases.isLoading ? <p className="loading-state">Chargement des achats...</p> : rows.length === 0 ? <p className="empty-state">Aucun achat trouve. Ajustez la recherche ou creez un nouvel achat.</p> : (
          <div className="table-wrap">
            <table className="data-table purchase-table">
              <thead><tr><th>Numero</th><th>Fournisseur</th><th>Site</th><th>Date</th><th>Total</th><th>Statut</th><th></th></tr></thead>
              <tbody>{rows.map((purchase) => (
                <tr className="clickable-row" key={purchase.purchaseId} onClick={() => setSelectedPurchaseId(purchase.purchaseId)}>
                  <td><strong>{purchase.purchaseNumber}</strong></td>
                  <td>{purchase.supplierName ?? '-'}</td>
                  <td>{purchase.siteName ?? '-'}</td>
                  <td>{purchase.purchaseDate}</td>
                  <td>{formatMoney(purchase.totalAmount, purchase.currencyCode ?? 'USD', purchase.currencySymbol)}</td>
                  <td><span className={`badge ${statusBadge(purchase.status)}`}>{purchase.status}</span></td>
                  <td><button className="ghost-button" type="button" onClick={(event) => { event.stopPropagation(); setSelectedPurchaseId(purchase.purchaseId); }}>Voir</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      <Modal title="Nouvel achat" open={createOpen} onClose={closeCreate}>
        {create.isError && <p className="form-error">{apiErrorMessage(create.error)}</p>}
        {clientError && <p className="form-error">{clientError}</p>}
        <form className="purchase-form purchase-erp-window" onSubmit={submit}>
          <div className="purchase-sticky-header">
            <div><span>Code achat</span><strong>{form.purchaseNumber || 'ACH-...'}</strong></div>
            <div><span>Fournisseur</span><strong>{currentSupplier?.supplierName ?? '-'}</strong></div>
            <div><span>Date</span><strong>{form.purchaseDate}</strong></div>
            <div><span>Site</span><strong>{currentSite?.siteName ?? '-'}</strong></div>
            <div><span>Devise</span><strong>{form.currencyCode}</strong></div>
            <div><span>Total achat</span><strong>{formatMoney(totals.purchase, form.currencyCode)}</strong></div>
            <div><span>Statut</span><strong><span className="badge badge-warning">DRAFT</span></strong></div>
          </div>

          <div className="form-section">
            <h3>Informations generales</h3>
            <div className="form-grid">
              <Field label="Code achat"><input className="input" placeholder="ACH-000001" value={form.purchaseNumber} onChange={(event) => update('purchaseNumber', event.target.value)} required /></Field>
              <Field label="Fournisseur"><select className="input" value={form.supplierId} onChange={(event) => update('supplierId', event.target.value)} required><option value="">Choisir un fournisseur</option>{(suppliers.data ?? []).map((supplier) => <option key={supplier.supplierId} value={supplier.supplierId}>{supplier.supplierName}</option>)}</select></Field>
              <Field label="Date achat"><input className="input" type="date" value={form.purchaseDate} onChange={(event) => update('purchaseDate', event.target.value)} required /></Field>
              <Field label="Devise"><select className="input" value={form.currencyCode} disabled><option value="USD">USD - Dollar americain</option></select></Field>
              <Field label="Taux de change"><input className="input" type="number" min="1" step="0.0001" placeholder="1" value={form.exchangeRate} onChange={(event) => update('exchangeRate', event.target.value)} required /></Field>
              <Field label="Site"><select className="input" value={form.siteId} onChange={(event) => update('siteId', event.target.value)} required><option value="">Choisir un site</option>{(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}</select></Field>
            </div>
            <Field label="Observation"><textarea className="input" rows={2} placeholder="Reference facture fournisseur, livraison partielle..." value={form.observation} onChange={(event) => update('observation', event.target.value)} /></Field>
          </div>

          <div className="erp-toolbar">
            <button className="ghost-button" type="button" onClick={() => addLine()}>+ Ajouter ligne</button>
            <button className="ghost-button" type="button" onClick={duplicateSelectedLine} disabled={!selectedLineId}>Dupliquer ligne</button>
            <button className="ghost-button" type="button" onClick={removeSelectedLine} disabled={!selectedLineId || draftLines.length === 1}>Supprimer ligne selectionnee</button>
            <button className="ghost-button" type="button" disabled>Importer CSV</button>
            <button className="ghost-button" type="button" disabled>Exporter CSV</button>
          </div>

          <div className="table-wrap erp-grid-wrap">
            <table className="data-table purchase-lines-table erp-grid">
              <thead>
                <tr><th>Etat</th><th>Article</th><th>Numero Lot</th><th>Expiration</th><th>Quantite</th><th>Prix Achat</th><th>Prix Vente</th><th>Total</th><th>Infos article</th><th>Actions</th></tr>
              </thead>
              <tbody>{draftLines.map((line, rowIndex) => {
                const article = articleById.get(line.articleId);
                const issue = lineIssues.get(line.id) ?? issueForLine(line);
                const suggestions = articleSuggestions(line);
                return (
                  <Fragment key={line.id}>
                  <tr className={`erp-grid-row line-${issue.level} ${selectedLineId === line.id ? 'selected' : ''}`} onClick={() => setSelectedLineId(line.id)}>
                    <td><span className={`line-indicator ${issue.level}`} title={issue.message}></span></td>
                    <td className="autocomplete-cell sticky-article-cell">
                      <input
                        className="input"
                        data-grid-cell={`${rowIndex}-0`}
                        placeholder="Code, nom, DCI..."
                        value={line.articleQuery}
                        onFocus={() => { setSelectedLineId(line.id); setActiveAutocomplete(line.id); }}
                        onKeyDown={(event) => handleGridKey(event, rowIndex, 0, line.id)}
                        onChange={(event) => updateLine(line.id, { articleQuery: event.target.value, articleId: '' })}
                      />
                      {activeAutocomplete === line.id && (
                        <div className="autocomplete-menu">
                          {suggestions.map((suggestion) => (
                            <button type="button" key={suggestion.articleId} onMouseDown={(event) => { event.preventDefault(); selectArticle(line.id, suggestion); }}>
                              <strong>{suggestion.articleCode}</strong>
                              <span>{suggestion.commercialName}</span>
                              <small>{formById.get(suggestion.formId ?? '') ?? '-'} | {suggestion.dosage ?? '-'}</small>
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td><input className="input" data-grid-cell={`${rowIndex}-1`} placeholder="AUTO-001" value={line.lotNumber} onKeyDown={(event) => handleGridKey(event, rowIndex, 1, line.id)} onChange={(event) => updateLine(line.id, { lotNumber: event.target.value })} required /></td>
                    <td><input className="input" data-grid-cell={`${rowIndex}-2`} type="date" value={line.expiryDate} onKeyDown={(event) => handleGridKey(event, rowIndex, 2, line.id)} onChange={(event) => updateLine(line.id, { expiryDate: event.target.value })} required /></td>
                    <td><input className="input numeric-cell" data-grid-cell={`${rowIndex}-3`} type="number" min="0.001" step="0.001" placeholder="1" value={line.quantity} onKeyDown={(event) => handleGridKey(event, rowIndex, 3, line.id)} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} required /></td>
                    <td><input className="input numeric-cell" data-grid-cell={`${rowIndex}-4`} type="number" min="0.01" step="0.01" placeholder="0.00" value={line.purchaseUnitPrice} onKeyDown={(event) => handleGridKey(event, rowIndex, 4, line.id)} onChange={(event) => updateLine(line.id, { purchaseUnitPrice: event.target.value })} required /></td>
                    <td><input className="input numeric-cell" data-grid-cell={`${rowIndex}-5`} type="number" min="0" step="0.01" placeholder="0.00" value={line.sellingUnitPrice} onKeyDown={(event) => handleGridKey(event, rowIndex, 5, line.id)} onChange={(event) => updateLine(line.id, { sellingUnitPrice: event.target.value })} required /></td>
                    <td className="numeric-text"><strong>{formatMoney(lineTotal(line), form.currencyCode)}</strong></td>
                    <td className="article-readonly">
                      <span>Categorie: {categoryById.get(article?.categoryId ?? '') ?? '-'}</span>
                      <span>Forme: {formById.get(article?.formId ?? '') ?? '-'}</span>
                      <span>Unite: Unite</span>
                      <span>Stock: {article ? (stockByArticle.get(article.articleId) ?? article.stockAvailable ?? 0) : '-'}</span>
                      <span>Min: {article?.defaultStockMin ?? '-'}</span>
                    </td>
                    <td><button className="ghost-button" type="button" onClick={() => removeLine(line.id)} disabled={draftLines.length === 1}>Supprimer</button></td>
                  </tr>
                  {issue.level !== 'valid' && <tr className="line-message-row"><td className={`line-message ${issue.level}`} colSpan={10}>{issue.message}</td></tr>}
                  </Fragment>
                );
              })}
                <QuickEntryRow
                  activeAutocomplete={activeAutocomplete}
                  article={articleById.get(quickLine.articleId)}
                  categoryById={categoryById}
                  commitQuickLine={commitQuickLine}
                  formById={formById}
                  handleGridKey={handleGridKey}
                  issue={quickIssue}
                  line={quickLine}
                  rowIndex={draftLines.length}
                  selectArticle={selectArticle}
                  setActiveAutocomplete={setActiveAutocomplete}
                  setSelectedLineId={setSelectedLineId}
                  stockByArticle={stockByArticle}
                  suggestions={articleSuggestions(quickLine)}
                  updateQuickLine={updateQuickLine}
                  currencyCode={form.currencyCode}
                />
              </tbody>
            </table>
          </div>

          <div className="purchase-totals premium-summary">
            <div className="form-summary"><span>Nombre articles</span><strong>{totals.articleCount}</strong></div>
            <div className="form-summary"><span>Nombre lignes</span><strong>{draftLines.length}</strong></div>
            <div className="form-summary"><span>Quantite totale</span><strong>{totals.quantity}</strong></div>
            <div className="form-summary"><span>Montant achat</span><strong>{formatMoney(totals.purchase, form.currencyCode)}</strong></div>
            <div className="form-summary"><span>Montant vente estime</span><strong>{formatMoney(totals.sale, form.currencyCode)}</strong></div>
            <div className="form-summary"><span>Marge brute estimee</span><strong>{formatMoney(totals.sale - totals.purchase, form.currencyCode)}</strong></div>
          </div>

          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={closeCreate} disabled={create.isPending}>Annuler</button>
            <button className="button" disabled={create.isPending || suppliers.isLoading || sites.isLoading || articles.isLoading || hasBlockingError}>
              {create.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Detail achat" open={Boolean(selectedPurchaseId)} onClose={() => setSelectedPurchaseId(null)}>
        {validate.isError && <p className="form-error">{apiErrorMessage(validate.error)}</p>}
        {detail.isLoading || !selectedPurchase ? <p className="loading-state">Chargement du detail achat...</p> : (
          <PurchaseDetailModal purchase={selectedPurchase} itemCount={detailItems.length} itemsTotal={detailTotal} onValidate={() => validate.mutate(selectedPurchase.purchaseId)} validating={validate.isPending} />
        )}
      </Modal>
    </>
  );
}

function PurchaseDetailModal({
  purchase,
  itemCount,
  itemsTotal,
  onValidate,
  validating,
}: {
  purchase: Purchase;
  itemCount: number;
  itemsTotal: number;
  onValidate: () => void;
  validating: boolean;
}) {
  const currencyCode = purchase.currencyCode ?? 'USD';
  const currencySymbol = purchase.currencySymbol;

  return (
    <div className="purchase-detail">
      <div className="detail-grid">
        <div><span>Code</span><strong>{purchase.purchaseNumber}</strong></div>
        <div><span>Date</span><strong>{purchase.purchaseDate}</strong></div>
        <div><span>Fournisseur</span><strong>{purchase.supplierName ?? '-'}</strong></div>
        <div><span>Site</span><strong>{purchase.siteName ?? '-'}</strong></div>
        <div><span>Statut</span><strong><span className={`badge ${statusBadge(purchase.status)}`}>{purchase.status}</span></strong></div>
        <div><span>Devise</span><strong>{currencyCode}</strong></div>
        <div><span>Taux de change</span><strong>{purchase.exchangeRate}</strong></div>
        <div><span>Total</span><strong>{formatMoney(purchase.totalAmount, currencyCode, currencySymbol)}</strong></div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Article</th><th>Quantite</th><th>Prix achat</th><th>Total ligne</th></tr></thead>
          <tbody>{(purchase.items ?? []).map((item) => (
            <tr key={item.purchaseItemId}>
              <td>{item.commercialName ?? item.articleCode ?? '-'}</td>
              <td>{item.quantity}</td>
              <td>{formatMoney(item.purchaseUnitPrice, currencyCode, currencySymbol)}</td>
              <td>{formatMoney(item.lineTotal, currencyCode, currencySymbol)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className="form-summary">
        <span>{itemCount} ligne(s)</span>
        <strong>{formatMoney(itemsTotal, currencyCode, currencySymbol)}</strong>
      </div>

      {purchase.status === 'DRAFT' && (
        <div className="modal-actions">
          <button className="button" type="button" onClick={onValidate} disabled={validating || itemCount === 0}>{validating ? 'Validation...' : 'Valider achat'}</button>
        </div>
      )}
    </div>
  );
}

function QuickEntryRow({
  activeAutocomplete,
  article,
  categoryById,
  commitQuickLine,
  currencyCode,
  formById,
  handleGridKey,
  issue,
  line,
  rowIndex,
  selectArticle,
  setActiveAutocomplete,
  setSelectedLineId,
  stockByArticle,
  suggestions,
  updateQuickLine,
}: {
  activeAutocomplete: string;
  article?: Article;
  categoryById: Map<string, string>;
  commitQuickLine: () => void;
  currencyCode: string;
  formById: Map<string, string>;
  handleGridKey: (event: KeyboardEvent<HTMLElement>, row: number, col: number, lineId: string) => void;
  issue: LineIssue;
  line: PurchaseDraftLine;
  rowIndex: number;
  selectArticle: (lineId: string, article: Article) => void;
  setActiveAutocomplete: (id: string) => void;
  setSelectedLineId: (id: string) => void;
  stockByArticle: Map<string, number>;
  suggestions: Article[];
  updateQuickLine: (patch: Partial<PurchaseDraftLine>) => void;
}) {
  return (
    <Fragment>
      <tr className={`erp-grid-row quick-entry-row line-${issue.level}`}>
        <td><span className={`line-indicator ${issue.level}`} title={issue.message}></span></td>
        <td className="autocomplete-cell sticky-article-cell">
          <input
            className="input"
            data-grid-cell={`${rowIndex}-0`}
            placeholder="Saisie rapide article..."
            value={line.articleQuery}
            onFocus={() => { setSelectedLineId(line.id); setActiveAutocomplete(line.id); }}
            onKeyDown={(event) => handleGridKey(event, rowIndex, 0, line.id)}
            onChange={(event) => updateQuickLine({ articleQuery: event.target.value, articleId: '' })}
          />
          {activeAutocomplete === line.id && (
            <div className="autocomplete-menu">
              {suggestions.map((suggestion) => (
                <button type="button" key={suggestion.articleId} onMouseDown={(event) => { event.preventDefault(); selectArticle(line.id, suggestion); }}>
                  <strong>{suggestion.articleCode}</strong>
                  <span>{suggestion.commercialName}</span>
                  <small>{formById.get(suggestion.formId ?? '') ?? '-'} | {suggestion.dosage ?? '-'}</small>
                </button>
              ))}
            </div>
          )}
        </td>
        <td><input className="input" data-grid-cell={`${rowIndex}-1`} placeholder="AUTO-001" value={line.lotNumber} onKeyDown={(event) => handleGridKey(event, rowIndex, 1, line.id)} onChange={(event) => updateQuickLine({ lotNumber: event.target.value })} /></td>
        <td><input className="input" data-grid-cell={`${rowIndex}-2`} type="date" value={line.expiryDate} onKeyDown={(event) => handleGridKey(event, rowIndex, 2, line.id)} onChange={(event) => updateQuickLine({ expiryDate: event.target.value })} /></td>
        <td><input className="input numeric-cell" data-grid-cell={`${rowIndex}-3`} type="number" min="0.001" step="0.001" placeholder="1" value={line.quantity} onKeyDown={(event) => handleGridKey(event, rowIndex, 3, line.id)} onChange={(event) => updateQuickLine({ quantity: event.target.value })} /></td>
        <td><input className="input numeric-cell" data-grid-cell={`${rowIndex}-4`} type="number" min="0.01" step="0.01" placeholder="0.00" value={line.purchaseUnitPrice} onKeyDown={(event) => handleGridKey(event, rowIndex, 4, line.id)} onChange={(event) => updateQuickLine({ purchaseUnitPrice: event.target.value })} /></td>
        <td><input className="input numeric-cell" data-grid-cell={`${rowIndex}-5`} type="number" min="0" step="0.01" placeholder="0.00" value={line.sellingUnitPrice} onKeyDown={(event) => handleGridKey(event, rowIndex, 5, line.id)} onChange={(event) => updateQuickLine({ sellingUnitPrice: event.target.value })} /></td>
        <td className="numeric-text"><strong>{formatMoney(lineTotal(line), currencyCode)}</strong></td>
        <td className="article-readonly">
          <span>Categorie: {categoryById.get(article?.categoryId ?? '') ?? '-'}</span>
          <span>Forme: {formById.get(article?.formId ?? '') ?? '-'}</span>
          <span>Unite: Unite</span>
          <span>Stock: {article ? (stockByArticle.get(article.articleId) ?? article.stockAvailable ?? 0) : '-'}</span>
          <span>Min: {article?.defaultStockMin ?? '-'}</span>
        </td>
        <td><button className="ghost-button" type="button" onClick={commitQuickLine} disabled={issue.blocksSave}>Ajouter</button></td>
      </tr>
      <tr className="line-message-row quick-message-row">
        <td className={`line-message ${issue.level}`} colSpan={10}>Ligne rapide permanente - appuyez sur Entree pour ajouter.</td>
      </tr>
    </Fragment>
  );
}
