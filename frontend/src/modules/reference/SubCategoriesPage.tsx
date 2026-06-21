import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { referenceService } from '../../services/reference.service';

export function SubCategoriesPage() {
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryCode, setCode] = useState('');
  const [subCategoryName, setName] = useState('');
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await referenceService.categories.getAll()).data });
  const query = useQuery({ queryKey: ['sub-categories'], queryFn: async () => (await referenceService.subCategories.getAll()).data });
  const create = useMutation({ mutationFn: referenceService.subCategories.create, onSuccess: () => { setCode(''); setName(''); qc.invalidateQueries({ queryKey: ['sub-categories'] }); } });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate({ categoryId, subCategoryCode, subCategoryName }); }
  return <><h1>SubCategories</h1><form className="card form-grid" onSubmit={submit}><select className="input" value={categoryId} onChange={(e)=>setCategoryId(e.target.value)} required><option value="">Categorie</option>{(categories.data??[]).map(c=><option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>)}</select><input className="input" placeholder="Code" value={subCategoryCode} onChange={(e)=>setCode(e.target.value)} required/><input className="input" placeholder="Nom" value={subCategoryName} onChange={(e)=>setName(e.target.value)} required/><button className="button">Creer</button></form><div className="card">{query.isLoading?'Chargement...':<table className="data-table"><thead><tr><th>Code</th><th>Nom</th><th>Categorie</th></tr></thead><tbody>{(query.data??[]).map(i=><tr key={i.subCategoryId}><td>{i.subCategoryCode}</td><td>{i.subCategoryName}</td><td>{i.categoryName}</td></tr>)}</tbody></table>}</div></>;
}
