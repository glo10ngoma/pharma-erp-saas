import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { apiErrorMessage } from '../../services/apiError';
import { purchasesService } from '../../services/purchases.service';

export function PurchaseDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['purchase', id], queryFn: async () => (await purchasesService.getById(id)).data });
  const validate = useMutation({ mutationFn: () => purchasesService.validate(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase', id] }) });
  const purchase = query.data;
  return <><h1>Detail achat</h1>{validate.isError && <p className="form-error">{apiErrorMessage(validate.error)}</p>}{!purchase ? <div className="card">{query.isLoading ? 'Chargement...' : 'Achat introuvable.'}</div> : <><div className="card toolbar"><div><strong>{purchase.purchaseNumber}</strong><span>{purchase.supplierName} - {purchase.siteName} - {purchase.status}</span></div>{purchase.status==='DRAFT' && <button className="button" onClick={()=>validate.mutate()} disabled={validate.isPending || (purchase.items??[]).length===0}>Valider</button>}</div><div className="card">{(purchase.items??[]).length===0 ? <p>Aucune ligne achat.</p> : <table className="data-table"><thead><tr><th>Article</th><th>Lot</th><th>Expiration</th><th>Qte</th><th>PA</th><th>PV</th><th>Total</th></tr></thead><tbody>{(purchase.items??[]).map(i=><tr key={i.purchaseItemId}><td>{i.commercialName}</td><td>{i.lotNumber}</td><td>{i.expiryDate}</td><td>{i.quantity}</td><td>{i.purchaseUnitPrice}</td><td>{i.sellingUnitPrice}</td><td>{i.lineTotal}</td></tr>)}</tbody></table>}</div></>}</>;
}
