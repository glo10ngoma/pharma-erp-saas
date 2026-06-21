import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { salesService } from '../../services/sales.service';

export function SalesPage() {
  const query = useQuery({ queryKey: ['sales'], queryFn: async () => (await salesService.getAll()).data });
  return <><h1>Ventes</h1><div className="card toolbar"><Link className="button" to="/pos">Nouvelle vente POS</Link></div><div className="card">{query.isLoading?'Chargement...':<table className="data-table"><thead><tr><th>Numero</th><th>Date</th><th>Client</th><th>Total</th><th>Statut</th></tr></thead><tbody>{(query.data??[]).map(s=><tr key={s.saleId}><td><Link to={`/sales/${s.saleId}`}>{s.saleNumber}</Link></td><td>{s.saleDate}</td><td>{s.customerName||'Comptoir'}</td><td>{s.totalAmount}</td><td>{s.status}</td></tr>)}</tbody></table>}</div></>;
}
