import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { articlesService } from '../../services/articles.service';
import { apiErrorMessage } from '../../services/apiError';
import { lotsService } from '../../services/lots.service';
import { referenceService } from '../../services/reference.service';
import { stocksService } from '../../services/stocks.service';
import { downloadCsv, downloadJson, downloadXlsx } from '../../utils/export';
import { formatDate, fileDateStamp } from '../../utils/date';
import { fetchAllPages } from '../../utils/fetchAllPages';
import { formatMoney } from '../../utils/money';
import { buildFefoKpis, buildFefoRiskRows, priorityClass, priorityLabel, type FefoRiskRow } from './fefo-utils';

type ExpiryFilter = 'ALL' | 'D30' | 'D90' | 'EXPIRED';

export function FefoHighlightPage() {
  const [search, setSearch] = useState('');
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('ALL');
  const [siteId, setSiteId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const lots = useQuery({ queryKey: ['lots'], queryFn: async () => (await lotsService.getAll()).data });
  const stocks = useQuery({ queryKey: ['stocks'], queryFn: async () => (await stocksService.getAll()).data });
  const articles = useQuery({
    queryKey: ['articles', 'fefo'],
    queryFn: async () =>
      fetchAllPages(
        async ({ page, limit }) => (await articlesService.getAll({ page, limit })).data,
        { getKey: (article) => article.articleId },
      ),
  });
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await referenceService.categories.getAll()).data });
  const error = [lots, stocks, articles, categories].find((query) => query.isError)?.error;

  const rows = useMemo(
    () => buildFefoRiskRows(lots.data ?? [], stocks.data ?? [], articles.data ?? []),
    [lots.data, stocks.data, articles.data],
  );
  const sites = useMemo(() => Array.from(new Map(rows.map((row) => [row.siteId, row.siteName])).entries()), [rows]);
  const filteredRows = useMemo(() => filterRows(rows, search, expiryFilter, siteId, categoryId), [rows, search, expiryFilter, siteId, categoryId]);
  const kpis = useMemo(() => buildFefoKpis(filteredRows), [filteredRows]);
  const urgentCount = filteredRows.filter((row) => row.daysRemaining >= 0 && row.daysRemaining <= 7).length;
  const warningCount = filteredRows.filter((row) => row.daysRemaining > 7 && row.daysRemaining <= 30).length;

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Stock &gt; Produits a mettre en avant</p>
          <h1>Produits a mettre en avant aujourd'hui</h1>
          <p className="muted-text">Assistant FEFO en lecture seule : les lots les plus proches de l'expiration sont tries en premier.</p>
        </div>
        <ExportActions rows={filteredRows} prefix="fefo_mise_en_avant" />
      </div>

      {error && <p className="form-error">{apiErrorMessage(error)}</p>}
      {(urgentCount > 0 || warningCount > 0) && (
        <div className="fefo-alerts">
          {urgentCount > 0 && <div className="fefo-alert danger">Alerte rouge : {urgentCount} lot(s) expirent sous 7 jours.</div>}
          {warningCount > 0 && <div className="fefo-alert warning">Notification orange : {warningCount} lot(s) expirent sous 30 jours.</div>}
        </div>
      )}

      <div className="grid two fefo-kpis">
        <Kpi label="Produits prioritaires aujourd'hui" value={kpis.priorityToday} />
        <Kpi label="Lots expirant sous 30 jours" value={kpis.expiring30} />
        <Kpi label="Lots expirant sous 90 jours" value={kpis.expiring90} />
        <Kpi label="Lots deja expires" value={kpis.expired} />
        <Kpi label="Valeur financiere a risque" value={formatMoney(kpis.riskValue, 'USD')} />
      </div>

      <div className="card fefo-filters">
        <input className="input" placeholder="Rechercher article, code, DCI, lot, site..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input" value={expiryFilter} onChange={(event) => setExpiryFilter(event.target.value as ExpiryFilter)}>
          <option value="ALL">Tous</option>
          <option value="D30">30 jours</option>
          <option value="D90">90 jours</option>
          <option value="EXPIRED">Expires</option>
        </select>
        <select className="input" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
          <option value="">Tous les sites</option>
          {sites.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select className="input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Toutes categories</option>
          {(categories.data ?? []).map((category) => <option key={category.categoryId} value={category.categoryId}>{category.categoryName}</option>)}
        </select>
      </div>

      <div className="card">
        {lots.isLoading || stocks.isLoading || articles.isLoading ? <p className="loading-state">Analyse FEFO en cours...</p> : (
          <div className="table-wrap fefo-table-wrap">
            <table className="data-table fefo-table">
              <thead>
                <tr>
                  <th>Priorite</th>
                  <th>Article</th>
                  <th>DCI</th>
                  <th>Lot</th>
                  <th>Site</th>
                  <th className="quantity-cell">Stock disponible</th>
                  <th>Expiration</th>
                  <th className="quantity-cell">Jours restants</th>
                  <th className="numeric-text">Valeur du stock</th>
                  <th>Action recommandee</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? <tr><td colSpan={10} className="empty-state">Aucun lot disponible pour ces criteres.</td></tr> : filteredRows.map((row) => (
                  <tr key={row.key}>
                    <td><span className={priorityClass(row.priority)}>{priorityLabel(row.priority)}</span></td>
                    <td><strong>{row.articleName}</strong><br /><span className="muted-text">{row.articleCode}</span></td>
                    <td>{row.dci}</td>
                    <td>{row.lotNumber}</td>
                    <td>{row.siteName}</td>
                    <td className="quantity-cell">{row.quantityAvailable}</td>
                    <td>{formatDate(row.expiryDate)}</td>
                    <td className="quantity-cell">{row.daysRemaining < 0 ? `${Math.abs(row.daysRemaining)} j depasse` : row.daysRemaining}</td>
                    <td className="numeric-text">{formatMoney(row.stockValue, row.currencyCode, row.currencySymbol)}</td>
                    <td>{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function filterRows(rows: FefoRiskRow[], search: string, expiryFilter: ExpiryFilter, siteId: string, categoryId: string) {
  const needle = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (siteId && row.siteId !== siteId) return false;
    if (categoryId && row.categoryId !== categoryId) return false;
    if (expiryFilter === 'D30' && !(row.daysRemaining >= 0 && row.daysRemaining <= 30)) return false;
    if (expiryFilter === 'D90' && !(row.daysRemaining >= 0 && row.daysRemaining <= 90)) return false;
    if (expiryFilter === 'EXPIRED' && row.daysRemaining >= 0) return false;
    if (!needle) return true;
    return [row.articleName, row.articleCode, row.dci, row.lotNumber, row.siteName].some((value) => value.toLowerCase().includes(needle));
  });
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="card kpi-card"><span className="kpi-label">{label}</span><p className="metric small-metric">{value}</p></div>;
}

function ExportActions({ rows, prefix }: { rows: FefoRiskRow[]; prefix: string }) {
  function exportRows(format: 'xlsx' | 'csv' | 'json') {
    const stamp = fileDateStamp();
    const header = ['Priorite', 'Article', 'Code', 'DCI', 'Lot', 'Site', 'Stock disponible', 'Expiration', 'Jours restants', 'Valeur du stock', 'Action recommandee'];
    const data = rows.map((row) => [
      priorityLabel(row.priority),
      row.articleName,
      row.articleCode,
      row.dci,
      row.lotNumber,
      row.siteName,
      row.quantityAvailable,
      formatDate(row.expiryDate),
      row.daysRemaining,
      formatMoney(row.stockValue, row.currencyCode, row.currencySymbol),
      row.action,
    ]);
    if (format === 'xlsx') downloadXlsx(`${prefix}_${stamp}.xlsx`, [{ name: 'FEFO', rows: [header, ...data] }]);
    if (format === 'csv') downloadCsv(`${prefix}_${stamp}.csv`, [header, ...data]);
    if (format === 'json') downloadJson(`${prefix}_${stamp}.json`, rows);
  }

  return (
    <div className="export-actions">
      <button className="ghost-button" onClick={() => exportRows('xlsx')}>Excel</button>
      <button className="ghost-button" onClick={() => exportRows('csv')}>CSV</button>
      <button className="ghost-button" onClick={() => exportRows('json')}>JSON</button>
    </div>
  );
}
