import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { codeGeneratorService } from '../../services/codeGenerator.service';

type Props<T> = {
  title: string;
  queryKey: string;
  codeLabel: string;
  nameLabel: string;
  codeField: string;
  nameField: string;
  idField: string;
  entity?: string;
  getAll: () => Promise<{ data: T[] }>;
  create: (payload: Record<string, unknown>) => Promise<unknown>;
};

export function SimpleCodeNamePage<T extends Record<string, string>>(props: Props<T>) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const query = useQuery({ queryKey: [props.queryKey], queryFn: async () => (await props.getAll()).data });
  const nextCode = useQuery({ queryKey: ['next-code', props.entity, modalOpen], enabled: Boolean(props.entity && modalOpen), queryFn: async () => (await codeGeneratorService.next(props.entity as string)).data.code });
  const create = useMutation({ mutationFn: props.create, onSuccess: () => { setCode(''); setName(''); setModalOpen(false); qc.invalidateQueries({ queryKey: [props.queryKey] }); } });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate({ [props.codeField]: code, [props.nameField]: name }); }
  useEffect(() => { if (modalOpen && !code && nextCode.data) setCode(nextCode.data); }, [code, modalOpen, nextCode.data]);
  const rows = filterRows(query.data ?? [], search, (row) => [row[props.codeField], row[props.nameField]]);
  return <><div className="toolbar"><h1>{props.title}</h1><button className="button" onClick={() => setModalOpen(true)}>Nouveau</button></div><Modal title={`Nouveau - ${props.title}`} open={modalOpen} onClose={() => setModalOpen(false)}><form className="form-grid" onSubmit={submit}><input className="input" placeholder={props.codeLabel} value={code} onChange={(e)=>setCode(e.target.value)} required/><input className="input" placeholder={props.nameLabel} value={name} onChange={(e)=>setName(e.target.value)} required/><button className="button" disabled={create.isPending}>{create.isPending ? 'Creation...' : 'Creer'}</button></form></Modal><div className="card"><SearchBox value={search} onChange={setSearch} /></div><div className="card">{query.isLoading?<p className="loading-state">Chargement...</p>:rows.length===0?<p className="empty-state">Aucune donnee trouvee.</p>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Nom</th></tr></thead><tbody>{rows.map(i=><tr key={i[props.idField]}><td>{i[props.codeField]}</td><td>{i[props.nameField]}</td></tr>)}</tbody></table></div>}</div></>;
}
