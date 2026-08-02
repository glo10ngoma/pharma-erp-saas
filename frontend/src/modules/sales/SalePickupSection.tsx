import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sale, salesService } from '../../services/sales.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';

type SalePickupSectionProps = {
  sale: Sale;
};

export function SalePickupSection({ sale }: SalePickupSectionProps) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const remainingItems = useMemo(() => {
    return (sale.items ?? []).map((item) => {
      const ordered = Number(item.orderedQuantity ?? item.quantity ?? 0);
      const fulfilled = Number(item.fulfilledQuantity ?? 0);
      const remaining = Math.max(0, roundMoney(ordered - fulfilled));
      return { ...item, ordered, fulfilled, remaining };
    });
  }, [sale.items]);

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    for (const item of remainingItems) {
      nextDrafts[item.saleItemId] = String(item.remaining);
    }
    setDrafts(nextDrafts);
  }, [remainingItems]);

  const confirmPickup = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setError('');
    const payloadItems = remainingItems
      .map((item) => ({
        saleItemId: item.saleItemId,
        quantity: Number(String(drafts[item.saleItemId] ?? item.remaining).replace(',', '.')),
      }))
      .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);

    if (!payloadItems.length) {
      setError('Indiquez au moins une quantite a livrer.');
      return;
    }

    for (const item of payloadItems) {
      const source = remainingItems.find((row) => row.saleItemId === item.saleItemId);
      if (!source) continue;
      if (item.quantity > source.remaining) {
        setError(`La quantite a livrer ne peut pas depasser le reste pour ${source.commercialName ?? 'la ligne'}.`);
        return;
      }
    }

    await salesService.confirmPickup(sale.saleId, {
      items: payloadItems,
    });
    await queryClient.invalidateQueries({ queryKey: ['sale', sale.saleId] });
    await queryClient.invalidateQueries({ queryKey: ['sales'] });
    await queryClient.invalidateQueries({ queryKey: ['sales-list'] });
    await queryClient.invalidateQueries({ queryKey: ['sales-summary'] });
  };

  if ((sale.saleMode ?? 'IMMEDIATE') !== 'ADVANCE' || sale.status !== 'VALIDATED') return null;

  return (
    <section className="detail-section sale-pickup-section">
      <div className="detail-section-header">
        <div>
          <h3>Jeton de retrait</h3>
          <p className="muted">
            {sale.fulfillmentStatus === 'FULFILLED'
              ? 'La livraison est complete.'
              : 'Confirmez la livraison lorsque le client retire tout ou partie de la commande.'}
          </p>
        </div>
        <div className="sale-pickup-badges">
          <span className="badge badge-info">Paiement en avance</span>
          <span className={`badge ${sale.fulfillmentStatus === 'FULFILLED' ? 'badge-success' : sale.fulfillmentStatus === 'PARTIALLY_FULFILLED' ? 'badge-warning' : 'badge-muted'}`}>
            {sale.fulfillmentStatus ?? 'NOT_FULFILLED'}
          </span>
        </div>
      </div>

      <div className="detail-grid sale-pickup-meta">
        <div><span>Jeton</span><strong>{sale.pickupToken ?? '-'}</strong></div>
        <div><span>Numero retrait</span><strong>{sale.pickupNumber ?? sale.saleNumber}</strong></div>
        <div><span>Site retrait</span><strong>{sale.siteName ?? '-'}</strong></div>
        <div><span>Date prevue</span><strong>{sale.expectedPickupDate ? formatDate(sale.expectedPickupDate) : 'A definir'}</strong></div>
        <div><span>Derniere livraison</span><strong>{sale.lastFulfillmentAt ? formatDate(sale.lastFulfillmentAt) : '-'}</strong></div>
      </div>

      <form className="sale-pickup-form" onSubmit={confirmPickup}>
        <div className="table-wrap">
          <table className="data-table sales-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Commande</th>
                <th>Livree</th>
                <th>Reste</th>
                <th>A livrer</th>
              </tr>
            </thead>
            <tbody>
              {remainingItems.length === 0 ? (
                <tr><td colSpan={5}>Aucune ligne.</td></tr>
              ) : remainingItems.map((item) => (
                <tr key={item.saleItemId}>
                  <td>{item.commercialName ?? '-'}</td>
                  <td className="numeric-text">{item.ordered}</td>
                  <td className="numeric-text">{item.fulfilled}</td>
                  <td className="numeric-text">{item.remaining}</td>
                  <td className="quantity-cell">
                    <input
                      className="input compact-input numeric-cell"
                      type="number"
                      min="0"
                      step="0.001"
                      value={drafts[item.saleItemId] ?? String(item.remaining)}
                      onChange={(event) => setDrafts((current) => ({ ...current, [item.saleItemId]: event.target.value }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button
            className="ghost-button compact-button"
            type="button"
            onClick={() => {
              const nextDrafts: Record<string, string> = {};
              for (const item of remainingItems) nextDrafts[item.saleItemId] = String(item.remaining);
              setDrafts(nextDrafts);
            }}
          >
            Tout livrer
          </button>
          <button className="button compact-button" type="submit" disabled={sale.fulfillmentStatus === 'FULFILLED'}>
            Confirmer la livraison
          </button>
        </div>
      </form>
    </section>
  );
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
