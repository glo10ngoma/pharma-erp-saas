import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../../services/apiError';
import { accountingService } from '../../services/accounting.service';
import { FinanceExportActions, FinanceKpis, financeText } from './accounting-ui';

export function JournalsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ journalCode: '', journalName: '', journalType: 'GENERAL' });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const query = useQuery({ queryKey: ['accounting-journals'], queryFn: async () => (await accountingService.getJournals()).data });
  const create = useMutation({ mutationFn: () => accountingService.createJournal(form), onSuccess: () => { setForm({ journalCode: '', journalName: '', journalType: 'GENERAL' }); qc.invalidateQueries({ queryKey: ['accounting-journals'] }); } });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); create.mutate(); }
  const rows = query.data ?? [];
  const types = useMemo(() => Array.from(new Set(rows.map((row) => row.journalType))).sort(), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const haystack = [row.journalCode, row.journalName, row.journalType].map(financeText).join(' ');
    if (search.trim() && !haystack.includes(search.trim().toLowerCase())) return false;
    if (typeFilter !== 'ALL' && row.journalType !== typeFilter) return false;
    return true;
  }), [rows, search, typeFilter]);
  const exportRows = [
    ['Code', 'Nom journal', 'Type', 'Actif'],
    ...filteredRows.map((row) => [row.journalCode, row.journalName, row.journalType, row.isActive ? 'Oui' : 'Non']),
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Journaux</h1>
          <p className="muted">Journaux comptables V1 : ventes, caisse, banque et operations diverses.</p>
        </div>
        <FinanceExportActions baseName="journaux" sheetName="Journaux" rows={exportRows} jsonData={filteredRows} disabled={filteredRows.length === 0} />
      </div>
      <FinanceKpis items={[
        { label: 'Journaux', value: rows.length },
        { label: 'Actifs', value: rows.filter((row) => row.isActive).length, tone: 'success' },
        { label: 'Types', value: types.length },
      ]} />
      {create.isError && <p className="form-error">{apiErrorMessage(create.error)}</p>}
      <form className="card form-grid finance-create-form" onSubmit={submit}>
        <input className="input compact-input" placeholder="Code journal" value={form.journalCode} onChange={(e) => setForm({ ...form, journalCode: e.target.value })} required />
        <input className="input compact-input" placeholder="Nom journal" value={form.journalName} onChange={(e) => setForm({ ...form, journalName: e.target.value })} required />
        <select className="input compact-input" value={form.journalType} onChange={(e) => setForm({ ...form, journalType: e.target.value })}><option value="SALES">Ventes</option><option value="PURCHASES">Achats</option><option value="CASH">Caisse</option><option value="BANK">Banque</option><option value="GENERAL">OD</option><option value="INVENTORY">Stock</option></select>
        <button className="button compact-button" disabled={create.isPending}>Creer journal</button>
      </form>
      <div className="card finance-filters">
        <input className="input compact-input" placeholder="Rechercher code, nom, type..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input compact-input" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="ALL">Tous types</option>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select>
      </div>
      <div className="card table-card">
        {query.isLoading ? 'Chargement...' : filteredRows.length === 0 ? <p className="empty-state">Aucun journal trouve.</p> : (
          <div className="table-wrap finance-table-wrap">
            <table className="data-table finance-table">
              <thead><tr><th>Code</th><th>Nom journal</th><th>Type</th><th>Actif</th><th>Actions</th></tr></thead>
              <tbody>{filteredRows.map((row) => <tr key={row.journalId}><td><strong>{row.journalCode}</strong></td><td>{row.journalName}</td><td>{row.journalType}</td><td><span className={`badge ${row.isActive ? 'badge-success' : 'badge-muted'}`}>{row.isActive ? 'Oui' : 'Non'}</span></td><td><button className="ghost-button compact-button" type="button" disabled>Voir</button></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
