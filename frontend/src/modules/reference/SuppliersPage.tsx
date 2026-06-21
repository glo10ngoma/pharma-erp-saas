import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { referenceService } from '../../services/reference.service';

export function SuppliersPage() {
  const qc = useQueryClient();
  const [supplierCode, setCode] = useState('');
  const [supplierName, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const query = useQuery({ queryKey: ['suppliers'], queryFn: async () => (await referenceService.suppliers.getAll()).data });
  const create = useMutation({ mutationFn: referenceService.suppliers.create, onSuccess: () => { setCode(''); setName(''); setPhone(''); setEmail(''); qc.invalidateQueries({ queryKey: ['suppliers'] }); } });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate({ supplierCode, supplierName, phone: phone || undefined, email: email || undefined }); }
  return <><h1>Fournisseurs</h1><form className="card form-grid" onSubmit={submit}><input className="input" placeholder="Code" value={supplierCode} onChange={(e)=>setCode(e.target.value)} required/><input className="input" placeholder="Nom" value={supplierName} onChange={(e)=>setName(e.target.value)} required/><input className="input" placeholder="Telephone" value={phone} onChange={(e)=>setPhone(e.target.value)}/><input className="input" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)}/><button className="button">Creer</button></form><div className="card">{query.isLoading?'Chargement...':<table className="data-table"><thead><tr><th>Code</th><th>Nom</th><th>Telephone</th><th>Email</th></tr></thead><tbody>{(query.data??[]).map(i=><tr key={i.supplierId}><td>{i.supplierCode}</td><td>{i.supplierName}</td><td>{i.phone||'-'}</td><td>{i.email||'-'}</td></tr>)}</tbody></table>}</div></>;
}
