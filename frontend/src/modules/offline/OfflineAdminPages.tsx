import type { ReactNode } from 'react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminExportActions, AdminSummary } from '../administration/admin-ui';
import {
  posSyncService,
  type PosSyncAdminConflict,
  type PosSyncAdminLogEntry,
  type PosSyncAdminWorkstation,
} from '../../services/posSync.service';
import {
  offlineAllocationsService,
  type OfflineAllocationRecord,
} from '../../services/offlineAllocations.service';
import { sitesService } from '../../services/sites.service';
import { workstationsService } from '../../services/workstations.service';
import { SearchBox } from '../../components/SearchBox';
import { formatDate, formatDateTime } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import {
  readOfflineCashCounts,
  readOfflineCashMovements,
  readOfflineCashSessions,
  readOfflineCashReconciliationEvents,
} from './offline-storage';
import {
  type OfflineCashCount,
  type OfflineCashMovement,
  type OfflineCashReconciliationEvent,
  type OfflineCashSessionSnapshot,
} from './offline-types';

function PageShell(props: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="page-heading reference-heading">
        <div>
          <span className="breadcrumb">Offline Admin</span>
          <h1>{props.title}</h1>
          <p className="muted">{props.description}</p>
        </div>
        <div className="reference-actions">{props.actions}</div>
      </div>
      {props.children}
    </>
  );
}

export function OfflineAdminDashboardPage() {
  const dashboard = useQuery({ queryKey: ['offline-admin', 'dashboard'], queryFn: async () => (await posSyncService.getAdminDashboard()).data });
  const workstations = useQuery({ queryKey: ['offline-admin', 'workstations'], queryFn: async () => (await posSyncService.getAdminWorkstations()).data });
  const conflicts = useQuery({ queryKey: ['offline-admin', 'conflicts'], queryFn: async () => (await posSyncService.getAdminConflicts()).data });

  const workstationRows = workstations.data ?? [];
  const conflictRows = conflicts.data ?? [];
  const summary = dashboard.data;

  return (
    <>
      <PageShell
        title="Dashboard Offline"
        description="Supervision des postes, de la file de synchronisation et du stock reserve offline."
        actions={
          <div className="reference-actions">
            <Link className="ghost-button compact-button" to="/offline-admin/workstations">Postes</Link>
            <Link className="ghost-button compact-button" to="/offline-admin/allocations">Allocations</Link>
            <Link className="ghost-button compact-button" to="/offline-admin/conflicts">Conflits</Link>
          </div>
        }
      >
        <AdminSummary cards={[
          { label: 'Postes', value: summary?.workstations.total ?? 0 },
          { label: 'Online', value: summary?.workstations.online ?? 0 },
          { label: 'Offline', value: summary?.workstations.offline ?? 0 },
          { label: 'Degrades', value: summary?.workstations.degraded ?? 0 },
          { label: 'Pending', value: summary?.queue.pending ?? 0 },
          { label: 'Conflits', value: summary?.queue.conflicts ?? 0 },
          { label: 'Allocations', value: summary?.allocations.active ?? 0 },
          { label: 'Reserve offline', value: summary?.allocations.reservedQuantity ?? 0 },
          { label: 'Libre online', value: summary?.allocations.freeOnlineQuantity ?? 0 },
        ]} />

        <div className="dashboard-grid reports-dashboard-grid">
          <section className="card table-card">
            <div className="card-header"><h3>Postes les plus recents</h3></div>
            {workstations.isLoading ? <p className="loading-state">Chargement...</p> : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Poste</th><th>Site</th><th>Statut</th><th>Pending</th><th>Conflits</th><th>Dernier heartbeat</th></tr></thead>
                  <tbody>
                    {workstationRows.slice(0, 8).map((row) => (
                      <tr key={row.workstationId}>
                        <td><Link to={`/offline-admin/workstations/${row.workstationId}`}>{row.workstationName}</Link></td>
                        <td>{row.siteName ?? '-'}</td>
                        <td><span className={`badge compact-badge ${badgeForStatus(row.status)}`}>{row.status}</span></td>
                        <td>{row.pendingCount}</td>
                        <td>{row.conflictCount}</td>
                        <td>{formatDateTime(row.lastSeenAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card table-card">
            <div className="card-header"><h3>Conflits recents</h3></div>
            {conflicts.isLoading ? <p className="loading-state">Chargement...</p> : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Reference</th><th>Poste</th><th>Type</th><th>Severite</th><th>Statut</th></tr></thead>
                  <tbody>
                    {conflictRows.slice(0, 8).map((row) => (
                      <tr key={row.conflictId}>
                        <td>{formatDateTime(row.createdAt)}</td>
                        <td><Link to={`/offline-admin/conflicts?focus=${row.conflictId}`}>{row.offlineReference ?? row.localSaleId ?? row.operationId}</Link></td>
                        <td>{row.workstationName ?? '-'}</td>
                        <td>{row.conflictCode}</td>
                        <td><span className={`badge compact-badge ${severityBadge(row.severity)}`}>{row.severity}</span></td>
                        <td>{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </PageShell>
    </>
  );
}

export function OfflineAdminWorkstationsPage() {
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const workstations = useQuery({ queryKey: ['offline-admin', 'workstations'], queryFn: async () => (await posSyncService.getAdminWorkstations()).data });
  const revoke = useMutation({
    mutationFn: (id: string) => posSyncService.revokeWorkstation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offline-admin', 'workstations'] });
      qc.invalidateQueries({ queryKey: ['offline-admin', 'dashboard'] });
    },
  });
  const rows = useMemo(
    () => (workstations.data ?? []).filter((row) => [row.workstationName, row.workstationCode, row.siteName, row.userName, row.status].some((value) => String(value ?? '').toLowerCase().includes(search.toLowerCase()))),
    [search, workstations.data],
  );
  const exportRows = useMemo(() => [
    ['Poste', 'Site', 'Statut', 'Pending', 'Conflits', 'Version', 'Dernier heartbeat'],
    ...rows.map((row) => [row.workstationName, row.siteName ?? '-', row.status, row.pendingCount, row.conflictCount, row.appVersion ?? '-', row.lastSeenAt ? formatDateTime(row.lastSeenAt) : '-']),
  ], [rows]);

  return (
    <PageShell
      title="Postes Offline"
      description="Liste des workstations offline, heartbeat, versions et file d attente."
      actions={<AdminExportActions baseName="offline_postes" sheetName="Postes offline" rows={exportRows} jsonData={rows} disabled={rows.length === 0} />}
    >
      <div className="card reference-filters"><SearchBox value={search} onChange={setSearch} placeholder="Rechercher poste, site, utilisateur..." /></div>
      <div className="card table-card">
        {workstations.isLoading ? <p className="loading-state">Chargement des postes offline...</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Poste</th><th>Site</th><th>Utilisateur</th><th>Statut</th><th>Pending</th><th>Conflits</th><th>Version</th><th>Dernier heartbeat</th><th>Actions</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.workstationId}>
                  <td><Link to={`/offline-admin/workstations/${row.workstationId}`}>{row.workstationName}</Link></td>
                  <td>{row.siteName ?? '-'}</td>
                  <td>{row.userName ?? '-'}</td>
                  <td><span className={`badge compact-badge ${badgeForStatus(row.status)}`}>{row.status}</span></td>
                  <td>{row.pendingCount}</td>
                  <td>{row.conflictCount}</td>
                  <td>{row.appVersion ?? '-'}</td>
                  <td>{formatDateTime(row.lastSeenAt)}</td>
                  <td className="reference-actions-cell">
                    <Link className="ghost-button compact-button" to={`/offline-admin/workstations/${row.workstationId}`}>Voir</Link>
                    {row.status !== 'REVOKED' ? (
                      <button className="ghost-button compact-button" onClick={() => revoke.mutate(row.workstationId)} disabled={revoke.isPending}>
                        Revoquer
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}

export function OfflineAdminWorkstationDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ['offline-admin', 'workstation', id], queryFn: async () => (await posSyncService.getAdminWorkstation(id)).data, enabled: Boolean(id) });
  const revoke = useMutation({
    mutationFn: () => posSyncService.revokeWorkstation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offline-admin', 'workstation', id] });
      qc.invalidateQueries({ queryKey: ['offline-admin', 'workstations'] });
      qc.invalidateQueries({ queryKey: ['offline-admin', 'dashboard'] });
    },
  });
  const row = detail.data;

  return (
    <PageShell
      title="Detail poste Offline"
      description="Identite du poste, heartbeat, allocations et conflits ouverts."
      actions={row?.status !== 'REVOKED' ? (
        <button className="ghost-button compact-button" onClick={() => revoke.mutate()} disabled={revoke.isPending}>
          Revoquer le poste
        </button>
      ) : undefined}
    >
      {!row ? <p className="loading-state">Chargement du poste...</p> : (
        <>
          <AdminSummary cards={[
            { label: 'Statut', value: row.status },
            { label: 'Pending', value: row.pendingCount },
            { label: 'Conflits', value: row.conflictCount },
            { label: 'Allocations', value: row.allocationSummary?.total ?? 0 },
            { label: 'Reserve', value: row.allocationSummary?.reservedQuantity ?? 0 },
          ]} />
          <div className="card detail-card">
            <div className="detail-grid compact-detail-grid">
              <div><span>Poste</span><strong>{row.workstationName}</strong></div>
              <div><span>Code</span><strong>{row.workstationCode ?? '-'}</strong></div>
              <div><span>Site</span><strong>{row.siteName ?? '-'}</strong></div>
              <div><span>Device</span><strong>{row.deviceId ?? '-'}</strong></div>
              <div><span>Utilisateur</span><strong>{row.userName ?? '-'}</strong></div>
              <div><span>Version app</span><strong>{row.appVersion ?? '-'}</strong></div>
              <div><span>Version DB locale</span><strong>{row.localDbVersion ?? '-'}</strong></div>
              <div><span>Snapshot</span><strong>{row.snapshotStatus}</strong></div>
              <div><span>Dernier heartbeat</span><strong>{formatDateTime(row.lastSeenAt)}</strong></div>
              <div><span>Derniere sync</span><strong>{formatDateTime(row.lastSuccessfulSyncAt)}</strong></div>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}

export function OfflineAdminConflictsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(null);
  const conflicts = useQuery({ queryKey: ['offline-admin', 'conflicts'], queryFn: async () => (await posSyncService.getAdminConflicts()).data });
  const conflictDetail = useQuery({
    queryKey: ['offline-admin', 'conflict', selectedConflictId],
    queryFn: async () => (await posSyncService.getAdminConflict(selectedConflictId!)).data,
    enabled: Boolean(selectedConflictId),
  });
  const resolve = useMutation({
    mutationFn: ({ id, resolutionType }: { id: string; resolutionType: 'UNDER_REVIEW' | 'MANUAL_REVIEW_COMPLETED' | 'DISMISS' }) =>
      posSyncService.resolveConflict(id, { resolutionType }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['offline-admin', 'conflicts'] });
      qc.invalidateQueries({ queryKey: ['offline-admin', 'conflict', variables.id] });
    },
  });

  const rows = useMemo(
    () => (conflicts.data ?? []).filter((row) => [row.offlineReference, row.conflictCode, row.message, row.workstationName, row.siteName].some((value) => String(value ?? '').toLowerCase().includes(search.toLowerCase()))),
    [search, conflicts.data],
  );

  return (
    <PageShell title="Conflits Offline" description="Centre de supervision et de resolution des conflits de synchronisation.">
      <div className="card reference-filters"><SearchBox value={search} onChange={setSearch} placeholder="Rechercher reference, conflit, poste..." /></div>
      <div className="card table-card">
        {conflicts.isLoading ? <p className="loading-state">Chargement des conflits...</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Reference</th><th>Poste</th><th>Type</th><th>Severite</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.conflictId}>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td>{row.offlineReference ?? row.localSaleId ?? row.operationId}</td>
                  <td>{row.workstationName ?? '-'}</td>
                  <td>{row.conflictCode}</td>
                  <td><span className={`badge compact-badge ${severityBadge(row.severity)}`}>{row.severity}</span></td>
                  <td>{row.status}</td>
                  <td className="reference-actions-cell">
                    <button className="ghost-button compact-button" onClick={() => resolve.mutate({ id: row.conflictId, resolutionType: 'UNDER_REVIEW' })}>Sous revue</button>
                    <button className="ghost-button compact-button" onClick={() => resolve.mutate({ id: row.conflictId, resolutionType: 'MANUAL_REVIEW_COMPLETED' })}>Resolu</button>
                    <button className="ghost-button compact-button" onClick={() => resolve.mutate({ id: row.conflictId, resolutionType: 'DISMISS' })}>Ignorer</button>
                    <button className="ghost-button compact-button" onClick={() => setSelectedConflictId(row.conflictId)}>Detail</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
      {conflictDetail.data ? (
        <div className="card detail-card">
          <div className="card-header">
            <h3>Detail conflit</h3>
          </div>
          <div className="detail-grid compact-detail-grid">
            <div><span>Reference</span><strong>{conflictDetail.data.offlineReference ?? conflictDetail.data.localSaleId ?? conflictDetail.data.operationId}</strong></div>
            <div><span>Type</span><strong>{conflictDetail.data.conflictCode}</strong></div>
            <div><span>Statut</span><strong>{conflictDetail.data.status}</strong></div>
            <div><span>Severite</span><strong>{conflictDetail.data.severity}</strong></div>
            <div><span>Poste</span><strong>{conflictDetail.data.workstationName ?? '-'}</strong></div>
            <div><span>Site</span><strong>{conflictDetail.data.siteName ?? '-'}</strong></div>
            <div><span>Cree le</span><strong>{formatDateTime(conflictDetail.data.createdAt)}</strong></div>
            <div><span>Resolu le</span><strong>{formatDateTime(conflictDetail.data.resolvedAt)}</strong></div>
            <div><span>Resolution</span><strong>{conflictDetail.data.resolutionType ?? '-'}</strong></div>
            <div><span>Message</span><strong>{conflictDetail.data.message}</strong></div>
          </div>
          <pre className="json-preview">{JSON.stringify({ localPayload: conflictDetail.data.localPayload, serverContext: conflictDetail.data.serverContext }, null, 2)}</pre>
        </div>
      ) : null}
    </PageShell>
  );
}

export function OfflineAdminAllocationsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [createForm, setCreateForm] = useState({ siteId: '', workstationId: '', articleId: '', lotId: '', quantity: '1' });
  const [transferForm, setTransferForm] = useState({ sourceWorkstationId: '', targetWorkstationId: '', allocationId: '', quantity: '1' });
  const [rebalanceForm, setRebalanceForm] = useState({ siteId: '', articleId: '', lotId: '', workstationIds: '', quantityToAllocate: '' });

  const allocations = useQuery({ queryKey: ['offline-admin', 'allocations'], queryFn: async () => (await offlineAllocationsService.getAll()).data });
  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const workstations = useQuery({ queryKey: ['workstations'], queryFn: async () => (await workstationsService.getAll()).data });

  const createMutation = useMutation({
    mutationFn: () => offlineAllocationsService.create({
      ...createForm,
      quantity: Number(createForm.quantity),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['offline-admin', 'allocations'] }),
  });
  const transferMutation = useMutation({
    mutationFn: () => offlineAllocationsService.transfer({
      ...transferForm,
      quantity: Number(transferForm.quantity),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['offline-admin', 'allocations'] }),
  });
  const rebalanceMutation = useMutation({
    mutationFn: () => offlineAllocationsService.rebalance({
      siteId: rebalanceForm.siteId,
      articleId: rebalanceForm.articleId,
      lotId: rebalanceForm.lotId,
      mode: 'AUTOMATIC_EQUAL',
      workstationIds: rebalanceForm.workstationIds.split(',').map((value) => value.trim()).filter(Boolean),
      quantityToAllocate: rebalanceForm.quantityToAllocate ? Number(rebalanceForm.quantityToAllocate) : undefined,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['offline-admin', 'allocations'] }),
  });
  const actionMutation = useMutation({
    mutationFn: ({ action, id }: { action: 'suspend' | 'release' | 'revoke'; id: string }) =>
      action === 'suspend'
        ? offlineAllocationsService.suspend(id)
        : action === 'release'
          ? offlineAllocationsService.release(id)
          : offlineAllocationsService.revoke(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['offline-admin', 'allocations'] }),
  });

  const rows = useMemo(
    () => (allocations.data ?? []).filter((row) => [row.articleCode, row.articleName, row.lotNumber, row.workstationName, row.siteName, row.status].some((value) => String(value ?? '').toLowerCase().includes(search.toLowerCase()))),
    [search, allocations.data],
  );
  const exportRows = useMemo(() => [
    ['Article', 'Lot', 'Poste', 'Site', 'Alloue', 'Consomme', 'Reste', 'Statut', 'Maj'],
    ...rows.map((row) => [row.articleName ?? row.articleId, row.lotNumber ?? '-', row.workstationName ?? '-', row.siteName ?? '-', row.allocatedQuantity, row.consumedQuantity, row.remainingQuantity, row.status, row.updatedAt ? formatDateTime(row.updatedAt) : '-']),
  ], [rows]);

  function submitCreate(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate();
  }
  function submitTransfer(event: FormEvent) {
    event.preventDefault();
    transferMutation.mutate();
  }
  function submitRebalance(event: FormEvent) {
    event.preventDefault();
    rebalanceMutation.mutate();
  }

  return (
    <PageShell
      title="Allocations Offline"
      description="Administration des quotas offline par poste, lot et site."
      actions={<AdminExportActions baseName="offline_allocations" sheetName="Allocations offline" rows={exportRows} jsonData={rows} disabled={rows.length === 0} />}
    >
      <AdminSummary cards={[
        { label: 'Total', value: rows.length },
        { label: 'Actives', value: rows.filter((row) => row.status === 'ACTIVE').length },
        { label: 'Reserve', value: rows.reduce((sum, row) => sum + row.allocatedQuantity, 0) },
        { label: 'Libre restant', value: rows.reduce((sum, row) => sum + row.remainingQuantity, 0) },
      ]} />

      <div className="dashboard-grid reports-dashboard-grid">
        <form className="card form-grid reference-form" onSubmit={submitCreate}>
          <h3>Nouvelle allocation</h3>
          <select className="input" value={createForm.siteId} onChange={(event) => setCreateForm({ ...createForm, siteId: event.target.value })} required>
            <option value="">Site</option>
            {(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}
          </select>
          <select className="input" value={createForm.workstationId} onChange={(event) => setCreateForm({ ...createForm, workstationId: event.target.value })} required>
            <option value="">Poste</option>
            {(workstations.data ?? []).map((row) => <option key={row.workstationId} value={row.workstationId}>{row.workstationName}</option>)}
          </select>
          <input className="input" placeholder="Article UUID" value={createForm.articleId} onChange={(event) => setCreateForm({ ...createForm, articleId: event.target.value })} required />
          <input className="input" placeholder="Lot UUID" value={createForm.lotId} onChange={(event) => setCreateForm({ ...createForm, lotId: event.target.value })} required />
          <input className="input" placeholder="Quantite" type="number" min="0.001" step="0.001" value={createForm.quantity} onChange={(event) => setCreateForm({ ...createForm, quantity: event.target.value })} required />
          <button className="button compact-button" disabled={createMutation.isPending}>Creer</button>
        </form>

        <form className="card form-grid reference-form" onSubmit={submitTransfer}>
          <h3>Transferer quota</h3>
          <input className="input" placeholder="Allocation UUID" value={transferForm.allocationId} onChange={(event) => setTransferForm({ ...transferForm, allocationId: event.target.value })} required />
          <select className="input" value={transferForm.sourceWorkstationId} onChange={(event) => setTransferForm({ ...transferForm, sourceWorkstationId: event.target.value })} required>
            <option value="">Poste source</option>
            {(workstations.data ?? []).map((row) => <option key={row.workstationId} value={row.workstationId}>{row.workstationName}</option>)}
          </select>
          <select className="input" value={transferForm.targetWorkstationId} onChange={(event) => setTransferForm({ ...transferForm, targetWorkstationId: event.target.value })} required>
            <option value="">Poste cible</option>
            {(workstations.data ?? []).map((row) => <option key={row.workstationId} value={row.workstationId}>{row.workstationName}</option>)}
          </select>
          <input className="input" placeholder="Quantite" type="number" min="0.001" step="0.001" value={transferForm.quantity} onChange={(event) => setTransferForm({ ...transferForm, quantity: event.target.value })} required />
          <button className="button compact-button" disabled={transferMutation.isPending}>Transferer</button>
        </form>

        <form className="card form-grid reference-form" onSubmit={submitRebalance}>
          <h3>Repartir automatiquement</h3>
          <select className="input" value={rebalanceForm.siteId} onChange={(event) => setRebalanceForm({ ...rebalanceForm, siteId: event.target.value })} required>
            <option value="">Site</option>
            {(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}
          </select>
          <input className="input" placeholder="Article UUID" value={rebalanceForm.articleId} onChange={(event) => setRebalanceForm({ ...rebalanceForm, articleId: event.target.value })} required />
          <input className="input" placeholder="Lot UUID" value={rebalanceForm.lotId} onChange={(event) => setRebalanceForm({ ...rebalanceForm, lotId: event.target.value })} required />
          <input className="input" placeholder="Postes UUID, separes par virgules" value={rebalanceForm.workstationIds} onChange={(event) => setRebalanceForm({ ...rebalanceForm, workstationIds: event.target.value })} required />
          <input className="input" placeholder="Quantite a repartir (optionnel)" type="number" min="0.001" step="0.001" value={rebalanceForm.quantityToAllocate} onChange={(event) => setRebalanceForm({ ...rebalanceForm, quantityToAllocate: event.target.value })} />
          <button className="button compact-button" disabled={rebalanceMutation.isPending}>Reequilibrer</button>
        </form>
      </div>

      <div className="card reference-filters"><SearchBox value={search} onChange={setSearch} placeholder="Rechercher article, lot, poste, site..." /></div>
      <div className="card table-card">
        {allocations.isLoading ? <p className="loading-state">Chargement des allocations offline...</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Article</th><th>Lot</th><th>Poste</th><th>Site</th><th>Alloue</th><th>Consomme</th><th>Reste</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.allocationId}>
                  <td><strong>{row.articleName ?? row.articleId}</strong><div className="offline-row-meta">{row.articleCode ?? '-'}</div></td>
                  <td><strong>{row.lotNumber ?? '-'}</strong><div className="offline-row-meta">{row.expiryDate ? formatDate(row.expiryDate) : '-'}</div></td>
                  <td>{row.workstationName ?? '-'}</td>
                  <td>{row.siteName ?? '-'}</td>
                  <td>{row.allocatedQuantity}</td>
                  <td>{row.consumedQuantity}</td>
                  <td>{row.remainingQuantity}</td>
                  <td><span className={`badge compact-badge ${allocationBadge(row.status)}`}>{row.status}</span></td>
                  <td className="reference-actions-cell">
                    <button className="ghost-button compact-button" onClick={() => actionMutation.mutate({ action: 'suspend', id: row.allocationId })}>Suspendre</button>
                    <button className="ghost-button compact-button" onClick={() => actionMutation.mutate({ action: 'release', id: row.allocationId })}>Liberer</button>
                    <button className="ghost-button compact-button" onClick={() => actionMutation.mutate({ action: 'revoke', id: row.allocationId })}>Revoquer</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}

export function OfflineAdminLogsPage() {
  const [search, setSearch] = useState('');
  const logs = useQuery({ queryKey: ['offline-admin', 'logs'], queryFn: async () => (await posSyncService.getAdminLogs()).data });
  const rows = useMemo(
    () => (logs.data ?? []).filter((row) => [row.eventType, row.level, row.siteName, row.workstationName, row.message].some((value) => String(value ?? '').toLowerCase().includes(search.toLowerCase()))),
    [search, logs.data],
  );

  return (
    <PageShell title="Journal Offline" description="Observabilite des evenements heartbeat, sync, conflits et administration offline.">
      <div className="card reference-filters"><SearchBox value={search} onChange={setSearch} placeholder="Rechercher type, niveau, site, poste..." /></div>
      <div className="card table-card">
        {logs.isLoading ? <p className="loading-state">Chargement du journal...</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Type</th><th>Niveau</th><th>Site</th><th>Poste</th><th>Message</th></tr></thead>
              <tbody>{rows.map((row, index) => (
                <tr key={`${row.eventAt}-${index}`}>
                  <td>{formatDateTime(row.eventAt)}</td>
                  <td>{row.eventType}</td>
                  <td><span className={`badge compact-badge ${severityBadge(row.level)}`}>{row.level}</span></td>
                  <td>{row.siteName ?? '-'}</td>
                  <td>{row.workstationName ?? '-'}</td>
                  <td>{row.message}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}

export function OfflineAdminCashSessionsPage() {
  const [search, setSearch] = useState('');
  const [sessions, setSessions] = useState<OfflineCashSessionSnapshot[]>([]);
  const [movements, setMovements] = useState<OfflineCashMovement[]>([]);
  const [counts, setCounts] = useState<OfflineCashCount[]>([]);
  const [events, setEvents] = useState<OfflineCashReconciliationEvent[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [localSessions, localMovements, localCounts, localEvents] = await Promise.all([
        readOfflineCashSessions(),
        readOfflineCashMovements(),
        readOfflineCashCounts(),
        readOfflineCashReconciliationEvents(),
      ]);
      setSessions(localSessions);
      setMovements(localMovements);
      setCounts(localCounts);
      setEvents(localEvents);
      setSelectedSessionId((current) => current ?? localSessions[0]?.localCashSessionId ?? null);
    })();
  }, []);

  const rows = useMemo(
    () => sessions.filter((row) =>
      [
        row.offlineCashReference,
        row.serverSessionReference,
        row.siteId,
        row.workstationId,
        row.userId,
        row.status,
      ].some((value) => String(value ?? '').toLowerCase().includes(search.toLowerCase()))),
    [search, sessions],
  );
  const selected = rows.find((row) => row.localCashSessionId === selectedSessionId) ?? rows[0] ?? null;
  const selectedMovements = selected ? movements.filter((row) => row.localCashSessionId === selected.localCashSessionId) : [];
  const selectedCounts = selected ? counts.filter((row) => row.localCashSessionId === selected.localCashSessionId) : [];
  const selectedEvents = selected ? events.filter((row) => row.localCashSessionId === selected.localCashSessionId) : [];
  const exportRows = useMemo(() => [
    ['Reference offline', 'Reference serveur', 'Site', 'Poste', 'Caissier', 'Ouverture', 'Fermeture', 'Statut', 'Expected USD', 'Declared USD', 'Difference USD'],
    ...rows.map((row) => [
      row.offlineCashReference,
      row.serverSessionReference ?? '-',
      row.siteId,
      row.workstationId ?? '-',
      row.userId,
      formatDateTime(row.openedLocallyAt),
      formatDateTime(row.closedLocallyAt ?? row.serverClosedAt),
      row.status,
      row.serverExpectedClosingUsd ?? row.expectedClosingUsd,
      row.declaredClosingUsd ?? '-',
      row.serverDifferenceUsd ?? row.differenceUsd ?? '-',
    ]),
  ], [rows]);

  return (
    <PageShell
      title="Sessions caisse offline"
      description="Vue V1 des sessions caisse locales/offline, des mouvements et des ecarts."
      actions={<AdminExportActions baseName="offline_cash_sessions" sheetName="Sessions offline" rows={exportRows} jsonData={rows} disabled={rows.length === 0} />}
    >
      <AdminSummary cards={[
        { label: 'Sessions', value: rows.length },
        { label: 'Ouvertes', value: rows.filter((row) => row.status === 'OPEN_PENDING_SYNC' || row.status === 'OPEN_SYNCED' || row.status === 'LOCAL_OPEN').length },
        { label: 'Pending close', value: rows.filter((row) => row.status === 'CLOSED_PENDING_SYNC').length },
        { label: 'Conflits', value: rows.filter((row) => row.status === 'CONFLICT').length },
      ]} />

      <div className="card reference-filters"><SearchBox value={search} onChange={setSearch} placeholder="Rechercher reference, site, poste, statut..." /></div>

      <div className="dashboard-grid reports-dashboard-grid">
        <section className="card table-card">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Reference</th><th>Poste</th><th>Ouverture</th><th>Statut</th><th>Expected USD</th><th>Declared USD</th><th>Difference USD</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8}><p className="empty-state">Aucune session caisse offline locale.</p></td></tr>
                ) : rows.map((row) => (
                  <tr key={row.localCashSessionId}>
                    <td><strong>{row.offlineCashReference}</strong><div className="offline-row-meta">{row.serverSessionReference ?? '-'}</div></td>
                    <td>{row.workstationId ?? '-'}</td>
                    <td>{formatDateTime(row.openedLocallyAt)}</td>
                    <td><span className="badge compact-badge badge-neutral">{row.status}</span></td>
                    <td>{formatMoney(row.serverExpectedClosingUsd ?? row.expectedClosingUsd, 'USD')}</td>
                    <td>{row.declaredClosingUsd === null ? '-' : formatMoney(row.declaredClosingUsd, 'USD')}</td>
                    <td>{row.serverDifferenceUsd === null && row.differenceUsd === null ? '-' : formatMoney(row.serverDifferenceUsd ?? row.differenceUsd ?? 0, 'USD')}</td>
                    <td className="reference-actions-cell">
                      <button className="ghost-button compact-button" onClick={() => setSelectedSessionId(row.localCashSessionId)}>Voir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card detail-card">
          <div className="card-header"><h3>Detail session</h3></div>
          {!selected ? (
            <p className="empty-state">Selectionnez une session.</p>
          ) : (
            <>
              <div className="detail-grid compact-detail-grid">
                <div><span>Reference offline</span><strong>{selected.offlineCashReference}</strong></div>
                <div><span>Reference serveur</span><strong>{selected.serverSessionReference ?? '-'}</strong></div>
                <div><span>Statut</span><strong>{selected.status}</strong></div>
                <div><span>Ouverte</span><strong>{formatDateTime(selected.openedLocallyAt)}</strong></div>
                <div><span>Fermee</span><strong>{formatDateTime(selected.closedLocallyAt ?? selected.serverClosedAt)}</strong></div>
                <div><span>Theorique local USD</span><strong>{formatMoney(selected.expectedClosingUsd, 'USD')}</strong></div>
                <div><span>Theorique serveur USD</span><strong>{selected.serverExpectedClosingUsd === null ? '-' : formatMoney(selected.serverExpectedClosingUsd, 'USD')}</strong></div>
                <div><span>Declare USD</span><strong>{selected.declaredClosingUsd === null ? '-' : formatMoney(selected.declaredClosingUsd, 'USD')}</strong></div>
                <div><span>Ecart USD</span><strong>{selected.serverDifferenceUsd === null && selected.differenceUsd === null ? '-' : formatMoney(selected.serverDifferenceUsd ?? selected.differenceUsd ?? 0, 'USD')}</strong></div>
              </div>
              <div className="detail-grid compact-detail-grid">
                <div><span>Mouvements</span><strong>{selectedMovements.length}</strong></div>
                <div><span>Comptages</span><strong>{selectedCounts.length}</strong></div>
                <div><span>Reconciliations</span><strong>{selectedEvents.length}</strong></div>
              </div>
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function badgeForStatus(status: string) {
  if (status === 'ONLINE') return 'badge-success';
  if (status === 'DEGRADED') return 'badge-warning';
  if (status === 'REVOKED') return 'badge-danger';
  if (status === 'STALE') return 'badge-muted';
  return 'badge-neutral';
}

function severityBadge(level: string) {
  if (level === 'CRITICAL' || level === 'ERROR') return 'badge-danger';
  if (level === 'WARNING') return 'badge-warning';
  return 'badge-neutral';
}

function allocationBadge(status: string) {
  if (status === 'ACTIVE') return 'badge-success';
  if (status === 'SUSPENDED') return 'badge-warning';
  if (status === 'REVOKED') return 'badge-danger';
  return 'badge-muted';
}
