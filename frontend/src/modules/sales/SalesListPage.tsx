import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiErrorMessage } from '../../services/apiError';
import { salesService } from '../../services/sales.service';
import { sitesService } from '../../services/sites.service';
import { formatDateTime } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import {
  fetchAllSales,
  salesExportObjects,
  salesExportRows,
  salesFiltersToQuery,
  salesPeriodRange,
  type PeriodPreset,
  type SalesModuleFilters,
} from './sales-module-utils';

const PAGE_SIZE = 25;

const DEFAULT_FILTERS: SalesModuleFilters = {
  saleNumber: '',
  customer: '',
  seller: '',
  siteId: '',
  saleType: '',
  saleMode: '',
  status: '',
  paymentMode: '',
  from: '',
  to: '',
  period: 'custom',
};

export function SalesListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPeriod = (searchParams.get('period') as PeriodPreset) || 'custom';
  const [page, setPage] = useState(Number(searchParams.get('page') || '1'));
  const [period, setPeriod] = useState<PeriodPreset>(initialPeriod);
  const [filters, setFilters] = useState<SalesModuleFilters>(() => ({
    ...DEFAULT_FILTERS,
    saleNumber: searchParams.get('saleNumber') || '',
    customer: searchParams.get('customer') || '',
    seller: searchParams.get('seller') || '',
    siteId: searchParams.get('siteId') || '',
    saleType: searchParams.get('saleType') || '',
    saleMode: searchParams.get('saleMode') || '',
    status: searchParams.get('status') || '',
    paymentMode: searchParams.get('paymentMode') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
    period: initialPeriod,
  }));

  const sites = useQuery({ queryKey: ['sales-list-sites'], queryFn: async () => (await sitesService.getAll()).data, staleTime: 5 * 60 * 1000 });
  const query = useMemo(() => salesFiltersToQuery(filters), [filters]);
  const sales = useQuery({
    queryKey: ['sales-list', query, page],
    queryFn: async () => (await salesService.getList({ ...query, page, limit: PAGE_SIZE })).data,
    placeholderData: (previous) => previous,
  });
  const summary = useQuery({
    queryKey: ['sales-list-summary', query],
    queryFn: async () => (await salesService.getSummary(query)).data,
    placeholderData: (previous) => previous,
  });

  const rows = sales.data?.items ?? [];

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [];
    if (period !== 'custom') chips.push({ key: 'period', label: periodLabel(period, filters.from, filters.to) });
    else if (filters.from || filters.to) chips.push({ key: 'period', label: `Periode : ${filters.from || '...'} - ${filters.to || '...'}` });
    if (filters.siteId) chips.push({ key: 'siteId', label: `Site : ${sites.data?.find((site) => site.siteId === filters.siteId)?.siteName ?? filters.siteId}` });
    if (filters.customer) chips.push({ key: 'customer', label: `Client : ${filters.customer}` });
    if (filters.seller) chips.push({ key: 'seller', label: `Caissier : ${filters.seller}` });
    if (filters.saleType) chips.push({ key: 'saleType', label: `Type : ${filters.saleType}` });
    if (filters.saleMode) chips.push({ key: 'saleMode', label: `Mode : ${filters.saleMode}` });
    if (filters.status) chips.push({ key: 'status', label: `Statut : ${filters.status}` });
    if (filters.paymentMode) chips.push({ key: 'paymentMode', label: `Paiement : ${filters.paymentMode}` });
    return chips;
  }, [filters.customer, filters.from, filters.paymentMode, filters.saleMode, filters.saleType, filters.seller, filters.siteId, filters.status, filters.to, period, sites.data]);

  function syncFilters(nextFilters: SalesModuleFilters, nextPage = 1) {
    setFilters(nextFilters);
    setPage(nextPage);
    const params = new URLSearchParams();
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
    });
    if (nextPage > 1) params.set('page', String(nextPage));
    setSearchParams(params, { replace: true });
  }

  function updateFilters(next: Partial<SalesModuleFilters>) {
    const nextPeriod = next.period ?? period;
    if (next.period) setPeriod(next.period);
    syncFilters({ ...filters, ...next, period: nextPeriod }, 1);
  }

  function applyPeriod(next: PeriodPreset) {
    const range = salesPeriodRange(next);
    setPeriod(next);
    syncFilters({
      ...filters,
      period: next,
      from: next === 'custom' ? filters.from : range.from,
      to: next === 'custom' ? filters.to : range.to,
    }, 1);
  }

  function resetFilters() {
    setPeriod('custom');
    syncFilters({ ...DEFAULT_FILTERS }, 1);
  }

  async function exportList(format: 'xlsx' | 'csv' | 'json') {
    const items = await fetchAllSales(filters);
    const stamp = formatStamp();
    if (format === 'xlsx') {
      const { downloadXlsx } = await import('../../utils/export');
      downloadXlsx(`ventes_${stamp}.xlsx`, [{ name: 'Ventes', rows: salesExportRows(items) }]);
      return;
    }
    if (format === 'csv') {
      const { downloadCsv } = await import('../../utils/export');
      downloadCsv(`ventes_${stamp}.csv`, salesExportRows(items));
      return;
    }
    const { downloadJson } = await import('../../utils/export');
    downloadJson(`ventes_${stamp}.json`, salesExportObjects(items));
  }

  return (
    <section className="sales-module-page">
      <div className="card sales-list-summary">
        <div className="sales-list-summary-grid">
          <div><span>CA net</span><strong>{formatMoney(summary.data?.revenueNet ?? 0, 'USD')}</strong></div>
          <div><span>Ventes valides</span><strong>{summary.data?.saleCount ?? 0}</strong></div>
          <div><span>Encaisse USD</span><strong>{formatMoney(summary.data?.receivedUsd ?? 0, 'USD')}</strong></div>
          <div><span>Encaisse FC</span><strong>{formatMoney(summary.data?.receivedCdf ?? 0, 'CDF', 'FC')}</strong></div>
        </div>
      </div>

      <section className="card sales-list-filters">
        <div className="sales-list-filter-grid">
          <input className="input compact-input" placeholder="Numero vente..." value={filters.saleNumber || ''} onChange={(event) => updateFilters({ saleNumber: event.target.value })} />
          <input className="input compact-input" placeholder="Client..." value={filters.customer || ''} onChange={(event) => updateFilters({ customer: event.target.value })} />
          <input className="input compact-input" placeholder="Caissier..." value={filters.seller || ''} onChange={(event) => updateFilters({ seller: event.target.value })} />
          <select className="input compact-input" value={filters.siteId || ''} onChange={(event) => updateFilters({ siteId: event.target.value })}>
            <option value="">Tous les sites</option>
            {(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}
          </select>
          <select className="input compact-input" value={filters.saleType || ''} onChange={(event) => updateFilters({ saleType: event.target.value })}>
            <option value="">Type</option>
            <option value="CASH">CASH</option>
            <option value="INSURANCE">ASSURANCE</option>
          </select>
          <select className="input compact-input" value={filters.saleMode || ''} onChange={(event) => updateFilters({ saleMode: event.target.value })}>
            <option value="">Mode</option>
            <option value="IMMEDIATE">Immediate</option>
            <option value="ADVANCE">Avance</option>
          </select>
          <select className="input compact-input" value={filters.status || ''} onChange={(event) => updateFilters({ status: event.target.value })}>
            <option value="">Statut</option>
            <option value="DRAFT">DRAFT</option>
            <option value="VALIDATED">VALIDATED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <select className="input compact-input" value={filters.paymentMode || ''} onChange={(event) => updateFilters({ paymentMode: event.target.value })}>
            <option value="">Paiement</option>
            <option value="CASH">Cash</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="BANK">Banque</option>
          </select>
          <select className="input compact-input" value={period} onChange={(event) => applyPeriod(event.target.value as PeriodPreset)}>
            <option value="today">Aujourd&apos;hui</option>
            <option value="yesterday">Hier</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
            <option value="previous-month">Mois precedent</option>
            <option value="custom">Personnalise</option>
          </select>
          <input className="input compact-input" type="date" value={filters.from || ''} onChange={(event) => updateFilters({ from: event.target.value, period: 'custom' })} />
          <input className="input compact-input" type="date" value={filters.to || ''} onChange={(event) => updateFilters({ to: event.target.value, period: 'custom' })} />
        </div>
        <div className="sales-list-actions">
          <button className="ghost-button compact-button" type="button" onClick={resetFilters}>Reinitialiser</button>
          <details className="export-menu">
            <summary className="ghost-button compact-button">Exporter</summary>
            <div className="export-menu-panel">
              <button type="button" disabled={rows.length === 0} onClick={() => exportList('xlsx')}>Excel</button>
              <button type="button" disabled={rows.length === 0} onClick={() => exportList('csv')}>CSV</button>
              <button type="button" disabled={rows.length === 0} onClick={() => exportList('json')}>JSON</button>
            </div>
          </details>
        </div>
        <div className="sales-list-chips">
          {activeChips.length === 0 ? <span className="muted">Aucun filtre actif.</span> : activeChips.map((chip) => <span className="badge badge-neutral" key={chip.key}>{chip.label}</span>)}
        </div>
      </section>

      {sales.isLoading ? (
        <div className="card"><p className="loading-state">Chargement des ventes...</p></div>
      ) : sales.isError ? (
        <div className="card">
          <p className="form-error">Impossible de charger la liste des ventes.</p>
          <p className="muted">{apiErrorMessage(sales.error)}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card"><p className="empty-state">Aucune vente trouvee pour ces filtres.</p></div>
      ) : (
        <>
          <div className="card">
            <div className="table-wrap">
              <table className="data-table sales-module-table">
                <thead>
                  <tr>
                    <th>Date / heure</th>
                    <th>Numero</th>
                    <th>Client</th>
                    <th>Site</th>
                    <th>Caissier</th>
                    <th>Type</th>
                    <th>Mode</th>
                    <th>Livraison</th>
                    <th>Total facture</th>
                    <th>Net USD</th>
                    <th>Net FC</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((sale) => (
                    <tr className="clickable-row" key={sale.saleId} onClick={() => navigate(`/sales/${sale.saleId}`)}>
                      <td>{formatDateTime(sale.saleDate)}</td>
                      <td><Link className="inline-link" to={`/sales/${sale.saleId}`} onClick={(event) => event.stopPropagation()}>{sale.saleNumber}</Link></td>
                      <td>{sale.customerName || sale.organizationName || 'Comptoir'}</td>
                      <td>{sale.siteName ?? '-'}</td>
                      <td>{sale.createdByName ?? '-'}</td>
                      <td><span className={`badge ${sale.saleType === 'INSURANCE' ? 'badge-info' : 'badge-success'}`}>{sale.saleType}</span></td>
                      <td><span className={`badge ${sale.saleMode === 'ADVANCE' ? 'badge-warning' : 'badge-success'}`}>{sale.saleMode === 'ADVANCE' ? 'AVANCE' : 'IMMEDIATE'}</span></td>
                      <td><span className={`badge ${sale.fulfillmentStatus === 'FULFILLED' ? 'badge-success' : sale.fulfillmentStatus === 'PARTIALLY_FULFILLED' ? 'badge-warning' : 'badge-muted'}`}>{sale.fulfillmentStatus || 'N/A'}</span></td>
                      <td className="numeric-text">{formatMoney(sale.totalAmount, sale.currencyCode ?? 'USD', sale.currencySymbol)}</td>
                      <td className="numeric-text">{formatMoney(sale.netReceivedUsd ?? 0, 'USD')}</td>
                      <td className="numeric-text">{formatMoney(sale.netReceivedCdf ?? 0, 'CDF', 'FC')}</td>
                      <td><span className={`badge ${sale.status === 'VALIDATED' ? 'badge-success' : sale.status === 'CANCELLED' ? 'badge-muted' : 'badge-warning'}`}>{sale.status}</span></td>
                      <td>
                        <Link className="ghost-button compact-button table-action-button" to={`/sales/${sale.saleId}`}>Voir</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {sales.data && sales.data.totalPages > 1 && (
            <div className="table-pagination">
              <button className="ghost-button compact-button" type="button" disabled={page <= 1 || sales.isFetching} onClick={() => { const next = Math.max(1, page - 1); setPage(next); syncFilters(filters, next); }}>Precedent</button>
              <span>Page {sales.data.page} / {sales.data.totalPages}</span>
              <button className="ghost-button compact-button" type="button" disabled={page >= sales.data.totalPages || sales.isFetching} onClick={() => { const next = page + 1; setPage(next); syncFilters(filters, next); }}>Suivant</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function formatStamp(date = new Date()) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function periodLabel(period: PeriodPreset, from?: string, to?: string) {
  if (period === 'today') return "Aujourd'hui";
  if (period === 'yesterday') return 'Hier';
  if (period === 'week') return 'Cette semaine';
  if (period === 'month') return 'Ce mois';
  if (period === 'previous-month') return 'Mois precedent';
  if (from || to) return `${from || '...'} - ${to || '...'}`;
  return 'Personnalise';
}
