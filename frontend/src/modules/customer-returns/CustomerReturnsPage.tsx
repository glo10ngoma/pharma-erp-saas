import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { SearchBox } from '../../components/SearchBox';
import { apiErrorMessage } from '../../services/apiError';
import { customerReturnsService } from '../../services/customerReturns.service';
import { formatDate } from '../../utils/date';
import { customerReturnStatusClass, customerReturnStatusLabel } from './customerReturnLabels';

export function CustomerReturnsPage() {
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const canCreate = permissions.includes('customer_returns.create');

  const query = useQuery({
    queryKey: ['customer-returns', search, status, page],
    queryFn: async () => (await customerReturnsService.getAll({
      search: search || undefined,
      status: status || undefined,
      page,
      limit: 25,
    })).data,
    placeholderData: (previous) => previous,
  });

  const rows = query.data?.items ?? [];
  const stats = useMemo(() => ({
    total: query.data?.total ?? rows.length,
    draft: rows.filter((row) => row.status === 'DRAFT').length,
    inspection: rows.filter((row) => row.status === 'PENDING_INSPECTION').length,
    approved: rows.filter((row) => row.status === 'APPROVED').length,
    validated: rows.filter((row) => row.status === 'VALIDATED').length,
  }), [query.data?.total, rows]);

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Retours clients</h1>
          <p className="muted">Dossiers de retours clients, inspection et validation. Aucun impact stock ou caisse automatique.</p>
        </div>
        {canCreate && (
          <button className="button" type="button" onClick={() => navigate('/customer-returns/new')}>
            + Nouveau retour client
          </button>
        )}
      </div>

      <div className="stats-grid">
        <KpiCard label="Total" value={String(stats.total)} />
        <KpiCard label="Brouillons" value={String(stats.draft)} />
        <KpiCard label="En inspection" value={String(stats.inspection)} />
        <KpiCard label="Approuves" value={String(stats.approved)} />
        <KpiCard label="Valides" value={String(stats.validated)} />
      </div>

      <div className="card sales-filters">
        <div className="sales-filter-grid">
          <SearchBox value={search} onChange={setSearch} placeholder="Rechercher un retour, une vente, un client..." />
          <select className="input" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
            <option value="">Tous statuts</option>
            <option value="DRAFT">Brouillon</option>
            <option value="PENDING_INSPECTION">En inspection</option>
            <option value="APPROVED">Approuve</option>
            <option value="REJECTED">Rejete</option>
            <option value="VALIDATED">Valide</option>
            <option value="CANCELLED">Annule</option>
          </select>
        </div>
      </div>

      <div className="card">
        {query.isLoading ? (
          <p className="loading-state">Chargement des retours clients...</p>
        ) : query.isError ? (
          <div className="error-state">
            <p>{apiErrorMessage(query.error)}</p>
            <button className="ghost-button compact-button" type="button" onClick={() => query.refetch()}>Reessayer</button>
          </div>
        ) : rows.length === 0 ? (
          <p className="empty-state">Aucun retour client trouve.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Retour</th>
                  <th>Vente</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Site</th>
                  <th>Lignes</th>
                  <th>Statut</th>
                  <th>Motif</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="clickable-row" key={row.customerReturnId} onClick={() => navigate(`/customer-returns/${row.customerReturnId}`)}>
                    <td><strong>{row.returnNumber}</strong></td>
                    <td>{row.saleNumberSnapshot}</td>
                    <td>{formatDate(row.returnDate)}</td>
                    <td>{row.customerNameSnapshot || row.organizationNameSnapshot || 'Comptoir'}</td>
                    <td>{row.siteNameSnapshot}</td>
                    <td>{row.itemsCount ?? 0}</td>
                    <td><span className={`badge ${customerReturnStatusClass(row.status)}`}>{customerReturnStatusLabel(row.status)}</span></td>
                    <td>{row.reason || '-'}</td>
                    <td className="table-actions">
                      <button className="ghost-button compact-button" type="button" onClick={(event) => { event.stopPropagation(); navigate(`/customer-returns/${row.customerReturnId}`); }}>
                        Voir
                      </button>
                      {canCreate && row.status === 'DRAFT' ? (
                        <Link className="ghost-button compact-button" to={`/customer-returns/${row.customerReturnId}`}>Ouvrir</Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {query.data && query.data.totalPages > 1 && (
        <div className="table-pagination">
          <button className="ghost-button compact-button" type="button" disabled={page <= 1 || query.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}>Precedent</button>
          <span>Page {query.data.page} / {query.data.totalPages}</span>
          <button className="ghost-button compact-button" type="button" disabled={page >= query.data.totalPages || query.isFetching} onClick={() => setPage((current) => current + 1)}>Suivant</button>
        </div>
      )}
    </>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card kpi-card">
      <span className="kpi-label">{label}</span>
      <p className="metric small-metric">{value}</p>
    </div>
  );
}
