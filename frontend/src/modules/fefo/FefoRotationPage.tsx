import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { articlesService } from '../../services/articles.service';
import { apiErrorMessage } from '../../services/apiError';
import { lotsService } from '../../services/lots.service';
import { stocksService } from '../../services/stocks.service';
import { downloadCsv, downloadJson, downloadXlsx } from '../../utils/export';
import { fileDateStamp, formatDate } from '../../utils/date';
import { fetchAllPages } from '../../utils/fetchAllPages';
import { formatMoney } from '../../utils/money';
import { buildFefoRiskRows, buildRotationKpis, buildRotationRows, priorityClass, priorityLabel, type FefoRotationRow } from './fefo-utils';

export function FefoRotationPage() {
  const [search, setSearch] = useState('');
  const [siteId, setSiteId] = useState('');
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
  const error = [lots, stocks, articles].find((query) => query.isError)?.error;
  const rows = useMemo(() => {
    const riskRows = buildFefoRiskRows(lots.data ?? [], stocks.data ?? [], articles.data ?? []);
    return buildRotationRows(riskRows);
  }, [lots.data, stocks.data, articles.data]);
  const sites = useMemo(() => Array.from(new Map(rows.map((row) => [row.siteId, row.siteName])).entries()), [rows]);
  const filteredRows = useMemo(() => filterRows(rows, search, siteId), [rows, search, siteId]);
  const kpis = useMemo(() => buildRotationKpis(filteredRows), [filteredRows]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Stock &gt; Rotation des rayons</p>
          <h1>Rotation des rayons</h1>
          <p className="muted-text">Vue decisionnelle : le lot FEFO doit etre celui mis en avant physiquement.</p>
        </div>
        <ExportActions rows={filteredRows} />
      </div>

      {error && <p className="form-error">{apiErrorMessage(error)}</p>}
      {kpis.critical > 0 && <div className="fefo-alerts"><div className="fefo-alert danger">{kpis.critical} rotation(s) critiques a traiter.</div></div>}

      <div className="grid two fefo-kpis">
        <Kpi label="Rotations recommandees" value={kpis.recommended} />
        <Kpi label="Lots mal positionnes" value={kpis.mispositioned} />
        <Kpi label="Lots critiques" value={kpis.critical} />
        <Kpi label="Valeur concernee" value={formatMoney(kpis.concernedValue, 'USD')} />
        <Kpi label="FEFO Sante" value={`${kpis.health} %`} />
      </div>

      <div className="card fefo-filters">
        <input className="input" placeholder="Rechercher article, code, DCI, lot, site..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
          <option value="">Tous les sites</option>
          {sites.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>

      <div className="card">
        {lots.isLoading || stocks.isLoading || articles.isLoading ? <p className="loading-state">Analyse rotation en cours...</p> : (
          <div className="table-wrap fefo-table-wrap">
            <table className="data-table fefo-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Lot actuel</th>
                  <th>Expiration</th>
                  <th className="quantity-cell">Stock</th>
                  <th>Priorite</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? <tr><td colSpan={6} className="empty-state">Aucune rotation a afficher.</td></tr> : filteredRows.map((row) => (
                  <tr key={row.key}>
                    <td><strong>{row.articleName}</strong><br /><span className="muted-text">{row.articleCode} - {row.siteName}</span></td>
                    <td>{row.lotNumber}</td>
                    <td>{formatDate(row.expiryDate)}</td>
                    <td className="quantity-cell">{row.quantityAvailable}</td>
                    <td><span className={priorityClass(row.priority)}>{priorityLabel(row.priority)}</span></td>
                    <td>{row.action}{row.mispositioned && <span className="fefo-inline-alert"> lot recent dominant</span>}</td>
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

function filterRows(rows: FefoRotationRow[], search: string, siteId: string) {
  const needle = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (siteId && row.siteId !== siteId) return false;
    if (!needle) return true;
    return [row.articleName, row.articleCode, row.dci, row.lotNumber, row.siteName, row.action].some((value) => value.toLowerCase().includes(needle));
  });
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="card kpi-card"><span className="kpi-label">{label}</span><p className="metric small-metric">{value}</p></div>;
}

function ExportActions({ rows }: { rows: FefoRotationRow[] }) {
  function exportRows(format: 'xlsx' | 'csv' | 'json') {
    const stamp = fileDateStamp();
    const header = ['Article', 'Code', 'Site', 'Lot actuel', 'Expiration', 'Stock', 'Priorite', 'Action', 'Valeur concernee'];
    const data = rows.map((row) => [
      row.articleName,
      row.articleCode,
      row.siteName,
      row.lotNumber,
      formatDate(row.expiryDate),
      row.quantityAvailable,
      priorityLabel(row.priority),
      row.action,
      formatMoney(row.stockValue, row.currencyCode, row.currencySymbol),
    ]);
    if (format === 'xlsx') downloadXlsx(`fefo_rotation_${stamp}.xlsx`, [{ name: 'Rotation FEFO', rows: [header, ...data] }]);
    if (format === 'csv') downloadCsv(`fefo_rotation_${stamp}.csv`, [header, ...data]);
    if (format === 'json') downloadJson(`fefo_rotation_${stamp}.json`, rows);
  }

  return (
    <div className="export-actions">
      <button className="ghost-button" onClick={() => exportRows('xlsx')}>Excel</button>
      <button className="ghost-button" onClick={() => exportRows('csv')}>CSV</button>
      <button className="ghost-button" onClick={() => exportRows('json')}>JSON</button>
    </div>
  );
}
