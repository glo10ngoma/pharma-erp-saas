import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { filterRows } from '../../lib/search';
import { Article, articlesService } from '../../services/articles.service';
import { Lot, lotsService } from '../../services/lots.service';
import { apiErrorMessage } from '../../services/apiError';
import { sitesService } from '../../services/sites.service';
import { Stock, StockDetail, StockMovement, StockSummary, stocksService } from '../../services/stocks.service';
import { formatDate, fileDateStamp } from '../../utils/date';
import { downloadCsv, downloadJson, downloadXlsx } from '../../utils/export';
import { fetchAllPages } from '../../utils/fetchAllPages';
import { formatMoney } from '../../utils/money';
import { stockMovementLabel, stockMovementSourceRoute } from './stockMovementLabels';

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

const PAGE_LIMIT = 25;

const todayIso = () => new Date().toISOString().slice(0, 10);

export function StocksOverviewView({ mode }: { mode: 'current' | 'as-of' }) {
  const isSnapshot = mode === 'as-of';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockStatus>('ALL');
  const [siteFilter, setSiteFilter] = useState('');
  const [stockDate, setStockDate] = useState(todayIso());
  const [page, setPage] = useState(1);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, siteFilter, stockDate, mode]);

  const siteOptions = useQuery({
    queryKey: ['sites', 'stocks-filter'],
    queryFn: async () => (await sitesService.getAll()).data,
    staleTime: 5 * 60 * 1000,
  });

  const summary = useQuery({
    queryKey: ['stocks-summary', { page, search: debouncedSearch, statusFilter, siteFilter }],
    queryFn: async () =>
      (await stocksService.getSummary({
        page,
        limit: PAGE_LIMIT,
        search: debouncedSearch || undefined,
        status: statusFilter,
        siteId: siteFilter || undefined,
      })).data,
    enabled: !isSnapshot,
    placeholderData: (previous) => previous,
  });

  const snapshotMovements = useQuery({
    queryKey: ['stock-movements', 'snapshot', stockDate],
    queryFn: async () => fetchAllSnapshotMovements(stockDate),
    enabled: isSnapshot,
  });
  const snapshotLots = useQuery({
    queryKey: ['lots', 'stocks-snapshot'],
    queryFn: async () => (await lotsService.getAll()).data,
    enabled: isSnapshot,
  });
  const snapshotArticles = useQuery({
    queryKey: ['articles', 'stocks-snapshot'],
    queryFn: fetchAllSnapshotArticles,
    enabled: isSnapshot,
  });

  const currentRows = useMemo(() => (summary.data?.items ?? []).map(toCurrentStockRow), [summary.data?.items]);
  const snapshotRows = useMemo(() => {
    const lotsById = new Map((snapshotLots.data ?? []).map((lot) => [lot.lotId, lot]));
    const articlesById = new Map((snapshotArticles.data ?? []).map((article) => [article.articleId, article]));
    return buildSnapshotRows(stockDate, snapshotMovements.data ?? [], lotsById, articlesById);
  }, [snapshotArticles.data, snapshotLots.data, snapshotMovements.data, stockDate]);
  const rows = isSnapshot ? snapshotRows : currentRows;

  const filteredSnapshotRows = useMemo(() => {
    if (!isSnapshot) return rows;
    const searched = filterRows(rows, debouncedSearch, (row) => [
      row.articleCode,
      row.articleName,
      row.dci,
      row.siteName,
      row.statusLabel,
    ]);
    return searched.filter((row) => matchesStatus(row, statusFilter) && (!siteFilter || row.siteId === siteFilter));
  }, [debouncedSearch, isSnapshot, rows, siteFilter, statusFilter]);

  const visibleRows = isSnapshot ? filteredSnapshotRows : rows;
  const selectedSummaryRow = !isSnapshot ? currentRows.find((row) => row.key === selectedKey) ?? null : null;
  const selectedSnapshotRow = isSnapshot
    ? filteredSnapshotRows.find((row) => row.key === selectedKey) ?? snapshotRows.find((row) => row.key === selectedKey) ?? null
    : null;

  const currentDetail = useQuery({
    queryKey: ['stocks-detail', selectedSummaryRow?.articleId, selectedSummaryRow?.siteId],
    enabled: Boolean(selectedSummaryRow),
    queryFn: async () =>
      (await stocksService.getDetail({
        articleId: selectedSummaryRow!.articleId,
        siteId: selectedSummaryRow!.siteId,
      })).data,
  });

  const kpis = useMemo(
    () => ({
      articlesInStock: visibleRows.filter((row) => row.quantityAvailable > 0).length,
      outOfStock: visibleRows.filter((row) => row.quantityAvailable <= 0).length,
      lowStock: visibleRows.filter((row) => row.quantityAvailable > 0 && row.quantityAvailable <= row.stockMin).length,
      purchaseValue: visibleRows.reduce((sum, row) => sum + row.purchaseValue, 0),
      saleValue: visibleRows.reduce((sum, row) => sum + row.saleValue, 0),
    }),
    [visibleRows],
  );

  const loading = isSnapshot
    ? snapshotMovements.isLoading || snapshotLots.isLoading || snapshotArticles.isLoading
    : summary.isLoading;
  const error = isSnapshot
    ? snapshotMovements.error ?? snapshotLots.error ?? snapshotArticles.error
    : summary.error;
  const isRefreshing = isSnapshot
    ? snapshotMovements.isFetching || snapshotLots.isFetching || snapshotArticles.isFetching
    : summary.isFetching;
  const errorMessage = !error
    ? 'Impossible de charger les stocks pour le moment.'
    : snapshotMovements.error
      ? `Impossible de charger les mouvements necessaires au stock a date : ${apiErrorMessage(snapshotMovements.error)}`
      : snapshotArticles.error
        ? `Impossible de charger les articles necessaires au stock a date : ${apiErrorMessage(snapshotArticles.error)}`
        : snapshotLots.error
          ? `Impossible de charger les lots necessaires au stock a date : ${apiErrorMessage(snapshotLots.error)}`
          : apiErrorMessage(error);

  function retry() {
    if (isSnapshot) {
      snapshotMovements.refetch();
      snapshotLots.refetch();
      snapshotArticles.refetch();
      return;
    }
    summary.refetch();
  }

  function exportRows(format: 'xlsx' | 'csv' | 'json') {
    const stamp = fileDateStamp();
    const label = isSnapshot ? stockDate : todayIso();
    const data = stockExportRows(visibleRows, label);
    if (format === 'xlsx') downloadXlsx(`stocks_${stamp}.xlsx`, [{ name: 'Stocks', rows: data }]);
    if (format === 'csv') downloadCsv(`stocks_${stamp}.csv`, data);
    if (format === 'json') downloadJson(`stocks_${stamp}.json`, visibleRows.map((row) => stockExportObject(row, label)));
  }

  const selectedRowForModal = selectedSnapshotRow ?? selectedSummaryRow;

  return (
    <>
      <div className="stock-snapshot-banner card compact-card">
        <strong>{isSnapshot ? `Stock theorique au ${formatDate(stockDate)}` : 'Stock actuel'}</strong>
        {isSnapshot ? (
          <span>Le stock a date est reconstruit a partir des mouvements disponibles, sans modifier les tables de stock.</span>
        ) : (
          <span>
            {summary.data
              ? `${summary.data.total} lignes source cote serveur, page ${summary.data.page}/${summary.data.totalPages}.`
              : 'Resume charge depuis une vue paginee cote serveur.'}
          </span>
        )}
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
          {(siteOptions.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}
        </select>
        {isSnapshot && (
          <input className="input stock-date-input" type="date" value={stockDate} max={todayIso()} onChange={(event) => setStockDate(event.target.value)} />
        )}
        <div className="export-actions stock-export-actions">
          <details className="export-menu">
            <summary className="ghost-button compact-button">Exporter</summary>
            <div className="export-menu-panel">
              <button type="button" disabled={visibleRows.length === 0} onClick={() => exportRows('xlsx')}>Excel</button>
              <button type="button" disabled={visibleRows.length === 0} onClick={() => exportRows('csv')}>CSV</button>
              <button type="button" disabled={visibleRows.length === 0} onClick={() => exportRows('json')}>JSON</button>
              <button type="button" disabled>PDF</button>
            </div>
          </details>
        </div>
      </div>

      {!isSnapshot && summary.data && (
        <div className="stocks-table-meta">
          <span>{summary.data.total} lignes</span>
          {isRefreshing && <span className="muted">Mise a jour...</span>}
        </div>
      )}

      <div className="card">
        {loading ? (
          <StocksSkeleton />
        ) : error ? (
          <div className="error-state">
            <p>{errorMessage}</p>
            <button className="ghost-button compact-button" type="button" onClick={retry}>Reessayer</button>
          </div>
        ) : visibleRows.length === 0 ? (
          <p className="empty-state">Aucun stock trouve. Ajustez la recherche ou les filtres.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table stocks-table">
              <thead><tr><th>Article</th><th>Site</th><th>Disponible</th><th>Reserve</th><th>Total</th><th>Stock min</th><th>Statut</th><th>Valeur achat</th><th>Valeur vente</th><th>Actions</th></tr></thead>
              <tbody>{visibleRows.map((row) => (
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
                  <td className="stocks-cell">
                    <button className="ghost-button compact-button" type="button" onClick={(event) => { event.stopPropagation(); setSelectedKey(row.key); }}>
                      Voir
                    </button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {!isSnapshot && summary.data && summary.data.totalPages > 1 && (
        <div className="table-pagination">
          <button className="ghost-button compact-button" type="button" disabled={page <= 1 || summary.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}>Precedent</button>
          <span>Page {summary.data.page} / {summary.data.totalPages}</span>
          <button className="ghost-button compact-button" type="button" disabled={page >= summary.data.totalPages || summary.isFetching} onClick={() => setPage((current) => current + 1)}>Suivant</button>
        </div>
      )}

      <Modal title="Detail stock" open={Boolean(selectedRowForModal)} onClose={() => setSelectedKey(null)}>
        {isSnapshot ? (
          selectedSnapshotRow && <StockDetailPanel row={selectedSnapshotRow} isSnapshot stockDate={stockDate} />
        ) : currentDetail.isLoading ? (
          <p className="loading-state">Chargement du detail stock...</p>
        ) : currentDetail.data ? (
          <CurrentStockDetail detail={currentDetail.data} />
        ) : (
          <p className="empty-state">Aucun detail disponible pour cette ligne.</p>
        )}
      </Modal>
    </>
  );
}

async function fetchAllSnapshotMovements(stockDate: string) {
  return fetchAllPages(
    async ({ page, limit }) =>
      (
        await stocksService.getMovements({
          page,
          limit,
          dateTo: stockDate,
          sortBy: 'movementDate',
          sortOrder: 'asc',
        })
      ).data,
    { getKey: (movement) => movement.movementId },
  );
}

async function fetchAllSnapshotArticles() {
  return fetchAllPages(
    async ({ page, limit }) => (await articlesService.getAll({ page, limit })).data,
    { getKey: (article) => article.articleId },
  );
}

function StocksSkeleton() {
  return (
    <div className="stocks-skeleton">
      <div className="stocks-skeleton-row" />
      <div className="stocks-skeleton-row" />
      <div className="stocks-skeleton-row" />
      <div className="stocks-skeleton-row" />
    </div>
  );
}

function CurrentStockDetail({ detail }: { detail: StockDetail }) {
  const row: StockRow = {
    key: `${detail.articleId}-${detail.siteId}`,
    articleId: detail.articleId,
    articleCode: detail.articleCode ?? '-',
    articleName: detail.articleName ?? '-',
    dci: detail.dci,
    siteId: detail.siteId,
    siteName: detail.siteName ?? '-',
    quantityAvailable: detail.quantityAvailable,
    quantityReserved: detail.quantityReserved,
    quantityTotal: detail.quantityTotal,
    stockMin: detail.stockMin,
    purchaseValue: detail.purchaseValue,
    saleValue: detail.saleValue,
    statusLabel: stockStatusLabel(detail.quantityAvailable, detail.quantityReserved, detail.stockMin),
    statusClass: stockStatusClass(detail.quantityAvailable, detail.quantityReserved, detail.stockMin),
    lots: detail.lots,
    movements: detail.movements.map((movement) => ({
      movementId: movement.movementId,
      movementDate: movement.movementDate,
      siteId: detail.siteId,
      siteName: detail.siteName,
      articleId: detail.articleId,
      articleCode: detail.articleCode,
      commercialName: detail.articleName,
      lotId: movement.lotId,
      lotNumber: movement.lotNumber,
      movementType: movement.movementType,
      direction: movementSign(movement.movementType) > 0 ? 'IN' : movementSign(movement.movementType) < 0 ? 'OUT' : 'OTHER',
      quantity: movement.quantity,
      referenceType: movement.referenceType,
      referenceId: null,
      referenceNumber: null,
      referenceLabel: null,
    })),
  };
  return <StockDetailPanel row={row} isSnapshot={false} stockDate={todayIso()} />;
}

function StockDetailPanel({ row, isSnapshot, stockDate }: { row: StockRow; isSnapshot: boolean; stockDate: string }) {
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

      <div className="stock-detail-actions">
        <Link className="ghost-button compact-button" to={`/stocks/movements?articleId=${row.articleId}&siteId=${row.siteId}`}>Voir les mouvements de cet article</Link>
      </div>

      <h3>Lots</h3>
      <div className="table-wrap">
        <table className="data-table stocks-detail-table">
          <thead><tr><th>Lot</th><th>Expiration</th><th>Disponible</th><th>Reserve</th><th>PA</th><th>PV</th><th>Mouvements</th></tr></thead>
          <tbody>{row.lots.length === 0 ? <tr><td colSpan={7}>Aucun lot disponible.</td></tr> : row.lots.map((lot) => (
            <tr key={lot.lotId}>
              <td>{lot.lotNumber}</td>
              <td>{formatDate(lot.expiryDate)}</td>
              <td className="quantity-cell">{formatQuantity(lot.quantityAvailable)}</td>
              <td className="quantity-cell">{formatQuantity(lot.quantityReserved)}</td>
              <td className="numeric-text">{formatMoney(lot.purchasePrice, 'USD')}</td>
              <td className="numeric-text">{formatMoney(lot.sellingPrice, 'USD')}</td>
              <td><Link className="ghost-button compact-button" to={`/stocks/movements?lotId=${lot.lotId}`}>Voir</Link></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <h3>Mouvements recents</h3>
      <div className="table-wrap">
        <table className="data-table stocks-detail-table">
          <thead><tr><th>Date</th><th>Type</th><th>Lot</th><th>Quantite</th><th>Reference</th><th>Lien</th></tr></thead>
          <tbody>{row.movements.length === 0 ? <tr><td colSpan={6}>Aucun mouvement accessible.</td></tr> : row.movements.slice(0, 12).map((movement) => {
            const sourceRoute = stockMovementSourceRoute(movement);
            return (
              <tr key={movement.movementId}>
                <td>{formatDate(movement.movementDate)}</td>
                <td>{stockMovementLabel(movement.movementType)}</td>
                <td>{movement.lotNumber ?? '-'}</td>
                <td className="quantity-cell">{formatQuantity(movement.quantity)}</td>
                <td>{movement.referenceType ?? '-'}</td>
                <td>{sourceRoute ? <Link className="ghost-button compact-button" to={sourceRoute}>Ouvrir</Link> : '-'}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

function toCurrentStockRow(row: StockSummary): StockRow {
  return {
    key: `${row.articleId}-${row.siteId}`,
    articleId: row.articleId,
    articleCode: row.articleCode ?? '-',
    articleName: row.commercialName ?? '-',
    dci: row.dci,
    siteId: row.siteId,
    siteName: row.siteName ?? '-',
    quantityAvailable: row.quantityAvailable,
    quantityReserved: row.quantityReserved,
    quantityTotal: row.quantityTotal,
    stockMin: row.stockMin,
    purchaseValue: row.purchaseValue,
    saleValue: row.saleValue,
    statusLabel: mapStatusLabel(row.statusCode),
    statusClass: mapStatusClass(row.statusCode),
    lots: [],
    movements: [],
  };
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
      const current = lotRows.get(lotKey) ?? {
        lotId: movement.lotId,
        lotNumber: movement.lotNumber ?? '-',
        expiryDate: lot?.expiryDate ?? '',
        quantityAvailable: 0,
        quantityReserved: 0,
        purchasePrice,
        sellingPrice,
      };
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

function stockStatus(row: Pick<StockRow, 'quantityAvailable' | 'quantityReserved' | 'stockMin'>) {
  if (row.quantityAvailable <= 0) return { label: 'Rupture', className: 'badge-danger' };
  if (row.quantityReserved > 0) return { label: 'Reserve', className: 'badge-info' };
  if (row.quantityAvailable <= row.stockMin) return { label: 'Stock faible', className: 'badge-warning' };
  return { label: 'Disponible', className: 'badge-success' };
}

function stockStatusLabel(quantityAvailable: number, quantityReserved: number, stockMin: number) {
  return stockStatus({ quantityAvailable, quantityReserved, stockMin }).label;
}

function stockStatusClass(quantityAvailable: number, quantityReserved: number, stockMin: number) {
  return stockStatus({ quantityAvailable, quantityReserved, stockMin }).className;
}

function mapStatusLabel(statusCode: StockSummary['statusCode']) {
  if (statusCode === 'OUT') return 'Rupture';
  if (statusCode === 'RESERVED') return 'Reserve';
  if (statusCode === 'LOW') return 'Stock faible';
  return 'Disponible';
}

function mapStatusClass(statusCode: StockSummary['statusCode']) {
  if (statusCode === 'OUT') return 'badge-danger';
  if (statusCode === 'RESERVED') return 'badge-info';
  if (statusCode === 'LOW') return 'badge-warning';
  return 'badge-success';
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
  if (['PURCHASE_IN', 'INVENTORY_GAIN', 'TRANSFER_IN', 'PURCHASE_EXCHANGE_IN', 'MANUAL_ADJUSTMENT_IN', 'STOCK_ENTRY', 'ADJUSTMENT_IN', 'RETURN_IN'].includes(type)) return 1;
  if (['SALE_OUT', 'INVENTORY_LOSS', 'TRANSFER_OUT', 'PURCHASE_RETURN_OUT', 'MANUAL_ADJUSTMENT_OUT', 'STOCK_OUTPUT', 'ADJUSTMENT_OUT', 'RETURN_OUT', 'EXPIRED_OUT', 'DAMAGED_OUT'].includes(type)) return -1;
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
