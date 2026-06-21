import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountingService } from '../../services/accounting.service';

export function GeneralLedgerPage() {
  const [accountCode, setAccountCode] = useState('');
  const query = useQuery({ queryKey: ['accounting-general-ledger', accountCode], queryFn: async () => (await accountingService.getGeneralLedger(accountCode || undefined)).data });
  const rows = query.data ?? [];
  return <><h1>Grand livre</h1><div className="card form-grid"><input className="input" placeholder="Filtrer par compte" value={accountCode} onChange={(e)=>setAccountCode(e.target.value)} /></div><div className="card">{query.isLoading ? 'Chargement...' : rows.length===0 ? <p>Aucun mouvement.</p> : <table className="data-table"><thead><tr><th>Date</th><th>Compte</th><th>Ecriture</th><th>Reference</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{rows.map((row, index)=><tr key={`${row.entryNumber}-${row.accountCode}-${index}`}><td>{row.entryDate}</td><td>{row.accountCode} - {row.accountName}</td><td>{row.entryNumber}</td><td>{row.referenceType ?? ''}</td><td>{row.debit.toFixed(2)}</td><td>{row.credit.toFixed(2)}</td></tr>)}</tbody></table>}</div></>;
}
