import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SearchBox } from '../../components/SearchBox';
import { activityService } from '../../services/activity.service';
import { useState } from 'react';
import { formatDate } from '../../utils/date';

export function RecentActivityPage() {
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: ['recent-activity'], queryFn: async () => (await activityService.getRecent(100)).data, refetchInterval: 15000 });
  const rows = useMemo(() => (query.data ?? []).filter((row) => [row.label, row.userName, row.siteName, row.workstationName].some((value) => String(value ?? '').toLowerCase().includes(search.trim().toLowerCase()))), [query.data, search]);

  return (
    <>
      <div className="page-heading reference-heading">
        <div><h1>Activite recente</h1><p className="muted">Vue unifiee: audit, commentaires et messagerie interne.</p></div>
      </div>
      <div className="card reference-filters"><SearchBox value={search} onChange={setSearch} placeholder="Rechercher utilisateur, action, poste, site..." /></div>
      <div className="card table-card">
        {query.isLoading ? <p className="loading-state">Chargement de l activite...</p> : rows.length === 0 ? <p className="empty-state">Aucune activite recente.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Type</th><th>Utilisateur</th><th>Poste</th><th>Site</th><th>Action</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={`${row.activityType}-${row.recordId}-${row.occurredAt}`}><td>{formatDate(row.occurredAt)}</td><td><span className="badge compact-badge badge-muted">{row.activityType}</span></td><td>{row.userName ?? '-'}</td><td>{row.workstationName ?? '-'}</td><td>{row.siteName ?? '-'}</td><td>{row.label}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
