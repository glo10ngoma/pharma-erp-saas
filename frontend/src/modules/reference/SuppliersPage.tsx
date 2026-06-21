import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { codeGeneratorService } from '../../services/codeGenerator.service';
import { referenceService } from '../../services/reference.service';

export function SuppliersPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [supplierCode, setCode] = useState('');
  const [supplierName, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const query = useQuery({ queryKey: ['suppliers'], queryFn: async () => (await referenceService.suppliers.getAll()).data });
  const nextCode = useQuery({ queryKey: ['next-code', 'suppliers', modalOpen], enabled: modalOpen, queryFn: async () => (await codeGeneratorService.next('suppliers')).data.code });
  const create = useMutation({ mutationFn: referenceService.suppliers.create, onSuccess: () => { setCode(''); setName(''); setPhone(''); setEmail(''); setModalOpen(false); qc.invalidateQueries({ queryKey: ['suppliers'] }); } });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate({ supplierCode, supplierName, phone: phone || undefined, email: email || undefined }); }
  useEffect(() => { if (modalOpen && !supplierCode && nextCode.data) setCode(nextCode.data); }, [modalOpen, nextCode.data, supplierCode]);
  const rows = filterRows(query.data ?? [], search, (row) => [row.supplierCode, row.supplierName, row.phone, row.email]);
  return <><div className="toolbar"><h1>Fournisseurs</h1><button className="button" onClick={() => setModalOpen(true)}>Nouveau fournisseur</button></div><Modal title="Nouveau fournisseur" open={modalOpen} onClose={() => setModalOpen(false)}><form className="form-grid" onSubmit={submit}><input className="input" placeholder="Code" value={supplierCode} onChange={(e)=>setCode(e.target.value)} required/><input className="input" placeholder="Nom" value={supplierName} onChange={(e)=>setName(e.target.value)} required/><input className="input" placeholder="Telephone" value={phone} onChange={(e)=>setPhone(e.target.value)}/><input className="input" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)}/><button className="button" disabled={create.isPending}>Creer</button></form></Modal><div className="card"><SearchBox value={search} onChange={setSearch} /></div><div className="card">{query.isLoading?<p className="loading-state">Chargement...</p>:rows.length===0?<p className="empty-state">Aucun fournisseur trouve.</p>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Nom</th><th>Telephone</th><th>Email</th></tr></thead><tbody>{rows.map(i=><tr key={i.supplierId}><td>{i.supplierCode}</td><td>{i.supplierName}</td><td>{i.phone||'-'}</td><td>{i.email||'-'}</td></tr>)}</tbody></table></div>}</div></>;
}
