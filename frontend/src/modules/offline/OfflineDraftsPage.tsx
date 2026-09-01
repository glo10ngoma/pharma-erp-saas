import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDateTime } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import {
  cancelOfflineCart,
  createNewOfflineCart,
  formatOfflineCartStatus,
  listOfflineDrafts,
} from './offline-cart';
import { loadLocalSnapshot, type OfflineSnapshotViewModel } from './offline-bootstrap';
import { OfflineWorkspaceLayout } from './offline-ui';
import { type OfflineCart } from './offline-types';

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
  authorizationState: 'UNAUTHORIZED',
  snapshotStatus: 'UNKNOWN',
  networkStatus: 'OFFLINE',
};

export function OfflineDraftsPage() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<OfflineCart[]>([]);
  const [viewModel, setViewModel] = useState<OfflineSnapshotViewModel>(emptyViewModel);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Brouillons offline persistants par poste.');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [localView, localDrafts] = await Promise.all([loadLocalSnapshot(), listOfflineDrafts()]);
      setViewModel(localView);
      setDrafts(localDrafts);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate() {
    setBusyId('new');
    try {
      const cart = await createNewOfflineCart();
      navigate(`/pos?draft=${cart.cartId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Creation du brouillon impossible.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(cartId: string) {
    setBusyId(cartId);
    try {
      await cancelOfflineCart(cartId);
      setMessage('Brouillon annule localement et reservations liberees.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Annulation impossible.');
    } finally {
      setBusyId(null);
    }
  }

  const totalReserved = drafts.reduce((sum, cart) => sum + cart.quantityTotal, 0);

  return (
    <OfflineWorkspaceLayout
      mode="seller"
      viewModel={viewModel}
      cashSession={viewModel.snapshot.cashSession}
      title="Brouillons"
      subtitle="Reprise locale des tickets en attente et pilotage des reservations par poste."
      topActions={(
        <button className="button compact-button" type="button" onClick={() => void handleCreate()} disabled={busyId !== null}>
          Nouveau brouillon
        </button>
      )}
    >
      <section className="offline-kpis">
        <div className="card offline-kpi"><span>Brouillons</span><strong>{drafts.length}</strong></div>
        <div className="card offline-kpi"><span>Bloques</span><strong>{drafts.filter((cart) => cart.status === 'BLOCKED').length}</strong></div>
        <div className="card offline-kpi"><span>Prets</span><strong>{drafts.filter((cart) => cart.status === 'READY').length}</strong></div>
        <div className="card offline-kpi"><span>Qte reservee</span><strong>{totalReserved}</strong></div>
      </section>

      <section className="card offline-panel">
        <div className="offline-panel-heading">
          <h3>Liste des brouillons</h3>
          <span className="offline-row-meta">{message}</span>
        </div>
        {loading ? (
          <p className="loading-state">Chargement des brouillons offline...</p>
        ) : drafts.length === 0 ? (
          <p className="empty-state">Aucun brouillon local sur ce poste.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table offline-drafts-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Client</th>
                  <th>Statut</th>
                  <th>Lignes</th>
                  <th>Quantite</th>
                  <th>Total</th>
                  <th>Maj locale</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((cart) => (
                  <tr key={cart.cartId}>
                    <td>
                      <strong>{cart.offlineReference}</strong>
                    </td>
                    <td>{cart.customerNameSnapshot ?? 'Client comptoir'}</td>
                    <td>
                      <span className={`badge compact-badge ${cart.status === 'READY' ? 'badge-success' : cart.status === 'BLOCKED' ? 'badge-danger' : 'badge-neutral'}`}>
                        {formatOfflineCartStatus(cart.status)}
                      </span>
                      {cart.blockedReasons[0] ? <div className="offline-row-meta">{cart.blockedReasons[0]}</div> : null}
                    </td>
                    <td>{cart.itemCount}</td>
                    <td>{cart.quantityTotal}</td>
                    <td>{formatMoney(cart.total, cart.currency)}</td>
                    <td>{formatDateTime(cart.updatedAt)}</td>
                    <td className="offline-action-cell">
                      <Link className="ghost-button compact-button" to={`/pos?draft=${cart.cartId}`}>
                        Reprendre
                      </Link>
                      <button className="ghost-button compact-button" type="button" onClick={() => void handleCancel(cart.cartId)} disabled={busyId !== null || cart.status === 'CANCELLED'}>
                        Annuler
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card offline-panel">
        <h3>Contexte poste</h3>
        <div className="detail-grid compact-detail-grid">
          <div><span>Poste</span><strong>{viewModel.snapshot.workstation?.workstationName ?? '-'}</strong></div>
          <div><span>Device ID</span><strong>{viewModel.snapshot.workstation?.deviceId ?? '-'}</strong></div>
          <div><span>Utilisateur</span><strong>{viewModel.snapshot.auth?.displayName ?? '-'}</strong></div>
          <div><span>Derniere synchro</span><strong>{formatDateTime(viewModel.snapshot.syncState?.lastSuccessfulSyncAt)}</strong></div>
        </div>
      </section>
    </OfflineWorkspaceLayout>
  );
}
