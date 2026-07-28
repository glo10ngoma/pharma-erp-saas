import { FormEvent, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { apiErrorMessage } from '../../services/apiError';
import { cashService, CashMovement, CashSession } from '../../services/cash.service';
import { Sale, salesService } from '../../services/sales.service';
import { sitesService } from '../../services/sites.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';

const CashDashboardCharts = lazy(() => import('./CashDashboardCharts').then((module) => ({ default: module.CashDashboardCharts })));

type CashView = 'dashboard' | 'movements' | 'settlement-differences';

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

type MovementRow = CashMovement & {
  saleNumber?: string | null;
  siteName?: string | null;
  userName?: string | null;
};

const MOVEMENT_PAGE_SIZE = 25;
const SETTLEMENT_PAGE_SIZE = 25;

export function CashPage() {
  const { permissions } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const view = useMemo<CashView>(() => {
    if (location.pathname.endsWith('/movements')) return 'movements';
    if (location.pathname.endsWith('/settlement-differences')) return 'settlement-differences';
    return 'dashboard';
  }, [location.pathname]);

  const [openingBalance, setOpeningBalance] = useState('0');
  const [expenseCategory, setExpenseCategory] = useState('Frais caisse');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [countedClosingBalanceUsd, setCountedClosingBalanceUsd] = useState('');
  const [countedClosingBalanceCdf, setCountedClosingBalanceCdf] = useState('');
  const [dashboardAction, setDashboardAction] = useState<'open' | 'expense' | 'close' | null>(null);

  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const siteId = searchParams.get('siteId') ?? '';
  const selectedSiteId = siteId || sites.data?.[0]?.siteId || '';

  const sessions = useQuery({ queryKey: ['cash-sessions'], queryFn: async () => (await cashService.getSessions()).data });
  const current = useQuery({
    queryKey: ['cash-current', selectedSiteId],
    queryFn: async () => (await cashService.getCurrentSession(selectedSiteId || undefined)).data,
    enabled: Boolean(selectedSiteId),
  });

  const sessionsForSite = useMemo(
    () => [...(sessions.data ?? [])]
      .filter((session) => !selectedSiteId || session.siteId === selectedSiteId)
      .sort((left, right) => new Date(right.openedAt).getTime() - new Date(left.openedAt).getTime()),
    [selectedSiteId, sessions.data],
  );

  const currentSession = useMemo(
    () => current.data && (!selectedSiteId || current.data.siteId === selectedSiteId) ? current.data : null,
    [current.data, selectedSiteId],
  );
  const sessionId = searchParams.get('sessionId') ?? '';
  const defaultSession = currentSession ?? sessionsForSite[0] ?? null;

  useEffect(() => {
    if (!siteId && sites.data?.[0]?.siteId) {
      const next = new URLSearchParams(searchParams);
      next.set('siteId', sites.data[0].siteId);
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, siteId, sites.data]);

  useEffect(() => {
    if (!sessionId && defaultSession?.cashSessionId) {
      const next = new URLSearchParams(searchParams);
      next.set('sessionId', defaultSession.cashSessionId);
      setSearchParams(next, { replace: true });
    }
  }, [defaultSession?.cashSessionId, searchParams, sessionId, setSearchParams]);

  const activeSession = useMemo(
    () => sessionsForSite.find((session) => session.cashSessionId === sessionId) ?? defaultSession,
    [defaultSession, sessionId, sessionsForSite],
  );

  const movements = useQuery({
    queryKey: ['cash-movements', activeSession?.cashSessionId],
    queryFn: async () => (await cashService.getMovements(activeSession?.cashSessionId)).data,
    enabled: Boolean(activeSession?.cashSessionId),
  });

  const sales = useQuery({
    queryKey: ['sales', 'cash-view', activeSession?.cashSessionId],
    queryFn: async () => (await salesService.getAll()).data,
    enabled: Boolean(activeSession?.cashSessionId),
  });

  const salesById = useMemo(() => {
    const map = new Map<string, Sale>();
    for (const sale of sales.data ?? []) map.set(sale.saleId, sale);
    return map;
  }, [sales.data]);

  const movementRows = useMemo<MovementRow[]>(() => {
    const siteName = activeSession?.siteName ?? null;
    const userName = activeSession?.userName ?? null;
    return [...(movements.data ?? [])]
      .map((movement) => ({
        ...movement,
        saleNumber: movement.referenceType === 'SALE' && movement.referenceId ? salesById.get(movement.referenceId)?.saleNumber ?? null : null,
        siteName,
        userName,
      }))
      .sort((left, right) => new Date(right.movementDate).getTime() - new Date(left.movementDate).getTime());
  }, [activeSession?.siteName, activeSession?.userName, movements.data, salesById]);

  const movementMetrics = useMemo(
    () => buildMovementMetrics(movementRows, activeSession ?? null),
    [activeSession, movementRows],
  );

  const settlementRows = useMemo<SettlementRow[]>(() => {
    const sessionSaleIds = new Set(
      movementRows
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
          cashier: activeSession?.userName || sale.createdByName || '-',
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
      })
      .sort((left, right) => new Date(right.saleDate).getTime() - new Date(left.saleDate).getTime());
  }, [activeSession?.userName, movementRows, sales.data]);

  const settlementMetricsUsd = useMemo(() => buildSettlementMetrics(settlementRows, 'USD'), [settlementRows]);
  const settlementMetricsCdf = useMemo(() => buildSettlementMetrics(settlementRows, 'CDF'), [settlementRows]);
  const cashiers = useMemo(() => Array.from(new Set(settlementRows.map((row) => row.cashier).filter(Boolean))).sort(), [settlementRows]);

  const movementType = searchParams.get('movementType') ?? 'ALL';
  const movementCurrency = searchParams.get('movementCurrency') ?? 'ALL';
  const movementDirection = searchParams.get('movementDirection') ?? 'ALL';
  const movementFrom = searchParams.get('movementFrom') ?? '';
  const movementTo = searchParams.get('movementTo') ?? '';
  const movementSearch = searchParams.get('movementSearch') ?? '';
  const movementPage = Math.max(Number(searchParams.get('movementPage') ?? '1') || 1, 1);

  const settlementFilter = searchParams.get('settlementType') ?? 'ALL';
  const settlementFrom = searchParams.get('settlementFrom') ?? '';
  const settlementTo = searchParams.get('settlementTo') ?? '';
  const settlementCashier = searchParams.get('settlementCashier') ?? '';
  const settlementSearch = searchParams.get('settlementSearch') ?? '';
  const settlementPage = Math.max(Number(searchParams.get('settlementPage') ?? '1') || 1, 1);
  const showAllSessions = searchParams.get('sessions') === 'all';
  const sessionStatusFilter = searchParams.get('sessionStatus') ?? 'ALL';
  const sessionCashierFilter = searchParams.get('sessionCashier') ?? '';
  const sessionDateFilter = searchParams.get('sessionDate') ?? '';
  const sessionPage = Math.max(Number(searchParams.get('sessionPage') ?? '1') || 1, 1);

  const canReadCash = permissions.includes('cash_registers.read');
  const canOpenCash = permissions.includes('cash_sessions.open');
  const canCreateExpense = permissions.includes('cash_expenses.create');
  const canCloseCash = permissions.includes('cash_sessions.close');
  const canReadSettlements = canReadCash;

  const filteredMovementRows = useMemo(() => {
    const term = movementSearch.trim().toLowerCase();
    return movementRows.filter((movement) => {
      if (movementType !== 'ALL' && movement.movementType !== movementType) return false;
      if (movementCurrency !== 'ALL' && (movement.currencyCode ?? 'USD') !== movementCurrency) return false;
      if (movementDirection !== 'ALL' && movementDirectionFor(movement) !== movementDirection) return false;
      if (movementFrom && movement.movementDate.slice(0, 10) < movementFrom) return false;
      if (movementTo && movement.movementDate.slice(0, 10) > movementTo) return false;
      if (!term) return true;
      return [
        movementLabel(movement.movementType),
        movement.referenceType ?? '',
        movement.referenceId ?? '',
        movement.saleNumber ?? '',
        movement.description ?? '',
        movement.userName ?? '',
      ].some((value) => value.toLowerCase().includes(term));
    });
  }, [movementCurrency, movementDirection, movementFrom, movementRows, movementSearch, movementTo, movementType]);

  const filteredSettlementRows = useMemo(() => {
    const term = settlementSearch.trim().toLowerCase();
    return settlementRows.filter((row) => {
      if (settlementFilter !== 'ALL' && !matchesSettlementFilter(row, settlementFilter)) return false;
      if (settlementFrom && row.saleDate.slice(0, 10) < settlementFrom) return false;
      if (settlementTo && row.saleDate.slice(0, 10) > settlementTo) return false;
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
  }, [settlementCashier, settlementFilter, settlementFrom, settlementRows, settlementSearch, settlementTo]);

  const filteredSettlementMetricsUsd = useMemo(() => buildSettlementMetrics(filteredSettlementRows, 'USD'), [filteredSettlementRows]);
  const filteredSettlementMetricsCdf = useMemo(() => buildSettlementMetrics(filteredSettlementRows, 'CDF'), [filteredSettlementRows]);
  const movementSummary = useMemo(() => buildMovementSummary(filteredMovementRows), [filteredMovementRows]);
  const dashboardAlerts = useMemo(() => buildDashboardAlerts(activeSession ?? null, movementMetrics, settlementMetricsUsd), [activeSession, movementMetrics, settlementMetricsUsd]);
  const sessionCashiers = useMemo(
    () => Array.from(new Set(sessionsForSite.map((session) => session.userName).filter((value): value is string => Boolean(value)))).sort(),
    [sessionsForSite],
  );
  const filteredSessions = useMemo(() => {
    return sessionsForSite.filter((session) => {
      if (sessionStatusFilter !== 'ALL' && session.status !== sessionStatusFilter) return false;
      if (sessionCashierFilter && session.userName !== sessionCashierFilter) return false;
      if (sessionDateFilter && session.openedAt.slice(0, 10) !== sessionDateFilter) return false;
      return true;
    });
  }, [sessionCashierFilter, sessionDateFilter, sessionStatusFilter, sessionsForSite]);

  const pagedMovements = useMemo(() => paginate(filteredMovementRows, movementPage, MOVEMENT_PAGE_SIZE), [filteredMovementRows, movementPage]);
  const pagedSettlements = useMemo(() => paginate(filteredSettlementRows, settlementPage, SETTLEMENT_PAGE_SIZE), [filteredSettlementRows, settlementPage]);
  const pagedSessions = useMemo(() => paginate(filteredSessions, sessionPage, 10), [filteredSessions, sessionPage]);
  const recentSessions = useMemo(() => filteredSessions.slice(0, 5), [filteredSessions]);

  useEffect(() => {
    if (!currentSession && dashboardAction && dashboardAction !== 'open') {
      setDashboardAction(null);
    }
    if (currentSession && dashboardAction === 'open') {
      setDashboardAction(null);
    }
  }, [currentSession, dashboardAction]);

  function updateParams(updates: Record<string, string | null>, replace = false) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace });
  }

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
    mutationFn: () => cashService.createExpense({
      cashSessionId: currentSession?.cashSessionId,
      expenseCategory,
      description: expenseDescription,
      amount: Number(expenseAmount),
    }),
    onSuccess: () => {
      setExpenseDescription('');
      setExpenseAmount('');
      refresh();
    },
  });
  const close = useMutation({
    mutationFn: () => cashService.closeSession(currentSession!.cashSessionId, {
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
    if (currentSession?.cashSessionId) expense.mutate();
  }

  function submitClose(event: FormEvent) {
    event.preventDefault();
    if (currentSession?.cashSessionId) close.mutate();
  }

  const loadingCore = sites.isLoading || sessions.isLoading || current.isLoading || (activeSession?.cashSessionId ? movements.isLoading : false);
  const loadError = sites.error || sessions.error || current.error || movements.error || sales.error;
  const sessionStatusClass = activeSession?.status === 'OPEN' ? 'status-badge draft-badge' : 'status-badge validated-badge';
  const activeBalanceUsd = activeSession ? movementMetrics.expectedUsd : 0;
  const activeBalanceCdf = activeSession ? movementMetrics.expectedCdf : 0;

  return (
    <>
      <section className="toolbar cash-toolbar">
        <div>
          <h1>Caisse</h1>
          <span>Dashboard, mouvements et ecarts de reglement par session.</span>
        </div>
      </section>

      <section className="card cash-shell">
        <div className="cash-shell-top">
          <div className="cash-selectors">
            <label>
              Site
              <select className="input compact-input" value={selectedSiteId} onChange={(event) => updateParams({ siteId: event.target.value, sessionId: null, movementPage: null, settlementPage: null })}>
                {(sites.data ?? []).map((site) => (
                  <option key={site.siteId} value={site.siteId}>{site.siteName}</option>
                ))}
              </select>
            </label>
            <label>
              Session
              <select
                className="input compact-input"
                value={activeSession?.cashSessionId ?? ''}
                onChange={(event) => updateParams({ sessionId: event.target.value, movementPage: null, settlementPage: null })}
              >
                {sessionsForSite.length === 0 && <option value="">Aucune session</option>}
                {sessionsForSite.map((session) => (
                  <option key={session.cashSessionId} value={session.cashSessionId}>
                    {sessionLabel(session)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="cash-session-indicator">
            <span className={sessionStatusClass}>{activeSession?.status ?? 'AUCUNE SESSION'}</span>
            <small>{activeSession ? `${activeSession.userName ?? 'Utilisateur'} - ${activeSession.siteName ?? '-'}` : 'Selectionnez un site pour continuer.'}</small>
          </div>
        </div>

        <nav className="cash-subnav" aria-label="Navigation interne caisse">
          <NavLink className={({ isActive }) => cashSubnavClass(isActive)} to={{ pathname: '/cash', search: `?${searchParams.toString()}` }} end>
            Dashboard
          </NavLink>
          <NavLink className={({ isActive }) => cashSubnavClass(isActive)} to={{ pathname: '/cash/movements', search: `?${searchParams.toString()}` }}>
            Mouvements
          </NavLink>
          <NavLink className={({ isActive }) => cashSubnavClass(isActive)} to={{ pathname: '/cash/settlement-differences', search: `?${searchParams.toString()}` }}>
            Ecarts de reglement
          </NavLink>
        </nav>
      </section>

      {loadingCore && <div className="card"><p className="loading-state">Chargement de la caisse...</p></div>}
      {loadError && !loadingCore && (
        <div className="card">
          <p className="form-error">{apiErrorMessage(loadError)}</p>
          <button className="secondary-button compact-button" onClick={() => { sites.refetch(); sessions.refetch(); current.refetch(); movements.refetch(); sales.refetch(); }}>
            Reessayer
          </button>
        </div>
      )}

      {!loadingCore && !loadError && view === 'dashboard' && (
        <>
          <section className="card cash-quick-actions">
            <div className="cash-section-title">
              <div>
                <h2>Actions rapides</h2>
                <p className="muted-text">Raccourcis immediats selon l'etat de la session selectionnee.</p>
              </div>
            </div>
            <div className="cash-quick-actions-row">
              {canOpenCash && !currentSession && (
                <button className="button compact-button" onClick={() => setDashboardAction('open')} disabled={open.isPending || !selectedSiteId}>
                  {open.isPending ? 'Ouverture...' : 'Ouvrir la caisse'}
                </button>
              )}
              {canCreateExpense && currentSession?.cashSessionId === activeSession?.cashSessionId && (
                <button className="secondary-button compact-button" onClick={() => setDashboardAction('expense')} disabled={expense.isPending}>
                  {expense.isPending ? 'Depense...' : 'Enregistrer une depense'}
                </button>
              )}
              {canCloseCash && currentSession?.cashSessionId === activeSession?.cashSessionId && (
                <button className="secondary-button compact-button" onClick={() => setDashboardAction('close')} disabled={close.isPending}>
                  {close.isPending ? 'Fermeture...' : 'Fermer la caisse'}
                </button>
              )}
              {canReadCash && (
                <NavLink className="secondary-button compact-button" to={{ pathname: '/cash/movements', search: `?${searchParams.toString()}` }}>
                  Voir les mouvements
                </NavLink>
              )}
              {canReadSettlements && (
                <NavLink className="secondary-button compact-button" to={{ pathname: '/cash/settlement-differences', search: `?${searchParams.toString()}` }}>
                  Voir les ecarts de reglement
                </NavLink>
              )}
            </div>
          </section>

          <section className="card cash-dashboard-session">
            <div className="cash-dashboard-session-header">
              <div>
                <h2>Etat de la session</h2>
                <p className="muted-text">Vue immediate de la session selectionnee.</p>
              </div>
              <div className="page-actions">
                {currentSession?.cashSessionId === activeSession?.cashSessionId && (
                  <>
                    <button className="secondary-button compact-button" onClick={() => updateParams({ sessions: 'all', sessionPage: '1' })}>
                      Voir toutes les sessions
                    </button>
                  </>
                )}
              </div>
            </div>

            {!activeSession ? (
              <p className="empty-state">Aucune session accessible pour ce site.</p>
            ) : (
              <div className="cash-session-summary-grid">
                <SessionFact label="Caisse" value={activeSession.registerName || '-'} />
                <SessionFact label="Site" value={activeSession.siteName || '-'} />
                <SessionFact label="Caissier" value={activeSession.userName || '-'} />
                <SessionFact label="Ouverture" value={`${formatDate(activeSession.openedAt)} ${formatTime(activeSession.openedAt)}`} />
                <SessionFact label="Duree" value={formatSessionDuration(activeSession)} />
                <SessionFact label="Fermeture" value={activeSession.closedAt ? `${formatDate(activeSession.closedAt)} ${formatTime(activeSession.closedAt)}` : 'Session ouverte'} />
              </div>
            )}

            {open.isError && <p className="form-error">{apiErrorMessage(open.error)}</p>}
          </section>

          <section className="cash-balance-hero-grid">
            <CashBalanceHeroCard
              currencyLabel="USD"
              title="Solde actuel"
              mainValue={formatMoney(activeBalanceUsd, 'USD')}
              empty={!activeSession}
              status={activeSession?.status ?? null}
              lines={[
                ['Solde initial', formatMoney(movementMetrics.openingUsd, 'USD')],
                ['Entrees', formatMoney(movementMetrics.totalInUsd, 'USD')],
                ['Sorties', formatMoney(movementMetrics.totalOutUsd, 'USD')],
                ['Solde attendu', formatMoney(movementMetrics.expectedUsd, 'USD')],
                ['Montant compte', formatMoney(Number(activeSession?.countedClosingBalanceUsd ?? 0), 'USD')],
                ['Ecart physique', formatMoney(Number(activeSession?.closingDifferenceUsd ?? 0), 'USD')],
              ]}
            />
            <CashBalanceHeroCard
              currencyLabel="CDF / FC"
              title="Solde actuel"
              mainValue={formatMoney(activeBalanceCdf, 'CDF')}
              empty={!activeSession}
              status={activeSession?.status ?? null}
              lines={[
                ['Solde initial', formatMoney(movementMetrics.openingCdf, 'CDF')],
                ['Entrees', formatMoney(movementMetrics.totalInCdf, 'CDF')],
                ['Sorties', formatMoney(movementMetrics.totalOutCdf, 'CDF')],
                ['Solde attendu', formatMoney(movementMetrics.expectedCdf, 'CDF')],
                ['Montant compte', formatMoney(Number(activeSession?.countedClosingBalanceCdf ?? 0), 'CDF')],
                ['Ecart physique', formatMoney(Number(activeSession?.closingDifferenceCdf ?? 0), 'CDF')],
              ]}
            />
          </section>

          {(dashboardAction || (!currentSession && canOpenCash)) && (
            <section className="cash-action-grid">
              {canOpenCash && (!currentSession || dashboardAction === 'open') && (
                <form className="card form-grid cash-card-form" onSubmit={submitOpen}>
                  <h3>Ouvrir la caisse</h3>
                  <label>
                    Fond d'ouverture
                    <input className="input" type="number" min="0" step="0.01" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} />
                  </label>
                  <button className="button" disabled={open.isPending || !selectedSiteId}>{open.isPending ? 'Ouverture...' : 'Ouvrir caisse'}</button>
                  {open.isError && <p className="form-error">{apiErrorMessage(open.error)}</p>}
                </form>
              )}

              {canCreateExpense && currentSession?.cashSessionId === activeSession?.cashSessionId && dashboardAction === 'expense' && (
                <form className="card form-grid cash-card-form" onSubmit={submitExpense}>
                  <h3>Enregistrer une depense</h3>
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
                  <button className="button" disabled={expense.isPending}>{expense.isPending ? 'Enregistrement...' : 'Enregistrer depense'}</button>
                  {expense.isError && <p className="form-error">{apiErrorMessage(expense.error)}</p>}
                </form>
              )}

              {canCloseCash && currentSession?.cashSessionId === activeSession?.cashSessionId && dashboardAction === 'close' && (
                <form className="card form-grid cash-card-form" onSubmit={submitClose}>
                  <h3>Fermer la caisse</h3>
                  <label>
                    Montant compte USD
                    <input className="input" type="number" min="0" step="0.01" value={countedClosingBalanceUsd} onChange={(event) => setCountedClosingBalanceUsd(event.target.value)} />
                  </label>
                  <label>
                    Montant compte CDF
                    <input className="input" type="number" min="0" step="0.01" value={countedClosingBalanceCdf} onChange={(event) => setCountedClosingBalanceCdf(event.target.value)} />
                  </label>
                  <button className="button" disabled={close.isPending || (countedClosingBalanceUsd === '' && countedClosingBalanceCdf === '')}>{close.isPending ? 'Fermeture...' : 'Fermer caisse'}</button>
                  {close.isError && <p className="form-error">{apiErrorMessage(close.error)}</p>}
                </form>
              )}
            </section>
          )}

          <section className="cash-kpi-grid cash-kpi-grid-secondary">
            <MetricCard title="Net encaisse USD" value={formatMoney(movementMetrics.netSalesUsd, 'USD')} />
            <MetricCard title="Net encaisse CDF" value={formatMoney(movementMetrics.netSalesCdf, 'CDF')} />
            <MetricCard title="Depenses USD" value={formatMoney(movementMetrics.expensesUsd, 'USD')} />
            <MetricCard title="Depenses CDF" value={formatMoney(movementMetrics.expensesCdf, 'CDF')} />
            <MetricCard title="Brut recu USD" value={formatMoney(movementMetrics.grossSalePaymentsUsd, 'USD')} />
            <MetricCard title="Brut recu CDF" value={formatMoney(movementMetrics.grossSalePaymentsCdf, 'CDF')} />
            <MetricCard title="Monnaie rendue USD" value={formatMoney(movementMetrics.saleChangeUsd, 'USD')} />
            <MetricCard title="Monnaie rendue CDF" value={formatMoney(movementMetrics.saleChangeCdf, 'CDF')} />
            <MetricCard title="Ventes encaissees" value={String(countMovementRows(movementRows, 'SALE_PAYMENT'))} />
            <MetricCard title="Mouvements" value={String(movementRows.length)} />
            <MetricCard title="Ventes avec ecart" value={String(settlementMetricsUsd.salesWithDifference)} />
            <MetricCard title="Solde miettes" value={`${formatMoney(settlementMetricsUsd.netCrumbs, 'USD')} / ${formatMoney(settlementMetricsCdf.netCrumbs, 'CDF')}`} />
          </section>

          {activeSession && (
            <>
              <section className="card">
                <div className="cash-section-title">
                  <div>
                    <h2>Graphiques caisse</h2>
                    <p className="muted-text">Lecture rapide des encaissements et des categories de mouvements.</p>
                  </div>
                </div>
                <Suspense fallback={<p className="loading-state">Chargement des graphiques...</p>}>
                  <CashDashboardCharts movements={movementRows} />
                </Suspense>
              </section>

              {dashboardAlerts.length > 0 && (
                <section className="cash-alert-grid">
                  {dashboardAlerts.map((alert) => (
                    <div className={`card cash-alert cash-alert-${alert.tone}`} key={alert.title}>
                      <span>{alert.title}</span>
                      <strong>{alert.value}</strong>
                      <p>{alert.message}</p>
                      {alert.action && (
                        alert.action.to ? (
                          <NavLink className="secondary-button compact-button" to={alert.action.to}>
                            {alert.action.label}
                          </NavLink>
                        ) : (
                          <button className="secondary-button compact-button" onClick={alert.action.onClick}>
                            {alert.action.label}
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </section>
              )}
            </>
          )}

          <section className="card">
            <div className="cash-section-title">
              <div>
                <h2>Dernieres sessions</h2>
                <p className="muted-text">Sessions recentes par site, avec lecture rapide des ecarts physiques.</p>
              </div>
              <div className="page-actions">
                <button className="secondary-button compact-button" onClick={() => updateParams({ sessions: showAllSessions ? null : 'all', sessionPage: '1' })}>
                  {showAllSessions ? 'Voir seulement les 5 dernieres' : 'Voir toutes les sessions'}
                </button>
              </div>
            </div>

            {showAllSessions && (
              <div className="cash-filter-grid cash-sessions-filter-grid">
                <select className="input compact-input" value={sessionStatusFilter} onChange={(event) => updateParams({ sessionStatus: event.target.value === 'ALL' ? null : event.target.value, sessionPage: '1' })}>
                  <option value="ALL">Tous les statuts</option>
                  <option value="OPEN">Ouverte</option>
                  <option value="CLOSED">Fermee</option>
                </select>
                <select className="input compact-input" value={sessionCashierFilter} onChange={(event) => updateParams({ sessionCashier: event.target.value || null, sessionPage: '1' })}>
                  <option value="">Tous les caissiers</option>
                  {sessionCashiers.map((cashier) => <option key={cashier} value={cashier}>{cashier}</option>)}
                </select>
                <input className="input compact-input" type="date" value={sessionDateFilter} onChange={(event) => updateParams({ sessionDate: event.target.value || null, sessionPage: '1' })} />
              </div>
            )}

            <div className="table-wrap">
              <table className="data-table cash-sessions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Caissier</th>
                    <th>Ouverture</th>
                    <th>Fermeture</th>
                    <th>Attendu USD</th>
                    <th>Attendu CDF</th>
                    <th>Ecart USD</th>
                    <th>Ecart CDF</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllSessions ? pagedSessions.items : recentSessions).length === 0 ? (
                    <tr><td colSpan={10}>Aucune session disponible pour ce site.</td></tr>
                  ) : (showAllSessions ? pagedSessions.items : recentSessions).map((session) => (
                    <tr key={session.cashSessionId}>
                      <td>{formatDate(session.openedAt)}</td>
                      <td>{session.userName ?? '-'}</td>
                      <td>{formatTime(session.openedAt)}</td>
                      <td>{session.closedAt ? formatTime(session.closedAt) : '-'}</td>
                      <td>{formatMoney(session.expectedClosingBalanceUsd ?? session.expectedClosingBalance, 'USD')}</td>
                      <td>{formatMoney(session.expectedClosingBalanceCdf ?? 0, 'CDF')}</td>
                      <td><span className={differenceBadgeClass(Number(session.closingDifferenceUsd ?? session.differenceAmount ?? 0))}>{physicalDifferenceLabel(Number(session.closingDifferenceUsd ?? session.differenceAmount ?? 0), 'USD')}</span></td>
                      <td><span className={differenceBadgeClass(Number(session.closingDifferenceCdf ?? 0))}>{physicalDifferenceLabel(Number(session.closingDifferenceCdf ?? 0), 'CDF')}</span></td>
                      <td><span className={session.status === 'OPEN' ? 'status-badge draft-badge' : 'status-badge validated-badge'}>{session.status === 'OPEN' ? 'Ouverte' : 'Fermee'}</span></td>
                      <td>
                        <button className="secondary-button compact-button" onClick={() => updateParams({ sessionId: session.cashSessionId, sessions: null, sessionPage: null }, false)}>
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {showAllSessions && (
              <PaginationBar
                page={pagedSessions.page}
                totalPages={pagedSessions.totalPages}
                onPrevious={() => updateParams({ sessionPage: String(Math.max(1, sessionPage - 1)) })}
                onNext={() => updateParams({ sessionPage: String(Math.min(pagedSessions.totalPages, sessionPage + 1)) })}
              />
            )}
          </section>
        </>
      )}

      {!loadingCore && !loadError && view === 'movements' && (
        <>
          <section className="cash-kpi-grid">
            <MetricCard title="Entrees USD" value={formatMoney(movementSummary.inUsd, 'USD')} />
            <MetricCard title="Sorties USD" value={formatMoney(movementSummary.outUsd, 'USD')} />
            <MetricCard title="Net USD" value={formatMoney(movementSummary.netUsd, 'USD')} />
            <MetricCard title="Entrees CDF" value={formatMoney(movementSummary.inCdf, 'CDF')} />
            <MetricCard title="Sorties CDF" value={formatMoney(movementSummary.outCdf, 'CDF')} />
            <MetricCard title="Net CDF" value={formatMoney(movementSummary.netCdf, 'CDF')} />
            <MetricCard title="Mouvements" value={String(filteredMovementRows.length)} />
          </section>

          <section className="card">
            <div className="cash-section-title">
              <div>
                <h2>Mouvements de caisse</h2>
                <p className="muted-text">Liste detaillee de la session selectionnee.</p>
              </div>
            </div>
            <div className="cash-filter-grid">
              <input className="input" placeholder="Reference, vente, description..." value={movementSearch} onChange={(event) => updateParams({ movementSearch: event.target.value || null, movementPage: '1' })} />
              <select className="input compact-input" value={movementType} onChange={(event) => updateParams({ movementType: event.target.value === 'ALL' ? null : event.target.value, movementPage: '1' })}>
                <option value="ALL">Tous les types</option>
                {movementTypes(movementRows).map((type) => <option key={type} value={type}>{movementLabel(type)}</option>)}
              </select>
              <select className="input compact-input" value={movementCurrency} onChange={(event) => updateParams({ movementCurrency: event.target.value === 'ALL' ? null : event.target.value, movementPage: '1' })}>
                <option value="ALL">Toutes devises</option>
                <option value="USD">USD</option>
                <option value="CDF">CDF</option>
              </select>
              <select className="input compact-input" value={movementDirection} onChange={(event) => updateParams({ movementDirection: event.target.value === 'ALL' ? null : event.target.value, movementPage: '1' })}>
                <option value="ALL">Entrees / sorties</option>
                <option value="IN">Entrees</option>
                <option value="OUT">Sorties</option>
                <option value="NEUTRAL">Ajustements</option>
              </select>
              <input className="input compact-input" type="date" value={movementFrom} onChange={(event) => updateParams({ movementFrom: event.target.value || null, movementPage: '1' })} />
              <input className="input compact-input" type="date" value={movementTo} onChange={(event) => updateParams({ movementTo: event.target.value || null, movementPage: '1' })} />
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Heure</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Description</th>
                    <th>Sens</th>
                    <th>Montant</th>
                    <th>Devise</th>
                    <th>Utilisateur</th>
                    <th>Lien metier</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedMovements.items.length === 0 ? (
                    <tr><td colSpan={11}>Aucun mouvement pour cette selection.</td></tr>
                  ) : pagedMovements.items.map((movement) => (
                    <tr key={movement.cashMovementId}>
                      <td>{formatDate(movement.movementDate)}</td>
                      <td>{formatTime(movement.movementDate)}</td>
                      <td>{movementLabel(movement.movementType)}</td>
                      <td>{movement.saleNumber ?? movement.referenceId ?? '-'}</td>
                      <td>{movement.description ?? '-'}</td>
                      <td>{directionLabel(movementDirectionFor(movement))}</td>
                      <td>{formatMoney(movement.amount, movement.currencyCode ?? 'USD', movement.currencySymbol)}</td>
                      <td>{movement.currencyCode ?? 'USD'}</td>
                      <td>{movement.userName ?? '-'}</td>
                      <td>
                        {movement.referenceType === 'SALE' && movement.referenceId ? (
                          <Link className="inline-link" to={`/sales/${movement.referenceId}`}>{movement.saleNumber ?? 'Voir vente'}</Link>
                        ) : (
                          movement.referenceType ?? '-'
                        )}
                      </td>
                      <td>
                        {movement.referenceType === 'SALE' && movement.referenceId ? (
                          <Link className="secondary-button compact-button" to={`/sales/${movement.referenceId}`}>Voir</Link>
                        ) : (
                          <span className="muted-text">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PaginationBar
              page={pagedMovements.page}
              totalPages={pagedMovements.totalPages}
              onPrevious={() => updateParams({ movementPage: String(Math.max(1, movementPage - 1)) })}
              onNext={() => updateParams({ movementPage: String(Math.min(pagedMovements.totalPages, movementPage + 1)) })}
            />
          </section>
        </>
      )}

      {!loadingCore && !loadError && view === 'settlement-differences' && (
        <>
          <section className="cash-kpi-grid">
            <MetricCard title="Ventes avec ecart USD" value={String(filteredSettlementMetricsUsd.salesWithDifference)} />
            <MetricCard title="Solde net USD" value={formatMoney(filteredSettlementMetricsUsd.netCrumbs, 'USD')} />
            <MetricCard title="Ventes avec ecart CDF" value={String(filteredSettlementMetricsCdf.salesWithDifference)} />
            <MetricCard title="Solde net CDF" value={formatMoney(filteredSettlementMetricsCdf.netCrumbs, 'CDF')} />
          </section>

          <section className="cash-balance-grid">
            <SettlementBlockCard title="Ecarts USD" lines={[
              ['Miettes positives', formatMoney(filteredSettlementMetricsUsd.positiveCrumbs, 'USD')],
              ['Miettes negatives', formatMoney(filteredSettlementMetricsUsd.negativeCrumbs, 'USD')],
              ['Solde net', formatMoney(filteredSettlementMetricsUsd.netCrumbs, 'USD')],
              ['Arrondis conversion', formatMoney(filteredSettlementMetricsUsd.exchangeRounding, 'USD')],
              ['Surplus', formatMoney(filteredSettlementMetricsUsd.overpayments, 'USD')],
              ['Reglements incomplets', formatMoney(filteredSettlementMetricsUsd.underpayments, 'USD')],
              ['Ajustements manuels', formatMoney(filteredSettlementMetricsUsd.manualAdjustments, 'USD')],
            ]} />
            <SettlementBlockCard title="Ecarts CDF" lines={[
              ['Miettes positives', formatMoney(filteredSettlementMetricsCdf.positiveCrumbs, 'CDF')],
              ['Miettes negatives', formatMoney(filteredSettlementMetricsCdf.negativeCrumbs, 'CDF')],
              ['Solde net', formatMoney(filteredSettlementMetricsCdf.netCrumbs, 'CDF')],
              ['Arrondis conversion', formatMoney(filteredSettlementMetricsCdf.exchangeRounding, 'CDF')],
              ['Surplus', formatMoney(filteredSettlementMetricsCdf.overpayments, 'CDF')],
              ['Reglements incomplets', formatMoney(filteredSettlementMetricsCdf.underpayments, 'CDF')],
              ['Ajustements manuels', formatMoney(filteredSettlementMetricsCdf.manualAdjustments, 'CDF')],
            ]} />
          </section>

          <section className="card">
            <p className="muted-text">Ces ecarts de reglement sont expliques et rattaches a des ventes. Ils sont distincts des ecarts physiques constates lors de la fermeture de caisse.</p>
            <div className="cash-filter-grid">
              <select className="input compact-input" value={settlementFilter} onChange={(event) => updateParams({ settlementType: event.target.value === 'ALL' ? null : event.target.value, settlementPage: '1' })}>
                <option value="ALL">Tous</option>
                <option value="ROUNDING">Arrondis / miettes</option>
                <option value="EXCHANGE_ROUNDING">Arrondis conversion</option>
                <option value="OVERPAYMENT">Surplus</option>
                <option value="UNDERPAYMENT">Reglements incomplets</option>
                <option value="ADJUSTMENT_CHANGE">Ajustements monnaie</option>
                <option value="MANUAL_ADJUSTMENT">Ajustements manuels</option>
                <option value="OTHER">Autres</option>
              </select>
              <input className="input compact-input" type="date" value={settlementFrom} onChange={(event) => updateParams({ settlementFrom: event.target.value || null, settlementPage: '1' })} />
              <input className="input compact-input" type="date" value={settlementTo} onChange={(event) => updateParams({ settlementTo: event.target.value || null, settlementPage: '1' })} />
              <select className="input compact-input" value={settlementCashier} onChange={(event) => updateParams({ settlementCashier: event.target.value || null, settlementPage: '1' })}>
                <option value="">Tous les caissiers</option>
                {cashiers.map((cashier) => <option key={cashier} value={cashier}>{cashier}</option>)}
              </select>
              <input className="input" placeholder="Vente, client, motif..." value={settlementSearch} onChange={(event) => updateParams({ settlementSearch: event.target.value || null, settlementPage: '1' })} />
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
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedSettlements.items.length === 0 ? (
                    <tr><td colSpan={17}>Aucun ecart de reglement sur cette selection.</td></tr>
                  ) : pagedSettlements.items.map((sale) => (
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

            <PaginationBar
              page={pagedSettlements.page}
              totalPages={pagedSettlements.totalPages}
              onPrevious={() => updateParams({ settlementPage: String(Math.max(1, settlementPage - 1)) })}
              onNext={() => updateParams({ settlementPage: String(Math.min(pagedSettlements.totalPages, settlementPage + 1)) })}
            />
          </section>
        </>
      )}
    </>
  );
}

function cashSubnavClass(isActive: boolean) {
  return `cash-subnav-link${isActive ? ' active' : ''}`;
}

function SessionFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="cash-session-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="card cash-metric-card">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CashBalanceHeroCard({
  currencyLabel,
  title,
  mainValue,
  empty,
  status,
  lines,
}: {
  currencyLabel: string;
  title: string;
  mainValue: string;
  empty: boolean;
  status: string | null;
  lines: Array<[string, string]>;
}) {
  return (
    <article className="card cash-balance-hero-card">
      <div className="cash-balance-hero-head">
        <span className="cash-balance-hero-currency">{currencyLabel}</span>
        {status && <span className={status === 'OPEN' ? 'status-badge draft-badge' : 'status-badge validated-badge'}>{status === 'OPEN' ? 'Ouverte' : 'Fermee'}</span>}
      </div>
      <span className="cash-balance-hero-label">{title}</span>
      <strong className="cash-balance-hero-amount">{empty ? 'Aucune session' : mainValue}</strong>
      <div className="cash-balance-hero-details">
        {lines.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{empty && !label.startsWith('Montant') && !label.startsWith('Ecart') ? value : value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function PaginationBar({ page, totalPages, onPrevious, onNext }: { page: number; totalPages: number; onPrevious: () => void; onNext: () => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="cash-pagination">
      <button className="secondary-button compact-button" onClick={onPrevious} disabled={page <= 1}>Precedent</button>
      <span>Page {page} / {totalPages}</span>
      <button className="secondary-button compact-button" onClick={onNext} disabled={page >= totalPages}>Suivant</button>
    </div>
  );
}

function SettlementBlockCard({ title, lines }: { title: string; lines: Array<[string, string]> }) {
  return (
    <div className="card cash-balance-card">
      <h3>{title}</h3>
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
  const manualEntriesUsd = sumMovement(movements, ['CASH_IN', 'RECEIVABLE_PAYMENT', 'ADVANCE', 'OPENING_BALANCE'], 'USD');
  const manualEntriesCdf = sumMovement(movements, ['CASH_IN', 'RECEIVABLE_PAYMENT', 'ADVANCE', 'OPENING_BALANCE'], 'CDF');
  const manualOutputsUsd = sumMovement(movements, ['CASH_OUT', 'BANK_DEPOSIT'], 'USD');
  const manualOutputsCdf = sumMovement(movements, ['CASH_OUT', 'BANK_DEPOSIT'], 'CDF');
  const adjustmentsUsd = sumMovement(movements, ['ADJUSTMENT'], 'USD');
  const adjustmentsCdf = sumMovement(movements, ['ADJUSTMENT'], 'CDF');
  const netSalesUsd = roundMoney(grossSalePaymentsUsd - saleChangeUsd);
  const netSalesCdf = roundMoney(grossSalePaymentsCdf - saleChangeCdf);
  const totalInUsd = roundMoney(openingUsd + grossSalePaymentsUsd + manualEntriesUsd + Math.max(adjustmentsUsd, 0));
  const totalOutUsd = roundMoney(saleChangeUsd + expensesUsd + manualOutputsUsd + Math.abs(Math.min(adjustmentsUsd, 0)));
  const totalInCdf = roundMoney(openingCdf + grossSalePaymentsCdf + manualEntriesCdf + Math.max(adjustmentsCdf, 0));
  const totalOutCdf = roundMoney(saleChangeCdf + expensesCdf + manualOutputsCdf + Math.abs(Math.min(adjustmentsCdf, 0)));
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
    totalInUsd,
    totalOutUsd,
    totalInCdf,
    totalOutCdf,
    expectedUsd,
    expectedCdf,
  };
}

function buildMovementSummary(rows: CashMovement[]) {
  const inUsd = sumByDirection(rows, 'USD', 'IN');
  const outUsd = sumByDirection(rows, 'USD', 'OUT');
  const inCdf = sumByDirection(rows, 'CDF', 'IN');
  const outCdf = sumByDirection(rows, 'CDF', 'OUT');
  return {
    inUsd,
    outUsd,
    netUsd: roundMoney(inUsd - outUsd),
    inCdf,
    outCdf,
    netCdf: roundMoney(inCdf - outCdf),
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

function buildDashboardAlerts(session: CashSession | null, movementMetrics: ReturnType<typeof buildMovementMetrics>, settlementMetrics: SettlementMetrics) {
  const alerts: Array<{
    title: string;
    value: string;
    message: string;
    tone: 'success' | 'warning' | 'danger';
    action?: { label: string; to?: { pathname: string; search?: string }; onClick?: () => void };
  }> = [];
  if (!session) {
    alerts.push({ title: 'Caisse non ouverte', value: 'A surveiller', message: 'Aucune session ouverte pour le site selectionne.', tone: 'warning' });
    return alerts;
  }
  const durationHours = session.closedAt
    ? 0
    : (Date.now() - new Date(session.openedAt).getTime()) / (1000 * 60 * 60);
  if (durationHours > 12) {
    alerts.push({ title: 'Session longue', value: `${Math.round(durationHours)} h`, message: 'La session est ouverte depuis longtemps.', tone: 'warning' });
  }
  if (Math.abs(Number(session.closingDifferenceUsd ?? 0)) > 0 || Math.abs(Number(session.closingDifferenceCdf ?? 0)) > 0) {
    alerts.push({
      title: 'Ecart physique',
      value: `${formatMoney(Number(session.closingDifferenceUsd ?? 0), 'USD')} / ${formatMoney(Number(session.closingDifferenceCdf ?? 0), 'CDF')}`,
      message: 'Verifier la cloture physique de caisse.',
      tone: 'danger',
    });
  }
  if (settlementMetrics.underpayments > 0) {
    alerts.push({
      title: 'Reglements incomplets',
      value: formatMoney(settlementMetrics.underpayments, 'USD'),
      message: 'Certaines ventes ont ete validees avec un ecart de reglement.',
      tone: 'warning',
      action: { label: 'Voir les ecarts', to: { pathname: '/cash/settlement-differences' } },
    });
  }
  if (Math.abs(settlementMetrics.netCrumbs) > 0) {
    alerts.push({
      title: 'Miettes de reglement',
      value: formatMoney(settlementMetrics.netCrumbs, 'USD'),
      message: 'Ecart explique deja rattache aux ventes, distinct du physique.',
      tone: 'success',
    });
  }
  if (movementMetrics.grossSalePaymentsUsd === 0 && movementMetrics.grossSalePaymentsCdf === 0) {
    alerts.push({
      title: 'Aucun encaissement',
      value: '0 vente',
      message: 'Aucun paiement de vente sur la session selectionnee.',
      tone: 'warning',
    });
  }
  return alerts;
}

function paginate<T>(rows: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    page: safePage,
    totalPages,
  };
}

function movementTypes(rows: CashMovement[]) {
  return Array.from(new Set(rows.map((row) => row.movementType))).sort();
}

function movementLabel(type: string) {
  if (type === 'OPENING_BALANCE') return 'Solde initial';
  if (type === 'SALE_PAYMENT') return 'Paiement vente';
  if (type === 'SALE_CHANGE') return 'Monnaie rendue';
  if (type === 'EXPENSE') return 'Depense';
  if (type === 'CASH_IN') return 'Entree manuelle';
  if (type === 'CASH_OUT') return 'Sortie manuelle';
  if (type === 'BANK_DEPOSIT') return 'Depot banque';
  if (type === 'RECEIVABLE_PAYMENT') return 'Paiement creance';
  if (type === 'ADVANCE') return 'Avance';
  if (type === 'ADJUSTMENT') return 'Ajustement';
  return type;
}

function movementDirectionFor(movement: CashMovement) {
  if (['SALE_PAYMENT', 'CASH_IN', 'RECEIVABLE_PAYMENT', 'ADVANCE', 'OPENING_BALANCE'].includes(movement.movementType)) return 'IN';
  if (['SALE_CHANGE', 'EXPENSE', 'CASH_OUT', 'BANK_DEPOSIT'].includes(movement.movementType)) return 'OUT';
  return 'NEUTRAL';
}

function directionLabel(direction: string) {
  if (direction === 'IN') return 'Entree';
  if (direction === 'OUT') return 'Sortie';
  return 'Ajustement';
}

function sessionLabel(session: CashSession) {
  return `${session.status} - ${session.userName ?? 'Utilisateur'} - ${formatDate(session.openedAt)} ${formatTime(session.openedAt)}`;
}

function differenceBadgeClass(value: number) {
  if (value === 0) return 'status-badge success-badge';
  if (value > 0) return 'status-badge warning-badge';
  return 'status-badge danger-badge';
}

function physicalDifferenceLabel(value: number, currencyCode: string) {
  if (value === 0) return `Ecart nul - ${formatMoney(0, currencyCode)}`;
  if (value > 0) return `Surplus - ${formatMoney(value, currencyCode)}`;
  return `Manque - ${formatMoney(value, currencyCode)}`;
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

function sumByDirection(rows: CashMovement[], currencyCode: string, direction: 'IN' | 'OUT') {
  return roundMoney(rows
    .filter((row) => (row.currencyCode ?? 'USD') === currencyCode && movementDirectionFor(row) === direction)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0));
}

function sumAmounts(rows: Array<{ amount: number }>) {
  return roundMoney(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0));
}

function countMovementRows(rows: CashMovement[], type: string) {
  return rows.filter((row) => row.movementType === type).length;
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

function formatSessionDuration(session: CashSession) {
  const start = new Date(session.openedAt).getTime();
  const end = session.closedAt ? new Date(session.closedAt).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return '-';
  const totalMinutes = Math.round((end - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} h ${minutes.toString().padStart(2, '0')}`;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
