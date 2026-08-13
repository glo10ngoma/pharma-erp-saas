import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import { listOfflineSalesHistory } from './offline-sale';
import { processPendingOfflineQueue } from './sync-engine';
import { type OfflineSale } from './offline-types';

export function OfflineSalesPage() {
  const [sales, setSales] = useState<OfflineSale[]>([]);
  const [message, setMessage] = useState('Historique local des ventes offline finalisees.');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setSales(await listOfflineSalesHistory());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleSync() {
    setBusy(true);
    try {
      const results = await processPendingOfflineQueue();
      const synced = results.filter((row) => row.status === 'SYNCED').length;
      const conflicts = results.filter((row) => row.status === 'CONFLICT').length;
      const failed = results.filter((row) => row.status === 'FAILED').length;
      setMessage(`Synchronisation offline: ${synced} synchronisee(s), ${conflicts} conflit(s), ${failed} echec(s).`);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="offline-page">
      <header className="page-heading offline-heading">
        <div>
          <span className="breadcrumb">POS Offline</span>
          <h1>Ventes offline</h1>
          <p>Ventes finalisees localement, tickets en attente de replay serveur ou deja synchronises.</p>
        </div>
        <div className="page-heading-actions">
          <Link className="ghost-button compact-button" to="/offline/pos">Retour POS</Link>
          <button className="button compact-button" type="button" onClick={() => void handleSync()} disabled={busy}>
            Synchroniser ventes
          </button>
        </div>
      </header>

      <section className="offline-kpis">
        <div className="card offline-kpi"><span>Total</span><strong>{sales.length}</strong></div>
        <div className="card offline-kpi"><span>En attente</span><strong>{sales.filter((row) => row.syncStatus === 'PENDING' || row.syncStatus === 'FAILED').length}</strong></div>
        <div className="card offline-kpi"><span>Synchronisees</span><strong>{sales.filter((row) => row.syncStatus === 'SYNCED').length}</strong></div>
        <div className="card offline-kpi"><span>Conflits</span><strong>{sales.filter((row) => row.syncStatus === 'CONFLICT').length}</strong></div>
      </section>

      <section className="card offline-panel">
        <div className="offline-panel-heading">
          <h3>Historique local</h3>
          <span className="offline-row-meta">{message}</span>
        </div>
        <div className="table-wrap">
          <table className="data-table offline-drafts-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date validation</th>
                <th>Client</th>
                <th>Total</th>
                <th>Statut sync</th>
                <th>Vente serveur</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={6}><p className="empty-state">Aucune vente offline finalisee sur ce poste.</p></td>
                </tr>
              ) : sales.map((sale) => (
                <tr key={sale.localSaleId}>
                  <td><strong>{sale.offlineReference}</strong></td>
                  <td>{formatDateTime(sale.validatedAt)}</td>
                  <td>{sale.customerNameSnapshot ?? 'Client comptoir'}</td>
                  <td>{formatMoney(sale.total, 'USD')}</td>
                  <td><span className="badge compact-badge badge-neutral">{sale.syncStatus}</span></td>
                  <td>{sale.serverSaleNumber ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
