import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../../services/apiError';
import { accountingService } from '../../services/accounting.service';
import { FinanceExportActions, FinanceKpis, financeText } from './accounting-ui';

export function AccountsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ accountCode: '', accountName: '', accountType: 'ASSET' });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const query = useQuery({ queryKey: ['accounting-accounts'], queryFn: async () => (await accountingService.getAccounts()).data });
  const create = useMutation({ mutationFn: () => accountingService.createAccount(form), onSuccess: () => { setForm({ accountCode: '', accountName: '', accountType: 'ASSET' }); qc.invalidateQueries({ queryKey: ['accounting-accounts'] }); } });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); create.mutate(); }
  const rows = query.data ?? [];
  const types = useMemo(() => Array.from(new Set(rows.map((row) => row.accountType))).sort(), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const haystack = [row.accountCode, row.accountName, row.accountType].map(financeText).join(' ');
    if (search.trim() && !haystack.includes(search.trim().toLowerCase())) return false;
    if (typeFilter !== 'ALL' && row.accountType !== typeFilter) return false;
    if (activeFilter !== 'ALL' && String(row.isActive) !== activeFilter) return false;
    return true;
  }), [activeFilter, rows, search, typeFilter]);
  const exportRows = [
    ['Code', 'Nom compte', 'Type', 'Parent', 'Actif'],
    ...filteredRows.map((row: any) => [row.accountCode, row.accountName, row.accountType, row.parentAccountId ?? '-', row.isActive ? 'Oui' : 'Non']),
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Plan comptable</h1>
          <p className="muted">Devise comptable interne : USD.</p>
        </div>
        <FinanceExportActions baseName="comptes" sheetName="Comptes" rows={exportRows} jsonData={filteredRows} disabled={filteredRows.length === 0} />
      </div>
      <FinanceKpis items={[
        { label: 'Comptes', value: rows.length },
        { label: 'Actifs', value: rows.filter((row) => row.isActive).length, tone: 'success' },
        { label: 'Types', value: types.length },
      ]} />
      {create.isError && <p className="form-error">{apiErrorMessage(create.error)}</p>}
      <form className="card form-grid finance-create-form" onSubmit={submit}>
        <input className="input compact-input" placeholder="Code compte" value={form.accountCode} onChange={(e) => setForm({ ...form, accountCode: e.target.value })} required />
        <input className="input compact-input" placeholder="Nom compte" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} required />
        <select className="input compact-input" value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}><option value="ASSET">Actif</option><option value="LIABILITY">Passif</option><option value="EQUITY">Capitaux</option><option value="REVENUE">Produit</option><option value="EXPENSE">Charge</option></select>
        <button className="button compact-button" disabled={create.isPending}>Creer compte</button>
      </form>
      <div className="card finance-filters">
        <input className="input compact-input" placeholder="Rechercher code, nom, type..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input compact-input" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="ALL">Tous types</option>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select>
        <select className="input compact-input" value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}><option value="ALL">Tous statuts</option><option value="true">Actifs</option><option value="false">Inactifs</option></select>
      </div>
      <div className="card table-card">
        {query.isLoading ? 'Chargement...' : filteredRows.length === 0 ? <p className="empty-state">Aucun compte trouve.</p> : (
          <div className="table-wrap finance-table-wrap">
            <table className="data-table finance-table">
              <thead><tr><th>Code</th><th>Nom compte</th><th>Type</th><th>Parent</th><th>Actif</th><th>Actions</th></tr></thead>
              <tbody>{filteredRows.map((row: any) => <tr key={row.accountId}><td><strong>{row.accountCode}</strong></td><td>{row.accountName}</td><td>{row.accountType}</td><td>{row.parentAccountId ?? '-'}</td><td><span className={`badge ${row.isActive ? 'badge-success' : 'badge-muted'}`}>{row.isActive ? 'Oui' : 'Non'}</span></td><td><button className="ghost-button compact-button" type="button" disabled>Voir</button></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
