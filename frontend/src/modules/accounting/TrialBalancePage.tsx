import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountingService } from '../../services/accounting.service';
import { balanceBadge, FinanceExportActions, FinanceKpis, financeText, moneyUsd } from './accounting-ui';

export function TrialBalancePage() {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const query = useQuery({ queryKey: ['accounting-trial-balance'], queryFn: async () => (await accountingService.getTrialBalance()).data });
  const rows = query.data ?? [];
  const filteredRows = useMemo(() => rows.filter((row) => {
    const haystack = [row.accountCode, row.accountName].map(financeText).join(' ');
    return !search.trim() || haystack.includes(search.trim().toLowerCase());
  }), [rows, search]);
  const totals = useMemo(() => filteredRows.reduce((acc, row) => {
    acc.debit += Number(row.debit ?? 0);
    acc.credit += Number(row.credit ?? 0);
    return acc;
  }, { debit: 0, credit: 0 }), [filteredRows]);
  const exportRows = [
    ['Code compte', 'Nom compte', 'Debit USD', 'Credit USD', 'Solde debiteur', 'Solde crediteur'],
    ...filteredRows.map((row) => {
      const balance = Number(row.debit ?? 0) - Number(row.credit ?? 0);
      return [row.accountCode, row.accountName, moneyUsd(row.debit), moneyUsd(row.credit), moneyUsd(Math.max(balance, 0)), moneyUsd(Math.max(-balance, 0))];
    }),
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Balance</h1>
          <p className="muted">Devise comptable : USD. Les filtres periode sont prepares pour l'analyse V1.1.</p>
        </div>
        <FinanceExportActions baseName="balance" sheetName="Balance" rows={exportRows} jsonData={filteredRows} disabled={filteredRows.length === 0} />
      </div>
      <FinanceKpis items={[
        { label: 'Total debit', value: moneyUsd(totals.debit) },
        { label: 'Total credit', value: moneyUsd(totals.credit) },
        { label: 'Ecart', value: moneyUsd(Math.abs(totals.debit - totals.credit)), tone: Math.abs(totals.debit - totals.credit) < 0.01 ? 'success' : 'danger' },
        { label: 'Controle', value: balanceBadge(totals.debit, totals.credit), tone: Math.abs(totals.debit - totals.credit) < 0.01 ? 'success' : 'danger' },
      ]} />
      <div className="card finance-filters finance-filters-wide">
        <input className="input compact-input" placeholder="Rechercher compte..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <input className="input compact-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input className="input compact-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <span className="muted finance-filter-note">Periode visuelle : l'endpoint V1 retourne la balance courante.</span>
      </div>
      <div className="card table-card">
        {query.isLoading ? 'Chargement...' : filteredRows.length === 0 ? <p className="empty-state">Aucune ligne de balance.</p> : (
          <div className="table-wrap finance-table-wrap">
            <table className="data-table finance-table">
              <thead><tr><th>Code compte</th><th>Nom compte</th><th>Debit</th><th>Credit</th><th>Solde debiteur</th><th>Solde crediteur</th></tr></thead>
              <tbody>{filteredRows.map((row) => {
                const balance = Number(row.debit ?? 0) - Number(row.credit ?? 0);
                return <tr key={row.accountCode}><td><strong>{row.accountCode}</strong></td><td>{row.accountName}</td><td className="numeric-text">{moneyUsd(row.debit)}</td><td className="numeric-text">{moneyUsd(row.credit)}</td><td className="numeric-text">{moneyUsd(Math.max(balance, 0))}</td><td className="numeric-text">{moneyUsd(Math.max(-balance, 0))}</td></tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
