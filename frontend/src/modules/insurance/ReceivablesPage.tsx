import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../../services/apiError';
import { insuranceService } from '../../services/insurance.service';
import { formatMoney } from '../../utils/money';

export function ReceivablesPage() {
  const qc = useQueryClient();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ['receivables'], queryFn: async () => (await insuranceService.receivables.getAll()).data });
  const pay = useMutation({ mutationFn: ({ id, amount }: { id: string; amount: number }) => insuranceService.receivables.pay(id, { amount }), onSuccess: () => qc.invalidateQueries({ queryKey: ['receivables'] }) });
  const rows = query.data ?? [];
  return <><h1>Creances</h1>{pay.isError && <p className="form-error">{apiErrorMessage(pay.error)}</p>}<div className="card">{query.isLoading?'Chargement...':rows.length===0?<p>Aucune creance.</p>:<table className="data-table"><thead><tr><th>Type</th><th>Client</th><th>Organisation</th><th>Du</th><th>Paye</th><th>Solde</th><th>Statut</th><th>Paiement</th></tr></thead><tbody>{rows.map(r=><tr key={r.receivableId}><td>{r.receivableType}</td><td>{r.customerName}</td><td>{r.organizationName}</td><td>{formatMoney(r.amountDue, r.currencyCode ?? 'USD', r.currencySymbol)}</td><td>{formatMoney(r.amountPaid, r.currencyCode ?? 'USD', r.currencySymbol)}</td><td>{formatMoney(r.balance, r.currencyCode ?? 'USD', r.currencySymbol)}</td><td>{r.status}</td><td>{r.status!=='PAID' && <><input className="input" style={{ maxWidth: 120 }} type="number" min="0.01" step="0.01" value={amounts[r.receivableId] ?? r.balance} onChange={(e)=>setAmounts({...amounts,[r.receivableId]:e.target.value})}/><button className="button" disabled={pay.isPending} onClick={()=>pay.mutate({ id: r.receivableId, amount: Number(amounts[r.receivableId] ?? r.balance) })}>Payer</button></>}</td></tr>)}</tbody></table>}</div></>;
}
