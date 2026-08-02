import { useMemo, useState } from 'react';
import { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../auth/AuthContext';
import { apiErrorMessage } from '../../services/apiError';
import { articlesService } from '../../services/articles.service';
import { lotsService } from '../../services/lots.service';
import { reportsService, ReportFilters } from '../../services/reports.service';
import { settingsService } from '../../services/settings.service';
import { sitesService } from '../../services/sites.service';
import { stocksService } from '../../services/stocks.service';
import { formatDate } from '../../utils/date';
import { fetchAllPages } from '../../utils/fetchAllPages';
import { formatMoney } from '../../utils/money';
import { buildFefoKpis, buildFefoRiskRows, buildRotationKpis, buildRotationRows } from '../fefo/fefo-utils';
import { canReadNotifications, readNotificationState, useGeneratedNotifications } from '../notifications/notifications-data';

const chartColors = ['#0f766e', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981'];
const moneyKeys = new Set(['totalAmount', 'patientAmount', 'insuranceAmount', 'purchaseValue', 'saleValue', 'revenue', 'estimatedCost', 'grossMargin', 'amountDue', 'amountPaid', 'balance', 'amount', 'stockValue']);

type PeriodPreset = 'today' | '7d' | '30d' | 'month' | 'custom';

export function ReportsDashboardPage() {
  const { currentUser, permissions } = useAuth();
  const today = new Date();
  const [period, setPeriod] = useState<PeriodPreset>('30d');
  const [filters, setFilters] = useState<ReportFilters>(() => periodFilters('30d', today));
  const queryKey = ['reports', filters];
  const canSeeReports = permissions.includes('reports.dashboard');
  const canSeeNotifications = canReadNotifications(permissions, currentUser?.role);
  const { notifications } = useGeneratedNotifications(readNotificationState(), canSeeReports && canSeeNotifications);

  const dashboard = useQuery({ queryKey: [...queryKey, 'dashboard'], queryFn: async () => (await reportsService.dashboard(filters)).data, enabled: canSeeReports });
  const sales = useQuery({ queryKey: [...queryKey, 'sales'], queryFn: async () => (await reportsService.sales(filters)).data, enabled: canSeeReports });
  const stock = useQuery({ queryKey: [...queryKey, 'stock'], queryFn: async () => (await reportsService.stock(filters)).data, enabled: canSeeReports });
  const margins = useQuery({ queryKey: [...queryKey, 'margins'], queryFn: async () => (await reportsService.margins(filters)).data, enabled: canSeeReports });
  const cash = useQuery({ queryKey: [...queryKey, 'cash'], queryFn: async () => (await reportsService.cash(filters)).data, enabled: canSeeReports });
  const receivables = useQuery({ queryKey: [...queryKey, 'receivables'], queryFn: async () => (await reportsService.receivables(filters)).data, enabled: canSeeReports });
  const expiry = useQuery({ queryKey: [...queryKey, 'expiry'], queryFn: async () => (await reportsService.expiry(filters)).data, enabled: canSeeReports });
  const topProducts = useQuery({ queryKey: [...queryKey, 'top-products'], queryFn: async () => (await reportsService.topProducts(filters)).data, enabled: canSeeReports });
  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data, enabled: canSeeReports });
  const exchangeRate = useQuery({ queryKey: ['settings', 'exchange-rate'], queryFn: async () => (await settingsService.getExchangeRate()).data, enabled: canSeeReports });
  const lots = useQuery({ queryKey: ['lots', 'reports-fefo'], queryFn: async () => (await lotsService.getAll()).data, enabled: canSeeReports });
  const stocks = useQuery({ queryKey: ['stocks', 'reports-fefo'], queryFn: async () => (await stocksService.getAll()).data, enabled: canSeeReports });
  const articles = useQuery({
    queryKey: ['articles', 'reports-fefo'],
    queryFn: async () =>
      fetchAllPages(
        async ({ page, limit }) => (await articlesService.getAll({ page, limit })).data,
        { getKey: (article) => article.articleId },
      ),
    enabled: canSeeReports,
  });

  const selectedSite = (sites.data ?? []).find((site) => site.siteId === filters.siteId);
  const kpis = dashboard.data;
  const reportErrors = [dashboard, sales, stock, margins, cash, receivables, expiry, topProducts].filter((query) => query.isError);
  const isLoadingCore = dashboard.isLoading || sales.isLoading || stock.isLoading;

  const fefo = useMemo(() => {
    const riskRows = buildFefoRiskRows(lots.data ?? [], stocks.data ?? [], articles.data ?? [])
      .filter((row) => !filters.siteId || row.siteId === filters.siteId);
    const completedActionKeys = new Set<string>();
    const rotation = buildRotationKpis(riskRows, completedActionKeys);
    const totalLots = riskRows.length;
    const healthyLots = rotation.green + rotation.actionsCompleted;
    const health = totalLots === 0 ? 100 : Math.max(0, Math.round((healthyLots / totalLots) * 100));
    return { rows: riskRows, kpis: buildFefoKpis(riskRows), health };
  }, [articles.data, filters.siteId, lots.data, stocks.data]);

  const salesByDay = useMemo(() => buildSalesByDay(sales.data ?? [], filters.from, filters.to), [filters.from, filters.to, sales.data]);
  const salesTypeData = useMemo(() => buildSalesTypeData(sales.data ?? [], kpis), [kpis, sales.data]);
  const topProductData = useMemo(() => buildTopProducts(topProducts.data ?? []), [topProducts.data]);
  const expiryData = useMemo(() => [
    { name: 'Expires', value: kpis?.expiredLotsCount ?? fefo.kpis.expired },
    { name: '<30 jours', value: kpis?.expiring30DaysCount ?? fefo.kpis.expiring30 },
    { name: '<90 jours', value: kpis?.expiring90DaysCount ?? fefo.kpis.expiring90 },
  ], [fefo.kpis.expired, fefo.kpis.expiring30, fefo.kpis.expiring90, kpis]);
  const receivableData = useMemo(() => buildReceivableStatus(receivables.data ?? [], kpis?.openReceivables ?? 0), [kpis?.openReceivables, receivables.data]);
  const stockCategoryData = useMemo(() => buildStockCategoryData(stock.data ?? []), [stock.data]);
  const alerts = useMemo(() => buildAlerts(kpis, fefo.rows, receivables.data ?? [], cash.data ?? []), [cash.data, fefo.rows, kpis, receivables.data]);
  const notificationSummary = useMemo(() => ({
    critical: notifications.filter((notification) => notification.priority === 'CRITICAL').length,
    warnings: notifications.filter((notification) => notification.priority === 'WARNING').length,
  }), [notifications]);

  function applyPeriod(next: PeriodPreset) {
    setPeriod(next);
    if (next !== 'custom') setFilters((current) => ({ ...periodFilters(next, today), siteId: current.siteId }));
  }

  if (!canSeeReports) {
    return <div className="card"><h1>Dashboard BI</h1><p className="form-error">Acces refuse : permission reports.dashboard requise.</p></div>;
  }

  return (
    <>
      <section className="bi-hero">
        <div>
          <span className="kpi-label">Bienvenue</span>
          <h1>Dashboard BI</h1>
          <p className="muted">Bonjour {currentUser?.fullName ?? currentUser?.role ?? 'Admin'} - {formatDate(today)} - Devise reporting : {kpis?.baseCurrency ?? 'USD'}</p>
        </div>
        <div className="bi-hero-meta">
          <div><span>Site</span><strong>{selectedSite?.siteName ?? 'Tous les sites'}</strong></div>
          <div><span>Taux USD/CDF</span><strong>{exchangeRate.data ? `1 USD = ${formatMoney(exchangeRate.data.rate, 'CDF')}` : 'Non charge'}</strong></div>
        </div>
      </section>

      {reportErrors.length > 0 && <p className="form-error">{reportErrors.length} rapport(s) indisponible(s). {apiErrorMessage(reportErrors[0].error)}</p>}

      <section className="card bi-filters">
        <select className="input compact-input" value={filters.siteId ?? ''} onChange={(event) => setFilters({ ...filters, siteId: event.target.value || undefined })}>
          <option value="">Tous les sites</option>
          {(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}
        </select>
        <select className="input compact-input" value={period} onChange={(event) => applyPeriod(event.target.value as PeriodPreset)}>
          <option value="today">Aujourd'hui</option>
          <option value="7d">7 jours</option>
          <option value="30d">30 jours</option>
          <option value="month">Mois en cours</option>
          <option value="custom">Periode libre</option>
        </select>
        <input className="input compact-input" type="date" value={filters.from ?? ''} onChange={(event) => { setPeriod('custom'); setFilters({ ...filters, from: event.target.value }); }} />
        <input className="input compact-input" type="date" value={filters.to ?? ''} onChange={(event) => { setPeriod('custom'); setFilters({ ...filters, to: event.target.value }); }} />
      </section>

      <section className="bi-kpi-grid">
        {isLoadingCore ? <div className="card"><p className="loading-state">Chargement des KPIs...</p></div> : (
          <>
            <Kpi title="CA jour" value={formatMoney(kpis?.revenueToday ?? 0, 'USD')} />
            <Kpi title="CA mois" value={formatMoney(kpis?.revenueMonth ?? 0, 'USD')} />
            <Kpi title="Marge estimee" value={formatMoney(kpis?.estimatedGrossMargin ?? 0, 'USD')} />
            <Kpi title="Valeur stock" value={formatMoney(kpis?.stockValueSale ?? 0, 'USD')} />
            <Kpi title="Creances ouvertes" value={formatMoney(kpis?.openReceivables ?? 0, 'USD')} tone={(kpis?.openReceivables ?? 0) > 0 ? 'warning' : 'success'} />
            <Kpi title="Caisse du jour" value={formatMoney(kpis?.totalCashPayments ?? 0, 'USD')} />
            <Kpi title="Lots proches expiration" value={String(kpis?.expiring30DaysCount ?? fefo.kpis.expiring30)} tone={(kpis?.expiring30DaysCount ?? 0) > 0 ? 'warning' : 'success'} />
            <Kpi title="FEFO Sante" value={`${fefo.health} %`} tone={fefo.health < 80 ? 'danger' : fefo.health < 95 ? 'warning' : 'success'} />
            {canSeeNotifications && (
              <Link className="card kpi-card bi-kpi bi-notification-card" to="/notifications">
                <span className="kpi-label">Notifications</span>
                <p className="metric small-metric">{notificationSummary.critical} critiques</p>
                <small>{notificationSummary.warnings} avertissements</small>
              </Link>
            )}
          </>
        )}
      </section>

      <section className="bi-chart-grid">
        <ChartCard title="CA par jour">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={salesByDay}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={(value) => formatMoney(Number(value), 'USD')} /><Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={3} dot={false} /></LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Top produits vendus">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topProductData} layout="vertical" margin={{ left: 18, right: 10 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={120} /><Tooltip /><Bar dataKey="value" fill="#2563eb" /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Repartition ventes">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart><Pie data={salesTypeData} dataKey="value" nameKey="name" outerRadius={90} label>{salesTypeData.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip formatter={(value) => formatMoney(Number(value), 'USD')} /><Legend /></PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Stock a risque par expiration">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={expiryData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#f59e0b" /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Creances assurance par statut">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={receivableData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(value) => formatMoney(Number(value), 'USD')} /><Bar dataKey="value" fill="#8b5cf6" /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Valeur stock par categorie">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stockCategoryData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(value) => formatMoney(Number(value), 'USD')} /><Bar dataKey="value" fill="#10b981" /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="bi-alert-grid">
        {alerts.map((alert) => <div className={`card bi-alert bi-alert-${alert.tone}`} key={alert.title}><span>{alert.title}</span><strong>{alert.value}</strong><p>{alert.message}</p></div>)}
      </section>

      <ReportTable title="Top produits" rows={topProducts.data ?? []} />
    </>
  );
}

function Kpi({ title, value, tone }: { title: string; value: string; tone?: 'success' | 'warning' | 'danger' }) {
  return <div className={`card kpi-card bi-kpi ${tone ? `bi-kpi-${tone}` : ''}`}><span className="kpi-label">{title}</span><p className="metric small-metric">{value}</p></div>;
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return <div className="card bi-chart-card"><h2>{title}</h2><div className="bi-chart-body">{children}</div></div>;
}

function ReportTable({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  const columns = Object.keys(rows[0] ?? {}).slice(0, 8);
  return <div className="card"><h2>{title}</h2>{rows.length === 0 ? <p className="empty-state">Aucune donnee pour la periode.</p> : <div className="table-wrap"><table className="data-table"><thead><tr>{columns.map((column) => <th key={column}>{label(column)}</th>)}</tr></thead><tbody>{rows.slice(0, 10).map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{formatCell(column, row[column], row)}</td>)}</tr>)}</tbody></table></div>}</div>;
}

function periodFilters(period: PeriodPreset, today = new Date()): ReportFilters {
  const end = dateIso(today);
  const start = new Date(today);
  if (period === 'today') return { from: end, to: end };
  if (period === '7d') start.setDate(start.getDate() - 6);
  if (period === '30d') start.setDate(start.getDate() - 29);
  if (period === 'month') start.setDate(1);
  return { from: dateIso(start), to: end };
}

function dateIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildSalesByDay(rows: Array<Record<string, unknown>>, from?: string, to?: string) {
  const map = new Map<string, number>();
  const start = from ? new Date(from) : new Date();
  const end = to ? new Date(to) : new Date();
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) map.set(dateIso(day), 0);
  for (const row of rows) {
    const date = String(row.saleDate ?? row.date ?? row.createdAt ?? '').slice(0, 10);
    const amount = numberFrom(row.totalAmount, row.revenue, row.amount);
    if (date) map.set(date, (map.get(date) ?? 0) + amount);
  }
  return Array.from(map.entries()).map(([date, revenue]) => ({ date: formatDate(date).slice(0, 5), revenue }));
}

function buildSalesTypeData(rows: Array<Record<string, unknown>>, kpis?: { totalCashSales?: number; totalInsuranceSales?: number }) {
  const cash = rows.reduce((sum, row) => String(row.saleType ?? row.type ?? '').toUpperCase().includes('CASH') ? sum + numberFrom(row.totalAmount, row.revenue, row.amount) : sum, 0);
  const insurance = rows.reduce((sum, row) => String(row.saleType ?? row.type ?? '').toUpperCase().includes('INSURANCE') ? sum + numberFrom(row.totalAmount, row.revenue, row.amount) : sum, 0);
  return [
    { name: 'CASH', value: cash || kpis?.totalCashSales || 0 },
    { name: 'ASSURANCE', value: insurance || kpis?.totalInsuranceSales || 0 },
  ];
}

function buildTopProducts(rows: Array<Record<string, unknown>>) {
  return rows.slice(0, 8).map((row, index) => ({
    name: String(row.commercialName ?? row.articleName ?? row.productName ?? row.articleCode ?? `Produit ${index + 1}`).slice(0, 28),
    value: numberFrom(row.quantitySold, row.quantity, row.totalQuantity, row.totalAmount, row.revenue),
  }));
}

function buildReceivableStatus(rows: Array<Record<string, unknown>>, openAmount: number) {
  if (rows.length === 0) return [{ name: 'Ouvertes', value: openAmount }];
  const map = new Map<string, number>();
  for (const row of rows) {
    const status = String(row.status ?? 'Ouvertes');
    map.set(status, (map.get(status) ?? 0) + numberFrom(row.balance, row.amountDue, row.amount));
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

function buildStockCategoryData(rows: Array<Record<string, unknown>>) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const category = String(row.categoryName ?? row.category ?? 'Non classe');
    map.set(category, (map.get(category) ?? 0) + numberFrom(row.saleValue, row.stockValue, row.purchaseValue));
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name: name.slice(0, 24), value }));
}

function buildAlerts(kpis: any, fefoRows: any[], receivables: Array<Record<string, unknown>>, cash: Array<Record<string, unknown>>) {
  const criticalFefo = fefoRows.filter((row) => row.priority === 'EXPIRED' || row.priority === 'RED').slice(0, 3);
  const openReceivables = numberFrom(kpis?.openReceivables);
  return [
    { title: 'Produits en rupture', value: kpis?.lowStockProductsCount ?? 0, tone: (kpis?.lowStockProductsCount ?? 0) > 0 ? 'warning' : 'success', message: 'Verifier les seuils de stock et les commandes fournisseur.' },
    { title: 'FEFO a traiter', value: criticalFefo.length, tone: criticalFefo.length ? 'danger' : 'success', message: criticalFefo[0]?.articleName ? `Priorite : ${criticalFefo[0].articleName}` : 'Aucune urgence FEFO critique.' },
    { title: 'Lots expires', value: kpis?.expiredLotsCount ?? 0, tone: (kpis?.expiredLotsCount ?? 0) > 0 ? 'danger' : 'success', message: 'Retirer les lots expires du flux de vente.' },
    { title: 'Creances elevees', value: formatMoney(openReceivables, 'USD'), tone: openReceivables > 0 ? 'warning' : 'success', message: receivables.length ? 'Suivre les paiements assurances ouverts.' : 'Aucune creance ouverte significative.' },
    { title: 'Caisse du jour', value: cash.length ? 'Active' : 'A surveiller', tone: cash.length ? 'success' : 'warning', message: cash.length ? 'Des mouvements caisse existent sur la periode.' : 'Verifier l ouverture caisse si vente comptoir.' },
  ];
}

function numberFrom(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value ?? 0);
    if (Number.isFinite(number) && number !== 0) return number;
  }
  return 0;
}

function label(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function formatCell(key: string, value: unknown, row: Record<string, unknown>) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return moneyKeys.has(key) ? formatMoney(value, String(row.currencyCode ?? row.baseCurrency ?? 'USD'), String(row.currencySymbol ?? '$')) : value.toString();
  return String(value);
}
