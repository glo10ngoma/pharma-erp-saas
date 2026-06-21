import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiErrorMessage } from '../../services/apiError';
import { inventoriesService } from '../../services/inventories.service';
import { sitesService } from '../../services/sites.service';

export function InventoriesPage() {
  const qc = useQueryClient();
  const [siteId, setSiteId] = useState('');
  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const query = useQuery({ queryKey: ['inventories'], queryFn: async () => (await inventoriesService.getAll()).data });
  const create = useMutation({ mutationFn: () => inventoriesService.create({ siteId, inventoryType: 'FULL' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['inventories'] }) });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); create.mutate(); }
  const rows = query.data ?? [];
  return <><h1>Inventaires</h1>{create.isError && <p className="form-error">{apiErrorMessage(create.error)}</p>}<form className="card form-grid" onSubmit={submit}><select className="input" value={siteId} onChange={(e)=>setSiteId(e.target.value)} required><option value="">Site</option>{(sites.data??[]).map(s=><option key={s.siteId} value={s.siteId}>{s.siteName}</option>)}</select><button className="button" disabled={create.isPending}>Creer inventaire</button></form><div className="card">{query.isLoading ? 'Chargement...' : rows.length===0 ? <p>Aucun inventaire.</p> : <table className="data-table"><thead><tr><th>Numero</th><th>Site</th><th>Date</th><th>Statut</th></tr></thead><tbody>{rows.map(inv=><tr key={inv.inventoryId}><td><Link to={`/inventories/${inv.inventoryId}`}>{inv.inventoryNumber}</Link></td><td>{inv.siteName}</td><td>{inv.inventoryDate}</td><td>{inv.status}</td></tr>)}</tbody></table>}</div></>;
}
