import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../../services/apiError';
import { cashService } from '../../services/cash.service';
import { sitesService } from '../../services/sites.service';
import { formatMoney } from '../../utils/money';

export function CashPage() {
  const queryClient = useQueryClient();
  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const [siteId, setSiteId] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [expenseCategory, setExpenseCategory] = useState('Frais caisse');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [countedClosingBalance, setCountedClosingBalance] = useState('');
  const selectedSiteId = siteId || sites.data?.[0]?.siteId || '';

  const current = useQuery({
    queryKey: ['cash-current', selectedSiteId],
    queryFn: async () => (await cashService.getCurrentSession(selectedSiteId || undefined)).data,
    enabled: Boolean(selectedSiteId),
  });
  const sessions = useQuery({ queryKey: ['cash-sessions'], queryFn: async () => (await cashService.getSessions()).data });
  const movements = useQuery({
    queryKey: ['cash-movements', current.data?.cashSessionId],
    queryFn: async () => (await cashService.getMovements(current.data?.cashSessionId)).data,
    enabled: Boolean(current.data?.cashSessionId),
  });

  const totals = useMemo(() => {
    const rows = movements.data ?? [];
    const cashIn = rows.filter((m) => ['SALE_PAYMENT', 'CASH_IN', 'RECEIVABLE_PAYMENT', 'ADVANCE', 'ADJUSTMENT'].includes(m.movementType)).reduce((sum, m) => sum + m.amount, 0);
    const cashOut = rows.filter((m) => ['EXPENSE', 'CASH_OUT', 'BANK_DEPOSIT'].includes(m.movementType)).reduce((sum, m) => sum + m.amount, 0);
    const expected = (current.data?.openingBalance ?? 0) + cashIn - cashOut;
    return { cashIn, cashOut, expected, difference: countedClosingBalance ? Number(countedClosingBalance) - expected : 0 };
  }, [countedClosingBalance, current.data?.openingBalance, movements.data]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['cash-current'] });
    queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
  }

  const open = useMutation({
    mutationFn: () => cashService.openSession({ siteId: selectedSiteId, openingBalance: Number(openingBalance) }),
    onSuccess: refresh,
  });
  const expense = useMutation({
    mutationFn: () => cashService.createExpense({ cashSessionId: current.data?.cashSessionId, expenseCategory, description: expenseDescription, amount: Number(expenseAmount) }),
    onSuccess: () => {
      setExpenseDescription('');
      setExpenseAmount('');
      refresh();
    },
  });
  const close = useMutation({
    mutationFn: () => cashService.closeSession(current.data!.cashSessionId, { countedClosingBalance: Number(countedClosingBalance) }),
    onSuccess: () => {
      setCountedClosingBalance('');
      refresh();
    },
  });

  function submitOpen(event: FormEvent) {
    event.preventDefault();
    if (selectedSiteId) open.mutate();
  }

  function submitExpense(event: FormEvent) {
    event.preventDefault();
    if (current.data?.cashSessionId) expense.mutate();
  }

  function submitClose(event: FormEvent) {
    event.preventDefault();
    if (current.data?.cashSessionId) close.mutate();
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Caisse</h1>
          <span>Session, mouvements et cloture</span>
        </div>
      </div>

      <div className="card">
        <div className="form-grid">
          <label>
            Site
            <select className="input" value={selectedSiteId} onChange={(event) => setSiteId(event.target.value)}>
              {(sites.data ?? []).map((site) => (
                <option key={site.siteId} value={site.siteId}>{site.siteName}</option>
              ))}
            </select>
          </label>
          <div>
            Session
            <strong style={{ display: 'block', marginTop: 10 }}>{current.data ? current.data.status : 'Aucune session ouverte'}</strong>
          </div>
          <div>
            Ecart
            <strong style={{ display: 'block', marginTop: 10 }}>{formatMoney(totals.difference, 'USD')}</strong>
          </div>
        </div>
      </div>

      {!current.data && (
        <form className="card form-grid" onSubmit={submitOpen}>
          <label>
            Fond ouverture
            <input className="input" type="number" min="0" step="0.01" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} />
          </label>
          <button className="button" disabled={open.isPending || !selectedSiteId}>Ouvrir caisse</button>
          {open.isError && <p className="form-error">{apiErrorMessage(open.error)}</p>}
        </form>
      )}

      {current.data && (
        <>
          <div className="stats-grid">
            <div className="card"><strong>{formatMoney(current.data.openingBalance, 'USD')}</strong><br />Ouverture</div>
            <div className="card"><strong>{formatMoney(totals.cashIn, 'USD')}</strong><br />Entrees cash</div>
            <div className="card"><strong>{formatMoney(totals.cashOut, 'USD')}</strong><br />Sorties cash</div>
            <div className="card"><strong>{formatMoney(totals.expected, 'USD')}</strong><br />Solde attendu</div>
          </div>

          <form className="card form-grid" onSubmit={submitExpense}>
            <label>
              Categorie
              <input className="input" value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)} />
            </label>
            <label>
              Description
              <input className="input" value={expenseDescription} onChange={(event) => setExpenseDescription(event.target.value)} />
            </label>
            <label>
              Montant
              <input className="input" type="number" min="0.01" step="0.01" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} />
            </label>
            <button className="button" disabled={expense.isPending}>Enregistrer depense</button>
            {expense.isError && <p className="form-error">{apiErrorMessage(expense.error)}</p>}
          </form>

          <form className="card form-grid" onSubmit={submitClose}>
            <label>
              Montant compte
              <input className="input" type="number" min="0" step="0.01" value={countedClosingBalance} onChange={(event) => setCountedClosingBalance(event.target.value)} />
            </label>
            <button className="button" disabled={close.isPending || countedClosingBalance === ''}>Fermer caisse</button>
            {close.isError && <p className="form-error">{apiErrorMessage(close.error)}</p>}
          </form>

          <div className="card">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Type</th><th>Montant</th><th>Devise</th><th>Description</th></tr></thead>
              <tbody>
                {(movements.data ?? []).map((movement) => (
                  <tr key={movement.cashMovementId}>
                    <td>{new Date(movement.movementDate).toLocaleString()}</td>
                    <td>{movement.movementType}</td>
                    <td>{formatMoney(movement.amount, movement.currencyCode ?? 'USD', movement.currencySymbol)}</td>
                    <td>{movement.currencyCode}</td>
                    <td>{movement.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="card">
        <table className="data-table">
          <thead><tr><th>Ouverture</th><th>Site</th><th>Utilisateur</th><th>Statut</th><th>Attendu</th><th>Ecart</th></tr></thead>
          <tbody>
            {(sessions.data ?? []).map((session) => (
              <tr key={session.cashSessionId}>
                <td>{new Date(session.openedAt).toLocaleString()}</td>
                <td>{session.siteName}</td>
                <td>{session.userName}</td>
                <td>{session.status}</td>
                <td>{formatMoney(session.expectedClosingBalance, 'USD')}</td>
                <td>{formatMoney(session.differenceAmount, 'USD')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
