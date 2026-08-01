import { FormEvent, KeyboardEvent, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { CommentsPanel } from '../../components/CommentsPanel';
import { Article, articlesService } from '../../services/articles.service';
import { apiErrorMessage } from '../../services/apiError';
import { cashService } from '../../services/cash.service';
import { purchaseReturnsService } from '../../services/purchaseReturns.service';
import { purchasesService } from '../../services/purchases.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import {
  getPaymentSourceLabel,
  getReturnConditionLabel,
  getReturnTypeLabel,
  getSettlementFlowLabel,
  getSettlementKindLabel,
  PAYMENT_SOURCE_OPTIONS,
  RETURN_CONDITION_OPTIONS,
  SETTLEMENT_FLOW_OPTIONS,
  SETTLEMENT_KIND_OPTIONS,
} from './purchaseReturnLabels';

const LazyPurchaseAttachmentsCard = lazy(() =>
  import('./PurchaseAttachmentsCard').then((module) => ({ default: module.PurchaseAttachmentsCard })),
);

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;
type SettlementFlowMode = 'NONE' | 'REFUND' | 'SUPPLIER_CREDIT' | 'ADDITIONAL_PAYMENT' | 'MIXED';

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
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6;
}

function isSettlementFlowMode(value: unknown): value is SettlementFlowMode {
  return value === 'NONE' || value === 'REFUND' || value === 'SUPPLIER_CREDIT' || value === 'ADDITIONAL_PAYMENT' || value === 'MIXED';
}

function lotDatePart(value?: string | null) {
  return (value ?? '').replace(/-/g, '').slice(0, 8) || new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function lotBase(article: Pick<Article, 'articleCode'>, referenceDate?: string | null) {
  const code = (article.articleCode || 'ART').replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase() || 'ART';
  return `${code}-${lotDatePart(referenceDate)}`;
}

function quantity(value: unknown) {
  return Number(value ?? 0);
}

export function PurchaseReturnDetailPage() {
  const { id = '' } = useParams();
  const { permissions } = useAuth();
  const qc = useQueryClient();
  const replacementArticleRef = useRef<HTMLSelectElement | null>(null);
  const exchangeTableRef = useRef<HTMLDivElement | null>(null);

  const [activeStep, setActiveStep] = useState<WizardStep>(1);
  const [replacementLotIsManual, setReplacementLotIsManual] = useState(false);
  const [settlementFlowMode, setSettlementFlowMode] = useState<SettlementFlowMode>('NONE');
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

  const query = useQuery({
    queryKey: ['purchase-return', id],
    queryFn: async () => (await purchaseReturnsService.getById(id)).data,
  });

  const originalPurchase = useQuery({
    queryKey: ['purchase-for-return', query.data?.purchaseId],
    queryFn: async () => (await purchasesService.getById(query.data!.purchaseId)).data,
    enabled: Boolean(query.data?.purchaseId),
  });

  const articleOptions = useQuery({
    queryKey: ['articles-return', 100],
    queryFn: async () => {
      const response = await articlesService.getAll({ limit: 100 });
      const payload = response.data as unknown as { items?: Article[]; data?: { items?: Article[] } } | Article[];
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
        settlementFlowMode?: unknown;
        itemForm?: Partial<ItemFormState>;
        replacementForm?: Partial<ReplacementFormState>;
        settlementForm?: Partial<SettlementFormState>;
      };
      if (isWizardStep(parsed.activeStep)) setActiveStep(parsed.activeStep);
      if (isSettlementFlowMode(parsed.settlementFlowMode)) setSettlementFlowMode(parsed.settlementFlowMode);
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
    window.localStorage.setItem(
      returnWizardStorageKey(id),
      JSON.stringify({ activeStep, settlementFlowMode, itemForm, replacementForm, settlementForm }),
    );
  }, [activeStep, id, itemForm, query.data?.status, replacementForm, settlementFlowMode, settlementForm]);

  const current = query.data;
  const purchaseLines = originalPurchase.data?.items ?? [];
  const returnLines = current?.items ?? [];
  const exchangeLines = current?.replacementItems ?? [];
  const settlementLines = current?.settlements ?? [];
  const canEdit = current?.status === 'DRAFT';

  const returnedPurchaseItemIds = useMemo(() => new Set(returnLines.map((entry) => entry.purchaseItemId)), [returnLines]);
  const availablePurchaseLines = useMemo(
    () => purchaseLines.filter((entry) => !returnedPurchaseItemIds.has(entry.purchaseItemId)),
    [purchaseLines, returnedPurchaseItemIds],
  );

  const selectedPurchaseItem = useMemo(
    () => purchaseLines.find((entry) => entry.purchaseItemId === itemForm.purchaseItemId),
    [itemForm.purchaseItemId, purchaseLines],
  );

  const selectedReplacementArticle = useMemo(
    () => (articleOptions.data ?? []).find((article) => article.articleId === replacementForm.articleId),
    [articleOptions.data, replacementForm.articleId],
  );

  const replacementLineTotal = useMemo(
    () => quantity(replacementForm.quantity) * quantity(replacementForm.unitValue),
    [replacementForm.quantity, replacementForm.unitValue],
  );

  const replacementStockQuantity = useMemo(
    () => quantity(replacementForm.quantity) * quantity(replacementForm.conversionFactor),
    [replacementForm.conversionFactor, replacementForm.quantity],
  );

  const returnedStockImpact = useMemo(
    () => returnLines.reduce((sum, line) => sum + quantity(line.returnedStockQuantity), 0),
    [returnLines],
  );

  const replacementStockImpact = useMemo(
    () => exchangeLines.reduce((sum, line) => sum + quantity(line.receivedStockQuantity), 0),
    [exchangeLines],
  );

  const financialImpactSummary = useMemo(() => {
    const refundCount = settlementLines.filter((entry) => entry.settlementKind === 'REFUND').length;
    const additionalCount = settlementLines.filter((entry) => entry.settlementKind === 'ADDITIONAL_PAYMENT').length;
    const creditCount = settlementLines.filter((entry) => entry.settlementKind === 'SUPPLIER_CREDIT').length;
    if (!settlementLines.length) return 'Aucun mouvement financier enregistré';
    const parts = [];
    if (refundCount) parts.push(`${refundCount} remboursement${refundCount > 1 ? 's' : ''}`);
    if (creditCount) parts.push(`${creditCount} avoir${creditCount > 1 ? 's' : ''}`);
    if (additionalCount) parts.push(`${additionalCount} complément${additionalCount > 1 ? 's' : ''}`);
    return parts.join(' • ');
  }, [settlementLines]);

  const differenceDirection = useMemo(() => {
    const difference = quantity(current?.financialDifferenceUsd);
    if (difference > 0.0001) {
      return {
        tone: 'success',
        title: "L'entreprise doit recevoir",
        amount: formatMoney(difference, 'USD'),
        description: 'La différence est positive, mais aucun mouvement financier ne sera créé automatiquement.',
      };
    }
    if (difference < -0.0001) {
      return {
        tone: 'warning',
        title: "L'entreprise doit payer",
        amount: formatMoney(Math.abs(difference), 'USD'),
        description: 'La différence est négative, mais aucun mouvement financier ne sera créé automatiquement.',
      };
    }
    return {
      tone: 'muted',
      title: 'Aucune différence',
      amount: formatMoney(0, 'USD'),
      description: "Le retour est équilibré. Aucun mouvement financier n'est attendu par défaut.",
    };
  }, [current?.financialDifferenceUsd]);

  const canProceedToValidation = returnLines.length > 0;

  const stepCompletion = useMemo(
    () => ({
      productsReturned: returnLines.length > 0,
      productsExchanged: exchangeLines.length > 0,
      calculated: returnLines.length > 0 || exchangeLines.length > 0,
      settlements: settlementLines.length > 0 || settlementFlowMode === 'NONE',
      validated: current?.status === 'VALIDATED',
    }),
    [current?.status, exchangeLines.length, returnLines.length, settlementFlowMode, settlementLines.length],
  );

  const visiblePaymentSources = useMemo(() => {
    if (settlementFlowMode === 'SUPPLIER_CREDIT') {
      return PAYMENT_SOURCE_OPTIONS.filter((option) => option.value === 'SUPPLIER_CREDIT');
    }
    return PAYMENT_SOURCE_OPTIONS.filter((option) => option.value !== 'SUPPLIER_CREDIT');
  }, [settlementFlowMode]);

  useEffect(() => {
    if (!selectedReplacementArticle) return;
    const nextLot = `${lotBase(selectedReplacementArticle, current?.returnDate)}-${String(exchangeLines.length + 1).padStart(3, '0')}`;
    setReplacementForm((currentValue) => {
      if (replacementLotIsManual && currentValue.lotNumber.trim()) return currentValue;
      return {
        ...currentValue,
        lotNumber: nextLot,
        unitValue: currentValue.unitValue || String(selectedReplacementArticle.sellingPrice ?? ''),
      };
    });
  }, [current?.returnDate, exchangeLines.length, replacementLotIsManual, selectedReplacementArticle]);

  useEffect(() => {
    if (settlementFlowMode === 'NONE') return;
    if (settlementFlowMode === 'MIXED') return;
    setSettlementForm((currentValue) => ({
      ...currentValue,
      settlementKind: settlementFlowMode,
      paymentSource: settlementFlowMode === 'SUPPLIER_CREDIT' ? 'SUPPLIER_CREDIT' : currentValue.paymentSource === 'SUPPLIER_CREDIT' ? 'CASH_REGISTER' : currentValue.paymentSource,
    }));
  }, [settlementFlowMode]);

  const addItem = useMutation({
    mutationFn: () => {
      const selected = purchaseLines.find((entry) => entry.purchaseItemId === itemForm.purchaseItemId);
      if (!selected?.lotId) throw new Error('Lot introuvable pour cette ligne achat.');
      return purchaseReturnsService.addItem(id, {
        purchaseItemId: selected.purchaseItemId,
        articleId: selected.articleId,
        lotId: selected.lotId,
        returnedPurchaseQuantity: quantity(itemForm.quantity),
        returnUnitValue: itemForm.returnUnitValue ? quantity(itemForm.returnUnitValue) : undefined,
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
      await qc.invalidateQueries({ queryKey: ['purchase-return', id] });
    },
  });

  const addReplacement = useMutation({
    mutationFn: () =>
      purchaseReturnsService.addReplacement(id, {
        articleId: replacementForm.articleId,
        receivedPurchaseQuantity: quantity(replacementForm.quantity),
        conversionFactor: quantity(replacementForm.conversionFactor || 1),
        lotNumber: replacementForm.lotNumber,
        expiryDate: replacementForm.expiryDate,
        unitValue: quantity(replacementForm.unitValue),
      }),
    onSuccess: async () => {
      setReplacementForm({
        articleId: '',
        quantity: '1',
        conversionFactor: '1',
        lotNumber: '',
        expiryDate: '',
        unitValue: '',
      });
      setReplacementLotIsManual(false);
      setActiveStep(2);
      await qc.invalidateQueries({ queryKey: ['purchase-return', id] });
      requestAnimationFrame(() => {
        replacementArticleRef.current?.focus();
        exchangeTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
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
        exchangeRateApplied: quantity(settlementForm.exchangeRateApplied || 1),
        amount: quantity(settlementForm.amount),
        cashSessionId:
          settlementForm.paymentSource === 'CASH_REGISTER'
            ? settlementForm.cashSessionId || currentCashSession.data?.cashSessionId
            : undefined,
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
      setActiveStep(6);
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
    if (settlementFlowMode === 'NONE') return;
    addSettlement.mutate();
  }

  function clearWizardDraft() {
    if (typeof window === 'undefined' || !id) return;
    window.localStorage.removeItem(returnWizardStorageKey(id));
  }

  function goToStep(step: WizardStep) {
    setActiveStep(step);
  }

  function handleReplacementArticleChange(articleId: string) {
    const article = (articleOptions.data ?? []).find((entry) => entry.articleId === articleId);
    const nextLot = article ? `${lotBase(article, current?.returnDate)}-${String(exchangeLines.length + 1).padStart(3, '0')}` : '';
    setReplacementForm((currentValue) => ({
      ...currentValue,
      articleId,
      lotNumber: !currentValue.lotNumber.trim() || !replacementLotIsManual ? nextLot : currentValue.lotNumber,
      unitValue: currentValue.unitValue || String(article?.sellingPrice ?? ''),
    }));
  }

  function handleReplacementLotChange(lotNumber: string) {
    setReplacementLotIsManual(true);
    setReplacementForm((currentValue) => ({ ...currentValue, lotNumber }));
  }

  function handleStepKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goToStep(Math.min(6, activeStep + 1) as WizardStep);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goToStep(Math.max(1, activeStep - 1) as WizardStep);
    }
  }

  function stepStatus(step: WizardStep) {
    if (step === activeStep) return 'Courante';
    if (step === 1) return stepCompletion.productsReturned ? 'Complète' : 'À compléter';
    if (step === 2) return stepCompletion.productsExchanged ? 'Complète' : 'Optionnelle';
    if (step === 3) return stepCompletion.calculated ? 'Disponible' : 'À calculer';
    if (step === 4) return stepCompletion.settlements ? 'Prête' : 'Optionnelle';
    if (step === 5) return 'Optionnelle';
    if (step === 6) return stepCompletion.validated ? 'Résumé disponible' : 'À valider';
    return 'Étape';
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
              <div><span>Référence</span><strong>{current.returnNumber}</strong></div>
              <div><span>Date</span><strong>{formatDate(current.returnDate)}</strong></div>
              <div><span>Achat initial</span><strong>{current.purchaseNumber ?? current.purchaseId}</strong></div>
              <div><span>Fournisseur</span><strong>{current.supplierName ?? '-'}</strong></div>
              <div><span>Site</span><strong>{current.siteName ?? '-'}</strong></div>
              <div><span>Statut</span><strong>{current.status}</strong></div>
              <div><span>Type</span><strong>{getReturnTypeLabel(current.returnType)}</strong></div>
              <div><span>Valeur retour</span><strong>{formatMoney(current.returnedValueUsd, 'USD')}</strong></div>
              <div><span>Valeur échange</span><strong>{formatMoney(current.replacementValueUsd, 'USD')}</strong></div>
              <div><span>Différence</span><strong>{formatMoney(current.financialDifferenceUsd, 'USD')}</strong></div>
              <div><span>Remboursement dû</span><strong>{formatMoney(current.refundDueUsd, 'USD')}</strong></div>
              <div><span>Complément dû</span><strong>{formatMoney(current.additionalPaymentDueUsd, 'USD')}</strong></div>
            </div>
            <p className="muted purchase-return-draft-note">
              {current.status === 'DRAFT'
                ? 'Le brouillon est sauvegardé automatiquement. Vous pouvez reprendre le retour après fermeture.'
                : 'Retour validé ou annulé. Les étapes restent consultables en lecture seule.'}
            </p>
          </div>

          <div className="card purchase-return-stepper-card">
            <div className="toolbar compact-toolbar">
              <div>
                <h2>Parcours guidé</h2>
                <p className="muted">L’ERP calcule, puis l’utilisateur décide de la régularisation réelle.</p>
              </div>
              <span className="badge compact-badge badge-muted">
                {current.status === 'DRAFT' ? 'Brouillon auto-sauvegardé' : `Statut ${current.status}`}
              </span>
            </div>
            <div
              className="purchase-return-stepper"
              role="tablist"
              aria-label="Étapes du retour fournisseur"
              onKeyDown={handleStepKeyDown}
            >
              {([
                [1, 'Produits retournés', stepCompletion.productsReturned],
                [2, 'Produits reçus', stepCompletion.productsExchanged],
                [3, 'Différence calculée', stepCompletion.calculated],
                [4, 'Régularisations', stepCompletion.settlements],
                [5, 'Pièces jointes', false],
                [6, 'Validation', stepCompletion.validated],
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
                  <h2>1. Produits retournés</h2>
                  <p className="muted">Le stock ne sera diminué qu’à la validation finale.</p>
                </div>
                <div className="table-actions">
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(2)}>
                    Étape suivante
                  </button>
                </div>
              </div>

              <div className="purchase-return-split-grid">
                <div className="card compact-card purchase-return-inner-card">
                  <div className="toolbar compact-toolbar">
                    <h3>Lignes achat disponibles</h3>
                    <span className="badge compact-badge badge-muted">{availablePurchaseLines.length} ligne(s)</span>
                  </div>
                  {availablePurchaseLines.length === 0 ? (
                    <p className="muted">Toutes les lignes de cet achat sont déjà utilisées dans ce retour.</p>
                  ) : (
                    <div className="table-scroll purchase-return-table-scroll">
                      <table className="data-table purchase-detail-table purchase-return-source-table">
                        <thead>
                          <tr>
                            <th>Article</th>
                            <th>Lot</th>
                            <th>Expiration</th>
                            <th>Qté achat</th>
                            <th>Valeur</th>
                          </tr>
                        </thead>
                        <tbody>
                          {availablePurchaseLines.map((item) => (
                            <tr key={item.purchaseItemId}>
                              <td>{item.commercialName}</td>
                              <td>{item.lotNumber}</td>
                              <td>{formatDate(item.expiryDate)}</td>
                              <td className="quantity-cell">{item.purchaseQuantity ?? item.quantity}</td>
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
                    <span className="badge compact-badge badge-muted">{itemForm.purchaseItemId ? 'Prête' : 'À compléter'}</span>
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
                          <option value="">Sélectionner une ligne</option>
                          {availablePurchaseLines.map((item) => (
                            <option key={item.purchaseItemId} value={item.purchaseItemId}>
                              {item.commercialName} | Lot {item.lotNumber} | Qté achat {item.purchaseQuantity ?? item.quantity}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-block">
                        <span>État</span>
                        <select
                          className="input"
                          value={itemForm.conditionStatus}
                          onChange={(event) => setItemForm((currentValue) => ({ ...currentValue, conditionStatus: event.target.value }))}
                        >
                          {RETURN_CONDITION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-block">
                        <span>Quantité</span>
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
                    <p className="muted">Cette étape est en lecture seule pour le retour validé.</p>
                  )}
                </div>
              </div>

              <div className="card compact-card">
                <div className="toolbar compact-toolbar">
                  <h3>Produits retournés enregistrés</h3>
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
                          <th>État</th>
                          <th>Quantité</th>
                          <th>Valeur</th>
                          <th>Motif</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnLines.map((item) => (
                          <tr key={item.purchaseReturnItemId}>
                            <td>{item.commercialName}</td>
                            <td>{item.lotNumber}</td>
                            <td>{getReturnConditionLabel(item.conditionStatus)}</td>
                            <td className="quantity-cell">{item.returnedPurchaseQuantity}</td>
                            <td className="numeric-text">{formatMoney(item.lineReturnValue, current.currencyCode ?? 'USD')}</td>
                            <td>{item.reason ?? '-'}</td>
                            <td>
                              {canEdit ? (
                                <button className="ghost-button compact-button" type="button" onClick={() => removeItem.mutate(item.purchaseReturnItemId)}>
                                  Supprimer
                                </button>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeStep === 2 && (
            <section className="card purchase-return-step-section" id="purchase-return-panel-2" aria-labelledby="purchase-return-step-2">
              <div className="purchase-return-step-header">
                <div>
                  <h2>2. Produits reçus en échange</h2>
                  <p className="muted">Les produits reçus ne seront créés qu’à la validation finale.</p>
                </div>
                <div className="table-actions">
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(1)}>
                    Étape précédente
                  </button>
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(3)}>
                    Étape suivante
                  </button>
                </div>
              </div>

              <div className="card compact-card purchase-return-inner-card">
                <div className="toolbar compact-toolbar">
                  <h3>Ligne échange</h3>
                  <span className="badge compact-badge badge-muted">{replacementForm.articleId ? 'Prête' : 'À compléter'}</span>
                </div>
                {canEdit ? (
                  <form className="purchase-return-replacement-form" onSubmit={submitReplacement}>
                    <div className="purchase-return-form-grid">
                      <label className="field-block purchase-return-article-field">
                        <span>Article</span>
                        <select
                          ref={replacementArticleRef}
                          className="input"
                          value={replacementForm.articleId}
                          onChange={(event) => handleReplacementArticleChange(event.target.value)}
                        >
                          <option value="">Sélectionner un article</option>
                          {(articleOptions.data ?? []).map((article) => (
                            <option key={article.articleId} value={article.articleId}>
                              {article.articleCode} - {article.commercialName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-block">
                        <span>Quantité achat</span>
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
                        <span>Quantité stock</span>
                        <input className="input" value={replacementStockQuantity ? String(replacementStockQuantity) : ''} disabled />
                      </label>
                      <label className="field-block">
                        <span>Lot</span>
                        <input
                          className="input"
                          value={replacementForm.lotNumber}
                          onChange={(event) => handleReplacementLotChange(event.target.value)}
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
                    </div>

                    <div className="form-summary purchase-return-inline-summary">
                      <span>Lot proposé : {replacementForm.lotNumber || '-'}</span>
                      <span>Valeur totale : {formatMoney(replacementLineTotal, current.currencyCode ?? 'USD')}</span>
                    </div>

                    <div className="modal-actions purchase-return-form-actions">
                      <button className="button compact-button" type="submit" disabled={addReplacement.isPending || !replacementForm.articleId}>
                        {addReplacement.isPending ? 'Ajout...' : 'Ajouter échange'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="muted">Cette étape est en lecture seule pour le retour validé.</p>
                )}
              </div>

              <div className="card compact-card purchase-return-inner-card">
                <div className="toolbar compact-toolbar">
                  <h3>Lignes échange enregistrées</h3>
                  <span className="badge compact-badge badge-muted">{exchangeLines.length}</span>
                </div>
                {exchangeLines.length === 0 ? (
                  <p className="muted">Aucun produit reçu en échange.</p>
                ) : (
                  <div ref={exchangeTableRef} className="table-scroll purchase-return-local-scroll">
                    <table className="data-table purchase-detail-table purchase-return-exchange-table">
                      <thead>
                        <tr>
                          <th>Article</th>
                          <th>Lot</th>
                          <th>Expiration</th>
                          <th>Quantité</th>
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
                            <td className="numeric-text">{formatMoney(item.lineValue, current.currencyCode ?? 'USD')}</td>
                            <td>
                              {canEdit ? (
                                <button className="ghost-button compact-button" type="button" onClick={() => removeReplacement.mutate(item.purchaseReturnReplacementItemId)}>
                                  Supprimer
                                </button>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeStep === 3 && (
            <section className="card purchase-return-step-section" id="purchase-return-panel-3" aria-labelledby="purchase-return-step-3">
              <div className="purchase-return-step-header">
                <div>
                  <h2>3. Différence calculée</h2>
                  <p className="muted">Étape informative uniquement. Aucun mouvement de caisse, banque ou avoir n’est créé ici.</p>
                </div>
                <div className="table-actions">
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(2)}>
                    Étape précédente
                  </button>
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(4)}>
                    Étape suivante
                  </button>
                </div>
              </div>

              <div className="detail-grid purchase-return-financial-grid">
                <div><span>Valeur produits retournés</span><strong>{formatMoney(current.returnedValueUsd, 'USD')}</strong></div>
                <div><span>Valeur produits reçus</span><strong>{formatMoney(current.replacementValueUsd, 'USD')}</strong></div>
                <div><span>Différence calculée</span><strong>{formatMoney(current.financialDifferenceUsd, 'USD')}</strong></div>
              </div>

              <div className={`form-summary purchase-return-difference-card is-${differenceDirection.tone}`}>
                <strong>{differenceDirection.title}</strong>
                <span>{differenceDirection.amount}</span>
                <small>{differenceDirection.description}</small>
              </div>

              <div className="card compact-card purchase-return-inner-card">
                <h3>Lecture métier</h3>
                <div className="purchase-return-checklist">
                  <div className="purchase-return-checkitem">
                    <strong>Calcul</strong>
                    <span>Le système compare la valeur retournée et la valeur échangée.</span>
                  </div>
                  <div className="purchase-return-checkitem">
                    <strong>Aucun mouvement automatique</strong>
                    <span>Aucun remboursement, paiement, avoir ou dette n’est créé à cette étape.</span>
                  </div>
                  <div className="purchase-return-checkitem">
                    <strong>Décision utilisateur</strong>
                    <span>La régularisation réelle se fait uniquement à l’étape suivante.</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeStep === 4 && (
            <section className="card purchase-return-step-section" id="purchase-return-panel-4" aria-labelledby="purchase-return-step-4">
              <div className="purchase-return-step-header">
                <div>
                  <h2>4. Régularisations enregistrées</h2>
                  <p className="muted">Seules les lignes ajoutées ici produiront un mouvement financier réel à la validation.</p>
                </div>
                <div className="table-actions">
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(3)}>
                    Étape précédente
                  </button>
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(5)}>
                    Étape suivante
                  </button>
                </div>
              </div>

              <div className="detail-grid purchase-return-financial-grid">
                <div><span>Différence calculée</span><strong>{formatMoney(current.financialDifferenceUsd, 'USD')}</strong></div>
                <div><span>Remboursement restant</span><strong>{formatMoney(current.refundDueUsd, 'USD')}</strong></div>
                <div><span>Complément restant</span><strong>{formatMoney(current.additionalPaymentDueUsd, 'USD')}</strong></div>
                <div><span>Avoir enregistré</span><strong>{formatMoney(current.supplierCreditUsd, 'USD')}</strong></div>
              </div>

              <div className="purchase-return-split-grid">
                <div className="card compact-card purchase-return-inner-card">
                  <div className="toolbar compact-toolbar">
                    <h3>Ajouter une régularisation</h3>
                    <span className="badge compact-badge badge-muted">{getSettlementFlowLabel(settlementFlowMode)}</span>
                  </div>

                  <label className="field-block">
                    <span>Mode de traitement</span>
                    <select
                      className="input"
                      value={settlementFlowMode}
                      onChange={(event) => setSettlementFlowMode(event.target.value as SettlementFlowMode)}
                    >
                      {SETTLEMENT_FLOW_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <small className="muted">
                      {SETTLEMENT_FLOW_OPTIONS.find((option) => option.value === settlementFlowMode)?.help}
                    </small>
                  </label>

                  {settlementFlowMode === 'NONE' ? (
                    <div className="form-summary">
                      <span>Aucune régularisation n’est ajoutée. La validation ne créera donc aucun mouvement financier.</span>
                    </div>
                  ) : (
                    <form className="modal-form" onSubmit={submitSettlement}>
                      {settlementFlowMode === 'MIXED' ? (
                        <label className="field-block">
                          <span>Type de ligne</span>
                          <select
                            className="input"
                            value={settlementForm.settlementKind}
                            onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, settlementKind: event.target.value }))}
                          >
                            {SETTLEMENT_KIND_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      <label className="field-block">
                        <span>Source</span>
                        <select
                          className="input"
                          value={settlementForm.paymentSource}
                          disabled={settlementFlowMode === 'SUPPLIER_CREDIT'}
                          onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, paymentSource: event.target.value }))}
                        >
                          {visiblePaymentSources.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
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

                      {settlementForm.paymentSource === 'CASH_REGISTER' ? (
                        <label className="field-block">
                          <span>Session caisse</span>
                          <select
                            className="input"
                            value={settlementForm.cashSessionId || currentCashSession.data?.cashSessionId || ''}
                            onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, cashSessionId: event.target.value }))}
                          >
                            <option value="">Sans caisse</option>
                            {currentCashSession.data ? (
                              <option value={currentCashSession.data.cashSessionId}>
                                {currentCashSession.data.registerName ?? 'Caisse'}
                              </option>
                            ) : null}
                          </select>
                        </label>
                      ) : null}

                      <label className="field-block">
                        <span>Référence</span>
                        <input
                          className="input"
                          value={settlementForm.reference}
                          onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, reference: event.target.value }))}
                        />
                      </label>

                      <label className="field-block">
                        <span>Commentaire</span>
                        <input
                          className="input"
                          value={settlementForm.note}
                          onChange={(event) => setSettlementForm((currentValue) => ({ ...currentValue, note: event.target.value }))}
                        />
                      </label>

                      <div className="modal-actions">
                        <button className="button compact-button" type="submit" disabled={addSettlement.isPending || !settlementForm.amount}>
                          {addSettlement.isPending ? 'Ajout...' : 'Ajouter une régularisation'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                <div className="card compact-card purchase-return-inner-card">
                  <div className="toolbar compact-toolbar">
                    <h3>Régularisations enregistrées</h3>
                    <span className="badge compact-badge badge-muted">{settlementLines.length}</span>
                  </div>
                  {settlementLines.length === 0 ? (
                    <p className="muted">Aucune régularisation enregistrée pour le moment.</p>
                  ) : (
                    <div className="table-scroll">
                      <table className="data-table purchase-detail-table">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Source</th>
                            <th>Devise</th>
                            <th>Montant</th>
                            <th>Référence</th>
                            <th>Date</th>
                            <th>Utilisateur</th>
                            <th>État</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {settlementLines.map((settlement) => (
                            <tr key={settlement.purchaseReturnSettlementId}>
                              <td>{getSettlementKindLabel(settlement.settlementKind)}</td>
                              <td>{getPaymentSourceLabel(settlement.paymentSource)}</td>
                              <td>{settlement.currencyCode}</td>
                              <td className="numeric-text">{formatMoney(settlement.amount, settlement.currencyCode)}</td>
                              <td>{settlement.reference ?? '-'}</td>
                              <td>{formatDate(settlement.createdAt)}</td>
                              <td>{settlement.createdBy ?? '-'}</td>
                              <td>Enregistré</td>
                              <td>
                                {canEdit ? (
                                  <button className="ghost-button compact-button" type="button" onClick={() => removeSettlement.mutate(settlement.purchaseReturnSettlementId)}>
                                    Supprimer
                                  </button>
                                ) : '-'}
                              </td>
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

          {activeStep === 5 && (
            <section className="card purchase-return-step-section" id="purchase-return-panel-5" aria-labelledby="purchase-return-step-5">
              <div className="purchase-return-step-header">
                <div>
                  <h2>5. Pièces jointes</h2>
                  <p className="muted">Les justificatifs restent facultatifs mais utiles pour tracer le dossier fournisseur.</p>
                </div>
                <div className="table-actions">
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(4)}>
                    Étape précédente
                  </button>
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(6)}>
                    Étape suivante
                  </button>
                </div>
              </div>

              <Suspense
                fallback={(
                  <div className="card compact-card">
                    <p className="loading-state">Chargement des pièces jointes...</p>
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

          {activeStep === 6 && (
            <section className="card purchase-return-step-section" id="purchase-return-panel-6" aria-labelledby="purchase-return-step-6">
              <div className="purchase-return-step-header">
                <div>
                  <h2>6. Validation</h2>
                  <p className="muted">Résumé global avant de déclencher les mouvements stock et les mouvements financiers explicitement enregistrés.</p>
                </div>
                <div className="table-actions">
                  <button className="ghost-button compact-button" type="button" onClick={() => goToStep(5)}>
                    Étape précédente
                  </button>
                </div>
              </div>

              <div className="detail-grid purchase-return-summary-grid">
                <div><span>Produits retournés</span><strong>{returnLines.length}</strong></div>
                <div><span>Produits reçus</span><strong>{exchangeLines.length}</strong></div>
                <div><span>Différence calculée</span><strong>{formatMoney(current.financialDifferenceUsd, 'USD')}</strong></div>
                <div><span>Régularisations</span><strong>{settlementLines.length}</strong></div>
                <div><span>Stock sortant</span><strong>-{returnedStockImpact}</strong></div>
                <div><span>Stock entrant</span><strong>+{replacementStockImpact}</strong></div>
              </div>

              <div className="purchase-return-checklist">
                <div className={`purchase-return-checkitem${stepCompletion.productsReturned ? ' is-done' : ''}`}>
                  <strong>Produits retournés</strong>
                  <span>{stepCompletion.productsReturned ? 'Complète' : 'À compléter'}</span>
                </div>
                <div className={`purchase-return-checkitem${stepCompletion.productsExchanged ? ' is-done' : ''}`}>
                  <strong>Produits reçus</strong>
                  <span>{stepCompletion.productsExchanged ? 'Complète' : 'Optionnelle'}</span>
                </div>
                <div className={`purchase-return-checkitem${stepCompletion.settlements ? ' is-done' : ''}`}>
                  <strong>Régularisations</strong>
                  <span>{settlementLines.length ? financialImpactSummary : 'Aucun mouvement financier'}</span>
                </div>
                <div className={`purchase-return-checkitem${stepCompletion.validated ? ' is-done' : ''}`}>
                  <strong>Validation</strong>
                  <span>{stepCompletion.validated ? 'Validé' : 'À confirmer'}</span>
                </div>
              </div>

              <div className="form-summary purchase-return-validation-callout">
                <strong>La validation créera uniquement :</strong>
                <span>• les mouvements stock liés aux produits retournés et reçus</span>
                <span>• les mouvements financiers correspondant aux régularisations enregistrées</span>
                <span>Aucun remboursement ou paiement ne sera créé automatiquement à partir de la seule différence calculée.</span>
              </div>

              <div className="detail-grid purchase-return-financial-grid">
                <div><span>Impact stock</span><strong>-{returnedStockImpact} / +{replacementStockImpact}</strong></div>
                <div><span>Impact financier</span><strong>{financialImpactSummary}</strong></div>
              </div>

              <CommentsPanel entityType="PURCHASE_RETURN" entityId={current.purchaseReturnId} title="Commentaires et traces" />

              <div className="page-actions">
                <Link className="ghost-button compact-button" to={current ? `/purchases/${current.purchaseId}` : '/purchases'}>
                  Retour achat
                </Link>
                {canEdit ? (
                  <button className="ghost-button compact-button" type="button" onClick={() => cancelReturn.mutate()} disabled={cancelReturn.isPending}>
                    Annuler retour
                  </button>
                ) : null}
                {canEdit ? (
                  <button
                    className="button compact-button"
                    type="button"
                    onClick={() => validateReturn.mutate()}
                    disabled={validateReturn.isPending || !canProceedToValidation}
                  >
                    {validateReturn.isPending ? 'Validation...' : 'Valider le retour'}
                  </button>
                ) : null}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
