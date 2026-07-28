import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CashMovement } from '../../services/cash.service';
import { formatMoney } from '../../utils/money';

export function CashDashboardCharts({ movements }: { movements: CashMovement[] }) {
  const hourly = buildHourlyNet(movements);
  const categories = buildCategoryRows(movements);

  return (
    <div className="cash-chart-grid">
      <div className="card cash-chart-card">
        <h3>Encaissements nets par heure</h3>
        <p className="muted-text">Lecture distincte des encaissements USD et CDF sur la session.</p>
        {hourly.length === 0 ? (
          <p className="empty-state">Aucune donnee disponible pour cette session.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={hourly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip formatter={(value: number, key: string) => formatMoney(Number(value), key === 'cdf' ? 'CDF' : 'USD')} />
              <Legend />
              <Line type="monotone" dataKey="usd" name="Net USD" stroke="#0f766e" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="cdf" name="Net CDF" stroke="#2563eb" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card cash-chart-card">
        <h3>Repartition des mouvements</h3>
        <p className="muted-text">Paiements, monnaie rendue, depenses, entrees, sorties et ajustements utiles.</p>
        {categories.length === 0 ? (
          <p className="empty-state">Aucune donnee disponible pour cette session.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={categories}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number, key: string) => formatMoney(Number(value), key === 'cdf' ? 'CDF' : 'USD')} />
              <Legend />
              <Bar dataKey="usd" name="USD" fill="#0f766e" radius={[6, 6, 0, 0]} />
              <Bar dataKey="cdf" name="CDF" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function buildHourlyNet(rows: CashMovement[]) {
  const map = new Map<string, { hour: string; usd: number; cdf: number }>();
  for (const row of rows) {
    const date = new Date(row.movementDate);
    if (Number.isNaN(date.getTime())) continue;
    const hour = `${String(date.getHours()).padStart(2, '0')}:00`;
    if (!map.has(hour)) map.set(hour, { hour, usd: 0, cdf: 0 });
    const target = map.get(hour)!;
    const currency = row.currencyCode ?? 'USD';
    const signedAmount = signedMovementAmount(row);
    if (currency === 'CDF') target.cdf += signedAmount;
    else target.usd += signedAmount;
  }
  return Array.from(map.values()).sort((left, right) => left.hour.localeCompare(right.hour));
}

function buildCategoryRows(rows: CashMovement[]) {
  const map = new Map<string, { name: string; usd: number; cdf: number }>();
  for (const row of rows) {
    const key = chartCategory(row.movementType);
    if (!map.has(key)) map.set(key, { name: key, usd: 0, cdf: 0 });
    const target = map.get(key)!;
    const amount = Math.abs(Number(row.amount || 0));
    if ((row.currencyCode ?? 'USD') === 'CDF') target.cdf += amount;
    else target.usd += amount;
  }
  return Array.from(map.values()).filter((row) => row.usd !== 0 || row.cdf !== 0);
}

function signedMovementAmount(row: CashMovement) {
  const amount = Number(row.amount || 0);
  if (['SALE_PAYMENT', 'CASH_IN', 'RECEIVABLE_PAYMENT', 'ADVANCE', 'OPENING_BALANCE'].includes(row.movementType)) return amount;
  if (['SALE_CHANGE', 'EXPENSE', 'CASH_OUT', 'BANK_DEPOSIT'].includes(row.movementType)) return -amount;
  return amount;
}

function chartCategory(type: string) {
  if (type === 'SALE_PAYMENT') return 'Paiements ventes';
  if (type === 'SALE_CHANGE') return 'Monnaie rendue';
  if (type === 'EXPENSE') return 'Depenses';
  if (['CASH_IN', 'RECEIVABLE_PAYMENT', 'ADVANCE', 'OPENING_BALANCE'].includes(type)) return 'Entrees manuelles';
  if (['CASH_OUT', 'BANK_DEPOSIT'].includes(type)) return 'Sorties manuelles';
  if (type === 'ADJUSTMENT') return 'Ajustements';
  return type;
}
