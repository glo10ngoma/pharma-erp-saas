import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../auth/AuthContext';
import { articlesService } from '../../services/articles.service';
import { apiErrorMessage } from '../../services/apiError';
import { type FefoAction, lotsService } from '../../services/lots.service';
import { stocksService } from '../../services/stocks.service';
import { downloadCsv, downloadJson, downloadXlsx } from '../../utils/export';
import { fileDateStamp, formatDate, formatDateTime } from '../../utils/date';
import { fetchAllPages } from '../../utils/fetchAllPages';
import { formatMoney } from '../../utils/money';
import {
  buildFefoRiskRows,
  buildRotationKpis,
  buildRotationRows,
  expectedActionType,
  fefoActionKey,
  priorityMeta,
  type FefoPriority,
  type FefoRiskRow,
  type FefoRotationRow,
} from './fefo-utils';

type PriorityFilter = 'ALL' | FefoPriority;
type ActionFilter = 'ALL' | 'REQUIRED' | 'DONE';

export function FefoRotationPage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const [search, setSearch] = useState('');
  const [siteId, setSiteId] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('ALL');
  const [selectedExpiredRow, setSelectedExpiredRow] = useState<FefoRotationRow | null>(null);
  const [selectedConfirmRow, setSelectedConfirmRow] = useState<FefoRotationRow | null>(null);
  const [selectedBlockedRow, setSelectedBlockedRow] = useState<FefoRotationRow | null>(null);
  const [expiredQuantity, setExpiredQuantity] = useState('0');
  const [expiredNote, setExpiredNote] = useState('');
  const [confirmNote, setConfirmNote] = useState('');
  const [expiredRequestKey, setExpiredRequestKey] = useState('');
  const [confirmRequestKey, setConfirmRequestKey] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canExecuteFefoActions = permissions.includes('fefo.actions.execute');
  const canRemoveExpiredStock = permissions.includes('lots.expired_stock.remove');

  const lots = useQuery({ queryKey: ['lots'], queryFn: async () => (await lotsService.getAll()).data });
  const stocks = useQuery({ queryKey: ['stocks'], queryFn: async () => (await stocksService.getAll()).data });
  const articles = useQuery({
    queryKey: ['articles', 'fefo'],
    queryFn: async () =>
      fetchAllPages(
        async ({ page, limit }) => (await articlesService.getAll({ page, limit })).data,
        { limit: 100, maxPages: 100, getKey: (article) => article.articleId },
      ),
    staleTime: 5 * 60 * 1000,
  });
  const fefoActions = useQuery({
    queryKey: ['lots', 'fefo-actions'],
    queryFn: async () => (await lotsService.getFefoActions()).data,
    staleTime: 30 * 1000,
  });

  const confirmAction = useMutation({
    mutationFn: (payload: { lotId: string; siteId: string; actionType: 'HIGHLIGHT_CONFIRMED' | 'SHELF_ROTATION_CONFIRMED'; note?: string; requestKey: string }) =>
      lotsService.confirmFefoAction(payload.lotId, { siteId: payload.siteId, actionType: payload.actionType, note: payload.note, requestKey: payload.requestKey }),
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'Action FEFO enregistree avec succes.' });
      setSelectedConfirmRow(null);
      setConfirmNote('');
      setConfirmRequestKey('');
      invalidateFefoQueries(qc);
    },
    onError: (error) => setFeedback({ type: 'error', message: apiErrorMessage(error) }),
  });

  const removeExpiredStock = useMutation({
    mutationFn: (payload: { lotId: string; siteId: string; quantity: number; note?: string; requestKey: string }) =>
      lotsService.removeExpiredStock(payload.lotId, {
        siteId: payload.siteId,
        quantity: payload.quantity,
        reason: 'EXPIRED',
        note: payload.note,
        requestKey: payload.requestKey,
      }),
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'Sortie de stock enregistree avec succes.' });
      setSelectedExpiredRow(null);
      setExpiredNote('');
      setExpiredRequestKey('');
      invalidateFefoQueries(qc);
    },
    onError: (error) => setFeedback({ type: 'error', message: apiErrorMessage(error) }),
  });

  function handleConfirmExpiredStock() {
    if (!selectedExpiredRow) return;

    const payload = {
      lotId: selectedExpiredRow.lotId,
      siteId: selectedExpiredRow.siteId,
      quantity: expiredQuantityValue,
      note: expiredNote.trim() || undefined,
      requestKey: expiredRequestKey || buildRequestKey(),
    };

    console.info('[FefoRotationPage][removeExpiredStock][click]', {
      rowLotId: selectedExpiredRow.lotId,
      rowLotNumber: selectedExpiredRow.lotNumber,
      rowExpiryDate: selectedExpiredRow.expiryDate,
      url: `/lots/${selectedExpiredRow.lotId}/remove-expired-stock`,
      payload,
    });

    removeExpiredStock.mutate(payload);
  }

  useEffect(() => {
    if (selectedExpiredRow) {
      setExpiredQuantity(String(selectedExpiredRow.quantityAvailable));
      setExpiredNote('');
      setExpiredRequestKey(buildRequestKey());
      removeExpiredStock.reset();
    }
  }, [selectedExpiredRow]);

  useEffect(() => {
    if (selectedConfirmRow) {
      setConfirmNote('');
      setConfirmRequestKey(buildRequestKey());
      confirmAction.reset();
    }
  }, [selectedConfirmRow]);

  const expiredQuantityValue = Number(expiredQuantity);
  const expiredQuantityError = !selectedExpiredRow
    ? null
    : !Number.isFinite(expiredQuantityValue) || expiredQuantity.trim() === ''
      ? 'Saisissez une quantite valide.'
      : expiredQuantityValue <= 0
        ? 'La quantite a retirer doit etre superieure a zero.'
        : expiredQuantityValue > selectedExpiredRow.quantityAvailable
          ? 'Le stock disponible est insuffisant pour cette sortie.'
          : null;

  const error = [lots, stocks, articles, fefoActions].find((query) => query.isError)?.error;

  const riskRows = useMemo(
    () => buildFefoRiskRows(lots.data ?? [], stocks.data ?? [], articles.data ?? []),
    [lots.data, stocks.data, articles.data],
  );
  const rotationRows = useMemo(() => buildRotationRows(riskRows), [riskRows]);
  const sites = useMemo(() => Array.from(new Map(riskRows.map((row) => [row.siteId, row.siteName])).entries()), [riskRows]);
  const latestCompletedActions = useMemo(() => buildLatestActionMap(fefoActions.data ?? []), [fefoActions.data]);
  const completedActionKeys = useMemo(() => new Set(latestCompletedActions.keys()), [latestCompletedActions]);
  const filteredRiskRows = useMemo(
    () => filterRiskRows(riskRows, search, siteId, priorityFilter, actionFilter, completedActionKeys),
    [riskRows, search, siteId, priorityFilter, actionFilter, completedActionKeys],
  );
  const filteredRows = useMemo(
    () => filterRotationRows(rotationRows, search, siteId, priorityFilter, actionFilter, completedActionKeys),
    [rotationRows, search, siteId, priorityFilter, actionFilter, completedActionKeys],
  );
  const kpis = useMemo(() => buildRotationKpis(filteredRiskRows, completedActionKeys), [filteredRiskRows, completedActionKeys]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Stock &gt; Rotation des rayons</p>
          <h1>Rotation des rayons</h1>
          <p className="muted-text">Vue decisionnelle : le lot FEFO doit etre celui mis en avant physiquement, avec confirmation des actions terrain.</p>
        </div>
        <ExportActions rows={filteredRows} />
      </div>

      {feedback ? (
        <div className={`card fefo-feedback-card ${feedback.type === 'error' ? 'fefo-feedback-error' : 'fefo-feedback-success'}`} role="status">
          <strong>{feedback.type === 'error' ? 'Action non enregistree.' : 'Operation terminee.'}</strong>
          <small>{feedback.message}</small>
        </div>
      ) : null}
      {error ? (
        <div className="card fefo-error-card" role="alert">
          <strong>Impossible de charger la rotation FEFO.</strong>
          <small>{apiErrorMessage(error)}</small>
        </div>
      ) : null}

      <div className="grid two fefo-kpis">
        <Kpi label="Lots a traiter" value={kpis.lotsToHandle} />
        <Kpi label="Expires" value={kpis.expired} />
        <Kpi label="Bloques" value={kpis.blocked} />
        <Kpi label="Rouges" value={kpis.red} />
        <Kpi label="Oranges" value={kpis.orange} />
        <Kpi label="Verts" value={kpis.green} />
        <Kpi label="Actions realisees" value={kpis.actionsCompleted} />
        <Kpi label="Valeur concernee" value={formatMoney(kpis.concernedValue, 'USD')} />
      </div>

      <div className="card fefo-filters fefo-rotation-filters">
        <input className="input" placeholder="Rechercher article, code, DCI, lot, site..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
          <option value="">Tous les sites</option>
          {sites.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select className="input" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}>
          <option value="ALL">Toutes priorites</option>
          <option value="EXPIRED">Expires</option>
          <option value="BLOCKED">Bloques</option>
          <option value="RED">Rouges</option>
          <option value="ORANGE">Oranges</option>
          <option value="GREEN">Verts</option>
        </select>
        <select className="input" value={actionFilter} onChange={(event) => setActionFilter(event.target.value as ActionFilter)}>
          <option value="ALL">Toutes actions</option>
          <option value="REQUIRED">Action requise</option>
          <option value="DONE">Action realisee</option>
        </select>
      </div>

      <div className="card">
        {lots.isLoading || stocks.isLoading || articles.isLoading || fefoActions.isLoading ? <p className="loading-state">Analyse rotation en cours...</p> : (
          <div className="table-wrap fefo-table-wrap">
            <table className="data-table fefo-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Lot actuel</th>
                  <th>Expiration</th>
                  <th className="quantity-cell">Stock</th>
                  <th>Priorite</th>
                  <th>Action attendue</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? <tr><td colSpan={7} className="empty-state">Aucune rotation a afficher.</td></tr> : filteredRows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <strong>{row.articleName}</strong><br />
                      <span className="muted-text">{row.articleCode} - {row.siteName}</span>
                    </td>
                    <td>
                      <strong>{row.lotNumber}</strong>
                      {row.blockReason ? <small className="fefo-lot-reason">Motif: {row.blockReason}</small> : null}
                    </td>
                    <td>{formatDate(row.expiryDate)}</td>
                    <td className="quantity-cell">{row.quantityAvailable}</td>
                    <td><PriorityBadge priority={row.priority} /></td>
                    <td>
                      {row.action}
                      {row.mispositioned && <span className="fefo-inline-alert"> lot recent dominant</span>}
                    </td>
                    <td>
                      <RowActionCell
                        row={row}
                        latestAction={latestCompletedActions.get(fefoActionKey(row.siteId, row.lotId, expectedActionType(row.priority)))}
                        canExecuteFefoActions={canExecuteFefoActions}
                        canRemoveExpiredStock={canRemoveExpiredStock}
                        onExpired={() => setSelectedExpiredRow(row)}
                        onConfirm={() => setSelectedConfirmRow(row)}
                        onBlocked={() => setSelectedBlockedRow(row)}
                        busy={confirmAction.isPending || removeExpiredStock.isPending}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal title="Retirer les produits expires du stock" open={Boolean(selectedExpiredRow)} onClose={() => { setSelectedExpiredRow(null); setExpiredRequestKey(''); removeExpiredStock.reset(); }}>
        {selectedExpiredRow ? (
          <div className="fefo-action-modal">
            <div className="detail-grid">
              <div><span>Article</span><strong>{selectedExpiredRow.articleName}</strong></div>
              <div><span>Code</span><strong>{selectedExpiredRow.articleCode}</strong></div>
              <div><span>Lot</span><strong>{selectedExpiredRow.lotNumber}</strong></div>
              <div><span>Expiration</span><strong>{formatDate(selectedExpiredRow.expiryDate)}</strong></div>
              <div><span>Stock disponible</span><strong>{selectedExpiredRow.quantityAvailable}</strong></div>
              <div><span>Site</span><strong>{selectedExpiredRow.siteName}</strong></div>
            </div>
            <p className="muted-text fefo-confirm-text">
              Cette operation creera une sortie de stock pour produits expires. Elle ne peut pas etre annulee directement.
              Toute correction devra passer par un mouvement compensatoire.
            </p>
            <div className="fefo-modal-form">
              <label>
                <span>Quantite a retirer</span>
                <input className="input" type="number" min="0.001" step="0.001" value={expiredQuantity} onChange={(event) => setExpiredQuantity(event.target.value)} />
              </label>
              {expiredQuantityError ? <p className="form-error">{expiredQuantityError}</p> : null}
              <label>
                <span>Observation</span>
                <textarea className="input fefo-modal-textarea" value={expiredNote} onChange={(event) => setExpiredNote(event.target.value)} placeholder="Retire du rayon le 02/08/2026" />
              </label>
              {removeExpiredStock.isError ? <p className="form-error">{apiErrorMessage(removeExpiredStock.error)}</p> : null}
            </div>
            <div className="modal-actions">
              <button className="ghost-button compact-button" type="button" onClick={() => { setSelectedExpiredRow(null); setExpiredRequestKey(''); removeExpiredStock.reset(); }}>Annuler</button>
              <button
                className="button compact-button"
                type="button"
                disabled={removeExpiredStock.isPending || Boolean(expiredQuantityError)}
                onClick={handleConfirmExpiredStock}
              >
                Confirmer la sortie
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal title="Confirmer l action FEFO" open={Boolean(selectedConfirmRow)} onClose={() => { setSelectedConfirmRow(null); setConfirmRequestKey(''); confirmAction.reset(); }}>
        {selectedConfirmRow ? (
          <div className="fefo-action-modal">
            <div className="detail-grid">
              <div><span>Action</span><strong>{selectedConfirmRow.priority === 'RED' ? 'Confirmer mise en avant' : 'Confirmer rotation'}</strong></div>
              <div><span>Article</span><strong>{selectedConfirmRow.articleName}</strong></div>
              <div><span>Lot</span><strong>{selectedConfirmRow.lotNumber}</strong></div>
              <div><span>Echeance</span><strong>{formatDate(selectedConfirmRow.expiryDate)}</strong></div>
            </div>
            <div className="fefo-modal-form">
              <label>
                <span>Note facultative</span>
                <textarea className="input fefo-modal-textarea" value={confirmNote} onChange={(event) => setConfirmNote(event.target.value)} placeholder="Mise en avant realisee en rayon prioritaire." />
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost-button compact-button" type="button" onClick={() => { setSelectedConfirmRow(null); setConfirmRequestKey(''); confirmAction.reset(); }}>Annuler</button>
              <button
                className="button compact-button"
                type="button"
                disabled={confirmAction.isPending}
                onClick={() => confirmAction.mutate({
                  lotId: selectedConfirmRow.lotId,
                  siteId: selectedConfirmRow.siteId,
                  actionType: selectedConfirmRow.priority === 'RED' ? 'HIGHLIGHT_CONFIRMED' : 'SHELF_ROTATION_CONFIRMED',
                  note: confirmNote.trim() || undefined,
                  requestKey: confirmRequestKey || buildRequestKey(),
                })}
              >
                Confirmer l action
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal title="Lot bloque" open={Boolean(selectedBlockedRow)} onClose={() => setSelectedBlockedRow(null)}>
        {selectedBlockedRow ? (
          <div className="fefo-action-modal">
            <div className="detail-grid">
              <div><span>Article</span><strong>{selectedBlockedRow.articleName}</strong></div>
              <div><span>Lot</span><strong>{selectedBlockedRow.lotNumber}</strong></div>
              <div><span>Site</span><strong>{selectedBlockedRow.siteName}</strong></div>
              <div><span>Statut</span><strong>Bloque</strong></div>
            </div>
            <p className="muted-text fefo-confirm-text">
              {selectedBlockedRow.blockReason || 'Aucun motif renseigne.'}
            </p>
            <div className="modal-actions">
              <button className="button compact-button" type="button" onClick={() => setSelectedBlockedRow(null)}>Fermer</button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function filterRiskRows(
  rows: FefoRiskRow[],
  search: string,
  siteId: string,
  priorityFilter: PriorityFilter,
  actionFilter: ActionFilter,
  completedActionKeys: Set<string>,
) {
  const needle = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (siteId && row.siteId !== siteId) return false;
    if (priorityFilter !== 'ALL' && row.priority !== priorityFilter) return false;
    if (actionFilter !== 'ALL') {
      const state = resolveActionState(row.siteId, row.lotId, row.priority, completedActionKeys);
      if (actionFilter === 'REQUIRED' && state !== 'REQUIRED') return false;
      if (actionFilter === 'DONE' && state !== 'DONE') return false;
    }
    if (!needle) return true;
    return [row.articleName, row.articleCode, row.dci, row.lotNumber, row.siteName, row.action].some((value) => value.toLowerCase().includes(needle));
  });
}

function filterRotationRows(
  rows: FefoRotationRow[],
  search: string,
  siteId: string,
  priorityFilter: PriorityFilter,
  actionFilter: ActionFilter,
  completedActionKeys: Set<string>,
) {
  const needle = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (siteId && row.siteId !== siteId) return false;
    if (priorityFilter !== 'ALL' && row.priority !== priorityFilter) return false;
    if (actionFilter !== 'ALL') {
      const state = resolveActionState(row.siteId, row.lotId, row.priority, completedActionKeys);
      if (actionFilter === 'REQUIRED' && state !== 'REQUIRED') return false;
      if (actionFilter === 'DONE' && state !== 'DONE') return false;
    }
    if (!needle) return true;
    return [row.articleName, row.articleCode, row.dci, row.lotNumber, row.siteName, row.action].some((value) => value.toLowerCase().includes(needle));
  });
}

function resolveActionState(siteId: string, lotId: string, priority: FefoPriority, completedActionKeys: Set<string>) {
  const actionType = expectedActionType(priority);
  if (!actionType) return 'NONE';
  return completedActionKeys.has(fefoActionKey(siteId, lotId, actionType)) ? 'DONE' : 'REQUIRED';
}

function buildLatestActionMap(actions: FefoAction[]) {
  const map = new Map<string, FefoAction>();
  for (const action of actions) {
    if (action.actionStatus !== 'COMPLETED') continue;
    const key = fefoActionKey(action.siteId, action.lotId, action.actionType);
    if (!map.has(key)) map.set(key, action);
  }
  return map;
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="card kpi-card"><span className="kpi-label">{label}</span><p className="metric small-metric">{value}</p></div>;
}

function ExportActions({ rows }: { rows: FefoRotationRow[] }) {
  function exportRows(format: 'xlsx' | 'csv' | 'json') {
    const stamp = fileDateStamp();
    const header = ['Article', 'Code', 'Site', 'Lot actuel', 'Expiration', 'Stock', 'Priorite', 'Action attendue', 'Valeur concernee'];
    const data = rows.map((row) => [
      row.articleName,
      row.articleCode,
      row.siteName,
      row.lotNumber,
      formatDate(row.expiryDate),
      row.quantityAvailable,
      priorityMeta(row.priority).label,
      row.action,
      formatMoney(row.stockValue, row.currencyCode, row.currencySymbol),
    ]);
    if (format === 'xlsx') downloadXlsx(`fefo_rotation_${stamp}.xlsx`, [{ name: 'Rotation FEFO', rows: [header, ...data] }]);
    if (format === 'csv') downloadCsv(`fefo_rotation_${stamp}.csv`, [header, ...data]);
    if (format === 'json') downloadJson(`fefo_rotation_${stamp}.json`, rows);
  }

  return (
    <div className="export-actions">
      <button className="ghost-button" onClick={() => exportRows('xlsx')}>Excel</button>
      <button className="ghost-button" onClick={() => exportRows('csv')}>CSV</button>
      <button className="ghost-button" onClick={() => exportRows('json')}>JSON</button>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: FefoRotationRow['priority'] }) {
  const meta = priorityMeta(priority);
  return (
    <span className={meta.className} title={meta.description}>
      <span aria-hidden="true" className="fefo-priority-icon">{meta.icon}</span>
      <span>{meta.label}</span>
    </span>
  );
}

function RowActionCell({
  row,
  latestAction,
  canExecuteFefoActions,
  canRemoveExpiredStock,
  onExpired,
  onConfirm,
  onBlocked,
  busy,
}: {
  row: FefoRotationRow;
  latestAction?: FefoAction;
  canExecuteFefoActions: boolean;
  canRemoveExpiredStock: boolean;
  onExpired: () => void;
  onConfirm: () => void;
  onBlocked: () => void;
  busy: boolean;
}) {
  const state = latestAction ? 'DONE' : expectedActionType(row.priority) ? 'REQUIRED' : 'NONE';

  return (
    <div className="fefo-row-actions">
      {row.priority === 'EXPIRED' ? (
        canRemoveExpiredStock ? (
          <button className="ghost-button compact-button fefo-action-button" type="button" disabled={busy || row.quantityAvailable <= 0} onClick={onExpired}>Retirer du stock</button>
        ) : (
          <span className="fefo-action-hint">Permission requise</span>
        )
      ) : null}

      {row.priority === 'RED' ? (
        canExecuteFefoActions ? (
          <button className="ghost-button compact-button fefo-action-button" type="button" disabled={busy} onClick={onConfirm}>Confirmer mise en avant</button>
        ) : (
          <span className="fefo-action-hint">Permission requise</span>
        )
      ) : null}

      {row.priority === 'ORANGE' ? (
        canExecuteFefoActions ? (
          <button className="ghost-button compact-button fefo-action-button" type="button" disabled={busy} onClick={onConfirm}>Confirmer rotation</button>
        ) : (
          <span className="fefo-action-hint">Permission requise</span>
        )
      ) : null}

      {row.priority === 'BLOCKED' ? (
        <button className="ghost-button compact-button fefo-action-button" type="button" onClick={onBlocked}>Voir le motif</button>
      ) : null}

      {row.priority === 'GREEN' ? <span className="fefo-action-hint">Aucune action requise</span> : null}

      {state === 'DONE' && latestAction ? (
        <div className="fefo-action-meta">
          <span className="badge compact-badge badge-success">Action realisee</span>
          <small>{formatDateTime(latestAction.performedAt)} - {latestAction.performedByName ?? 'Utilisateur'}</small>
          {latestAction.note ? <small>{latestAction.note}</small> : null}
        </div>
      ) : null}
    </div>
  );
}

function invalidateFefoQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['lots'] });
  qc.invalidateQueries({ queryKey: ['stocks'] });
  qc.invalidateQueries({ queryKey: ['lots', 'fefo-actions'] });
  qc.invalidateQueries({ queryKey: ['stock-movements'] });
}

function buildRequestKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `fefo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
