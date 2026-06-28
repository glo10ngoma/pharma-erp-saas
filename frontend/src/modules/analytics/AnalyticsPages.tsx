import { ReactNode, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { articlesService } from '../../services/articles.service';
import { lotsService } from '../../services/lots.service';
import { purchasesService } from '../../services/purchases.service';
import { reportsService } from '../../services/reports.service';
import { salesService } from '../../services/sales.service';
import { stocksService } from '../../services/stocks.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import { ReportActions, ReportColumn, ReportFiltersBar, ReportKpiCards, ReportPageShell, ReportPreview } from '../reports/report-ui';

type Row = Record<string, string | number | null | undefined>;
type Period = '30' | '60' | '90';

const colors = ['#0f766e', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981'];

export function AnalyticsOverviewPage() {
  const [period, setPeriod] = useState<Period>('30');
  const filters = periodFilters(period);
  const dashboard = useQuery({ queryKey: ['analytics', 'dashboard', period], queryFn: async () => (await reportsService.dashboard(filters)).data });
  const sales = useQuery({ queryKey: ['analytics', 'sales', period], queryFn: async () => (await reportsService.sales(filters)).data });
  const expiry = useQuery({ queryKey: ['analytics', 'expiry', period], queryFn: async () => (await reportsService.expiry(filters)).data });

  const salesByDay = useMemo(() => buildSalesByDay(sales.data ?? [], filters.from, filters.to), [filters.from, filters.to, sales.data]);
  const salesTypes = useMemo(() => [
    { name: 'CASH', value: dashboard.data?.totalCashSales ?? salesByType(sales.data ?? [], 'CASH') },
    { name: 'ASSURANCE', value: dashboard.data?.totalInsuranceSales ?? salesByType(sales.data ?? [], 'INSURANCE') },
  ], [dashboard.data, sales.data]);
  const alerts = useMemo(() => buildOverviewAlerts(dashboard.data, expiry.data ?? []), [dashboard.data, expiry.data]);

  return (
    <AnalyticsShell title="Vue d'ensemble" description="Pilotage intelligent des ventes, marges, stock, creances et alertes.">
      <AnalyticsFilters period={period} setPeriod={setPeriod} />
      <ReportKpiCards cards={[
        { label: 'CA periode', value: money(sum(salesByDay, 'revenue') || dashboard.data?.revenueMonth || 0) },
        { label: 'Marge brute', value: money(dashboard.data?.estimatedGrossMargin || 0) },
        { label: 'Taux marge', value: percent((dashboard.data?.estimatedGrossMargin || 0) / Math.max(dashboard.data?.revenueMonth || 1, 1) * 100) },
        { label: 'Valeur stock', value: money(dashboard.data?.stockValueSale || 0) },
        { label: 'Produits a risque', value: String((dashboard.data?.expiredLotsCount || 0) + (dashboard.data?.expiring30DaysCount || 0)), tone: 'warning' },
        { label: 'Creances', value: money(dashboard.data?.openReceivables || 0), tone: (dashboard.data?.openReceivables || 0) > 0 ? 'warning' : 'success' },
      ]} />
      <section className="analytics-chart-grid">
        <ChartCard title="CA par periode">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={salesByDay}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={(value) => money(Number(value))} /><Bar dataKey="revenue" fill="#0f766e" /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Marge par periode">
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={salesByDay}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={(value) => money(Number(value))} /><Bar dataKey="revenue" fill="#93c5fd" /><Line dataKey="margin" stroke="#0f766e" strokeWidth={3} /></ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Ventes CASH / ASSURANCE">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart><Pie data={salesTypes} dataKey="value" nameKey="name" outerRadius={85} label>{salesTypes.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip formatter={(value) => money(Number(value))} /></PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Stock a risque">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={[
              { name: 'Expires', value: dashboard.data?.expiredLotsCount || 0 },
              { name: '<30j', value: dashboard.data?.expiring30DaysCount || 0 },
              { name: '<90j', value: dashboard.data?.expiring90DaysCount || 0 },
            ]}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#f59e0b" /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>
      <div className="card">
        <h2>Top alertes</h2>
        <div className="analytics-alert-grid">{alerts.map((alert) => <div className={`analytics-alert analytics-alert-${alert.tone}`} key={alert.title}><strong>{alert.title}</strong><span>{alert.message}</span></div>)}</div>
      </div>
    </AnalyticsShell>
  );
}

export function AnalyticsAbcPage() {
  const [period, setPeriod] = useState<Period>('30');
  const filters = periodFilters(period);
  const query = useQuery({ queryKey: ['analytics', 'abc', period], queryFn: async () => (await reportsService.topProducts(filters)).data });
  const rows = useMemo(() => buildAbcRows(query.data ?? []), [query.data]);
  const columns = analyticsColumns([
    ['rank', 'Rang', 'right'], ['article', 'Article'], ['revenue', 'CA', 'right'], ['share', '% CA', 'right'], ['cumulative', '% cumule', 'right'], ['class', 'Classe', 'center'],
  ]);
  return <AnalyticsTablePage title="ABC / Pareto" description="Identifier les produits qui portent la majorite du chiffre d'affaires." period={period} setPeriod={setPeriod} rows={rows} columns={columns} filename="analytics_abc" chart={<ParetoChart rows={rows} />} kpis={[
    { label: 'Produits analyses', value: String(rows.length) },
    { label: 'Classe A', value: String(rows.filter((row) => row.class === 'A').length) },
    { label: 'CA total', value: money(sum(rows, 'revenue')) },
  ]} />;
}

export function AnalyticsStockRotationPage() {
  const [period, setPeriod] = useState<Period>('30');
  const filters = periodFilters(period);
  const stocks = useQuery({ queryKey: ['analytics', 'rotation-stocks'], queryFn: async () => (await stocksService.getAll()).data });
  const topProducts = useQuery({ queryKey: ['analytics', 'rotation-sales', period], queryFn: async () => (await reportsService.topProducts(filters)).data });
  const rows = useMemo(() => buildRotationRows(stocks.data ?? [], topProducts.data ?? [], Number(period)), [period, stocks.data, topProducts.data]);
  const columns = analyticsColumns([
    ['article', 'Article'], ['stock', 'Stock actuel', 'right'], ['sold', 'Qte vendue', 'right'], ['rotation', 'Rotation', 'right'], ['coverage', 'Jours couverture', 'right'], ['status', 'Statut', 'center'],
  ]);
  return <AnalyticsTablePage title="Rotation stocks" description="Mesurer vitesse de rotation et couverture theorique." period={period} setPeriod={setPeriod} rows={rows} columns={columns} filename="analytics_rotation_stocks" kpis={[
    { label: 'Produits', value: String(rows.length) },
    { label: 'Rapides', value: String(rows.filter((row) => row.status === 'Rapide').length), tone: 'success' },
    { label: 'Lents', value: String(rows.filter((row) => row.status === 'Lent').length), tone: 'warning' },
  ]} />;
}

export function AnalyticsDormantProductsPage() {
  const [period, setPeriod] = useState<Period>('90');
  const filters = periodFilters(period);
  const stocks = useQuery({ queryKey: ['analytics', 'dormant-stocks'], queryFn: async () => (await stocksService.getAll()).data });
  const sales = useQuery({ queryKey: ['analytics', 'dormant-sales', period], queryFn: async () => (await salesService.getAll()).data });
  const rows = useMemo(() => buildDormantRows(stocks.data ?? [], sales.data ?? [], filters.from), [filters.from, sales.data, stocks.data]);
  const columns = analyticsColumns([
    ['article', 'Article'], ['stock', 'Stock disponible', 'right'], ['value', 'Valeur stock', 'right'], ['lastSale', 'Derniere vente'], ['recommendation', 'Recommandation'],
  ]);
  return <AnalyticsTablePage title="Produits dormants" description="Detecter les produits sans vente recente." period={period} setPeriod={setPeriod} rows={rows} columns={columns} filename="analytics_produits_dormants" kpis={[
    { label: 'Dormants', value: String(rows.length), tone: rows.length > 0 ? 'warning' : 'success' },
    { label: 'Valeur stock', value: money(sum(rows, 'value')) },
  ]} />;
}

export function AnalyticsMarginsPage() {
  const [period, setPeriod] = useState<Period>('30');
  const query = useQuery({ queryKey: ['analytics', 'margins', period], queryFn: async () => (await reportsService.margins(periodFilters(period))).data });
  const rows = useMemo(() => (query.data ?? []).map((row, index) => ({
    article: text(row.articleName, row.commercialName, row.articleCode, `Produit ${index + 1}`),
    category: text(row.categoryName, row.category, 'Non classe'),
    revenue: num(row.revenue, row.totalAmount, row.saleValue),
    cost: num(row.estimatedCost, row.purchaseValue, row.cost),
    margin: num(row.grossMargin, row.margin),
    rate: num(row.marginRate, row.marginPercent),
    status: num(row.marginRate, row.marginPercent) < 15 ? 'Faible' : 'Correcte',
  })), [query.data]);
  const columns = analyticsColumns([
    ['article', 'Article'], ['category', 'Categorie'], ['revenue', 'CA', 'right'], ['cost', 'Cout', 'right'], ['margin', 'Marge', 'right'], ['rate', 'Taux %', 'right'], ['status', 'Statut', 'center'],
  ]);
  return <AnalyticsTablePage title="Marges" description="Marge par produit, categorie et alertes de marge faible." period={period} setPeriod={setPeriod} rows={rows} columns={columns} filename="analytics_marges" kpis={[
    { label: 'Marge brute', value: money(sum(rows, 'margin')), tone: 'success' },
    { label: 'Marges faibles', value: String(rows.filter((row) => row.status === 'Faible').length), tone: 'warning' },
  ]} />;
}

export function AnalyticsSuppliersPage() {
  const [period, setPeriod] = useState<Period>('90');
  const purchases = useQuery({ queryKey: ['analytics', 'suppliers'], queryFn: async () => (await purchasesService.getAll()).data });
  const rows = useMemo(() => buildSupplierRows(purchases.data ?? []), [purchases.data]);
  const columns = analyticsColumns([
    ['supplier', 'Fournisseur'], ['orders', 'Commandes', 'right'], ['value', 'Valeur achetee', 'right'], ['products', 'Produits fournis', 'right'], ['dependency', 'Dependance %', 'right'],
  ]);
  return <AnalyticsTablePage title="Fournisseurs" description="Valeur achetee, dependance et nombre de commandes par fournisseur." period={period} setPeriod={setPeriod} rows={rows} columns={columns} filename="analytics_fournisseurs" kpis={[
    { label: 'Fournisseurs', value: String(rows.length) },
    { label: 'Valeur achetee', value: money(sum(rows, 'value')) },
  ]} />;
}

export function AnalyticsSellersPage() {
  const [period, setPeriod] = useState<Period>('30');
  const sales = useQuery({ queryKey: ['analytics', 'sellers', period], queryFn: async () => (await salesService.getAll()).data });
  const rows = useMemo(() => buildSellerRows(sales.data ?? []), [sales.data]);
  const columns = analyticsColumns([
    ['seller', 'Vendeur'], ['sales', 'Ventes', 'right'], ['revenue', 'CA', 'right'], ['averageBasket', 'Panier moyen', 'right'], ['cancelled', 'Annulations', 'right'],
  ]);
  return (
    <AnalyticsTablePage title="Vendeurs" description="Analyse vendeur lorsque les donnees utilisateur sont disponibles." period={period} setPeriod={setPeriod} rows={rows} columns={columns} filename="analytics_vendeurs" kpis={[
      { label: 'Vendeurs', value: String(rows.length) },
      { label: 'CA suivi', value: money(sum(rows, 'revenue')) },
    ]} emptyText="Donnees vendeur insuffisantes pour analyse complete." />
  );
}

function AnalyticsTablePage({ title, description, period, setPeriod, rows, columns, filename, kpis, chart, emptyText }: { title: string; description: string; period: Period; setPeriod: (period: Period) => void; rows: Row[]; columns: ReportColumn<Row>[]; filename: string; kpis: any[]; chart?: ReactNode; emptyText?: string }) {
  return (
    <AnalyticsShell title={title} description={description}>
      <ReportFiltersBar>
        <select className="input compact-input" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
          <option value="30">30 jours</option>
          <option value="60">60 jours</option>
          <option value="90">90 jours</option>
        </select>
        <ReportActions filename={filename} sheetName={title} rows={rows} columns={columns} />
      </ReportFiltersBar>
      <ReportKpiCards cards={kpis} />
      {chart}
      <ReportPreview title={title} subtitle={description} rows={rows} columns={columns} period={`${period} jours`} emptyText={emptyText} totals={<span>Lignes : <strong>{rows.length}</strong></span>} />
    </AnalyticsShell>
  );
}

function AnalyticsShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <ReportPageShell title={title} description={description}>{children}</ReportPageShell>;
}

function AnalyticsFilters({ period, setPeriod }: { period: Period; setPeriod: (period: Period) => void }) {
  return <ReportFiltersBar><select className="input compact-input" value={period} onChange={(event) => setPeriod(event.target.value as Period)}><option value="30">30 jours</option><option value="60">60 jours</option><option value="90">90 jours</option></select></ReportFiltersBar>;
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return <div className="card analytics-chart-card"><h2>{title}</h2>{children}</div>;
}

function ParetoChart({ rows }: { rows: Row[] }) {
  return <ChartCard title="Courbe Pareto"><ResponsiveContainer width="100%" height={280}><ComposedChart data={rows.slice(0, 15)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="article" hide /><YAxis yAxisId="left" /><YAxis yAxisId="right" orientation="right" domain={[0, 100]} /><Tooltip /><Bar yAxisId="left" dataKey="revenue" fill="#2563eb" /><Line yAxisId="right" dataKey="cumulative" stroke="#ef4444" strokeWidth={3} /></ComposedChart></ResponsiveContainer></ChartCard>;
}

function periodFilters(period: Period) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - Number(period) + 1);
  return { from: iso(from), to: iso(to) };
}

function buildSalesByDay(rows: Array<Record<string, unknown>>, from?: string, to?: string) {
  const map = new Map<string, number>();
  const start = new Date(from || new Date());
  const end = new Date(to || new Date());
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) map.set(iso(day), 0);
  rows.forEach((row) => {
    const date = String(row.saleDate || row.date || row.createdAt || '').slice(0, 10);
    if (date) map.set(date, (map.get(date) || 0) + num(row.totalAmount, row.revenue, row.amount));
  });
  return Array.from(map.entries()).map(([date, revenue]) => ({ date: formatDate(date).slice(0, 5), revenue, margin: revenue * 0.22 }));
}

function buildAbcRows(rows: Array<Record<string, unknown>>) {
  const mapped = rows.map((row, index) => ({ article: text(row.commercialName, row.articleName, row.productName, row.articleCode, `Produit ${index + 1}`), revenue: num(row.revenue, row.totalAmount, row.amount, row.saleValue) })).sort((a, b) => b.revenue - a.revenue);
  const total = Math.max(sum(mapped, 'revenue'), 1);
  let cumulative = 0;
  return mapped.map((row, index) => {
    cumulative += row.revenue / total * 100;
    return { rank: index + 1, article: row.article, revenue: row.revenue, share: row.revenue / total * 100, cumulative, class: cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C' };
  });
}

function buildRotationRows(stocks: any[], products: Array<Record<string, unknown>>, days: number) {
  const sold = new Map(products.map((row) => [text(row.articleCode, row.articleId, row.articleName, row.commercialName), num(row.quantitySold, row.quantity, row.totalQuantity)]));
  const stockMap = new Map<string, { article: string; stock: number }>();
  stocks.forEach((stock) => {
    const key = text(stock.articleCode, stock.articleId, stock.commercialName);
    const current = stockMap.get(key) || { article: text(stock.articleCode, stock.commercialName), stock: 0 };
    current.stock += Number(stock.quantityAvailable || 0);
    stockMap.set(key, current);
  });
  return Array.from(stockMap.values()).map((row) => {
    const soldQty = sold.get(row.article.split(' ')[0]) || 0;
    const avg = soldQty / Math.max(days, 1);
    const rotation = soldQty / Math.max(row.stock / 2, 1);
    const coverage = avg > 0 ? row.stock / avg : 999;
    return { article: row.article, stock: row.stock, sold: soldQty, rotation, coverage, status: rotation > 2 ? 'Rapide' : rotation < 0.5 ? 'Lent' : 'Normal' };
  });
}

function buildDormantRows(stocks: any[], sales: any[], from: string) {
  const sold = new Set<string>();
  sales.forEach((sale) => (sale.items || []).forEach((item: any) => sold.add(item.articleId)));
  const map = new Map<string, Row>();
  stocks.forEach((stock) => {
    if (sold.has(stock.articleId)) return;
    const key = stock.articleId;
    const current = map.get(key) || { article: text(stock.articleCode, stock.commercialName), stock: 0, value: 0, lastSale: `Aucune depuis ${formatDate(from)}`, recommendation: 'Promotion / surveiller' };
    current.stock = Number(current.stock || 0) + Number(stock.quantityAvailable || 0);
    map.set(key, current);
  });
  return Array.from(map.values()).filter((row) => Number(row.stock || 0) > 0);
}

function buildSupplierRows(purchases: any[]) {
  const map = new Map<string, any>();
  purchases.forEach((purchase) => {
    const key = purchase.supplierName || 'Non renseigne';
    const current = map.get(key) || { supplier: key, orders: 0, value: 0, products: new Set<string>() };
    current.orders += 1;
    current.value += Number(purchase.totalAmount || 0);
    (purchase.items || []).forEach((item: any) => current.products.add(item.articleId || item.articleCode));
    map.set(key, current);
  });
  const total = Array.from(map.values()).reduce((sumValue, row) => sumValue + row.value, 0) || 1;
  return Array.from(map.values()).map((row) => ({ supplier: row.supplier, orders: row.orders, value: row.value, products: row.products.size, dependency: row.value / total * 100 })).sort((a, b) => b.value - a.value);
}

function buildSellerRows(sales: any[]) {
  const map = new Map<string, any>();
  sales.forEach((sale) => {
    const seller = sale.userName || sale.createdByName || sale.sellerName;
    if (!seller) return;
    const current = map.get(seller) || { seller, sales: 0, revenue: 0, cancelled: 0 };
    current.sales += 1;
    current.revenue += Number(sale.totalAmount || 0);
    if (sale.status === 'CANCELLED') current.cancelled += 1;
    map.set(seller, current);
  });
  return Array.from(map.values()).map((row) => ({ ...row, averageBasket: row.sales ? row.revenue / row.sales : 0 }));
}

function analyticsColumns(source: Array<[key: string, label: string, align?: 'left' | 'center' | 'right']>): ReportColumn<Row>[] {
  const moneyKeys = new Set(['revenue', 'cost', 'margin', 'value', 'averageBasket']);
  const percentKeys = new Set(['share', 'cumulative', 'rate', 'dependency']);
  return source.map(([key, label, align]) => ({ key, label, align, render: (row) => moneyKeys.has(key) ? money(Number(row[key] || 0)) : percentKeys.has(key) ? percent(Number(row[key] || 0)) : row[key] }));
}

function buildOverviewAlerts(kpis: any, expiryRows: Array<Record<string, unknown>>) {
  return [
    { title: 'Stock faible', message: `${kpis?.lowStockProductsCount || 0} produit(s) sous seuil.`, tone: (kpis?.lowStockProductsCount || 0) > 0 ? 'warning' : 'success' },
    { title: 'FEFO', message: `${kpis?.expiring30DaysCount || 0} lot(s) sous 30 jours.`, tone: (kpis?.expiring30DaysCount || 0) > 0 ? 'warning' : 'success' },
    { title: 'Creances', message: money(kpis?.openReceivables || 0), tone: (kpis?.openReceivables || 0) > 0 ? 'warning' : 'success' },
    { title: 'Peremption', message: `${expiryRows.length} ligne(s) a suivre.`, tone: expiryRows.length > 0 ? 'warning' : 'success' },
  ];
}

function salesByType(rows: Array<Record<string, unknown>>, type: string) {
  return rows.filter((row) => String(row.saleType || row.type).toUpperCase() === type).reduce((total, row) => total + num(row.totalAmount, row.revenue, row.amount), 0);
}

function iso(date: Date) { return date.toISOString().slice(0, 10); }
function sum(rows: Array<Record<string, unknown>>, key: string) { return rows.reduce((total, row) => total + Number(row[key] || 0), 0); }
function num(...values: unknown[]) { for (const value of values) { const number = Number(value || 0); if (Number.isFinite(number) && number !== 0) return number; } return 0; }
function text(...values: unknown[]) { return String(values.find((value) => value !== undefined && value !== null && value !== '') || '-'); }
function money(value: number) { return formatMoney(value, 'USD'); }
function percent(value: number) { return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0)} %`; }
