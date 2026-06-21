import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { salesService } from '../../services/sales.service';

export function SaleDetailPage() {
  const { id = '' } = useParams();
  const query = useQuery({ queryKey: ['sale', id], queryFn: async () => (await salesService.getById(id)).data });
  const sale = query.data;
  return <><h1>Detail vente</h1>{!sale?<div className="card">Chargement...</div>:<><div className="card"><strong>{sale.saleNumber}</strong><p>{sale.status} - {sale.totalAmount}</p></div><div className="card"><table className="data-table"><thead><tr><th>Produit</th><th>Lot</th><th>Expiration</th><th>Qte</th><th>Prix</th><th>Total</th></tr></thead><tbody>{(sale.items??[]).map(i=><tr key={i.saleItemId}><td>{i.commercialName}</td><td>{i.lotNumber}</td><td>{i.expiryDate}</td><td>{i.quantity}</td><td>{i.unitPrice}</td><td>{i.lineTotal}</td></tr>)}</tbody></table></div><div className="card"><table className="data-table"><thead><tr><th>Date</th><th>Methode</th><th>Montant</th></tr></thead><tbody>{(sale.payments??[]).map(p=><tr key={p.paymentId}><td>{p.paymentDate}</td><td>{p.methodName}</td><td>{p.amount}</td></tr>)}</tbody></table></div></>}</>;
}
