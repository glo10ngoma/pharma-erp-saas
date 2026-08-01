import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePermission } from '../../hooks/usePermission';
import { sitesService } from '../../services/sites.service';
import { stocksService, StockMovement } from '../../services/stocks.service';
import { usersService } from '../../services/users.service';
import { formatDate, fileDateStamp } from '../../utils/date';
import { downloadCsv, downloadJson, downloadXlsx } from '../../utils/export';
import {
  stockMovementDirectionClass,
  stockMovementDirectionLabel,
  stockMovementLabel,
  stockMovementSourceLabel,
  stockMovementSourceRoute,
} from './stockMovementLabels';

type DirectionFilter = 'ALL' | 'IN' | 'OUT';
type SortChoice = 'newest' | 'oldest' | 'quantityAsc' | 'quantityDesc' | 'articleAsc' | 'articleDesc';

const DEFAULT_LIMIT = 25;

export function StockMovementsView() {
  const { can } = usePermission();
  const [params, setParams] = useSearchParams();
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const [dismissedDefaultChips, setDismissedDefaultChips] = useState<Record<string, boolean>>({});
  const debouncedSearch = useDebouncedValue(params.get('search') ?? '', 300);

  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const limit = Number(params.get('limit') ?? `${DEFAULT_LIMIT}`);
  const sortBy = params.get('sortBy') ?? 'movementDate';
  const sortOrder = params.get('sortOrder') ?? 'desc';
  const sortChoice = toSortChoice(sortBy, sortOrder);
  const direction = (params.get('direction') ?? 'ALL') as DirectionFilter;
  const siteId = params.get('siteId') ?? '';
  const movementType = params.get('movementType') ?? '';
  const userId = params.get('userId') ?? '';
  const dateFrom = params.get('dateFrom') ?? monthStart();
  const dateTo = params.get('dateTo') ?? todayIso();

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      search: debouncedSearch || undefined,
      direction: direction === 'ALL' ? undefined : direction,
      siteId: siteId || undefined,
      movementType: movementType || undefined,
      userId: userId || undefined,
      dateFrom,
      dateTo,
      articleId: params.get('articleId') || undefined,
      lotId: params.get('lotId') || undefined,
      referenceType: params.get('referenceType') || undefined,
      referenceId: params.get('referenceId') || undefined,
      sortBy,
      sortOrder,
    }),
    [dateFrom, dateTo, debouncedSearch, direction, limit, movementType, page, params, siteId, sortBy, sortOrder, userId],
  );

  const movements = useQuery({
    queryKey: ['stock-movements', queryParams],
    queryFn: async () => (await stocksService.getMovements(queryParams)).data,
    placeholderData: (previous) => previous,
  });
  const sites = useQuery({
    queryKey: ['sites', 'stock-movements'],
    queryFn: async () => (await sitesService.getAll()).data,
    staleTime: 5 * 60 * 1000,
  });
  const users = useQuery({
    queryKey: ['users', 'stock-movements'],
    queryFn: async () => (await usersService.getAll()).data,
    staleTime: 5 * 60 * 1000,
  });

  const availableTypes = useMemo(() => {
    const values = new Set((movements.data?.items ?? []).map((item) => item.movementType));
    return [...values].sort();
  }, [movements.data?.items]);

  function updateFilters(next: Record<string, string | null>, resetPage = true) {
    const nextParams = new URLSearchParams(params);
    Object.entries(next).forEach(([key, value]) => {
      if (!value) nextParams.delete(key);
      else nextParams.set(key, value);
    });
    if (resetPage) nextParams.set('page', '1');
    setParams(nextParams);
  }

  async function exportRows(format: 'xlsx' | 'csv' | 'json') {
    const response = (await stocksService.exportMovements({ ...queryParams, page: undefined, limit: undefined })).data;
    const rows = buildMovementExportRows(response.items);
    const stamp = fileDateStamp();
    if (format === 'xlsx') downloadXlsx(`mouvements_stock_${stamp}.xlsx`, [{ name: 'Mouvements', rows }]);
    if (format === 'csv') downloadCsv(`mouvements_stock_${stamp}.csv`, rows);
    if (format === 'json') downloadJson(`mouvements_stock_${stamp}.json`, response.items);
  }

  const summary = movements.data?.summary;
  const rows = movements.data?.items ?? [];
  const dateShortcut = activeDateShortcut(dateFrom, dateTo);
  const activeFilterChips = buildActiveFilterChips({
    direction,
    movementType,
    siteId,
    dateFrom,
    dateTo,
    sites: sites.data ?? [],
    dismissedDefaultChips,
  });
  const resultFrom = rows.length === 0 ? 0 : (page - 1) * limit + 1;
  const resultTo = rows.length === 0 ? 0 : resultFrom + rows.length - 1;

  useEffect(() => {
    setDismissedDefaultChips({});
  }, [direction, movementType, siteId, dateFrom, dateTo]);

  function clearAllFilters() {
    setDismissedDefaultChips({});
    updateFilters({
      search: null,
      dateFrom: monthStart(),
      dateTo: todayIso(),
      direction: null,
      movementType: null,
      siteId: null,
      userId: null,
      articleId: null,
      lotId: null,
      referenceType: null,
      referenceId: null,
      sortBy: 'movementDate',
      sortOrder: 'desc',
      limit: `${DEFAULT_LIMIT}`,
    });
  }

  function dismissChip(key: string) {
    if (key === 'period') {
      if (dateShortcut === 'custom') {
        updateFilters({ dateFrom: monthStart(), dateTo: todayIso() });
        return;
      }
      setDismissedDefaultChips((current) => ({ ...current, period: true }));
      return;
    }
    if (key === 'direction') {
      if (direction === 'ALL') {
        setDismissedDefaultChips((current) => ({ ...current, direction: true }));
        return;
      }
      updateFilters({ direction: null });
      return;
    }
    if (key === 'movementType') {
      if (!movementType) {
        setDismissedDefaultChips((current) => ({ ...current, movementType: true }));
        return;
      }
      updateFilters({ movementType: null });
      return;
    }
    if (key === 'site') {
      if (!siteId) {
        setDismissedDefaultChips((current) => ({ ...current, site: true }));
        return;
      }
      updateFilters({ siteId: null });
    }
  }

  return (
    <>
      <div className="stats-grid stock-kpis stock-movement-kpis">
        <div className="card kpi-card">
          <span className="kpi-label">Mouvements</span>
          <p className="metric small-metric">{summary?.movementCount ?? 0}</p>
        </div>
        <div className="card kpi-card">
          <span className="kpi-label">Entrees</span>
          <p className="metric small-metric">{summary?.entryCount ?? 0}</p>
        </div>
        <div className="card kpi-card">
          <span className="kpi-label">Sorties</span>
          <p className="metric small-metric">{summary?.exitCount ?? 0}</p>
        </div>
        <div className="card kpi-card">
          <span className="kpi-label">Articles</span>
          <p className="metric small-metric">{summary?.articlesCount ?? 0}</p>
        </div>
        <div className="card kpi-card">
          <span className="kpi-label">Lots</span>
          <p className="metric small-metric">{summary?.lotsCount ?? 0}</p>
        </div>
      </div>

      <div className="card stock-movements-filter-bar">
        <div className="stock-movements-filter-row">
          <div className="stock-movements-filter-field stock-movements-search-field">
            <label className="stock-movements-filter-label" htmlFor="stock-movements-search">Recherche</label>
            <SearchBox
              inputId="stock-movements-search"
              value={params.get('search') ?? ''}
              onChange={(value) => updateFilters({ search: value || null })}
              placeholder="Rechercher article, lot ou référence"
            />
          </div>
          <div className="stock-movements-filter-field stock-movements-date-field">
            <label className="stock-movements-filter-label" htmlFor="stock-movements-date-from">Du</label>
            <input
              id="stock-movements-date-from"
              aria-label="Date de début"
              className="input compact-input"
              type="date"
              value={dateFrom}
              onChange={(event) => updateFilters({ dateFrom: event.target.value || null })}
            />
          </div>
          <div className="stock-movements-filter-field stock-movements-date-field">
            <label className="stock-movements-filter-label" htmlFor="stock-movements-date-to">Au</label>
            <input
              id="stock-movements-date-to"
              aria-label="Date de fin"
              className="input compact-input"
              type="date"
              value={dateTo}
              onChange={(event) => updateFilters({ dateTo: event.target.value || null })}
            />
          </div>
          <div className="stock-movements-filter-field stock-movements-sense-field">
            <label className="stock-movements-filter-label" htmlFor="stock-movements-direction">Sens</label>
            <select
              id="stock-movements-direction"
              className="input compact-input"
              value={direction}
              onChange={(event) => updateFilters({ direction: event.target.value === 'ALL' ? null : event.target.value })}
            >
              <option value="ALL">Tous les sens</option>
              <option value="IN">Entrees</option>
              <option value="OUT">Sorties</option>
            </select>
          </div>
          <div className="stock-movements-filter-field stock-movements-type-field">
            <label className="stock-movements-filter-label" htmlFor="stock-movements-type">Type</label>
            <select
              id="stock-movements-type"
              className="input compact-input"
              value={movementType}
              onChange={(event) => updateFilters({ movementType: event.target.value || null })}
            >
              <option value="">Tous les types</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {stockMovementLabel(type)}
                </option>
              ))}
            </select>
          </div>
          <div className="stock-movements-filter-field stock-movements-site-field">
            <label className="stock-movements-filter-label" htmlFor="stock-movements-site">Site</label>
            <select
              id="stock-movements-site"
              className="input compact-input"
              value={siteId}
              onChange={(event) => updateFilters({ siteId: event.target.value || null })}
            >
              <option value="">Tous les sites</option>
              {(sites.data ?? []).map((site) => (
                <option key={site.siteId} value={site.siteId}>
                  {site.siteName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="stock-movements-filter-row stock-movements-filter-row-secondary">
          <div className="stock-movements-filter-field stock-movements-user-field">
            <label className="stock-movements-filter-label" htmlFor="stock-movements-user">Utilisateur</label>
            <select
              id="stock-movements-user"
              className="input compact-input"
              value={userId}
              onChange={(event) => updateFilters({ userId: event.target.value || null })}
            >
              <option value="">Tous les utilisateurs</option>
              {(users.data ?? []).map((user) => (
                <option key={user.userId} value={user.userId}>
                  {user.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="stock-movements-filter-field stock-movements-sort-field">
            <label className="stock-movements-filter-label" htmlFor="stock-movements-sort">Trier par</label>
            <select
              id="stock-movements-sort"
              className="input compact-input"
              value={sortChoice}
              onChange={(event) => updateFilters(sortChoiceToParams(event.target.value as SortChoice))}
            >
              <option value="newest">Plus recent</option>
              <option value="oldest">Plus ancien</option>
              <option value="quantityAsc">Quantite croissante</option>
              <option value="quantityDesc">Quantite decroissante</option>
              <option value="articleAsc">Article A-Z</option>
              <option value="articleDesc">Article Z-A</option>
            </select>
          </div>
          <div className="stock-movements-filter-field stock-movements-page-size-field">
            <label className="stock-movements-filter-label" htmlFor="stock-movements-limit">Lignes par page</label>
            <select
              id="stock-movements-limit"
              className="input compact-input"
              value={String(limit)}
              onChange={(event) => updateFilters({ limit: event.target.value })}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
          <div className="stock-movements-date-shortcuts" aria-label="Raccourcis de periode">
            <button className={`ghost-button compact-button ${dateShortcut === 'today' ? 'is-active' : ''}`} type="button" onClick={() => setQuickRange('today', setParams)}>
              Aujourd&apos;hui
            </button>
            <button className={`ghost-button compact-button ${dateShortcut === 'week' ? 'is-active' : ''}`} type="button" onClick={() => setQuickRange('week', setParams)}>
              Cette semaine
            </button>
            <button className={`ghost-button compact-button ${dateShortcut === 'month' ? 'is-active' : ''}`} type="button" onClick={() => setQuickRange('month', setParams)}>
              Ce mois
            </button>
          </div>
          <div className="stock-movements-filter-actions">
            <button className="ghost-button compact-button stock-movements-reset-button" type="button" onClick={clearAllFilters}>
              Reinitialiser
            </button>
            {can('stock_movements.export') && (
              <div className="export-actions stock-export-actions">
                <details className="export-menu">
                  <summary className="button compact-button stock-movements-export-summary">Exporter</summary>
                  <div className="export-menu-panel">
                    <button type="button" disabled={rows.length === 0} onClick={() => exportRows('xlsx')}>
                      Excel
                    </button>
                    <button type="button" disabled={rows.length === 0} onClick={() => exportRows('csv')}>
                      CSV
                    </button>
                    <button type="button" disabled={rows.length === 0} onClick={() => exportRows('json')}>
                      JSON
                    </button>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeFilterChips.length > 0 ? (
        <div className="card stock-movements-active-filters" aria-label="Filtres actifs">
          <strong className="stock-movements-active-label">Filtres actifs :</strong>
          <div className="stock-movements-chip-list">
            {activeFilterChips.map((chip) => (
              <button className="stock-movements-filter-chip" key={chip.key} type="button" onClick={() => dismissChip(chip.key)}>
                <span>{chip.label}</span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
          <button className="stock-movements-clear-all" type="button" onClick={clearAllFilters}>
            Effacer tous
          </button>
        </div>
      ) : null}

      <div className="stocks-table-meta">
        <span>{movements.data ? `${movements.data.total} mouvements` : 'Historique des mouvements'}</span>
        {movements.isFetching ? <span className="muted">Mise a jour...</span> : null}
      </div>

      <div className="card stock-movements-table-card">
        {movements.isLoading ? (
          <p className="loading-state">Chargement de l&apos;historique des mouvements...</p>
        ) : movements.isError ? (
          <div className="error-state">
            <p>Impossible de charger l&apos;historique des mouvements.</p>
            <button className="ghost-button compact-button" type="button" onClick={() => movements.refetch()}>
              Reessayer
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="empty-state">Aucun mouvement trouve pour cette periode.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table stocks-table stock-movements-table">
              <thead>
                <tr>
                  <th>Date ↓</th>
                  <th>Article</th>
                  <th>Lot</th>
                  <th>Mouvement</th>
                  <th>Sens</th>
                  <th>Quantite</th>
                  <th>Unite</th>
                  <th>Stock apres</th>
                  <th>Origine</th>
                  <th>Utilisateur</th>
                  <th>Site</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((movement) => {
                  const sourceRoute = stockMovementSourceRoute(movement);
                  return (
                    <tr className="stocks-row" key={movement.movementId}>
                      <td className="stocks-cell">
                        <strong>{formatDate(movement.movementDate)}</strong>
                        <small>{formatTime(movement.movementDate)}</small>
                      </td>
                      <td className="stocks-cell">
                        <strong>{movement.commercialName ?? '-'}</strong>
                        <small>{movement.articleCode ?? '-'}</small>
                      </td>
                      <td className="stocks-cell">{movement.lotNumber ?? '-'}</td>
                      <td className="stocks-cell">{stockMovementLabel(movement.movementType)}</td>
                      <td className="stocks-cell">
                        <span className={`badge compact-badge ${stockMovementDirectionClass(movement.direction)}`}>{stockMovementDirectionLabel(movement.direction)}</span>
                      </td>
                      <td className="stocks-cell quantity-cell">{movement.quantity}</td>
                      <td className="stocks-cell">{movement.unitLabel ?? 'Non disponible'}</td>
                      <td className="stocks-cell quantity-cell">{movement.stockAfter ?? '-'}</td>
                      <td className="stocks-cell">{stockMovementSourceLabel(movement)}</td>
                      <td className="stocks-cell">{movement.userName ?? 'Utilisateur inconnu'}</td>
                      <td className="stocks-cell">{movement.siteName ?? '-'}</td>
                      <td className="stocks-cell stock-movement-actions">
                        <button className="ghost-button compact-button" type="button" onClick={() => setSelectedMovement(movement)}>
                          Voir
                        </button>
                        {sourceRoute ? (
                          <Link className="ghost-button compact-button" to={sourceRoute}>
                            Ouvrir
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="table-pagination stock-movements-pagination">
        <div className="stock-movements-pagination-controls">
          <button
            className="ghost-button compact-button"
            type="button"
            aria-label="Premiere page"
            disabled={page <= 1 || movements.isFetching}
            onClick={() => updateFilters({ page: '1' }, false)}
          >
            &laquo;
          </button>
          <button
            className="ghost-button compact-button"
            type="button"
            aria-label="Page precedente"
            disabled={page <= 1 || movements.isFetching}
            onClick={() => updateFilters({ page: String(Math.max(1, page - 1)) }, false)}
          >
            &lsaquo;
          </button>
          <span className="stock-movements-page-indicator">
            Page <strong>{movements.data?.page ?? 1}</strong> sur <strong>{movements.data?.totalPages ?? 1}</strong>
          </span>
          <button
            className="ghost-button compact-button"
            type="button"
            aria-label="Page suivante"
            disabled={!movements.data || page >= movements.data.totalPages || movements.isFetching}
            onClick={() => updateFilters({ page: String(page + 1) }, false)}
          >
            &rsaquo;
          </button>
          <button
            className="ghost-button compact-button"
            type="button"
            aria-label="Derniere page"
            disabled={!movements.data || page >= movements.data.totalPages || movements.isFetching}
            onClick={() => updateFilters({ page: String(movements.data?.totalPages ?? 1) }, false)}
          >
            &raquo;
          </button>
        </div>
        <span className="stock-movements-pagination-summary">
          Affichage de {resultFrom} a {resultTo} sur {movements.data?.total ?? 0} resultats
        </span>
      </div>

      <Modal title="Detail mouvement de stock" open={Boolean(selectedMovement)} onClose={() => setSelectedMovement(null)}>
        {selectedMovement && <StockMovementDetail movement={selectedMovement} />}
      </Modal>
    </>
  );
}

function StockMovementDetail({ movement }: { movement: StockMovement }) {
  const sourceRoute = stockMovementSourceRoute(movement);
  return (
    <div className="stock-detail">
      <div className="detail-grid">
        <div><span>ID mouvement</span><strong>{movement.movementId}</strong></div>
        <div><span>Date</span><strong>{formatDate(movement.movementDate)} {formatTime(movement.movementDate)}</strong></div>
        <div><span>Article</span><strong>{movement.commercialName ?? '-'}</strong></div>
        <div><span>Code article</span><strong>{movement.articleCode ?? '-'}</strong></div>
        <div><span>Lot</span><strong>{movement.lotNumber ?? '-'}</strong></div>
        <div><span>Type</span><strong>{stockMovementLabel(movement.movementType)}</strong></div>
        <div><span>Sens</span><strong>{stockMovementDirectionLabel(movement.direction)}</strong></div>
        <div><span>Quantite</span><strong>{movement.quantity}</strong></div>
        <div><span>Unite</span><strong>{movement.unitLabel ?? 'Non disponible'}</strong></div>
        <div><span>Stock avant</span><strong>{movement.stockBefore ?? 'Non disponible'}</strong></div>
        <div><span>Stock apres</span><strong>{movement.stockAfter ?? 'Non disponible'}</strong></div>
        <div><span>Utilisateur</span><strong>{movement.userName ?? 'Utilisateur inconnu'}</strong></div>
        <div><span>Poste</span><strong>{movement.workstationName ?? 'Non disponible'}</strong></div>
        <div><span>Site</span><strong>{movement.siteName ?? '-'}</strong></div>
        <div><span>Document source</span><strong>{stockMovementSourceLabel(movement)}</strong></div>
        <div><span>Reference</span><strong>{movement.referenceId ?? '-'}</strong></div>
        <div><span>Motif</span><strong>{movement.notes ?? '-'}</strong></div>
      </div>
      {sourceRoute ? (
        <div className="stock-detail-actions">
          <Link className="ghost-button compact-button" to={sourceRoute}>Ouvrir le document source</Link>
        </div>
      ) : (
        <p className="muted">Document source non disponible.</p>
      )}
      <p className="muted">Les mouvements de stock sont immuables. Toute correction doit passer par une operation metier de regularisation.</p>
    </div>
  );
}

function buildMovementExportRows(items: StockMovement[]) {
  return [
    ['Date', 'Heure', 'Article', 'Code article', 'Lot', 'Type', 'Sens', 'Quantite', 'Unite', 'Site', 'Utilisateur', 'Origine', 'Reference', 'Note'],
    ...items.map((movement) => [
      formatDate(movement.movementDate),
      formatTime(movement.movementDate),
      movement.commercialName ?? '-',
      movement.articleCode ?? '-',
      movement.lotNumber ?? '-',
      stockMovementLabel(movement.movementType),
      stockMovementDirectionLabel(movement.direction),
      movement.quantity,
      movement.unitLabel ?? '-',
      movement.siteName ?? '-',
      movement.userName ?? 'Utilisateur inconnu',
      stockMovementSourceLabel(movement),
      movement.referenceId ?? '-',
      movement.notes ?? '-',
    ]),
  ];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function toSortChoice(sortBy: string, sortOrder: string): SortChoice {
  if (sortBy === 'movementDate' && sortOrder === 'asc') return 'oldest';
  if (sortBy === 'quantity' && sortOrder === 'asc') return 'quantityAsc';
  if (sortBy === 'quantity' && sortOrder === 'desc') return 'quantityDesc';
  if (sortBy === 'article' && sortOrder === 'asc') return 'articleAsc';
  if (sortBy === 'article' && sortOrder === 'desc') return 'articleDesc';
  return 'newest';
}

function sortChoiceToParams(choice: SortChoice) {
  if (choice === 'oldest') return { sortBy: 'movementDate', sortOrder: 'asc' };
  if (choice === 'quantityAsc') return { sortBy: 'quantity', sortOrder: 'asc' };
  if (choice === 'quantityDesc') return { sortBy: 'quantity', sortOrder: 'desc' };
  if (choice === 'articleAsc') return { sortBy: 'article', sortOrder: 'asc' };
  if (choice === 'articleDesc') return { sortBy: 'article', sortOrder: 'desc' };
  return { sortBy: 'movementDate', sortOrder: 'desc' };
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function setQuickRange(range: 'today' | 'week' | 'month', setParams: ReturnType<typeof useSearchParams>[1]) {
  const now = new Date();
  const to = todayIso();
  let from = to;
  if (range === 'week') {
    const day = now.getDay();
    const distance = day === 0 ? 6 : day - 1;
    now.setDate(now.getDate() - distance);
    from = now.toISOString().slice(0, 10);
  }
  if (range === 'month') from = monthStart();
  setParams((current) => {
    const next = new URLSearchParams(current);
    next.set('dateFrom', from);
    next.set('dateTo', to);
    next.set('page', '1');
    return next;
  });
}

function activeDateShortcut(dateFrom: string, dateTo: string) {
  if (dateFrom === todayIso() && dateTo === todayIso()) return 'today';
  if (dateFrom === monthStart() && dateTo === todayIso()) return 'month';

  const now = new Date();
  const day = now.getDay();
  const distance = day === 0 ? 6 : day - 1;
  now.setDate(now.getDate() - distance);
  const weekStart = now.toISOString().slice(0, 10);
  if (dateFrom === weekStart && dateTo === todayIso()) return 'week';
  return 'custom';
}

function buildActiveFilterChips(input: {
  direction: DirectionFilter;
  movementType: string;
  siteId: string;
  dateFrom: string;
  dateTo: string;
  sites: Array<{ siteId: string; siteName: string | null }>;
  dismissedDefaultChips: Record<string, boolean>;
}) {
  const chips: Array<{ key: string; label: string }> = [];
  const shortcut = activeDateShortcut(input.dateFrom, input.dateTo);
  if (!input.dismissedDefaultChips.period) {
    if (shortcut === 'today') chips.push({ key: 'period', label: "Periode : Aujourd'hui" });
    else if (shortcut === 'week') chips.push({ key: 'period', label: 'Periode : Cette semaine' });
    else if (shortcut === 'month') chips.push({ key: 'period', label: 'Periode : Ce mois' });
    else if (input.dateFrom || input.dateTo) chips.push({ key: 'period', label: `Periode : ${formatDate(input.dateFrom)} - ${formatDate(input.dateTo)}` });
  }
  if (!input.dismissedDefaultChips.direction) {
    chips.push({ key: 'direction', label: input.direction === 'IN' ? 'Sens : Entrees' : input.direction === 'OUT' ? 'Sens : Sorties' : 'Sens : Tous' });
  }
  if (!input.dismissedDefaultChips.movementType) {
    chips.push({ key: 'movementType', label: `Type : ${input.movementType ? stockMovementLabel(input.movementType) : 'Tous'}` });
  }
  if (!input.dismissedDefaultChips.site) {
    chips.push({ key: 'site', label: `Site : ${input.siteId ? input.sites.find((site) => site.siteId === input.siteId)?.siteName ?? input.siteId : 'Tous'}` });
  }
  return chips;
}
