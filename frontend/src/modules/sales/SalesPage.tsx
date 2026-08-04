import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { useAuth } from '../../auth/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { apiErrorMessage } from '../../services/apiError';
import { cashService } from '../../services/cash.service';
import { Sale, salesService } from '../../services/sales.service';
import { sitesService } from '../../services/sites.service';
import { reportsService } from '../../services/reports.service';
import { formatDate, fileDateStamp } from '../../utils/date';
import { downloadCsv, downloadJson, downloadXlsx } from '../../utils/export';
import { formatMoney } from '../../utils/money';
import { SalePickupSection } from './SalePickupSection';

type DatePreset = 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'PREVIOUS_MONTH' | 'CUSTOM';

type FiltersState = {
  saleNumber: string;
  customer: string;
  seller: string;
  siteId: string;
  status: string;
  saleType: string;
  saleMode: string;
  paymentMode: string;
  dateFrom: string;
  dateTo: string;
  preset: DatePreset;
  sortBy: 'saleDate' | 'totalAmount' | 'createdAt';
  sortOrder: 'asc' | 'desc';
};

type DayReportSnapshot = {
  label: string;
  subtitle: string;
  siteLabel: string;
  period: { from: string; to: string };
  summary: {
    revenueNet: number;
    saleCount: number;
    averageBasket: number;
    itemsSold: number;
    receivedUsd: number;
    receivedCdf: number;
    changeUsd: number;
    changeCdf: number;
    settlementDifferenceUsd: number;
    immediateSaleCount?: number;
    advanceSaleCount?: number;
    immediateRevenue?: number;
    advanceFulfilledRevenue?: number;
    advancePendingRevenue?: number;
  };
  sales: Sale[];
  topProducts: Array<{
    articleCode?: string | null;
    commercialName?: string | null;
    quantity: number;
    revenue: number;
  }>;
  saleBreakdown: Array<{
    saleType: string;
    count: number;
    totalAmount: number;
    patientAmount: number;
    insuranceAmount: number;
  }>;
  cashBreakdown: Array<{
    movementType: string;
    count: number;
    amount: number;
  }>;
  sessionStats: {
    openCount: number;
    closedCount: number;
    totalCount: number;
  };
  exportFilters: Record<string, string | number | undefined>;
  exportName: string;
};

const DEFAULT_PAGE_SIZE = 25;

export function SalesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { permissions } = useAuth();
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FiltersState>(defaultFilters());
  const [dateError, setDateError] = useState('');
  const debouncedSaleNumber = useDebouncedValue(filters.saleNumber, 300);
  const debouncedCustomer = useDebouncedValue(filters.customer, 300);
  const debouncedSeller = useDebouncedValue(filters.seller, 300);
  const canCreateSale = permissions.includes('sales.create');

  const effectiveFilters = useMemo(() => ({
    saleNumber: debouncedSaleNumber || undefined,
    customer: debouncedCustomer || undefined,
    seller: debouncedSeller || undefined,
    siteId: filters.siteId || undefined,
    status: filters.status || undefined,
    saleType: filters.saleType || undefined,
    saleMode: filters.saleMode || undefined,
    paymentMode: filters.paymentMode || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }), [debouncedCustomer, debouncedSaleNumber, debouncedSeller, filters.dateFrom, filters.dateTo, filters.paymentMode, filters.saleMode, filters.saleType, filters.siteId, filters.sortBy, filters.sortOrder, filters.status]);

  const sales = useQuery({
    queryKey: ['sales-list', effectiveFilters, page],
    queryFn: async () => (await salesService.getList({
      ...effectiveFilters,
      page,
      limit: DEFAULT_PAGE_SIZE,
    })).data,
    placeholderData: (previous) => previous,
  });
  const summary = useQuery({
    queryKey: ['sales-summary', effectiveFilters],
    queryFn: async () => (await salesService.getSummary(effectiveFilters)).data,
    placeholderData: (previous) => previous,
  });
  const sites = useQuery({
    queryKey: ['sites', 'sales-filter'],
    queryFn: async () => (await sitesService.getAll()).data,
    staleTime: 5 * 60 * 1000,
  });
  const detail = useQuery({
    queryKey: ['sale', selectedSaleId],
    enabled: Boolean(selectedSaleId),
    queryFn: async () => (await salesService.getById(selectedSaleId as string)).data,
  });
  const yesterdayRange = useMemo(() => dateRangeFromPreset('YESTERDAY'), []);
  const todayRange = useMemo(() => dateRangeFromPreset('TODAY'), []);
  const reportSiteId = filters.siteId || undefined;
  const reportSiteLabel = useMemo(() => {
    if (!reportSiteId) return 'Tous les sites';
    return sites.data?.find((site) => site.siteId === reportSiteId)?.siteName ?? 'Site selectionne';
  }, [reportSiteId, sites.data]);
  const yesterdayReport = useQuery({
    queryKey: ['sales-day-report', 'yesterday', reportSiteId],
    queryFn: async () => loadSalesDaySnapshot({
      title: 'Rapport ventes d\'hier',
      subtitle: `Ventes validées du ${formatDate(yesterdayRange.dateFrom)} au ${formatDate(yesterdayRange.dateTo)}`,
      from: yesterdayRange.dateFrom,
      to: yesterdayRange.dateTo,
      siteId: reportSiteId,
      siteLabel: reportSiteLabel,
      includeCash: false,
      exportName: 'rapport_ventes_hier',
    }),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previous) => previous,
  });
  const dayEndReport = useQuery({
    queryKey: ['sales-day-report', 'today', reportSiteId],
    queryFn: async () => loadSalesDaySnapshot({
      title: 'Mini rapport fin de journée',
      subtitle: `Synthèse du ${formatDate(todayRange.dateFrom)}`,
      from: todayRange.dateFrom,
      to: todayRange.dateTo,
      siteId: reportSiteId,
      siteLabel: reportSiteLabel,
      includeCash: true,
      exportName: 'mini_rapport_fin_journee',
    }),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextSaleMode = params.get('saleMode');
    if (!nextSaleMode) return;
    setFilters((current) => (current.saleMode === nextSaleMode ? current : { ...current, saleMode: nextSaleMode as FiltersState['saleMode'], preset: 'CUSTOM' }));
    setPage(1);
  }, [location.search]);

  const rows = sales.data?.items ?? [];
  const paymentModes = useMemo(() => unique(rows.flatMap((sale) => (sale.paymentModes ?? '').split(',').map((value) => value.trim()).filter(Boolean))), [rows]);

  function updateFilter<K extends keyof FiltersState>(key: K, value: FiltersState[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    if (key !== 'sortBy' && key !== 'sortOrder') setPage(1);
  }

  function setPreset(preset: DatePreset) {
    const range = dateRangeFromPreset(preset);
    setDateError('');
    setFilters((current) => ({ ...current, preset, dateFrom: range.dateFrom, dateTo: range.dateTo }));
    setPage(1);
  }

  function handleDateChange(key: 'dateFrom' | 'dateTo', value: string) {
    const next = { ...filters, [key]: value, preset: 'CUSTOM' as const };
    if (next.dateFrom && next.dateTo && next.dateFrom > next.dateTo) {
      setDateError('La date de debut doit etre inferieure ou egale a la date de fin.');
    } else {
      setDateError('');
    }
    setFilters(next);
    setPage(1);
  }

  function resetFilters() {
    setFilters(defaultFilters());
    setDateError('');
    setPage(1);
  }

  async function exportRows(format: 'xlsx' | 'csv' | 'json') {
    const items = await fetchAllSalesForExport(effectiveFilters);
    const stamp = fileDateStamp();
    const data = saleExportRows(items);
    if (format === 'xlsx') downloadXlsx(`ventes_${stamp}.xlsx`, [{ name: 'Ventes', rows: data }]);
    if (format === 'csv') downloadCsv(`ventes_${stamp}.csv`, data);
    if (format === 'json') downloadJson(`ventes_${stamp}.json`, items.map(saleExportObject));
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Ventes</h1>
          <p className="muted">Historique, suivi et analyse des ventes. Toute nouvelle vente passe par le POS.</p>
        </div>
        {canCreateSale && <button className="button" type="button" onClick={() => navigate('/pos')}>+ Nouvelle Vente</button>}
      </div>

      <div className="stats-grid sales-kpis">
        <KpiCard label="CA net" value={formatMoney(summary.data?.revenueNet ?? 0, 'USD')} />
        <KpiCard label="Ventes validees" value={String(summary.data?.saleCount ?? 0)} />
        <KpiCard label="Encaisse USD" value={formatMoney(summary.data?.receivedUsd ?? 0, 'USD')} />
        <KpiCard label="Encaisse FC" value={formatMoney(summary.data?.receivedCdf ?? 0, 'CDF', 'FC')} />
      </div>

      <div className="card sales-filters advanced-sales-filters">
        <div className="sales-filter-grid">
          <SearchBox value={filters.saleNumber} onChange={(value) => updateFilter('saleNumber', value)} placeholder="Numero vente..." />
          <input className="input" placeholder="Client / assurance..." value={filters.customer} onChange={(event) => updateFilter('customer', event.target.value)} />
          <input className="input" placeholder="Caissier / vendeur..." value={filters.seller} onChange={(event) => updateFilter('seller', event.target.value)} />
          <select className="input" value={filters.siteId} onChange={(event) => updateFilter('siteId', event.target.value)}>
            <option value="">Tous les sites</option>
            {(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}
          </select>
          <select className="input" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">Tous statuts</option>
            <option value="DRAFT">DRAFT</option>
            <option value="VALIDATED">VALIDATED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <select className="input" value={filters.saleType} onChange={(event) => updateFilter('saleType', event.target.value)}>
            <option value="">Tous types</option>
            <option value="CASH">CASH</option>
            <option value="INSURANCE">INSURANCE</option>
          </select>
          <select className="input" value={filters.saleMode} onChange={(event) => updateFilter('saleMode', event.target.value)}>
            <option value="">Tous modes</option>
            <option value="IMMEDIATE">Ventes immediates</option>
            <option value="ADVANCE">Paiements en avance</option>
            <option value="REALIZED">Commandes livrees</option>
            <option value="PENDING_PICKUP">Commandes en attente</option>
          </select>
          <select className="input" value={filters.paymentMode} onChange={(event) => updateFilter('paymentMode', event.target.value)}>
            <option value="">Tous paiements</option>
            {paymentModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
          </select>
          <select className="input" value={filters.sortBy} onChange={(event) => updateFilter('sortBy', event.target.value as FiltersState['sortBy'])}>
            <option value="saleDate">Tri date vente</option>
            <option value="totalAmount">Tri montant</option>
            <option value="createdAt">Tri creation</option>
          </select>
          <select className="input" value={filters.sortOrder} onChange={(event) => updateFilter('sortOrder', event.target.value as FiltersState['sortOrder'])}>
            <option value="desc">Plus recentes</option>
            <option value="asc">Plus anciennes</option>
          </select>
        </div>

        <div className="filter-pills" aria-label="Periodes ventes">
          <button className={`filter-pill ${filters.preset === 'TODAY' ? 'active' : ''}`} type="button" onClick={() => setPreset('TODAY')}>Aujourd&apos;hui</button>
          <button className={`filter-pill ${filters.preset === 'YESTERDAY' ? 'active' : ''}`} type="button" onClick={() => setPreset('YESTERDAY')}>Hier</button>
          <button className={`filter-pill ${filters.preset === 'WEEK' ? 'active' : ''}`} type="button" onClick={() => setPreset('WEEK')}>Cette semaine</button>
          <button className={`filter-pill ${filters.preset === 'MONTH' ? 'active' : ''}`} type="button" onClick={() => setPreset('MONTH')}>Ce mois</button>
          <button className={`filter-pill ${filters.preset === 'PREVIOUS_MONTH' ? 'active' : ''}`} type="button" onClick={() => setPreset('PREVIOUS_MONTH')}>Mois precedent</button>
          <button className={`filter-pill ${filters.preset === 'CUSTOM' ? 'active' : ''}`} type="button" onClick={() => setPreset('CUSTOM')}>Personnalise</button>
        </div>

        <div className="sales-date-row">
          <label className="field-inline">
            <span>Du</span>
            <input className="input" type="date" value={filters.dateFrom} onChange={(event) => handleDateChange('dateFrom', event.target.value)} />
          </label>
          <label className="field-inline">
            <span>Au</span>
            <input className="input" type="date" value={filters.dateTo} onChange={(event) => handleDateChange('dateTo', event.target.value)} />
          </label>
          <button className="ghost-button compact-button" type="button" onClick={resetFilters}>Reinitialiser</button>
          <div className="export-actions sales-export-actions">
            <details className="export-menu">
              <summary className="ghost-button compact-button">Exporter</summary>
              <div className="export-menu-panel">
                <button type="button" disabled={rows.length === 0} onClick={() => exportRows('xlsx')}>Excel</button>
                <button type="button" disabled={rows.length === 0} onClick={() => exportRows('csv')}>CSV</button>
                <button type="button" disabled={rows.length === 0} onClick={() => exportRows('json')}>JSON</button>
              </div>
            </details>
          </div>
        </div>

        {dateError && <p className="form-error">{dateError}</p>}
      </div>

      <div className="sales-quick-reports">
        <SalesDayReportCard
          snapshot={yesterdayReport.data}
          loading={yesterdayReport.isLoading}
          error={yesterdayReport.isError ? apiErrorMessage(yesterdayReport.error) : ''}
          onRetry={() => yesterdayReport.refetch()}
        />
        <SalesDayReportCard
          snapshot={dayEndReport.data}
          loading={dayEndReport.isLoading}
          error={dayEndReport.isError ? apiErrorMessage(dayEndReport.error) : ''}
          onRetry={() => dayEndReport.refetch()}
        />
      </div>

      <div className="card">
        {sales.isLoading ? (
          <p className="loading-state">Chargement des ventes...</p>
        ) : sales.isError ? (
          <div className="error-state">
            <p>{apiErrorMessage(sales.error)}</p>
            <button className="ghost-button compact-button" type="button" onClick={() => sales.refetch()}>Reessayer</button>
          </div>
        ) : rows.length === 0 ? (
          <p className="empty-state">Aucune vente trouvee pour ces filtres.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table sales-table">
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
                  <tr className="clickable-row sales-row" key={sale.saleId} onClick={() => setSelectedSaleId(sale.saleId)}>
                    <td className="sales-cell">{formatDate(sale.saleDate)}<small>{formatTime(sale.saleDate)}</small></td>
                    <td className="sales-cell"><button className="link-button" type="button" onClick={(event) => { event.stopPropagation(); navigate(`/sales/${sale.saleId}`); }}>{sale.saleNumber}</button></td>
                    <td className="sales-cell">{sale.customerName || sale.organizationName || 'Comptoir'}</td>
                    <td className="sales-cell">{sale.siteName ?? '-'}</td>
                    <td className="sales-cell">{sale.createdByName ?? '-'}</td>
                    <td className="sales-cell"><span className={`badge ${badgeForType(sale.saleType)}`}>{sale.saleType}</span></td>
                    <td className="sales-cell"><span className={`badge ${badgeForMode(sale.saleMode, sale.fulfillmentStatus)}`}>{sale.saleMode === 'ADVANCE' ? 'AVANCE' : 'IMMEDIATE'}</span></td>
                    <td className="sales-cell"><span className={`badge ${badgeForFulfillment(sale.fulfillmentStatus)}`}>{badgeLabelForFulfillment(sale.fulfillmentStatus)}</span></td>
                    <td className="sales-cell numeric-text">{formatMoney(sale.totalAmount, sale.currencyCode ?? 'USD', sale.currencySymbol)}</td>
                    <td className="sales-cell numeric-text">{formatMoney(sale.netReceivedUsd ?? 0, 'USD')}</td>
                    <td className="sales-cell numeric-text">{formatMoney(sale.netReceivedCdf ?? 0, 'CDF', 'FC')}</td>
                    <td className="sales-cell"><span className={`badge ${badgeForStatus(sale.status)}`}>{sale.status}</span></td>
                    <td className="sales-cell">
                      <button className="ghost-button compact-button" type="button" onClick={(event) => { event.stopPropagation(); setSelectedSaleId(sale.saleId); }}>
                        Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sales.data && sales.data.totalPages > 1 && (
        <div className="table-pagination">
          <button className="ghost-button compact-button" type="button" disabled={page <= 1 || sales.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}>Precedent</button>
          <span>Page {sales.data.page} / {sales.data.totalPages}</span>
          <button className="ghost-button compact-button" type="button" disabled={page >= sales.data.totalPages || sales.isFetching} onClick={() => setPage((current) => current + 1)}>Suivant</button>
        </div>
      )}

      <Modal title="Detail vente" open={Boolean(selectedSaleId)} onClose={() => setSelectedSaleId(null)}>
        {detail.isLoading || !detail.data ? (
          <p className="loading-state">Chargement du detail vente...</p>
        ) : (
          <SaleDetailModal sale={detail.data} onOpenPos={() => navigate(`/pos?saleId=${detail.data.saleId}`)} />
        )}
      </Modal>
    </>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return <div className="card kpi-card"><span className="kpi-label">{label}</span><p className="metric small-metric">{value}</p></div>;
}

function SaleDetailModal({ sale, onOpenPos }: { sale: Sale; onOpenPos: () => void }) {
  const currencyCode = sale.currencyCode ?? 'USD';
  const currencySymbol = sale.currencySymbol;
  const items = sale.items ?? [];
  const payments = sale.payments ?? [];
  const subtotal = sale.subtotal ?? items.reduce((sum, item) => sum + Number(item.lineTotal ?? 0), 0);
  const discount = sale.discountAmount ?? 0;
  const receivableStatus = sale.creditAmount > 0 ? (sale.status === 'VALIDATED' ? 'CREEE' : 'A valider') : 'Aucune';

  function printInvoice() {
    window.print();
  }

  return (
    <div className="sale-detail">
      <div className="detail-grid">
        <div><span>Numero vente</span><strong>{sale.saleNumber}</strong></div>
        <div><span>Date</span><strong>{formatDate(sale.saleDate)}</strong></div>
        <div><span>Client</span><strong>{sale.customerName || 'Comptoir'}</strong></div>
        <div><span>Assurance</span><strong>{sale.organizationName ?? '-'}</strong></div>
        <div><span>Statut</span><strong><span className={`badge ${badgeForStatus(sale.status)}`}>{sale.status}</span></strong></div>
        <div><span>Type</span><strong><span className={`badge ${badgeForType(sale.saleType)}`}>{sale.saleType}</span></strong></div>
        <div><span>Mode</span><strong><span className={`badge ${badgeForMode(sale.saleMode, sale.fulfillmentStatus)}`}>{sale.saleMode === 'ADVANCE' ? 'AVANCE' : 'IMMEDIATE'}</span></strong></div>
        <div><span>Livraison</span><strong><span className={`badge ${badgeForFulfillment(sale.fulfillmentStatus)}`}>{badgeLabelForFulfillment(sale.fulfillmentStatus)}</span></strong></div>
        <div><span>Devise</span><strong>{currencyCode}</strong></div>
        <div><span>Taux</span><strong>{sale.exchangeRate ?? 1}</strong></div>
        <div><span>Site</span><strong>{sale.siteName ?? '-'}</strong></div>
      </div>

      <SalePickupSection sale={sale} />

      {sale.saleType === 'INSURANCE' && (
        <div className="stats-grid insurance-cards">
          <div className="card kpi-card"><span className="kpi-label">Plan assurance</span><p className="metric small-metric">{sale.planName ?? '-'}</p></div>
          <div className="card kpi-card"><span className="kpi-label">Couverture</span><p className="metric small-metric">{sale.coveragePercent ?? 0}%</p></div>
          <div className="card kpi-card"><span className="kpi-label">Montant couvert</span><p className="metric small-metric">{formatMoney(sale.insuranceCoveredAmount, currencyCode, currencySymbol)}</p></div>
          <div className="card kpi-card"><span className="kpi-label">Montant patient</span><p className="metric small-metric">{formatMoney(sale.customerPayableAmount, currencyCode, currencySymbol)}</p></div>
        </div>
      )}

      <section className="detail-section">
        <h3>Produits</h3>
        {items.length === 0 ? (
          <p className="empty-state">Aucun produit. Ouvrez le POS pour ajouter les lignes FEFO.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Article</th><th>Quantite</th><th>Prix unitaire</th><th>Total</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.saleItemId}>
                    <td>{item.commercialName ?? '-'}</td>
                    <td>{item.quantity}</td>
                    <td>{formatMoney(item.unitPrice, currencyCode, currencySymbol)}</td>
                    <td>{formatMoney(item.lineTotal, currencyCode, currencySymbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="detail-section">
        <h3>Historique des paiements</h3>
        {payments.length === 0 ? (
          <p className="empty-state">Aucun paiement enregistre pour cette vente.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Montant</th><th>Devise</th><th>Mode paiement</th><th>Utilisateur</th></tr></thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.paymentId}>
                    <td>{formatDate(payment.paymentDate)}</td>
                    <td>{formatMoney(payment.amount, payment.currencyCode ?? currencyCode, payment.currencySymbol ?? currencySymbol)}</td>
                    <td>{payment.currencyCode ?? currencyCode}</td>
                    <td>{payment.methodName}</td>
                    <td>{payment.receivedByName ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="detail-grid">
        <div><span>Sous-total</span><strong>{formatMoney(subtotal, currencyCode, currencySymbol)}</strong></div>
        <div><span>Remise</span><strong>{formatMoney(discount, currencyCode, currencySymbol)}</strong></div>
        <div><span>Quote-part assurance</span><strong>{formatMoney(sale.insuranceCoveredAmount, currencyCode, currencySymbol)}</strong></div>
        <div><span>Quote-part patient</span><strong>{formatMoney(sale.customerPayableAmount, currencyCode, currencySymbol)}</strong></div>
        <div><span>Creance</span><strong>{formatMoney(sale.creditAmount, currencyCode, currencySymbol)} - {receivableStatus}</strong></div>
        <div><span>Total</span><strong>{formatMoney(sale.totalAmount, currencyCode, currencySymbol)}</strong></div>
      </div>

      <div className="modal-actions">
        {sale.status === 'DRAFT' && <button className="ghost-button" type="button" onClick={onOpenPos}>Continuer dans POS</button>}
        <button className="button" type="button" onClick={printInvoice}>Imprimer Facture</button>
      </div>
    </div>
  );
}

function defaultFilters(): FiltersState {
  const range = dateRangeFromPreset('TODAY');
  return {
    saleNumber: '',
    customer: '',
    seller: '',
    siteId: '',
    status: '',
    saleType: '',
    saleMode: '',
    paymentMode: '',
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    preset: 'TODAY',
    sortBy: 'saleDate',
    sortOrder: 'desc',
  };
}

function dateRangeFromPreset(preset: DatePreset) {
  const today = new Date();
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);

  if (preset === 'TODAY') return { dateFrom: iso(start), dateTo: iso(end) };
  if (preset === 'YESTERDAY') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
    return { dateFrom: iso(start), dateTo: iso(end) };
  }
  if (preset === 'WEEK') {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    return { dateFrom: iso(start), dateTo: iso(end) };
  }
  if (preset === 'MONTH') {
    start.setDate(1);
    return { dateFrom: iso(start), dateTo: iso(end) };
  }
  if (preset === 'PREVIOUS_MONTH') {
    start.setMonth(start.getMonth() - 1, 1);
    end.setDate(0);
    return { dateFrom: iso(start), dateTo: iso(end) };
  }
  return { dateFrom: '', dateTo: '' };
}

function badgeForStatus(status: string) {
  if (status === 'VALIDATED') return 'badge-success';
  if (status === 'CANCELLED') return 'badge-muted';
  return 'badge-warning';
}

function badgeForType(type: string) {
  return type === 'INSURANCE' ? 'badge-info' : 'badge-success';
}

function badgeForMode(mode?: string | null, fulfillmentStatus?: string | null) {
  if (mode === 'ADVANCE') {
    if (fulfillmentStatus === 'FULFILLED') return 'badge-success';
    if (fulfillmentStatus === 'PARTIALLY_FULFILLED') return 'badge-warning';
    return 'badge-info';
  }
  return 'badge-success';
}

function badgeForFulfillment(status?: string | null) {
  if (status === 'FULFILLED') return 'badge-success';
  if (status === 'PARTIALLY_FULFILLED') return 'badge-warning';
  if (status === 'NOT_FULFILLED') return 'badge-muted';
  return 'badge-info';
}

function badgeLabelForFulfillment(status?: string | null) {
  if (status === 'FULFILLED') return 'Livree';
  if (status === 'PARTIALLY_FULFILLED') return 'Partielle';
  if (status === 'NOT_FULFILLED') return 'En attente';
  return status ?? '-';
}

function formatTime(date: string | Date) {
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '--:--';
  return value.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

async function fetchAllSalesForExport(filters: Record<string, string | number | undefined>) {
  const first = await salesService.getList({ ...filters, page: 1, limit: 100 });
  const data = first.data;
  let items = [...data.items];
  for (let nextPage = 2; nextPage <= data.totalPages; nextPage += 1) {
    const response = await salesService.getList({ ...filters, page: nextPage, limit: 100 });
    items = items.concat(response.data.items);
  }
  return items;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function saleExportRows(sales: Sale[]) {
  return [
    ['Numero', 'Date', 'Client', 'Site', 'Caissier', 'Type', 'Mode', 'Livraison', 'Total', 'Net USD', 'Net FC', 'Paiements', 'Statut'],
    ...sales.map((sale) => [
      sale.saleNumber,
      `${formatDate(sale.saleDate)} ${formatTime(sale.saleDate)}`,
      sale.customerName || sale.organizationName || 'Comptoir',
      sale.siteName ?? '-',
      sale.createdByName ?? '-',
      sale.saleType,
      sale.saleMode ?? '-',
      sale.fulfillmentStatus ?? '-',
      formatMoney(sale.totalAmount, sale.currencyCode ?? 'USD', sale.currencySymbol),
      formatMoney(sale.netReceivedUsd ?? 0, 'USD'),
      formatMoney(sale.netReceivedCdf ?? 0, 'CDF', 'FC'),
      sale.paymentModes ?? '-',
      sale.status,
    ]),
  ];
}

function saleExportObject(sale: Sale) {
  return {
    numero: sale.saleNumber,
    date: formatDate(sale.saleDate),
    heure: formatTime(sale.saleDate),
    client: sale.customerName || sale.organizationName || 'Comptoir',
    site: sale.siteName ?? '-',
    caissier: sale.createdByName ?? '-',
    type: sale.saleType,
    mode: sale.saleMode ?? '-',
    livraison: sale.fulfillmentStatus ?? '-',
    total: formatMoney(sale.totalAmount, sale.currencyCode ?? 'USD', sale.currencySymbol),
    netUsd: formatMoney(sale.netReceivedUsd ?? 0, 'USD'),
    netFc: formatMoney(sale.netReceivedCdf ?? 0, 'CDF', 'FC'),
    paiements: sale.paymentModes ?? '-',
    statut: sale.status,
  };
}

function SalesDayReportCard({
  snapshot,
  loading,
  error,
  onRetry,
}: {
  snapshot?: DayReportSnapshot;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="card sales-report-card">
        <p className="loading-state">Chargement du rapport...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card sales-report-card">
        <div className="error-state">
          <p>{error}</p>
          <button className="ghost-button compact-button" type="button" onClick={onRetry}>Reessayer</button>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="card sales-report-card">
        <p className="empty-state">Aucune donnee de rapport disponible.</p>
      </div>
    );
  }

  const summaryCards = [
    { label: 'CA net', value: formatMoney(snapshot.summary.revenueNet ?? 0, 'USD') },
    { label: 'Ventes', value: String(snapshot.summary.saleCount ?? 0) },
    { label: 'Panier moyen', value: formatMoney(snapshot.summary.averageBasket ?? 0, 'USD') },
    { label: 'Articles vendus', value: String(snapshot.summary.itemsSold ?? 0) },
  ];
  const cashCards = snapshot.cashBreakdown.length > 0 ? [
    { label: 'Encaisse USD', value: formatMoney(snapshot.summary.receivedUsd ?? 0, 'USD') },
    { label: 'Encaisse FC', value: formatMoney(snapshot.summary.receivedCdf ?? 0, 'CDF', 'FC') },
    { label: 'Rendu USD', value: formatMoney(snapshot.summary.changeUsd ?? 0, 'USD') },
    { label: 'Rendu FC', value: formatMoney(snapshot.summary.changeCdf ?? 0, 'CDF', 'FC') },
  ] : [];

  return (
    <section className="card sales-report-card">
      <div className="sales-report-head">
        <div>
          <span className="breadcrumb">Rapport rapide</span>
          <h2>{snapshot.label}</h2>
          <p>{snapshot.subtitle}</p>
        </div>
        <div className="sales-report-head-meta">
          <span>{snapshot.siteLabel}</span>
          <span>{snapshot.period.from ? `Du ${formatDate(snapshot.period.from)}` : 'Toutes dates'}</span>
          <span>{snapshot.period.to ? `Au ${formatDate(snapshot.period.to)}` : ''}</span>
          <span>{snapshot.sessionStats.totalCount > 0 ? `${snapshot.sessionStats.openCount} session(s) ouverte(s)` : 'Aucune session caisse incluse'}</span>
        </div>
      </div>

      <div className="sales-report-kpis">
        {summaryCards.map((card) => (
          <div className="sales-report-metric" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      {cashCards.length > 0 && (
        <div className="sales-report-cash">
          {cashCards.map((card) => (
            <div className="sales-report-metric" key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="sales-report-chips">
        {snapshot.saleBreakdown.map((item) => (
          <span className={`badge ${item.saleType === 'INSURANCE' ? 'badge-info' : 'badge-success'}`} key={item.saleType}>
            {item.saleType}: {item.count}
          </span>
        ))}
        {snapshot.summary.settlementDifferenceUsd !== undefined && (
          <span className={`badge ${Math.abs(snapshot.summary.settlementDifferenceUsd) > 0 ? 'badge-warning' : 'badge-success'}`}>
            Ecart reglement: {formatMoney(snapshot.summary.settlementDifferenceUsd ?? 0, 'USD')}
          </span>
        )}
      </div>

      {snapshot.cashBreakdown.length > 0 && (
        <div className="sales-report-cash-flow">
          {snapshot.cashBreakdown.slice(0, 6).map((item) => (
            <span className="badge badge-muted" key={item.movementType}>
              {item.movementType}: {item.count} ({formatMoney(item.amount, 'USD')})
            </span>
          ))}
        </div>
      )}

      <div className="sales-report-grid">
        <div>
          <h3>Top produits</h3>
          {snapshot.topProducts.length === 0 ? (
            <p className="empty-state">Aucun produit a afficher.</p>
          ) : (
            <div className="table-wrap sales-report-table-wrap">
              <table className="data-table sales-report-table">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th className="align-right">Qté</th>
                    <th className="align-right">CA</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.topProducts.slice(0, 5).map((item) => (
                    <tr key={`${item.articleCode ?? ''}-${item.commercialName ?? ''}`}>
                      <td>{item.articleCode ? `${item.articleCode} - ` : ''}{item.commercialName ?? '-'}</td>
                      <td className="align-right">{Number(item.quantity ?? 0)}</td>
                      <td className="align-right">{formatMoney(Number(item.revenue ?? 0), 'USD')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h3>Ventes recentes</h3>
          {snapshot.sales.length === 0 ? (
            <p className="empty-state">Aucune vente validee sur cette periode.</p>
          ) : (
            <div className="table-wrap sales-report-table-wrap">
              <table className="data-table sales-report-table">
                <thead>
                  <tr>
                    <th>N vente</th>
                    <th>Client</th>
                    <th>Type</th>
                    <th>Mode</th>
                    <th className="align-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.sales.slice(0, 5).map((sale) => (
                    <tr key={sale.saleId}>
                      <td>{sale.saleNumber}</td>
                      <td>{sale.customerName || sale.organizationName || 'Comptoir'}</td>
                      <td><span className={`badge ${badgeForType(sale.saleType)}`}>{sale.saleType}</span></td>
                      <td><span className={`badge ${badgeForMode(sale.saleMode, sale.fulfillmentStatus)}`}>{sale.saleMode === 'ADVANCE' ? 'AVANCE' : 'IMMEDIATE'}</span></td>
                      <td className="align-right">{formatMoney(sale.totalAmount, sale.currencyCode ?? 'USD', sale.currencySymbol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="sales-report-actions">
        <button className="secondary-button compact-button" type="button" onClick={() => printSalesSnapshot(snapshot)}>
          Imprimer
        </button>
        <button className="secondary-button compact-button" type="button" onClick={() => exportSalesSnapshot(snapshot, 'xlsx')}>
          Excel
        </button>
        <button className="secondary-button compact-button" type="button" onClick={() => exportSalesSnapshot(snapshot, 'csv')}>
          CSV
        </button>
        <button className="secondary-button compact-button" type="button" onClick={() => exportSalesSnapshot(snapshot, 'json')}>
          JSON
        </button>
      </div>
    </section>
  );
}

async function loadSalesDaySnapshot(options: {
  title: string;
  subtitle: string;
  from: string;
  to: string;
  siteId?: string;
  siteLabel: string;
  includeCash: boolean;
  exportName: string;
}): Promise<DayReportSnapshot> {
  const baseFilters = { from: options.from, to: options.to, siteId: options.siteId };
  const listFilters = {
    dateFrom: options.from,
    dateTo: options.to,
    siteId: options.siteId,
    status: 'VALIDATED',
    sortBy: 'saleDate' as const,
    sortOrder: 'desc' as const,
  };
  const [summaryResp, listResp, topResp, breakdownResp, cashResp, sessionsResp] = await Promise.all([
    salesService.getSummary(listFilters),
    salesService.getList({ ...listFilters, page: 1, limit: 5 }),
    reportsService.topProducts(baseFilters),
    reportsService.sales(baseFilters),
    options.includeCash ? reportsService.cash(baseFilters) : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    options.includeCash ? cashService.getSessions() : Promise.resolve({ data: [] as Array<{ openedAt?: string; closedAt?: string | null; siteId?: string; status?: string }> }),
  ]);

  const sessions = (sessionsResp.data ?? []).filter((session) => {
    if (!session.openedAt) return false;
    const opened = new Date(session.openedAt);
    const start = new Date(`${options.from}T00:00:00`);
    const end = new Date(`${options.to}T23:59:59.999`);
    if (Number.isNaN(opened.getTime())) return false;
    if (opened < start || opened > end) return false;
    if (options.siteId && session.siteId && session.siteId !== options.siteId) return false;
    return true;
  });

  return {
    label: options.title,
    subtitle: options.subtitle,
    siteLabel: options.siteLabel,
    period: { from: options.from, to: options.to },
    summary: {
      revenueNet: summaryResp.data?.revenueNet ?? 0,
      saleCount: summaryResp.data?.saleCount ?? 0,
      averageBasket: summaryResp.data?.averageBasket ?? 0,
      itemsSold: summaryResp.data?.itemsSold ?? 0,
      receivedUsd: summaryResp.data?.receivedUsd ?? 0,
      receivedCdf: summaryResp.data?.receivedCdf ?? 0,
      changeUsd: summaryResp.data?.changeUsd ?? 0,
      changeCdf: summaryResp.data?.changeCdf ?? 0,
      settlementDifferenceUsd: summaryResp.data?.settlementDifferenceUsd ?? 0,
      immediateSaleCount: summaryResp.data?.immediateSaleCount ?? 0,
      advanceSaleCount: summaryResp.data?.advanceSaleCount ?? 0,
      immediateRevenue: summaryResp.data?.immediateRevenue ?? 0,
      advanceFulfilledRevenue: summaryResp.data?.advanceFulfilledRevenue ?? 0,
      advancePendingRevenue: summaryResp.data?.advancePendingRevenue ?? 0,
    },
    sales: listResp.data?.items ?? [],
    topProducts: topResp.data?.map((row) => ({
      articleCode: String(row.articleCode ?? row.article_code ?? ''),
      commercialName: String(row.commercialName ?? row.commercial_name ?? ''),
      quantity: Number(row.quantity ?? 0),
      revenue: Number(row.revenue ?? 0),
    })) ?? [],
    saleBreakdown: breakdownResp.data?.map((row) => ({
      saleType: String(row.saleType ?? row.sale_type ?? ''),
      count: Number(row.count ?? 0),
      totalAmount: Number(row.totalAmount ?? row.total_amount ?? 0),
      patientAmount: Number(row.patientAmount ?? row.patient_amount ?? 0),
      insuranceAmount: Number(row.insuranceAmount ?? row.insurance_amount ?? 0),
    })) ?? [],
    cashBreakdown: options.includeCash ? ((cashResp.data ?? []).map((row) => ({
      movementType: String(row.movementType ?? row.movement_type ?? ''),
      count: Number(row.count ?? 0),
      amount: Number(row.amount ?? 0),
    }))) : [],
    sessionStats: {
      openCount: sessions.filter((session) => session.status === 'OPEN').length,
      closedCount: sessions.filter((session) => session.status === 'CLOSED').length,
      totalCount: sessions.length,
    },
    exportFilters: {
      dateFrom: options.from,
      dateTo: options.to,
      siteId: options.siteId,
      status: 'VALIDATED',
    },
    exportName: options.exportName,
  };
}

async function exportSalesSnapshot(snapshot: DayReportSnapshot, format: 'xlsx' | 'csv' | 'json') {
  const items = await fetchAllSalesForExport(snapshot.exportFilters);
  const stamp = fileDateStamp(new Date(snapshot.period.to || new Date()));
  const summaryRows = buildSnapshotSummaryRows(snapshot);
  const salesRows = saleExportRows(items);
  const topRows = [
    ['Article', 'Qté', 'CA'],
    ...snapshot.topProducts.map((item) => [
      `${item.articleCode ? `${item.articleCode} - ` : ''}${item.commercialName ?? '-'}`,
      Number(item.quantity ?? 0),
      formatMoney(Number(item.revenue ?? 0), 'USD'),
    ]),
  ];
  const cashRows = snapshot.cashBreakdown.length === 0 ? [] : [
    ['Type mouvement', 'Nombre', 'Montant'],
    ...snapshot.cashBreakdown.map((item) => [item.movementType, item.count, formatMoney(item.amount, 'USD')]),
  ];

  if (format === 'xlsx') {
    const sheets = [
      { name: 'Resume', rows: summaryRows },
      { name: 'Ventes', rows: salesRows },
      { name: 'Top produits', rows: topRows },
    ];
    if (cashRows.length > 0) sheets.push({ name: 'Caisse', rows: cashRows });
    downloadXlsx(`${snapshot.exportName}_${stamp}.xlsx`, sheets);
    return;
  }

  if (format === 'csv') {
    downloadCsv(`${snapshot.exportName}_${stamp}.csv`, salesRows);
    return;
  }

  downloadJson(`${snapshot.exportName}_${stamp}.json`, {
    title: snapshot.label,
    subtitle: snapshot.subtitle,
    summary: summaryRows.slice(1).map(([label, value]) => ({ label, value })),
    sales: items.map(saleExportObject),
    topProducts: snapshot.topProducts,
    cashBreakdown: snapshot.cashBreakdown,
  });
}

function buildSnapshotSummaryRows(snapshot: DayReportSnapshot) {
  return [
    ['Metrique', 'Valeur'],
    ['CA net', formatMoney(snapshot.summary.revenueNet ?? 0, 'USD')],
    ['Ventes valides', snapshot.summary.saleCount ?? 0],
    ['Panier moyen', formatMoney(snapshot.summary.averageBasket ?? 0, 'USD')],
    ['Articles vendus', snapshot.summary.itemsSold ?? 0],
    ['Encaisse USD', formatMoney(snapshot.summary.receivedUsd ?? 0, 'USD')],
    ['Encaisse FC', formatMoney(snapshot.summary.receivedCdf ?? 0, 'CDF', 'FC')],
    ['Rendu USD', formatMoney(snapshot.summary.changeUsd ?? 0, 'USD')],
    ['Rendu FC', formatMoney(snapshot.summary.changeCdf ?? 0, 'CDF', 'FC')],
    ['Ecart reglement USD', formatMoney(snapshot.summary.settlementDifferenceUsd ?? 0, 'USD')],
    ['Sessions ouvertes', snapshot.sessionStats.openCount],
    ['Sessions fermees', snapshot.sessionStats.closedCount],
  ];
}

function printSalesSnapshot(snapshot: DayReportSnapshot) {
  const title = `${snapshot.label} - ${snapshot.subtitle}`;
  const summaryRows = buildSnapshotSummaryRows(snapshot).slice(1);
  const salesRows = snapshot.sales.slice(0, 5);
  const topProducts = snapshot.topProducts.slice(0, 5);
  const cashRows = snapshot.cashBreakdown.slice(0, 8);
  const html = `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
          h1, h2 { margin: 0 0 8px; }
          h2 { margin-top: 20px; font-size: 16px; }
          .meta { display: flex; gap: 16px; flex-wrap: wrap; color: #4b5563; margin-bottom: 16px; }
          table { border-collapse: collapse; width: 100%; margin-top: 8px; }
          th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; font-size: 12px; }
          th { background: #f3f4f6; }
          .summary { display: grid; gap: 6px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .summary div { border: 1px solid #d1d5db; padding: 8px; border-radius: 8px; }
          .summary span { display: block; font-size: 11px; color: #6b7280; text-transform: uppercase; }
          .summary strong { font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(snapshot.label)}</h1>
        <div class="meta">
          <span>${escapeHtml(snapshot.subtitle)}</span>
          <span>Du ${escapeHtml(formatDate(snapshot.period.from))} au ${escapeHtml(formatDate(snapshot.period.to))}</span>
        </div>
        <div class="summary">
          ${summaryRows.map(([label, value]) => `<div><span>${escapeHtml(String(label))}</span><strong>${escapeHtml(String(value))}</strong></div>`).join('')}
        </div>
        <h2>Top produits</h2>
        <table>
          <thead><tr><th>Article</th><th>Qté</th><th>CA</th></tr></thead>
          <tbody>
            ${topProducts.map((item) => `<tr><td>${escapeHtml(`${item.articleCode ? `${item.articleCode} - ` : ''}${item.commercialName ?? '-'}`)}</td><td>${Number(item.quantity ?? 0)}</td><td>${escapeHtml(formatMoney(Number(item.revenue ?? 0), 'USD'))}</td></tr>`).join('')}
          </tbody>
        </table>
        <h2>Ventes recentes</h2>
        <table>
          <thead><tr><th>N vente</th><th>Client</th><th>Type</th><th>Mode</th><th>Total</th></tr></thead>
          <tbody>
            ${salesRows.map((sale) => `<tr><td>${escapeHtml(sale.saleNumber)}</td><td>${escapeHtml(sale.customerName || sale.organizationName || 'Comptoir')}</td><td>${escapeHtml(sale.saleType)}</td><td>${escapeHtml(String(sale.saleMode ?? '-'))}</td><td>${escapeHtml(formatMoney(sale.totalAmount, sale.currencyCode ?? 'USD', sale.currencySymbol))}</td></tr>`).join('')}
          </tbody>
        </table>
        ${cashRows.length ? `
          <h2>Caisse</h2>
          <table>
            <thead><tr><th>Type</th><th>Nombre</th><th>Montant</th></tr></thead>
            <tbody>${cashRows.map((row) => `<tr><td>${escapeHtml(String(row.movementType ?? ''))}</td><td>${Number(row.count ?? 0)}</td><td>${escapeHtml(formatMoney(Number(row.amount ?? 0), 'USD'))}</td></tr>`).join('')}</tbody>
          </table>
        ` : ''}
        <script>window.addEventListener('load', () => { window.print(); setTimeout(() => window.close(), 250); });</script>
      </body>
    </html>
  `;
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
  if (!popup) {
    window.alert('Impossible douvrir la fenetre dimpression. Autorisez les fenetres contextuelles.');
    return;
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
