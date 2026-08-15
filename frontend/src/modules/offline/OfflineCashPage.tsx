import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import {
  createOfflineCashExpense,
  openOfflineCashSession,
  closeOfflineCashSession,
  canAttachOfflineCashSale,
} from './offline-cash';
import {
  readOfflineCashCounts,
  readOfflineCashMovements,
  readOfflineCashReconciliationEvents,
  readOfflineCashSessions,
} from './offline-storage';
import { loadLocalSnapshot, type OfflineSnapshotViewModel } from './offline-bootstrap';
import { runSync } from './sync-engine';
import { OfflineWorkspaceLayout, mapOfflineSellerMessage } from './offline-ui';
import { type OfflineCashCount, type OfflineCashMovement, type OfflineCashReconciliationEvent, type OfflineCashSessionSnapshot } from './offline-types';

const emptyViewModel: OfflineSnapshotViewModel = {
  snapshot: {
    articles: [],
    lots: [],
    allocations: [],
    customers: [],
    settings: null,
    auth: null,
    workstation: null,
    cashSession: null,
    syncState: null,
  },
  queue: [],
  syncLog: [],
  conflicts: [],
  authorizationState: 'EXPIRED',
  snapshotStatus: 'UNKNOWN',
  networkStatus: 'OFFLINE',
};

export function OfflineCashPage() {
  const [viewModel, setViewModel] = useState<OfflineSnapshotViewModel>(emptyViewModel);
  const [sessions, setSessions] = useState<OfflineCashSessionSnapshot[]>([]);
  const [movements, setMovements] = useState<OfflineCashMovement[]>([]);
  const [counts, setCounts] = useState<OfflineCashCount[]>([]);
  const [events, setEvents] = useState<OfflineCashReconciliationEvent[]>([]);
  const [message, setMessage] = useState('Caisse offline locale par poste, synchronisee ensuite via la queue offline.');
  const [busy, setBusy] = useState<'open' | 'expense' | 'close' | 'sync' | null>(null);
  const [openingUsd, setOpeningUsd] = useState('0');
  const [openingCdf, setOpeningCdf] = useState('0');
  const [openingNote, setOpeningNote] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCurrency, setExpenseCurrency] = useState<'USD' | 'CDF'>('USD');
  const [expenseCategory, setExpenseCategory] = useState('Divers');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [declaredUsd, setDeclaredUsd] = useState('');
  const [declaredCdf, setDeclaredCdf] = useState('');
  const [closeNote, setCloseNote] = useState('');

  async function refresh() {
    const [localView, localSessions, localMovements, localCounts, localEvents] = await Promise.all([
      loadLocalSnapshot(),
      readOfflineCashSessions(),
      readOfflineCashMovements(),
      readOfflineCashCounts(),
      readOfflineCashReconciliationEvents(),
    ]);
    setViewModel(localView);
    setSessions(localSessions);
    setMovements(localMovements);
    setCounts(localCounts);
    setEvents(localEvents);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const activeSession = viewModel.snapshot.cashSession;
  const sessionMovements = useMemo(
    () => (activeSession ? movements.filter((row) => row.localCashSessionId === activeSession.localCashSessionId) : []),
    [activeSession, movements],
  );
  const sessionCounts = useMemo(
    () => (activeSession ? counts.filter((row) => row.localCashSessionId === activeSession.localCashSessionId) : []),
    [activeSession, counts],
  );
  const sessionEvents = useMemo(
    () => (activeSession ? events.filter((row) => row.localCashSessionId === activeSession.localCashSessionId) : []),
    [activeSession, events],
  );
  const canOpen = Boolean(viewModel.snapshot.auth && viewModel.snapshot.workstation && !canAttachOfflineCashSale(activeSession));
  const canExpense = Boolean(activeSession && canAttachOfflineCashSale(activeSession));
  const canClose = Boolean(activeSession && canAttachOfflineCashSale(activeSession));

  async function handleOpen() {
    setBusy('open');
    try {
      const session = await openOfflineCashSession({
        openingBalanceUsd: Number(openingUsd || 0),
        openingBalanceCdf: Number(openingCdf || 0),
        note: openingNote,
      });
      setMessage(`Caisse offline ${session.offlineCashReference} ouverte localement.`);
      setOpeningNote('');
      await refresh();
    } catch (error) {
      setMessage(mapOfflineSellerMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function handleExpense() {
    if (!activeSession) return;
    setBusy('expense');
    try {
      await createOfflineCashExpense({
        localCashSessionId: activeSession.localCashSessionId,
        amount: Number(expenseAmount || 0),
        currency: expenseCurrency,
        expenseCategory,
        description: expenseDescription,
      });
      setMessage(`Depense locale capturee sur ${activeSession.offlineCashReference}.`);
      setExpenseAmount('');
      setExpenseDescription('');
      await refresh();
    } catch (error) {
      setMessage(mapOfflineSellerMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function handleClose() {
    if (!activeSession) return;
    const usd = Number(declaredUsd || 0);
    const cdf = Number(declaredCdf || 0);
    const diffUsd = Math.round(((usd - activeSession.expectedClosingUsd) + Number.EPSILON) * 100) / 100;
    const diffCdf = Math.round(((cdf - activeSession.expectedClosingCdf) + Number.EPSILON) * 100) / 100;
    if ((Math.abs(diffUsd) > 0.009 || Math.abs(diffCdf) > 0.009) && !closeNote.trim()) {
      setMessage('Une note est requise lorsqu un ecart de caisse existe.');
      return;
    }
    setBusy('close');
    try {
      await closeOfflineCashSession({
        localCashSessionId: activeSession.localCashSessionId,
        declaredClosingUsd: usd,
        declaredClosingCdf: cdf,
        note: closeNote,
      });
      setMessage(`Caisse offline ${activeSession.offlineCashReference} fermee localement, synchronisation en attente.`);
      setCloseNote('');
      await refresh();
    } catch (error) {
      setMessage(mapOfflineSellerMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function handleSync() {
    setBusy('sync');
    try {
      await runSync('manual');
      setMessage('Synchronisation offline relancee.');
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <OfflineWorkspaceLayout
      mode="seller"
      viewModel={viewModel}
      cashSession={activeSession}
      title="Caisse offline"
      subtitle="Ouverture locale, depenses, comptage et fermeture avant replay serveur."
      topActions={(
        <button className="ghost-button compact-button" type="button" onClick={() => void handleSync()} disabled={busy !== null}>
          Synchroniser
        </button>
      )}
    >
      <section className="offline-kpis">
        <div className="card offline-kpi"><span>Sessions</span><strong>{sessions.length}</strong></div>
        <div className="card offline-kpi"><span>Ouvertes</span><strong>{sessions.filter((row) => canAttachOfflineCashSale(row)).length}</strong></div>
        <div className="card offline-kpi"><span>Fermetures en attente</span><strong>{sessions.filter((row) => row.status === 'CLOSED_PENDING_SYNC').length}</strong></div>
        <div className="card offline-kpi"><span>Conflits</span><strong>{sessions.filter((row) => row.status === 'CONFLICT').length}</strong></div>
      </section>

      <section className="offline-pos-grid offline-cash-grid-premium">
        <div className="offline-pos-left">
          <section className="card offline-panel offline-pos-context">
            <div className="offline-pos-context-grid">
              <div><span className="offline-caption">Poste</span><strong>{viewModel.snapshot.workstation?.workstationName ?? '-'}</strong></div>
              <div><span className="offline-caption">Site</span><strong>{viewModel.snapshot.workstation?.siteName ?? '-'}</strong></div>
              <div><span className="offline-caption">Utilisateur</span><strong>{viewModel.snapshot.auth?.displayName ?? '-'}</strong></div>
              <div><span className="offline-caption">Reseau</span><strong>{viewModel.networkStatus}</strong></div>
              <div><span className="offline-caption">Derniere sync</span><strong>{formatDateTime(viewModel.snapshot.syncState?.lastSuccessfulSyncAt)}</strong></div>
              <div><span className="offline-caption">Etat local</span><strong>{activeSession?.status ?? 'Aucune session'}</strong></div>
            </div>
            <p className="offline-preview">{message}</p>
          </section>

          {!activeSession ? (
            <section className="card offline-panel">
              <div className="offline-panel-heading">
                <h3>Aucune caisse ouverte</h3>
                <span className="offline-row-meta">Ouvrez une session locale pour permettre l encaissement offline.</span>
              </div>
              <div className="detail-grid compact-detail-grid">
                <label>
                  <span>Fonds initial USD</span>
                  <input className="input compact-input" type="number" min="0" step="0.01" value={openingUsd} onChange={(event) => setOpeningUsd(event.target.value)} />
                </label>
                <label>
                  <span>Fonds initial CDF</span>
                  <input className="input compact-input" type="number" min="0" step="1" value={openingCdf} onChange={(event) => setOpeningCdf(event.target.value)} />
                </label>
              </div>
              <label>
                <span>Note</span>
                <input className="input compact-input" value={openingNote} onChange={(event) => setOpeningNote(event.target.value)} placeholder="Observation d ouverture" />
              </label>
              <div className="offline-panel-actions">
                <button className="button compact-button" type="button" onClick={() => void handleOpen()} disabled={!canOpen || busy !== null}>
                  Ouvrir la caisse hors ligne
                </button>
              </div>
            </section>
          ) : (
            <>
              <section className="card offline-panel">
                <div className="offline-panel-heading">
                  <h3>Session locale</h3>
                  <span className="offline-row-meta">{activeSession.offlineCashReference}</span>
                </div>
                <div className="offline-summary-grid">
                  <div><span>Ouverture USD</span><strong>{formatMoney(activeSession.openingBalanceUsd, 'USD')}</strong></div>
                  <div><span>Ouverture CDF</span><strong>{`${Math.round(activeSession.openingBalanceCdf).toLocaleString('fr-FR')} FC`}</strong></div>
                  <div><span>Ventes USD</span><strong>{formatMoney(activeSession.cashSalesUsd, 'USD')}</strong></div>
                  <div><span>Ventes CDF</span><strong>{`${Math.round(activeSession.cashSalesCdf).toLocaleString('fr-FR')} FC`}</strong></div>
                  <div><span>Depenses USD</span><strong>{formatMoney(activeSession.expensesUsd, 'USD')}</strong></div>
                  <div><span>Depenses CDF</span><strong>{`${Math.round(activeSession.expensesCdf).toLocaleString('fr-FR')} FC`}</strong></div>
                  <div><span>Theorique USD</span><strong>{formatMoney(activeSession.expectedClosingUsd, 'USD')}</strong></div>
                  <div><span>Theorique CDF</span><strong>{`${Math.round(activeSession.expectedClosingCdf).toLocaleString('fr-FR')} FC`}</strong></div>
                </div>
              </section>

              <section className="card offline-panel">
                <div className="offline-panel-heading">
                  <h3>Nouvelle depense</h3>
                  <span className="offline-row-meta">Uniquement sur une session locale encore ouverte.</span>
                </div>
                <div className="detail-grid compact-detail-grid">
                  <label>
                    <span>Montant</span>
                    <input className="input compact-input" type="number" min="0" step="0.01" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} />
                  </label>
                  <label>
                    <span>Devise</span>
                    <select className="input compact-input" value={expenseCurrency} onChange={(event) => setExpenseCurrency(event.target.value as 'USD' | 'CDF')}>
                      <option value="USD">USD</option>
                      <option value="CDF">CDF</option>
                    </select>
                  </label>
                  <label>
                    <span>Motif</span>
                    <input className="input compact-input" value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)} />
                  </label>
                  <label>
                    <span>Description</span>
                    <input className="input compact-input" value={expenseDescription} onChange={(event) => setExpenseDescription(event.target.value)} placeholder="Description" />
                  </label>
                </div>
                <div className="offline-panel-actions">
                  <button className="button compact-button" type="button" onClick={() => void handleExpense()} disabled={!canExpense || busy !== null}>
                    Enregistrer la depense
                  </button>
                </div>
              </section>

              <section className="card offline-panel">
                <div className="offline-panel-heading">
                  <h3>Compter et fermer</h3>
                  <span className="offline-row-meta">La fermeture part en queue uniquement quand les operations precedentes sont acquittees.</span>
                </div>
                <div className="detail-grid compact-detail-grid">
                  <label>
                    <span>Physique USD</span>
                    <input className="input compact-input" type="number" min="0" step="0.01" value={declaredUsd} onChange={(event) => setDeclaredUsd(event.target.value)} />
                  </label>
                  <label>
                    <span>Physique CDF</span>
                    <input className="input compact-input" type="number" min="0" step="1" value={declaredCdf} onChange={(event) => setDeclaredCdf(event.target.value)} />
                  </label>
                </div>
                <div className="offline-summary-grid">
                  <div><span>Theorique USD</span><strong>{formatMoney(activeSession.expectedClosingUsd, 'USD')}</strong></div>
                  <div><span>Theorique CDF</span><strong>{`${Math.round(activeSession.expectedClosingCdf).toLocaleString('fr-FR')} FC`}</strong></div>
                  <div><span>Ecart USD</span><strong>{gapLabel(Number(declaredUsd || 0) - activeSession.expectedClosingUsd)} - {formatMoney(Number(declaredUsd || 0) - activeSession.expectedClosingUsd, 'USD')}</strong></div>
                  <div><span>Ecart CDF</span><strong>{gapLabel(Number(declaredCdf || 0) - activeSession.expectedClosingCdf)} - {`${Math.round((Number(declaredCdf || 0) - activeSession.expectedClosingCdf)).toLocaleString('fr-FR')} FC`}</strong></div>
                </div>
                <label>
                  <span>Note de fermeture</span>
                  <input className="input compact-input" value={closeNote} onChange={(event) => setCloseNote(event.target.value)} placeholder="Obligatoire si ecart" />
                </label>
                <div className="offline-panel-actions">
                  <button className="button compact-button" type="button" onClick={() => void handleClose()} disabled={!canClose || busy !== null}>
                    Fermer la caisse
                  </button>
                </div>
              </section>
            </>
          )}
        </div>

        <aside className="offline-pos-right">
          <section className="card offline-panel">
            <div className="offline-panel-heading">
              <h3>Journal local</h3>
              <span className="offline-row-meta">{sessionMovements.length} mouvement(s) sur la session active.</span>
            </div>
            <div className="table-wrap">
              <table className="data-table offline-drafts-table">
                <thead>
                  <tr>
                    <th>Heure</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>USD</th>
                    <th>CDF</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionMovements.length === 0 ? (
                    <tr><td colSpan={6}><p className="empty-state">Aucun mouvement local.</p></td></tr>
                  ) : sessionMovements.map((movement) => (
                    <tr key={movement.localMovementId}>
                      <td>{formatDateTime(movement.createdLocallyAt)}</td>
                      <td>{movementTypeLabel(movement.movementType)}</td>
                      <td>{movement.reference ?? '-'}</td>
                      <td>{movement.currency === 'USD' ? formatMoney(movement.amount, 'USD') : '-'}</td>
                      <td>{movement.currency === 'CDF' ? `${Math.round(movement.amount).toLocaleString('fr-FR')} FC` : '-'}</td>
                      <td><span className="badge compact-badge badge-neutral">{movement.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card offline-panel">
            <h3>Comptages</h3>
            {sessionCounts.length === 0 ? <p className="empty-state">Aucun comptage local enregistre.</p> : (
              <div className="detail-grid compact-detail-grid">
                {sessionCounts.slice().reverse().map((count) => (
                  <div key={count.countId}>
                    <span>{formatDateTime(count.countedAt)}</span>
                    <strong>{formatMoney(count.declaredUsd, 'USD')} / {Math.round(count.declaredCdf).toLocaleString('fr-FR')} FC</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card offline-panel">
            <h3>Reconciliations</h3>
            {sessionEvents.length === 0 ? <p className="empty-state">Aucun evenement de reconciliation local.</p> : (
              <div className="detail-grid compact-detail-grid">
                {sessionEvents.slice().reverse().map((event) => (
                  <div key={event.eventId}>
                    <span>{event.code}</span>
                    <strong>{event.message}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </section>
    </OfflineWorkspaceLayout>
  );
}

function gapLabel(value: number) {
  if (Math.abs(value) < 0.009) return 'Equilibre';
  return value > 0 ? 'Excedent' : 'Manquant';
}

function movementTypeLabel(type: OfflineCashMovement['movementType']) {
  switch (type) {
    case 'OPENING_BALANCE':
      return 'Ouverture';
    case 'SALE_CASH_IN':
      return 'Vente';
    case 'EXPENSE_OUT':
      return 'Depense';
    case 'CLOSING_DECLARATION':
      return 'Fermeture';
    default:
      return type;
  }
}
