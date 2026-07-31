import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { CommentsPanel } from '../../components/CommentsPanel';
import { articlesService } from '../../services/articles.service';
import { apiErrorMessage } from '../../services/apiError';
import { cashService } from '../../services/cash.service';
import { purchaseReturnsService } from '../../services/purchaseReturns.service';
import { PurchaseAttachmentsCard } from './PurchaseAttachmentsCard';
import { purchasesService } from '../../services/purchases.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';

export function PurchaseReturnDetailPage() {
  const { id = '' } = useParams();
  const { permissions } = useAuth();
  const qc = useQueryClient();
  const [itemForm, setItemForm] = useState({ purchaseItemId: '', quantity: '1', returnUnitValue: '', reason: '', conditionStatus: 'GOOD' });
  const [replacementForm, setReplacementForm] = useState({ articleId: '', quantity: '1', conversionFactor: '1', lotNumber: '', expiryDate: '', unitValue: '' });
  const [settlementForm, setSettlementForm] = useState({ settlementKind: 'REFUND', paymentSource: 'CASH_REGISTER', currencyCode: 'USD', exchangeRateApplied: '1', amount: '', cashSessionId: '', reference: '', note: '' });

  const query = useQuery({ queryKey: ['purchase-return', id], queryFn: async () => (await purchaseReturnsService.getById(id)).data });
  const originalPurchase = useQuery({
    queryKey: ['purchase-for-return', query.data?.purchaseId],
    queryFn: async () => (await purchasesService.getById(query.data!.purchaseId)).data,
    enabled: Boolean(query.data?.purchaseId),
  });
  const articleOptions = useQuery({ queryKey: ['articles-return', 100], queryFn: async () => {
    const response = await articlesService.getAll({ limit: 100 });
    const payload = response.data as unknown as { items?: any[]; data?: { items?: any[] } } | any[];
    return Array.isArray(payload) ? payload : payload.items ?? payload.data?.items ?? [];
  }});
  const currentCashSession = useQuery({
    queryKey: ['cash-session-current-return', query.data?.siteId],
    queryFn: async () => (await cashService.getCurrentSession(query.data!.siteId)).data,
    enabled: Boolean(query.data?.siteId),
  });

  const addItem = useMutation({
    mutationFn: () => {
      const selected = originalPurchase.data?.items?.find((entry) => entry.purchaseItemId === itemForm.purchaseItemId);
      if (!selected?.lotId) throw new Error('Lot introuvable pour cette ligne achat.');
      return purchaseReturnsService.addItem(id, {
        purchaseItemId: selected.purchaseItemId,
        articleId: selected.articleId,
        lotId: selected.lotId,
        returnedPurchaseQuantity: Number(itemForm.quantity),
        returnUnitValue: itemForm.returnUnitValue ? Number(itemForm.returnUnitValue) : undefined,
        reason: itemForm.reason || undefined,
        conditionStatus: itemForm.conditionStatus,
      });
    },
    onSuccess: async () => {
      setItemForm({ purchaseItemId: '', quantity: '1', returnUnitValue: '', reason: '', conditionStatus: 'GOOD' });
      await qc.invalidateQueries({ queryKey: ['purchase-return', id] });
    },
  });
  const removeItem = useMutation({
    mutationFn: (itemId: string) => purchaseReturnsService.removeItem(id, itemId),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['purchase-return', id] }); },
  });
  const addReplacement = useMutation({
    mutationFn: () => purchaseReturnsService.addReplacement(id, {
      articleId: replacementForm.articleId,
      receivedPurchaseQuantity: Number(replacementForm.quantity),
      conversionFactor: Number(replacementForm.conversionFactor || 1),
      lotNumber: replacementForm.lotNumber,
      expiryDate: replacementForm.expiryDate,
      unitValue: Number(replacementForm.unitValue),
    }),
    onSuccess: async () => {
      setReplacementForm({ articleId: '', quantity: '1', conversionFactor: '1', lotNumber: '', expiryDate: '', unitValue: '' });
      await qc.invalidateQueries({ queryKey: ['purchase-return', id] });
    },
  });
  const removeReplacement = useMutation({
    mutationFn: (itemId: string) => purchaseReturnsService.removeReplacement(id, itemId),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['purchase-return', id] }); },
  });
  const addSettlement = useMutation({
    mutationFn: () => purchaseReturnsService.addSettlement(id, {
      settlementKind: settlementForm.settlementKind,
      paymentSource: settlementForm.paymentSource,
      currencyCode: settlementForm.currencyCode,
      exchangeRateApplied: Number(settlementForm.exchangeRateApplied || 1),
      amount: Number(settlementForm.amount),
      cashSessionId: settlementForm.paymentSource === 'CASH_REGISTER' ? settlementForm.cashSessionId || currentCashSession.data?.cashSessionId : undefined,
      reference: settlementForm.reference || undefined,
      note: settlementForm.note || undefined,
    }),
    onSuccess: async () => {
      setSettlementForm((current) => ({ ...current, amount: '', reference: '', note: '' }));
      await qc.invalidateQueries({ queryKey: ['purchase-return', id] });
    },
  });
  const removeSettlement = useMutation({
    mutationFn: (settlementId: string) => purchaseReturnsService.removeSettlement(id, settlementId),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['purchase-return', id] }); },
  });
  const validateReturn = useMutation({
    mutationFn: () => purchaseReturnsService.validate(id),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['purchase-return', id] }); },
  });
  const cancelReturn = useMutation({
    mutationFn: () => purchaseReturnsService.cancel(id),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['purchase-return', id] }); },
  });

  const current = query.data;
  const selectedPurchaseItem = useMemo(
    () => originalPurchase.data?.items?.find((entry) => entry.purchaseItemId === itemForm.purchaseItemId),
    [itemForm.purchaseItemId, originalPurchase.data?.items],
  );
  const canEdit = current?.status === 'DRAFT';
  const errorText = [
    query.isError ? apiErrorMessage(query.error) : '',
    addItem.isError ? apiErrorMessage(addItem.error) : '',
    addReplacement.isError ? apiErrorMessage(addReplacement.error) : '',
    addSettlement.isError ? apiErrorMessage(addSettlement.error) : '',
    validateReturn.isError ? apiErrorMessage(validateReturn.error) : '',
    cancelReturn.isError ? apiErrorMessage(cancelReturn.error) : '',
    removeItem.isError ? apiErrorMessage(removeItem.error) : '',
    removeReplacement.isError ? apiErrorMessage(removeReplacement.error) : '',
    removeSettlement.isError ? apiErrorMessage(removeSettlement.error) : '',
  ].find(Boolean);

  function submitItem(event: FormEvent) {
    event.preventDefault();
    addItem.mutate();
  }
  function submitReplacement(event: FormEvent) {
    event.preventDefault();
    addReplacement.mutate();
  }
  function submitSettlement(event: FormEvent) {
    event.preventDefault();
    addSettlement.mutate();
  }

  return <>
    <div className="breadcrumb"><Link to="/purchases">Achats</Link><span>&gt;</span><Link to={current ? `/purchases/${current.purchaseId}` : '/purchases'}>Achat</Link><span>&gt;</span><strong>Retour fournisseur</strong></div>
    <h1>Retour fournisseur</h1>
    {errorText ? <p className="form-error">{errorText}</p> : null}
    {!current ? (
      <div className="card">{query.isLoading ? 'Chargement...' : 'Retour introuvable.'}</div>
    ) : (
      <>
        <div className="card detail-grid">
          <div><span>Reference</span><strong>{current.returnNumber}</strong></div>
          <div><span>Date</span><strong>{formatDate(current.returnDate)}</strong></div>
          <div><span>Achat initial</span><strong>{current.purchaseNumber ?? current.purchaseId}</strong></div>
          <div><span>Fournisseur</span><strong>{current.supplierName ?? '-'}</strong></div>
          <div><span>Site</span><strong>{current.siteName ?? '-'}</strong></div>
          <div><span>Statut</span><strong>{current.status}</strong></div>
          <div><span>Type</span><strong>{current.returnType}</strong></div>
          <div><span>Valeur retour</span><strong>{formatMoney(current.returnedValueUsd, 'USD')}</strong></div>
          <div><span>Valeur echange</span><strong>{formatMoney(current.replacementValueUsd, 'USD')}</strong></div>
          <div><span>Difference</span><strong>{formatMoney(current.financialDifferenceUsd, 'USD')}</strong></div>
          <div><span>Remboursement du</span><strong>{formatMoney(current.refundDueUsd, 'USD')}</strong></div>
          <div><span>Complement du</span><strong>{formatMoney(current.additionalPaymentDueUsd, 'USD')}</strong></div>
        </div>

        {canEdit ? (
          <>
            <div className="card">
              <h2>Produits retournes</h2>
              <form className="modal-form" onSubmit={submitItem}>
                <label className="field-block"><span>Ligne achat</span><select className="input" value={itemForm.purchaseItemId} onChange={(event) => setItemForm((currentValue) => ({ ...currentValue, purchaseItemId: event.target.value }))}>
                  <option value="">Selectionner une ligne</option>
                  {(originalPurchase.data?.items ?? []).map((item) => (
                    <option key={item.purchaseItemId} value={item.purchaseItemId}>
                      {item.commercialName} | Lot {item.lotNumber} | Qté achat {item.purchaseQuantity ?? item.quantity}
                    </option>
                  ))}
                </select></label>
                <label className="field-block"><span>Qté retour</span><input className="input" type="number" min="0.001" step="0.001" value={itemForm.quantity} onChange={(event) => setItemForm((currentValue) => ({ ...currentValue, quantity: event.target.value }))} /></label>
                <label className="field-block"><span>Valeur unitaire</span><input className="input" type="number" min="0" step="0.01" placeholder={selectedPurchaseItem ? String(selectedPurchaseItem.purchaseUnitPrice) : 'Valeur'} value={itemForm.returnUnitValue} onChange={(event) => setItemForm((currentValue) => ({ ...currentValue, returnUnitValue: event.target.value }))} /></label>
                <label className="field-block"><span>Etat</span><select className="input" value={itemForm.conditionStatus} onChange={(event) => setItemForm((currentValue) => ({ ...currentValue, conditionStatus: event.target.value }))}>
                  <option value="GOOD">GOOD</option>
                  <option value="DAMAGED">DAMAGED</option>
                  <option value="EXPIRED">EXPIRED</option>
                  <option value="NON_COMPLIANT">NON_COMPLIANT</option>
                  <option value="WRONG_PRODUCT">WRONG_PRODUCT</option>
                  <option value="OTHER">OTHER</option>
                </select></label>
                <label className="field-block"><span>Motif</span><input className="input" value={itemForm.reason} onChange={(event) => setItemForm((currentValue) => ({ ...currentValue, reason: event.target.value }))} /></label>
                <button className="button compact-button" type="submit" disabled={addItem.isPending}>Ajouter ligne retour</button>
              </form>
            </div>

            <div className="card">
              <h2>Produits recus en echange</h2>
              <form className="modal-form" onSubmit={submitReplacement}>
                <label className="field-block"><span>Article</span><select className="input" value={replacementForm.articleId} onChange={(event) => setReplacementForm((currentValue) => ({ ...currentValue, articleId: event.target.value }))}>
                  <option value="">Selectionner article</option>
                  {(articleOptions.data ?? []).map((article: any) => <option key={article.articleId} value={article.articleId}>{article.articleCode} - {article.commercialName}</option>)}
                </select></label>
                <label className="field-block"><span>Qté achat</span><input className="input" type="number" min="0.001" step="0.001" value={replacementForm.quantity} onChange={(event) => setReplacementForm((currentValue) => ({ ...currentValue, quantity: event.target.value }))} /></label>
                <label className="field-block"><span>Facteur</span><input className="input" type="number" min="0.0001" step="0.0001" value={replacementForm.conversionFactor} onChange={(event) => setReplacementForm((currentValue) => ({ ...currentValue, conversionFactor: event.target.value }))} /></label>
                <label className="field-block"><span>Lot</span><input className="input" value={replacementForm.lotNumber} onChange={(event) => setReplacementForm((currentValue) => ({ ...currentValue, lotNumber: event.target.value }))} /></label>
                <label className="field-block"><span>Expiration</span><input className="input" type="date" value={replacementForm.expiryDate} onChange={(event) => setReplacementForm((currentValue) => ({ ...currentValue, expiryDate: event.target.value }))} /></label>
                <label className="field-block"><span>Valeur unitaire</span><input className="input" type="number" min="0" step="0.01" value={replacementForm.unitValue} onChange={(event) => setReplacementForm((currentValue) => ({ ...currentValue, unitValue: event.target.value }))} /></label>
                <button className="button compact-button" type="submit" disabled={addReplacement.isPending}>Ajouter echange</button>
              </form>
            </div>

            <div className="card">
              <h2>Regularisation financiere</h2>
              <form className="modal-form" onSubmit={submitSettlement}>
                <label className="field-block"><span>Type</span><select className="input" value={settlementForm.settlementKind} onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, settlementKind: event.target.value }))}>
                  <option value="REFUND">REFUND</option>
                  <option value="ADDITIONAL_PAYMENT">ADDITIONAL_PAYMENT</option>
                  <option value="SUPPLIER_CREDIT">SUPPLIER_CREDIT</option>
                </select></label>
                <label className="field-block"><span>Source</span><select className="input" value={settlementForm.paymentSource} onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, paymentSource: event.target.value }))}>
                  <option value="CASH_REGISTER">CASH_REGISTER</option>
                  <option value="BANK">BANK</option>
                  <option value="MOBILE_MONEY">MOBILE_MONEY</option>
                  <option value="SUPPLIER_CREDIT">SUPPLIER_CREDIT</option>
                  <option value="OTHER">OTHER</option>
                </select></label>
                <label className="field-block"><span>Devise</span><select className="input" value={settlementForm.currencyCode} onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, currencyCode: event.target.value }))}><option value="USD">USD</option><option value="CDF">CDF</option></select></label>
                <label className="field-block"><span>Taux</span><input className="input" type="number" min="0.0001" step="0.0001" value={settlementForm.currencyCode === 'USD' ? '1' : settlementForm.exchangeRateApplied} disabled={settlementForm.currencyCode === 'USD'} onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, exchangeRateApplied: event.target.value }))} /></label>
                <label className="field-block"><span>Montant</span><input className="input" type="number" min="0.01" step="0.01" value={settlementForm.amount} onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, amount: event.target.value }))} /></label>
                <label className="field-block"><span>Session caisse</span><select className="input" value={settlementForm.cashSessionId || currentCashSession.data?.cashSessionId || ''} disabled={settlementForm.paymentSource !== 'CASH_REGISTER'} onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, cashSessionId: event.target.value }))}>
                  <option value="">Sans caisse</option>
                  {currentCashSession.data ? <option value={currentCashSession.data.cashSessionId}>{currentCashSession.data.registerName ?? 'Caisse'}</option> : null}
                </select></label>
                <label className="field-block"><span>Reference</span><input className="input" value={settlementForm.reference} onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, reference: event.target.value }))} /></label>
                <label className="field-block"><span>Note</span><input className="input" value={settlementForm.note} onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, note: event.target.value }))} /></label>
                <button className="button compact-button" type="submit" disabled={addSettlement.isPending}>Ajouter regularisation</button>
              </form>
            </div>
          </>
        ) : null}

        <div className="card">
          <div className="toolbar compact-toolbar"><h2>Lignes retour</h2>{canEdit ? null : <span className="badge compact-badge badge-muted">{current.status}</span>}</div>
          {!(current.items ?? []).length ? <p className="muted">Aucune ligne retour.</p> : (
            <table className="data-table purchase-detail-table">
              <thead><tr><th>Article</th><th>Lot</th><th>Qté achat</th><th>Qté stock</th><th>Valeur</th><th>Etat</th><th>Motif</th><th>Actions</th></tr></thead>
              <tbody>{(current.items ?? []).map((item) => (
                <tr key={item.purchaseReturnItemId}>
                  <td>{item.commercialName}</td>
                  <td>{item.lotNumber}</td>
                  <td className="quantity-cell">{item.returnedPurchaseQuantity}</td>
                  <td className="quantity-cell">{item.returnedStockQuantity}</td>
                  <td className="numeric-text">{formatMoney(item.lineReturnValue, 'USD')}</td>
                  <td>{item.conditionStatus}</td>
                  <td>{item.reason ?? '-'}</td>
                  <td>{canEdit ? <button className="ghost-button compact-button" onClick={() => removeItem.mutate(item.purchaseReturnItemId)}>Supprimer</button> : '-'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Lignes echange</h2>
          {!(current.replacementItems ?? []).length ? <p className="muted">Aucun produit recu en echange.</p> : (
            <table className="data-table purchase-detail-table">
              <thead><tr><th>Article</th><th>Lot</th><th>Expiration</th><th>Qté achat</th><th>Qté stock</th><th>Valeur</th><th>Actions</th></tr></thead>
              <tbody>{(current.replacementItems ?? []).map((item) => (
                <tr key={item.purchaseReturnReplacementItemId}>
                  <td>{item.commercialName}</td>
                  <td>{item.lotNumber}</td>
                  <td>{formatDate(item.expiryDate)}</td>
                  <td className="quantity-cell">{item.receivedPurchaseQuantity}</td>
                  <td className="quantity-cell">{item.receivedStockQuantity}</td>
                  <td className="numeric-text">{formatMoney(item.lineValue, 'USD')}</td>
                  <td>{canEdit ? <button className="ghost-button compact-button" onClick={() => removeReplacement.mutate(item.purchaseReturnReplacementItemId)}>Supprimer</button> : '-'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Regularisations</h2>
          {!(current.settlements ?? []).length ? <p className="muted">Aucune regularisation enregistree.</p> : (
            <table className="data-table purchase-detail-table">
              <thead><tr><th>Type</th><th>Source</th><th>Devise</th><th>Montant</th><th>Eq. USD</th><th>Reference</th><th>Actions</th></tr></thead>
              <tbody>{(current.settlements ?? []).map((settlement) => (
                <tr key={settlement.purchaseReturnSettlementId}>
                  <td>{settlement.settlementKind}</td>
                  <td>{settlement.paymentSource}</td>
                  <td>{settlement.currencyCode}</td>
                  <td className="numeric-text">{formatMoney(settlement.amount, settlement.currencyCode)}</td>
                  <td className="numeric-text">{formatMoney(settlement.amountEquivalentUsd, 'USD')}</td>
                  <td>{settlement.reference ?? '-'}</td>
                  <td>{canEdit ? <button className="ghost-button compact-button" onClick={() => removeSettlement.mutate(settlement.purchaseReturnSettlementId)}>Supprimer</button> : '-'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        <PurchaseAttachmentsCard
          title="Justificatifs du retour"
          queryKey={['purchase-return-attachments', id]}
          api={{
            list: () => purchaseReturnsService.getAttachments(id),
            upload: (payload) => purchaseReturnsService.uploadAttachment(id, payload),
            openUrl: (attachmentId) => purchaseReturnsService.getAttachmentUrl(id, attachmentId),
            remove: (attachmentId) => purchaseReturnsService.deleteAttachment(id, attachmentId),
          }}
          canCreate={permissions.includes('purchase_attachments.create')}
          canDelete={permissions.includes('purchase_attachments.delete')}
        />

        <div className="page-actions">
          <Link className="ghost-button compact-button" to={current ? `/purchases/${current.purchaseId}` : '/purchases'}>Retour achat</Link>
          {canEdit ? <button className="ghost-button compact-button" type="button" onClick={() => cancelReturn.mutate()} disabled={cancelReturn.isPending}>Annuler retour</button> : null}
          {canEdit ? <button className="button compact-button" type="button" onClick={() => validateReturn.mutate()} disabled={validateReturn.isPending || !(current.items ?? []).length}>{validateReturn.isPending ? 'Validation...' : 'Valider retour'}</button> : null}
        </div>

        <CommentsPanel entityType="PURCHASE_RETURN" entityId={current.purchaseReturnId} />
      </>
    )}
  </>;
}
