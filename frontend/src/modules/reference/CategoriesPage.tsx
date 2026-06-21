import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { codeGeneratorService } from '../../services/codeGenerator.service';
import { referenceService } from '../../services/reference.service';

export function CategoriesPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryCode, setCode] = useState('');
  const [categoryName, setName] = useState('');
  const [description, setDescription] = useState('');
  const query = useQuery({ queryKey: ['categories'], queryFn: async () => (await referenceService.categories.getAll()).data });
  const nextCode = useQuery({ queryKey: ['next-code', 'categories', modalOpen], enabled: modalOpen, queryFn: async () => (await codeGeneratorService.next('categories')).data.code });
  const create = useMutation({ mutationFn: referenceService.categories.create, onSuccess: () => { setCode(''); setName(''); setDescription(''); setModalOpen(false); qc.invalidateQueries({ queryKey: ['categories'] }); } });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate({ categoryCode, categoryName, description: description || undefined }); }
  useEffect(() => { if (modalOpen && !categoryCode && nextCode.data) setCode(nextCode.data); }, [categoryCode, modalOpen, nextCode.data]);
  const rows = filterRows(query.data ?? [], search, (category) => [category.categoryCode, category.categoryName]);
  return <><div className="toolbar"><h1>Categories</h1><button className="button" onClick={() => setModalOpen(true)}>Nouvelle categorie</button></div><Modal title="Nouvelle categorie" open={modalOpen} onClose={() => setModalOpen(false)}><form className="form-grid" onSubmit={submit}><input className="input" placeholder="Code" value={categoryCode} onChange={(e)=>setCode(e.target.value)} required/><input className="input" placeholder="Nom" value={categoryName} onChange={(e)=>setName(e.target.value)} required/><input className="input" placeholder="Description" value={description} onChange={(e)=>setDescription(e.target.value)}/><button className="button" disabled={create.isPending}>Creer</button></form></Modal><div className="card"><SearchBox value={search} onChange={setSearch} placeholder="Rechercher une categorie..." /></div><div className="card">{query.isLoading?<p className="loading-state">Chargement...</p>:rows.length===0?<p className="empty-state">Aucune categorie trouvee.</p>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Nom</th><th>Actif</th></tr></thead><tbody>{rows.map(i=><tr key={i.categoryId}><td>{i.categoryCode}</td><td>{i.categoryName}</td><td><span className={`badge ${i.isActive?'badge-success':'badge-muted'}`}>{i.isActive?'Actif':'Inactif'}</span></td></tr>)}</tbody></table></div>}</div></>;
}
