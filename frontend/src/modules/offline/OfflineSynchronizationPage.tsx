import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { formatDate, formatDateTime } from '../../utils/date';
import {
  applyChanges,
  bootstrapFromServer,
  calculateAuthorizationState,
  getCurrentOfflinePingLabel,
  loadLocalSnapshot,
  pingPosSync,
  type OfflineSnapshotViewModel,
} from './offline-bootstrap';
import {
  allocateOfflineQuantity,
  getOfflineAvailableQuantity,
  isOfflineAllocationVendable,
  sortOfflineAllocationsByFefo,
} from './offline-fefo';
import { buildOfflineAllocationFixtures } from './offline-fixtures';
import {
  clearOfflineAllocations,
  clearOfflineSyncQueue,
  readOfflineSnapshot,
  seedOfflineAllocationFixtures,
} from './offline-storage';
import { OfflineWorkspaceLayout } from './offline-ui';
import { type OfflineAllocationStatus, type OfflineStockAllocation } from './offline-types';
import { runSync } from './sync-engine';
import { useSyncEngine } from './useSyncEngine';

const statusOrder: Array<'ALL' | OfflineAllocationStatus> = ['ALL', 'ACTIVE', 'EXHAUSTED', 'SUSPENDED', 'REVOKED'];

const emptyViewModel: OfflineSnapshotViewModel = {
  snapshot: {
    articles: [],
    lots: [],
    allocations: [],
    customers: [],
    organizations: [],
    insurancePlans: [],
    memberships: [],
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

export function OfflineSynchronizationPage() {
  const { currentUser, permissions } = useAuth();
  const [viewModel, setViewModel] = useState<OfflineSnapshotViewModel>(emptyViewModel);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<'PING' | 'BOOTSTRAP' | 'CHANGES' | 'FIXTURES' | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | OfflineAllocationStatus>('ALL');
  const [articleId, setArticleId] = useState('');
  const [requestedQuantity, setRequestedQuantity] = useState('1');
  const [message, setMessage] = useState('Le snapshot local est pret pour la lecture seule.');
  const [serverPingLabel, setServerPingLabel] = useState('-');
  const syncEngine = useSyncEngine();

  const canReadPosSync = permissions.includes('pos_sync.read');
  const canExecutePosSync = permissions.includes('pos_sync.execute');

  async function refreshLocal() {
    setLoading(true);
    try {
      const next = await loadLocalSnapshot();
      setViewModel(next);
      setArticleId((current) => current || next.snapshot.allocations[0]?.articleId || '');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshLocal();
  }, []);

  const allocations = viewModel.snapshot.allocations;
  const articlesById = useMemo(
    () => new Map(viewModel.snapshot.articles.map((row) => [row.articleId, row])),
    [viewModel.snapshot.articles],
  );
  const lotsById = useMemo(
    () => new Map(viewModel.snapshot.lots.map((row) => [row.lotId, row])),
    [viewModel.snapshot.lots],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return allocations
      .filter((row) => (status === 'ALL' ? true : row.allocationStatus === status))
      .filter((row) => {
        if (!needle) return true;
        const article = articlesById.get(row.articleId);
        return [
          row.articleId,
          row.lotNumber,
          row.siteId,
          row.workstationId,
          row.allocationId,
          row.blockingReason ?? '',
          article?.articleCode ?? '',
          article?.commercialName ?? '',
        ].some((value) => String(value).toLowerCase().includes(needle));
      });
  }, [allocations, articlesById, search, status]);

  const articleOptions = useMemo(
    () => Array.from(new Map(allocations.map((row) => [row.articleId, row])).values()),
    [allocations],
  );

  const selectedArticleAllocations = useMemo(
    () => sortOfflineAllocationsByFefo(filtered.filter((row) => row.articleId === articleId)),
    [articleId, filtered],
  );

  const selectedArticleAvailability = useMemo(
    () => selectedArticleAllocations.reduce((sum, row) => sum + getOfflineAvailableQuantity(row), 0),
    [selectedArticleAllocations],
  );

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, row) => {
        acc.allocated += Number(row.serverAllocatedQuantity ?? 0);
        acc.consumed += Number(row.serverConsumedQuantity ?? 0);
        acc.pending += Number(row.localPendingConsumption ?? 0);
        acc.available += getOfflineAvailableQuantity(row);
        return acc;
      },
      { allocated: 0, consumed: 0, pending: 0, available: 0 },
    );
  }, [filtered]);

  async function handlePing() {
    setBusyAction('PING');
    try {
      const result = await pingPosSync();
      setServerPingLabel(getCurrentOfflinePingLabel(result.ping));
      setMessage(
        result.networkStatus === 'ONLINE'
          ? 'Backend POS Sync joignable.'
          : result.networkStatus === 'DEGRADED'
            ? 'Le navigateur est connecte, mais le backend POS Sync ne repond pas.'
            : 'Le navigateur est hors ligne.',
      );
      await refreshLocal();
    } catch (error) {
      setMessage(normalizeError(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleBootstrap() {
    setBusyAction('BOOTSTRAP');
    try {
      const latestSnapshot = await readOfflineSnapshot();
      const result = await bootstrapFromServer({
        siteId: currentUser?.siteId ?? latestSnapshot.workstation?.siteId ?? null,
        workstationId: latestSnapshot.workstation?.workstationId ?? null,
      });
      setServerPingLabel(getCurrentOfflinePingLabel(result.ping));
      setMessage(`Bootstrap applique pour ${result.payload.workstation.workstationName}.`);
      await refreshLocal();
    } catch (error) {
      setMessage(normalizeError(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleChanges() {
    setBusyAction('CHANGES');
    try {
      const result = await applyChanges();
      setMessage(`Changements descendants appliques. Nouveau curseur : ${truncateCursor(result.nextCursor)}.`);
      await refreshLocal();
    } catch (error) {
      setMessage(normalizeError(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleFixtures() {
    setBusyAction('FIXTURES');
    try {
      await seedOfflineAllocationFixtures(buildOfflineAllocationFixtures());
      await clearOfflineSyncQueue();
      setMessage('Fixtures DEV chargees dans IndexedDB. Aucun bootstrap serveur n a ete modifie.');
      await refreshLocal();
    } catch (error) {
      setMessage(normalizeError(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleClearAllocations() {
    setBusyAction('FIXTURES');
    try {
      await clearOfflineAllocations();
      setMessage('Allocations locales videes. Les autres snapshots restent conserves.');
      await refreshLocal();
    } catch (error) {
      setMessage(normalizeError(error));
    } finally {
      setBusyAction(null);
    }
  }

  function simulateFefo() {
    if (!articleId) {
      setMessage('Selectionnez un article pour lancer la simulation FEFO locale.');
      return;
    }

    const quantity = Number(requestedQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setMessage('Quantite invalide.');
      return;
    }

    const result = allocateOfflineQuantity(allocations, articleId, quantity);
    if (result.conflict) {
      setMessage(`${result.conflict.message} Quantite allouee localement : ${result.allocatedQuantity}.`);
      return;
    }

    setMessage(`Simulation FEFO locale OK : ${result.allocatedQuantity} unite(s) sur ${result.consumptions.length} lot(s).`);
  }

  return (
    <OfflineWorkspaceLayout
      mode="seller"
      viewModel={viewModel}
      syncEngine={syncEngine}
      cashSession={viewModel.snapshot.cashSession}
      title="Synchronisation"
      subtitle="Centre de sante operationnel du snapshot, de la file locale et des changements descendants."
      topActions={(
        <>
          <button className="ghost-button compact-button" type="button" onClick={() => void refreshLocal()} disabled={loading || busyAction !== null}>
            Actualiser
          </button>
          <button className="ghost-button compact-button" type="button" onClick={() => void handlePing()} disabled={busyAction !== null || !canReadPosSync}>
            Ping
          </button>
          <button className="button compact-button" type="button" onClick={() => void runSync('manual')} disabled={busyAction !== null || !canExecutePosSync}>
            Synchroniser
          </button>
        </>
      )}
    >
      <section className="offline-kpis">
        <div className="card offline-kpi"><span>Reseau</span><strong>{networkLabel(viewModel.networkStatus)}</strong></div>
        <div className="card offline-kpi"><span>Snapshot</span><strong>{snapshotLabel(viewModel.snapshotStatus)}</strong></div>
        <div className="card offline-kpi"><span>Autorisation offline</span><strong>{authorizationLabel(viewModel.authorizationState)}</strong></div>
        <div className="card offline-kpi"><span>Articles</span><strong>{viewModel.snapshot.articles.length}</strong></div>
        <div className="card offline-kpi"><span>Lots</span><strong>{viewModel.snapshot.lots.length}</strong></div>
        <div className="card offline-kpi"><span>Allocations</span><strong>{viewModel.snapshot.allocations.length}</strong></div>
        <div className="card offline-kpi"><span>Clients</span><strong>{viewModel.snapshot.customers.length}</strong></div>
        <div className="card offline-kpi"><span>Queue locale</span><strong>{viewModel.queue.length}</strong></div>
        <div className="card offline-kpi"><span>Etat moteur</span><strong>{syncEngine.currentStatus}</strong></div>
        <div className="card offline-kpi"><span>Pending</span><strong>{syncEngine.pendingCount}</strong></div>
        <div className="card offline-kpi"><span>Conflits</span><strong>{syncEngine.conflictCount}</strong></div>
      </section>

      <section className="offline-metadata-grid">
        <div className="card offline-panel">
          <h3>Contexte local</h3>
          <div className="detail-grid compact-detail-grid">
            <div><span>Tenant</span><strong>{viewModel.snapshot.auth?.tenantId ?? '-'}</strong></div>
            <div><span>Utilisateur</span><strong>{viewModel.snapshot.auth?.displayName ?? currentUser?.fullName ?? '-'}</strong></div>
            <div><span>Role</span><strong>{viewModel.snapshot.auth?.role ?? currentUser?.role ?? '-'}</strong></div>
            <div><span>Site</span><strong>{viewModel.snapshot.workstation?.siteName ?? viewModel.snapshot.workstation?.siteId ?? currentUser?.siteId ?? '-'}</strong></div>
            <div><span>Poste</span><strong>{viewModel.snapshot.workstation?.workstationName ?? '-'}</strong></div>
            <div><span>Device ID</span><strong>{viewModel.snapshot.workstation?.deviceId ?? '-'}</strong></div>
          </div>
        </div>

        <div className="card offline-panel">
          <h3>Etat de synchro</h3>
          <div className="detail-grid compact-detail-grid">
            <div><span>Derniere synchro</span><strong>{formatDateTime(viewModel.snapshot.syncState?.lastSuccessfulSyncAt)}</strong></div>
            <div><span>Derniere validation serveur</span><strong>{formatDateTime(viewModel.snapshot.auth?.lastServerValidationAt)}</strong></div>
            <div><span>Expiration offline</span><strong>{formatDateTime(viewModel.snapshot.auth?.offlineAuthorizationExpiresAt)}</strong></div>
            <div><span>Curseur</span><strong>{truncateCursor(viewModel.snapshot.syncState?.syncCursor)}</strong></div>
            <div><span>Ping serveur</span><strong>{serverPingLabel}</strong></div>
            <div><span>Taux courant</span><strong>{exchangeRateLabel(viewModel.snapshot.settings?.exchangeRate?.rate)}</strong></div>
            <div><span>Etat auto-sync</span><strong>{syncEngine.currentStatus}</strong></div>
            <div><span>Prochaine reprise</span><strong>{formatDateTime(syncEngine.nextRetryAt)}</strong></div>
          </div>
        </div>
      </section>

      <section className="card offline-toolbar offline-toolbar-premium">
        <input
          className="input compact-input"
          placeholder="Rechercher article, lot, allocation ou poste"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="input compact-input" value={status} onChange={(event) => setStatus(event.target.value as 'ALL' | OfflineAllocationStatus)}>
          {statusOrder.map((item) => <option key={item} value={item}>{item === 'ALL' ? 'Tous les statuts' : statusLabel(item)}</option>)}
        </select>
        <select className="input compact-input" value={articleId} onChange={(event) => setArticleId(event.target.value)}>
          <option value="">Choisir un article</option>
          {articleOptions.map((row) => {
            const article = articlesById.get(row.articleId);
            return (
              <option key={row.articleId} value={row.articleId}>
                {article?.articleCode ?? row.articleId} - {article?.commercialName ?? row.articleId}
              </option>
            );
          })}
        </select>
        <input
          className="input compact-input numeric-cell"
          type="number"
          min="1"
          step="1"
          value={requestedQuantity}
          onChange={(event) => setRequestedQuantity(event.target.value)}
        />
        <button className="button compact-button" type="button" onClick={simulateFefo} disabled={!articleId}>
          Simuler FEFO
        </button>
        <button className="ghost-button compact-button" type="button" onClick={() => void handleBootstrap()} disabled={busyAction !== null || !canExecutePosSync}>
          Bootstrap serveur
        </button>
        <button className="ghost-button compact-button" type="button" onClick={() => void handleChanges()} disabled={busyAction !== null || !canReadPosSync || !viewModel.snapshot.syncState?.syncCursor}>
          Recuperer changements
        </button>
        <button className="ghost-button compact-button" type="button" onClick={() => void handleFixtures()} disabled={busyAction !== null}>
          Fixtures DEV
        </button>
        <button className="ghost-button compact-button" type="button" onClick={() => void handleClearAllocations()} disabled={busyAction !== null}>
          Vider allocations
        </button>
      </section>

      <section className="offline-layout">
        <div className="card offline-main-card">
          <div className="offline-main-card-header">
            <div>
              <h3>Allocations locales par poste et par lot</h3>
              <p className="muted">
                Snapshot offline reel du poste, avec file locale et pending consumption avant replay serveur.
              </p>
            </div>
            <div className="offline-main-card-actions">
              <span className="offline-inline-pill">Alloue: {totals.allocated}</span>
              <span className="offline-inline-pill">Consomme serveur: {totals.consumed}</span>
              <span className="offline-inline-pill">Pending local: {totals.pending}</span>
              <span className="offline-inline-pill">Disponible reel: {totals.available}</span>
            </div>
          </div>

          <p className="offline-preview">{message}</p>
          <p className="offline-preview muted">
            {articleId
              ? `${selectedArticleAllocations.length} lot(s) pour l article selectionne, ${selectedArticleAvailability} unite(s) vendables localement.`
              : 'Selectionnez un article pour voir sa capacite FEFO locale.'}
          </p>

          {loading ? (
            <p className="loading-state">Chargement du snapshot local...</p>
          ) : filtered.length === 0 ? (
            <p className="empty-state">Aucune allocation locale. Lancez le bootstrap serveur ou chargez les fixtures DEV.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table offline-table">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Lot</th>
                    <th>Expiration</th>
                    <th>Alloue</th>
                    <th>Consomme srv</th>
                    <th>Pending local</th>
                    <th>Disponible</th>
                    <th>Statut</th>
                    <th>Derniere synchro</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const article = articlesById.get(row.articleId);
                    const lot = lotsById.get(row.lotId);
                    const vendable = isOfflineAllocationVendable(row);
                    return (
                      <tr key={row.localId}>
                        <td>
                          <strong>{article?.commercialName ?? row.articleId}</strong>
                          <div className="offline-row-meta">{article?.articleCode ?? row.articleId}</div>
                        </td>
                        <td>
                          <strong>{row.lotNumber}</strong>
                          <div className="offline-row-meta">{row.workstationId}</div>
                        </td>
                        <td>
                          <strong>{formatDate(row.expiryDate)}</strong>
                          {lot?.isBlocked ? <div className="offline-row-meta">Lot bloque</div> : null}
                        </td>
                        <td>{row.serverAllocatedQuantity}</td>
                        <td>{row.serverConsumedQuantity}</td>
                        <td>{row.localPendingConsumption}</td>
                        <td>{getOfflineAvailableQuantity(row)}</td>
                        <td>
                          <span className={`badge compact-badge ${badgeClass(row.allocationStatus)}`}>{statusLabel(row.allocationStatus)}</span>
                          {!vendable && row.blockingReason ? <div className="offline-row-meta">{row.blockingReason}</div> : null}
                        </td>
                        <td>{formatDateTime(row.lastSyncedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="offline-side-column">
          <section className="card offline-panel">
            <h3>Journal local</h3>
            {viewModel.syncLog.length === 0 ? (
              <p className="empty-state">Aucun journal de synchro local.</p>
            ) : (
              <ul className="offline-policy-list">
                {viewModel.syncLog.slice().reverse().slice(0, 5).map((entry) => (
                  <li key={entry.localId}>
                    <strong>{entry.type}</strong> - {entry.status}
                    <div className="offline-row-meta">{entry.message}</div>
                    <div className="offline-row-meta">{formatDateTime(entry.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card offline-panel">
            <h3>Conflits et limites</h3>
            {viewModel.conflicts.length === 0 ? (
              <p className="offline-row-meta">Aucun conflit local enregistre.</p>
            ) : (
              <ul className="offline-policy-list">
                {viewModel.conflicts.slice().reverse().slice(0, 5).map((entry) => (
                  <li key={entry.localId}>
                    <strong>{entry.code}</strong>
                    <div className="offline-row-meta">{entry.message}</div>
                  </li>
                ))}
              </ul>
            )}
            <ul className="offline-policy-list">
              <li>Les ventes offline locales sont maintenant possibles uniquement en CASH / IMMEDIATE.</li>
              <li>La session caisse doit avoir ete synchronisee avant la coupure reseau.</li>
              <li>Le backend central reste la source de verite.</li>
              <li>localPendingConsumption ne doit jamais etre ecrase par un bootstrap.</li>
            </ul>
          </section>
        </aside>
      </section>
    </OfflineWorkspaceLayout>
  );
}

function normalizeError(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Une erreur inconnue est survenue.';
}

function networkLabel(status: OfflineSnapshotViewModel['networkStatus']) {
  if (status === 'ONLINE') return 'Online';
  if (status === 'DEGRADED') return 'Degraded';
  return 'Offline';
}

function snapshotLabel(status: OfflineSnapshotViewModel['snapshotStatus']) {
  if (status === 'FRESH') return 'Fresh';
  if (status === 'STALE') return 'Stale';
  if (status === 'EXPIRED') return 'Expired';
  if (status === 'REVOKED') return 'Revoked';
  return 'Unknown';
}

function authorizationLabel(status: ReturnType<typeof calculateAuthorizationState>) {
  if (status === 'VALID') return 'Valid';
  if (status === 'EXPIRING') return 'Expiring';
  return 'Expired';
}

function statusLabel(status: OfflineAllocationStatus) {
  if (status === 'ACTIVE') return 'Actif';
  if (status === 'EXHAUSTED') return 'Epuise';
  if (status === 'SUSPENDED') return 'Suspendu';
  if (status === 'REVOKED') return 'Revoque';
  return status;
}

function badgeClass(status: OfflineAllocationStatus) {
  if (status === 'ACTIVE') return 'badge-success';
  if (status === 'EXHAUSTED') return 'badge-muted';
  if (status === 'SUSPENDED') return 'badge-warning';
  if (status === 'REVOKED') return 'badge-danger';
  return 'badge-neutral';
}

function exchangeRateLabel(rate: number | null | undefined) {
  if (!Number.isFinite(Number(rate))) return '-';
  return `1 USD = ${Number(rate).toLocaleString('fr-FR')} FC`;
}

function truncateCursor(cursor?: string | null) {
  if (!cursor) return '-';
  return cursor.length > 24 ? `${cursor.slice(0, 24)}...` : cursor;
}
