import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { apiErrorMessage } from '../../services/apiError';
import { inventoriesService } from '../../services/inventories.service';
import { sitesService } from '../../services/sites.service';

export function InventoriesPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [siteId, setSiteId] = useState('');
  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const query = useQuery({ queryKey: ['inventories'], queryFn: async () => (await inventoriesService.getAll()).data });
  const create = useMutation({ mutationFn: () => inventoriesService.create({ siteId, inventoryType: 'FULL' }), onSuccess: () => { setModalOpen(false); qc.invalidateQueries({ queryKey: ['inventories'] }); } });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); create.mutate(); }
  const rows = filterRows(query.data ?? [], search, (row) => [row.inventoryNumber, row.siteName, row.inventoryDate, row.status]);
  return <><div className="toolbar"><h1>Inventaires</h1><button className="button" onClick={() => setModalOpen(true)}>Nouvel inventaire</button></div>{create.isError && <p className="form-error">{apiErrorMessage(create.error)}</p>}<Modal title="Nouvel inventaire" open={modalOpen} onClose={() => setModalOpen(false)}><form className="form-grid" onSubmit={submit}><select className="input" value={siteId} onChange={(e)=>setSiteId(e.target.value)} required><option value="">Site</option>{(sites.data??[]).map(s=><option key={s.siteId} value={s.siteId}>{s.siteName}</option>)}</select><button className="button" disabled={create.isPending}>Creer inventaire</button></form></Modal><div className="card"><SearchBox value={search} onChange={setSearch} /></div><div className="card">{query.isLoading ? <p className="loading-state">Chargement...</p> : rows.length===0 ? <p className="empty-state">Aucun inventaire trouve.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Numero</th><th>Site</th><th>Date</th><th>Statut</th></tr></thead><tbody>{rows.map(inv=><tr key={inv.inventoryId}><td><Link to={`/inventories/${inv.inventoryId}`}>{inv.inventoryNumber}</Link></td><td>{inv.siteName}</td><td>{inv.inventoryDate}</td><td><span className={`badge ${inv.status === 'VALIDATED' ? 'badge-success' : inv.status === 'DRAFT' ? 'badge-warning' : 'badge-info'}`}>{inv.status}</span></td></tr>)}</tbody></table></div>}</div></>;
}
