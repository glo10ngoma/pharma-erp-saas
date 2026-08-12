import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '../../utils/date';
import { loadLocalSnapshot, type OfflineSnapshotViewModel } from './offline-bootstrap';
import { buildQuotaBreakdown, listOfflineDrafts } from './offline-cart';
import { type OfflineCart } from './offline-types';

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

export function OfflineWorkstationPage() {
  const [viewModel, setViewModel] = useState<OfflineSnapshotViewModel>(emptyViewModel);
  const [drafts, setDrafts] = useState<OfflineCart[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function run() {
      setLoading(true);
      try {
        const [localView, localDrafts] = await Promise.all([loadLocalSnapshot(), listOfflineDrafts()]);
        setViewModel(localView);
        setDrafts(localDrafts);
      } finally {
        setLoading(false);
      }
    }
    void run();
  }, []);

  const quotaRows = useMemo(
    () => buildQuotaBreakdown(viewModel.snapshot, [], null),
    [viewModel.snapshot],
  );

  const metrics = useMemo(() => {
    const activeAllocations = quotaRows.filter((row) => row.status === 'ACTIVE');
    return {
      allocations: activeAllocations.length,
      lots: new Set(activeAllocations.map((row) => row.lotId)).size,
      quotaTotal: activeAllocations.reduce((sum, row) => sum + row.serverAllocatedQuantity, 0),
      quotaReserved: drafts.reduce((sum, draft) => sum + draft.quantityTotal, 0),
    };
  }, [drafts, quotaRows]);

  const workstation = viewModel.snapshot.workstation;
  const auth = viewModel.snapshot.auth;
  const settings = viewModel.snapshot.settings;

  return (
    <section className="offline-page">
      <header className="page-heading offline-heading">
        <div>
          <span className="breadcrumb">Offline</span>
          <h1>Poste</h1>
          <p>Identite locale du poste, contexte de synchronisation et quota offline.</p>
        </div>
        <div className="page-heading-actions">
          <Link className="ghost-button compact-button" to="/offline/pos">POS Offline</Link>
          <Link className="ghost-button compact-button" to="/offline/synchronisation">Synchronisation</Link>
        </div>
      </header>

      <section className="offline-kpis">
        <div className="card offline-kpi"><span>Allocations actives</span><strong>{metrics.allocations}</strong></div>
        <div className="card offline-kpi"><span>Lots disponibles</span><strong>{metrics.lots}</strong></div>
        <div className="card offline-kpi"><span>Quota total</span><strong>{metrics.quotaTotal}</strong></div>
        <div className="card offline-kpi"><span>Reserve par brouillons</span><strong>{metrics.quotaReserved}</strong></div>
      </section>

      <section className="offline-metadata-grid">
        <div className="card offline-panel">
          <h3>Identite du poste</h3>
          {loading ? <p className="loading-state">Chargement du contexte local...</p> : (
            <div className="detail-grid compact-detail-grid">
              <div><span>Poste</span><strong>{workstation?.workstationName ?? '-'}</strong></div>
              <div><span>Workstation ID</span><strong>{workstation?.workstationId ?? '-'}</strong></div>
              <div><span>Device ID</span><strong>{workstation?.deviceId ?? '-'}</strong></div>
              <div><span>Site</span><strong>{workstation?.siteName ?? workstation?.siteId ?? '-'}</strong></div>
              <div><span>Utilisateur</span><strong>{auth?.displayName ?? '-'}</strong></div>
              <div><span>Role</span><strong>{auth?.role ?? '-'}</strong></div>
            </div>
          )}
        </div>

        <div className="card offline-panel">
          <h3>Snapshot local</h3>
          <div className="detail-grid compact-detail-grid">
            <div><span>Version app</span><strong>{workstation?.appVersion ?? '-'}</strong></div>
            <div><span>Version bootstrap</span><strong>{viewModel.snapshot.syncState?.bootstrapVersion ?? '-'}</strong></div>
            <div><span>Derniere synchro</span><strong>{formatDateTime(viewModel.snapshot.syncState?.lastSuccessfulSyncAt)}</strong></div>
            <div><span>Derniere tentative</span><strong>{formatDateTime(viewModel.snapshot.syncState?.lastAttemptAt)}</strong></div>
            <div><span>Devise</span><strong>{settings?.defaultCurrency ?? '-'}</strong></div>
            <div><span>Taux local</span><strong>{settings?.exchangeRate?.rate ? `1 USD = ${Number(settings.exchangeRate.rate).toLocaleString('fr-FR')} FC` : '-'}</strong></div>
          </div>
        </div>
      </section>
    </section>
  );
}
