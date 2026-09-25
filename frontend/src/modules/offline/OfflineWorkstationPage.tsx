import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '../../utils/date';
import { loadLocalSnapshot, type OfflineSnapshotViewModel } from './offline-bootstrap';
import { buildQuotaBreakdown, listOfflineDrafts } from './offline-cart';
import { readOfflineMetadata } from './offline-storage';
import { buildOfflineDiagnosticExport, getOfflineStorageReport, requestOfflinePersistence, runOfflineRecovery, runOfflineRetention, type OfflineRecoveryReport, type OfflineRetentionReport, type OfflineStorageReport } from './offline-recovery';
import { runSync } from './sync-engine';
import { OfflineWorkspaceLayout } from './offline-ui';
import { posPrinterService, type PosPrinterConfiguration, type PosPrinterDevice, type PosPrinterStatus } from './pos-printer.service';
import { type OfflineCart, type OfflineMetadataRecord } from './offline-types';

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

export function OfflineWorkstationPage() {
  const [viewModel, setViewModel] = useState<OfflineSnapshotViewModel>(emptyViewModel);
  const [drafts, setDrafts] = useState<OfflineCart[]>([]);
  const [metadata, setMetadata] = useState<OfflineMetadataRecord | null>(null);
  const [recovery, setRecovery] = useState<OfflineRecoveryReport | null>(null);
  const [storage, setStorage] = useState<OfflineStorageReport | null>(null);
  const [retention, setRetention] = useState<OfflineRetentionReport | null>(null);
  const [printerConfiguration, setPrinterConfiguration] = useState<PosPrinterConfiguration | null>(null);
  const [printerStatus, setPrinterStatus] = useState<PosPrinterStatus | null>(null);
  const [printerDevices, setPrinterDevices] = useState<PosPrinterDevice[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshDiagnostics = useCallback(async () => {
    const [localView, localDrafts, localMetadata, localStorage, localRecovery, localRetention] = await Promise.all([
      loadLocalSnapshot(),
      listOfflineDrafts(),
      readOfflineMetadata(),
      getOfflineStorageReport(),
      runOfflineRecovery(),
      runOfflineRetention(),
    ]);
    setViewModel(localView);
    setDrafts(localDrafts);
    setMetadata(localMetadata);
    setStorage(localStorage);
    setRecovery(localRecovery);
    setRetention(localRetention);
    const workstationId = localView.snapshot.workstation?.workstationId;
    setPrinterConfiguration(posPrinterService.getConfiguration(workstationId));
    const [status, printers] = await Promise.all([
      posPrinterService.getPrinterStatus(workstationId),
      posPrinterService.listPrinters(workstationId),
    ]);
    setPrinterStatus(status);
    setPrinterDevices(printers);
  }, []);

  useEffect(() => {
    async function run() {
      setLoading(true);
      try {
        await refreshDiagnostics();
      } finally {
        setLoading(false);
      }
    }
    void run();
  }, [refreshDiagnostics]);

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
  const syncState = viewModel.snapshot.syncState;
  const isWorkstationReady = Boolean(workstation?.workstationId && auth && settings && viewModel.snapshot.articles.length > 0);
  const usagePercent = storage?.usageRatio !== null && storage?.usageRatio !== undefined
    ? `${Math.round(storage.usageRatio * 100)} %`
    : '-';
  const selectedPrinterMissing = Boolean(
    printerConfiguration?.printerName
      && printerDevices.length > 0
      && !printerDevices.some((printer) => printer.name === printerConfiguration.printerName),
  );

  function updatePrinterConfiguration(updates: Partial<PosPrinterConfiguration>) {
    if (!printerConfiguration) return;
    const next = { ...printerConfiguration, ...updates, mode: 'DIRECT' as const };
    setPrinterConfiguration(next);
    if (workstation?.workstationId) {
      setPrinterConfiguration(posPrinterService.saveConfiguration(workstation.workstationId, next));
    }
  }

  async function handleCheckNow() {
    setActionMessage('Verification locale en cours...');
    await refreshDiagnostics();
    setActionMessage('Diagnostic local mis a jour.');
  }

  async function handleSyncNow() {
    setActionMessage('Synchronisation en cours...');
    await runSync('manual');
    await refreshDiagnostics();
    setActionMessage('Synchronisation terminee ou remise en attente selon le reseau.');
  }

  async function handleRetention() {
    const result = await runOfflineRetention();
    setRetention(result);
    setActionMessage('Nettoyage conservateur analyse. Aucune donnee critique supprimee.');
  }

  async function handlePersistStorage() {
    const persisted = await requestOfflinePersistence();
    setStorage(await getOfflineStorageReport());
    setActionMessage(persisted ? 'Stockage persistant accepte par le navigateur.' : 'Stockage persistant non accorde par le navigateur.');
  }

  async function handleDiagnosticExport() {
    const diagnostic = await buildOfflineDiagnosticExport();
    const blob = new Blob([JSON.stringify(diagnostic, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diagnostic_offline_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setActionMessage('Diagnostic local exporte.');
  }

  async function handleSavePrinterConfiguration() {
    if (!workstation?.workstationId || !printerConfiguration) return;
    const next = posPrinterService.saveConfiguration(workstation.workstationId, { ...printerConfiguration, mode: 'DIRECT' });
    setPrinterConfiguration(next);
    const [status, printers] = await Promise.all([
      posPrinterService.getPrinterStatus(workstation.workstationId),
      posPrinterService.listPrinters(workstation.workstationId),
    ]);
    setPrinterStatus(status);
    setPrinterDevices(printers);
    setActionMessage('Configuration d impression enregistree pour ce poste.');
  }

  async function handleRefreshPrinters() {
    if (!workstation?.workstationId) return;
    setActionMessage('Actualisation des imprimantes...');
    if (printerConfiguration) {
      setPrinterConfiguration(posPrinterService.saveConfiguration(workstation.workstationId, { ...printerConfiguration, mode: 'DIRECT' }));
    }
    const printers = await posPrinterService.listPrinters(workstation.workstationId);
    setPrinterDevices(printers);
    setPrinterStatus(await posPrinterService.getPrinterStatus(workstation.workstationId));
    setActionMessage(printers.length ? `${printers.length} imprimante(s) detectee(s).` : 'Aucune imprimante detectee par l agent local.');
  }

  async function handleTestPrint() {
    if (!workstation?.workstationId) return;
    if (!printerConfiguration?.printerName.trim()) {
      setActionMessage('Selectionnez une imprimante.');
      return;
    }
    setActionMessage('Envoi vers l imprimante...');
    const next = printerConfiguration
      ? posPrinterService.saveConfiguration(workstation.workstationId, { ...printerConfiguration, mode: 'DIRECT' })
      : posPrinterService.getConfiguration(workstation.workstationId);
    setPrinterConfiguration(next);
    const result = await posPrinterService.printTest(workstation.workstationId);
    setPrinterStatus(await posPrinterService.getPrinterStatus(workstation.workstationId));
    setActionMessage(result.message);
  }

  return (
    <OfflineWorkspaceLayout
      mode="seller"
      viewModel={viewModel}
      cashSession={viewModel.snapshot.cashSession}
      title="Poste"
      subtitle="Sante locale du poste, stockage, snapshot, recovery et export diagnostic."
      topActions={(
        <>
          <Link className="ghost-button compact-button" to="/pos">POS</Link>
          <Link className="ghost-button compact-button" to="/offline/synchronisation">Synchronisation</Link>
        </>
      )}
    >
      <section className="offline-kpis">
        <div className="card offline-kpi"><span>Allocations actives</span><strong>{metrics.allocations}</strong></div>
        <div className="card offline-kpi"><span>Lots disponibles</span><strong>{metrics.lots}</strong></div>
        <div className="card offline-kpi"><span>Quota total</span><strong>{metrics.quotaTotal}</strong></div>
        <div className="card offline-kpi"><span>Reserve par brouillons</span><strong>{metrics.quotaReserved}</strong></div>
      </section>

      {!isWorkstationReady ? (
        <section className="card offline-panel offline-setup-card">
          <div className="offline-panel-heading">
            <div>
              <h3>Assistant premier demarrage</h3>
              <p className="offline-row-meta">Preparez ce poste avant les ventes hors ligne.</p>
            </div>
            <Link className="button compact-button" to="/offline/synchronisation">Preparer ce poste</Link>
          </div>
          <ol className="offline-setup-steps">
            <li className={auth ? 'is-done' : ''}>Connexion utilisateur</li>
            <li className={workstation?.siteId ? 'is-done' : ''}>Choisir le site</li>
            <li className={workstation?.workstationId ? 'is-done' : ''}>Enregistrer ce poste</li>
            <li className={viewModel.snapshot.articles.length > 0 ? 'is-done' : ''}>Telecharger articles, stock, clients, allocations et parametres</li>
            <li className={isWorkstationReady ? 'is-done' : ''}>Poste pret pour les ventes hors ligne</li>
          </ol>
          <p className="offline-action-message">Impossible de preparer le poste ? Verifiez la connexion puis reessayez depuis Synchronisation.</p>
        </section>
      ) : (
        <section className="card offline-panel offline-setup-card">
          <strong>Ce poste est pret pour les ventes hors ligne.</strong>
        </section>
      )}

      <section className="card offline-panel">
        <div className="offline-panel-heading">
          <div>
            <h3>Sante locale</h3>
            <p className="offline-row-meta">Controle du stockage, de l'integrite locale, des operations en attente et de la reprise apres incident.</p>
          </div>
          <div className="offline-panel-actions compact-actions">
            <button className="ghost-button compact-button" type="button" onClick={handleCheckNow}>Verifier maintenant</button>
            <button className="ghost-button compact-button" type="button" onClick={handleSyncNow}>Synchroniser</button>
            <button className="ghost-button compact-button" type="button" onClick={handleRetention}>Nettoyer donnees synchronisees</button>
            <button className="ghost-button compact-button" type="button" onClick={handleDiagnosticExport}>Exporter diagnostic</button>
          </div>
        </div>
        {actionMessage && <p className="offline-action-message">{actionMessage}</p>}
        <div className="offline-health-grid">
          <div className={`offline-health-card offline-health-${recovery?.status?.toLowerCase() ?? 'unknown'}`}>
            <span>Recovery</span>
            <strong>{recovery?.status ?? 'UNKNOWN'}</strong>
            <small>{recovery?.issues.length ?? 0} anomalie(s)</small>
          </div>
          <div className={`offline-health-card offline-health-${storage?.status?.toLowerCase() ?? 'unknown'}`}>
            <span>Stockage local</span>
            <strong>{storage?.status ?? 'UNKNOWN'}</strong>
            <small>{usagePercent} utilise</small>
          </div>
          <div className="offline-health-card">
            <span>DB locale</span>
            <strong>v{metadata?.offlineDbVersion ?? '-'}</strong>
            <small>Schema snapshot v{metadata?.snapshotSchemaVersion ?? '-'}</small>
          </div>
          <div className="offline-health-card">
            <span>Queue</span>
            <strong>{viewModel.queue.filter((row) => row.status !== 'SYNCED').length}</strong>
            <small>{viewModel.conflicts.length} conflit(s)</small>
          </div>
        </div>
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
            <div><span>Version bootstrap</span><strong>{syncState?.bootstrapVersion ?? '-'}</strong></div>
            <div><span>Statut snapshot</span><strong>{syncState?.snapshotStatus ?? viewModel.snapshotStatus}</strong></div>
            <div><span>Derniere synchro</span><strong>{formatDateTime(syncState?.lastSuccessfulSyncAt)}</strong></div>
            <div><span>Derniere tentative</span><strong>{formatDateTime(syncState?.lastAttemptAt)}</strong></div>
            <div><span>Devise</span><strong>{settings?.defaultCurrency ?? '-'}</strong></div>
            <div><span>Taux local</span><strong>{settings?.exchangeRate?.rate ? `1 USD = ${Number(settings.exchangeRate.rate).toLocaleString('fr-FR')} FC` : '-'}</strong></div>
          </div>
        </div>

        <div className="card offline-panel">
          <div className="offline-panel-heading">
            <h3>Stockage local</h3>
            <button className="ghost-button compact-button" type="button" onClick={handlePersistStorage}>Rendre persistant</button>
          </div>
          <div className="detail-grid compact-detail-grid">
            <div><span>Statut</span><strong>{storage?.status ?? 'UNKNOWN'}</strong></div>
            <div><span>Utilisation</span><strong>{usagePercent}</strong></div>
            <div><span>Persistance</span><strong>{storage?.persisted === null ? '-' : storage?.persisted ? 'Active' : 'Non active'}</strong></div>
            <div><span>Verifie le</span><strong>{formatDateTime(storage?.checkedAt)}</strong></div>
          </div>
        </div>

        <div className="card offline-panel">
          <h3>Maintenance locale</h3>
          <div className="detail-grid compact-detail-grid">
            <div><span>Queue purgeable</span><strong>{retention?.deletedCounts.syncQueue ?? 0}</strong></div>
            <div><span>Ventes purgeables</span><strong>{retention?.deletedCounts.sales ?? 0}</strong></div>
            <div><span>Logs purgeables</span><strong>{retention?.deletedCounts.syncLog ?? 0}</strong></div>
            <div><span>Proteges</span><strong>{retention?.skippedCritical ?? 0}</strong></div>
          </div>
          <p className="offline-row-meta">Les donnees PENDING, SYNCING, CONFLICT, FAILED, les caisses non synchronisees et les consommations en attente ne sont jamais purgees.</p>
        </div>

        <div className="card offline-panel">
          <h3>Recovery</h3>
          {recovery?.issues.length ? (
            <ul className="offline-policy-list">
              {recovery.issues.slice(0, 6).map((issue) => (
                <li key={`${issue.code}-${issue.message}`}>
                  <strong>{issue.level}</strong> - {issue.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state compact-empty-state">Aucune anomalie locale detectee.</p>
          )}
        </div>

        <section className="card offline-panel">
          <div className="offline-panel-heading">
            <div>
              <h3>Service d impression</h3>
              <p className="offline-row-meta">Configuration locale de ce poste de caisse.</p>
            </div>
            <span className={`badge compact-badge ${printerStatus?.status === 'UNAVAILABLE' ? 'badge-danger' : 'badge-success'}`}>
              {printerStatus?.status === 'UNAVAILABLE' ? 'Indisponible' : 'Connecte'}
            </span>
          </div>
          {printerConfiguration ? (
            <div className="offline-printer-config">
              <div className="offline-printer-config-wide offline-printer-picker">
                <label>
                  <span>Imprimante ticket</span>
                  <select className="input compact-input" value={printerConfiguration.printerName} onChange={(event) => updatePrinterConfiguration({ printerName: event.target.value })}>
                    <option value="">{printerDevices.length ? 'Selectionner une imprimante' : 'Aucune imprimante chargee'}</option>
                    {selectedPrinterMissing && (
                      <option value={printerConfiguration.printerName} disabled>
                        {printerConfiguration.printerName} (non disponible)
                      </option>
                    )}
                    {printerDevices.map((printer) => (
                      <option key={printer.name} value={printer.name}>
                        {printer.name}{printer.isDefault ? ' (defaut)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="ghost-button compact-button" type="button" onClick={() => void handleRefreshPrinters()} disabled={!workstation?.workstationId}>
                  Actualiser les imprimantes
                </button>
              </div>
              {selectedPrinterMissing && <p className="offline-printer-warning">Imprimante configuree non disponible.</p>}
              <div className="offline-printer-field">
                <span>Format</span>
                <div className="offline-segmented-control offline-printer-format">
                  <button type="button" className={printerConfiguration.paperWidthMm === 58 ? 'is-active' : ''} onClick={() => updatePrinterConfiguration({ paperWidthMm: 58 })}>58 mm</button>
                  <button type="button" className={printerConfiguration.paperWidthMm === 80 ? 'is-active' : ''} onClick={() => updatePrinterConfiguration({ paperWidthMm: 80 })}>80 mm</button>
                </div>
              </div>
              <label>
                <span>Copies</span>
                <input className="input compact-input" type="number" min="1" max="5" value={printerConfiguration.copies} onChange={(event) => updatePrinterConfiguration({ copies: Number(event.target.value) || 1 })} />
              </label>
              <label className="offline-printer-config-toggle">
                <input type="checkbox" checked={printerConfiguration.autoPrint} onChange={(event) => updatePrinterConfiguration({ autoPrint: event.target.checked })} />
                <span>Imprimer automatiquement apres encaissement</span>
              </label>
              <div className="offline-panel-actions">
                <button className="button compact-button" type="button" onClick={() => void handleTestPrint()} disabled={!workstation?.workstationId || printerStatus?.status === 'UNAVAILABLE'}>
                  Tester l'impression
                </button>
                <button className="ghost-button compact-button" type="button" onClick={() => void handleSavePrinterConfiguration()} disabled={!workstation?.workstationId}>
                  Enregistrer impression
                </button>
              </div>
              <details className="offline-printer-advanced">
                <summary>Avance</summary>
                <label>
                  <span>Agent local</span>
                  <input className="input compact-input" value={printerConfiguration.agentUrl} onChange={(event) => updatePrinterConfiguration({ agentUrl: event.target.value })} placeholder="http://127.0.0.1:17373" />
                </label>
              </details>
              <p className="offline-row-meta">{printerStatus?.message ?? 'Configuration non chargee.'}</p>
            </div>
          ) : <p className="loading-state">Chargement de la configuration d impression...</p>}
        </section>
      </section>
    </OfflineWorkspaceLayout>
  );
}
