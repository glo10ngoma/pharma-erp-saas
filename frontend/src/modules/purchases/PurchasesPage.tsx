import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { purchasesService } from '../../services/purchases.service';
import { formatMoney } from '../../utils/money';

export function PurchasesPage() {
  const [status, setStatus] = useState('');
  const query = useQuery({ queryKey: ['purchases', status], queryFn: async () => (await purchasesService.getAll(status)).data });
  const rows = query.data ?? [];
  return <><h1>Achats</h1><div className="card toolbar"><select className="input" value={status} onChange={(e)=>setStatus(e.target.value)}><option value="">Tous les statuts</option><option value="DRAFT">Brouillon</option><option value="VALIDATED">Valide</option></select><Link className="button" to="/purchases/new">Nouvel achat</Link></div><div className="card">{query.isLoading?<p className="loading-state">Chargement des achats...</p>:rows.length===0 ? <p className="empty-state">Aucun achat pour ce filtre.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Numero</th><th>Fournisseur</th><th>Site</th><th>Date</th><th>Total</th><th>Statut</th></tr></thead><tbody>{rows.map(p=><tr key={p.purchaseId}><td><Link to={`/purchases/${p.purchaseId}`}>{p.purchaseNumber}</Link></td><td>{p.supplierName}</td><td>{p.siteName}</td><td>{p.purchaseDate}</td><td>{formatMoney(p.totalAmount, p.currencyCode ?? 'USD', p.currencySymbol)}</td><td><span className={`badge ${p.status === 'VALIDATED' ? 'badge-success' : 'badge-warning'}`}>{p.status}</span></td></tr>)}</tbody></table></div>}</div></>;
}
