import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountingService } from '../../services/accounting.service';
import { formatDate } from '../../utils/date';
import { FinanceExportActions, FinanceKpis, financeText, inDateRange, moneyUsd, runningBalanceLabel, sourceLabel } from './accounting-ui';

export function GeneralLedgerPage() {
  const [accountCode, setAccountCode] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const accounts = useQuery({ queryKey: ['accounting-accounts'], queryFn: async () => (await accountingService.getAccounts()).data });
  const query = useQuery({ queryKey: ['accounting-general-ledger', accountCode], queryFn: async () => (await accountingService.getGeneralLedger(accountCode || undefined)).data });
  const rows = query.data ?? [];
  const filteredRows = useMemo(() => rows.filter((row) => {
    const haystack = [row.accountCode, row.accountName, row.entryNumber, row.description, row.referenceType].map(financeText).join(' ');
    if (search.trim() && !haystack.includes(search.trim().toLowerCase())) return false;
    if ((from || to) && !inDateRange(row.entryDate, from, to)) return false;
    return true;
  }), [from, rows, search, to]);
  const ledgerRows = useMemo(() => {
    let balance = 0;
    return filteredRows.map((row) => {
      balance += Number(row.debit ?? 0) - Number(row.credit ?? 0);
      return { ...row, balance };
    });
  }, [filteredRows]);
  const totals = useMemo(() => ({
    debit: filteredRows.reduce((sum, row) => sum + Number(row.debit ?? 0), 0),
    credit: filteredRows.reduce((sum, row) => sum + Number(row.credit ?? 0), 0),
  }), [filteredRows]);
  const exportRows = [
    ['Date', 'Journal', 'Piece', 'Compte', 'Libelle', 'Source', 'Debit USD', 'Credit USD', 'Solde'],
    ...ledgerRows.map((row) => [formatDate(row.entryDate), row.referenceType ?? '-', row.entryNumber, `${row.accountCode} - ${row.accountName}`, row.description ?? '-', sourceLabel(row.referenceType), moneyUsd(row.debit), moneyUsd(row.credit), runningBalanceLabel(row.balance)]),
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Grand livre</h1>
          <p className="muted">Mouvements comptables en USD, avec solde courant debiteur/crediteur.</p>
        </div>
        <FinanceExportActions baseName="grand_livre" sheetName="Grand livre" rows={exportRows} jsonData={ledgerRows} disabled={ledgerRows.length === 0} />
      </div>
      <FinanceKpis items={[
        { label: 'Total debit', value: moneyUsd(totals.debit) },
        { label: 'Total credit', value: moneyUsd(totals.credit) },
        { label: 'Solde final', value: runningBalanceLabel(totals.debit - totals.credit), tone: Math.abs(totals.debit - totals.credit) < 0.01 ? 'success' : undefined },
      ]} />
      <div className="card finance-filters finance-filters-wide">
        <select className="input compact-input" value={accountCode} onChange={(event) => setAccountCode(event.target.value)}>
          <option value="">Tous comptes</option>
          {(accounts.data ?? []).map((account) => <option key={account.accountId} value={account.accountCode}>{account.accountCode} - {account.accountName}</option>)}
        </select>
        <input className="input compact-input" placeholder="Rechercher piece, libelle, source..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <input className="input compact-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input className="input compact-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      <div className="card table-card">
        {query.isLoading ? 'Chargement...' : ledgerRows.length === 0 ? <p className="empty-state">Aucun mouvement trouve. Selectionnez un compte ou elargissez la periode.</p> : (
          <div className="table-wrap finance-table-wrap">
            <table className="data-table finance-table">
              <thead><tr><th>Date</th><th>Journal</th><th>Piece</th><th>Compte</th><th>Libelle</th><th>Debit</th><th>Credit</th><th>Solde</th></tr></thead>
              <tbody>{ledgerRows.map((row, index) => <tr key={`${row.entryNumber}-${row.accountCode}-${index}`}><td>{formatDate(row.entryDate)}</td><td>{sourceLabel(row.referenceType)}</td><td><strong>{row.entryNumber}</strong></td><td>{row.accountCode} - {row.accountName}</td><td>{row.description ?? '-'}</td><td className="numeric-text">{moneyUsd(row.debit)}</td><td className="numeric-text">{moneyUsd(row.credit)}</td><td className="numeric-text"><strong>{runningBalanceLabel(row.balance)}</strong></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
