import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { codeGeneratorService } from '../../services/codeGenerator.service';
import { referenceService } from '../../services/reference.service';

export function CustomersPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customerCode, setCode] = useState('');
  const [customerName, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerType, setType] = useState('INDIVIDUAL');
  const query = useQuery({ queryKey: ['customers'], queryFn: async () => (await referenceService.customers.getAll()).data });
  const nextCode = useQuery({ queryKey: ['next-code', 'customers', modalOpen], enabled: modalOpen, queryFn: async () => (await codeGeneratorService.next('customers')).data.code });
  const create = useMutation({ mutationFn: referenceService.customers.create, onSuccess: () => { setCode(''); setName(''); setPhone(''); setModalOpen(false); qc.invalidateQueries({ queryKey: ['customers'] }); } });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate({ customerCode, customerName, phone: phone || undefined, customerType }); }
  useEffect(() => { if (modalOpen && !customerCode && nextCode.data) setCode(nextCode.data); }, [customerCode, modalOpen, nextCode.data]);
  const rows = filterRows(query.data ?? [], search, (row) => [row.customerCode, row.customerName, row.customerType, row.phone]);
  return <><div className="toolbar"><h1>Clients</h1><button className="button" onClick={() => setModalOpen(true)}>Nouveau client</button></div><Modal title="Nouveau client" open={modalOpen} onClose={() => setModalOpen(false)}><form className="form-grid" onSubmit={submit}><input className="input" placeholder="Code" value={customerCode} onChange={(e)=>setCode(e.target.value)} required/><input className="input" placeholder="Nom" value={customerName} onChange={(e)=>setName(e.target.value)} required/><select className="input" value={customerType} onChange={(e)=>setType(e.target.value)}><option value="INDIVIDUAL">INDIVIDUAL</option><option value="COMPANY">COMPANY</option><option value="HOSPITAL">HOSPITAL</option><option value="NGO">NGO</option><option value="OTHER">OTHER</option></select><input className="input" placeholder="Telephone" value={phone} onChange={(e)=>setPhone(e.target.value)}/><button className="button" disabled={create.isPending}>Creer</button></form></Modal><div className="card"><SearchBox value={search} onChange={setSearch} /></div><div className="card">{query.isLoading?<p className="loading-state">Chargement...</p>:rows.length===0?<p className="empty-state">Aucun client trouve.</p>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Nom</th><th>Type</th><th>Telephone</th></tr></thead><tbody>{rows.map(i=><tr key={i.customerId}><td>{i.customerCode}</td><td>{i.customerName}</td><td>{i.customerType}</td><td>{i.phone||'-'}</td></tr>)}</tbody></table></div>}</div></>;
}
