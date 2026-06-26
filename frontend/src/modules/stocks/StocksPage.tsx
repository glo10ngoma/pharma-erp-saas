import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { Article, articlesService } from '../../services/articles.service';
import { Lot, lotsService } from '../../services/lots.service';
import { Stock, StockMovement, stocksService } from '../../services/stocks.service';
import { formatDate, fileDateStamp } from '../../utils/date';
import { downloadCsv, downloadJson, downloadXlsx } from '../../utils/export';
import { formatMoney } from '../../utils/money';

type StockStatus = 'ALL' | 'AVAILABLE' | 'LOW' | 'OUT' | 'RESERVED';

type StockRow = {
  key: string;
  articleId: string;
  articleCode: string;
  articleName: string;
  dci: string | null;
  siteId: string;
  siteName: string;
  quantityAvailable: number;
  quantityReserved: number;
  quantityTotal: number;
  stockMin: number;
  purchaseValue: number;
  saleValue: number;
  statusLabel: string;
  statusClass: string;
  lots: StockLotDetail[];
  movements: StockMovement[];
};

type StockLotDetail = {
  lotId: string;
  lotNumber: string;
  expiryDate: string;
  quantityAvailable: number;
  quantityReserved: number;
  purchasePrice: number;
  sellingPrice: number;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export function StocksPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockStatus>('ALL');
  const [siteFilter, setSiteFilter] = useState('');
  const [stockDate, setStockDate] = useState(todayIso());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const isSnapshot = Boolean(stockDate && stockDate !== todayIso());

  const stocks = useQuery({ queryKey: ['stocks'], queryFn: async () => (await stocksService.getAll()).data });
  const movements = useQuery({ queryKey: ['stock-movements'], queryFn: async () => (await stocksService.getMovements()).data, enabled: isSnapshot || Boolean(selectedKey) });
  const lots = useQuery({ queryKey: ['lots'], queryFn: async () => (await lotsService.getAll()).data });
  const articles = useQuery({ queryKey: ['articles', 'stock-page'], queryFn: async () => (await articlesService.getAll({ limit: 1000 })).data.items });

  const lotsById = useMemo(() => new Map((lots.data ?? []).map((lot) => [lot.lotId, lot])), [lots.data]);
  const articlesById = useMemo(() => new Map((articles.data ?? []).map((article) => [article.articleId, article])), [articles.data]);
  const rows = useMemo(() => {
    if (isSnapshot) return buildSnapshotRows(stockDate, movements.data ?? [], lotsById, articlesById);
    return buildCurrentRows(stocks.data ?? [], lotsById, articlesById, movements.data ?? []);
  }, [articlesById, isSnapshot, lotsById, movements.data, stockDate, stocks.data]);

  const sites = useMemo(() => unique(rows.map((row) => row.siteName).filter(Boolean)), [rows]);
  const filteredRows = useMemo(() => {
    const searched = filterRows(rows, search, (row) => [
      row.articleCode,
      row.articleName,
      row.dci,
      row.siteName,
      row.statusLabel,
    ]);
    return searched.filter((row) => matchesStatus(row, statusFilter) && (!siteFilter || row.siteName === siteFilter));
  }, [rows, search, statusFilter, siteFilter]);
  const selected = filteredRows.find((row) => row.key === selectedKey) ?? rows.find((row) => row.key === selectedKey) ?? null;
  const kpis = useMemo(() => ({
    articlesInStock: filteredRows.filter((row) => row.quantityAvailable > 0).length,
    outOfStock: filteredRows.filter((row) => row.quantityAvailable <= 0).length,
    lowStock: filteredRows.filter((row) => row.quantityAvailable > 0 && row.quantityAvailable <= row.stockMin).length,
    purchaseValue: filteredRows.reduce((sum, row) => sum + row.purchaseValue, 0),
    saleValue: filteredRows.reduce((sum, row) => sum + row.saleValue, 0),
  }), [filteredRows]);

  function exportRows(format: 'xlsx' | 'csv' | 'json') {
    const stamp = fileDateStamp();
    const label = isSnapshot ? stockDate : todayIso();
    const data = stockExportRows(filteredRows, label);
    if (format === 'xlsx') downloadXlsx(`stocks_${stamp}.xlsx`, [{ name: 'Stocks', rows: data }]);
    if (format === 'csv') downloadCsv(`stocks_${stamp}.csv`, data);
    if (format === 'json') downloadJson(`stocks_${stamp}.json`, filteredRows.map((row) => stockExportObject(row, label)));
  }

  const loading = stocks.isLoading || lots.isLoading || articles.isLoading || (isSnapshot && movements.isLoading);

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Stocks</h1>
          <p className="muted">Vue stock actuelle et stock theorique a date, en lecture seule.</p>
        </div>
      </div>

      <div className="stock-snapshot-banner card compact-card">
        <strong>{isSnapshot ? `Stock theorique au ${formatDate(stockDate)}` : 'Stock actuel'}</strong>
        {isSnapshot && <span>Stock reconstruit a partir des mouvements disponibles. Attention: l'API mouvements retourne actuellement les 200 derniers mouvements.</span>}
      </div>

      <div className="stats-grid stock-kpis">
        <div className="card kpi-card"><span className="kpi-label">Articles en stock</span><p className="metric small-metric">{kpis.articlesInStock}</p></div>
        <div className="card kpi-card"><span className="kpi-label">Ruptures</span><p className="metric small-metric">{kpis.outOfStock}</p></div>
        <div className="card kpi-card"><span className="kpi-label">Stocks faibles</span><p className="metric small-metric">{kpis.lowStock}</p></div>
        <div className="card kpi-card"><span className="kpi-label">Valeur achat</span><p className="metric small-metric">{formatMoney(kpis.purchaseValue, 'USD')}</p></div>
        <div className="card kpi-card"><span className="kpi-label">Valeur vente</span><p className="metric small-metric">{formatMoney(kpis.saleValue, 'USD')}</p></div>
      </div>

      <div className="card stock-filters">
        <SearchBox value={search} onChange={setSearch} placeholder="Rechercher code, article, DCI, site ou statut..." />
        <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StockStatus)}>
          <option value="ALL">Tous</option>
          <option value="AVAILABLE">Stock disponible</option>
          <option value="LOW">Stock faible</option>
          <option value="OUT">Rupture</option>
          <option value="RESERVED">Stock reserve</option>
        </select>
        <select className="input" value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}>
          <option value="">Tous les sites</option>
          {sites.map((site) => <option key={site} value={site}>{site}</option>)}
        </select>
        <input className="input stock-date-input" type="date" value={stockDate} max={todayIso()} onChange={(event) => setStockDate(event.target.value)} />
        <div className="export-actions stock-export-actions">
          <details className="export-menu">
            <summary className="ghost-button compact-button">Exporter</summary>
            <div className="export-menu-panel">
              <button type="button" disabled={filteredRows.length === 0} onClick={() => exportRows('xlsx')}>Excel</button>
              <button type="button" disabled={filteredRows.length === 0} onClick={() => exportRows('csv')}>CSV</button>
              <button type="button" disabled={filteredRows.length === 0} onClick={() => exportRows('json')}>JSON</button>
              <button type="button" disabled>PDF</button>
            </div>
          </details>
        </div>
      </div>

      <div className="card">
        {loading ? <p className="loading-state">Chargement des stocks...</p> : filteredRows.length === 0 ? <p className="empty-state">Aucun stock trouve. Ajustez la recherche ou les filtres.</p> : (
          <div className="table-wrap">
            <table className="data-table stocks-table">
              <thead><tr><th>Article</th><th>Site</th><th>Disponible</th><th>Reserve</th><th>Total</th><th>Stock min</th><th>Statut</th><th>Valeur achat</th><th>Valeur vente</th><th>Actions</th></tr></thead>
              <tbody>{filteredRows.map((row) => (
                <tr className="clickable-row stocks-row" key={row.key} onClick={() => setSelectedKey(row.key)}>
                  <td className="stocks-cell"><strong>{row.articleName}</strong><small>{row.articleCode}{row.dci ? ` - ${row.dci}` : ''}</small></td>
                  <td className="stocks-cell">{row.siteName}</td>
                  <td className="stocks-cell quantity-cell">{formatQuantity(row.quantityAvailable)}</td>
                  <td className="stocks-cell quantity-cell">{formatQuantity(row.quantityReserved)}</td>
                  <td className="stocks-cell quantity-cell">{formatQuantity(row.quantityTotal)}</td>
                  <td className="stocks-cell quantity-cell">{formatQuantity(row.stockMin)}</td>
                  <td className="stocks-cell"><span className={`badge compact-badge ${row.statusClass}`}>{row.statusLabel}</span></td>
                  <td className="stocks-cell numeric-text">{formatMoney(row.purchaseValue, 'USD')}</td>
                  <td className="stocks-cell numeric-text">{formatMoney(row.saleValue, 'USD')}</td>
                  <td className="stocks-cell"><button className="ghost-button compact-button" type="button" onClick={(event) => { event.stopPropagation(); setSelectedKey(row.key); }}>Voir</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      <Modal title="Detail stock" open={Boolean(selected)} onClose={() => setSelectedKey(null)}>
        {selected && <StockDetail row={selected} isSnapshot={isSnapshot} stockDate={stockDate} />}
      </Modal>
    </>
  );
}

function StockDetail({ row, isSnapshot, stockDate }: { row: StockRow; isSnapshot: boolean; stockDate: string }) {
  const nearExpiry = row.lots.filter((lot) => {
    const days = daysUntil(lot.expiryDate);
    return days !== null && days >= 0 && days <= 90;
  });
  return (
    <div className="stock-detail">
      <p className="muted">{isSnapshot ? `Detail theorique au ${formatDate(stockDate)}` : 'Detail du stock actuel'}</p>
      <div className="detail-grid">
        <div><span>Article</span><strong>{row.articleName}</strong></div>
        <div><span>Site</span><strong>{row.siteName}</strong></div>
        <div><span>Disponible</span><strong>{formatQuantity(row.quantityAvailable)}</strong></div>
        <div><span>Reserve</span><strong>{formatQuantity(row.quantityReserved)}</strong></div>
        <div><span>Stock min</span><strong>{formatQuantity(row.stockMin)}</strong></div>
        <div><span>Lots disponibles</span><strong>{row.lots.filter((lot) => lot.quantityAvailable > 0).length}</strong></div>
        <div><span>Lots proches expiration</span><strong>{nearExpiry.length}</strong></div>
        <div><span>Valeur achat</span><strong>{formatMoney(row.purchaseValue, 'USD')}</strong></div>
        <div><span>Valeur vente</span><strong>{formatMoney(row.saleValue, 'USD')}</strong></div>
      </div>

      <h3>Lots</h3>
      <div className="table-wrap">
        <table className="data-table stocks-detail-table">
          <thead><tr><th>Lot</th><th>Expiration</th><th>Disponible</th><th>Reserve</th><th>PA</th><th>PV</th></tr></thead>
          <tbody>{row.lots.length === 0 ? <tr><td colSpan={6}>Aucun lot disponible.</td></tr> : row.lots.map((lot) => (
            <tr key={lot.lotId}><td>{lot.lotNumber}</td><td>{formatDate(lot.expiryDate)}</td><td className="quantity-cell">{formatQuantity(lot.quantityAvailable)}</td><td className="quantity-cell">{formatQuantity(lot.quantityReserved)}</td><td className="numeric-text">{formatMoney(lot.purchasePrice, 'USD')}</td><td className="numeric-text">{formatMoney(lot.sellingPrice, 'USD')}</td></tr>
          ))}</tbody>
        </table>
      </div>

      <h3>Mouvements recents</h3>
      <div className="table-wrap">
        <table className="data-table stocks-detail-table">
          <thead><tr><th>Date</th><th>Type</th><th>Lot</th><th>Quantite</th><th>Reference</th></tr></thead>
          <tbody>{row.movements.length === 0 ? <tr><td colSpan={5}>Aucun mouvement accessible.</td></tr> : row.movements.slice(0, 12).map((movement) => (
            <tr key={movement.movementId}><td>{formatDate(movement.movementDate)}</td><td>{movement.movementType}</td><td>{movement.lotNumber ?? '-'}</td><td className="quantity-cell">{formatQuantity(movement.quantity)}</td><td>{movement.referenceType ?? '-'}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function buildCurrentRows(stocks: Stock[], lotsById: Map<string, Lot>, articlesById: Map<string, Article>, movements: StockMovement[]) {
  const grouped = new Map<string, StockRow>();
  for (const stock of stocks) {
    const article = articlesById.get(stock.articleId);
    const lot = lotsById.get(stock.lotId);
    const key = `${stock.articleId}-${stock.siteId}`;
    const row = grouped.get(key) ?? emptyRow(key, stock.articleId, stock.articleCode, stock.commercialName, article, stock.siteId, stock.siteName);
    const quantityAvailable = Number(stock.quantityAvailable ?? 0);
    const quantityReserved = Number(stock.quantityReserved ?? 0);
    const purchasePrice = Number(lot?.purchasePrice ?? 0);
    const sellingPrice = Number(lot?.sellingPrice ?? article?.sellingPrice ?? 0);
    row.quantityAvailable += quantityAvailable;
    row.quantityReserved += quantityReserved;
    row.quantityTotal += quantityAvailable + quantityReserved;
    row.stockMin = Math.max(row.stockMin, Number(stock.stockMin ?? article?.defaultStockMin ?? 0));
    row.purchaseValue += quantityAvailable * purchasePrice;
    row.saleValue += quantityAvailable * sellingPrice;
    row.lots.push({ lotId: stock.lotId, lotNumber: stock.lotNumber, expiryDate: stock.expiryDate, quantityAvailable, quantityReserved, purchasePrice, sellingPrice });
    grouped.set(key, row);
  }
  return finalizeRows([...grouped.values()], movements);
}

function buildSnapshotRows(stockDate: string, movements: StockMovement[], lotsById: Map<string, Lot>, articlesById: Map<string, Article>) {
  const grouped = new Map<string, StockRow>();
  const lotRows = new Map<string, StockLotDetail>();
  const cutoff = new Date(`${stockDate}T23:59:59`).getTime();
  for (const movement of movements) {
    const movementTime = new Date(movement.movementDate).getTime();
    if (!Number.isFinite(movementTime) || movementTime > cutoff) continue;
    const articleId = movement.articleId ?? '';
    const siteId = movement.siteId ?? movement.siteName ?? 'site';
    if (!articleId) continue;
    const article = articlesById.get(articleId);
    const lot = movement.lotId ? lotsById.get(movement.lotId) : undefined;
    const key = `${articleId}-${siteId}`;
    const row = grouped.get(key) ?? emptyRow(key, articleId, movement.articleCode, movement.commercialName, article, siteId, movement.siteName);
    const signed = movementSign(movement.movementType) * Number(movement.quantity ?? 0);
    const purchasePrice = Number(lot?.purchasePrice ?? 0);
    const sellingPrice = Number(lot?.sellingPrice ?? article?.sellingPrice ?? 0);
    row.quantityAvailable += signed;
    row.quantityTotal += signed;
    row.stockMin = Math.max(row.stockMin, Number(article?.defaultStockMin ?? 0));
    row.purchaseValue += signed * purchasePrice;
    row.saleValue += signed * sellingPrice;
    if (movement.lotId) {
      const lotKey = `${key}-${movement.lotId}`;
      const current = lotRows.get(lotKey) ?? { lotId: movement.lotId, lotNumber: movement.lotNumber ?? '-', expiryDate: lot?.expiryDate ?? '', quantityAvailable: 0, quantityReserved: 0, purchasePrice, sellingPrice };
      current.quantityAvailable += signed;
      lotRows.set(lotKey, current);
    }
    row.movements.push(movement);
    grouped.set(key, row);
  }
  for (const row of grouped.values()) {
    row.lots = [...lotRows.entries()].filter(([key]) => key.startsWith(`${row.key}-`)).map(([, lot]) => lot).filter((lot) => lot.quantityAvailable !== 0);
  }
  return finalizeRows([...grouped.values()], movements);
}

function emptyRow(key: string, articleId: string, articleCode: string | null | undefined, articleName: string | null | undefined, article: Article | undefined, siteId: string, siteName: string | null | undefined): StockRow {
  return {
    key,
    articleId,
    articleCode: articleCode ?? article?.articleCode ?? '-',
    articleName: articleName ?? article?.commercialName ?? '-',
    dci: article?.dci ?? null,
    siteId,
    siteName: siteName ?? '-',
    quantityAvailable: 0,
    quantityReserved: 0,
    quantityTotal: 0,
    stockMin: Number(article?.defaultStockMin ?? 0),
    purchaseValue: 0,
    saleValue: 0,
    statusLabel: '',
    statusClass: '',
    lots: [],
    movements: [],
  };
}

function finalizeRows(rows: StockRow[], movements: StockMovement[]) {
  return rows.map((row) => {
    const status = stockStatus(row);
    return {
      ...row,
      quantityAvailable: roundQuantity(row.quantityAvailable),
      quantityReserved: roundQuantity(row.quantityReserved),
      quantityTotal: roundQuantity(row.quantityTotal),
      purchaseValue: Math.max(0, row.purchaseValue),
      saleValue: Math.max(0, row.saleValue),
      statusLabel: status.label,
      statusClass: status.className,
      movements: row.movements.length ? row.movements : movements.filter((movement) => movement.articleId === row.articleId && (movement.siteId === row.siteId || movement.siteName === row.siteName)).slice(0, 12),
    };
  }).sort((a, b) => a.articleName.localeCompare(b.articleName));
}

function stockStatus(row: StockRow) {
  if (row.quantityAvailable <= 0) return { label: 'Rupture', className: 'badge-danger' };
  if (row.quantityReserved > 0) return { label: 'Reserve', className: 'badge-info' };
  if (row.quantityAvailable <= row.stockMin) return { label: 'Stock faible', className: 'badge-warning' };
  return { label: 'Disponible', className: 'badge-success' };
}

function matchesStatus(row: StockRow, filter: StockStatus) {
  if (filter === 'ALL') return true;
  if (filter === 'AVAILABLE') return row.quantityAvailable > 0;
  if (filter === 'LOW') return row.quantityAvailable > 0 && row.quantityAvailable <= row.stockMin;
  if (filter === 'OUT') return row.quantityAvailable <= 0;
  if (filter === 'RESERVED') return row.quantityReserved > 0;
  return true;
}

function movementSign(type: string) {
  if (['PURCHASE_IN', 'INVENTORY_GAIN', 'TRANSFER_IN', 'SALE_RETURN'].includes(type)) return 1;
  if (['SALE_OUT', 'INVENTORY_LOSS', 'TRANSFER_OUT', 'DISPOSAL_OUT'].includes(type)) return -1;
  return 0;
}

function daysUntil(date: string) {
  if (!date) return null;
  const target = new Date(`${date.split('T')[0]}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(roundQuantity(value));
}

function roundQuantity(value: number) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function stockExportRows(rows: StockRow[], date: string) {
  return [
    ['Date stock', 'Article', 'Site', 'Disponible', 'Reserve', 'Total', 'Stock min', 'Statut', 'Valeur achat', 'Valeur vente'],
    ...rows.map((row) => [
      formatDate(date),
      `${row.articleCode} - ${row.articleName}`,
      row.siteName,
      row.quantityAvailable,
      row.quantityReserved,
      row.quantityTotal,
      row.stockMin,
      row.statusLabel,
      formatMoney(row.purchaseValue, 'USD'),
      formatMoney(row.saleValue, 'USD'),
    ]),
  ];
}

function stockExportObject(row: StockRow, date: string) {
  return {
    dateStock: formatDate(date),
    article: `${row.articleCode} - ${row.articleName}`,
    site: row.siteName,
    disponible: row.quantityAvailable,
    reserve: row.quantityReserved,
    total: row.quantityTotal,
    stockMin: row.stockMin,
    statut: row.statusLabel,
    valeurAchat: formatMoney(row.purchaseValue, 'USD'),
    valeurVente: formatMoney(row.saleValue, 'USD'),
  };
}
