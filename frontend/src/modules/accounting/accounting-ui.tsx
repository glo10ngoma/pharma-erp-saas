import { ReactNode } from 'react';
import { fileDateStamp, formatDate } from '../../utils/date';
import { downloadCsv, downloadJson, downloadXlsx } from '../../utils/export';
import { formatMoney } from '../../utils/money';

type Cell = string | number | boolean | null | undefined;

export function financeText(value: unknown) {
  return String(value ?? '').toLowerCase();
}

export function inDateRange(date: string | null | undefined, from: string, to: string) {
  const value = String(date ?? '').slice(0, 10);
  if (!value) return false;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

export function moneyUsd(value: number | string | null | undefined) {
  return formatMoney(value, 'USD');
}

export function balanceBadge(debit: number, credit: number) {
  const diff = Math.abs(Number(debit ?? 0) - Number(credit ?? 0));
  return diff < 0.01
    ? <span className="badge badge-success">Equilibree</span>
    : <span className="badge badge-danger">Desequilibree</span>;
}

export function FinanceKpis({ items }: { items: Array<{ label: string; value: ReactNode; tone?: 'success' | 'warning' | 'danger' }> }) {
  return (
    <div className="finance-kpi-grid">
      {items.map((item) => (
        <div className={`card kpi-card finance-kpi-card ${item.tone ? `finance-kpi-${item.tone}` : ''}`} key={item.label}>
          <span className="kpi-label">{item.label}</span>
          <p className="metric small-metric">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function FinanceExportActions({
  baseName,
  disabled,
  jsonData,
  rows,
  sheetName,
}: {
  baseName: string;
  disabled?: boolean;
  jsonData: unknown;
  rows: Cell[][];
  sheetName: string;
}) {
  const stamp = fileDateStamp();
  return (
    <div className="export-actions finance-export-actions">
      <button className="ghost-button" type="button" disabled={disabled} onClick={() => downloadXlsx(`${baseName}_${stamp}.xlsx`, [{ name: sheetName, rows }])}>Excel</button>
      <button className="ghost-button" type="button" disabled={disabled} onClick={() => downloadCsv(`${baseName}_${stamp}.csv`, rows)}>CSV</button>
      <button className="ghost-button" type="button" disabled={disabled} onClick={() => downloadJson(`${baseName}_${stamp}.json`, jsonData)}>JSON</button>
      <button className="ghost-button" type="button" disabled title="PDF non pret">PDF</button>
    </div>
  );
}

export function sourceLabel(referenceType?: string | null) {
  const value = String(referenceType ?? '').toUpperCase();
  if (value.includes('SALE')) return 'Vente';
  if (value.includes('RECEIVABLE')) return 'Creance';
  if (value.includes('CASH')) return 'Caisse';
  if (value.includes('EXPENSE')) return 'Depense';
  if (value.includes('PURCHASE')) return 'Achat';
  return referenceType || '-';
}

export function runningBalanceLabel(value: number) {
  if (Math.abs(value) < 0.01) return `${moneyUsd(0)} solde nul`;
  return value >= 0 ? `${moneyUsd(value)} debiteur` : `${moneyUsd(Math.abs(value))} crediteur`;
}

export function formatFinanceDate(date: string | null | undefined) {
  return formatDate(date);
}
