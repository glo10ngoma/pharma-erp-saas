import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { apiErrorMessage } from '../../services/apiError';
import { purchasesService } from '../../services/purchases.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';

export function PurchaseDetailPage() {
  const { id = '' } = useParams();
  const { permissions } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['purchase', id], queryFn: async () => (await purchasesService.getById(id)).data });
  const validate = useMutation({ mutationFn: () => purchasesService.validate(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase', id] }) });
  const purchase = query.data;
  const canReadPaymentHistory = permissions.includes('purchase_payments.read');
  return <>
    <div className="breadcrumb"><Link to="/purchases">Achats</Link><span>&gt;</span><strong>Detail achat</strong></div>
    <h1>Detail achat</h1>
    {validate.isError && <p className="form-error">{apiErrorMessage(validate.error)}</p>}
    {!purchase ? (
      <div className="card">{query.isLoading ? 'Chargement...' : 'Achat introuvable.'}</div>
    ) : (
      <>
        <div className="card toolbar">
          <div>
            <strong>{purchase.purchaseNumber}</strong>
            <span>{purchase.supplierName} - {purchase.siteName} - {purchase.status} - {formatMoney(purchase.totalAmount, purchase.currencyCode ?? 'USD', purchase.currencySymbol)}</span>
          </div>
          {purchase.status === 'DRAFT' && (
            <button className="button" onClick={() => validate.mutate()} disabled={validate.isPending || (purchase.items ?? []).length === 0}>
              {validate.isPending ? 'Validation...' : 'Valider'}
            </button>
          )}
        </div>

        <div className="card detail-grid">
          <div><span>Numero</span><strong>{purchase.purchaseNumber}</strong></div>
          <div><span>Date</span><strong>{formatDate(purchase.purchaseDate)}</strong></div>
          <div><span>Fournisseur</span><strong>{purchase.supplierName}</strong></div>
          <div><span>Site</span><strong>{purchase.siteName}</strong></div>
          <div><span>Devise</span><strong>{purchase.currencyCode ?? 'USD'}</strong></div>
          <div><span>Taux applique</span><strong>{purchase.exchangeRate ?? 1}</strong></div>
          <div><span>Statut achat</span><strong>{purchase.status}</strong></div>
          <div><span>Statut reglement</span><strong>{purchase.paymentStatus ?? 'UNPAID'}</strong></div>
          <div><span>Source paiement</span><strong>{purchase.paymentSource ?? '-'}</strong></div>
          <div><span>Mode paiement</span><strong>{purchase.paymentMethod ?? '-'}</strong></div>
          <div><span>Total achat</span><strong>{formatMoney(purchase.totalAmount, purchase.currencyCode ?? 'USD', purchase.currencySymbol)}</strong></div>
          <div><span>Total eq. USD</span><strong>{formatMoney(purchase.totalEquivalentUsd ?? 0, 'USD')}</strong></div>
          <div><span>Paye USD</span><strong>{formatMoney(purchase.amountPaidUsd ?? 0, 'USD')}</strong></div>
          <div><span>Paye CDF</span><strong>{formatMoney(purchase.amountPaidCdf ?? 0, 'CDF')}</strong></div>
          <div><span>Paye eq. USD</span><strong>{formatMoney(purchase.paidEquivalentUsd ?? 0, 'USD')}</strong></div>
          <div><span>Reste fournisseur</span><strong>{formatMoney(purchase.outstandingBalanceUsd ?? 0, 'USD')}</strong></div>
          <div><span>Session caisse</span><strong>{purchase.cashSessionId ?? '-'}</strong></div>
          <div><span>Reference paiement</span><strong>{purchase.paymentReference ?? '-'}</strong></div>
        </div>

        <div className="card">
          {(purchase.items ?? []).length === 0 ? (
            <p>Aucune ligne achat.</p>
          ) : (
            <table className="data-table purchase-detail-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Unite achat</th>
                  <th>Qte achat</th>
                  <th>Facteur</th>
                  <th>Unite stock</th>
                  <th>Qte stock</th>
                  <th>Lot</th>
                  <th>Expiration</th>
                  <th>PA</th>
                  <th>PV</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(purchase.items ?? []).map((item) => (
                  <tr key={item.purchaseItemId}>
                    <td>{item.commercialName}</td>
                    <td>{item.purchaseUnitLabelSnapshot ?? '-'}</td>
                    <td className="quantity-cell">{item.purchaseQuantity ?? item.quantity}</td>
                    <td className="quantity-cell">{item.conversionFactor ?? 1}</td>
                    <td>{item.stockUnitLabelSnapshot ?? '-'}</td>
                    <td className="quantity-cell">{item.stockQuantity ?? item.quantity}</td>
                    <td>{item.lotNumber}</td>
                    <td>{formatDate(item.expiryDate)}</td>
                    <td className="numeric-text">{formatMoney(item.purchaseUnitPrice, purchase.currencyCode ?? 'USD', purchase.currencySymbol)}</td>
                    <td className="numeric-text">{formatMoney(item.sellingUnitPrice, purchase.currencyCode ?? 'USD', purchase.currencySymbol)}</td>
                    <td className="numeric-text">{formatMoney(item.lineTotal, purchase.currencyCode ?? 'USD', purchase.currencySymbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {canReadPaymentHistory ? (
          <div className="card">
            <h2>Paiements fournisseur</h2>
            {(purchase.payments ?? []).length === 0 ? (
              <p className="muted">Aucun paiement fournisseur enregistre pour cet achat.</p>
            ) : (
              <table className="data-table purchase-detail-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Statut</th>
                    <th>Source</th>
                    <th>Mode</th>
                    <th>Devise</th>
                    <th>Montant</th>
                    <th>Taux</th>
                    <th>Eq. USD</th>
                    <th>Session caisse</th>
                    <th>Reference</th>
                    <th>Note</th>
                    <th>Utilisateur</th>
                    <th>Mouvement caisse</th>
                  </tr>
                </thead>
                <tbody>
                  {(purchase.payments ?? []).map((payment) => (
                    <tr key={payment.purchasePaymentId}>
                      <td>{formatDate(payment.createdAt)}</td>
                      <td>{payment.status ?? '-'}</td>
                      <td>{payment.paymentSource ?? '-'}</td>
                      <td>{payment.paymentMethod ?? '-'}</td>
                      <td>{payment.currencyCode ?? '-'}</td>
                      <td className="numeric-text">{formatMoney(payment.amount, payment.currencyCode ?? 'USD')}</td>
                      <td className="numeric-text">{payment.exchangeRateApplied}</td>
                      <td className="numeric-text">{formatMoney(payment.amountEquivalentUsd, 'USD')}</td>
                      <td>{payment.cashSessionId ?? '-'}</td>
                      <td>{payment.paymentReference ?? '-'}</td>
                      <td>{payment.paymentNote ?? '-'}</td>
                      <td>{payment.createdByName ?? payment.createdBy ?? '-'}</td>
                      <td>{payment.cashMovementId ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="card">
            <h2>Paiements fournisseur</h2>
            <p className="muted">Historique masque: permission purchase_payments.read requise.</p>
          </div>
        )}
      </>
    )}
  </>;
}
