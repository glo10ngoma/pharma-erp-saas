import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { FloatingSearchPopover } from '../../components/FloatingSearchPopover';
import { apiErrorMessage } from '../../services/apiError';
import { customerReturnsService } from '../../services/customerReturns.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import { customerReturnStatusClass, customerReturnStatusLabel } from './customerReturnLabels';

export function CustomerReturnCreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const [search, setSearch] = useState('');
  const [siteId, setSiteId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const canCreate = permissions.includes('customer_returns.create');

  const query = useQuery({
    queryKey: ['customer-returns-validated-sales', search, siteId, dateFrom, dateTo],
    queryFn: async () => (await customerReturnsService.searchValidatedSales({
      search: search || undefined,
      siteId: siteId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page: 1,
      limit: 25,
    })).data,
    placeholderData: (previous) => previous,
    enabled: canCreate,
  });

  const create = useMutation({
    mutationFn: (saleId: string) => customerReturnsService.create({ saleId }),
    onSuccess: async (response) => {
      await qc.invalidateQueries({ queryKey: ['customer-returns'] });
      navigate(`/customer-returns/${response.data.customerReturnId}`);
    },
  });

  const sales = query.data?.items ?? [];
  const filteredSales = useMemo(() => sales.filter((sale) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [
      sale.saleNumber,
      sale.customerName,
      sale.organizationName,
      sale.siteName,
    ].some((value) => String(value ?? '').toLowerCase().includes(term));
  }), [sales, search]);

  return (
    <>
      <div className="breadcrumb">
        <Link to="/customer-returns">Retours clients</Link>
        <span>&gt;</span>
        <strong>Nouveau dossier</strong>
      </div>
      <div className="toolbar">
        <div>
          <h1>Nouveau retour client</h1>
          <p className="muted">Selectionnez une vente validee pour ouvrir un dossier brouillon de retour client.</p>
        </div>
        <Link className="ghost-button compact-button" to="/customer-returns">Retour liste</Link>
      </div>

      {!canCreate ? (
        <div className="card">
          <p className="empty-state">Permission customer_returns.create requise.</p>
        </div>
      ) : (
        <>
          <div className="card sales-filters">
            <div className="sales-filter-grid">
              <label className="field-block">
                <span>Site</span>
                <input className="input" value={siteId} onChange={(event) => setSiteId(event.target.value)} placeholder="UUID du site ou filtre deja applique" />
              </label>
              <label className="field-block">
                <span>Date debut</span>
                <input className="input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              </label>
              <label className="field-block">
                <span>Date fin</span>
                <input className="input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </label>
            </div>
          </div>

          <div className="card">
            <div className="panel-heading">
              <div>
                <h2>Ventes validees</h2>
                <p className="muted">Recherchez puis selectionnez la vente source du dossier.</p>
              </div>
            </div>

            {query.isError ? (
              <div className="error-state">
                <p>{apiErrorMessage(query.error)}</p>
                <button className="ghost-button compact-button" type="button" onClick={() => query.refetch()}>Reessayer</button>
              </div>
            ) : (
              <FloatingSearchPopover
                value={search}
                onChange={setSearch}
                onOpen={() => void 0}
                onClose={() => void 0}
                onSelect={(sale) => create.mutate(sale.saleId)}
                open
                placeholder="Scanner ou rechercher une vente validee..."
                searchPlaceholder="Rechercher une vente, un client, un site..."
                suggestions={filteredSales}
                getKey={(sale) => sale.saleId}
                columns={[
                  { header: 'Vente', render: (sale) => sale.saleNumber },
                  { header: 'Date', render: (sale) => formatDate(sale.saleDate) },
                  { header: 'Client', render: (sale) => sale.customerName || sale.organizationName || 'Comptoir' },
                  { header: 'Site', render: (sale) => sale.siteName ?? '-' },
                  { header: 'Total', render: (sale) => formatMoney(sale.totalAmount, sale.currencyCode ?? 'USD', sale.currencySymbol) },
                  { header: 'Statut', render: (sale) => <span className={`badge ${customerReturnStatusClass(sale.status)}`}>{customerReturnStatusLabel(sale.status)}</span> },
                ]}
                footerLabel="Entree pour creer le dossier - Echap pour fermer"
                maxVisible={25}
              />
            )}

            {create.isError ? <p className="form-error">{apiErrorMessage(create.error)}</p> : null}
            {create.isPending ? <p className="loading-state">Creation du dossier...</p> : null}
          </div>
        </>
      )}
    </>
  );
}
