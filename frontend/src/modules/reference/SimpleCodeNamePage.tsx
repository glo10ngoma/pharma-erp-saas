import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type Props<T> = {
  title: string;
  queryKey: string;
  codeLabel: string;
  nameLabel: string;
  codeField: string;
  nameField: string;
  idField: string;
  getAll: () => Promise<{ data: T[] }>;
  create: (payload: Record<string, unknown>) => Promise<unknown>;
};

export function SimpleCodeNamePage<T extends Record<string, string>>(props: Props<T>) {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const query = useQuery({ queryKey: [props.queryKey], queryFn: async () => (await props.getAll()).data });
  const create = useMutation({ mutationFn: props.create, onSuccess: () => { setCode(''); setName(''); qc.invalidateQueries({ queryKey: [props.queryKey] }); } });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate({ [props.codeField]: code, [props.nameField]: name }); }
  return <><h1>{props.title}</h1><form className="card form-grid" onSubmit={submit}><input className="input" placeholder={props.codeLabel} value={code} onChange={(e)=>setCode(e.target.value)} required/><input className="input" placeholder={props.nameLabel} value={name} onChange={(e)=>setName(e.target.value)} required/><button className="button">Creer</button></form><div className="card">{query.isLoading?'Chargement...':<table className="data-table"><thead><tr><th>Code</th><th>Nom</th></tr></thead><tbody>{(query.data??[]).map(i=><tr key={i[props.idField]}><td>{i[props.codeField]}</td><td>{i[props.nameField]}</td></tr>)}</tbody></table>}</div></>;
}
