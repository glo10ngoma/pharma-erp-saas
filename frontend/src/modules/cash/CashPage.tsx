import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../../services/apiError';
import { cashService, CashMovement, CashSession } from '../../services/cash.service';
import { salesService } from '../../services/sales.service';
import { sitesService } from '../../services/sites.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';

type SettlementRow = {
  saleId: string;
  saleNumber: string;
  saleDate: string;
  saleTime: string;
  cashier: string;
  client: string;
  totalAmount: number;
  currencyCode: string;
  currencySymbol?: string | null;
  amountPaidUsd: number;
  amountReturnedUsd: number;
  netReceivedUsd: number;
  amountPaidCdf: number;
  amountReturnedCdf: number;
  netReceivedCdf: number;
  settlementDifferenceUsd: number;
  settlementDifferenceCdf: number;
  settlementDifferenceType: string;
  settlementDifferenceReason: string | null;
  settlementDifferenceNote: string | null;
  exchangeRate: number;
};

type SettlementMetrics = {
  salesWithDifference: number;
  positiveCrumbs: number;
  negativeCrumbs: number;
  netCrumbs: number;
  overpayments: number;
  underpayments: number;
  exchangeRounding: number;
  manualAdjustments: number;
};

export function CashPage() {
  const queryClient = useQueryClient();
  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const [siteId, setSiteId] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [expenseCategory, setExpenseCategory] = useState('Frais caisse');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [countedClosingBalanceUsd, setCountedClosingBalanceUsd] = useState('');
  const [countedClosingBalanceCdf, setCountedClosingBalanceCdf] = useState('');
  const [settlementFilter, setSettlementFilter] = useState('ALL');
  const [settlementDate, setSettlementDate] = useState('');
  const [settlementCashier, setSettlementCashier] = useState('');
  const [settlementSearch, setSettlementSearch] = useState('');
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
  const sales = useQuery({ queryKey: ['sales', 'cash-view'], queryFn: async () => (await salesService.getAll()).data });

  const movementMetrics = useMemo(() => buildMovementMetrics(movements.data ?? [], current.data ?? null), [current.data, movements.data]);

  const settlementRows = useMemo<SettlementRow[]>(() => {
    const sessionSaleIds = new Set(
      (movements.data ?? [])
        .filter((movement) => movement.referenceType === 'SALE' && movement.referenceId)
        .map((movement) => movement.referenceId as string),
    );

    return (sales.data ?? [])
      .filter((sale) => sessionSaleIds.has(sale.saleId) && Math.abs(Number(sale.settlementDifferenceUsd ?? 0)) > 0)
      .map((sale) => {
        const timestamp = sale.validatedAt || sale.saleDate;
        const rate = Number(sale.exchangeRate ?? 1) || 1;
        return {
          saleId: sale.saleId,
          saleNumber: sale.saleNumber,
          saleDate: timestamp,
          saleTime: formatTime(timestamp),
          cashier: current.data?.userName || '-',
          client: sale.customerName ?? 'Client comptoir',
          totalAmount: Number(sale.customerPayableAmount ?? sale.totalAmount ?? 0),
          currencyCode: sale.currencyCode ?? 'USD',
          currencySymbol: sale.currencySymbol,
          amountPaidUsd: Number(sale.amountPaidUsd ?? 0),
          amountReturnedUsd: Number(sale.amountReturnedUsd ?? 0),
          netReceivedUsd: Number(sale.netReceivedUsd ?? 0),
          amountPaidCdf: Number(sale.amountPaidCdf ?? 0),
          amountReturnedCdf: Number(sale.amountReturnedCdf ?? 0),
          netReceivedCdf: Number(sale.netReceivedCdf ?? 0),
          settlementDifferenceUsd: Number(sale.settlementDifferenceUsd ?? 0),
          settlementDifferenceCdf: roundMoney(Number(sale.settlementDifferenceUsd ?? 0) * rate),
          settlementDifferenceType: sale.settlementDifferenceType ?? 'NONE',
          settlementDifferenceReason: sale.settlementDifferenceReason ?? null,
          settlementDifferenceNote: sale.settlementDifferenceNote ?? null,
          exchangeRate: rate,
        };
      });
  }, [current.data?.userName, movements.data, sales.data]);

  const filteredSettlementRows = useMemo(() => {
    const term = settlementSearch.trim().toLowerCase();
    return settlementRows.filter((row) => {
      if (settlementFilter !== 'ALL' && !matchesSettlementFilter(row, settlementFilter)) return false;
      if (settlementDate && row.saleDate.slice(0, 10) !== settlementDate) return false;
      if (settlementCashier && row.cashier !== settlementCashier) return false;
      if (!term) return true;
      return [
        row.saleNumber,
        row.client,
        row.cashier,
        row.settlementDifferenceType,
        row.settlementDifferenceReason ?? '',
        row.settlementDifferenceNote ?? '',
      ].some((value) => value.toLowerCase().includes(term));
    });
  }, [settlementCashier, settlementDate, settlementFilter, settlementRows, settlementSearch]);

  const settlementMetricsUsd = useMemo(() => buildSettlementMetrics(filteredSettlementRows, 'USD'), [filteredSettlementRows]);
  const settlementMetricsCdf = useMemo(() => buildSettlementMetrics(filteredSettlementRows, 'CDF'), [filteredSettlementRows]);
  const cashiers = useMemo(() => Array.from(new Set(settlementRows.map((row) => row.cashier).filter(Boolean))).sort(), [settlementRows]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['cash-current'] });
    queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
    queryClient.invalidateQueries({ queryKey: ['sales', 'cash-view'] });
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
    mutationFn: () => cashService.closeSession(current.data!.cashSessionId, {
      countedClosingBalance: Number(countedClosingBalanceUsd || 0),
      countedClosingBalanceUsd: Number(countedClosingBalanceUsd || 0),
      countedClosingBalanceCdf: Number(countedClosingBalanceCdf || 0),
    }),
    onSuccess: () => {
      setCountedClosingBalanceUsd('');
      setCountedClosingBalanceCdf('');
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
          <span>Session, mouvements, ecarts et cloture multi-devise</span>
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
            Caisse
            <strong style={{ display: 'block', marginTop: 10 }}>{current.data?.registerName || '-'}</strong>
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
            <div className="card">
              <strong>{formatMoney(movementMetrics.expectedUsd, 'USD')}</strong><br />
              Attendu USD
            </div>
            <div className="card">
              <strong>{formatMoney(movementMetrics.expectedCdf, 'CDF')}</strong><br />
              Attendu CDF
            </div>
            <div className="card">
              <strong>{filteredSettlementRows.length}</strong><br />
              Ventes avec ecart
            </div>
            <div className="card">
              <strong>{formatMoney(settlementMetricsUsd.netCrumbs, 'USD')}</strong><br />
              Solde miettes USD
            </div>
            <div className="card">
              <strong>{formatMoney(settlementMetricsCdf.netCrumbs, 'CDF')}</strong><br />
              Solde miettes CDF
            </div>
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
              Montant compte USD
              <input className="input" type="number" min="0" step="0.01" value={countedClosingBalanceUsd} onChange={(event) => setCountedClosingBalanceUsd(event.target.value)} />
            </label>
            <label>
              Montant compte CDF
              <input className="input" type="number" min="0" step="0.01" value={countedClosingBalanceCdf} onChange={(event) => setCountedClosingBalanceCdf(event.target.value)} />
            </label>
            <button className="button" disabled={close.isPending || (countedClosingBalanceUsd === '' && countedClosingBalanceCdf === '')}>Fermer caisse</button>
            {close.isError && <p className="form-error">{apiErrorMessage(close.error)}</p>}
          </form>

          <div className="stats-grid">
            <SettlementBlockCard title="Activite theorique USD" lines={[
              ['Solde initial USD', formatMoney(movementMetrics.openingUsd, 'USD')],
              ['Paiements bruts recus USD', formatMoney(movementMetrics.grossSalePaymentsUsd, 'USD')],
              ['Monnaie rendue USD', formatMoney(movementMetrics.saleChangeUsd, 'USD')],
              ['Net ventes USD', formatMoney(movementMetrics.netSalesUsd, 'USD')],
              ['Depenses USD', formatMoney(movementMetrics.expensesUsd, 'USD')],
              ['Entrees manuelles USD', formatMoney(movementMetrics.manualEntriesUsd, 'USD')],
              ['Sorties manuelles USD', formatMoney(movementMetrics.manualOutputsUsd, 'USD')],
              ['Ajustements USD', formatMoney(movementMetrics.adjustmentsUsd, 'USD')],
              ['Solde attendu USD', formatMoney(movementMetrics.expectedUsd, 'USD')],
            ]} />
            <SettlementBlockCard title="Activite theorique CDF" lines={[
              ['Solde initial CDF', formatMoney(movementMetrics.openingCdf, 'CDF')],
              ['Paiements bruts recus CDF', formatMoney(movementMetrics.grossSalePaymentsCdf, 'CDF')],
              ['Monnaie rendue CDF', formatMoney(movementMetrics.saleChangeCdf, 'CDF')],
              ['Net ventes CDF', formatMoney(movementMetrics.netSalesCdf, 'CDF')],
              ['Depenses CDF', formatMoney(movementMetrics.expensesCdf, 'CDF')],
              ['Entrees manuelles CDF', formatMoney(movementMetrics.manualEntriesCdf, 'CDF')],
              ['Sorties manuelles CDF', formatMoney(movementMetrics.manualOutputsCdf, 'CDF')],
              ['Ajustements CDF', formatMoney(movementMetrics.adjustmentsCdf, 'CDF')],
              ['Solde attendu CDF', formatMoney(movementMetrics.expectedCdf, 'CDF')],
            ]} />
          </div>

          <div className="stats-grid">
            <SettlementBlockCard title="Ecarts de reglement expliques USD" lines={[
              ['Miettes positives', formatMoney(settlementMetricsUsd.positiveCrumbs, 'USD')],
              ['Miettes negatives', formatMoney(settlementMetricsUsd.negativeCrumbs, 'USD')],
              ['Solde net', formatMoney(settlementMetricsUsd.netCrumbs, 'USD')],
              ['Arrondis de conversion', formatMoney(settlementMetricsUsd.exchangeRounding, 'USD')],
              ['Surplus', formatMoney(settlementMetricsUsd.overpayments, 'USD')],
              ['Reglements incomplets', formatMoney(settlementMetricsUsd.underpayments, 'USD')],
              ['Ajustements manuels', formatMoney(settlementMetricsUsd.manualAdjustments, 'USD')],
            ]} />
            <SettlementBlockCard title="Ecarts de reglement expliques CDF" lines={[
              ['Miettes positives', formatMoney(settlementMetricsCdf.positiveCrumbs, 'CDF')],
              ['Miettes negatives', formatMoney(settlementMetricsCdf.negativeCrumbs, 'CDF')],
              ['Solde net', formatMoney(settlementMetricsCdf.netCrumbs, 'CDF')],
              ['Arrondis de conversion', formatMoney(settlementMetricsCdf.exchangeRounding, 'CDF')],
              ['Surplus', formatMoney(settlementMetricsCdf.overpayments, 'CDF')],
              ['Reglements incomplets', formatMoney(settlementMetricsCdf.underpayments, 'CDF')],
              ['Ajustements manuels', formatMoney(settlementMetricsCdf.manualAdjustments, 'CDF')],
            ]} />
          </div>

          <div className="card">
            <p className="muted-text">Ces ecarts sont deja integres dans le solde attendu a travers les montants nets reellement encaisses. Ils ne doivent pas etre ajoutes ni soustraits une seconde fois.</p>
          </div>

          <div className="stats-grid">
            <SettlementBlockCard title="Controle physique USD" lines={[
              ['Montant attendu USD', formatMoney(movementMetrics.expectedUsd, 'USD')],
              ['Montant compte USD', formatMoney(Number(countedClosingBalanceUsd || current.data.countedClosingBalanceUsd || 0), 'USD')],
              ['Ecart physique USD', formatMoney(roundMoney(Number(countedClosingBalanceUsd || current.data.countedClosingBalanceUsd || 0) - movementMetrics.expectedUsd), 'USD')],
            ]} />
            <SettlementBlockCard title="Controle physique CDF" lines={[
              ['Montant attendu CDF', formatMoney(movementMetrics.expectedCdf, 'CDF')],
              ['Montant compte CDF', formatMoney(Number(countedClosingBalanceCdf || current.data.countedClosingBalanceCdf || 0), 'CDF')],
              ['Ecart physique CDF', formatMoney(roundMoney(Number(countedClosingBalanceCdf || current.data.countedClosingBalanceCdf || 0) - movementMetrics.expectedCdf), 'CDF')],
            ]} />
          </div>

          <div className="card">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Type</th><th>Montant</th><th>Devise</th><th>Description</th></tr></thead>
              <tbody>
                {(movements.data ?? []).map((movement) => (
                  <tr key={movement.cashMovementId}>
                    <td>{formatDate(movement.movementDate)} {formatTime(movement.movementDate)}</td>
                    <td>{movement.movementType}</td>
                    <td>{formatMoney(movement.amount, movement.currencyCode ?? 'USD', movement.currencySymbol)}</td>
                    <td>{movement.currencyCode}</td>
                    <td>{movement.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Ecarts de reglement</h2>
            <div className="stats-grid">
              <div className="card"><strong>{settlementMetricsUsd.salesWithDifference}</strong><br />Ventes avec ecart USD</div>
              <div className="card"><strong>{formatMoney(settlementMetricsUsd.netCrumbs, 'USD')}</strong><br />Solde net USD</div>
              <div className="card"><strong>{settlementMetricsUsd.salesWithDifference}</strong><br />Ventes avec ecart CDF</div>
              <div className="card"><strong>{formatMoney(settlementMetricsCdf.netCrumbs, 'CDF')}</strong><br />Solde net CDF</div>
            </div>
            <p className="muted-text">Ces montants correspondent a des ecarts de reglement deja expliques et rattaches a des ventes. Ils ne constituent pas automatiquement un ecart physique de caisse.</p>
            <div className="toolbar" style={{ marginBottom: 12 }}>
              <div className="report-actions" style={{ width: '100%' }}>
                <select className="input compact-input" value={settlementFilter} onChange={(event) => setSettlementFilter(event.target.value)}>
                  <option value="ALL">Tous</option>
                  <option value="ROUNDING">Arrondis / miettes</option>
                  <option value="EXCHANGE_ROUNDING">Arrondis de conversion</option>
                  <option value="OVERPAYMENT">Surplus</option>
                  <option value="UNDERPAYMENT">Reglements incomplets</option>
                  <option value="ADJUSTMENT_CHANGE">Ajustements de monnaie</option>
                  <option value="MANUAL_ADJUSTMENT">Ajustements manuels</option>
                  <option value="OTHER">Autres</option>
                </select>
                <input className="input compact-input" type="date" value={settlementDate} onChange={(event) => setSettlementDate(event.target.value)} />
                <select className="input compact-input" value={settlementCashier} onChange={(event) => setSettlementCashier(event.target.value)}>
                  <option value="">Tous les caissiers</option>
                  {cashiers.map((cashier) => <option key={cashier} value={cashier}>{cashier}</option>)}
                </select>
                <input className="input" placeholder="Rechercher vente ou client..." value={settlementSearch} onChange={(event) => setSettlementSearch(event.target.value)} />
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Heure</th>
                    <th>Vente</th>
                    <th>Caissier</th>
                    <th>Client</th>
                    <th>Total facture</th>
                    <th>Remis USD</th>
                    <th>Rendu USD</th>
                    <th>Net USD</th>
                    <th>Remis CDF</th>
                    <th>Rendu CDF</th>
                    <th>Net CDF</th>
                    <th>Ecart USD</th>
                    <th>Type</th>
                    <th>Motif</th>
                    <th>Note</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSettlementRows.length === 0 ? (
                    <tr><td colSpan={17}>Aucun ecart de reglement sur cette selection.</td></tr>
                  ) : filteredSettlementRows.map((sale) => (
                    <tr key={sale.saleId}>
                      <td>{formatDate(sale.saleDate)}</td>
                      <td>{sale.saleTime}</td>
                      <td><Link className="inline-link" to={`/sales/${sale.saleId}`}>{sale.saleNumber}</Link></td>
                      <td>{sale.cashier}</td>
                      <td>{sale.client}</td>
                      <td>{formatMoney(sale.totalAmount, sale.currencyCode, sale.currencySymbol)}</td>
                      <td>{formatMoney(sale.amountPaidUsd, 'USD', sale.currencySymbol)}</td>
                      <td>{formatMoney(sale.amountReturnedUsd, 'USD', sale.currencySymbol)}</td>
                      <td>{formatMoney(sale.netReceivedUsd, 'USD', sale.currencySymbol)}</td>
                      <td>{formatMoney(sale.amountPaidCdf, 'CDF')}</td>
                      <td>{formatMoney(sale.amountReturnedCdf, 'CDF')}</td>
                      <td>{formatMoney(sale.netReceivedCdf, 'CDF')}</td>
                      <td>{formatMoney(sale.settlementDifferenceUsd, 'USD', sale.currencySymbol)}</td>
                      <td>{settlementLabel(sale.settlementDifferenceType)}</td>
                      <td>{sale.settlementDifferenceReason ?? '-'}</td>
                      <td>{sale.settlementDifferenceNote ?? '-'}</td>
                      <td><Link className="secondary-button compact-button" to={`/sales/${sale.saleId}`}>Voir</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ouverture</th>
              <th>Site</th>
              <th>Utilisateur</th>
              <th>Statut</th>
              <th>Attendu USD</th>
              <th>Attendu CDF</th>
              <th>Compte USD</th>
              <th>Compte CDF</th>
              <th>Ecart USD</th>
              <th>Ecart CDF</th>
            </tr>
          </thead>
          <tbody>
            {(sessions.data ?? []).map((session) => (
              <tr key={session.cashSessionId}>
                <td>{formatDate(session.openedAt)} {formatTime(session.openedAt)}</td>
                <td>{session.siteName}</td>
                <td>{session.userName}</td>
                <td>{session.status}</td>
                <td>{formatMoney(session.expectedClosingBalanceUsd ?? session.expectedClosingBalance, 'USD')}</td>
                <td>{formatMoney(session.expectedClosingBalanceCdf ?? 0, 'CDF')}</td>
                <td>{formatMoney(session.countedClosingBalanceUsd ?? session.closingBalance ?? 0, 'USD')}</td>
                <td>{formatMoney(session.countedClosingBalanceCdf ?? 0, 'CDF')}</td>
                <td>{formatMoney(session.closingDifferenceUsd ?? session.differenceAmount, 'USD')}</td>
                <td>{formatMoney(session.closingDifferenceCdf ?? 0, 'CDF')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SettlementBlockCard({ title, lines }: { title: string; lines: Array<[string, string]> }) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div className="detail-grid">
        {lines.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildMovementMetrics(movements: CashMovement[], session: CashSession | null) {
  const openingUsd = Number(session?.openingBalanceUsd ?? (session?.registerCurrencyCode === 'CDF' ? 0 : session?.openingBalance ?? 0));
  const openingCdf = Number(session?.openingBalanceCdf ?? (session?.registerCurrencyCode === 'CDF' ? session?.openingBalance ?? 0 : 0));
  const grossSalePaymentsUsd = sumMovement(movements, ['SALE_PAYMENT'], 'USD');
  const grossSalePaymentsCdf = sumMovement(movements, ['SALE_PAYMENT'], 'CDF');
  const saleChangeUsd = sumMovement(movements, ['SALE_CHANGE'], 'USD');
  const saleChangeCdf = sumMovement(movements, ['SALE_CHANGE'], 'CDF');
  const expensesUsd = sumMovement(movements, ['EXPENSE'], 'USD');
  const expensesCdf = sumMovement(movements, ['EXPENSE'], 'CDF');
  const manualEntriesUsd = sumMovement(movements, ['CASH_IN', 'RECEIVABLE_PAYMENT', 'ADVANCE'], 'USD');
  const manualEntriesCdf = sumMovement(movements, ['CASH_IN', 'RECEIVABLE_PAYMENT', 'ADVANCE'], 'CDF');
  const manualOutputsUsd = sumMovement(movements, ['CASH_OUT', 'BANK_DEPOSIT'], 'USD');
  const manualOutputsCdf = sumMovement(movements, ['CASH_OUT', 'BANK_DEPOSIT'], 'CDF');
  const adjustmentsUsd = sumMovement(movements, ['ADJUSTMENT'], 'USD');
  const adjustmentsCdf = sumMovement(movements, ['ADJUSTMENT'], 'CDF');
  const netSalesUsd = roundMoney(grossSalePaymentsUsd - saleChangeUsd);
  const netSalesCdf = roundMoney(grossSalePaymentsCdf - saleChangeCdf);
  const expectedUsd = roundMoney(openingUsd + grossSalePaymentsUsd - saleChangeUsd - expensesUsd + manualEntriesUsd - manualOutputsUsd + adjustmentsUsd);
  const expectedCdf = roundMoney(openingCdf + grossSalePaymentsCdf - saleChangeCdf - expensesCdf + manualEntriesCdf - manualOutputsCdf + adjustmentsCdf);

  return {
    openingUsd,
    openingCdf,
    grossSalePaymentsUsd,
    grossSalePaymentsCdf,
    saleChangeUsd,
    saleChangeCdf,
    netSalesUsd,
    netSalesCdf,
    expensesUsd,
    expensesCdf,
    manualEntriesUsd,
    manualEntriesCdf,
    manualOutputsUsd,
    manualOutputsCdf,
    adjustmentsUsd,
    adjustmentsCdf,
    expectedUsd,
    expectedCdf,
  };
}

function buildSettlementMetrics(rows: SettlementRow[], currency: 'USD' | 'CDF'): SettlementMetrics {
  const values = rows.map((row) => ({
    type: row.settlementDifferenceType,
    amount: currency === 'USD' ? row.settlementDifferenceUsd : row.settlementDifferenceCdf,
  }));

  const crumbs = values.filter((row) => row.type === 'ROUNDING');
  const exchangeRounding = values.filter((row) => row.type === 'EXCHANGE_ROUNDING');
  const overpayments = values.filter((row) => row.type === 'OVERPAYMENT');
  const underpayments = values.filter((row) => row.type === 'UNDERPAYMENT');
  const manualAdjustments = values.filter((row) => !['NONE', 'ROUNDING', 'EXCHANGE_ROUNDING', 'OVERPAYMENT', 'UNDERPAYMENT'].includes(row.type));

  const positiveCrumbs = sumAmounts(crumbs.filter((row) => row.amount > 0));
  const negativeCrumbs = sumAmounts(crumbs.filter((row) => row.amount < 0));

  return {
    salesWithDifference: values.length,
    positiveCrumbs,
    negativeCrumbs,
    netCrumbs: roundMoney(positiveCrumbs + negativeCrumbs),
    overpayments: sumAmounts(overpayments),
    underpayments: sumAmounts(underpayments),
    exchangeRounding: sumAmounts(exchangeRounding),
    manualAdjustments: sumAmounts(manualAdjustments),
  };
}

function matchesSettlementFilter(row: SettlementRow, filter: string) {
  if (filter === 'ROUNDING') return row.settlementDifferenceType === 'ROUNDING';
  if (filter === 'EXCHANGE_ROUNDING') return row.settlementDifferenceType === 'EXCHANGE_ROUNDING';
  if (filter === 'OVERPAYMENT') return row.settlementDifferenceType === 'OVERPAYMENT';
  if (filter === 'UNDERPAYMENT') return row.settlementDifferenceType === 'UNDERPAYMENT';
  if (filter === 'ADJUSTMENT_CHANGE') return (row.amountReturnedUsd > 0 || row.amountReturnedCdf > 0) && row.settlementDifferenceType !== 'NONE';
  if (filter === 'MANUAL_ADJUSTMENT') return !['NONE', 'ROUNDING', 'EXCHANGE_ROUNDING', 'OVERPAYMENT', 'UNDERPAYMENT'].includes(row.settlementDifferenceType);
  if (filter === 'OTHER') return row.settlementDifferenceType === 'NONE';
  return true;
}

function sumMovement(rows: CashMovement[], types: string[], currencyCode: string) {
  return roundMoney(rows
    .filter((row) => types.includes(row.movementType) && (row.currencyCode ?? 'USD') === currencyCode)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0));
}

function sumAmounts(rows: Array<{ amount: number }>) {
  return roundMoney(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0));
}

function settlementLabel(type: string) {
  if (type === 'ROUNDING') return 'Arrondi / miette';
  if (type === 'EXCHANGE_ROUNDING') return 'Arrondi conversion';
  if (type === 'OVERPAYMENT') return 'Surplus';
  if (type === 'UNDERPAYMENT') return 'Reglement incomplet';
  if (type === 'NONE') return 'Exact';
  return type;
}

function formatTime(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
