import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { codeGeneratorService } from '../../services/codeGenerator.service';
import { referenceService } from '../../services/reference.service';

export function SubCategoriesPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryCode, setCode] = useState('');
  const [subCategoryName, setName] = useState('');
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await referenceService.categories.getAll()).data });
  const query = useQuery({ queryKey: ['sub-categories'], queryFn: async () => (await referenceService.subCategories.getAll()).data });
  const nextCode = useQuery({ queryKey: ['next-code', 'sub_categories', modalOpen], enabled: modalOpen, queryFn: async () => (await codeGeneratorService.next('sub_categories')).data.code });
  const create = useMutation({ mutationFn: referenceService.subCategories.create, onSuccess: () => { setCode(''); setName(''); setModalOpen(false); qc.invalidateQueries({ queryKey: ['sub-categories'] }); } });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate({ categoryId, subCategoryCode, subCategoryName }); }
  useEffect(() => { if (modalOpen && !subCategoryCode && nextCode.data) setCode(nextCode.data); }, [modalOpen, nextCode.data, subCategoryCode]);
  const rows = filterRows(query.data ?? [], search, (row) => [row.subCategoryCode, row.subCategoryName, row.categoryName]);
  return <><div className="toolbar"><h1>SubCategories</h1><button className="button" onClick={() => setModalOpen(true)}>Nouvelle sous-categorie</button></div><Modal title="Nouvelle sous-categorie" open={modalOpen} onClose={() => setModalOpen(false)}><form className="form-grid" onSubmit={submit}><select className="input" value={categoryId} onChange={(e)=>setCategoryId(e.target.value)} required><option value="">Categorie</option>{(categories.data??[]).map(c=><option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>)}</select><input className="input" placeholder="Code" value={subCategoryCode} onChange={(e)=>setCode(e.target.value)} required/><input className="input" placeholder="Nom" value={subCategoryName} onChange={(e)=>setName(e.target.value)} required/><button className="button" disabled={create.isPending}>Creer</button></form></Modal><div className="card"><SearchBox value={search} onChange={setSearch} /></div><div className="card">{query.isLoading?<p className="loading-state">Chargement...</p>:rows.length===0?<p className="empty-state">Aucune sous-categorie trouvee.</p>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Nom</th><th>Categorie</th></tr></thead><tbody>{rows.map(i=><tr key={i.subCategoryId}><td>{i.subCategoryCode}</td><td>{i.subCategoryName}</td><td>{i.categoryName}</td></tr>)}</tbody></table></div>}</div></>;
}
