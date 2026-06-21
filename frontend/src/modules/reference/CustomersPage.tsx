import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { referenceService } from '../../services/reference.service';

export function CustomersPage() {
  const qc = useQueryClient();
  const [customerCode, setCode] = useState('');
  const [customerName, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerType, setType] = useState('INDIVIDUAL');
  const query = useQuery({ queryKey: ['customers'], queryFn: async () => (await referenceService.customers.getAll()).data });
  const create = useMutation({ mutationFn: referenceService.customers.create, onSuccess: () => { setCode(''); setName(''); setPhone(''); qc.invalidateQueries({ queryKey: ['customers'] }); } });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate({ customerCode, customerName, phone: phone || undefined, customerType }); }
  return <><h1>Clients</h1><form className="card form-grid" onSubmit={submit}><input className="input" placeholder="Code" value={customerCode} onChange={(e)=>setCode(e.target.value)} required/><input className="input" placeholder="Nom" value={customerName} onChange={(e)=>setName(e.target.value)} required/><select className="input" value={customerType} onChange={(e)=>setType(e.target.value)}><option value="INDIVIDUAL">INDIVIDUAL</option><option value="COMPANY">COMPANY</option><option value="HOSPITAL">HOSPITAL</option><option value="NGO">NGO</option><option value="OTHER">OTHER</option></select><input className="input" placeholder="Telephone" value={phone} onChange={(e)=>setPhone(e.target.value)}/><button className="button">Creer</button></form><div className="card">{query.isLoading?'Chargement...':<table className="data-table"><thead><tr><th>Code</th><th>Nom</th><th>Type</th><th>Telephone</th></tr></thead><tbody>{(query.data??[]).map(i=><tr key={i.customerId}><td>{i.customerCode}</td><td>{i.customerName}</td><td>{i.customerType}</td><td>{i.phone||'-'}</td></tr>)}</tbody></table>}</div></>;
}
