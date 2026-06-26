import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiErrorMessage } from '../../services/apiError';
import { transfersService } from '../../services/transfers.service';
import { formatDate } from '../../utils/date';

export function TransferDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const transfer = useQuery({ queryKey: ['transfers', id], queryFn: async () => (await transfersService.getById(id)).data, enabled: Boolean(id) });
  const validate = useMutation({
    mutationFn: () => transfersService.validate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] });
      qc.invalidateQueries({ queryKey: ['transfers', id] });
      qc.invalidateQueries({ queryKey: ['stocks'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
    },
  });
  const current = transfer.data;
  const totalQuantity = (current?.items ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);

  return (
    <div className="purchase-page transfer-detail-page">
      <div className="breadcrumb"><Link to="/transfers">Transferts</Link><span>&gt;</span><strong>{current?.transferNumber ?? 'Detail'}</strong></div>
      {validate.isError && <p className="form-error">{apiErrorMessage(validate.error)}</p>}
      <div className="purchase-sticky-header transfer-sticky-header">
        <div><span>Code</span><strong>{current?.transferNumber ?? '-'}</strong></div>
        <div><span>Source</span><strong>{current?.fromSiteName ?? '-'}</strong></div>
        <div><span>Destination</span><strong>{current?.toSiteName ?? '-'}</strong></div>
        <div><span>Date</span><strong>{current ? formatDate(current.transferDate) : '-'}</strong></div>
        <div><span>Quantite</span><strong>{totalQuantity}</strong></div>
        <div><span>Statut</span><strong><span className={`badge ${current?.status === 'VALIDATED' ? 'badge-success' : 'badge-warning'}`}>{current?.status ?? '-'}</span></strong></div>
      </div>
      <section className="card compact-card">
        {transfer.isLoading ? <p className="loading-state">Chargement du transfert...</p> : !current ? <p className="empty-state">Transfert introuvable.</p> : (
          <>
            <div className="detail-grid">
              <div><span>Commentaire</span><strong>{current.notes ?? '-'}</strong></div>
              <div><span>Creation</span><strong>{formatDate(current.createdAt)}</strong></div>
              <div><span>Validation</span><strong>{current.validatedAt ? formatDate(current.validatedAt) : '-'}</strong></div>
            </div>
            <div className="table-wrap">
              <table className="data-table transfers-table">
                <thead><tr><th>Article</th><th>Lot</th><th>Expiration</th><th>Quantite</th><th>Envoye</th><th>Recu</th></tr></thead>
                <tbody>{(current.items ?? []).map((item) => (
                  <tr key={item.transferItemId}>
                    <td><strong>{item.commercialName ?? '-'}</strong><small>{item.articleCode ?? ''}</small></td>
                    <td>{item.lotNumber ?? '-'}</td>
                    <td>{item.expiryDate ? formatDate(item.expiryDate) : '-'}</td>
                    <td className="quantity-cell">{item.quantity}</td>
                    <td className="quantity-cell">{item.quantitySent ?? '-'}</td>
                    <td className="quantity-cell">{item.quantityReceived ?? '-'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <div className="page-actions">
        <Link className="ghost-button compact-button" to="/transfers">Retour</Link>
        <button className="button compact-button" type="button" disabled={!current || current.status !== 'DRAFT' || validate.isPending} onClick={() => validate.mutate()}>{validate.isPending ? 'Validation...' : 'Valider Transfert'}</button>
      </div>
    </div>
  );
}
