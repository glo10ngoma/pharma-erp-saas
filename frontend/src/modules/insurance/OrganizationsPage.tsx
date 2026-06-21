import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { apiErrorMessage } from '../../services/apiError';
import { codeGeneratorService } from '../../services/codeGenerator.service';
import { insuranceService } from '../../services/insurance.service';

export function OrganizationsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [organizationCode, setCode] = useState('');
  const [organizationName, setName] = useState('');
  const [organizationType, setType] = useState('INSURANCE');
  const query = useQuery({ queryKey: ['organizations'], queryFn: async () => (await insuranceService.organizations.getAll()).data });
  const nextCode = useQuery({ queryKey: ['next-code', 'organizations', modalOpen], enabled: modalOpen, queryFn: async () => (await codeGeneratorService.next('organizations')).data.code });
  const create = useMutation({ mutationFn: insuranceService.organizations.create, onSuccess: () => { setCode(''); setName(''); setModalOpen(false); qc.invalidateQueries({ queryKey: ['organizations'] }); } });
  const disable = useMutation({ mutationFn: insuranceService.organizations.disable, onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }) });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate({ organizationCode, organizationName, organizationType }); }
  useEffect(() => { if (modalOpen && !organizationCode && nextCode.data) setCode(nextCode.data); }, [modalOpen, nextCode.data, organizationCode]);
  const rows = filterRows(query.data ?? [], search, (row) => [row.organizationCode, row.organizationName, row.organizationType]);
  return <><div className="toolbar"><h1>Organizations</h1><button className="button" onClick={() => setModalOpen(true)}>Nouvelle organisation</button></div>{create.isError && <p className="form-error">{apiErrorMessage(create.error)}</p>}<Modal title="Nouvelle organisation" open={modalOpen} onClose={() => setModalOpen(false)}><form className="form-grid" onSubmit={submit}><input className="input" placeholder="Code" value={organizationCode} onChange={(e)=>setCode(e.target.value)} required/><input className="input" placeholder="Nom" value={organizationName} onChange={(e)=>setName(e.target.value)} required/><select className="input" value={organizationType} onChange={(e)=>setType(e.target.value)}><option value="INSURANCE">INSURANCE</option><option value="COMPANY">COMPANY</option><option value="NGO">NGO</option><option value="HOSPITAL">HOSPITAL</option><option value="OTHER">OTHER</option></select><button className="button" disabled={create.isPending}>Creer</button></form></Modal><div className="card"><SearchBox value={search} onChange={setSearch} /></div><div className="card">{query.isLoading?<p className="loading-state">Chargement...</p>:rows.length===0?<p className="empty-state">Aucune organisation trouvee.</p>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Nom</th><th>Type</th><th>Actif</th><th></th></tr></thead><tbody>{rows.map(o=><tr key={o.organizationId}><td>{o.organizationCode}</td><td>{o.organizationName}</td><td>{o.organizationType}</td><td><span className={`badge ${o.isActive?'badge-success':'badge-muted'}`}>{o.isActive?'Actif':'Inactif'}</span></td><td>{o.isActive && <button className="button" onClick={()=>disable.mutate(o.organizationId)}>Desactiver</button>}</td></tr>)}</tbody></table></div>}</div></>;
}
