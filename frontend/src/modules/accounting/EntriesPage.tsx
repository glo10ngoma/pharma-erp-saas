import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../../services/apiError';
import { accountingService } from '../../services/accounting.service';
import { formatMoney } from '../../utils/money';

export function EntriesPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['accounting-entries'], queryFn: async () => (await accountingService.getEntries()).data });
  const post = useMutation({ mutationFn: (id: string) => accountingService.postEntry(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting-entries'] }) });
  const rows = query.data ?? [];
  return <><h1>Ecritures</h1>{post.isError && <p className="form-error">{apiErrorMessage(post.error)}</p>}<div className="card">{query.isLoading ? 'Chargement...' : rows.length===0 ? <p>Aucune ecriture.</p> : <table className="data-table"><thead><tr><th>Date</th><th>Journal</th><th>Numero</th><th>Reference</th><th>Debit USD</th><th>Credit USD</th><th>Statut</th><th></th></tr></thead><tbody>{rows.map((row)=><tr key={row.entryId}><td>{row.entryDate}</td><td>{row.journalCode}</td><td>{row.entryNumber}</td><td>{row.referenceType ?? ''}</td><td>{formatMoney(row.totalDebit, 'USD')}</td><td>{formatMoney(row.totalCredit, 'USD')}</td><td>{row.status}</td><td>{row.status === 'DRAFT' && <button className="ghost-button" onClick={()=>post.mutate(row.entryId)}>Poster</button>}</td></tr>)}</tbody></table>}</div></>;
}
