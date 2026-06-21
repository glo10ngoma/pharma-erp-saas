import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../../services/apiError';
import { accountingService } from '../../services/accounting.service';

export function AccountsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ accountCode: '', accountName: '', accountType: 'ASSET' });
  const query = useQuery({ queryKey: ['accounting-accounts'], queryFn: async () => (await accountingService.getAccounts()).data });
  const create = useMutation({ mutationFn: () => accountingService.createAccount(form), onSuccess: () => { setForm({ accountCode: '', accountName: '', accountType: 'ASSET' }); qc.invalidateQueries({ queryKey: ['accounting-accounts'] }); } });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); create.mutate(); }
  const rows = query.data ?? [];
  return <><h1>Plan comptable</h1>{create.isError && <p className="form-error">{apiErrorMessage(create.error)}</p>}<form className="card form-grid" onSubmit={submit}><input className="input" placeholder="Code" value={form.accountCode} onChange={(e)=>setForm({...form, accountCode:e.target.value})} required /><input className="input" placeholder="Nom du compte" value={form.accountName} onChange={(e)=>setForm({...form, accountName:e.target.value})} required /><select className="input" value={form.accountType} onChange={(e)=>setForm({...form, accountType:e.target.value})}><option value="ASSET">Actif</option><option value="LIABILITY">Passif</option><option value="EQUITY">Capitaux</option><option value="REVENUE">Produit</option><option value="EXPENSE">Charge</option></select><button className="button" disabled={create.isPending}>Creer compte</button></form><div className="card">{query.isLoading ? 'Chargement...' : rows.length===0 ? <p>Aucun compte.</p> : <table className="data-table"><thead><tr><th>Code</th><th>Compte</th><th>Type</th><th>Actif</th></tr></thead><tbody>{rows.map((row)=><tr key={row.accountId}><td>{row.accountCode}</td><td>{row.accountName}</td><td>{row.accountType}</td><td>{row.isActive ? 'Oui' : 'Non'}</td></tr>)}</tbody></table>}</div></>;
}
