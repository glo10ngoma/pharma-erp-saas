import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { apiErrorMessage } from '../../services/apiError';
import { insuranceService, Receivable } from '../../services/insurance.service';
import { reportsService } from '../../services/reports.service';
import { salesService } from '../../services/sales.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import { ReportActions, ReportColumn, ReportFiltersBar, ReportKpiCards, ReportPageShell, ReportPreview } from '../reports/report-ui';

type Row = Record<string, string | number | null | undefined>;
type BatchStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'PAID';
type DisputeStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

type InsuranceBatch = {
  id: string;
  number: string;
  organizationName: string;
  from: string;
  to: string;
  receivableIds: string[];
  amount: number;
  invoices: number;
  status: BatchStatus;
  createdAt: string;
};

type InsuranceDispute = {
  id: string;
  receivableId: string;
  type: string;
  status: DisputeStatus;
  comment: string;
  createdAt: string;
};

const batchesKey = 'pharmaerp.insuranceBatches.v2';
const disputesKey = 'pharmaerp.insuranceDisputes.v2';

const receivableColumns: ReportColumn<Row>[] = [
  { key: 'invoiceNumber', label: 'N' },
  { key: 'issueDate', label: 'Date', render: (row) => formatDate(String(row.issueDate || '')) },
  { key: 'customer', label: 'Client' },
  { key: 'organization', label: 'Organisation' },
  { key: 'sale', label: 'Vente' },
  { key: 'site', label: 'Site' },
  { key: 'amountDue', label: 'Montant', align: 'right', render: (row) => money(Number(row.amountDue || 0), String(row.currencyCode || 'USD')) },
  { key: 'amountPaid', label: 'Paye', align: 'right', render: (row) => money(Number(row.amountPaid || 0), String(row.currencyCode || 'USD')) },
  { key: 'balance', label: 'Solde', align: 'right', render: (row) => money(Number(row.balance || 0), String(row.currencyCode || 'USD')) },
  { key: 'dueDate', label: 'Echeance', render: (row) => formatDate(String(row.dueDate || '')) },
  { key: 'age', label: 'Anciennete', align: 'right' },
  { key: 'status', label: 'Statut', align: 'center' },
];

export function InsuranceDashboardPage() {
  const receivables = useQuery({ queryKey: ['insurance-v2', 'receivables'], queryFn: async () => (await insuranceService.receivables.getAll()).data });
  const memberships = useQuery({ queryKey: ['insurance-v2', 'memberships'], queryFn: async () => (await insuranceService.memberships.getAll()).data });
  const sales = useQuery({ queryKey: ['insurance-v2', 'sales'], queryFn: async () => (await salesService.getAll()).data });
  const report = useQuery({ queryKey: ['insurance-v2', 'report-receivables'], queryFn: async () => (await reportsService.receivables()).data });
  const rows = receivables.data ?? [];
  const insuranceSales = (sales.data ?? []).filter((sale) => sale.saleType === 'INSURANCE');
  const paidMonth = rows.filter((row) => isThisMonth(row.createdAt || row.issueDate)).reduce((total, row) => total + row.amountPaid, 0);
  const due = rows.reduce((total, row) => total + row.amountDue, 0);
  const paid = rows.reduce((total, row) => total + row.amountPaid, 0);
  const byOrganization = groupRows(rows, (row) => row.organizationName || 'Non renseigne', (row) => row.balance);
  const aging = agingBuckets(rows);

  return (
    <InsuranceShell title="Dashboard Assurance" description="Pilotage du cycle vente assurance, creance, paiement et recouvrement.">
      <ReportKpiCards cards={[
        { label: 'Creances ouvertes', value: String(rows.filter((row) => row.status !== 'PAID').length), tone: 'warning' },
        { label: 'Creances echues', value: String(rows.filter((row) => ageDays(row.dueDate || row.issueDate) > 0 && row.balance > 0).length), tone: 'danger' },
        { label: 'Montant a recevoir', value: money(rows.reduce((total, row) => total + row.balance, 0)) },
        { label: 'Montant recu ce mois', value: money(paidMonth), tone: 'success' },
        { label: 'Taux recouvrement', value: percent(due ? paid / due * 100 : 0) },
        { label: 'Assures actifs', value: String((memberships.data ?? []).filter((row) => row.isActive).length) },
        { label: 'Ventes assurance', value: String(insuranceSales.length) },
        { label: 'Paiement moyen', value: money(rows.length ? paid / rows.length : 0) },
      ]} />
      <section className="insurance-chart-grid">
        <SimpleBars title="Creances par assurance" rows={byOrganization} />
        <SimpleBars title="Creances par anciennete" rows={aging} />
        <SimpleBars title="Top assurances" rows={byOrganization.slice(0, 6)} />
        <div className="card"><h2>Alertes</h2><div className="insurance-alert-list">{insuranceAlerts(rows, readBatches(), readDisputes()).map((alert) => <span className={`insurance-alert ${alert.tone}`} key={alert.text}>{alert.text}</span>)}</div></div>
      </section>
      <ReportPreview title="Synthese creances" rows={(report.data ?? []).map(toReportRow)} columns={[
        { key: 'type', label: 'Type' }, { key: 'status', label: 'Statut' }, { key: 'amountDue', label: 'Du', align: 'right' }, { key: 'amountPaid', label: 'Paye', align: 'right' }, { key: 'balance', label: 'Solde', align: 'right' },
      ]} />
    </InsuranceShell>
  );
}

export function InsuranceReceivablesV2Page() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const query = useQuery({ queryKey: ['insurance-v2', 'receivables'], queryFn: async () => (await insuranceService.receivables.getAll()).data });
  const rows = useMemo(() => receivableRows(query.data ?? []).filter((row) => filterRow(row, search, status)), [query.data, search, status]);
  return (
    <InsuranceShell title="Creances Assurance" description="Suivi detaille des creances, echeances, anciennete et paiements.">
      <ReportFiltersBar><input className="input" placeholder="Recherche client, assurance, facture..." value={search} onChange={(event) => setSearch(event.target.value)} /><select className="input compact-input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tous statuts</option><option value="OPEN">OPEN</option><option value="PARTIALLY_PAID">PARTIALLY_PAID</option><option value="PAID">PAID</option><option value="OVERDUE">OVERDUE</option></select><ReportActions filename="assurance_creances" sheetName="Creances" rows={rows} columns={receivableColumns} /></ReportFiltersBar>
      <ReportKpiCards cards={[{ label: 'Creances', value: String(rows.length) }, { label: 'Solde', value: money(sum(rows, 'balance')), tone: sum(rows, 'balance') > 0 ? 'warning' : 'success' }, { label: '>30 jours', value: String(rows.filter((row) => Number(row.age) > 30).length), tone: 'warning' }, { label: '>90 jours', value: String(rows.filter((row) => Number(row.age) > 90).length), tone: 'danger' }]} />
      <ReportPreview title="Creances Assurance" rows={rows} columns={receivableColumns} totals={<span>Solde : <strong>{money(sum(rows, 'balance'))}</strong></span>} />
    </InsuranceShell>
  );
}

export function InsuranceBatchesPage() {
  const [batches, setBatches] = useState<InsuranceBatch[]>(() => readBatches());
  const [modalOpen, setModalOpen] = useState(false);
  const [organization, setOrganization] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const receivables = useQuery({ queryKey: ['insurance-v2', 'receivables'], queryFn: async () => (await insuranceService.receivables.getAll()).data });
  const candidates = (receivables.data ?? []).filter((row) => row.status !== 'PAID' && (!organization || row.organizationName === organization) && (!from || (row.issueDate || '') >= from) && (!to || (row.issueDate || '') <= to));
  const organizations = unique((receivables.data ?? []).map((row) => row.organizationName || 'Non renseigne'));
  const rows: Row[] = batches.map((batch) => ({
    number: batch.number,
    organizationName: batch.organizationName,
    from: batch.from,
    to: batch.to,
    receivables: batch.invoices,
    amountText: money(batch.amount),
    status: batch.status,
  }));

  function saveBatch(event: FormEvent) {
    event.preventDefault();
    const next: InsuranceBatch = { id: crypto.randomUUID(), number: `BORD-${Date.now()}`, organizationName: organization || 'Toutes organisations', from, to, receivableIds: candidates.map((row) => row.receivableId), amount: candidates.reduce((total, row) => total + row.balance, 0), invoices: candidates.length, status: 'DRAFT', createdAt: new Date().toISOString() };
    const updated = [next, ...batches];
    setBatches(updated);
    writeBatches(updated);
    setModalOpen(false);
  }

  function setStatus(id: string, status: BatchStatus) {
    const updated = batches.map((batch) => batch.id === id ? { ...batch, status } : batch);
    setBatches(updated);
    writeBatches(updated);
  }

  return (
    <InsuranceShell title="Bordereaux Assurance" description="Creation, impression, envoi et suivi des bordereaux assurance.">
      <ReportFiltersBar><button className="button compact-button" onClick={() => setModalOpen(true)}>Creer bordereau</button><ReportActions filename="assurance_bordereaux" sheetName="Bordereaux" rows={rows} columns={batchColumns} /></ReportFiltersBar>
      <ReportKpiCards cards={[{ label: 'Bordereaux', value: String(batches.length) }, { label: 'Non envoyes', value: String(batches.filter((b) => b.status === 'DRAFT').length), tone: 'warning' }, { label: 'Montant', value: money(batches.reduce((total, batch) => total + batch.amount, 0)) }]} />
      <ReportPreview title="Bordereaux Assurance" rows={rows} columns={batchColumns} />
      <div className="card table-card"><div className="table-wrap"><table className="data-table"><thead><tr><th>Numero</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{batches.map((batch) => <tr key={batch.id}><td>{batch.number}</td><td>{batch.status}</td><td><button className="ghost-button compact-button" onClick={() => window.print()}>Imprimer</button><button className="ghost-button compact-button" onClick={() => setStatus(batch.id, 'SENT')}>Marquer envoye</button><button className="ghost-button compact-button" onClick={() => setStatus(batch.id, 'RECEIVED')}>Marquer recu</button></td></tr>)}</tbody></table></div></div>
      <Modal title="Nouveau bordereau" open={modalOpen} onClose={() => setModalOpen(false)}><form className="form-grid reference-form" onSubmit={saveBatch}><label><span>Organisation</span><select className="input" value={organization} onChange={(e) => setOrganization(e.target.value)}><option value="">Toutes</option>{organizations.map((org) => <option key={org} value={org}>{org}</option>)}</select></label><label><span>Du</span><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label><span>Au</span><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label><div className="card compact-card"><strong>{candidates.length} facture(s)</strong><p>{money(candidates.reduce((total, row) => total + row.balance, 0))}</p></div><div className="modal-actions"><button className="ghost-button compact-button" type="button" onClick={() => setModalOpen(false)}>Annuler</button><button className="button compact-button">Creer</button></div></form></Modal>
    </InsuranceShell>
  );
}

export function InsurancePaymentsPage() {
  const qc = useQueryClient();
  const [organization, setOrganization] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const receivables = useQuery({ queryKey: ['insurance-v2', 'receivables'], queryFn: async () => (await insuranceService.receivables.getAll()).data });
  const pay = useMutation({
    mutationFn: async () => allocatePayment((receivables.data ?? []).filter((row) => row.status !== 'PAID' && (!organization || row.organizationName === organization)), Number(amount), reference, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance-v2', 'receivables'] }),
  });
  const open = (receivables.data ?? []).filter((row) => row.status !== 'PAID');
  const organizations = unique(open.map((row) => row.organizationName || 'Non renseigne'));
  const allocation = previewAllocation(open.filter((row) => !organization || row.organizationName === organization), Number(amount || 0));
  return (
    <InsuranceShell title="Paiements Assurance" description="Enregistrer un paiement assurance et le repartir sur les creances ouvertes les plus anciennes.">
      {pay.isError && <p className="form-error">{apiErrorMessage(pay.error)}</p>}
      <form className="card form-grid reference-form" onSubmit={(event) => { event.preventDefault(); pay.mutate(); }}>
        <label><span>Organisation</span><select className="input" value={organization} onChange={(e) => setOrganization(e.target.value)}><option value="">Toutes</option>{organizations.map((org) => <option key={org} value={org}>{org}</option>)}</select></label>
        <label><span>Montant</span><input className="input" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
        <label><span>Reference</span><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Virement, bordereau..." /></label>
        <label><span>Observation</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note paiement" /></label>
        <button className="button compact-button" disabled={pay.isPending || Number(amount) <= 0}>Repartir et enregistrer</button>
      </form>
      <ReportPreview title="Repartition previsionnelle" rows={allocation.map(toPaymentPreview)} columns={[{ key: 'invoice', label: 'Facture' }, { key: 'organization', label: 'Organisation' }, { key: 'amount', label: 'Montant affecte', align: 'right' }]} />
    </InsuranceShell>
  );
}

export function InsuranceDisputesPage() {
  const [disputes, setDisputes] = useState<InsuranceDispute[]>(() => readDisputes());
  const [modalOpen, setModalOpen] = useState(false);
  const [receivableId, setReceivableId] = useState('');
  const [type, setType] = useState('Facture refusee');
  const [comment, setComment] = useState('');
  const receivables = useQuery({ queryKey: ['insurance-v2', 'receivables'], queryFn: async () => (await insuranceService.receivables.getAll()).data });
  const rows = disputes.map((dispute) => ({ ...dispute, receivable: receivables.data?.find((r) => r.receivableId === dispute.receivableId)?.invoiceNumber || dispute.receivableId }));
  function create(event: FormEvent) { event.preventDefault(); const next = [{ id: crypto.randomUUID(), receivableId, type, comment, status: 'OPEN' as const, createdAt: new Date().toISOString() }, ...disputes]; setDisputes(next); writeDisputes(next); setModalOpen(false); }
  function close(id: string) { const next = disputes.map((d) => d.id === id ? { ...d, status: 'CLOSED' as const } : d); setDisputes(next); writeDisputes(next); }
  return <InsuranceShell title="Litiges Assurance" description="Suivi des factures refusees, erreurs et commentaires."><ReportFiltersBar><button className="button compact-button" onClick={() => setModalOpen(true)}>Creer litige</button><ReportActions filename="assurance_litiges" sheetName="Litiges" rows={rows} columns={disputeColumns} /></ReportFiltersBar><ReportPreview title="Litiges" rows={rows} columns={disputeColumns} /><div className="card table-card"><div className="table-wrap"><table className="data-table"><tbody>{disputes.map((d) => <tr key={d.id}><td>{d.type}</td><td>{d.status}</td><td><button className="ghost-button compact-button" onClick={() => close(d.id)}>Clore</button></td></tr>)}</tbody></table></div></div><Modal title="Nouveau litige" open={modalOpen} onClose={() => setModalOpen(false)}><form className="form-grid reference-form" onSubmit={create}><label><span>Creance</span><select className="input" value={receivableId} onChange={(e) => setReceivableId(e.target.value)} required><option value="">Choisir</option>{(receivables.data ?? []).map((r) => <option key={r.receivableId} value={r.receivableId}>{r.invoiceNumber || r.receivableId} - {r.customerName}</option>)}</select></label><label><span>Type</span><select className="input" value={type} onChange={(e) => setType(e.target.value)}><option>Facture refusee</option><option>Medicament refuse</option><option>Montant refuse</option><option>Erreur quantite</option><option>Autre</option></select></label><label><span>Commentaire</span><input className="input" value={comment} onChange={(e) => setComment(e.target.value)} /></label><div className="modal-actions"><button className="button compact-button">Creer</button></div></form></Modal></InsuranceShell>;
}

export function InsuranceRemindersPage() {
  const receivables = useQuery({ queryKey: ['insurance-v2', 'receivables'], queryFn: async () => (await insuranceService.receivables.getAll()).data });
  const rows = receivableRows(receivables.data ?? []).filter((row) => Number(row.age) >= 30).map((row) => ({ ...row, reminder: Number(row.age) >= 90 ? 'Relance critique' : Number(row.age) >= 60 ? 'Relance importante' : 'Relance simple' }));
  return <InsuranceShell title="Relances Assurance" description="Relances automatiques 30, 60 et 90 jours."><ReportActions filename="assurance_relances" sheetName="Relances" rows={rows} columns={[...receivableColumns, { key: 'reminder', label: 'Relance' }]} /><ReportPreview title="Relances" rows={rows} columns={[...receivableColumns, { key: 'reminder', label: 'Relance' }]} /></InsuranceShell>;
}

export function InsuranceHistoryPage() {
  const [search, setSearch] = useState('');
  const receivables = useQuery({ queryKey: ['insurance-v2', 'receivables'], queryFn: async () => (await insuranceService.receivables.getAll()).data });
  const sales = useQuery({ queryKey: ['insurance-v2', 'sales'], queryFn: async () => (await salesService.getAll()).data });
  const rows = [...(receivables.data ?? []).map((r) => ({ date: r.issueDate || r.createdAt, type: 'Creance', actor: r.customerName || '-', organization: r.organizationName || '-', amount: r.amountDue, status: r.status })), ...(sales.data ?? []).filter((s) => s.saleType === 'INSURANCE').map((s) => ({ date: s.saleDate, type: 'Vente assurance', actor: s.customerName || '-', organization: s.organizationName || '-', amount: s.totalAmount, status: s.status }))].filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return <InsuranceShell title="Historique Assurance" description="Chronologie assure : ventes, creances, paiements, litiges et bordereaux connus."><ReportFiltersBar><input className="input" placeholder="Rechercher client, assurance..." value={search} onChange={(e) => setSearch(e.target.value)} /><ReportActions filename="assurance_historique" sheetName="Historique" rows={rows} columns={historyColumns} /></ReportFiltersBar><ReportPreview title="Historique Assurance" rows={rows} columns={historyColumns} /></InsuranceShell>;
}

function InsuranceShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <ReportPageShell title={title} description={description}>{children}</ReportPageShell>;
}

function SimpleBars({ title, rows }: { title: string; rows: Row[] }) {
  return <div className="card insurance-chart-card"><h2>{title}</h2><div className="insurance-simple-bars">{rows.slice(0, 8).map((row) => <div key={String(row.name)}><span>{row.name}</span><strong>{money(Number(row.value || 0))}</strong></div>)}</div></div>;
}

function receivableRows(rows: Receivable[]): Row[] {
  return rows.map((row) => ({ invoiceNumber: row.invoiceNumber || row.receivableId.slice(0, 8), issueDate: row.issueDate || row.createdAt || '', customer: row.customerName || '-', organization: row.organizationName || '-', sale: row.saleId || '-', site: '-', amountDue: row.amountDue, amountPaid: row.amountPaid, balance: row.balance, currencyCode: row.currencyCode || 'USD', dueDate: row.dueDate || '', age: ageDays(row.dueDate || row.issueDate || row.createdAt), status: row.status }));
}

function filterRow(row: Row, search: string, status: string) {
  if (status && row.status !== status) return false;
  if (!search.trim()) return true;
  return JSON.stringify(row).toLowerCase().includes(search.trim().toLowerCase());
}

function previewAllocation(receivables: Receivable[], amount: number) {
  let remaining = amount;
  return [...receivables].sort((a, b) => String(a.dueDate || a.issueDate).localeCompare(String(b.dueDate || b.issueDate))).map((row) => {
    const allocated = Math.min(remaining, row.balance);
    remaining -= allocated;
    return { ...row, allocated: Math.max(allocated, 0) };
  }).filter((row) => row.allocated > 0);
}

async function allocatePayment(receivables: Receivable[], amount: number, reference: string, notes: string) {
  const allocation = previewAllocation(receivables, amount);
  for (const row of allocation) {
    await insuranceService.receivables.pay(row.receivableId, { amount: row.allocated, referencePayment: reference || undefined, notes: notes || undefined });
  }
  return allocation;
}

function toPaymentPreview(row: Receivable & { allocated: number }): Row {
  return { invoice: row.invoiceNumber || row.receivableId.slice(0, 8), organization: row.organizationName || '-', amount: money(row.allocated, row.currencyCode || 'USD') };
}

function toReportRow(row: Record<string, unknown>): Row {
  return { type: String(row.receivableType || '-'), status: String(row.status || '-'), amountDue: money(Number(row.amountDue || 0)), amountPaid: money(Number(row.amountPaid || 0)), balance: money(Number(row.balance || 0)) };
}

function groupRows<T>(rows: T[], key: (row: T) => string, value: (row: T) => number): Row[] {
  const map = new Map<string, number>();
  rows.forEach((row) => map.set(key(row), (map.get(key(row)) || 0) + value(row)));
  return Array.from(map.entries()).map(([name, amount]) => ({ name, value: amount })).sort((a, b) => Number(b.value) - Number(a.value));
}

function agingBuckets(rows: Receivable[]): Row[] {
  const buckets = { '0-30j': 0, '31-60j': 0, '61-90j': 0, '+90j': 0 };
  rows.forEach((row) => { const age = ageDays(row.dueDate || row.issueDate); if (age <= 30) buckets['0-30j'] += row.balance; else if (age <= 60) buckets['31-60j'] += row.balance; else if (age <= 90) buckets['61-90j'] += row.balance; else buckets['+90j'] += row.balance; });
  return Object.entries(buckets).map(([name, value]) => ({ name, value }));
}

function insuranceAlerts(receivables: Receivable[], batches: InsuranceBatch[], disputes: InsuranceDispute[]) {
  return [
    { text: `${receivables.filter((r) => ageDays(r.dueDate || r.issueDate) > 30 && r.balance > 0).length} creance(s) >30 jours`, tone: 'warning' },
    { text: `${receivables.filter((r) => ageDays(r.dueDate || r.issueDate) > 90 && r.balance > 0).length} creance(s) >90 jours`, tone: 'danger' },
    { text: `${disputes.filter((d) => d.status !== 'CLOSED').length} litige(s) ouverts`, tone: 'warning' },
    { text: `${batches.filter((b) => b.status === 'DRAFT').length} bordereau(x) non envoyes`, tone: 'warning' },
  ];
}

const batchColumns: ReportColumn<Row>[] = [
  { key: 'number', label: 'Numero' }, { key: 'organizationName', label: 'Organisation' }, { key: 'from', label: 'Du', render: (row) => formatDate(String(row.from || '')) }, { key: 'to', label: 'Au', render: (row) => formatDate(String(row.to || '')) }, { key: 'receivables', label: 'Factures', align: 'right' }, { key: 'amountText', label: 'Montant', align: 'right' }, { key: 'status', label: 'Statut', align: 'center' },
];
const disputeColumns: ReportColumn<Row>[] = [
  { key: 'createdAt', label: 'Date', render: (row) => formatDate(String(row.createdAt || '')) }, { key: 'receivable', label: 'Creance' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Statut' }, { key: 'comment', label: 'Commentaire' },
];
const historyColumns: ReportColumn<Row>[] = [
  { key: 'date', label: 'Date', render: (row) => formatDate(String(row.date || '')) }, { key: 'type', label: 'Type' }, { key: 'actor', label: 'Client' }, { key: 'organization', label: 'Assurance' }, { key: 'amount', label: 'Montant', align: 'right', render: (row) => money(Number(row.amount || 0)) }, { key: 'status', label: 'Statut' },
];

function readBatches(): InsuranceBatch[] { return readLocal(batchesKey); }
function writeBatches(rows: InsuranceBatch[]) { localStorage.setItem(batchesKey, JSON.stringify(rows)); }
function readDisputes(): InsuranceDispute[] { return readLocal(disputesKey); }
function writeDisputes(rows: InsuranceDispute[]) { localStorage.setItem(disputesKey, JSON.stringify(rows)); }
function readLocal<T>(key: string): T[] { try { return JSON.parse(localStorage.getItem(key) || '[]') as T[]; } catch { return []; } }
function unique(rows: string[]) { return Array.from(new Set(rows)).filter(Boolean).sort(); }
function sum(rows: Row[], key: string) { return rows.reduce((total, row) => total + Number(row[key] || 0), 0); }
function ageDays(date?: string | null) { if (!date) return 0; const start = new Date(date); if (Number.isNaN(start.getTime())) return 0; return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000)); }
function isThisMonth(date?: string | null) { if (!date) return false; const current = new Date(); const value = new Date(date); return value.getMonth() === current.getMonth() && value.getFullYear() === current.getFullYear(); }
function money(value: number, currency = 'USD') { return formatMoney(value, currency); }
function percent(value: number) { return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0)} %`; }
