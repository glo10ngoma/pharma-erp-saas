import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiErrorMessage } from '../../services/apiError';
import { reportsService, ReportFilters } from '../../services/reports.service';
import { sitesService } from '../../services/sites.service';
import { formatMoney } from '../../utils/money';

const moneyKeys = new Set(['totalAmount', 'patientAmount', 'insuranceAmount', 'purchaseValue', 'saleValue', 'revenue', 'estimatedCost', 'grossMargin', 'amountDue', 'amountPaid', 'balance', 'amount']);

export function ReportsDashboardPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [filters, setFilters] = useState<ReportFilters>({ from: today.slice(0, 8) + '01', to: today });
  const queryKey = ['reports', filters];
  const dashboard = useQuery({ queryKey: [...queryKey, 'dashboard'], queryFn: async () => (await reportsService.dashboard(filters)).data });
  const sales = useQuery({ queryKey: [...queryKey, 'sales'], queryFn: async () => (await reportsService.sales(filters)).data });
  const stock = useQuery({ queryKey: [...queryKey, 'stock'], queryFn: async () => (await reportsService.stock(filters)).data });
  const margins = useQuery({ queryKey: [...queryKey, 'margins'], queryFn: async () => (await reportsService.margins(filters)).data });
  const cash = useQuery({ queryKey: [...queryKey, 'cash'], queryFn: async () => (await reportsService.cash(filters)).data });
  const receivables = useQuery({ queryKey: [...queryKey, 'receivables'], queryFn: async () => (await reportsService.receivables(filters)).data });
  const expiry = useQuery({ queryKey: [...queryKey, 'expiry'], queryFn: async () => (await reportsService.expiry(filters)).data });
  const topProducts = useQuery({ queryKey: [...queryKey, 'top-products'], queryFn: async () => (await reportsService.topProducts(filters)).data });
  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const error = [dashboard, sales, stock, margins, cash, receivables, expiry, topProducts].find((q) => q.isError)?.error;
  const kpis = dashboard.data;
  const cards = useMemo(() => kpis ? [
    ['CA jour', kpis.revenueToday],
    ['CA mois', kpis.revenueMonth],
    ['Ventes CASH', kpis.totalCashSales],
    ['Ventes assurance', kpis.totalInsuranceSales],
    ['Paiements caisse', kpis.totalCashPayments],
    ['Creances ouvertes', kpis.openReceivables],
    ['Stock achat', kpis.stockValuePurchase],
    ['Stock vente', kpis.stockValueSale],
    ['Marge estimee', kpis.estimatedGrossMargin],
    ['Lots expires', kpis.expiredLotsCount],
    ['Expiration 30j', kpis.expiring30DaysCount],
    ['Expiration 90j', kpis.expiring90DaysCount],
    ['Stock faible', kpis.lowStockProductsCount],
  ] : [], [kpis]);

  return <>
    <h1>Dashboard BI</h1>
    <p className="muted-text">Devise de reporting : {kpis?.baseCurrency ?? 'USD'}</p>
    {error && <p className="form-error">{apiErrorMessage(error)}</p>}
    <div className="card form-grid">
      <input className="input" type="date" value={filters.from ?? ''} onChange={(e)=>setFilters({ ...filters, from: e.target.value })} />
      <input className="input" type="date" value={filters.to ?? ''} onChange={(e)=>setFilters({ ...filters, to: e.target.value })} />
      <select className="input" value={filters.siteId ?? ''} onChange={(e)=>setFilters({ ...filters, siteId: e.target.value || undefined })}>
        <option value="">Tous les sites</option>
        {(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}
      </select>
    </div>
    <div className="grid two">
      {dashboard.isLoading ? <div className="card"><p className="loading-state">Chargement des KPIs...</p></div> : cards.map(([label, value]) => <div className="card kpi-card" key={label}><span className="kpi-label">{label}</span><p className="metric">{format(value, kpis?.currencyCode, kpis?.currencySymbol)}</p></div>)}
    </div>
    <ReportTable title="Rapport ventes" rows={sales.data ?? []} />
    <ReportTable title="Rapport stock" rows={(stock.data ?? []).slice(0, 20)} />
    <ReportTable title="Rapport marges" rows={(margins.data ?? []).slice(0, 20)} />
    <ReportTable title="Rapport caisse" rows={cash.data ?? []} />
    <ReportTable title="Rapport creances" rows={receivables.data ?? []} />
    <ReportTable title="Rapport peremptions" rows={(expiry.data ?? []).slice(0, 20)} />
    <ReportTable title="Top produits" rows={topProducts.data ?? []} />
  </>;
}

function ReportTable({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  const columns = Object.keys(rows[0] ?? {});
  return <div className="card"><h2>{title}</h2>{rows.length === 0 ? <p className="empty-state">Aucune donnee pour la periode.</p> : <div className="table-wrap"><table className="data-table"><thead><tr>{columns.map((column)=><th key={column}>{label(column)}</th>)}</tr></thead><tbody>{rows.map((row, index)=><tr key={index}>{columns.map((column)=><td key={column}>{formatCell(column, row[column], row)}</td>)}</tr>)}</tbody></table></div>}</div>;
}

function label(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function formatCell(key: string, value: unknown, row: Record<string, unknown>) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return moneyKeys.has(key) ? formatMoney(value, String(row.currencyCode ?? row.baseCurrency ?? 'USD'), String(row.currencySymbol ?? '$')) : value.toString();
  return String(value);
}

function format(value: unknown, currencyCode = 'USD', currencySymbol = '$') {
  return typeof value === 'number' ? formatMoney(value, currencyCode, currencySymbol) : String(value ?? '');
}
