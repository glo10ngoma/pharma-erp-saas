import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CommentsPanel } from '../../components/CommentsPanel';
import { salesService } from '../../services/sales.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';

export function SaleDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['sale', id], queryFn: async () => (await salesService.getById(id)).data });
  const sale = query.data;
  const currencyCode = sale?.currencyCode ?? 'USD';
  const currencySymbol = sale?.currencySymbol;
  const items = sale?.items ?? [];
  const payments = sale?.payments ?? [];

  return (
    <div className="purchase-page sale-detail-page">
      <div className="breadcrumb"><Link to="/sales">Ventes</Link><span>&gt;</span><strong>{sale?.saleNumber ?? 'Detail vente'}</strong></div>
      {!sale ? <div className="card"><p className="loading-state">Chargement du detail vente...</p></div> : <>
        <div className="purchase-sticky-header transfer-sticky-header">
          <div><span>Numero</span><strong>{sale.saleNumber}</strong></div>
          <div><span>Date</span><strong>{formatDate(sale.saleDate)}</strong></div>
          <div><span>Client</span><strong>{sale.customerName || 'Comptoir'}</strong></div>
          <div><span>Type</span><strong>{sale.saleType}</strong></div>
          <div><span>Total</span><strong>{formatMoney(sale.totalAmount, currencyCode, currencySymbol)}</strong></div>
          <div><span>Statut</span><strong><span className={`badge ${sale.status === 'VALIDATED' ? 'badge-success' : 'badge-warning'}`}>{sale.status}</span></strong></div>
        </div>

        <section className="card compact-card">
          <div className="detail-grid">
            <div><span>Site</span><strong>{sale.siteName ?? '-'}</strong></div>
            <div><span>Assurance</span><strong>{sale.organizationName ?? '-'}</strong></div>
            <div><span>Plan</span><strong>{sale.planName ?? '-'}</strong></div>
            <div><span>Part patient</span><strong>{formatMoney(sale.customerPayableAmount, currencyCode, currencySymbol)}</strong></div>
            <div><span>Part assurance</span><strong>{formatMoney(sale.insuranceCoveredAmount, currencyCode, currencySymbol)}</strong></div>
            <div><span>Creance</span><strong>{formatMoney(sale.creditAmount, currencyCode, currencySymbol)}</strong></div>
            <div><span>Remis USD</span><strong>{formatMoney(sale.amountPaidUsd ?? 0, 'USD', currencySymbol)}</strong></div>
            <div><span>Rendu USD</span><strong>{formatMoney(sale.amountReturnedUsd ?? 0, 'USD', currencySymbol)}</strong></div>
            <div><span>Net USD</span><strong>{formatMoney(sale.netReceivedUsd ?? 0, 'USD', currencySymbol)}</strong></div>
            <div><span>Remis CDF</span><strong>{formatMoney(sale.amountPaidCdf ?? 0, 'CDF')}</strong></div>
            <div><span>Rendu CDF</span><strong>{formatMoney(sale.amountReturnedCdf ?? 0, 'CDF')}</strong></div>
            <div><span>Net CDF</span><strong>{formatMoney(sale.netReceivedCdf ?? 0, 'CDF')}</strong></div>
            <div><span>Ecart USD</span><strong>{formatMoney(sale.settlementDifferenceUsd ?? 0, 'USD', currencySymbol)}</strong></div>
            <div><span>Type ecart</span><strong>{sale.settlementDifferenceType ?? 'NONE'}</strong></div>
            <div><span>Motif</span><strong>{sale.settlementDifferenceReason ?? '-'}</strong></div>
            <div><span>Note</span><strong>{sale.settlementDifferenceNote ?? '-'}</strong></div>
          </div>
        </section>

        <section className="card compact-card">
          <h3>Produits</h3>
          <div className="table-wrap">
            <table className="data-table sales-table">
              <thead><tr><th>Produit</th><th>Lot</th><th>Expiration</th><th>Qte</th><th>Prix</th><th>Total</th></tr></thead>
              <tbody>{items.length === 0 ? <tr><td colSpan={6}>Aucun produit.</td></tr> : items.map((item) => <tr key={item.saleItemId}><td>{item.commercialName}</td><td>{item.lotNumber}</td><td>{item.expiryDate ? formatDate(item.expiryDate) : '-'}</td><td className="quantity-cell">{item.quantity}</td><td className="numeric-text">{formatMoney(item.unitPrice, currencyCode, currencySymbol)}</td><td className="numeric-text">{formatMoney(item.lineTotal, currencyCode, currencySymbol)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="card compact-card">
          <h3>Paiements</h3>
          <div className="table-wrap">
            <table className="data-table sales-table">
              <thead><tr><th>Date</th><th>Methode</th><th>Montant</th><th>Utilisateur</th></tr></thead>
              <tbody>{payments.length === 0 ? <tr><td colSpan={4}>Aucun paiement.</td></tr> : payments.map((payment) => <tr key={payment.paymentId}><td>{formatDate(payment.paymentDate)}</td><td>{payment.methodName}</td><td className="numeric-text">{formatMoney(payment.amount, payment.currencyCode ?? currencyCode, payment.currencySymbol ?? currencySymbol)}</td><td>{payment.receivedByName ?? '-'}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

      <div className="page-actions">
        <Link className="ghost-button compact-button" to="/sales">Retour</Link>
        {sale.status === 'DRAFT' && <button className="ghost-button compact-button" type="button" onClick={() => navigate(`/pos?saleId=${sale.saleId}`)}>Continuer dans POS</button>}
        <button className="button compact-button" type="button" onClick={() => window.print()}>Imprimer Facture</button>
      </div>

        <CommentsPanel entityType="SALE" entityId={sale.saleId} />

        <div className="print-invoice">
          <h1>PharmaERP</h1>
          <p>Facture {sale.saleNumber}</p>
          <p>Date: {formatDate(sale.saleDate)}</p>
          <p>Client: {sale.customerName || 'Comptoir'}</p>
          <table><tbody>{items.map((item) => <tr key={item.saleItemId}><td>{item.commercialName}</td><td>{item.quantity}</td><td>{formatMoney(item.lineTotal, currencyCode, currencySymbol)}</td></tr>)}</tbody></table>
          <h2>Total: {formatMoney(sale.totalAmount, currencyCode, currencySymbol)}</h2>
          <p>Recu USD: {formatMoney(sale.amountPaidUsd ?? 0, 'USD', currencySymbol)}</p>
          <p>Rendu USD: {formatMoney(sale.amountReturnedUsd ?? 0, 'USD', currencySymbol)}</p>
          <p>Net USD: {formatMoney(sale.netReceivedUsd ?? 0, 'USD', currencySymbol)}</p>
          <p>Recu CDF: {formatMoney(sale.amountPaidCdf ?? 0, 'CDF')}</p>
          <p>Rendu CDF: {formatMoney(sale.amountReturnedCdf ?? 0, 'CDF')}</p>
          <p>Net CDF: {formatMoney(sale.netReceivedCdf ?? 0, 'CDF')}</p>
          <p>Merci pour votre confiance.</p>
        </div>
      </>}
    </div>
  );
}
