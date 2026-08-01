import { FormEvent, KeyboardEvent, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { CommentsPanel } from '../../components/CommentsPanel';
import { articlesService } from '../../services/articles.service';
import { apiErrorMessage } from '../../services/apiError';
import { cashService } from '../../services/cash.service';
import { purchaseReturnsService } from '../../services/purchaseReturns.service';
import { purchasesService } from '../../services/purchases.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';

const LazyPurchaseAttachmentsCard = lazy(() =>
  import('./PurchaseAttachmentsCard').then((module) => ({ default: module.PurchaseAttachmentsCard })),
);

type WizardStep = 1 | 2 | 3 | 4 | 5;

type ItemFormState = {
  purchaseItemId: string;
  quantity: string;
  returnUnitValue: string;
  reason: string;
  conditionStatus: string;
};

type ReplacementFormState = {
  articleId: string;
  quantity: string;
  conversionFactor: string;
  lotNumber: string;
  expiryDate: string;
  unitValue: string;
};

type SettlementFormState = {
  settlementKind: string;
  paymentSource: string;
  currencyCode: string;
  exchangeRateApplied: string;
  amount: string;
  cashSessionId: string;
  reference: string;
  note: string;
};

const returnWizardStorageKey = (id: string) => `purchase-return-wizard:${id}`;

function isWizardStep(value: unknown): value is WizardStep {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export function PurchaseReturnDetailPage() {
  const { id = '' } = useParams();
  const { permissions } = useAuth();
  const qc = useQueryClient();
  const [activeStep, setActiveStep] = useState<WizardStep>(1);
  const [itemForm, setItemForm] = useState<ItemFormState>({
    purchaseItemId: '',
    quantity: '1',
    returnUnitValue: '',
    reason: '',
    conditionStatus: 'GOOD',
  });
  const [replacementForm, setReplacementForm] = useState<ReplacementFormState>({
    articleId: '',
    quantity: '1',
    conversionFactor: '1',
    lotNumber: '',
    expiryDate: '',
    unitValue: '',
  });
  const [settlementForm, setSettlementForm] = useState<SettlementFormState>({
    settlementKind: 'REFUND',
    paymentSource: 'CASH_REGISTER',
    currencyCode: 'USD',
    exchangeRateApplied: '1',
    amount: '',
    cashSessionId: '',
    reference: '',
    note: '',
  });

  const query = useQuery({ queryKey: ['purchase-return', id], queryFn: async () => (await purchaseReturnsService.getById(id)).data });
  const originalPurchase = useQuery({
    queryKey: ['purchase-for-return', query.data?.purchaseId],
    queryFn: async () => (await purchasesService.getById(query.data!.purchaseId)).data,
    enabled: Boolean(query.data?.purchaseId),
  });
  const articleOptions = useQuery({
    queryKey: ['articles-return', 100],
    queryFn: async () => {
      const response = await articlesService.getAll({ limit: 100 });
      const payload = response.data as unknown as { items?: any[]; data?: { items?: any[] } } | any[];
      return Array.isArray(payload) ? payload : payload.items ?? payload.data?.items ?? [];
    },
  });
  const currentCashSession = useQuery({
    queryKey: ['cash-session-current-return', query.data?.siteId],
    queryFn: async () => (await cashService.getCurrentSession(query.data!.siteId)).data,
    enabled: Boolean(query.data?.siteId),
  });

  useEffect(() => {
    if (!id || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(returnWizardStorageKey(id));
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        activeStep?: unknown;
        itemForm?: Partial<ItemFormState>;
        replacementForm?: Partial<ReplacementFormState>;
        settlementForm?: Partial<SettlementFormState>;
      };
      if (isWizardStep(parsed.activeStep)) setActiveStep(parsed.activeStep);
      if (parsed.itemForm) setItemForm((currentValue) => ({ ...currentValue, ...parsed.itemForm }));
      if (parsed.replacementForm) setReplacementForm((currentValue) => ({ ...currentValue, ...parsed.replacementForm }));
      if (parsed.settlementForm) setSettlementForm((currentValue) => ({ ...currentValue, ...parsed.settlementForm }));
    } catch {
      window.localStorage.removeItem(returnWizardStorageKey(id));
    }
  }, [id]);

  useEffect(() => {
    if (!id || typeof window === 'undefined') return;
    if (query.data && query.data.status !== 'DRAFT') {
      window.localStorage.removeItem(returnWizardStorageKey(id));
      return;
    }
    window.localStorage.setItem(returnWizardStorageKey(id), JSON.stringify({ activeStep, itemForm, replacementForm, settlementForm }));
  }, [activeStep, id, itemForm, query.data?.status, replacementForm, settlementForm]);

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
      setActiveStep(2);
      await qc.invalidateQueries({ queryKey: ['purchase-return', id] });
    },
  });
  const removeItem = useMutation({
    mutationFn: (itemId: string) => purchaseReturnsService.removeItem(id, itemId),
    onSuccess: async () => {
      setActiveStep((currentValue) => (currentValue > 1 ? 1 : currentValue));
      await qc.invalidateQueries({ queryKey: ['purchase-return', id] });
    },
  });
  const addReplacement = useMutation({
    mutationFn: () =>
      purchaseReturnsService.addReplacement(id, {
        articleId: replacementForm.articleId,
        receivedPurchaseQuantity: Number(replacementForm.quantity),
        conversionFactor: Number(replacementForm.conversionFactor || 1),
        lotNumber: replacementForm.lotNumber,
        expiryDate: replacementForm.expiryDate,
        unitValue: Number(replacementForm.unitValue),
      }),
    onSuccess: async () => {
      setReplacementForm({ articleId: '', quantity: '1', conversionFactor: '1', lotNumber: '', expiryDate: '', unitValue: '' });
      setActiveStep(3);
      await qc.invalidateQueries({ queryKey: ['purchase-return', id] });
    },
  });
  const removeReplacement = useMutation({
    mutationFn: (itemId: string) => purchaseReturnsService.removeReplacement(id, itemId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['purchase-return', id] });
    },
  });
  const addSettlement = useMutation({
    mutationFn: () =>
      purchaseReturnsService.addSettlement(id, {
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
      setSettlementForm((currentValue) => ({ ...currentValue, amount: '', reference: '', note: '' }));
      setActiveStep(4);
      await qc.invalidateQueries({ queryKey: ['purchase-return', id] });
    },
  });
  const removeSettlement = useMutation({
    mutationFn: (settlementId: string) => purchaseReturnsService.removeSettlement(id, settlementId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['purchase-return', id] });
    },
  });
  const validateReturn = useMutation({
    mutationFn: () => purchaseReturnsService.validate(id),
    onSuccess: async () => {
      clearWizardDraft();
      setActiveStep(5);
      await qc.invalidateQueries({ queryKey: ['purchase-return', id] });
    },
  });
  const cancelReturn = useMutation({
    mutationFn: () => purchaseReturnsService.cancel(id),
    onSuccess: async () => {
      clearWizardDraft();
      await qc.invalidateQueries({ queryKey: ['purchase-return', id] });
    },
  });

  const current = query.data;
  const purchaseLines = originalPurchase.data?.items ?? [];
  const returnLines = current?.items ?? [];
  const exchangeLines = current?.replacementItems ?? [];
  const settlementLines = current?.settlements ?? [];
  const selectedPurchaseItem = useMemo(
    () => purchaseLines.find((entry) => entry.purchaseItemId === itemForm.purchaseItemId),
    [itemForm.purchaseItemId, purchaseLines],
  );
  const canEdit = current?.status === 'DRAFT';
  const stepCompletion = useMemo(
    () => ({
      productsReturned: returnLines.length > 0,
      productsExchanged: exchangeLines.length > 0,
      settled: settlementLines.length > 0,
      validated: current?.status === 'VALIDATED',
    }),
    [current?.status, exchangeLines.length, returnLines.length, settlementLines.length],
  );
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

  useEffect(() => {
    if (!current || current.status !== 'DRAFT') return;
    if (!stepCompletion.productsReturned && activeStep > 1) {
      setActiveStep(1);
    }
  }, [activeStep, current, stepCompletion.productsReturned]);

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

  function clearWizardDraft() {
    if (typeof window === 'undefined' || !id) return;
    window.localStorage.removeItem(returnWizardStorageKey(id));
  }

  function goToStep(step: WizardStep) {
    setActiveStep(step);
  }

  function handleStepKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goToStep((Math.min(5, activeStep + 1) as WizardStep));
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goToStep((Math.max(1, activeStep - 1) as WizardStep));
    }
  }

  function stepStatus(step: WizardStep) {
    if (step === activeStep) return 'Courante';
    if (step === 1) return stepCompletion.productsReturned ? 'Complete' : 'A completer';
    if (step === 2) return stepCompletion.productsExchanged ? 'Complete' : 'A completer';
    if (step === 3) return stepCompletion.settled ? 'Complete' : 'A completer';
    if (step === 4) return 'Optionnelle';
    if (step === 5) return stepCompletion.validated ? 'Resume disponible' : 'A valider';
    return 'Etape';
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/purchases">Achats</Link>
        <span>&gt;</span>
        <Link to={current ? `/purchases/${current.purchaseId}` : '/purchases'}>Achat</Link>
        <span>&gt;</span>
        <strong>Retour fournisseur</strong>
      </div>
      <h1>Retour fournisseur</h1>
      {errorText ? <p className="form-error">{errorText}</p> : null}
      {!current ? (
        <div className="card">{query.isLoading ? 'Chargement...' : 'Retour introuvable.'}</div>
      ) : (
        <div className="purchase-return-wizard">
          <div className="card purchase-return-overview">
            <div className="detail-grid">
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
            <p className="muted purchase-return-draft-note">
              {current.status === 'DRAFT'
                ? 'Le brouillon est sauvegarde automatiquement. Vous pouvez reprendre le retour apres fermeture.'
                : 'Retour finalise. Les etapes restent consultables en lecture seule.'}
            </p>
          </div>

          <div className="card purchase-return-stepper-card">
            <div className="toolbar compact-toolbar">
              <div>
                <h2>Parcours guide</h2>
                <p className="muted">Navigation clavier possible avec les fleches gauche et droite.</p>
              </div>
              <span className="badge compact-badge badge-muted">
                {current.status === 'DRAFT' ? 'Brouillon auto-sauvegarde' : `Statut ${current.status}`}
              </span>
            </div>
            <div
              className="purchase-return-stepper"
              role="tablist"
              aria-label="Etapes du retour fournisseur"
              onKeyDown={handleStepKeyDown}
            >
              {([
                [1, 'Produits retournes', stepCompletion.productsReturned],
                [2, 'Produits recu en echange', stepCompletion.productsExchanged],
                [3, 'Regularisation financiere', stepCompletion.settled],
                [4, 'Pieces jointes', false],
                [5, 'Validation', stepCompletion.validated],
              ] as const).map(([step, label, completed]) => {
                const isActive = activeStep === step;
                return (
                  <button
                    key={step}
                    type="button"
                    role="tab"
                    id={`purchase-return-step-${step}`}
                    aria-controls={`purchase-return-panel-${step}`}
                    aria-selected={isActive}
                    aria-current={isActive ? 'step' : undefined}
                    className={`purchase-return-step${isActive ? ' is-active' : ''}${completed ? ' is-complete' : ''}`}
                    onClick={() => goToStep(step)}
                    tabIndex={0}
                  >
                    <span className="purchase-return-step-index">{step}</span>
                    <span className="purchase-return-step-label">{label}</span>
                    <small>{stepStatus(step)}</small>
                  </button>
                );
              })}
            </div>
          </div>

          {activeStep === 1 && (
            <section className="card purchase-return-step-section" id="purchase-return-panel-1" aria-labelledby="purchase-return-step-1">
              <div className="purchase-return-step-header">
                <div>
                  <h2>1. Produits retournes</h2>
                  <p className="muted">Choisissez la ligne d'achat et saisissez la quantite retournee.</p>
                </div>
                <div className="table-actions">
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(2)}>
                    Etape suivante
                  </button>
                </div>
              </div>

              <div className="purchase-return-split-grid">
                <div className="card compact-card purchase-return-inner-card">
                  <div className="toolbar compact-toolbar">
                    <h3>Lignes achat disponibles</h3>
                    <span className="badge compact-badge badge-muted">{purchaseLines.length} ligne(s)</span>
                  </div>
                  {purchaseLines.length === 0 ? (
                    <p className="muted">Aucune ligne achat disponible.</p>
                  ) : (
                    <div className="table-scroll purchase-return-table-scroll">
                      <table className="data-table purchase-detail-table purchase-return-source-table">
                        <thead>
                          <tr>
                            <th>Article</th>
                            <th>Lot</th>
                            <th>Expiration</th>
                            <th>Qté achat</th>
                            <th>Unite achat</th>
                            <th>PA</th>
                            <th>PV</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchaseLines.map((item) => (
                            <tr key={item.purchaseItemId}>
                              <td>{item.commercialName}</td>
                              <td>{item.lotNumber}</td>
                              <td>{formatDate(item.expiryDate)}</td>
                              <td className="quantity-cell">{item.purchaseQuantity ?? item.quantity}</td>
                              <td>{item.purchaseUnitLabelSnapshot ?? '-'}</td>
                              <td className="numeric-text">{formatMoney(item.purchaseUnitPrice, current.currencyCode ?? 'USD')}</td>
                              <td className="numeric-text">{formatMoney(item.sellingUnitPrice, current.currencyCode ?? 'USD')}</td>
                              <td className="numeric-text">{formatMoney(item.lineTotal, current.currencyCode ?? 'USD')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="card compact-card purchase-return-inner-card">
                  <div className="toolbar compact-toolbar">
                    <h3>Ligne retour active</h3>
                    <span className="badge compact-badge badge-muted">{itemForm.purchaseItemId ? 'Prete' : 'A completer'}</span>
                  </div>
                  {canEdit ? (
                    <form className="modal-form" onSubmit={submitItem}>
                      <label className="field-block">
                        <span>Ligne achat</span>
                        <select
                          className="input"
                          value={itemForm.purchaseItemId}
                          onChange={(event) => setItemForm((currentValue) => ({ ...currentValue, purchaseItemId: event.target.value }))}
                        >
                          <option value="">Selectionner une ligne</option>
                          {purchaseLines.map((item) => (
                            <option key={item.purchaseItemId} value={item.purchaseItemId}>
                              {item.commercialName} | Lot {item.lotNumber} | Qté achat {item.purchaseQuantity ?? item.quantity}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-block">
                        <span>Qté retour</span>
                        <input
                          className="input"
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={itemForm.quantity}
                          onChange={(event) => setItemForm((currentValue) => ({ ...currentValue, quantity: event.target.value }))}
                        />
                      </label>
                      <label className="field-block">
                        <span>Valeur unitaire</span>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder={selectedPurchaseItem ? String(selectedPurchaseItem.purchaseUnitPrice) : 'Valeur'}
                          value={itemForm.returnUnitValue}
                          onChange={(event) => setItemForm((currentValue) => ({ ...currentValue, returnUnitValue: event.target.value }))}
                        />
                      </label>
                      <label className="field-block">
                        <span>Etat</span>
                        <select
                          className="input"
                          value={itemForm.conditionStatus}
                          onChange={(event) => setItemForm((currentValue) => ({ ...currentValue, conditionStatus: event.target.value }))}
                        >
                          <option value="GOOD">GOOD</option>
                          <option value="DAMAGED">DAMAGED</option>
                          <option value="EXPIRED">EXPIRED</option>
                          <option value="NON_COMPLIANT">NON_COMPLIANT</option>
                          <option value="WRONG_PRODUCT">WRONG_PRODUCT</option>
                          <option value="OTHER">OTHER</option>
                        </select>
                      </label>
                      <label className="field-block">
                        <span>Motif</span>
                        <input
                          className="input"
                          value={itemForm.reason}
                          onChange={(event) => setItemForm((currentValue) => ({ ...currentValue, reason: event.target.value }))}
                        />
                      </label>
                      <div className="modal-actions">
                        <button className="button compact-button" type="submit" disabled={addItem.isPending || !itemForm.purchaseItemId}>
                          {addItem.isPending ? 'Ajout...' : 'Ajouter ligne retour'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="muted">Cette etape est en lecture seule pour le retour valide.</p>
                  )}
                </div>
              </div>

              <div className="card compact-card">
                <div className="toolbar compact-toolbar">
                  <h3>Produits retournes enregistres</h3>
                  <span className="badge compact-badge badge-muted">{returnLines.length}</span>
                </div>
                {returnLines.length === 0 ? (
                  <p className="muted">Aucune ligne retour.</p>
                ) : (
                  <div className="table-scroll">
                    <table className="data-table purchase-detail-table">
                      <thead>
                        <tr>
                          <th>Article</th>
                          <th>Lot</th>
                          <th>Qté achat</th>
                          <th>Qté stock</th>
                          <th>Valeur</th>
                          <th>Etat</th>
                          <th>Motif</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnLines.map((item) => (
                          <tr key={item.purchaseReturnItemId}>
                            <td>{item.commercialName}</td>
                            <td>{item.lotNumber}</td>
                            <td className="quantity-cell">{item.returnedPurchaseQuantity}</td>
                            <td className="quantity-cell">{item.returnedStockQuantity}</td>
                            <td className="numeric-text">{formatMoney(item.lineReturnValue, 'USD')}</td>
                            <td>{item.conditionStatus}</td>
                            <td>{item.reason ?? '-'}</td>
                            <td>{canEdit ? <button className="ghost-button compact-button" type="button" onClick={() => removeItem.mutate(item.purchaseReturnItemId)}>Supprimer</button> : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="purchase-return-step-actions">
                <button className="ghost-button compact-button" type="button" onClick={() => goToStep(5)}>
                  Passer a la validation
                </button>
              </div>
            </section>
          )}

          {activeStep === 2 && (
            <section className="card purchase-return-step-section" id="purchase-return-panel-2" aria-labelledby="purchase-return-step-2">
              <div className="purchase-return-step-header">
                <div>
                  <h2>2. Produits recu en echange</h2>
                  <p className="muted">Ajoutez les produits obtenus en echange avant la regularisation financiere.</p>
                </div>
                <div className="table-actions">
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(1)}>
                    Etape precedente
                  </button>
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(3)}>
                    Etape suivante
                  </button>
                </div>
              </div>

              {returnLines.length === 0 ? (
                <div className="form-summary">
                  <span>Aucun produit retourne n'est encore enregistre. Vous pouvez preparer les produits recus en echange, mais les calculs definitifs seront disponibles apres l'ajout des produits retournes.</span>
                </div>
              ) : null}

              <div className="purchase-return-split-grid">
                <div className="card compact-card purchase-return-inner-card">
                  <div className="toolbar compact-toolbar">
                    <h3>Ligne echange</h3>
                    <span className="badge compact-badge badge-muted">{replacementForm.articleId ? 'Prete' : 'A completer'}</span>
                  </div>
                  {canEdit ? (
                    <form className="modal-form" onSubmit={submitReplacement}>
                      <label className="field-block">
                        <span>Article</span>
                        <select
                          className="input"
                          value={replacementForm.articleId}
                          onChange={(event) => setReplacementForm((currentValue) => ({ ...currentValue, articleId: event.target.value }))}
                        >
                          <option value="">Selectionner article</option>
                          {(articleOptions.data ?? []).map((article: any) => (
                            <option key={article.articleId} value={article.articleId}>
                              {article.articleCode} - {article.commercialName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-block">
                        <span>Qté achat</span>
                        <input
                          className="input"
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={replacementForm.quantity}
                          onChange={(event) => setReplacementForm((currentValue) => ({ ...currentValue, quantity: event.target.value }))}
                        />
                      </label>
                      <label className="field-block">
                        <span>Facteur</span>
                        <input
                          className="input"
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          value={replacementForm.conversionFactor}
                          onChange={(event) => setReplacementForm((currentValue) => ({ ...currentValue, conversionFactor: event.target.value }))}
                        />
                      </label>
                      <label className="field-block">
                        <span>Lot</span>
                        <input
                          className="input"
                          value={replacementForm.lotNumber}
                          onChange={(event) => setReplacementForm((currentValue) => ({ ...currentValue, lotNumber: event.target.value }))}
                        />
                      </label>
                      <label className="field-block">
                        <span>Expiration</span>
                        <input
                          className="input"
                          type="date"
                          value={replacementForm.expiryDate}
                          onChange={(event) => setReplacementForm((currentValue) => ({ ...currentValue, expiryDate: event.target.value }))}
                        />
                      </label>
                      <label className="field-block">
                        <span>Valeur unitaire</span>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={replacementForm.unitValue}
                          onChange={(event) => setReplacementForm((currentValue) => ({ ...currentValue, unitValue: event.target.value }))}
                        />
                      </label>
                      <div className="modal-actions">
                        <button className="button compact-button" type="submit" disabled={addReplacement.isPending || !replacementForm.articleId}>
                          {addReplacement.isPending ? 'Ajout...' : 'Ajouter echange'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="muted">Cette etape est en lecture seule pour le retour valide.</p>
                  )}
                </div>

                <div className="card compact-card purchase-return-inner-card">
                  <div className="toolbar compact-toolbar">
                    <h3>Lignes echange enregistrees</h3>
                    <span className="badge compact-badge badge-muted">{exchangeLines.length}</span>
                  </div>
                  {exchangeLines.length === 0 ? (
                    <p className="muted">Aucun produit recu en echange.</p>
                  ) : (
                    <div className="table-scroll">
                      <table className="data-table purchase-detail-table">
                        <thead>
                          <tr>
                            <th>Article</th>
                            <th>Lot</th>
                            <th>Expiration</th>
                            <th>Qté achat</th>
                            <th>Qté stock</th>
                            <th>Valeur</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exchangeLines.map((item) => (
                            <tr key={item.purchaseReturnReplacementItemId}>
                              <td>{item.commercialName}</td>
                              <td>{item.lotNumber}</td>
                              <td>{formatDate(item.expiryDate)}</td>
                              <td className="quantity-cell">{item.receivedPurchaseQuantity}</td>
                              <td className="quantity-cell">{item.receivedStockQuantity}</td>
                              <td className="numeric-text">{formatMoney(item.lineValue, 'USD')}</td>
                              <td>{canEdit ? <button className="ghost-button compact-button" type="button" onClick={() => removeReplacement.mutate(item.purchaseReturnReplacementItemId)}>Supprimer</button> : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {activeStep === 3 && (
            <section className="card purchase-return-step-section" id="purchase-return-panel-3" aria-labelledby="purchase-return-step-3">
              <div className="purchase-return-step-header">
                <div>
                  <h2>3. Regularisation financiere</h2>
                  <p className="muted">Controlez le remboursement, le complement ou la creance fournisseur.</p>
                </div>
                <div className="table-actions">
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(2)}>
                    Etape precedente
                  </button>
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(4)}>
                    Etape suivante
                  </button>
                </div>
              </div>

              {returnLines.length === 0 || exchangeLines.length === 0 ? (
                <div className="form-summary">
                  <span>La regularisation definitive sera calculee lorsque les produits retournes et les produits recus auront ete renseignes.</span>
                </div>
              ) : null}

              <div className="detail-grid purchase-return-financial-grid">
                <div><span>Valeur retour</span><strong>{formatMoney(current.returnedValueUsd, 'USD')}</strong></div>
                <div><span>Valeur echange</span><strong>{formatMoney(current.replacementValueUsd, 'USD')}</strong></div>
                <div><span>Difference</span><strong>{formatMoney(current.financialDifferenceUsd, 'USD')}</strong></div>
                <div><span>Remboursement du</span><strong>{formatMoney(current.refundDueUsd, 'USD')}</strong></div>
                <div><span>Complement du</span><strong>{formatMoney(current.additionalPaymentDueUsd, 'USD')}</strong></div>
                <div><span>Credit fournisseur</span><strong>{formatMoney(current.supplierCreditUsd, 'USD')}</strong></div>
              </div>

              <div className="purchase-return-split-grid">
                <div className="card compact-card purchase-return-inner-card">
                  <div className="toolbar compact-toolbar">
                    <h3>Regularisation active</h3>
                    <span className="badge compact-badge badge-muted">{settlementForm.settlementKind}</span>
                  </div>
                  {canEdit ? (
                    <form className="modal-form" onSubmit={submitSettlement}>
                      <label className="field-block">
                        <span>Type</span>
                        <select
                          className="input"
                          value={settlementForm.settlementKind}
                          onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, settlementKind: event.target.value }))}
                        >
                          <option value="REFUND">REFUND</option>
                          <option value="ADDITIONAL_PAYMENT">ADDITIONAL_PAYMENT</option>
                          <option value="SUPPLIER_CREDIT">SUPPLIER_CREDIT</option>
                        </select>
                      </label>
                      <label className="field-block">
                        <span>Source</span>
                        <select
                          className="input"
                          value={settlementForm.paymentSource}
                          onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, paymentSource: event.target.value }))}
                        >
                          <option value="CASH_REGISTER">CASH_REGISTER</option>
                          <option value="BANK">BANK</option>
                          <option value="MOBILE_MONEY">MOBILE_MONEY</option>
                          <option value="SUPPLIER_CREDIT">SUPPLIER_CREDIT</option>
                          <option value="OTHER">OTHER</option>
                        </select>
                      </label>
                      <label className="field-block">
                        <span>Devise</span>
                        <select
                          className="input"
                          value={settlementForm.currencyCode}
                          onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, currencyCode: event.target.value }))}
                        >
                          <option value="USD">USD</option>
                          <option value="CDF">CDF</option>
                        </select>
                      </label>
                      <label className="field-block">
                        <span>Taux</span>
                        <input
                          className="input"
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          value={settlementForm.currencyCode === 'USD' ? '1' : settlementForm.exchangeRateApplied}
                          disabled={settlementForm.currencyCode === 'USD'}
                          onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, exchangeRateApplied: event.target.value }))}
                        />
                      </label>
                      <label className="field-block">
                        <span>Montant</span>
                        <input
                          className="input"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={settlementForm.amount}
                          onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, amount: event.target.value }))}
                        />
                      </label>
                      <label className="field-block">
                        <span>Session caisse</span>
                        <select
                          className="input"
                          value={settlementForm.cashSessionId || currentCashSession.data?.cashSessionId || ''}
                          disabled={settlementForm.paymentSource !== 'CASH_REGISTER'}
                          onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, cashSessionId: event.target.value }))}
                        >
                          <option value="">Sans caisse</option>
                          {currentCashSession.data ? <option value={currentCashSession.data.cashSessionId}>{currentCashSession.data.registerName ?? 'Caisse'}</option> : null}
                        </select>
                      </label>
                      <label className="field-block">
                        <span>Reference</span>
                        <input
                          className="input"
                          value={settlementForm.reference}
                          onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, reference: event.target.value }))}
                        />
                      </label>
                      <label className="field-block">
                        <span>Note</span>
                        <input
                          className="input"
                          value={settlementForm.note}
                          onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, note: event.target.value }))}
                        />
                      </label>
                      <div className="modal-actions">
                        <button className="button compact-button" type="submit" disabled={addSettlement.isPending || !settlementForm.amount}>
                          {addSettlement.isPending ? 'Ajout...' : 'Ajouter regularisation'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="muted">Cette etape est en lecture seule pour le retour valide.</p>
                  )}
                </div>

                <div className="card compact-card purchase-return-inner-card">
                  <div className="toolbar compact-toolbar">
                    <h3>Regularisations enregistrees</h3>
                    <span className="badge compact-badge badge-muted">{settlementLines.length}</span>
                  </div>
                  {settlementLines.length === 0 ? (
                    <p className="muted">Aucune regularisation enregistree.</p>
                  ) : (
                    <div className="table-scroll">
                      <table className="data-table purchase-detail-table">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Source</th>
                            <th>Devise</th>
                            <th>Montant</th>
                            <th>Eq. USD</th>
                            <th>Reference</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {settlementLines.map((settlement) => (
                            <tr key={settlement.purchaseReturnSettlementId}>
                              <td>{settlement.settlementKind}</td>
                              <td>{settlement.paymentSource}</td>
                              <td>{settlement.currencyCode}</td>
                              <td className="numeric-text">{formatMoney(settlement.amount, settlement.currencyCode)}</td>
                              <td className="numeric-text">{formatMoney(settlement.amountEquivalentUsd, 'USD')}</td>
                              <td>{settlement.reference ?? '-'}</td>
                              <td>{canEdit ? <button className="ghost-button compact-button" type="button" onClick={() => removeSettlement.mutate(settlement.purchaseReturnSettlementId)}>Supprimer</button> : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {activeStep === 4 && (
            <section className="card purchase-return-step-section" id="purchase-return-panel-4" aria-labelledby="purchase-return-step-4">
              <div className="purchase-return-step-header">
                <div>
                  <h2>4. Pieces jointes</h2>
                  <p className="muted">Les justificatifs se chargent a la demande pour garder la page legere.</p>
                </div>
                <div className="table-actions">
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(3)}>
                    Etape precedente
                  </button>
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(5)}>
                    Etape suivante
                  </button>
                </div>
              </div>

              <Suspense
                fallback={(
                  <div className="card compact-card">
                    <p className="loading-state">Chargement des pieces jointes...</p>
                  </div>
                )}
              >
                <LazyPurchaseAttachmentsCard
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
              </Suspense>
            </section>
          )}

          {activeStep === 5 && (
            <section className="card purchase-return-step-section" id="purchase-return-panel-5" aria-labelledby="purchase-return-step-5">
              <div className="purchase-return-step-header">
                <div>
                  <h2>5. Validation</h2>
                  <p className="muted">Dernier controle avant validation finale du retour fournisseur.</p>
                </div>
                <div className="table-actions">
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(4)}>
                    Etape precedente
                  </button>
                </div>
              </div>

              <div className="detail-grid purchase-return-summary-grid">
                <div><span>Lignes retour</span><strong>{returnLines.length}</strong></div>
                <div><span>Lignes echange</span><strong>{exchangeLines.length}</strong></div>
                <div><span>Regularisations</span><strong>{settlementLines.length}</strong></div>
                <div><span>Valeur retour</span><strong>{formatMoney(current.returnedValueUsd, 'USD')}</strong></div>
                <div><span>Valeur echange</span><strong>{formatMoney(current.replacementValueUsd, 'USD')}</strong></div>
                <div><span>Difference</span><strong>{formatMoney(current.financialDifferenceUsd, 'USD')}</strong></div>
              </div>

              <div className="purchase-return-checklist">
                <div className={`purchase-return-checkitem${stepCompletion.productsReturned ? ' is-done' : ''}`}>
                  <strong>Produits retournes</strong>
                  <span>{stepCompletion.productsReturned ? 'Complete' : 'A completer'}</span>
                </div>
                <div className={`purchase-return-checkitem${stepCompletion.productsExchanged ? ' is-done' : ''}`}>
                  <strong>Produits echange</strong>
                  <span>{stepCompletion.productsExchanged ? 'Complete' : 'Optionnel'}</span>
                </div>
                <div className={`purchase-return-checkitem${stepCompletion.settled ? ' is-done' : ''}`}>
                  <strong>Regularisation</strong>
                  <span>{stepCompletion.settled ? 'Complete' : 'Optionnel'}</span>
                </div>
                <div className={`purchase-return-checkitem${stepCompletion.validated ? ' is-done' : ''}`}>
                  <strong>Validation</strong>
                  <span>{stepCompletion.validated ? 'Valide' : 'A confirmer'}</span>
                </div>
              </div>

              {!(current.items ?? []).length || !(current.replacementItems ?? []).length ? (
                <div className="form-summary">
                  <span>Elements a completer : {!(current.items ?? []).length ? 'Ajouter au moins un produit retourne.' : ''}{!(current.items ?? []).length && !(current.replacementItems ?? []).length ? ' ' : ''}{!(current.replacementItems ?? []).length ? 'Renseigner les produits recus en echange si necessaire.' : ''}</span>
                </div>
              ) : null}

              <CommentsPanel entityType="PURCHASE_RETURN" entityId={current.purchaseReturnId} title="Commentaires et traces" />

              <div className="page-actions">
                <Link className="ghost-button compact-button" to={current ? `/purchases/${current.purchaseId}` : '/purchases'}>Retour achat</Link>
                {canEdit ? <button className="ghost-button compact-button" type="button" onClick={() => cancelReturn.mutate()} disabled={cancelReturn.isPending}>Annuler retour</button> : null}
                {canEdit ? <button className="button compact-button" type="button" onClick={() => validateReturn.mutate()} disabled={validateReturn.isPending || !returnLines.length}>{validateReturn.isPending ? 'Validation...' : 'Valider le retour'}</button> : null}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
