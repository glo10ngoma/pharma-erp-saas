import { KeyboardEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { FloatingSearchPopover } from '../../components/FloatingSearchPopover';
import { apiErrorMessage } from '../../services/apiError';
import { articlesService } from '../../services/articles.service';
import { inventoriesService, InventoryItem } from '../../services/inventories.service';
import { stocksService, Stock } from '../../services/stocks.service';
import { lotsService } from '../../services/lots.service';
import { formatDate, fileDateStamp } from '../../utils/date';
import { downloadCsv, downloadJson, downloadXlsx } from '../../utils/export';
import { formatMoney } from '../../utils/money';

type QuickLine = { stockId: string; query: string; physicalQuantity: string; reason: string };

const emptyQuickLine = (): QuickLine => ({ stockId: '', query: '', physicalQuantity: '', reason: '' });

export function InventoryDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [physicalByItem, setPhysicalByItem] = useState<Record<string, string>>({});
  const [reasonByItem, setReasonByItem] = useState<Record<string, string>>({});
  const [quickLine, setQuickLine] = useState<QuickLine>(emptyQuickLine());
  const [quickPickerOpen, setQuickPickerOpen] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState('');
  const [clientError, setClientError] = useState('');

  const inventory = useQuery({ queryKey: ['inventory', id], queryFn: async () => (await inventoriesService.getById(id)).data });
  const stocks = useQuery({ queryKey: ['stocks'], queryFn: async () => (await stocksService.getAll()).data });
  const lots = useQuery({ queryKey: ['lots'], queryFn: async () => (await lotsService.getAll()).data });
  const articles = useQuery({ queryKey: ['articles', 'inventory-detail'], queryFn: async () => (await articlesService.getAll({ limit: 1000 })).data.items });
  const current = inventory.data;
  const rows = current?.items ?? [];
  const availableStocks = (stocks.data ?? []).filter((stock) => !current?.siteId || stock.siteId === current.siteId);
  const lotPriceById = useMemo(() => new Map((lots.data ?? []).map((lot) => [lot.lotId, { purchasePrice: lot.purchasePrice, sellingPrice: lot.sellingPrice }])), [lots.data]);
  const articleById = useMemo(() => new Map((articles.data ?? []).map((article) => [article.articleId, article])), [articles.data]);
  const selectedStock = availableStocks.find((stock) => stock.stockId === quickLine.stockId);
  const suggestions = inventoryStockSuggestions(availableStocks, quickLine.query, articleById).slice(0, 8);
  const effectiveRows = useMemo(() => rows.map((item) => {
    const physicalValue = physicalByItem[item.inventoryItemId];
    const physicalQuantity = physicalValue === undefined || physicalValue === '' ? item.physicalQuantity : Number(physicalValue);
    const differenceQuantity = physicalQuantity === null || physicalQuantity === undefined || Number.isNaN(Number(physicalQuantity)) ? item.differenceQuantity : Number(physicalQuantity) - Number(item.systemQuantity);
    return { ...item, physicalQuantity, differenceQuantity, reason: reasonByItem[item.inventoryItemId] ?? item.reason };
  }), [physicalByItem, reasonByItem, rows]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ['inventory', id] });
    qc.invalidateQueries({ queryKey: ['inventories'] });
    qc.invalidateQueries({ queryKey: ['stocks'] });
  }

  const start = useMutation({ mutationFn: () => inventoriesService.start(id), onSuccess: refresh });
  const close = useMutation({ mutationFn: () => inventoriesService.close(id), onSuccess: refresh });
  const validate = useMutation({ mutationFn: () => inventoriesService.validate(id), onSuccess: refresh });
  const addItem = useMutation({
    mutationFn: () => inventoriesService.addItem(id, { articleId: selectedStock?.articleId, lotId: selectedStock?.lotId, physicalQuantity: quickLine.physicalQuantity === '' ? undefined : Number(quickLine.physicalQuantity), reason: quickLine.reason || undefined }),
    onSuccess: () => {
      setQuickLine(emptyQuickLine());
      setClientError('');
      refresh();
    },
  });
  const updateItem = useMutation({
    mutationFn: ({ itemId, value, reason }: { itemId: string; value: string; reason?: string }) => inventoriesService.updateItem(id, itemId, { physicalQuantity: Number(value), reason }),
    onSuccess: refresh,
  });

  const error = start.error || close.error || validate.error || addItem.error || updateItem.error;
  const totals = useMemo(() => inventoryTotals(effectiveRows, lotPriceById), [effectiveRows, lotPriceById]);
  const hasBlockingError = rows.some((item) => current?.status === 'IN_PROGRESS' && Number(physicalByItem[item.inventoryItemId] ?? item.physicalQuantity ?? 0) < 0);

  function commitQuickLine() {
    if (!selectedStock) {
      setClientError('Selectionnez un article / lot.');
      return;
    }
    if (quickLine.physicalQuantity !== '' && Number(quickLine.physicalQuantity) < 0) {
      setClientError('Stock physique invalide.');
      return;
    }
    addItem.mutate();
  }

  function handleQuickKey(event: KeyboardEvent<HTMLElement>) {
    if (event.ctrlKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      setQuickLine(emptyQuickLine());
      return;
    }
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      commitQuickLine();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      commitQuickLine();
    }
  }

  function chooseStock(stock: Stock) {
    setQuickLine({
      stockId: stock.stockId,
      query: `${stock.articleCode ?? ''} - ${stock.commercialName ?? ''} / ${stock.lotNumber}`,
      physicalQuantity: String(stock.quantityAvailable),
      reason: quickLine.reason,
    });
  }

  function exportInventory(format: 'xlsx' | 'csv' | 'json') {
    if (!current) return;
    const stamp = fileDateStamp();
    const header = inventoryHeaderRows(current, totals);
    const lines = inventoryLineRows(effectiveRows, lotPriceById);
    if (format === 'xlsx') downloadXlsx(`inventaire_${current.inventoryNumber}_${stamp}.xlsx`, [
      { name: 'Inventaire', rows: header },
      { name: 'Lignes', rows: lines },
    ]);
    if (format === 'csv') downloadCsv(`inventaire_${current.inventoryNumber}_${stamp}.csv`, [...header, [], ...lines]);
    if (format === 'json') downloadJson(`inventaire_${current.inventoryNumber}_${stamp}.json`, { inventory: current, totals, lines: effectiveRows });
  }

  if (!current) return <><h1>Detail inventaire</h1><div className="card">Chargement...</div></>;

  return (
    <div className="inventory-detail-page">
      <div className="breadcrumb"><Link to="/inventories">Inventaires</Link><span>&gt;</span><strong>Detail</strong></div>
      {error && <p className="form-error">{apiErrorMessage(error)}</p>}
      {clientError && <p className="form-error">{clientError}</p>}

      <section className="inventory-sticky-header">
        <div><span>Numero</span><strong>{current.inventoryNumber}</strong></div>
        <div><span>Site</span><strong>{current.siteName ?? '-'}</strong></div>
        <div><span>Statut</span><strong><span className={`badge compact-badge ${inventoryStatusClass(current.status)}`}>{current.status}</span></strong></div>
        <div><span>Date</span><strong>{formatDate(current.inventoryDate)}</strong></div>
        <div><span>Lignes</span><strong>{rows.length}</strong></div>
        <div><span>Total ecarts</span><strong>{formatQuantity(totals.netQty)}</strong></div>
      </section>

      <div className="card inventory-actions">
        <Link className="ghost-button compact-button" to="/inventories">Retour</Link>
        {current.status === 'DRAFT' && <button className="button compact-button" onClick={() => start.mutate()} disabled={start.isPending}>Demarrer</button>}
        {current.status === 'IN_PROGRESS' && <button className="button compact-button" onClick={() => close.mutate()} disabled={close.isPending}>Cloturer</button>}
        {current.status === 'CLOSED' && <button className="button compact-button" onClick={() => validate.mutate()} disabled={validate.isPending || rows.length === 0 || hasBlockingError}>Valider</button>}
        <details className="export-menu">
          <summary className="ghost-button compact-button">Exporter</summary>
          <div className="export-menu-panel">
            <button type="button" disabled={rows.length === 0} onClick={() => exportInventory('xlsx')}>Excel</button>
            <button type="button" disabled={rows.length === 0} onClick={() => exportInventory('csv')}>CSV</button>
            <button type="button" disabled={rows.length === 0} onClick={() => exportInventory('json')}>JSON</button>
            <button type="button" disabled>PDF</button>
          </div>
        </details>
      </div>

      <section className="inventory-summary premium-summary compact-summary">
        <div className="form-summary"><span>Lignes</span><strong>{effectiveRows.length}</strong></div>
        <div className="form-summary"><span>Systeme</span><strong>{formatQuantity(totals.systemQty)}</strong></div>
        <div className="form-summary"><span>Physique</span><strong>{formatQuantity(totals.physicalQty)}</strong></div>
        <div className="form-summary"><span>Ecarts +</span><strong>{formatQuantity(totals.gainQty)}</strong></div>
        <div className="form-summary"><span>Ecarts -</span><strong>{formatQuantity(totals.lossQty)}</strong></div>
        <div className="form-summary"><span>Valeur gains</span><strong>{formatMoney(totals.gainValue, 'USD')}</strong></div>
        <div className="form-summary"><span>Valeur pertes</span><strong>{formatMoney(totals.lossValue, 'USD')}</strong></div>
        <div className="form-summary"><span>Net</span><strong>{formatMoney(totals.netValue, 'USD')}</strong></div>
      </section>

      <div className="card inventory-grid-card">
        <div className="table-wrap">
          <table className="data-table inventory-count-table compact-grid">
            <thead><tr><th>Article</th><th>Lot</th><th>Expiration</th><th>Stock systeme</th><th>Stock physique</th><th>Ecart</th><th>Type</th><th>Valeur ecart</th><th>Observation</th><th>Actions</th></tr></thead>
            <tbody>
              {effectiveRows.map((item, index) => {
                const value = physicalByItem[item.inventoryItemId] ?? String(item.physicalQuantity ?? '');
                const diff = item.differenceQuantity;
                const unitValue = lotPriceById.get(item.lotId)?.purchasePrice ?? 0;
                return (
                  <tr className={`inventory-line ${lineLevel(diff)}`} key={item.inventoryItemId} onClick={() => setSelectedLineId(item.inventoryItemId)}>
                    <td><strong>{item.commercialName ?? '-'}</strong><small>{item.articleCode ?? ''}</small></td>
                    <td>{item.lotNumber ?? '-'}</td>
                    <td>{formatDate(item.expiryDate)}</td>
                    <td className="quantity-cell">{formatQuantity(item.systemQuantity)}</td>
                    <td>{current.status === 'IN_PROGRESS' ? <input className="input compact-input numeric-cell" data-grid-cell={`${index}-physical`} type="number" min="0" step="0.001" value={value} onChange={(event) => setPhysicalByItem({ ...physicalByItem, [item.inventoryItemId]: event.target.value })} /> : formatQuantity(item.physicalQuantity ?? 0)}</td>
                    <td className="quantity-cell">{diff === null || diff === undefined ? '-' : formatQuantity(diff)}</td>
                    <td><span className={`badge compact-badge ${differenceClass(diff)}`}>{differenceType(diff)}</span></td>
                    <td className="numeric-text">{formatMoney(Number(diff ?? 0) * unitValue, 'USD')}</td>
                    <td>{current.status === 'IN_PROGRESS' ? <input className="input compact-input" placeholder="casse, vol, perime..." value={reasonByItem[item.inventoryItemId] ?? item.reason ?? ''} onChange={(event) => setReasonByItem({ ...reasonByItem, [item.inventoryItemId]: event.target.value })} /> : item.reason ?? '-'}</td>
                    <td>{current.status === 'IN_PROGRESS' && <button className="ghost-button compact-button" onClick={() => updateItem.mutate({ itemId: item.inventoryItemId, value, reason: reasonByItem[item.inventoryItemId] ?? item.reason ?? undefined })} disabled={updateItem.isPending || value === ''}>Sauver</button>}</td>
                  </tr>
                );
              })}
              {current.status === 'IN_PROGRESS' && (
                <tr className="quick-entry-row">
                  <td className="inventory-picker-cell">
                    <FloatingSearchPopover
                      columns={[
                        { header: 'Code', render: (stock) => stock.articleCode ?? '-' },
                        { header: 'Nom', render: (stock) => <strong>{stock.commercialName ?? '-'}</strong> },
                        { header: 'DCI', render: (stock) => articleById.get(stock.articleId)?.dci ?? '-' },
                        { header: 'Lot', render: (stock) => stock.lotNumber },
                        { header: 'Expiration', render: (stock) => formatDate(stock.expiryDate) },
                        { header: 'Stock', render: (stock) => formatQuantity(stock.quantityAvailable) },
                      ]}
                      dataGridCell="quick-inventory-stock"
                      getKey={(stock) => stock.stockId}
                      onChange={(value) => setQuickLine({ ...quickLine, stockId: '', query: value })}
                      onClose={() => setQuickPickerOpen(false)}
                      onFallbackKeyDown={handleQuickKey}
                      onFocusNext={() => document.querySelector<HTMLElement>('[data-grid-cell="quick-inventory-physical"]')?.focus()}
                      onOpen={() => setQuickPickerOpen(true)}
                      onSelect={chooseStock}
                      open={quickPickerOpen}
                      placeholder="Article, lot..."
                      searchPlaceholder="Rechercher (code, nom, DCI, lot, expiration, stock...)"
                      suggestions={suggestions}
                      value={quickLine.query}
                    />
                  </td>
                  <td>{selectedStock?.lotNumber ?? '-'}</td>
                  <td>{formatDate(selectedStock?.expiryDate)}</td>
                  <td className="quantity-cell">{selectedStock ? formatQuantity(selectedStock.quantityAvailable) : '-'}</td>
                  <td><input className="input compact-input numeric-cell" data-grid-cell="quick-inventory-physical" type="number" min="0" step="0.001" placeholder="Physique" value={quickLine.physicalQuantity} onKeyDown={handleQuickKey} onChange={(event) => setQuickLine({ ...quickLine, physicalQuantity: event.target.value })} /></td>
                  <td className="quantity-cell">{selectedStock && quickLine.physicalQuantity !== '' ? formatQuantity(Number(quickLine.physicalQuantity) - selectedStock.quantityAvailable) : '-'}</td>
                  <td><span className="badge compact-badge badge-muted">Ligne rapide</span></td>
                  <td className="numeric-text">-</td>
                  <td><input className="input compact-input" placeholder="Observation" value={quickLine.reason} onKeyDown={handleQuickKey} onChange={(event) => setQuickLine({ ...quickLine, reason: event.target.value })} /></td>
                  <td><button className="ghost-button compact-button" type="button" disabled={!selectedStock || addItem.isPending} onClick={commitQuickLine}>+</button></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function inventoryStockSuggestions(stocks: Stock[], query: string, articleById: Map<string, { dci: string | null }>) {
  const needle = query.trim().toLowerCase();
  if (!needle) return stocks;
  return stocks.filter((stock) => [stock.articleCode, stock.commercialName, articleById.get(stock.articleId)?.dci, stock.lotNumber, stock.expiryDate, stock.quantityAvailable, stock.siteName].some((value) => String(value ?? '').toLowerCase().includes(needle)));
}

function inventoryTotals(items: InventoryItem[], prices: Map<string, { purchasePrice: number }>) {
  return items.reduce((acc, item) => {
    const system = Number(item.systemQuantity ?? 0);
    const physical = item.physicalQuantity === null || item.physicalQuantity === undefined ? system : Number(item.physicalQuantity);
    const diff = item.physicalQuantity === null || item.physicalQuantity === undefined ? 0 : Number(item.differenceQuantity ?? physical - system);
    const value = Math.abs(diff) * Number(prices.get(item.lotId)?.purchasePrice ?? 0);
    acc.systemQty += system;
    acc.physicalQty += physical;
    acc.netQty += diff;
    if (diff > 0) { acc.gainQty += diff; acc.gainValue += value; }
    if (diff < 0) { acc.lossQty += Math.abs(diff); acc.lossValue += value; }
    acc.netValue += diff >= 0 ? value : -value;
    return acc;
  }, { systemQty: 0, physicalQty: 0, gainQty: 0, lossQty: 0, netQty: 0, gainValue: 0, lossValue: 0, netValue: 0 });
}

function inventoryHeaderRows(current: { inventoryNumber: string; siteName: string | null; inventoryDate: string; status: string }, totals: ReturnType<typeof inventoryTotals>) {
  return [
    ['Numero', current.inventoryNumber],
    ['Site', current.siteName ?? '-'],
    ['Date', formatDate(current.inventoryDate)],
    ['Statut', current.status],
    ['Quantite systeme', totals.systemQty],
    ['Quantite physique', totals.physicalQty],
    ['Valeur nette ecart', formatMoney(totals.netValue, 'USD')],
  ];
}

function inventoryLineRows(items: InventoryItem[], prices: Map<string, { purchasePrice: number }>) {
  return [
    ['Article', 'Lot', 'Expiration', 'Stock systeme', 'Stock physique', 'Ecart', 'Type', 'Valeur ecart', 'Observation'],
    ...items.map((item) => {
      const diff = Number(item.differenceQuantity ?? 0);
      const value = diff * Number(prices.get(item.lotId)?.purchasePrice ?? 0);
      return [item.commercialName ?? '-', item.lotNumber ?? '-', formatDate(item.expiryDate), item.systemQuantity, item.physicalQuantity ?? '', diff, differenceType(diff), formatMoney(value, 'USD'), item.reason ?? ''];
    }),
  ];
}

function inventoryStatusClass(status: string) {
  if (status === 'VALIDATED') return 'badge-success';
  if (status === 'CLOSED') return 'badge-info';
  if (status === 'IN_PROGRESS') return 'badge-warning';
  if (status === 'DRAFT') return 'badge-muted';
  return 'badge-muted';
}

function differenceType(diff: number | null | undefined) {
  if (diff === null || diff === undefined) return 'Aucun';
  if (diff > 0) return 'Gain';
  if (diff < 0) return 'Perte';
  return 'Aucun';
}

function differenceClass(diff: number | null | undefined) {
  if (diff === null || diff === undefined || diff === 0) return 'badge-success';
  if (Math.abs(diff) <= 2) return 'badge-warning';
  return 'badge-danger';
}

function lineLevel(diff: number | null | undefined) {
  if (diff === null || diff === undefined || diff === 0) return 'line-valid';
  if (Math.abs(diff) <= 2) return 'line-warning';
  return 'line-danger';
}

function formatQuantity(value: number | null | undefined) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(value ?? 0));
}
