import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { apiErrorMessage } from '../../services/apiError';
import { codeGeneratorService } from '../../services/codeGenerator.service';
import { insuranceService } from '../../services/insurance.service';

export function InsurancePlansPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [planCode, setCode] = useState('');
  const [planName, setName] = useState('');
  const [coveragePercent, setCoverage] = useState('80');
  const organizations = useQuery({ queryKey: ['organizations'], queryFn: async () => (await insuranceService.organizations.getAll()).data });
  const plans = useQuery({ queryKey: ['insurance-plans'], queryFn: async () => (await insuranceService.plans.getAll()).data });
  const nextCode = useQuery({ queryKey: ['next-code', 'insurance_plans', modalOpen], enabled: modalOpen, queryFn: async () => (await codeGeneratorService.next('insurance_plans')).data.code });
  const create = useMutation({ mutationFn: insuranceService.plans.create, onSuccess: () => { setCode(''); setName(''); setModalOpen(false); qc.invalidateQueries({ queryKey: ['insurance-plans'] }); } });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate({ organizationId, planCode, planName, coveragePercent: Number(coveragePercent) }); }
  useEffect(() => { if (modalOpen && !planCode && nextCode.data) setCode(nextCode.data); }, [modalOpen, nextCode.data, planCode]);
  const rows = filterRows(plans.data ?? [], search, (row) => [row.organizationName, row.planCode, row.planName, row.coveragePercent]);
  return <><div className="toolbar"><h1>Insurance Plans</h1><button className="button" onClick={() => setModalOpen(true)}>Nouveau plan assurance</button></div>{create.isError && <p className="form-error">{apiErrorMessage(create.error)}</p>}<Modal title="Nouveau plan assurance" open={modalOpen} onClose={() => setModalOpen(false)}><form className="form-grid" onSubmit={submit}><select className="input" value={organizationId} onChange={(e)=>setOrganizationId(e.target.value)} required><option value="">Organisation</option>{(organizations.data??[]).filter(o=>o.isActive).map(o=><option key={o.organizationId} value={o.organizationId}>{o.organizationName}</option>)}</select><input className="input" placeholder="Code" value={planCode} onChange={(e)=>setCode(e.target.value)} required/><input className="input" placeholder="Nom" value={planName} onChange={(e)=>setName(e.target.value)} required/><input className="input" type="number" min="0" max="100" value={coveragePercent} onChange={(e)=>setCoverage(e.target.value)} required/><button className="button" disabled={create.isPending}>Creer</button></form></Modal><div className="card"><SearchBox value={search} onChange={setSearch} /></div><div className="card">{plans.isLoading?<p className="loading-state">Chargement...</p>:rows.length===0?<p className="empty-state">Aucun plan trouve.</p>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Organisation</th><th>Code</th><th>Nom</th><th>Couverture</th><th>Actif</th></tr></thead><tbody>{rows.map(p=><tr key={p.planId}><td>{p.organizationName}</td><td>{p.planCode}</td><td>{p.planName}</td><td>{p.coveragePercent}%</td><td><span className={`badge ${p.isActive?'badge-success':'badge-muted'}`}>{p.isActive?'Actif':'Inactif'}</span></td></tr>)}</tbody></table></div>}</div></>;
}
