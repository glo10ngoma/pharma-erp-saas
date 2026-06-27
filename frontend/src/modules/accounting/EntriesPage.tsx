import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../../services/apiError';
import { accountingService, Entry } from '../../services/accounting.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import { balanceBadge, FinanceExportActions, FinanceKpis, financeText, inDateRange, moneyUsd, sourceLabel } from './accounting-ui';

export function EntriesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [journalFilter, setJournalFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [selected, setSelected] = useState<Entry | null>(null);
  const query = useQuery({ queryKey: ['accounting-entries'], queryFn: async () => (await accountingService.getEntries()).data });
  const post = useMutation({ mutationFn: (id: string) => accountingService.postEntry(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting-entries'] }) });
  const rows = query.data ?? [];
  const journals = useMemo(() => Array.from(new Set(rows.map((row) => row.journalCode))).sort(), [rows]);
  const sources = useMemo(() => Array.from(new Set(rows.map((row) => sourceLabel(row.referenceType)))).sort(), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const haystack = [row.entryNumber, row.journalCode, row.description, row.referenceType, row.referenceId, row.status].map(financeText).join(' ');
    if (search.trim() && !haystack.includes(search.trim().toLowerCase())) return false;
    if ((from || to) && !inDateRange(row.entryDate, from, to)) return false;
    if (journalFilter !== 'ALL' && row.journalCode !== journalFilter) return false;
    if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
    if (sourceFilter !== 'ALL' && sourceLabel(row.referenceType) !== sourceFilter) return false;
    return true;
  }), [from, journalFilter, rows, search, sourceFilter, statusFilter, to]);
  const totals = useMemo(() => ({
    debit: filteredRows.reduce((sum, row) => sum + Number(row.totalDebit ?? 0), 0),
    credit: filteredRows.reduce((sum, row) => sum + Number(row.totalCredit ?? 0), 0),
    unbalanced: filteredRows.filter((row) => Math.abs(Number(row.totalDebit ?? 0) - Number(row.totalCredit ?? 0)) >= 0.01).length,
  }), [filteredRows]);
  const exportRows = [
    ['Date', 'Numero ecriture', 'Journal', 'Libelle', 'Source', 'Debit USD', 'Credit USD', 'Statut'],
    ...filteredRows.map((row) => [formatDate(row.entryDate), row.entryNumber, row.journalCode, row.description ?? '-', sourceLabel(row.referenceType), moneyUsd(row.totalDebit), moneyUsd(row.totalCredit), row.status]),
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Ecritures</h1>
          <p className="muted">Toutes les ecritures sont affichees en devise comptable USD.</p>
        </div>
        <FinanceExportActions baseName="ecritures" sheetName="Ecritures" rows={exportRows} jsonData={filteredRows} disabled={filteredRows.length === 0} />
      </div>
      <FinanceKpis items={[
        { label: 'Total debit', value: moneyUsd(totals.debit) },
        { label: 'Total credit', value: moneyUsd(totals.credit) },
        { label: 'Ecart', value: moneyUsd(Math.abs(totals.debit - totals.credit)), tone: Math.abs(totals.debit - totals.credit) < 0.01 ? 'success' : 'danger' },
        { label: 'Desequilibrees', value: totals.unbalanced, tone: totals.unbalanced ? 'danger' : 'success' },
      ]} />
      {post.isError && <p className="form-error">{apiErrorMessage(post.error)}</p>}
      <div className="card finance-filters finance-filters-wide">
        <input className="input compact-input" placeholder="Rechercher numero, libelle, source..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <input className="input compact-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input className="input compact-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <select className="input compact-input" value={journalFilter} onChange={(event) => setJournalFilter(event.target.value)}><option value="ALL">Tous journaux</option>{journals.map((journal) => <option key={journal} value={journal}>{journal}</option>)}</select>
        <select className="input compact-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">Tous statuts</option><option value="POSTED">POSTED</option><option value="DRAFT">DRAFT</option></select>
        <select className="input compact-input" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="ALL">Toutes sources</option>{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select>
      </div>
      <div className="card table-card">
        {query.isLoading ? 'Chargement...' : filteredRows.length === 0 ? <p className="empty-state">Aucune ecriture trouvee.</p> : (
          <div className="table-wrap finance-table-wrap">
            <table className="data-table finance-table">
              <thead><tr><th>Date</th><th>Numero</th><th>Journal</th><th>Libelle</th><th>Source</th><th>Debit</th><th>Credit</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>{filteredRows.map((row) => <tr key={row.entryId} onDoubleClick={() => setSelected(row)}>
                <td>{formatDate(row.entryDate)}</td>
                <td><strong>{row.entryNumber}</strong></td>
                <td>{row.journalCode}</td>
                <td>{row.description ?? '-'}</td>
                <td>{sourceLabel(row.referenceType)}</td>
                <td className="numeric-text">{moneyUsd(row.totalDebit)}</td>
                <td className="numeric-text">{moneyUsd(row.totalCredit)}</td>
                <td><span className={`badge ${row.status === 'POSTED' ? 'badge-success' : 'badge-warning'}`}>{row.status}</span></td>
                <td className="finance-actions"><button className="ghost-button compact-button" type="button" onClick={() => setSelected(row)}>Voir</button>{row.status === 'DRAFT' && <button className="ghost-button compact-button" type="button" disabled={post.isPending} onClick={() => post.mutate(row.entryId)}>Poster</button>}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
      {selected && <EntryDetailModal entry={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function EntryDetailModal({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const debit = Number(entry.totalDebit ?? 0);
  const credit = Number(entry.totalCredit ?? 0);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel finance-detail-modal">
        <div className="modal-header">
          <div>
            <h2>{entry.entryNumber}</h2>
            <p className="muted">{formatDate(entry.entryDate)} - {entry.journalCode} - {sourceLabel(entry.referenceType)}</p>
          </div>
          <button className="ghost-button compact-button" type="button" onClick={onClose}>Fermer</button>
        </div>
        <div className="detail-grid">
          <div><span>Statut</span><strong>{entry.status}</strong></div>
          <div><span>Total debit</span><strong>{moneyUsd(debit)}</strong></div>
          <div><span>Total credit</span><strong>{moneyUsd(credit)}</strong></div>
          <div><span>Controle</span><strong>{balanceBadge(debit, credit)}</strong></div>
        </div>
        <div className="table-wrap">
          <table className="data-table finance-table">
            <thead><tr><th>Compte</th><th>Libelle</th><th>Debit</th><th>Credit</th></tr></thead>
            <tbody>{(entry.lines ?? []).map((line) => <tr key={line.entryLineId}><td><strong>{line.accountCode}</strong><br /><small>{line.accountName}</small></td><td>{line.description ?? entry.description ?? '-'}</td><td className="numeric-text">{formatMoney(line.debit, 'USD')}</td><td className="numeric-text">{formatMoney(line.credit, 'USD')}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
