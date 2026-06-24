import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { apiErrorMessage } from '../../services/apiError';
import { referenceService } from '../../services/reference.service';
import { Sale, salesService } from '../../services/sales.service';
import { sitesService } from '../../services/sites.service';
import { formatMoney } from '../../utils/money';

type QuickFilter = 'ALL' | 'DRAFT' | 'VALIDATED' | 'CASH' | 'INSURANCE' | 'TODAY' | 'WEEK' | 'MONTH';

type SaleForm = {
  siteId: string;
  saleType: 'CASH' | 'INSURANCE';
  customerId: string;
  currencyCode: 'USD';
  exchangeRate: string;
};

const filters: Array<{ key: QuickFilter; label: string }> = [
  { key: 'ALL', label: 'Toutes' },
  { key: 'DRAFT', label: 'DRAFT' },
  { key: 'VALIDATED', label: 'VALIDATED' },
  { key: 'CASH', label: 'CASH' },
  { key: 'INSURANCE', label: 'INSURANCE' },
  { key: 'TODAY', label: "Aujourd'hui" },
  { key: 'WEEK', label: 'Cette semaine' },
  { key: 'MONTH', label: 'Ce mois' },
];

const initialForm = (): SaleForm => ({
  siteId: '',
  saleType: 'CASH',
  customerId: '',
  currencyCode: 'USD',
  exchangeRate: '1',
});

function Field({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  return (
    <label className="field-block">
      <span>{label}</span>
      {children}
      <small>{help}</small>
    </label>
  );
}

function badgeForStatus(status: string) {
  if (status === 'VALIDATED') return 'badge-success';
  if (status === 'CANCELLED') return 'badge-muted';
  return 'badge-warning';
}

function badgeForType(type: string) {
  return type === 'INSURANCE' ? 'badge-info' : 'badge-success';
}

function sameDay(value: Date, other: Date) {
  return value.toDateString() === other.toDateString();
}

function startOfWeek(value: Date) {
  const date = new Date(value);
  const day = date.getDay() || 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day + 1);
  return date;
}

function matchesQuickFilter(sale: Sale, filter: QuickFilter) {
  if (filter === 'ALL') return true;
  if (filter === 'DRAFT' || filter === 'VALIDATED') return sale.status === filter;
  if (filter === 'CASH' || filter === 'INSURANCE') return sale.saleType === filter;
  const saleDate = new Date(sale.saleDate);
  const now = new Date();
  if (filter === 'TODAY') return sameDay(saleDate, now);
  if (filter === 'WEEK') return saleDate >= startOfWeek(now);
  if (filter === 'MONTH') return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
  return true;
}

export function SalesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [form, setForm] = useState<SaleForm>(initialForm);

  const sales = useQuery({ queryKey: ['sales'], queryFn: async () => (await salesService.getAll()).data });
  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const customers = useQuery({ queryKey: ['customers'], queryFn: async () => (await referenceService.customers.getAll()).data });
  const detail = useQuery({
    queryKey: ['sale', selectedSaleId],
    enabled: Boolean(selectedSaleId),
    queryFn: async () => (await salesService.getById(selectedSaleId as string)).data,
  });

  const rows = useMemo(() => {
    const filtered = (sales.data ?? []).filter((sale) => matchesQuickFilter(sale, quickFilter));
    return filterRows(filtered, search, (sale) => [
      sale.saleNumber,
      sale.customerName,
      sale.organizationName,
      sale.planName,
      sale.status,
      sale.saleType,
      sale.saleDate,
      sale.totalAmount,
      sale.siteName,
    ]);
  }, [quickFilter, sales.data, search]);

  const create = useMutation({
    mutationFn: async () => (await salesService.create({
      siteId: form.siteId,
      saleType: form.saleType,
      customerId: form.customerId || undefined,
      exchangeRate: Number(form.exchangeRate || 1),
    })).data,
    onSuccess: async (sale) => {
      setCreateOpen(false);
      setForm(initialForm());
      await qc.invalidateQueries({ queryKey: ['sales'] });
      setSelectedSaleId(sale.saleId);
    },
  });

  function update<K extends keyof SaleForm>(key: K, value: SaleForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function closeCreate() {
    if (!create.isPending) {
      setCreateOpen(false);
      setForm(initialForm());
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Ventes</h1>
          <p className="muted">Consultation des ventes, paiements, assurance et facturation.</p>
        </div>
        <button className="button" type="button" onClick={() => setCreateOpen(true)}>+ Nouvelle Vente</button>
      </div>

      <div className="card sales-filters">
        <SearchBox value={search} onChange={setSearch} placeholder="Rechercher numero, client, assurance, statut, date, montant ou site..." />
        <div className="filter-pills" aria-label="Filtres ventes">
          {filters.map((filter) => (
            <button
              className={`filter-pill ${quickFilter === filter.key ? 'active' : ''}`}
              key={filter.key}
              type="button"
              onClick={() => setQuickFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {sales.isLoading ? (
          <p className="loading-state">Chargement des ventes...</p>
        ) : rows.length === 0 ? (
          <p className="empty-state">Aucune vente trouvee pour cette recherche.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table sales-table">
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Site</th>
                  <th>Type</th>
                  <th>Total</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((sale) => (
                  <tr className="clickable-row" key={sale.saleId} onClick={() => setSelectedSaleId(sale.saleId)}>
                    <td><strong>{sale.saleNumber}</strong></td>
                    <td>{new Date(sale.saleDate).toLocaleDateString('fr-FR')}</td>
                    <td>{sale.customerName || 'Comptoir'}</td>
                    <td>{sale.siteName ?? '-'}</td>
                    <td><span className={`badge ${badgeForType(sale.saleType)}`}>{sale.saleType}</span></td>
                    <td>{formatMoney(sale.totalAmount, sale.currencyCode ?? 'USD', sale.currencySymbol)}</td>
                    <td><span className={`badge ${badgeForStatus(sale.status)}`}>{sale.status}</span></td>
                    <td>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedSaleId(sale.saleId);
                        }}
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal title="Nouvelle vente" open={createOpen} onClose={closeCreate}>
        {create.isError && <p className="form-error">{apiErrorMessage(create.error)}</p>}
        <form className="purchase-form" onSubmit={submit}>
          <div className="form-section">
            <h3>Parametres vente</h3>
            <div className="form-grid">
              <Field label="Client" help="Client qui achete les produits. Obligatoire pour une vente assurance.">
                <select className="input" value={form.customerId} onChange={(event) => update('customerId', event.target.value)} required={form.saleType === 'INSURANCE'}>
                  <option value="">Client comptoir</option>
                  {(customers.data ?? []).map((customer) => <option key={customer.customerId} value={customer.customerId}>{customer.customerName}</option>)}
                </select>
              </Field>
              <Field label="Type vente" help="CASH = paiement immediat, INSURANCE = prise en charge assurance.">
                <select className="input" value={form.saleType} onChange={(event) => update('saleType', event.target.value as SaleForm['saleType'])}>
                  <option value="CASH">CASH</option>
                  <option value="INSURANCE">INSURANCE</option>
                </select>
              </Field>
              <Field label="Site" help="Site qui effectue la vente et sortira le stock en FEFO.">
                <select className="input" value={form.siteId} onChange={(event) => update('siteId', event.target.value)} required>
                  <option value="">Choisir un site</option>
                  {(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}
                </select>
              </Field>
              <Field label="Devise" help="Devise utilisee pour cette transaction. USD est la devise de base V1.1.">
                <select className="input" value={form.currencyCode} disabled>
                  <option value="USD">USD - Dollar americain</option>
                </select>
              </Field>
              <Field label="Taux de change" help="Obligatoire si la devise n'est pas USD. Pour USD, laissez 1.">
                <input className="input" type="number" min="1" step="0.0001" placeholder="1" value={form.exchangeRate} onChange={(event) => update('exchangeRate', event.target.value)} required />
              </Field>
            </div>
          </div>
          <div className="form-summary">
            <span>Etape suivante</span>
            <strong>Ajoutez les produits dans le POS FEFO</strong>
          </div>
          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={closeCreate} disabled={create.isPending}>Annuler</button>
            <button className="button" disabled={create.isPending || sites.isLoading || customers.isLoading}>
              {create.isPending ? 'Creation...' : 'Creer brouillon'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Detail vente" open={Boolean(selectedSaleId)} onClose={() => setSelectedSaleId(null)}>
        {detail.isLoading || !detail.data ? (
          <p className="loading-state">Chargement du detail vente...</p>
        ) : (
          <SaleDetailModal sale={detail.data} onOpenPos={() => navigate('/pos')} />
        )}
      </Modal>
    </>
  );
}

function SaleDetailModal({ sale, onOpenPos }: { sale: Sale; onOpenPos: () => void }) {
  const currencyCode = sale.currencyCode ?? 'USD';
  const currencySymbol = sale.currencySymbol;
  const items = sale.items ?? [];
  const payments = sale.payments ?? [];
  const subtotal = sale.subtotal ?? items.reduce((sum, item) => sum + Number(item.lineTotal ?? 0), 0);
  const discount = sale.discountAmount ?? 0;
  const receivableStatus = sale.creditAmount > 0 ? (sale.status === 'VALIDATED' ? 'CREEE' : 'A valider') : 'Aucune';

  function printInvoice() {
    window.print();
  }

  return (
    <div className="sale-detail">
      <div className="detail-grid">
        <div><span>Numero vente</span><strong>{sale.saleNumber}</strong></div>
        <div><span>Date</span><strong>{new Date(sale.saleDate).toLocaleString('fr-FR')}</strong></div>
        <div><span>Client</span><strong>{sale.customerName || 'Comptoir'}</strong></div>
        <div><span>Assurance</span><strong>{sale.organizationName ?? '-'}</strong></div>
        <div><span>Statut</span><strong><span className={`badge ${badgeForStatus(sale.status)}`}>{sale.status}</span></strong></div>
        <div><span>Type</span><strong><span className={`badge ${badgeForType(sale.saleType)}`}>{sale.saleType}</span></strong></div>
        <div><span>Devise</span><strong>{currencyCode}</strong></div>
        <div><span>Taux</span><strong>{sale.exchangeRate ?? 1}</strong></div>
        <div><span>Site</span><strong>{sale.siteName ?? '-'}</strong></div>
      </div>

      {sale.saleType === 'INSURANCE' && (
        <div className="stats-grid insurance-cards">
          <div className="card kpi-card"><span className="kpi-label">Plan assurance</span><p className="metric small-metric">{sale.planName ?? '-'}</p></div>
          <div className="card kpi-card"><span className="kpi-label">Couverture</span><p className="metric small-metric">{sale.coveragePercent ?? 0}%</p></div>
          <div className="card kpi-card"><span className="kpi-label">Montant couvert</span><p className="metric small-metric">{formatMoney(sale.insuranceCoveredAmount, currencyCode, currencySymbol)}</p></div>
          <div className="card kpi-card"><span className="kpi-label">Montant patient</span><p className="metric small-metric">{formatMoney(sale.customerPayableAmount, currencyCode, currencySymbol)}</p></div>
        </div>
      )}

      <section className="detail-section">
        <h3>Produits</h3>
        {items.length === 0 ? (
          <p className="empty-state">Aucun produit. Ouvrez le POS pour ajouter les lignes FEFO.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Article</th><th>Quantite</th><th>Prix unitaire</th><th>Total</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.saleItemId}>
                    <td>{item.commercialName ?? '-'}</td>
                    <td>{item.quantity}</td>
                    <td>{formatMoney(item.unitPrice, currencyCode, currencySymbol)}</td>
                    <td>{formatMoney(item.lineTotal, currencyCode, currencySymbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="detail-section">
        <h3>Historique des paiements</h3>
        {payments.length === 0 ? (
          <p className="empty-state">Aucun paiement enregistre pour cette vente.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Montant</th><th>Devise</th><th>Mode paiement</th><th>Utilisateur</th></tr></thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.paymentId}>
                    <td>{new Date(payment.paymentDate).toLocaleString('fr-FR')}</td>
                    <td>{formatMoney(payment.amount, payment.currencyCode ?? currencyCode, payment.currencySymbol ?? currencySymbol)}</td>
                    <td>{payment.currencyCode ?? currencyCode}</td>
                    <td>{payment.methodName}</td>
                    <td>{payment.receivedByName ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="detail-grid">
        <div><span>Sous-total</span><strong>{formatMoney(subtotal, currencyCode, currencySymbol)}</strong></div>
        <div><span>Remise</span><strong>{formatMoney(discount, currencyCode, currencySymbol)}</strong></div>
        <div><span>Quote-part assurance</span><strong>{formatMoney(sale.insuranceCoveredAmount, currencyCode, currencySymbol)}</strong></div>
        <div><span>Quote-part patient</span><strong>{formatMoney(sale.customerPayableAmount, currencyCode, currencySymbol)}</strong></div>
        <div><span>Creance</span><strong>{formatMoney(sale.creditAmount, currencyCode, currencySymbol)} - {receivableStatus}</strong></div>
        <div><span>Total</span><strong>{formatMoney(sale.totalAmount, currencyCode, currencySymbol)}</strong></div>
      </div>

      <div className="modal-actions">
        {sale.status === 'DRAFT' && <button className="ghost-button" type="button" onClick={onOpenPos}>Continuer dans POS</button>}
        <button className="button" type="button" onClick={printInvoice}>Imprimer Facture</button>
      </div>
    </div>
  );
}
