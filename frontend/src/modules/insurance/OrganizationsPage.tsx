import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../../services/apiError';
import { insuranceService } from '../../services/insurance.service';

export function OrganizationsPage() {
  const qc = useQueryClient();
  const [organizationCode, setCode] = useState('');
  const [organizationName, setName] = useState('');
  const [organizationType, setType] = useState('INSURANCE');
  const query = useQuery({ queryKey: ['organizations'], queryFn: async () => (await insuranceService.organizations.getAll()).data });
  const create = useMutation({ mutationFn: insuranceService.organizations.create, onSuccess: () => { setCode(''); setName(''); qc.invalidateQueries({ queryKey: ['organizations'] }); } });
  const disable = useMutation({ mutationFn: insuranceService.organizations.disable, onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }) });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate({ organizationCode, organizationName, organizationType }); }
  const rows = query.data ?? [];
  return <><h1>Organizations</h1>{create.isError && <p className="form-error">{apiErrorMessage(create.error)}</p>}<form className="card form-grid" onSubmit={submit}><input className="input" placeholder="Code" value={organizationCode} onChange={(e)=>setCode(e.target.value)} required/><input className="input" placeholder="Nom" value={organizationName} onChange={(e)=>setName(e.target.value)} required/><select className="input" value={organizationType} onChange={(e)=>setType(e.target.value)}><option value="INSURANCE">INSURANCE</option><option value="COMPANY">COMPANY</option><option value="NGO">NGO</option><option value="HOSPITAL">HOSPITAL</option><option value="OTHER">OTHER</option></select><button className="button" disabled={create.isPending}>Creer</button></form><div className="card">{query.isLoading?'Chargement...':rows.length===0?<p>Aucune organisation.</p>:<table className="data-table"><thead><tr><th>Code</th><th>Nom</th><th>Type</th><th>Actif</th><th></th></tr></thead><tbody>{rows.map(o=><tr key={o.organizationId}><td>{o.organizationCode}</td><td>{o.organizationName}</td><td>{o.organizationType}</td><td>{o.isActive?'Oui':'Non'}</td><td>{o.isActive && <button className="button" onClick={()=>disable.mutate(o.organizationId)}>Desactiver</button>}</td></tr>)}</tbody></table>}</div></>;
}
