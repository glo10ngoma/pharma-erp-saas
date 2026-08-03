import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const canCreate = permissions.includes('customer_returns.create');
  const canApproveUnlinked = permissions.includes('customer_returns.unlinked.approve');

  const approveUnlinked = useMutation({
    mutationFn: (customerReturnId: string) => customerReturnsService.approveUnlinked(customerReturnId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['customer-returns'] });
    },
  });

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
        {canCreate ? (
          <div className="customer-return-entry-actions">
            <button className="button" type="button" onClick={() => navigate('/customer-returns/new/linked')}>
              + Retour lié à une vente
            </button>
            <button className="ghost-button compact-button" type="button" onClick={() => navigate('/customer-returns/new/unlinked')}>
              + Retour sans facture
            </button>
          </div>
        ) : null}
      </div>

      {canCreate ? (
        <div className="customer-return-entry-cards">
          <section className="card compact-card customer-return-entry-card">
            <h2>Retour lié à une vente</h2>
            <p className="muted">Utilisez ce parcours lorsque le ticket ou la vente peut être retrouvé.</p>
            <button className="button compact-button" type="button" onClick={() => navigate('/customer-returns/new/linked')}>
              Ouvrir le parcours
            </button>
          </section>
          <section className="card compact-card customer-return-entry-card">
            <h2>Retour sans facture</h2>
            <p className="muted">Utilisez ce parcours lorsque la vente ne peut pas être identifiée. Une validation responsable sera requise.</p>
            <button className="ghost-button compact-button" type="button" onClick={() => navigate('/customer-returns/new/unlinked')}>
              Ouvrir le parcours
            </button>
          </section>
        </div>
      ) : null}

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
                      {row.saleLinkStatus === 'UNLINKED' ? (
                        <>
                          <Link className="ghost-button compact-button table-action-button" to={`/customer-returns/${row.customerReturnId}#customer-return-traceability`} onClick={(event) => event.stopPropagation()}>
                            Voir la traçabilité
                          </Link>
                          <Link className="ghost-button compact-button table-action-button" to={`/customer-returns/${row.customerReturnId}`} onClick={(event) => event.stopPropagation()}>
                            Ouvrir le retour
                          </Link>
                          {canApproveUnlinked && row.status === 'PENDING_MANAGER_APPROVAL' ? (
                            <button
                              className="button compact-button table-action-button"
                              type="button"
                              disabled={approveUnlinked.isPending}
                              onClick={(event) => {
                                event.stopPropagation();
                                approveUnlinked.mutate(row.customerReturnId);
                              }}
                            >
                              Approuver
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {row.saleId ? (
                            <Link className="ghost-button compact-button table-action-button" to={`/sales/${row.saleId}`} onClick={(event) => event.stopPropagation()}>
                              Voir la vente
                            </Link>
                          ) : null}
                          <Link className="ghost-button compact-button table-action-button" to={`/customer-returns/${row.customerReturnId}`} onClick={(event) => event.stopPropagation()}>
                            Ouvrir le retour
                          </Link>
                        </>
                      )}
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
