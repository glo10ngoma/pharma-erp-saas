import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lotsService } from '../../services/lots.service';

export function LotsPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['lots'], queryFn: async () => (await lotsService.getAll()).data });
  const block = useMutation({ mutationFn: (id: string) => lotsService.block(id, 'Blocage manuel'), onSuccess: () => qc.invalidateQueries({ queryKey: ['lots'] }) });
  const unblock = useMutation({ mutationFn: (id: string) => lotsService.unblock(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['lots'] }) });
  return <><h1>Lots</h1><div className="card">{query.isLoading?'Chargement...':<table className="data-table"><thead><tr><th>Article</th><th>Lot</th><th>Expiration</th><th>PA</th><th>PV</th><th>Bloque</th><th></th></tr></thead><tbody>{(query.data??[]).map(l=><tr key={l.lotId}><td>{l.commercialName}</td><td>{l.lotNumber}</td><td>{l.expiryDate}</td><td>{l.purchasePrice}</td><td>{l.sellingPrice}</td><td>{l.isBlocked?'Oui':'Non'}</td><td>{l.isBlocked?<button className="button" onClick={()=>unblock.mutate(l.lotId)}>Debloquer</button>:<button className="button" onClick={()=>block.mutate(l.lotId)}>Bloquer</button>}</td></tr>)}</tbody></table>}</div></>;
}
