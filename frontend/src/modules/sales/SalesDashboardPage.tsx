import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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
import { apiErrorMessage } from '../../services/apiError';
import { sitesService } from '../../services/sites.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import {
  loadSalesSnapshot,
  salesPeriodRange,
  type PeriodPreset,
} from './sales-module-utils';

const COLORS = ['#0f766e', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981'];

export function SalesDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [period, setPeriod] = useState<PeriodPreset>((searchParams.get('period') as PeriodPreset) || 'month');
  const [currencyView, setCurrencyView] = useState<'USD' | 'CDF'>((searchParams.get('currency') as 'USD' | 'CDF') || 'USD');
  const [siteId, setSiteId] = useState(searchParams.get('siteId') || '');
  const [seller, setSeller] = useState(searchParams.get('seller') || '');
  const [saleType, setSaleType] = useState(searchParams.get('saleType') || '');
  const [saleMode, setSaleMode] = useState(searchParams.get('saleMode') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [from, setFrom] = useState(searchParams.get('from') || '');
  const [to, setTo] = useState(searchParams.get('to') || '');

  const sites = useQuery({ queryKey: ['sales-dashboard-sites'], queryFn: async () => (await sitesService.getAll()).data, staleTime: 5 * 60 * 1000 });
  const periodRange = useMemo(() => {
    if (period === 'custom') return { from: from || '', to: to || '' };
    return salesPeriodRange(period);
  }, [from, period, to]);

  const selectedSite = useMemo(() => sites.data?.find((site) => site.siteId === siteId), [siteId, sites.data]);
  const snapshot = useQuery({
    queryKey: ['sales-dashboard', periodRange.from, periodRange.to, siteId, seller, saleType, saleMode, status],
    queryFn: async () => loadSalesSnapshot({
      title: 'Dashboard Ventes',
      subtitle: `Synthese ${periodLabel(period, periodRange.from, periodRange.to)}`,
      period,
      from: periodRange.from,
      to: periodRange.to,
      siteId: siteId || undefined,
      siteLabel: selectedSite?.siteName ?? 'Tous les sites',
      includeCash: true,
      exportName: 'dashboard_ventes',
      filters: {
        seller: seller || undefined,
        saleType: saleType || undefined,
        saleMode: saleMode || undefined,
        status: status || undefined,
      },
    }),
    staleTime: 5 * 60 * 1000,
  });

  const dashboard = snapshot.data;
  const kpis = dashboard?.summary;
  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [];
    if (period !== 'custom') chips.push({ key: 'period', label: periodLabel(period, periodRange.from, periodRange.to) });
    else if (periodRange.from || periodRange.to) chips.push({ key: 'period', label: `Periode : ${periodRange.from || '...'} - ${periodRange.to || '...'}` });
    if (siteId) chips.push({ key: 'siteId', label: `Site : ${selectedSite?.siteName ?? siteId}` });
    if (seller) chips.push({ key: 'seller', label: `Caissier : ${seller}` });
    if (saleType) chips.push({ key: 'saleType', label: `Type : ${saleType}` });
    if (saleMode) chips.push({ key: 'saleMode', label: `Mode : ${saleMode}` });
    if (status) chips.push({ key: 'status', label: `Statut : ${status}` });
    return chips;
  }, [period, periodRange.from, periodRange.to, saleMode, saleType, seller, selectedSite?.siteName, siteId, status]);

  function applyPeriod(next: PeriodPreset) {
    setPeriod(next);
    const range = salesPeriodRange(next);
    if (next !== 'custom') {
      setFrom(range.from);
      setTo(range.to);
    }
    updateSearch({ period: next, from: next === 'custom' ? from : range.from, to: next === 'custom' ? to : range.to });
  }

  function updateSearch(next: Record<string, string | undefined>) {
    const merged = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value);
      else merged.delete(key);
    }
    setSearchParams(merged, { replace: true });
  }

  function setCustomFrom(value: string) {
    setPeriod('custom');
    setFrom(value);
    updateSearch({ period: 'custom', from: value });
  }

  function setCustomTo(value: string) {
    setPeriod('custom');
    setTo(value);
    updateSearch({ period: 'custom', to: value });
  }

  const trend = dashboard?.trendData ?? [];
  const topProducts = dashboard?.topProducts ?? [];

  return (
    <section className="sales-module-page">
      <div className="card sales-dashboard-hero">
        <div>
          <span className="breadcrumb">Ventes</span>
          <h2>Dashboard</h2>
          <p>Synthese decisionnelle des ventes, encaissements et performances du module.</p>
        </div>
        <div className="sales-dashboard-hero-meta">
          <div><span>Periode</span><strong>{periodLabel(period, periodRange.from, periodRange.to)}</strong></div>
          <div><span>Site</span><strong>{selectedSite?.siteName ?? 'Tous les sites'}</strong></div>
          <div><span>Maj</span><strong>{dashboard ? formatDate(new Date()) : '-'}</strong></div>
        </div>
      </div>

      <section className="card sales-dashboard-filters">
        <div className="sales-dashboard-filter-row">
          <button className={`filter-pill ${period === 'today' ? 'active' : ''}`} type="button" onClick={() => applyPeriod('today')}>Aujourd&apos;hui</button>
          <button className={`filter-pill ${period === 'yesterday' ? 'active' : ''}`} type="button" onClick={() => applyPeriod('yesterday')}>Hier</button>
          <button className={`filter-pill ${period === 'week' ? 'active' : ''}`} type="button" onClick={() => applyPeriod('week')}>Cette semaine</button>
          <button className={`filter-pill ${period === 'month' ? 'active' : ''}`} type="button" onClick={() => applyPeriod('month')}>Ce mois</button>
          <button className={`filter-pill ${period === 'previous-month' ? 'active' : ''}`} type="button" onClick={() => applyPeriod('previous-month')}>Mois precedent</button>
          <button className={`filter-pill ${period === 'custom' ? 'active' : ''}`} type="button" onClick={() => applyPeriod('custom')}>Personnalise</button>
        </div>
        <div className="sales-dashboard-filter-grid">
          <select className="input compact-input" value={siteId} onChange={(event) => { setSiteId(event.target.value); updateSearch({ siteId: event.target.value || undefined }); }}>
            <option value="">Tous les sites</option>
            {(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}
          </select>
          <input className="input compact-input" placeholder="Caissier..." value={seller} onChange={(event) => { setSeller(event.target.value); updateSearch({ seller: event.target.value || undefined }); }} />
          <select className="input compact-input" value={saleType} onChange={(event) => { setSaleType(event.target.value); updateSearch({ saleType: event.target.value || undefined }); }}>
            <option value="">Type</option>
            <option value="CASH">CASH</option>
            <option value="INSURANCE">ASSURANCE</option>
          </select>
          <select className="input compact-input" value={saleMode} onChange={(event) => { setSaleMode(event.target.value); updateSearch({ saleMode: event.target.value || undefined }); }}>
            <option value="">Mode</option>
            <option value="IMMEDIATE">Immediate</option>
            <option value="ADVANCE">Avance</option>
          </select>
          <select className="input compact-input" value={status} onChange={(event) => { setStatus(event.target.value); updateSearch({ status: event.target.value || undefined }); }}>
            <option value="">Statut</option>
            <option value="DRAFT">DRAFT</option>
            <option value="VALIDATED">VALIDATED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <select className="input compact-input" value={currencyView} onChange={(event) => { setCurrencyView(event.target.value as 'USD' | 'CDF'); updateSearch({ currency: event.target.value }); }}>
            <option value="USD">Vue USD</option>
            <option value="CDF">Vue FC</option>
          </select>
          <input className="input compact-input" type="date" value={from} onChange={(event) => setCustomFrom(event.target.value)} />
          <input className="input compact-input" type="date" value={to} onChange={(event) => setCustomTo(event.target.value)} />
        </div>

        <div className="sales-active-chips">
          {activeChips.length === 0 ? <span className="muted">Aucun filtre actif.</span> : activeChips.map((chip) => <span className="badge badge-neutral" key={chip.key}>{chip.label}</span>)}
        </div>
      </section>

      {snapshot.isLoading ? (
        <div className="card"><p className="loading-state">Chargement du dashboard ventes...</p></div>
      ) : snapshot.isError ? (
        <div className="card">
          <p className="form-error">Impossible de charger la synthese des ventes.</p>
          <p className="muted">{apiErrorMessage(snapshot.error)}</p>
        </div>
      ) : dashboard ? (
        <>
          <section className="sales-dashboard-kpis">
            <Kpi title="CA net" value={formatMoney(kpis?.revenueNet ?? 0, 'USD')} />
            <Kpi title="Ventes validees" value={String(kpis?.saleCount ?? 0)} />
            <Kpi title="Ventes immediates" value={String(kpis?.immediateSaleCount ?? 0)} />
            <Kpi title="Avances en attente" value={String(kpis?.advancePendingCount ?? 0)} />
            <Kpi title="Avances livrees" value={String(kpis?.advanceFulfilledCount ?? 0)} />
            <Kpi title="Panier moyen" value={formatMoney(kpis?.averageBasket ?? 0, 'USD')} />
            <Kpi title="Encaisse USD" value={formatMoney(kpis?.receivedUsd ?? 0, 'USD')} />
            <Kpi title="Encaisse FC" value={formatMoney(kpis?.receivedCdf ?? 0, 'CDF', 'FC')} />
          </section>

          <details className="card sales-dashboard-secondary">
            <summary>Indicateurs secondaires</summary>
            <div className="sales-dashboard-secondary-grid">
              <Kpi title="CA avances" value={formatMoney((kpis?.advancePendingRevenue ?? 0) + (kpis?.advanceFulfilledRevenue ?? 0), 'USD')} />
              <Kpi title="Articles vendus" value={String(kpis?.itemsSold ?? 0)} />
              <Kpi title="Rendu USD" value={formatMoney(kpis?.changeUsd ?? 0, 'USD')} />
              <Kpi title="Rendu FC" value={formatMoney(kpis?.changeCdf ?? 0, 'CDF', 'FC')} />
              <Kpi title="Ecarts de reglement" value={formatMoney(kpis?.settlementDifferenceUsd ?? 0, 'USD')} />
              <Kpi title="Ventes annulees" value={String(kpis?.cancelledCount ?? 0)} />
            </div>
          </details>

          <section className="sales-dashboard-charts">
            <ChartCard title="Evolution des ventes">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trend} margin={{ top: 10, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis yAxisId="left" allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip formatter={(value, name) => (name === 'count' ? [value, 'Ventes'] : [formatMoney(Number(value), 'USD'), 'CA'])} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" fill="#2563eb" name="Ventes" />
                  <Bar yAxisId="right" dataKey="revenue" fill="#0f766e" name="CA net" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Repartition des ventes par mode">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={dashboard.modeData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={48} paddingAngle={4}>
                    {dashboard.modeData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Repartition des encaissements">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={dashboard.paymentData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={58} paddingAngle={4}>
                    {dashboard.paymentData.map((entry, index) => <Cell key={entry.name} fill={COLORS[(index + 2) % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(Number(value), currencyView)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top 5 articles vendus">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dashboard.topProducts.slice(0, 5)} layout="vertical" margin={{ left: 10, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={140} />
                  <Tooltip formatter={(value) => [formatMoney(Number(value), 'USD'), 'CA']} />
                  <Bar dataKey="revenue" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          <section className="sales-dashboard-alerts">
            <div className="card">
              <h3>Alertes rapides</h3>
              {kpis?.settlementDifferenceUsd ? (
                <p className="form-error">Des ecarts de reglement sont presentes sur la periode selectionnee.</p>
              ) : (
                <p className="empty-state">Aucune alerte majeure sur la periode selectionnee.</p>
              )}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="card sales-kpi-card">
      <span className="kpi-label">{title}</span>
      <p className="metric small-metric">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card sales-chart-card">
      <h3>{title}</h3>
      <div className="sales-chart-body">{children}</div>
    </div>
  );
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
