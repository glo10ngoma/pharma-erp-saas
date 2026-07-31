import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchBox } from '../../components/SearchBox';
import { Modal } from '../../components/Modal';
import { sitesService } from '../../services/sites.service';
import { workstationsService } from '../../services/workstations.service';
import { AdminExportActions, AdminSummary } from './admin-ui';
import { formatDate } from '../../utils/date';

const initialForm = { siteId: '', workstationCode: '', workstationName: '', workstationType: 'POS', deviceUuid: '' };

export function WorkstationsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const workstations = useQuery({ queryKey: ['workstations'], queryFn: async () => (await workstationsService.getAll()).data });
  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const create = useMutation({
    mutationFn: () => workstationsService.create(form),
    onSuccess: () => {
      setModalOpen(false);
      setForm(initialForm);
      qc.invalidateQueries({ queryKey: ['workstations'] });
    },
  });

  const rows = useMemo(() => (workstations.data ?? []).filter((row) => [row.workstationCode, row.workstationName, row.siteName, row.workstationType].some((value) => String(value ?? '').toLowerCase().includes(search.trim().toLowerCase()))), [search, workstations.data]);
  const exportRows = useMemo(() => [['Code', 'Nom', 'Site', 'Type', 'Statut', 'Derniere sync'], ...rows.map((row) => [row.workstationCode, row.workstationName, row.siteName ?? '-', row.workstationType, row.isActive ? 'Actif' : 'Inactif', row.lastSyncAt ? formatDate(row.lastSyncAt) : '-'])], [rows]);

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <>
      <div className="page-heading reference-heading">
        <div><h1>Postes de travail</h1><p className="muted">POS, back office et postes collaboratifs par site.</p></div>
        <div className="reference-actions">
          <AdminExportActions baseName="postes_travail" sheetName="Postes" rows={exportRows} jsonData={rows} disabled={rows.length === 0} />
          <button className="button compact-button" onClick={() => setModalOpen(true)}>Nouveau poste</button>
        </div>
      </div>

      <AdminSummary cards={[
        { label: 'Total', value: String(rows.length) },
        { label: 'Actifs', value: String(rows.filter((row) => row.isActive).length) },
        { label: 'POS', value: String(rows.filter((row) => row.workstationType === 'POS').length) },
        { label: 'Synchros', value: String(rows.filter((row) => row.isSynced).length) },
      ]} />

      <div className="card reference-filters">
        <SearchBox value={search} onChange={setSearch} placeholder="Rechercher poste, code, site, type..." />
      </div>

      <div className="card table-card">
        {workstations.isLoading ? <p className="loading-state">Chargement des postes...</p> : rows.length === 0 ? <p className="empty-state">Aucun poste trouve.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Code</th><th>Nom</th><th>Site</th><th>Type</th><th>Offline</th><th>Sync</th><th>Statut</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.workstationId}><td><strong>{row.workstationCode}</strong></td><td>{row.workstationName}</td><td>{row.siteName ?? '-'}</td><td>{row.workstationType}</td><td>{row.offlineStatus}</td><td>{row.syncState}</td><td><span className={`badge compact-badge ${row.isActive ? 'badge-success' : 'badge-muted'}`}>{row.isActive ? 'Actif' : 'Inactif'}</span></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>

      <Modal title="Nouveau poste de travail" open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="form-grid reference-form" onSubmit={submit}>
          <label><span>Site</span><select className="input" value={form.siteId} onChange={(event) => setForm({ ...form, siteId: event.target.value })} required><option value="">Choisir</option>{(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}</select></label>
          <label><span>Code</span><input className="input" placeholder="POS-01" value={form.workstationCode} onChange={(event) => setForm({ ...form, workstationCode: event.target.value })} required /></label>
          <label><span>Nom</span><input className="input" placeholder="POS 01" value={form.workstationName} onChange={(event) => setForm({ ...form, workstationName: event.target.value })} required /></label>
          <label><span>Type</span><select className="input" value={form.workstationType} onChange={(event) => setForm({ ...form, workstationType: event.target.value })}><option value="POS">POS</option><option value="BACK_OFFICE">Back Office</option><option value="LAB">Laboratoire</option><option value="OFFICE">Office</option><option value="OTHER">Autre</option></select></label>
          <label><span>Device UUID</span><input className="input" placeholder="Optionnel" value={form.deviceUuid} onChange={(event) => setForm({ ...form, deviceUuid: event.target.value })} /></label>
          <div className="modal-actions"><button className="button compact-button" disabled={create.isPending}>{create.isPending ? 'Creation...' : 'Enregistrer'}</button></div>
        </form>
      </Modal>
    </>
  );
}
