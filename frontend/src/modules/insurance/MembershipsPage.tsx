import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { apiErrorMessage } from '../../services/apiError';
import { codeGeneratorService } from '../../services/codeGenerator.service';
import { insuranceService } from '../../services/insurance.service';
import { referenceService } from '../../services/reference.service';

export function MembershipsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [planId, setPlanId] = useState('');
  const [memberNumber, setMemberNumber] = useState('');
  const customers = useQuery({ queryKey: ['customers'], queryFn: async () => (await referenceService.customers.getAll()).data });
  const organizations = useQuery({ queryKey: ['organizations'], queryFn: async () => (await insuranceService.organizations.getAll()).data });
  const plans = useQuery({ queryKey: ['insurance-plans'], queryFn: async () => (await insuranceService.plans.getAll()).data });
  const memberships = useQuery({ queryKey: ['memberships'], queryFn: async () => (await insuranceService.memberships.getAll()).data });
  const availablePlans = useMemo(() => (plans.data ?? []).filter((p) => p.organizationId === organizationId && p.isActive), [organizationId, plans.data]);
  const nextCode = useQuery({ queryKey: ['next-code', 'memberships', modalOpen], enabled: modalOpen, queryFn: async () => (await codeGeneratorService.next('memberships')).data.code });
  const create = useMutation({ mutationFn: insuranceService.memberships.create, onSuccess: () => { setMemberNumber(''); setModalOpen(false); qc.invalidateQueries({ queryKey: ['memberships'] }); } });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate({ customerId, organizationId, planId, memberNumber: memberNumber || undefined }); }
  useEffect(() => { if (modalOpen && !memberNumber && nextCode.data) setMemberNumber(nextCode.data); }, [memberNumber, modalOpen, nextCode.data]);
  const rows = filterRows(memberships.data ?? [], search, (row) => [row.customerName, row.organizationName, row.planName, row.memberNumber]);
  return <><div className="toolbar"><h1>Memberships</h1><button className="button" onClick={() => setModalOpen(true)}>Nouveau membership</button></div>{create.isError && <p className="form-error">{apiErrorMessage(create.error)}</p>}<Modal title="Nouveau membership" open={modalOpen} onClose={() => setModalOpen(false)}><form className="form-grid" onSubmit={submit}><select className="input" value={customerId} onChange={(e)=>setCustomerId(e.target.value)} required><option value="">Client</option>{(customers.data??[]).map(c=><option key={c.customerId} value={c.customerId}>{c.customerName}</option>)}</select><select className="input" value={organizationId} onChange={(e)=>{setOrganizationId(e.target.value); setPlanId('');}} required><option value="">Organisation</option>{(organizations.data??[]).filter(o=>o.isActive).map(o=><option key={o.organizationId} value={o.organizationId}>{o.organizationName}</option>)}</select><select className="input" value={planId} onChange={(e)=>setPlanId(e.target.value)} required><option value="">Plan</option>{availablePlans.map(p=><option key={p.planId} value={p.planId}>{p.planName} - {p.coveragePercent}%</option>)}</select><input className="input" placeholder="Numero membre" value={memberNumber} onChange={(e)=>setMemberNumber(e.target.value)}/><button className="button" disabled={create.isPending}>Creer</button></form></Modal><div className="card"><SearchBox value={search} onChange={setSearch} /></div><div className="card">{memberships.isLoading?<p className="loading-state">Chargement...</p>:rows.length===0?<p className="empty-state">Aucune affiliation trouvee.</p>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Client</th><th>Organisation</th><th>Plan</th><th>Couverture</th><th>Actif</th></tr></thead><tbody>{rows.map(m=><tr key={m.membershipId}><td>{m.customerName}</td><td>{m.organizationName}</td><td>{m.planName}</td><td>{m.coveragePercent ?? 0}%</td><td><span className={`badge ${m.isActive?'badge-success':'badge-muted'}`}>{m.isActive?'Actif':'Inactif'}</span></td></tr>)}</tbody></table></div>}</div></>;
}
