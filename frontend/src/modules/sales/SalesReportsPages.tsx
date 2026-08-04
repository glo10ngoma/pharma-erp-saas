import { useState, type ReactNode } from 'react';
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
import { exportSalesSnapshot, loadSalesSnapshot, salesPeriodRange, type PeriodPreset, type SalesDaySnapshot } from './sales-module-utils';

const COLORS = ['#0f766e', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981'];

export function YesterdaySalesReportPage() {
  const [searchParams] = useSearchParams();
  const siteId = searchParams.get('siteId') || '';
  const [currencyView, setCurrencyView] = useState<'USD' | 'CDF'>((searchParams.get('currency') as 'USD' | 'CDF') || 'USD');
  const sites = useQuery({ queryKey: ['sales-report-sites', 'yesterday'], queryFn: async () => (await sitesService.getAll()).data, staleTime: 5 * 60 * 1000 });
  const range = salesPeriodRange('yesterday');
  const selectedSite = sites.data?.find((site) => site.siteId === siteId);
  const report = useQuery({
    queryKey: ['sales-report-yesterday', range.from, range.to, siteId],
    queryFn: async () => loadSalesSnapshot({
      title: "Rapport ventes d'hier",
      subtitle: `Ventes valides du ${formatDate(range.from)}`,
      period: 'yesterday',
      from: range.from,
      to: range.to,
      siteId: siteId || undefined,
      siteLabel: selectedSite?.siteName ?? 'Tous les sites',
      includeCash: true,
      exportName: 'rapport-ventes-hier',
    }),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <SalesReportView
      title="Rapport ventes d'hier"
      subtitle={`Date : ${formatDate(range.from)}`}
      snapshot={report.data}
      loading={report.isLoading}
      error={report.isError ? apiErrorMessage(report.error) : ''}
      currencyView={currencyView}
      onCurrencyViewChange={setCurrencyView}
      onRefresh={() => report.refetch()}
    />
  );
}

export function EndOfDaySalesReportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currencyView, setCurrencyView] = useState<'USD' | 'CDF'>((searchParams.get('currency') as 'USD' | 'CDF') || 'USD');
  const [period] = useState<PeriodPreset>('custom');
  const [from, setFrom] = useState(searchParams.get('from') || salesPeriodRange('today').from);
  const [to, setTo] = useState(searchParams.get('to') || salesPeriodRange('today').to);
  const [siteId, setSiteId] = useState(searchParams.get('siteId') || '');
  const sites = useQuery({ queryKey: ['sales-report-sites', 'end-of-day'], queryFn: async () => (await sitesService.getAll()).data, staleTime: 5 * 60 * 1000 });
  const selectedSite = sites.data?.find((site) => site.siteId === siteId);
  const report = useQuery({
    queryKey: ['sales-report-end-of-day', from, to, siteId],
    queryFn: async () => loadSalesSnapshot({
      title: 'Rapport fin de journee',
      subtitle: `Synthese ${formatDate(from || new Date())}`,
      period,
      from: from || salesPeriodRange('today').from,
      to: to || salesPeriodRange('today').to,
      siteId: siteId || undefined,
      siteLabel: selectedSite?.siteName ?? 'Tous les sites',
      includeCash: true,
      exportName: 'mini-rapport-fin-journee',
    }),
    staleTime: 5 * 60 * 1000,
  });

  function applyDate(date: string, key: 'from' | 'to') {
    const next = new URLSearchParams(searchParams);
    if (date) next.set(key, date);
    else next.delete(key);
    setSearchParams(next, { replace: true });
    if (key === 'from') setFrom(date);
    else setTo(date);
  }

  return (
    <SalesReportView
      title="Rapport fin de journee"
      subtitle={`Periode : ${formatDate(from || salesPeriodRange('today').from)} - ${selectedSite?.siteName ?? 'Tous les sites'}`}
      snapshot={report.data}
      loading={report.isLoading}
      error={report.isError ? apiErrorMessage(report.error) : ''}
      currencyView={currencyView}
      onCurrencyViewChange={setCurrencyView}
      onRefresh={() => report.refetch()}
      toolbar={(
        <>
          <select className="input compact-input" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
            <option value="">Tous les sites</option>
            {(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}
          </select>
          <input className="input compact-input" type="date" value={from} onChange={(event) => applyDate(event.target.value, 'from')} />
          <input className="input compact-input" type="date" value={to} onChange={(event) => applyDate(event.target.value, 'to')} />
        </>
      )}
    />
  );
}

function SalesReportView({
  title,
  subtitle,
  snapshot,
  loading,
  error,
  currencyView,
  onCurrencyViewChange,
  onRefresh,
  toolbar,
}: {
  title: string;
  subtitle: string;
  snapshot?: SalesDaySnapshot;
  loading: boolean;
  error: string;
  currencyView: 'USD' | 'CDF';
  onCurrencyViewChange: (value: 'USD' | 'CDF') => void;
  onRefresh: () => void;
  toolbar?: ReactNode;
}) {
  if (loading) {
    return <div className="card"><p className="loading-state">Chargement du rapport...</p></div>;
  }

  if (error) {
    return <div className="card"><p className="form-error">{error}</p><button className="ghost-button compact-button" type="button" onClick={onRefresh}>Reessayer</button></div>;
  }

  if (!snapshot) {
    return <div className="card"><p className="empty-state">Aucune donnee de rapport disponible.</p></div>;
  }

  const totals = [
    { label: 'CA net', value: formatMoney(snapshot.summary.revenueNet ?? 0, 'USD') },
    { label: 'Ventes validees', value: String(snapshot.summary.saleCount ?? 0) },
    { label: 'Panier moyen', value: formatMoney(snapshot.summary.averageBasket ?? 0, 'USD') },
    { label: 'Encaisse USD', value: formatMoney(snapshot.summary.receivedUsd ?? 0, 'USD') },
    { label: 'Encaisse FC', value: formatMoney(snapshot.summary.receivedCdf ?? 0, 'CDF', 'FC') },
    { label: 'Articles vendus', value: String(snapshot.summary.itemsSold ?? 0) },
  ];

  return (
    <>
      <section className="card sales-report-page-hero">
        <div>
          <span className="breadcrumb">Ventes</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="sales-report-toolbar">
          <button className="ghost-button compact-button" type="button" onClick={onRefresh}>Actualiser</button>
          <button className="ghost-button compact-button" type="button" onClick={() => window.print()}>Imprimer</button>
          <button className="ghost-button compact-button" type="button" onClick={() => exportSalesSnapshot(snapshot, 'xlsx')}>Excel</button>
          <button className="ghost-button compact-button" type="button" onClick={() => exportSalesSnapshot(snapshot, 'csv')}>CSV</button>
          <button className="ghost-button compact-button" type="button" onClick={() => exportSalesSnapshot(snapshot, 'json')}>JSON</button>
          <select className="input compact-input" value={currencyView} onChange={(event) => onCurrencyViewChange(event.target.value as 'USD' | 'CDF')}>
            <option value="USD">Vue USD</option>
            <option value="CDF">Vue FC</option>
          </select>
          {toolbar}
        </div>
      </section>

      <section className="sales-report-overview">
        {totals.map((item) => (
          <div className="card sales-report-tile" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </section>

      <section className="sales-report-sections">
        <ReportSection title="Evolution des ventes">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={snapshot.trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={(value, name) => (name === 'count' ? [value, 'Ventes'] : [formatMoney(Number(value), 'USD'), 'CA'])} />
              <Legend />
              <Line yAxisId="left" dataKey="count" stroke="#2563eb" type="monotone" />
              <Line yAxisId="right" dataKey="revenue" stroke="#0f766e" type="monotone" />
            </LineChart>
          </ResponsiveContainer>
        </ReportSection>

        <ReportSection title="Repartition des ventes par mode">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={snapshot.modeData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={46} paddingAngle={4}>
                {snapshot.modeData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ReportSection>

        <ReportSection title="Repartition des encaissements">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={snapshot.paymentData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={58} paddingAngle={4}>
                {snapshot.paymentData.map((entry, index) => <Cell key={entry.name} fill={COLORS[(index + 2) % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value) => formatMoney(Number(value), currencyView)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ReportSection>

        <ReportSection title="Top articles vendus">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={snapshot.topProducts.slice(0, 5)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={140} />
              <Tooltip formatter={(value) => [formatMoney(Number(value), 'USD'), 'CA']} />
              <Bar dataKey="revenue" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </ReportSection>
      </section>

      <section className="sales-report-sections">
        <ReportSection title="Ventes recentes">
          {snapshot.sales.length === 0 ? (
            <p className="empty-state">Aucune vente validee.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table sales-module-table">
                <thead>
                  <tr>
                    <th>N vente</th>
                    <th>Client</th>
                    <th>Type</th>
                    <th>Mode</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.sales.slice(0, 10).map((sale) => (
                    <tr key={sale.saleId}>
                      <td>{sale.saleNumber}</td>
                      <td>{sale.customerName || sale.organizationName || 'Comptoir'}</td>
                      <td><span className={`badge ${sale.saleType === 'INSURANCE' ? 'badge-info' : 'badge-success'}`}>{sale.saleType}</span></td>
                      <td><span className={`badge ${sale.saleMode === 'ADVANCE' ? 'badge-warning' : 'badge-success'}`}>{sale.saleMode === 'ADVANCE' ? 'AVANCE' : 'IMMEDIATE'}</span></td>
                      <td className="numeric-text">{formatMoney(sale.totalAmount, sale.currencyCode ?? 'USD', sale.currencySymbol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportSection>

        <ReportSection title="Alertes et anomalies">
          {snapshot.summary.settlementDifferenceUsd ? (
            <p className="form-error">Des ecarts de reglement sont presents sur la periode.</p>
          ) : (
            <p className="empty-state">Aucune alerte majeure.</p>
          )}
          {snapshot.cashBreakdown.length > 0 && (
            <div className="sales-report-cash-flow">
              {snapshot.cashBreakdown.slice(0, 6).map((item) => (
                <span className="badge badge-muted" key={item.movementType}>{item.movementType}: {item.count} ({formatMoney(item.amount, 'USD')})</span>
              ))}
            </div>
          )}
        </ReportSection>
      </section>
    </>
  );
}

function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card sales-report-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
