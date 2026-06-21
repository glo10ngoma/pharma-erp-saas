import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../../services/apiError';
import { insuranceService } from '../../services/insurance.service';

export function InsurancePlansPage() {
  const qc = useQueryClient();
  const [organizationId, setOrganizationId] = useState('');
  const [planCode, setCode] = useState('');
  const [planName, setName] = useState('');
  const [coveragePercent, setCoverage] = useState('80');
  const organizations = useQuery({ queryKey: ['organizations'], queryFn: async () => (await insuranceService.organizations.getAll()).data });
  const plans = useQuery({ queryKey: ['insurance-plans'], queryFn: async () => (await insuranceService.plans.getAll()).data });
  const create = useMutation({ mutationFn: insuranceService.plans.create, onSuccess: () => { setCode(''); setName(''); qc.invalidateQueries({ queryKey: ['insurance-plans'] }); } });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate({ organizationId, planCode, planName, coveragePercent: Number(coveragePercent) }); }
  const rows = plans.data ?? [];
  return <><h1>Insurance Plans</h1>{create.isError && <p className="form-error">{apiErrorMessage(create.error)}</p>}<form className="card form-grid" onSubmit={submit}><select className="input" value={organizationId} onChange={(e)=>setOrganizationId(e.target.value)} required><option value="">Organisation</option>{(organizations.data??[]).filter(o=>o.isActive).map(o=><option key={o.organizationId} value={o.organizationId}>{o.organizationName}</option>)}</select><input className="input" placeholder="Code" value={planCode} onChange={(e)=>setCode(e.target.value)} required/><input className="input" placeholder="Nom" value={planName} onChange={(e)=>setName(e.target.value)} required/><input className="input" type="number" min="0" max="100" value={coveragePercent} onChange={(e)=>setCoverage(e.target.value)} required/><button className="button" disabled={create.isPending}>Creer</button></form><div className="card">{plans.isLoading?'Chargement...':rows.length===0?<p>Aucun plan.</p>:<table className="data-table"><thead><tr><th>Organisation</th><th>Code</th><th>Nom</th><th>Couverture</th><th>Actif</th></tr></thead><tbody>{rows.map(p=><tr key={p.planId}><td>{p.organizationName}</td><td>{p.planCode}</td><td>{p.planName}</td><td>{p.coveragePercent}%</td><td>{p.isActive?'Oui':'Non'}</td></tr>)}</tbody></table>}</div></>;
}
