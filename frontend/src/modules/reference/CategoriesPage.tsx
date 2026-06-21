import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { referenceService } from '../../services/reference.service';

export function CategoriesPage() {
  const qc = useQueryClient();
  const [categoryCode, setCode] = useState('');
  const [categoryName, setName] = useState('');
  const [description, setDescription] = useState('');
  const query = useQuery({ queryKey: ['categories'], queryFn: async () => (await referenceService.categories.getAll()).data });
  const create = useMutation({ mutationFn: referenceService.categories.create, onSuccess: () => { setCode(''); setName(''); setDescription(''); qc.invalidateQueries({ queryKey: ['categories'] }); } });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate({ categoryCode, categoryName, description: description || undefined }); }
  return <><h1>Categories</h1><form className="card form-grid" onSubmit={submit}><input className="input" placeholder="Code" value={categoryCode} onChange={(e)=>setCode(e.target.value)} required/><input className="input" placeholder="Nom" value={categoryName} onChange={(e)=>setName(e.target.value)} required/><input className="input" placeholder="Description" value={description} onChange={(e)=>setDescription(e.target.value)}/><button className="button">Creer</button></form><div className="card">{query.isLoading?'Chargement...':<table className="data-table"><thead><tr><th>Code</th><th>Nom</th><th>Actif</th></tr></thead><tbody>{(query.data??[]).map(i=><tr key={i.categoryId}><td>{i.categoryCode}</td><td>{i.categoryName}</td><td>{i.isActive?'Oui':'Non'}</td></tr>)}</tbody></table>}</div></>;
}
