import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../../services/apiError';
import { accountingService } from '../../services/accounting.service';

export function JournalsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ journalCode: '', journalName: '', journalType: 'GENERAL' });
  const query = useQuery({ queryKey: ['accounting-journals'], queryFn: async () => (await accountingService.getJournals()).data });
  const create = useMutation({ mutationFn: () => accountingService.createJournal(form), onSuccess: () => { setForm({ journalCode: '', journalName: '', journalType: 'GENERAL' }); qc.invalidateQueries({ queryKey: ['accounting-journals'] }); } });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); create.mutate(); }
  const rows = query.data ?? [];
  return <><h1>Journaux</h1>{create.isError && <p className="form-error">{apiErrorMessage(create.error)}</p>}<form className="card form-grid" onSubmit={submit}><input className="input" placeholder="Code" value={form.journalCode} onChange={(e)=>setForm({...form, journalCode:e.target.value})} required /><input className="input" placeholder="Nom du journal" value={form.journalName} onChange={(e)=>setForm({...form, journalName:e.target.value})} required /><select className="input" value={form.journalType} onChange={(e)=>setForm({...form, journalType:e.target.value})}><option value="SALES">Ventes</option><option value="PURCHASES">Achats</option><option value="CASH">Caisse</option><option value="BANK">Banque</option><option value="GENERAL">OD</option><option value="INVENTORY">Stock</option></select><button className="button" disabled={create.isPending}>Creer journal</button></form><div className="card">{query.isLoading ? 'Chargement...' : rows.length===0 ? <p>Aucun journal.</p> : <table className="data-table"><thead><tr><th>Code</th><th>Journal</th><th>Type</th><th>Actif</th></tr></thead><tbody>{rows.map((row)=><tr key={row.journalId}><td>{row.journalCode}</td><td>{row.journalName}</td><td>{row.journalType}</td><td>{row.isActive ? 'Oui' : 'Non'}</td></tr>)}</tbody></table>}</div></>;
}
