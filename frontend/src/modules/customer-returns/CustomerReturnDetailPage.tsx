import { FormEvent, Suspense, lazy, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { CommentsPanel } from '../../components/CommentsPanel';
import { FloatingSearchPopover } from '../../components/FloatingSearchPopover';
import { apiErrorMessage } from '../../services/apiError';
import { customerReturnsService } from '../../services/customerReturns.service';
import { PurchaseAttachmentsCard } from '../purchases/PurchaseAttachmentsCard';
import { formatDate } from '../../utils/date';
import { customerReturnConditionLabel, customerReturnStatusClass, customerReturnStatusLabel } from './customerReturnLabels';

const LazyAttachments = lazy(async () => ({ default: PurchaseAttachmentsCard }));

export function CustomerReturnDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const [itemSearch, setItemSearch] = useState('');
  const [saleItemId, setSaleItemId] = useState('');
  const [returnedQuantity, setReturnedQuantity] = useState('1');
  const [conditionStatus, setConditionStatus] = useState('GOOD');
  const [note, setNote] = useState('');
  const [inspectionDecision, setInspectionDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [inspectionNote, setInspectionNote] = useState('');

  const query = useQuery({
    queryKey: ['customer-return', id],
    queryFn: async () => (await customerReturnsService.getById(id)).data,
  });

  const current = query.data;
  const selectedItem = useMemo(() => {
    const items = current?.sale?.returnableItems ?? [];
    return items.find((item) => item.saleItemId === saleItemId) ?? null;
  }, [current?.sale?.returnableItems, saleItemId]);

  const availableItems = useMemo(() => {
    const currentIds = new Set((current?.items ?? []).map((item) => item.saleItemId));
    const term = itemSearch.trim().toLowerCase();
    return (current?.sale?.returnableItems ?? [])
      .filter((item) => !currentIds.has(item.saleItemId))
      .filter((item) => {
        if (!term) return true;
        return [
          item.articleCode,
          item.commercialName,
          item.lotNumber,
          item.saleItemId,
        ].some((value) => String(value ?? '').toLowerCase().includes(term));
      });
  }, [current?.items, current?.sale?.returnableItems, itemSearch]);

  const addItem = useMutation({
    mutationFn: () => customerReturnsService.addItem(id, {
      saleItemId,
      returnedQuantity: Number(returnedQuantity),
      conditionStatus,
      note: note || undefined,
    }),
    onSuccess: async () => {
      setSaleItemId('');
      setReturnedQuantity('1');
      setConditionStatus('GOOD');
      setNote('');
      setItemSearch('');
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
      await qc.invalidateQueries({ queryKey: ['customer-return', id] });
    },
  });

  const inspect = useMutation({
    mutationFn: () => customerReturnsService.inspect(id, {
      decision: inspectionDecision,
      note: inspectionNote || undefined,
    }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['customer-return', id] });
    },
  });

  const validate = useMutation({
    mutationFn: () => customerReturnsService.validate(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['customer-return', id] });
      await qc.invalidateQueries({ queryKey: ['customer-returns'] });
    },
  });

  const cancel = useMutation({
    mutationFn: () => customerReturnsService.cancel(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['customer-return', id] });
      await qc.invalidateQueries({ queryKey: ['customer-returns'] });
    },
  });

  function submitAddItem(event: FormEvent) {
    event.preventDefault();
    if (!saleItemId) return;
    addItem.mutate();
  }

  if (query.isLoading) {
    return <p className="loading-state">Chargement du retour client...</p>;
  }

  if (query.isError || !current) {
    return (
      <div className="card">
        <p className="empty-state">{query.isError ? apiErrorMessage(query.error) : 'Retour client introuvable.'}</p>
      </div>
    );
  }

  const saleItems = current.sale?.returnableItems ?? [];
  const currentItems = current.items ?? [];
  const canEdit = current.status === 'DRAFT';
  const canInspect = current.status === 'PENDING_INSPECTION' && permissions.includes('customer_returns.inspect');
  const canValidate = current.status === 'APPROVED' && permissions.includes('customer_returns.validate');

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
          <p className="muted">Dossier client sur la vente {current.saleNumberSnapshot}. Aucun effet stock ou caisse automatique.</p>
        </div>
        <div className="table-actions">
          <Link className="ghost-button compact-button" to="/customer-returns">Liste</Link>
          {canEdit ? <button className="ghost-button compact-button" type="button" onClick={() => submitInspection.mutate()} disabled={submitInspection.isPending || currentItems.length === 0}>Envoyer en inspection</button> : null}
          {canValidate ? <button className="button compact-button" type="button" onClick={() => validate.mutate()} disabled={validate.isPending}>Valider</button> : null}
          {current.status !== 'VALIDATED' && current.status !== 'CANCELLED' ? <button className="ghost-button compact-button" type="button" onClick={() => cancel.mutate()} disabled={cancel.isPending}>Annuler</button> : null}
        </div>
      </div>

      {(query.isError || addItem.isError || submitInspection.isError || inspect.isError || validate.isError || cancel.isError) ? (
        <p className="form-error">
          {apiErrorMessage(query.error) || apiErrorMessage(addItem.error) || apiErrorMessage(submitInspection.error) || apiErrorMessage(inspect.error) || apiErrorMessage(validate.error) || apiErrorMessage(cancel.error)}
        </p>
      ) : null}

      <div className="detail-grid">
        <div><span>Retour</span><strong>{current.returnNumber}</strong></div>
        <div><span>Date</span><strong>{formatDate(current.returnDate)}</strong></div>
        <div><span>Vente</span><strong>{current.saleNumberSnapshot}</strong></div>
        <div><span>Client</span><strong>{current.customerNameSnapshot || current.organizationNameSnapshot || 'Comptoir'}</strong></div>
        <div><span>Site</span><strong>{current.siteNameSnapshot}</strong></div>
        <div><span>Statut</span><strong><span className={`badge ${customerReturnStatusClass(current.status)}`}>{customerReturnStatusLabel(current.status)}</span></strong></div>
        <div><span>Devise</span><strong>{current.currencyCode}</strong></div>
        <div><span>Taux</span><strong>{current.exchangeRateSnapshot}</strong></div>
        <div><span>Motif</span><strong>{current.reason || '-'}</strong></div>
        <div><span>Note</span><strong>{current.note || '-'}</strong></div>
        <div><span>Inspection</span><strong>{current.inspectionNote || '-'}</strong></div>
        <div><span>Lignes</span><strong>{current.itemsCount ?? currentItems.length}</strong></div>
      </div>

      {canEdit && (
        <div className="card">
          <div className="panel-heading">
            <div>
              <h2>Ajouter des articles retournes</h2>
              <p className="muted">Selectionnez une ligne vendue, puis saisissez la quantite retournee.</p>
            </div>
          </div>

          <form className="modal-form" onSubmit={submitAddItem}>
            <FloatingSearchPopover
              value={itemSearch}
              onChange={setItemSearch}
              onOpen={() => void 0}
              onClose={() => void 0}
              onSelect={(item) => {
                setSaleItemId(item.saleItemId);
                setReturnedQuantity(String(Math.min(1, item.availableQuantity || 1)));
              }}
              open
              placeholder="Rechercher un article vendu..."
              searchPlaceholder="Code, nom, lot..."
              suggestions={availableItems}
              getKey={(item) => item.saleItemId}
              columns={[
                { header: 'Article', render: (item) => item.commercialName || '-' },
                { header: 'Lot', render: (item) => item.lotNumber || '-' },
                { header: 'Vendu', render: (item) => String(item.soldQuantity) },
                { header: 'Retourne', render: (item) => String(item.returnedQuantity) },
                { header: 'Restant', render: (item) => String(item.availableQuantity) },
              ]}
              footerLabel="Entree pour selectionner - Echap pour fermer"
              maxVisible={20}
            />

            {selectedItem ? (
              <div className="form-summary">
                <strong>{selectedItem.commercialName || '-'}</strong>
                <span>Lot: {selectedItem.lotNumber || '-'}</span>
                <span>Disponible: {selectedItem.availableQuantity}</span>
              </div>
            ) : null}

            <div className="grid-form">
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
                <input className="input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optionnel" />
              </label>
            </div>

            <div className="modal-actions">
              <button className="button compact-button" type="submit" disabled={addItem.isPending || !saleItemId}>
                {addItem.isPending ? 'Ajout...' : 'Ajouter la ligne'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="panel-heading">
          <div>
            <h2>Lignes retournees</h2>
            <p className="muted">Les quantites retournees sont conservees sans impact automatique sur le stock.</p>
          </div>
        </div>
        {currentItems.length === 0 ? (
          <p className="empty-state">Aucune ligne retournee pour le moment.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Lot</th>
                  <th>Vendu</th>
                  <th>Retourne</th>
                  <th>Etat</th>
                  <th>Note</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((item) => (
                  <tr key={item.customerReturnItemId}>
                    <td>{item.commercialName || item.articleCode || '-'}</td>
                    <td>{item.lotNumber || '-'}</td>
                    <td className="numeric-text">{item.saleQuantity}</td>
                    <td className="numeric-text">{item.returnedQuantity}</td>
                    <td>{customerReturnConditionLabel(item.conditionStatus)}</td>
                    <td>{item.note || '-'}</td>
                    <td className="table-actions">
                      {canEdit ? (
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

      <div className="card">
        <div className="panel-heading">
          <div>
            <h2>Inspection</h2>
            <p className="muted">Le dossier passe par inspection avant validation finale.</p>
          </div>
        </div>
        {current.status === 'PENDING_INSPECTION' && permissions.includes('customer_returns.inspect') ? (
          <form className="modal-form" onSubmit={(event) => { event.preventDefault(); inspect.mutate(); }}>
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
          <p className="muted">
            {current.status === 'APPROVED'
              ? 'Dossier approuve. Vous pouvez valider le retour.'
              : current.status === 'VALIDATED'
                ? 'Dossier valide.'
                : current.status === 'REJECTED'
                  ? 'Dossier rejete.'
                  : 'Le dossier doit d abord passer en inspection.'}
          </p>
        )}
      </div>

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

      <div className="detail-grid">
        <div><span>Validation</span><strong>{customerReturnStatusLabel(current.status)}</strong></div>
        <div><span>Retour</span><strong>{current.reason || '-'}</strong></div>
        <div><span>Inspection</span><strong>{current.inspectionNote || '-'}</strong></div>
        <div><span>Total lignes</span><strong>{currentItems.length}</strong></div>
      </div>
    </>
  );
}
