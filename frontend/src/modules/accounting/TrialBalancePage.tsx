import { useQuery } from '@tanstack/react-query';
import { accountingService } from '../../services/accounting.service';

export function TrialBalancePage() {
  const query = useQuery({ queryKey: ['accounting-trial-balance'], queryFn: async () => (await accountingService.getTrialBalance()).data });
  const rows = query.data ?? [];
  const debit = rows.reduce((sum, row) => sum + row.debit, 0);
  const credit = rows.reduce((sum, row) => sum + row.credit, 0);
  return <><h1>Balance</h1><div className="card"><p>Total debit: {debit.toFixed(2)} | Total credit: {credit.toFixed(2)}</p>{query.isLoading ? 'Chargement...' : rows.length===0 ? <p>Aucune ligne.</p> : <table className="data-table"><thead><tr><th>Code</th><th>Compte</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{rows.map((row)=><tr key={row.accountCode}><td>{row.accountCode}</td><td>{row.accountName}</td><td>{row.debit.toFixed(2)}</td><td>{row.credit.toFixed(2)}</td></tr>)}</tbody></table>}</div></>;
}
