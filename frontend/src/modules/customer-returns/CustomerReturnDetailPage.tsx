import { FormEvent, KeyboardEvent, Suspense, lazy, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { CommentsPanel } from '../../components/CommentsPanel';
import { FloatingSearchPopover } from '../../components/FloatingSearchPopover';
import { Article, articlesService } from '../../services/articles.service';
import { apiErrorMessage } from '../../services/apiError';
import { cashService } from '../../services/cash.service';
import { customerReturnsService } from '../../services/customerReturns.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import { PurchaseAttachmentsCard } from '../purchases/PurchaseAttachmentsCard';
import {
  customerCreditStatusLabel,
  customerReturnConditionLabel,
  customerReturnPaymentSourceLabel,
  customerReturnSettlementKindLabel,
  customerReturnStatusClass,
  customerReturnStatusLabel,
} from './customerReturnLabels';

const LazyAttachments = lazy(async () => ({ default: PurchaseAttachmentsCard }));

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;
const STEP_ORDER: WizardStep[] = [1, 2, 3, 4, 5, 6, 7];
type SettlementFlowMode = 'NONE' | 'REFUND' | 'CUSTOMER_CREDIT' | 'ADDITIONAL_PAYMENT' | 'MIXED';

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Recherche vente',
  2: 'Produits retournes',
  3: 'Inspection',
  4: 'Produits remis en echange',
  5: 'Difference financiere',
  6: 'Regularisations',
  7: 'Validation',
};

const SETTLEMENT_FLOW_OPTIONS: Array<{ value: SettlementFlowMode; label: string }> = [
  { value: 'NONE', label: 'Aucun reglement' },
  { value: 'REFUND', label: 'Remboursement' },
  { value: 'CUSTOMER_CREDIT', label: 'Avoir client' },
  { value: 'ADDITIONAL_PAYMENT', label: 'Complement client' },
  { value: 'MIXED', label: 'Mixte' },
];

const PAYMENT_SOURCE_OPTIONS = [
  { value: 'CASH_REGISTER', label: 'Especes / caisse' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'BANK', label: 'Banque' },
  { value: 'CUSTOMER_CREDIT', label: 'Avoir client' },
  { value: 'OTHER', label: 'Autre' },
];

export function CustomerReturnDetailPage() {
  const { id = '' } = useParams();
  const { permissions } = useAuth();
  const qc = useQueryClient();

  const [activeStep, setActiveStep] = useState<WizardStep>(1);
  const [saleItemSearch, setSaleItemSearch] = useState('');
  const [saleItemPopoverOpen, setSaleItemPopoverOpen] = useState(false);
  const [selectedSaleItemId, setSelectedSaleItemId] = useState('');
  const [returnedQuantity, setReturnedQuantity] = useState('1');
  const [conditionStatus, setConditionStatus] = useState('GOOD');
  const [itemNote, setItemNote] = useState('');
  const [inspectionDecision, setInspectionDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [inspectionNote, setInspectionNote] = useState('');
  const [replacementSearch, setReplacementSearch] = useState('');
  const [replacementPopoverOpen, setReplacementPopoverOpen] = useState(false);
  const [replacementArticleId, setReplacementArticleId] = useState('');
  const [replacementQuantity, setReplacementQuantity] = useState('1');
  const [replacementUnitPrice, setReplacementUnitPrice] = useState('');
  const [replacementDiscountAmount, setReplacementDiscountAmount] = useState('0');
  const [settlementFlowMode, setSettlementFlowMode] = useState<SettlementFlowMode>('NONE');
  const [settlementKind, setSettlementKind] = useState('REFUND');
  const [paymentSource, setPaymentSource] = useState('CASH_REGISTER');
  const [settlementCurrencyCode, setSettlementCurrencyCode] = useState('USD');
  const [exchangeRateApplied, setExchangeRateApplied] = useState('1');
  const [settlementAmount, setSettlementAmount] = useState('');
  const [cashSessionId, setCashSessionId] = useState('');
  const [settlementReference, setSettlementReference] = useState('');
  const [settlementExpirationDate, setSettlementExpirationDate] = useState('');
  const [settlementNote, setSettlementNote] = useState('');

  const query = useQuery({
    queryKey: ['customer-return', id],
    queryFn: async () => (await customerReturnsService.getById(id)).data,
  });

  const articlesQuery = useQuery({
    queryKey: ['customer-return-articles', 100],
    queryFn: async () => (await articlesService.getAll({ limit: 100 })).data.items,
  });

  const currentCashSession = useQuery({
    queryKey: ['customer-return-cash-session', query.data?.siteId],
    queryFn: async () => (await cashService.getCurrentSession(query.data!.siteId)).data,
    enabled: Boolean(query.data?.siteId),
  });

  const current = query.data;
  const sale = current?.sale;
  const currentItems = current?.items ?? [];
  const replacementItems = current?.replacementItems ?? [];
  const settlements = current?.settlements ?? [];
  const customerCredits = current?.customerCredits ?? [];
  const returnableItems = sale?.returnableItems ?? [];

  const canEditDraft = current?.status === 'DRAFT' && permissions.includes('customer_returns.create');
  const canInspect = current?.status === 'PENDING_INSPECTION' && permissions.includes('customer_returns.inspect');
  const canConfigureApproved = current?.status === 'APPROVED';
  const canManageExchanges = canConfigureApproved && permissions.includes('customer_returns.exchange');
  const canManageSettlements = canConfigureApproved && (permissions.includes('customer_returns.refund') || permissions.includes('customer_returns.credit'));
  const canValidate = canConfigureApproved && permissions.includes('customer_returns.validate');
  const canApproveUnlinked = current?.saleLinkStatus === 'UNLINKED'
    && current.status === 'PENDING_MANAGER_APPROVAL'
    && permissions.includes('customer_returns.unlinked.approve');

  const goToStep = (step: WizardStep) => setActiveStep(step);
  const handleStepKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = STEP_ORDER.indexOf(activeStep);
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      goToStep(STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)]);
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      goToStep(STEP_ORDER[Math.max(index - 1, 0)]);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      goToStep(STEP_ORDER[0]);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      goToStep(STEP_ORDER[STEP_ORDER.length - 1]);
    }
  };

  const saleItemIds = useMemo(() => new Set(currentItems.map((item) => item.saleItemId)), [currentItems]);
  const availableSaleItems = useMemo(() => {
    const term = saleItemSearch.trim().toLowerCase();
    return returnableItems
      .filter((item) => !saleItemIds.has(item.saleItemId))
      .filter((item) => {
        if (!term) return true;
        return [item.articleCode, item.commercialName, item.lotNumber]
          .some((value) => String(value ?? '').toLowerCase().includes(term));
      });
  }, [returnableItems, saleItemIds, saleItemSearch]);

  const selectedSaleItem = useMemo(
    () => returnableItems.find((item) => item.saleItemId === selectedSaleItemId) ?? null,
    [returnableItems, selectedSaleItemId],
  );

  const availableArticles = useMemo(() => {
    const term = replacementSearch.trim().toLowerCase();
    return (articlesQuery.data ?? []).filter((article) => {
      if (!term) return true;
      return [article.articleCode, article.commercialName, article.dci, article.dosage, article.barcode]
        .some((value) => String(value ?? '').toLowerCase().includes(term));
    });
  }, [articlesQuery.data, replacementSearch]);

  const selectedReplacementArticle = useMemo(
    () => (articlesQuery.data ?? []).find((article) => article.articleId === replacementArticleId) ?? null,
    [articlesQuery.data, replacementArticleId],
  );

  const returnedValueCurrency = useMemo(() => Number(current?.returnedValueUsd ?? 0), [current?.returnedValueUsd]);
  const replacementValueCurrency = useMemo(() => Number(current?.replacementValueUsd ?? 0), [current?.replacementValueUsd]);
  const replacementLineTotal = useMemo(() => {
    const quantity = Number(replacementQuantity || 0);
    const unitPrice = Number(replacementUnitPrice || 0);
    const discount = Number(replacementDiscountAmount || 0);
    return Math.max(0, Number((quantity * unitPrice - discount).toFixed(2)));
  }, [replacementDiscountAmount, replacementQuantity, replacementUnitPrice]);

  const financialSummary = useMemo(() => {
    const difference = Number(current?.financialDifferenceUsd ?? 0);
    if (difference > 0.009) {
      return {
        tone: 'badge-success',
        label: 'Remboursement ou avoir possible',
        description: `Le client a ${formatMoney(difference, 'USD')} en sa faveur.`,
      };
    }
    if (difference < -0.009) {
      return {
        tone: 'badge-warning',
        label: 'Complement a recevoir',
        description: `Le client doit encore ${formatMoney(Math.abs(difference), 'USD')}.`,
      };
    }
    return {
      tone: 'badge-info',
      label: 'Echange equilibre',
      description: 'Aucune regularisation n est requise si les montants restent egaux.',
    };
  }, [current?.financialDifferenceUsd]);

  const addItem = useMutation({
    mutationFn: () => customerReturnsService.addItem(id, {
      saleItemId: selectedSaleItemId,
      returnedQuantity: Number(returnedQuantity),
      conditionStatus,
      note: itemNote || undefined,
    }),
    onSuccess: async () => {
      setSelectedSaleItemId('');
      setSaleItemSearch('');
      setReturnedQuantity('1');
      setConditionStatus('GOOD');
      setItemNote('');
      setSaleItemPopoverOpen(false);
      await qc.invalidateQueries({ queryKey: ['customer-return', id] });
    },
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => customerReturnsService.removeItem(id, itemId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['customer-return', id] });
    },
  });

  const submitInspection = useMutation({
    mutationFn: () => customerReturnsService.submitInspection(id),
    onSuccess: async () => {
      setActiveStep(3);
      await qc.invalidateQueries({ queryKey: ['customer-return', id] });
      await qc.invalidateQueries({ queryKey: ['customer-returns'] });
    },
  });

  const inspect = useMutation({
    mutationFn: () => customerReturnsService.inspect(id, { decision: inspectionDecision, note: inspectionNote || undefined }),
    onSuccess: async () => {
      setActiveStep(inspectionDecision === 'APPROVED' ? 4 : 3);
      await qc.invalidateQueries({ queryKey: ['customer-return', id] });
      await qc.invalidateQueries({ queryKey: ['customer-returns'] });
    },
  });

  const addReplacement = useMutation({
    mutationFn: () => customerReturnsService.addReplacement(id, {
      articleId: replacementArticleId,
      quantity: Number(replacementQuantity),
      unitPrice: Number(replacementUnitPrice),
      discountAmount: Number(replacementDiscountAmount || 0),
    }),
    onSuccess: async () => {
      setReplacementArticleId('');
      setReplacementSearch('');
      setReplacementQuantity('1');
      setReplacementUnitPrice('');
      setReplacementDiscountAmount('0');
      setReplacementPopoverOpen(false);
      await qc.invalidateQueries({ queryKey: ['customer-return', id] });
    },
  });

  const removeReplacement = useMutation({
    mutationFn: (itemId: string) => customerReturnsService.removeReplacement(id, itemId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['customer-return', id] });
    },
  });

  const addSettlement = useMutation({
    mutationFn: () => customerReturnsService.addSettlement(id, {
      settlementKind,
      paymentSource,
      currencyCode: settlementCurrencyCode,
      exchangeRateApplied: Number(exchangeRateApplied || 1),
      amount: Number(settlementAmount),
      cashSessionId: paymentSource === 'CASH_REGISTER' ? cashSessionId || currentCashSession.data?.cashSessionId : undefined,
      reference: settlementReference || undefined,
      expirationDate: settlementKind === 'CUSTOMER_CREDIT' ? settlementExpirationDate || undefined : undefined,
      note: settlementNote || undefined,
    }),
    onSuccess: async () => {
      setSettlementAmount('');
      setSettlementReference('');
      setSettlementExpirationDate('');
      setSettlementNote('');
      await qc.invalidateQueries({ queryKey: ['customer-return', id] });
    },
  });

  const removeSettlement = useMutation({
    mutationFn: (settlementId: string) => customerReturnsService.removeSettlement(id, settlementId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['customer-return', id] });
    },
  });

  const validateReturn = useMutation({
    mutationFn: () => customerReturnsService.validate(id),
    onSuccess: async () => {
      setActiveStep(7);
      await qc.invalidateQueries({ queryKey: ['customer-return', id] });
      await qc.invalidateQueries({ queryKey: ['customer-returns'] });
      if (current?.customerId) {
        await qc.invalidateQueries({ queryKey: ['customer-return-credits', current.customerId] });
      }
    },
  });

  const approveUnlinked = useMutation({
    mutationFn: () => customerReturnsService.approveUnlinked(id),
    onSuccess: async () => {
      setActiveStep(3);
      await qc.invalidateQueries({ queryKey: ['customer-return', id] });
      await qc.invalidateQueries({ queryKey: ['customer-returns'] });
    },
  });

  const cancelReturn = useMutation({
    mutationFn: () => customerReturnsService.cancel(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['customer-return', id] });
      await qc.invalidateQueries({ queryKey: ['customer-returns'] });
    },
  });

  const firstError = [
    query.error,
    addItem.error,
    removeItem.error,
    submitInspection.error,
    inspect.error,
    addReplacement.error,
    removeReplacement.error,
    addSettlement.error,
    removeSettlement.error,
    validateReturn.error,
    approveUnlinked.error,
    cancelReturn.error,
  ].find(Boolean);
  const currentError = firstError ? apiErrorMessage(firstError) : '';

  function submitReturnedItem(event: FormEvent) {
    event.preventDefault();
    if (!selectedSaleItemId) return;
    addItem.mutate();
  }

  function submitReplacement(event: FormEvent) {
    event.preventDefault();
    if (!replacementArticleId) return;
    addReplacement.mutate();
  }

  function submitSettlement(event: FormEvent) {
    event.preventDefault();
    addSettlement.mutate();
  }

  if (query.isLoading) {
    return <p className="loading-state">Chargement du retour client...</p>;
  }

  if (query.isError || !current) {
    return <div className="card"><p className="empty-state">{currentError || 'Retour client introuvable.'}</p></div>;
  }

  const stepCompletion = {
    1: Boolean(current.saleId),
    2: currentItems.length > 0,
    3: ['APPROVED', 'REJECTED', 'VALIDATED', 'CANCELLED'].includes(current.status),
    4: current.status !== 'DRAFT' && current.status !== 'PENDING_INSPECTION',
    5: true,
    6: current.status !== 'DRAFT' && current.status !== 'PENDING_INSPECTION',
    7: current.status === 'VALIDATED',
  } satisfies Record<WizardStep, boolean>;

  return (
    <>
      <div className="breadcrumb">
        <Link to="/customer-returns">Retours clients</Link>
        <span>&gt;</span>
        <strong>{current.returnNumber}</strong>
      </div>

      <div className="toolbar">
        <div>
          <h1>{current.returnNumber}</h1>
          <p className="muted">Echanges, remboursements et avoirs clients, sans mouvement de stock dans ce sprint.</p>
        </div>
        <div className="table-actions">
          <Link className="ghost-button compact-button" to="/customer-returns">Liste</Link>
          {canEditDraft ? (
            <button className="ghost-button compact-button" type="button" onClick={() => submitInspection.mutate()} disabled={submitInspection.isPending || currentItems.length === 0}>
              Envoyer en inspection
            </button>
          ) : null}
          {canValidate ? (
            <button className="button compact-button" type="button" onClick={() => validateReturn.mutate()} disabled={validateReturn.isPending}>
              Valider
            </button>
          ) : null}
          {canApproveUnlinked ? (
            <button className="button compact-button" type="button" onClick={() => approveUnlinked.mutate()} disabled={approveUnlinked.isPending}>
              Validation responsable
            </button>
          ) : null}
          {current.status !== 'VALIDATED' && current.status !== 'CANCELLED' ? (
            <button className="ghost-button compact-button" type="button" onClick={() => cancelReturn.mutate()} disabled={cancelReturn.isPending}>
              Annuler
            </button>
          ) : null}
        </div>
      </div>

      {currentError ? (
        <p className="form-error">{currentError}</p>
      ) : null}

      <section className="card compact-card">
        <div className="detail-grid">
          <div><span>Retour</span><strong>{current.returnNumber}</strong></div>
          <div><span>Date</span><strong>{formatDate(current.returnDate)}</strong></div>
          <div><span>Vente</span><strong>{current.saleNumberSnapshot}</strong></div>
          <div><span>Client</span><strong>{current.customerNameSnapshot || current.organizationNameSnapshot || 'Comptoir'}</strong></div>
          <div><span>Site</span><strong>{current.siteNameSnapshot}</strong></div>
          <div><span>Statut</span><strong><span className={`badge ${customerReturnStatusClass(current.status)}`}>{customerReturnStatusLabel(current.status)}</span></strong></div>
          <div><span>Origine</span><strong>{current.saleLinkStatus === 'UNLINKED' ? 'Retour sans facture' : 'Vente retrouvee'}</strong></div>
          <div><span>Tracabilite</span><strong>{current.traceabilityStatus || '-'}</strong></div>
          <div><span>Confiance</span><strong>{current.confidenceScore ?? 0}%</strong></div>
          <div><span>Montant retourne</span><strong>{formatMoney(current.returnedValueUsd ?? 0, 'USD')}</strong></div>
          <div><span>Montant remis</span><strong>{formatMoney(current.replacementValueUsd ?? 0, 'USD')}</strong></div>
          <div><span>Difference</span><strong>{formatMoney(Math.abs(current.financialDifferenceUsd ?? 0), 'USD')}</strong></div>
          <div><span>Remboursement du</span><strong>{formatMoney(current.refundDueUsd ?? 0, 'USD')}</strong></div>
          <div><span>Complement du</span><strong>{formatMoney(current.additionalPaymentDueUsd ?? 0, 'USD')}</strong></div>
          <div><span>Avoir cree</span><strong>{formatMoney(current.customerCreditUsd ?? 0, 'USD')}</strong></div>
        </div>
      </section>

      {current.saleLinkStatus === 'UNLINKED' ? (
        <section className="card compact-card">
          <div className="panel-heading">
            <div>
              <h2>Retour sans facture</h2>
              <p className="muted">Dossier exceptionnel soumis a tracabilite et validation responsable. Aucun mouvement stock ou caisse n est cree automatiquement.</p>
            </div>
            <span className={`badge ${current.traceabilityStatus === 'STRONG' ? 'badge-success' : current.traceabilityStatus === 'PARTIAL' ? 'badge-info' : current.traceabilityStatus === 'WEAK' ? 'badge-warning' : 'badge-muted'}`}>
              {current.traceabilityStatus || 'NONE'} - {current.confidenceScore ?? 0}%
            </span>
          </div>
          <div className="detail-grid">
            <div><span>Nom declare</span><strong>{current.declaredCustomerName || '-'}</strong></div>
            <div><span>Telephone</span><strong>{current.declaredCustomerPhone || '-'}</strong></div>
            <div><span>Article declare</span><strong>{current.declaredArticleName || '-'}</strong></div>
            <div><span>Quantite</span><strong>{current.declaredQuantity ?? '-'}</strong></div>
            <div><span>Lot</span><strong>{current.declaredLotNumber || '-'}</strong></div>
            <div><span>Expiration</span><strong>{current.declaredExpiryDate ? formatDate(current.declaredExpiryDate) : '-'}</strong></div>
            <div><span>Achat approx.</span><strong>{current.approximatePurchaseDate ? formatDate(current.approximatePurchaseDate) : '-'}</strong></div>
            <div><span>Prix declare</span><strong>{formatMoney(current.declaredPrice || 0, 'USD')}</strong></div>
            <div><span>Responsabilite</span><strong>{current.responsibilityOrigin || '-'}</strong></div>
            <div><span>Decision</span><strong>{current.commercialDecision || '-'}</strong></div>
            <div><span>Responsable</span><strong>{current.approvedWithoutSale ? 'Valide' : 'En attente'}</strong></div>
            <div><span>Approbation</span><strong>{current.approvedAt ? formatDate(current.approvedAt) : '-'}</strong></div>
          </div>
          {current.traceabilityNote ? <p className="muted">{current.traceabilityNote}</p> : null}
          {canApproveUnlinked ? (
            <div className="modal-actions">
              <button className="button compact-button" type="button" onClick={() => approveUnlinked.mutate()} disabled={approveUnlinked.isPending}>
                {approveUnlinked.isPending ? 'Validation...' : 'Valider responsablement'}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="card purchase-return-stepper-card">
        <div className="purchase-return-stepper" role="tablist" aria-label="Etapes retour client" onKeyDown={handleStepKeyDown}>
          {(Object.keys(STEP_LABELS) as unknown as WizardStep[]).map((step) => {
            const isActive = step === activeStep;
            const complete = stepCompletion[step];
            return (
              <button
                key={step}
                type="button"
                id={`customer-return-step-${step}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`customer-return-panel-${step}`}
                aria-current={isActive ? 'step' : undefined}
                className={`purchase-return-step${isActive ? ' is-active' : ''}${complete ? ' is-complete' : ''}`}
                onClick={() => goToStep(step)}
              >
                <span className="purchase-return-step-index">{step}</span>
                <span className="purchase-return-step-label">{STEP_LABELS[step]}</span>
                <small>{complete ? 'Pret' : 'A completer'}</small>
              </button>
            );
          })}
        </div>
      </div>

      {activeStep === 1 ? (
        <section className="card purchase-return-step-section" id="customer-return-panel-1" role="tabpanel" aria-labelledby="customer-return-step-1">
          <div className="purchase-return-step-header">
            <div>
              <h2>Recherche vente</h2>
              <p>Le dossier conserve la vente source, le client, le site et les lignes encore retournables.</p>
            </div>
          </div>
          <div className="detail-grid">
            <div><span>Numero vente</span><strong>{current.saleNumberSnapshot}</strong></div>
            <div><span>Date vente</span><strong>{formatDate(current.saleDateSnapshot)}</strong></div>
            <div><span>Type vente</span><strong>{current.saleTypeSnapshot}</strong></div>
            <div><span>Lignes retour possibles</span><strong>{returnableItems.length}</strong></div>
            <div><span>Articles deja retournes</span><strong>{currentItems.length}</strong></div>
            <div><span>Commentaires</span><strong>{current.note || '-'}</strong></div>
          </div>
        </section>
      ) : null}

      {activeStep === 2 ? (
        <section className="card purchase-return-step-section" id="customer-return-panel-2" role="tabpanel" aria-labelledby="customer-return-step-2">
          <div className="purchase-return-step-header">
            <div>
              <h2>Produits retournes</h2>
              <p>Ajoutez les lignes de vente concernées. Aucun stock n est encore réintégré.</p>
            </div>
          </div>

          {canEditDraft ? (
            <form className="card compact-card purchase-return-inner-card" onSubmit={submitReturnedItem}>
              <div className="grid-form">
                <label className="field-block">
                  <span>Article / lot</span>
                  <FloatingSearchPopover
                    value={saleItemSearch}
                    onChange={setSaleItemSearch}
                    onOpen={() => setSaleItemPopoverOpen(true)}
                    onClose={() => setSaleItemPopoverOpen(false)}
                    onSelect={(item) => {
                      setSelectedSaleItemId(item.saleItemId);
                      setSaleItemSearch(item.commercialName || item.articleCode || '');
                      setReturnedQuantity(String(Math.min(1, item.availableQuantity || 1)));
                    }}
                    open={saleItemPopoverOpen}
                    placeholder="Rechercher une ligne de vente..."
                    searchPlaceholder="Code, nom, lot, DCI..."
                    suggestions={availableSaleItems}
                    getKey={(item) => item.saleItemId}
                    columns={[
                      { header: 'Code', render: (item) => item.articleCode || '-' },
                      { header: 'Nom', render: (item) => item.commercialName || '-' },
                      { header: 'Lot', render: (item) => item.lotNumber || '-' },
                      { header: 'Restant', render: (item) => String(item.availableQuantity) },
                      { header: 'Prix', render: (item) => formatMoney(item.unitPrice || 0, current.currencyCode || 'USD') },
                    ]}
                    footerLabel="Entree pour selectionner - Echap pour fermer"
                    maxVisible={50}
                  />
                </label>
                <label className="field-block">
                  <span>Quantite retournee</span>
                  <input className="input" type="number" min="0.001" step="0.001" value={returnedQuantity} onChange={(event) => setReturnedQuantity(event.target.value)} />
                </label>
                <label className="field-block">
                  <span>Etat</span>
                  <select className="input" value={conditionStatus} onChange={(event) => setConditionStatus(event.target.value)}>
                    <option value="GOOD">Bon etat</option>
                    <option value="OPENED">Ouvert</option>
                    <option value="DAMAGED">Endommage</option>
                    <option value="EXPIRED">Expire</option>
                    <option value="WRONG_PRODUCT">Mauvais produit</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </label>
                <label className="field-block">
                  <span>Note</span>
                  <input className="input" value={itemNote} onChange={(event) => setItemNote(event.target.value)} placeholder="Optionnel" />
                </label>
              </div>
              {selectedSaleItem ? (
                <div className="detail-grid">
                  <div><span>Article</span><strong>{selectedSaleItem.commercialName || selectedSaleItem.articleCode || '-'}</strong></div>
                  <div><span>Lot</span><strong>{selectedSaleItem.lotNumber || '-'}</strong></div>
                  <div><span>Disponible</span><strong>{selectedSaleItem.availableQuantity}</strong></div>
                  <div><span>Prix vente</span><strong>{formatMoney(selectedSaleItem.unitPrice || 0, current.currencyCode || 'USD')}</strong></div>
                </div>
              ) : null}
              <div className="modal-actions">
                <button className="button compact-button" type="submit" disabled={addItem.isPending || !selectedSaleItemId}>
                  {addItem.isPending ? 'Ajout...' : 'Ajouter la ligne'}
                </button>
              </div>
            </form>
          ) : null}

          <div className="card compact-card purchase-return-inner-card">
            {currentItems.length === 0 ? (
              <p className="empty-state">Aucune ligne retournee.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Article</th>
                      <th>Lot</th>
                      <th>Qté</th>
                      <th>Etat</th>
                      <th>Unite</th>
                      <th>Valeur</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map((item) => (
                      <tr key={item.customerReturnItemId}>
                        <td>
                          <strong>{item.commercialName || item.articleCode || '-'}</strong>
                          <div className="muted">{item.articleCode || '-'}</div>
                        </td>
                        <td>{item.lotNumber || '-'}</td>
                        <td className="numeric-text">{item.returnedQuantity}</td>
                        <td>{customerReturnConditionLabel(item.conditionStatus)}</td>
                        <td>{item.salesUnitSnapshot || item.packagingSnapshot || '-'}</td>
                        <td className="numeric-text">{formatMoney(item.lineReturnValue || 0, current.currencyCode || 'USD')}</td>
                        <td className="table-actions">
                          {canEditDraft ? (
                            <button className="ghost-button compact-button" type="button" onClick={() => removeItem.mutate(item.customerReturnItemId)} disabled={removeItem.isPending}>
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
      ) : null}

      {activeStep === 3 ? (
        <section className="card purchase-return-step-section" id="customer-return-panel-3" role="tabpanel" aria-labelledby="customer-return-step-3">
          <div className="purchase-return-step-header">
            <div>
              <h2>Inspection</h2>
              <p>Le dossier doit être inspecté avant d’autoriser l’échange ou la régularisation.</p>
            </div>
          </div>
          {canInspect ? (
            <form className="card compact-card purchase-return-inner-card" onSubmit={(event) => { event.preventDefault(); inspect.mutate(); }}>
              <div className="grid-form">
                <label className="field-block">
                  <span>Decision</span>
                  <select className="input" value={inspectionDecision} onChange={(event) => setInspectionDecision(event.target.value as 'APPROVED' | 'REJECTED')}>
                    <option value="APPROVED">Approuver</option>
                    <option value="REJECTED">Rejeter</option>
                  </select>
                </label>
                <label className="field-block">
                  <span>Note inspection</span>
                  <input className="input" value={inspectionNote} onChange={(event) => setInspectionNote(event.target.value)} placeholder="Optionnel" />
                </label>
              </div>
              <div className="modal-actions">
                <button className="button compact-button" type="submit" disabled={inspect.isPending}>
                  {inspect.isPending ? 'Enregistrement...' : 'Enregistrer la decision'}
                </button>
              </div>
            </form>
          ) : (
            <div className="card compact-card purchase-return-inner-card">
              <p className="muted">
                {current.status === 'APPROVED'
                  ? 'Le dossier est approuve. Vous pouvez preparer les echanges et la regularisation.'
                  : current.status === 'REJECTED'
                    ? 'Le dossier a ete rejete.'
                    : current.status === 'VALIDATED'
                      ? 'Le dossier a deja ete valide.'
                      : 'Le dossier n est pas actuellement en inspection.'}
              </p>
              {current.inspectionNote ? <p><strong>Note:</strong> {current.inspectionNote}</p> : null}
            </div>
          )}
        </section>
      ) : null}

      {activeStep === 4 ? (
        <section className="card purchase-return-step-section" id="customer-return-panel-4" role="tabpanel" aria-labelledby="customer-return-step-4">
          <div className="purchase-return-step-header">
            <div>
              <h2>Produits remis en echange</h2>
              <p>Préparation des produits remis au client. Aucun mouvement de stock n est généré dans ce sprint.</p>
            </div>
          </div>
          {canManageExchanges ? (
            <form className="card compact-card purchase-return-inner-card" onSubmit={submitReplacement}>
              <div className="grid-form">
                <label className="field-block">
                  <span>Article</span>
                  <FloatingSearchPopover
                    value={replacementSearch}
                    onChange={setReplacementSearch}
                    onOpen={() => setReplacementPopoverOpen(true)}
                    onClose={() => setReplacementPopoverOpen(false)}
                    onSelect={(article: Article) => {
                      setReplacementArticleId(article.articleId);
                      setReplacementSearch(article.commercialName || article.articleCode);
                      setReplacementUnitPrice(String(article.sellingPrice ?? ''));
                    }}
                    open={replacementPopoverOpen}
                    placeholder="Rechercher un article..."
                    searchPlaceholder="Code, nom, DCI, dosage..."
                    suggestions={availableArticles}
                    getKey={(article) => article.articleId}
                    columns={[
                      { header: 'Code', render: (article) => article.articleCode || '-' },
                      { header: 'Nom', render: (article) => article.commercialName || '-' },
                      { header: 'DCI', render: (article) => article.dci || '-' },
                      { header: 'Dosage', render: (article) => article.dosage || '-' },
                      { header: 'Prix', render: (article) => formatMoney(article.sellingPrice || 0, current.currencyCode || 'USD') },
                    ]}
                    footerLabel="Entree pour selectionner - Echap pour fermer"
                    maxVisible={50}
                  />
                </label>
                <label className="field-block">
                  <span>Quantite</span>
                  <input className="input" type="number" min="0.001" step="0.001" value={replacementQuantity} onChange={(event) => setReplacementQuantity(event.target.value)} />
                </label>
                <label className="field-block">
                  <span>Prix</span>
                  <input className="input" type="number" min="0" step="0.01" value={replacementUnitPrice} onChange={(event) => setReplacementUnitPrice(event.target.value)} />
                </label>
                <label className="field-block">
                  <span>Remise</span>
                  <input className="input" type="number" min="0" step="0.01" value={replacementDiscountAmount} onChange={(event) => setReplacementDiscountAmount(event.target.value)} />
                </label>
              </div>
              <div className="detail-grid">
                <div><span>Article</span><strong>{selectedReplacementArticle?.commercialName || '-'}</strong></div>
                <div><span>Unite vente</span><strong>{selectedReplacementArticle?.packaging || '-'}</strong></div>
                <div><span>Total ligne</span><strong>{formatMoney(replacementLineTotal, current.currencyCode || 'USD')}</strong></div>
                <div><span>Valeur stock</span><strong>Aucun mouvement</strong></div>
              </div>
              <div className="modal-actions">
                <button className="button compact-button" type="submit" disabled={addReplacement.isPending || !replacementArticleId || !replacementUnitPrice}>
                  {addReplacement.isPending ? 'Ajout...' : 'Ajouter le produit remis'}
                </button>
              </div>
            </form>
          ) : null}

          <div className="card compact-card purchase-return-inner-card">
            {replacementItems.length === 0 ? (
              <p className="empty-state">Aucun produit remis en echange.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Article</th>
                      <th>Unite</th>
                      <th>Qté</th>
                      <th>Prix</th>
                      <th>Remise</th>
                      <th>Total</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {replacementItems.map((item) => (
                      <tr key={item.customerReturnReplacementItemId}>
                        <td>
                          <strong>{item.commercialName || item.articleCode || '-'}</strong>
                          <div className="muted">{item.articleCode || '-'}</div>
                        </td>
                        <td>{item.salesUnitSnapshot || item.packagingSnapshot || '-'}</td>
                        <td className="numeric-text">{item.quantity}</td>
                        <td className="numeric-text">{formatMoney(item.unitPrice, current.currencyCode || 'USD')}</td>
                        <td className="numeric-text">{formatMoney(item.discountAmount, current.currencyCode || 'USD')}</td>
                        <td className="numeric-text">{formatMoney(item.lineTotal, current.currencyCode || 'USD')}</td>
                        <td className="table-actions">
                          {canManageExchanges ? (
                            <button className="ghost-button compact-button" type="button" onClick={() => removeReplacement.mutate(item.customerReturnReplacementItemId)} disabled={removeReplacement.isPending}>
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
      ) : null}

      {activeStep === 5 ? (
        <section className="card purchase-return-step-section" id="customer-return-panel-5" role="tabpanel" aria-labelledby="customer-return-step-5">
          <div className="purchase-return-step-header">
            <div>
              <h2>Difference financiere</h2>
              <p>Le calcul est global sur les articles retournés et les produits remis en échange.</p>
            </div>
          </div>
          <div className="detail-grid purchase-return-financial-grid">
            <div><span>Produits retournes</span><strong>{formatMoney(returnedValueCurrency, 'USD')}</strong></div>
            <div><span>Produits remis</span><strong>{formatMoney(replacementValueCurrency, 'USD')}</strong></div>
            <div><span>Difference</span><strong>{formatMoney(current.financialDifferenceUsd ?? 0, 'USD')}</strong></div>
            <div><span>Remboursement du</span><strong>{formatMoney(current.refundDueUsd ?? 0, 'USD')}</strong></div>
            <div><span>Complement du</span><strong>{formatMoney(current.additionalPaymentDueUsd ?? 0, 'USD')}</strong></div>
            <div><span>Avoir client</span><strong>{formatMoney(current.customerCreditUsd ?? 0, 'USD')}</strong></div>
          </div>
          <div className="card compact-card">
            <div className="panel-heading">
              <div>
                <h3>Lecture metier</h3>
                <p className="muted">Cas 1: egalite, Cas 2: remboursement, Cas 3: complement, Cas 4: calcul global sur plusieurs produits.</p>
              </div>
              <span className={`badge ${financialSummary.tone}`}>{financialSummary.label}</span>
            </div>
            <p>{financialSummary.description}</p>
          </div>
        </section>
      ) : null}

      {activeStep === 6 ? (
        <section className="card purchase-return-step-section" id="customer-return-panel-6" role="tabpanel" aria-labelledby="customer-return-step-6">
          <div className="purchase-return-step-header">
            <div>
              <h2>Regularisations</h2>
              <p>Renseignez les remboursements, compléments ou avoirs clients nécessaires pour équilibrer le dossier.</p>
            </div>
          </div>
          {canManageSettlements ? (
            <form className="card compact-card purchase-return-inner-card" onSubmit={submitSettlement}>
              <div className="grid-form">
                <label className="field-block">
                  <span>Mode</span>
                  <select className="input" value={settlementFlowMode} onChange={(event) => setSettlementFlowMode(event.target.value as SettlementFlowMode)}>
                    {SETTLEMENT_FLOW_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="field-block">
                  <span>Nature</span>
                  <select className="input" value={settlementKind} onChange={(event) => setSettlementKind(event.target.value)}>
                    <option value="REFUND">Remboursement</option>
                    <option value="ADDITIONAL_PAYMENT">Complement client</option>
                    <option value="CUSTOMER_CREDIT">Avoir client</option>
                  </select>
                </label>
                <label className="field-block">
                  <span>Source</span>
                  <select className="input" value={paymentSource} onChange={(event) => setPaymentSource(event.target.value)}>
                    {PAYMENT_SOURCE_OPTIONS
                      .filter((option) => (settlementKind === 'CUSTOMER_CREDIT' ? option.value === 'CUSTOMER_CREDIT' : option.value !== 'CUSTOMER_CREDIT'))
                      .map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="field-block">
                  <span>Devise</span>
                  <select className="input" value={settlementCurrencyCode} onChange={(event) => setSettlementCurrencyCode(event.target.value)}>
                    <option value="USD">USD</option>
                    <option value="CDF">CDF</option>
                  </select>
                </label>
                <label className="field-block">
                  <span>Taux</span>
                  <input className="input" type="number" min="1" step="0.0001" value={exchangeRateApplied} onChange={(event) => setExchangeRateApplied(event.target.value)} disabled={settlementCurrencyCode === 'USD'} />
                </label>
                <label className="field-block">
                  <span>Montant</span>
                  <input className="input" type="number" min="0.01" step="0.01" value={settlementAmount} onChange={(event) => setSettlementAmount(event.target.value)} />
                </label>
                {paymentSource === 'CASH_REGISTER' ? (
                  <label className="field-block">
                    <span>Session caisse</span>
                    <select className="input" value={cashSessionId} onChange={(event) => setCashSessionId(event.target.value)}>
                      <option value="">Session courante</option>
                      {currentCashSession.data?.cashSessionId ? (
                        <option value={currentCashSession.data.cashSessionId}>
                          {currentCashSession.data.registerName || 'Caisse'} - {currentCashSession.data.userName || 'Utilisateur'}
                        </option>
                      ) : null}
                    </select>
                  </label>
                ) : null}
                {settlementKind === 'CUSTOMER_CREDIT' ? (
                  <label className="field-block">
                    <span>Expiration avoir</span>
                    <input className="input" type="date" value={settlementExpirationDate} onChange={(event) => setSettlementExpirationDate(event.target.value)} />
                  </label>
                ) : null}
                <label className="field-block">
                  <span>Reference</span>
                  <input className="input" value={settlementReference} onChange={(event) => setSettlementReference(event.target.value)} placeholder="Recu, transaction..." />
                </label>
                <label className="field-block">
                  <span>Note</span>
                  <input className="input" value={settlementNote} onChange={(event) => setSettlementNote(event.target.value)} placeholder="Optionnel" />
                </label>
              </div>
              <div className="modal-actions">
                <button className="button compact-button" type="submit" disabled={addSettlement.isPending || !settlementAmount}>
                  {addSettlement.isPending ? 'Enregistrement...' : 'Ajouter la regularisation'}
                </button>
              </div>
            </form>
          ) : null}

          <div className="card compact-card purchase-return-inner-card">
            {settlements.length === 0 ? (
              <p className="empty-state">Aucune regularisation pour le moment.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nature</th>
                      <th>Source</th>
                      <th>Montant</th>
                      <th>USD eq.</th>
                      <th>Reference</th>
                      <th>Expiration</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map((entry) => (
                      <tr key={entry.customerReturnSettlementId}>
                        <td>{customerReturnSettlementKindLabel(entry.settlementKind)}</td>
                        <td>{customerReturnPaymentSourceLabel(entry.paymentSource)}</td>
                        <td className="numeric-text">{formatMoney(entry.amount, entry.currencyCode)}</td>
                        <td className="numeric-text">{formatMoney(entry.amountEquivalentUsd, 'USD')}</td>
                        <td>{entry.reference || '-'}</td>
                        <td>{entry.expirationDate ? formatDate(entry.expirationDate) : '-'}</td>
                        <td className="table-actions">
                          {canManageSettlements ? (
                            <button className="ghost-button compact-button" type="button" onClick={() => removeSettlement.mutate(entry.customerReturnSettlementId)} disabled={removeSettlement.isPending}>
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

          <div className="card compact-card purchase-return-inner-card">
            <div className="panel-heading">
              <div>
                <h3>Avoirs clients crees</h3>
                <p className="muted">Disponibles après validation du retour.</p>
              </div>
            </div>
            {customerCredits.length === 0 ? (
              <p className="empty-state">Aucun avoir client genere pour ce dossier.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Montant initial</th>
                      <th>Solde</th>
                      <th>Statut</th>
                      <th>Expiration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerCredits.map((credit) => (
                      <tr key={credit.customerCreditId}>
                        <td>{credit.customerName || current.customerNameSnapshot || '-'}</td>
                        <td className="numeric-text">{formatMoney(credit.initialAmount, credit.currencyCode)}</td>
                        <td className="numeric-text">{formatMoney(credit.remainingAmount, credit.currencyCode)}</td>
                        <td>{customerCreditStatusLabel(credit.status)}</td>
                        <td>{credit.expirationDate ? formatDate(credit.expirationDate) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeStep === 7 ? (
        <section className="card purchase-return-step-section" id="customer-return-panel-7" role="tabpanel" aria-labelledby="customer-return-step-7">
          <div className="purchase-return-step-header">
            <div>
              <h2>Validation</h2>
              <p>Contrôle final du dossier, des montants, des regularisations et des sorties documentaires.</p>
            </div>
          </div>

          <div className="detail-grid purchase-return-summary-grid">
            <div><span>Statut</span><strong>{customerReturnStatusLabel(current.status)}</strong></div>
            <div><span>Lignes retour</span><strong>{currentItems.length}</strong></div>
            <div><span>Echanges</span><strong>{replacementItems.length}</strong></div>
            <div><span>Regularisations</span><strong>{settlements.length}</strong></div>
            <div><span>Rembourse a ce jour</span><strong>{formatMoney(current.refundedAmountUsd ?? 0, 'USD')}</strong></div>
            <div><span>Complement recu</span><strong>{formatMoney(current.additionalPaidUsd ?? 0, 'USD')}</strong></div>
          </div>

          <div className="table-actions">
            <button className="ghost-button compact-button" type="button" disabled>Imprimer bon d echange</button>
            <button className="ghost-button compact-button" type="button" disabled>Imprimer recu remboursement</button>
            <button className="ghost-button compact-button" type="button" disabled>Imprimer recu complement</button>
            <button className="ghost-button compact-button" type="button" disabled>Imprimer avoir client</button>
          </div>

          {canValidate ? (
            <div className="modal-actions">
              <button className="button compact-button" type="button" onClick={() => validateReturn.mutate()} disabled={validateReturn.isPending}>
                {validateReturn.isPending ? 'Validation...' : 'Valider le retour client'}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {permissions.includes('customer_return_attachments.read') ? (
        <Suspense fallback={<p className="loading-state">Chargement des pieces jointes...</p>}>
          <LazyAttachments
            title="Pieces jointes retour client"
            queryKey={['customer-return-attachments', id]}
            api={{
              list: () => customerReturnsService.getAttachments(id),
              upload: (payload) => customerReturnsService.uploadAttachment(id, payload),
              openUrl: (attachmentId) => customerReturnsService.getAttachmentUrl(id, attachmentId),
              remove: (attachmentId) => customerReturnsService.deleteAttachment(id, attachmentId),
            }}
            canCreate={permissions.includes('customer_return_attachments.create')}
            canDelete={permissions.includes('customer_return_attachments.delete')}
          />
        </Suspense>
      ) : null}

      <CommentsPanel entityType="CUSTOMER_RETURN" entityId={current.customerReturnId} title="Commentaires" />
    </>
  );
}
