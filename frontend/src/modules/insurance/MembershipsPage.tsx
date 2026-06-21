import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../../services/apiError';
import { insuranceService } from '../../services/insurance.service';
import { referenceService } from '../../services/reference.service';

export function MembershipsPage() {
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [planId, setPlanId] = useState('');
  const [memberNumber, setMemberNumber] = useState('');
  const customers = useQuery({ queryKey: ['customers'], queryFn: async () => (await referenceService.customers.getAll()).data });
  const organizations = useQuery({ queryKey: ['organizations'], queryFn: async () => (await insuranceService.organizations.getAll()).data });
  const plans = useQuery({ queryKey: ['insurance-plans'], queryFn: async () => (await insuranceService.plans.getAll()).data });
  const memberships = useQuery({ queryKey: ['memberships'], queryFn: async () => (await insuranceService.memberships.getAll()).data });
  const availablePlans = useMemo(() => (plans.data ?? []).filter((p) => p.organizationId === organizationId && p.isActive), [organizationId, plans.data]);
  const create = useMutation({ mutationFn: insuranceService.memberships.create, onSuccess: () => { setMemberNumber(''); qc.invalidateQueries({ queryKey: ['memberships'] }); } });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate({ customerId, organizationId, planId, memberNumber: memberNumber || undefined }); }
  const rows = memberships.data ?? [];
  return <><h1>Memberships</h1>{create.isError && <p className="form-error">{apiErrorMessage(create.error)}</p>}<form className="card form-grid" onSubmit={submit}><select className="input" value={customerId} onChange={(e)=>setCustomerId(e.target.value)} required><option value="">Client</option>{(customers.data??[]).map(c=><option key={c.customerId} value={c.customerId}>{c.customerName}</option>)}</select><select className="input" value={organizationId} onChange={(e)=>{setOrganizationId(e.target.value); setPlanId('');}} required><option value="">Organisation</option>{(organizations.data??[]).filter(o=>o.isActive).map(o=><option key={o.organizationId} value={o.organizationId}>{o.organizationName}</option>)}</select><select className="input" value={planId} onChange={(e)=>setPlanId(e.target.value)} required><option value="">Plan</option>{availablePlans.map(p=><option key={p.planId} value={p.planId}>{p.planName} - {p.coveragePercent}%</option>)}</select><input className="input" placeholder="Numero membre" value={memberNumber} onChange={(e)=>setMemberNumber(e.target.value)}/><button className="button" disabled={create.isPending}>Creer</button></form><div className="card">{memberships.isLoading?'Chargement...':rows.length===0?<p>Aucune affiliation.</p>:<table className="data-table"><thead><tr><th>Client</th><th>Organisation</th><th>Plan</th><th>Couverture</th><th>Actif</th></tr></thead><tbody>{rows.map(m=><tr key={m.membershipId}><td>{m.customerName}</td><td>{m.organizationName}</td><td>{m.planName}</td><td>{m.coveragePercent ?? 0}%</td><td>{m.isActive?'Oui':'Non'}</td></tr>)}</tbody></table>}</div></>;
}
