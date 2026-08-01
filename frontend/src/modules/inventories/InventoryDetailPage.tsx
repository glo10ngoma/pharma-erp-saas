import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { CommentsPanel } from '../../components/CommentsPanel';
import { FloatingSearchPopover } from '../../components/FloatingSearchPopover';
import { Modal } from '../../components/Modal';
import { apiErrorMessage } from '../../services/apiError';
import { articlesService } from '../../services/articles.service';
import { FillEmptyWithZeroResult, inventoriesService, Inventory, InventoryItem } from '../../services/inventories.service';
import { lotsService } from '../../services/lots.service';
import { stocksService, Stock } from '../../services/stocks.service';
import { formatDate, fileDateStamp } from '../../utils/date';
import { downloadCsv, downloadJson, downloadXlsx } from '../../utils/export';
import { fetchAllPages } from '../../utils/fetchAllPages';
import { formatMoney } from '../../utils/money';

type QuickLine = { stockId: string; query: string; physicalQuantity: string; reason: string };
type LineFilter = 'ALL' | 'EMPTY' | 'COUNTED' | 'DIFF' | 'GAIN' | 'LOSS' | 'MATCH';
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type PrintMode = 'blank' | 'filled' | null;
type StoredDraft = {
  physicalByItem: Record<string, string>;
  reasonByItem: Record<string, string>;
};

const emptyQuickLine = (): QuickLine => ({ stockId: '', query: '', physicalQuantity: '', reason: '' });

export function InventoryDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const { currentUser, permissions } = useAuth();
  const lineInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const reasonSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveResetTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [physicalByItem, setPhysicalByItem] = useState<Record<string, string>>({});
  const [reasonByItem, setReasonByItem] = useState<Record<string, string>>({});
  const [saveStateByItem, setSaveStateByItem] = useState<Record<string, SaveState>>({});
  const [saveErrorByItem, setSaveErrorByItem] = useState<Record<string, string>>({});
  const [quickLine, setQuickLine] = useState<QuickLine>(emptyQuickLine());
  const [quickPickerOpen, setQuickPickerOpen] = useState(false);
  const [clientError, setClientError] = useState('');
  const [lineSearch, setLineSearch] = useState('');
  const [lineFilter, setLineFilter] = useState<LineFilter>('ALL');
  const [fillZeroConfirmOpen, setFillZeroConfirmOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [validateConfirmOpen, setValidateConfirmOpen] = useState(false);
  const [fillZeroResult, setFillZeroResult] = useState<FillEmptyWithZeroResult | null>(null);
  const [printMode, setPrintMode] = useState<PrintMode>(null);

  const inventory = useQuery({
    queryKey: ['inventory', id],
    queryFn: async () => (await inventoriesService.getById(id)).data,
  });
  const stocks = useQuery({ queryKey: ['stocks'], queryFn: async () => (await stocksService.getAll()).data });
  const lots = useQuery({ queryKey: ['lots'], queryFn: async () => (await lotsService.getAll()).data });
  const articles = useQuery({
    queryKey: ['articles', 'inventory-detail'],
    queryFn: async () =>
      fetchAllPages(
        async ({ page, limit }) => (await articlesService.getAll({ page, limit })).data,
        { getKey: (article) => article.articleId },
      ),
  });

  const current = inventory.data;
  const rows = current?.items ?? [];
  const availableStocks = (stocks.data ?? []).filter((stock) => !current?.siteId || stock.siteId === current.siteId);
  const lotPriceById = useMemo(
    () => new Map((lots.data ?? []).map((lot) => [lot.lotId, { purchasePrice: lot.purchasePrice, sellingPrice: lot.sellingPrice }])),
    [lots.data],
  );
  const articleById = useMemo(() => new Map((articles.data ?? []).map((article) => [article.articleId, article])), [articles.data]);
  const selectedStock = availableStocks.find((stock) => stock.stockId === quickLine.stockId);
  const suggestions = inventoryStockSuggestions(availableStocks, quickLine.query, articleById).slice(0, 50);
  const draftStorageKey = current?.inventoryId
    ? `inventory-draft:${currentUser?.tenantId ?? 'tenant'}:${currentUser?.id ?? 'user'}:${current.inventoryId}`
    : null;

  const effectiveRows = useMemo(
    () =>
      rows.map((item) => {
        const physicalValue = physicalByItem[item.inventoryItemId];
        const physicalQuantity = physicalValue === undefined || physicalValue === ''
          ? item.physicalQuantity
          : Number(physicalValue);
        const differenceQuantity = physicalQuantity === null || physicalQuantity === undefined || Number.isNaN(Number(physicalQuantity))
          ? item.differenceQuantity
          : Number(physicalQuantity) - Number(item.systemQuantity);
        return {
          ...item,
          physicalQuantity,
          differenceQuantity,
          reason: reasonByItem[item.inventoryItemId] ?? item.reason,
        };
      }),
    [physicalByItem, reasonByItem, rows],
  );

  const sortedRows = useMemo(
    () =>
      [...effectiveRows].sort((left, right) => {
        const quantityDiff = Number(right.systemQuantity ?? 0) - Number(left.systemQuantity ?? 0);
        if (quantityDiff !== 0) return quantityDiff;
        const nameCompare = String(left.commercialName ?? '').localeCompare(String(right.commercialName ?? ''), 'fr', { sensitivity: 'base' });
        if (nameCompare !== 0) return nameCompare;
        return String(left.lotNumber ?? '').localeCompare(String(right.lotNumber ?? ''), 'fr', { sensitivity: 'base' });
      }),
    [effectiveRows],
  );

  const visibleRows = useMemo(() => {
    const needle = lineSearch.trim().toLowerCase();
    return sortedRows.filter((item) => {
      if (needle) {
        const haystack = [
          item.articleCode,
          item.commercialName,
          item.lotNumber,
          item.stockUnitLabel,
          item.reason,
        ]
          .map((value) => String(value ?? '').toLowerCase())
          .join(' ');
        if (!haystack.includes(needle)) return false;
      }
      const diff = Number(item.differenceQuantity ?? 0);
      if (lineFilter === 'EMPTY') return item.physicalQuantity === null;
      if (lineFilter === 'COUNTED') return item.physicalQuantity !== null;
      if (lineFilter === 'DIFF') return item.physicalQuantity !== null && diff !== 0;
      if (lineFilter === 'GAIN') return item.physicalQuantity !== null && diff > 0;
      if (lineFilter === 'LOSS') return item.physicalQuantity !== null && diff < 0;
      if (lineFilter === 'MATCH') return item.physicalQuantity !== null && diff === 0;
      return true;
    });
  }, [lineFilter, lineSearch, sortedRows]);

  const totals = useMemo(() => inventoryTotals(effectiveRows, lotPriceById), [effectiveRows, lotPriceById]);
  const countedCount = useMemo(() => effectiveRows.filter((item) => item.physicalQuantity !== null).length, [effectiveRows]);
  const remainingCount = Math.max(effectiveRows.length - countedCount, 0);
  const zeroCount = useMemo(() => effectiveRows.filter((item) => Number(item.physicalQuantity ?? Number.NaN) === 0).length, [effectiveRows]);
  const progressPercent = effectiveRows.length === 0 ? 0 : Math.round((countedCount / effectiveRows.length) * 100);
  const hasBlockingError = effectiveRows.some((item) => current?.status === 'IN_PROGRESS' && Number(physicalByItem[item.inventoryItemId] ?? item.physicalQuantity ?? 0) < 0);
  const hasSavingLines = Object.values(saveStateByItem).some((state) => state === 'saving');
  const hasDirtyLines = Object.values(saveStateByItem).some((state) => state === 'dirty');
  const hasSaveErrors = Object.values(saveStateByItem).some((state) => state === 'error');
  const canCount = permissions.includes('inventories.count');
  const canClose = permissions.includes('inventories.close');
  const canValidate = permissions.includes('inventories.validate');
  const canPrint = permissions.includes('inventories.print') || currentUser?.role === 'ADMIN';
  const canFillZero = permissions.includes('inventories.fill_empty_zero');

  useEffect(() => {
    if (!draftStorageKey) return;
    const draft = readInventoryDraft(draftStorageKey);
    setPhysicalByItem(draft?.physicalByItem ?? {});
    setReasonByItem(draft?.reasonByItem ?? {});
    setSaveStateByItem(
      Object.keys({
        ...(draft?.physicalByItem ?? {}),
        ...(draft?.reasonByItem ?? {}),
      }).reduce<Record<string, SaveState>>((acc, itemId) => {
        acc[itemId] = 'dirty';
        return acc;
      }, {}),
    );
    setSaveErrorByItem({});
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftStorageKey) return;
    const hasDrafts = Object.keys(physicalByItem).length > 0 || Object.keys(reasonByItem).length > 0;
    if (!hasDrafts) {
      localStorage.removeItem(draftStorageKey);
      return;
    }
    const payload: StoredDraft = { physicalByItem, reasonByItem };
    localStorage.setItem(draftStorageKey, JSON.stringify(payload));
  }, [draftStorageKey, physicalByItem, reasonByItem]);

  useEffect(() => {
    if (!printMode) return;
    const cleanup = () => setPrintMode(null);
    window.addEventListener('afterprint', cleanup);
    const timeout = window.setTimeout(() => window.print(), 60);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('afterprint', cleanup);
    };
  }, [printMode]);

  useEffect(() => () => {
    Object.values(reasonSaveTimers.current).forEach((timer) => clearTimeout(timer));
    Object.values(saveResetTimers.current).forEach((timer) => clearTimeout(timer));
  }, []);

  function setInventoryData(next: Inventory) {
    qc.setQueryData<Inventory>(['inventory', id], next);
  }

  function setInventoryItems(items: InventoryItem[]) {
    qc.setQueryData<Inventory | undefined>(['inventory', id], (previous) => {
      if (!previous) return previous;
      return { ...previous, items };
    });
  }

  function invalidateInventoryLists() {
    qc.invalidateQueries({ queryKey: ['inventories'] });
  }

  const start = useMutation({
    mutationFn: () => inventoriesService.start(id),
    onSuccess: (response) => {
      setInventoryData(response.data);
      invalidateInventoryLists();
    },
  });

  const close = useMutation({
    mutationFn: () => inventoriesService.close(id),
    onSuccess: (response) => {
      setInventoryData(response.data);
      invalidateInventoryLists();
      setCloseConfirmOpen(false);
    },
  });

  const validate = useMutation({
    mutationFn: () => inventoriesService.validate(id),
    onSuccess: (response) => {
      setInventoryData(response.data);
      qc.invalidateQueries({ queryKey: ['inventories'] });
      qc.invalidateQueries({ queryKey: ['stocks'] });
      setValidateConfirmOpen(false);
    },
  });

  const addItem = useMutation({
    mutationFn: () =>
      inventoriesService.addItem(id, {
        articleId: selectedStock?.articleId,
        lotId: selectedStock?.lotId,
        physicalQuantity: quickLine.physicalQuantity === '' ? undefined : Number(quickLine.physicalQuantity),
        reason: quickLine.reason || undefined,
      }),
    onSuccess: (response) => {
      setInventoryItems(response.data);
      setQuickLine(emptyQuickLine());
      setClientError('');
      invalidateInventoryLists();
    },
  });

  const updateItem = useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: Record<string, unknown> }) =>
      inventoriesService.updateItem(id, itemId, payload),
  });

  const fillEmptyZero = useMutation({
    mutationFn: () => inventoriesService.fillEmptyWithZero(id),
    onSuccess: (response) => {
      setInventoryData(response.data.inventory);
      setFillZeroResult(response.data);
      setFillZeroConfirmOpen(false);
      setPhysicalByItem({});
      setReasonByItem({});
      setSaveStateByItem({});
      setSaveErrorByItem({});
      if (draftStorageKey) localStorage.removeItem(draftStorageKey);
      invalidateInventoryLists();
    },
  });

  const error = inventory.error || start.error || close.error || validate.error || addItem.error || updateItem.error || fillEmptyZero.error;

  function clearLineDraft(itemId: string) {
    setPhysicalByItem((currentMap) => {
      if (!(itemId in currentMap)) return currentMap;
      const next = { ...currentMap };
      delete next[itemId];
      return next;
    });
    setReasonByItem((currentMap) => {
      if (!(itemId in currentMap)) return currentMap;
      const next = { ...currentMap };
      delete next[itemId];
      return next;
    });
    setSaveErrorByItem((currentMap) => {
      if (!(itemId in currentMap)) return currentMap;
      const next = { ...currentMap };
      delete next[itemId];
      return next;
    });
  }

  function markSaved(itemId: string) {
    setSaveStateByItem((currentMap) => ({ ...currentMap, [itemId]: 'saved' }));
    if (saveResetTimers.current[itemId]) clearTimeout(saveResetTimers.current[itemId]);
    saveResetTimers.current[itemId] = setTimeout(() => {
      setSaveStateByItem((currentMap) => {
        if (currentMap[itemId] !== 'saved') return currentMap;
        const next = { ...currentMap };
        delete next[itemId];
        return next;
      });
    }, 1800);
  }

  async function saveLine(item: InventoryItem) {
    const itemId = item.inventoryItemId;
    if (saveStateByItem[itemId] === 'saving') return false;

    const rawPhysical = physicalByItem[itemId];
    const rawReason = reasonByItem[itemId];
    const nextReason = rawReason === undefined ? item.reason ?? undefined : rawReason.trim() || undefined;

    if (rawPhysical === '') {
      if (item.physicalQuantity === null) {
        setSaveStateByItem((currentMap) => ({ ...currentMap, [itemId]: 'error' }));
        setSaveErrorByItem((currentMap) => ({ ...currentMap, [itemId]: 'Stock physique requis.' }));
        return false;
      }
      setPhysicalByItem((currentMap) => {
        const next = { ...currentMap };
        delete next[itemId];
        return next;
      });
      markSaved(itemId);
      return true;
    }

    const payload: Record<string, unknown> = {};
    if (rawPhysical !== undefined) {
      const parsed = Number(rawPhysical);
      if (Number.isNaN(parsed) || parsed < 0) {
        setSaveStateByItem((currentMap) => ({ ...currentMap, [itemId]: 'error' }));
        setSaveErrorByItem((currentMap) => ({ ...currentMap, [itemId]: 'Quantite invalide.' }));
        return false;
      }
      payload.physicalQuantity = parsed;
    }
    if (rawReason !== undefined || nextReason !== item.reason) {
      payload.reason = nextReason ?? null;
    }

    if (Object.keys(payload).length === 0) {
      markSaved(itemId);
      return true;
    }

    setSaveStateByItem((currentMap) => ({ ...currentMap, [itemId]: 'saving' }));
    setSaveErrorByItem((currentMap) => {
      if (!(itemId in currentMap)) return currentMap;
      const next = { ...currentMap };
      delete next[itemId];
      return next;
    });

    try {
      const response = await updateItem.mutateAsync({ itemId, payload });
      setInventoryItems(response.data);
      clearLineDraft(itemId);
      markSaved(itemId);
      return true;
    } catch (saveError) {
      setSaveStateByItem((currentMap) => ({ ...currentMap, [itemId]: 'error' }));
      setSaveErrorByItem((currentMap) => ({ ...currentMap, [itemId]: apiErrorMessage(saveError) }));
      return false;
    }
  }

  function scheduleReasonSave(item: InventoryItem, value: string) {
    const itemId = item.inventoryItemId;
    setReasonByItem((currentMap) => ({ ...currentMap, [itemId]: value }));
    setSaveStateByItem((currentMap) => ({ ...currentMap, [itemId]: 'dirty' }));
    if (reasonSaveTimers.current[itemId]) clearTimeout(reasonSaveTimers.current[itemId]);
    reasonSaveTimers.current[itemId] = setTimeout(() => {
      void saveLine(item);
    }, 700);
  }

  function focusLine(itemId: string) {
    const target = lineInputRefs.current[itemId];
    if (!target) return;
    target.focus();
    target.select();
    target.scrollIntoView({ block: 'nearest' });
  }

  function focusAdjacent(itemId: string, step: number) {
    const index = visibleRows.findIndex((row) => row.inventoryItemId === itemId);
    const targetIndex = index + step;
    if (targetIndex < 0 || targetIndex >= visibleRows.length) {
      focusLine(itemId);
      return;
    }
    focusLine(visibleRows[targetIndex].inventoryItemId);
  }

  async function handlePhysicalEnter(event: KeyboardEvent<HTMLInputElement>, item: InventoryItem) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const success = await saveLine(item);
    if (success) focusAdjacent(item.inventoryItemId, event.shiftKey ? -1 : 1);
  }

  function commitQuickLine() {
    if (!selectedStock) {
      setClientError('Selectionnez un article / lot.');
      return;
    }
    if (quickLine.physicalQuantity !== '' && Number(quickLine.physicalQuantity) < 0) {
      setClientError('Stock physique invalide.');
      return;
    }
    addItem.mutate();
  }

  function handleQuickKey(event: KeyboardEvent<HTMLElement>) {
    if (event.ctrlKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      setQuickLine(emptyQuickLine());
      return;
    }
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      commitQuickLine();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      commitQuickLine();
    }
  }

  function chooseStock(stock: Stock) {
    const existing = sortedRows.find((item) => item.lotId === stock.lotId);
    if (existing) {
      setQuickLine(emptyQuickLine());
      setQuickPickerOpen(false);
      setTimeout(() => focusLine(existing.inventoryItemId), 0);
      return;
    }
    setQuickLine({
      stockId: stock.stockId,
      query: `${stock.articleCode ?? ''} - ${stock.commercialName ?? ''} / ${stock.lotNumber}`,
      physicalQuantity: String(stock.quantityAvailable),
      reason: quickLine.reason,
    });
  }

  function exportInventory(format: 'xlsx' | 'csv' | 'json') {
    if (!current) return;
    const stamp = fileDateStamp();
    const header = inventoryHeaderRows(current, totals, progressPercent, countedCount, remainingCount);
    const lines = inventoryLineRows(sortedRows);
    if (format === 'xlsx') {
      downloadXlsx(`inventaire_${current.inventoryNumber}_${stamp}.xlsx`, [
        { name: 'Inventaire', rows: header },
        { name: 'Lignes', rows: lines },
      ]);
    }
    if (format === 'csv') downloadCsv(`inventaire_${current.inventoryNumber}_${stamp}.csv`, [...header, [], ...lines]);
    if (format === 'json') downloadJson(`inventaire_${current.inventoryNumber}_${stamp}.json`, { inventory: current, totals, lines: sortedRows });
  }

  const closeSummary = useMemo(
    () => ({
      total: effectiveRows.length,
      counted: countedCount,
      zero: zeroCount,
      gain: effectiveRows.filter((item) => Number(item.differenceQuantity ?? 0) > 0).length,
      loss: effectiveRows.filter((item) => Number(item.differenceQuantity ?? 0) < 0).length,
      match: effectiveRows.filter((item) => Number(item.differenceQuantity ?? 0) === 0 && item.physicalQuantity !== null).length,
    }),
    [countedCount, effectiveRows, zeroCount],
  );

  if (!current) {
    return (
      <>
        <h1>Detail inventaire</h1>
        <div className="card">Chargement...</div>
      </>
    );
  }

  return (
    <div className="inventory-detail-page">
      <div className="breadcrumb"><Link to="/inventories">Inventaires</Link><span>&gt;</span><strong>Detail</strong></div>
      {error && <p className="form-error">{apiErrorMessage(error)}</p>}
      {clientError && <p className="form-error">{clientError}</p>}
      {fillZeroResult && <p className="form-success">Remplissage termine : {fillZeroResult.updatedCount} ligne(s) completee(s) a zero.</p>}

      <section className="inventory-sticky-header">
        <div><span>Numero</span><strong>{current.inventoryNumber}</strong></div>
        <div><span>Site</span><strong>{current.siteName ?? '-'}</strong></div>
        <div><span>Statut</span><strong><span className={`badge compact-badge ${inventoryStatusClass(current.status)}`}>{current.status}</span></strong></div>
        <div><span>Date</span><strong>{formatDate(current.inventoryDate)}</strong></div>
        <div><span>Saisies</span><strong>{countedCount} / {effectiveRows.length}</strong></div>
        <div><span>Progression</span><strong>{progressPercent}%</strong></div>
      </section>

      <div className="card inventory-actions">
        <Link className="ghost-button compact-button" to="/inventories">Retour</Link>
        <Link className="ghost-button compact-button" to={`/stocks/movements?referenceType=INVENTORY&referenceId=${current.inventoryId}`}>Voir mouvements stock</Link>
        {current.status === 'DRAFT' && <button className="button compact-button" onClick={() => start.mutate()} disabled={start.isPending}>Demarrer</button>}
        {current.status === 'IN_PROGRESS' && canFillZero && (
          <button
            className="ghost-button compact-button"
            type="button"
            disabled={fillEmptyZero.isPending || hasSavingLines || hasDirtyLines}
            onClick={() => setFillZeroConfirmOpen(true)}
          >
            Remplir les non saisis a 0
          </button>
        )}
        {current.status === 'IN_PROGRESS' && canClose && (
          <button
            className="button compact-button"
            type="button"
            disabled={close.isPending || remainingCount > 0 || hasBlockingError || hasSavingLines || hasDirtyLines || hasSaveErrors || fillEmptyZero.isPending}
            onClick={() => setCloseConfirmOpen(true)}
          >
            Cloturer le comptage
          </button>
        )}
        {current.status === 'CLOSED' && canValidate && (
          <button
            className="button compact-button"
            type="button"
            disabled={validate.isPending || rows.length === 0 || hasBlockingError}
            onClick={() => setValidateConfirmOpen(true)}
          >
            Valider l inventaire
          </button>
        )}
        {canPrint && (
          <details className="export-menu">
            <summary className="ghost-button compact-button">Imprimer la feuille</summary>
            <div className="export-menu-panel">
              <button type="button" disabled={sortedRows.length === 0} onClick={() => setPrintMode('blank')}>Feuille vierge</button>
              <button type="button" disabled={sortedRows.length === 0} onClick={() => setPrintMode('filled')}>Avec quantites saisies</button>
            </div>
          </details>
        )}
        <details className="export-menu">
          <summary className="ghost-button compact-button">Exporter</summary>
          <div className="export-menu-panel">
            <button type="button" disabled={sortedRows.length === 0} onClick={() => exportInventory('xlsx')}>Excel</button>
            <button type="button" disabled={sortedRows.length === 0} onClick={() => exportInventory('csv')}>CSV</button>
            <button type="button" disabled={sortedRows.length === 0} onClick={() => exportInventory('json')}>JSON</button>
            <button type="button" disabled>PDF</button>
          </div>
        </details>
      </div>

      <section className="inventory-summary premium-summary compact-summary">
        <div className="form-summary"><span>Lignes</span><strong>{effectiveRows.length}</strong></div>
        <div className="form-summary"><span>Saisies</span><strong>{countedCount}</strong></div>
        <div className="form-summary"><span>Restantes</span><strong>{remainingCount}</strong></div>
        <div className="form-summary"><span>Systeme</span><strong>{formatQuantity(totals.systemQty)}</strong></div>
        <div className="form-summary"><span>Physique</span><strong>{formatQuantity(totals.physicalQty)}</strong></div>
        <div className="form-summary"><span>Ecarts +</span><strong>{formatQuantity(totals.gainQty)}</strong></div>
        <div className="form-summary"><span>Ecarts -</span><strong>{formatQuantity(totals.lossQty)}</strong></div>
        <div className="form-summary"><span>Net</span><strong>{formatMoney(totals.netValue, 'USD')}</strong></div>
      </section>

      <div className="card inventory-filter-bar">
        <input
          className="input"
          placeholder="Rechercher article, code, lot, unite ou observation..."
          value={lineSearch}
          onChange={(event) => setLineSearch(event.target.value)}
        />
        <select className="input" value={lineFilter} onChange={(event) => setLineFilter(event.target.value as LineFilter)}>
          <option value="ALL">Toutes les lignes</option>
          <option value="EMPTY">Seulement non saisies</option>
          <option value="COUNTED">Seulement saisies</option>
          <option value="DIFF">Seulement avec ecart</option>
          <option value="GAIN">Seulement gains</option>
          <option value="LOSS">Seulement pertes</option>
          <option value="MATCH">Sans ecart</option>
        </select>
        <div className="inventory-progress-inline">
          <strong>{progressPercent}% compte</strong>
          <span>{remainingCount} ligne(s) restante(s)</span>
        </div>
      </div>

      <div className="card inventory-grid-card">
        <div className="table-wrap">
          <table className="data-table inventory-count-table compact-grid">
            <thead>
              <tr>
                <th>Article</th>
                <th>Lot</th>
                <th>Expiration</th>
                <th>Unite stock</th>
                <th>Stock systeme</th>
                <th>Stock physique</th>
                <th>Ecart</th>
                <th>Observation</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((item) => {
                const value = physicalByItem[item.inventoryItemId] ?? String(item.physicalQuantity ?? '');
                const diff = item.differenceQuantity;
                const lineStatus = inventoryLineStatus(current.status, item, saveStateByItem[item.inventoryItemId]);
                return (
                  <tr className={`inventory-line ${lineLevel(diff)} ${lineStatus.className}`} key={item.inventoryItemId}>
                    <td>
                      <strong>{item.commercialName ?? '-'}</strong>
                      <small>{item.articleCode ?? ''}</small>
                    </td>
                    <td>{item.lotNumber ?? '-'}</td>
                    <td>{formatDate(item.expiryDate)}</td>
                    <td>{item.stockUnitLabel ?? 'Non renseignee'}</td>
                    <td className="quantity-cell">{formatQuantity(item.systemQuantity)}</td>
                    <td>
                      {current.status === 'IN_PROGRESS' && canCount ? (
                        <input
                          ref={(node) => {
                            lineInputRefs.current[item.inventoryItemId] = node;
                          }}
                          className="input compact-input numeric-cell"
                          type="number"
                          min="0"
                          step="0.001"
                          value={value}
                          onFocus={(event) => event.currentTarget.select()}
                          onBlur={() => {
                            void saveLine(item);
                          }}
                          onKeyDown={(event) => {
                            void handlePhysicalEnter(event, item);
                          }}
                          onChange={(event) => {
                            setPhysicalByItem((currentMap) => ({ ...currentMap, [item.inventoryItemId]: event.target.value }));
                            setSaveStateByItem((currentMap) => ({ ...currentMap, [item.inventoryItemId]: 'dirty' }));
                          }}
                        />
                      ) : (
                        formatQuantity(item.physicalQuantity ?? 0)
                      )}
                    </td>
                    <td className={`quantity-cell ${diff !== null && diff !== undefined && diff !== 0 ? 'inventory-diff-highlight' : ''}`}>
                      {diff === null || diff === undefined ? '-' : formatQuantity(diff)}
                    </td>
                    <td>
                      {current.status === 'IN_PROGRESS' && canCount ? (
                        <input
                          className="input compact-input"
                          placeholder="casse, vol, perime..."
                          value={reasonByItem[item.inventoryItemId] ?? item.reason ?? ''}
                          onBlur={() => {
                            void saveLine(item);
                          }}
                          onChange={(event) => scheduleReasonSave(item, event.target.value)}
                        />
                      ) : (
                        item.reason ?? '-'
                      )}
                    </td>
                    <td>
                      <span className={`badge compact-badge ${lineStatus.badgeClass}`}>{lineStatus.label}</span>
                      {saveErrorByItem[item.inventoryItemId] && <small className="inventory-line-error">{saveErrorByItem[item.inventoryItemId]}</small>}
                    </td>
                    <td>
                      {saveStateByItem[item.inventoryItemId] === 'error' ? (
                        <button className="ghost-button compact-button" type="button" onClick={() => void saveLine(item)}>
                          Reessayer
                        </button>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {current.status === 'IN_PROGRESS' && canCount && (
                <tr className="quick-entry-row">
                  <td className="inventory-picker-cell">
                    <FloatingSearchPopover
                      columns={[
                        { header: 'Code', render: (stock) => stock.articleCode ?? '-' },
                        { header: 'Barcode', render: (stock) => articleById.get(stock.articleId)?.barcode ?? '-' },
                        { header: 'Nom', render: (stock) => <strong>{stock.commercialName ?? '-'}</strong> },
                        { header: 'DCI', render: (stock) => articleById.get(stock.articleId)?.dci ?? '-' },
                        { header: 'Lot', render: (stock) => stock.lotNumber },
                        { header: 'Expiration', render: (stock) => formatDate(stock.expiryDate) },
                        { header: 'Stock', render: (stock) => formatQuantity(stock.quantityAvailable) },
                      ]}
                      dataGridCell="quick-inventory-stock"
                      getKey={(stock) => stock.stockId}
                      onChange={(value) => setQuickLine({ ...quickLine, stockId: '', query: value })}
                      onClose={() => setQuickPickerOpen(false)}
                      onFallbackKeyDown={handleQuickKey}
                      onFocusNext={() => document.querySelector<HTMLElement>('[data-grid-cell="quick-inventory-physical"]')?.focus()}
                      onOpen={() => setQuickPickerOpen(true)}
                      onSelect={chooseStock}
                      open={quickPickerOpen}
                      placeholder="Scanner code-barres ou rechercher article/lot..."
                      searchPlaceholder="Rechercher (code, nom, DCI, barcode, lot, expiration, stock...)"
                      suggestions={suggestions}
                      value={quickLine.query}
                    />
                  </td>
                  <td>{selectedStock?.lotNumber ?? '-'}</td>
                  <td>{formatDate(selectedStock?.expiryDate)}</td>
                  <td>{selectedStock ? resolveStockUnitLabel(selectedStock.articleId, articleById) : '-'}</td>
                  <td className="quantity-cell">{selectedStock ? formatQuantity(selectedStock.quantityAvailable) : '-'}</td>
                  <td>
                    <input
                      className="input compact-input numeric-cell"
                      data-grid-cell="quick-inventory-physical"
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder="Physique"
                      value={quickLine.physicalQuantity}
                      onKeyDown={handleQuickKey}
                      onChange={(event) => setQuickLine({ ...quickLine, physicalQuantity: event.target.value })}
                    />
                  </td>
                  <td className="quantity-cell">{selectedStock && quickLine.physicalQuantity !== '' ? formatQuantity(Number(quickLine.physicalQuantity) - selectedStock.quantityAvailable) : '-'}</td>
                  <td>
                    <input
                      className="input compact-input"
                      placeholder="Observation"
                      value={quickLine.reason}
                      onKeyDown={handleQuickKey}
                      onChange={(event) => setQuickLine({ ...quickLine, reason: event.target.value })}
                    />
                  </td>
                  <td><span className="badge compact-badge badge-info">Ligne rapide</span></td>
                  <td><button className="ghost-button compact-button" type="button" disabled={!selectedStock || addItem.isPending} onClick={commitQuickLine}>+</button></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CommentsPanel entityType="INVENTORY" entityId={current.inventoryId} />

      <Modal title="Completer les lignes non saisies" open={fillZeroConfirmOpen} onClose={() => setFillZeroConfirmOpen(false)}>
        <div className="inventory-confirm-body">
          <p>{remainingCount} ligne(s) non saisie(s) seront enregistree(s) avec un stock physique egal a 0.</p>
          <p>{countedCount} ligne(s) deja renseignee(s) resteront inchangee(s) sur {effectiveRows.length} ligne(s) au total.</p>
          <div className="modal-actions">
            <button className="ghost-button compact-button" type="button" onClick={() => setFillZeroConfirmOpen(false)}>Annuler</button>
            <button className="button compact-button" type="button" disabled={fillEmptyZero.isPending} onClick={() => fillEmptyZero.mutate()}>
              {fillEmptyZero.isPending ? 'Remplissage...' : 'Confirmer le remplissage a 0'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal title="Cloturer le comptage" open={closeConfirmOpen} onClose={() => setCloseConfirmOpen(false)}>
        <div className="inventory-confirm-body">
          <ul className="inventory-close-summary">
            <li>Total lignes : <strong>{closeSummary.total}</strong></li>
            <li>Lignes comptees : <strong>{closeSummary.counted}</strong></li>
            <li>Lignes a 0 : <strong>{closeSummary.zero}</strong></li>
            <li>Lignes avec gain : <strong>{closeSummary.gain}</strong></li>
            <li>Lignes avec perte : <strong>{closeSummary.loss}</strong></li>
            <li>Lignes sans ecart : <strong>{closeSummary.match}</strong></li>
          </ul>
          <p>Apres cloture, les quantites ne pourront plus etre modifiees par le gerant. Le responsable devra valider l inventaire pour appliquer les ecarts au stock.</p>
          <div className="modal-actions">
            <button className="ghost-button compact-button" type="button" onClick={() => setCloseConfirmOpen(false)}>Annuler</button>
            <button className="button compact-button" type="button" disabled={close.isPending} onClick={() => close.mutate()}>
              {close.isPending ? 'Cloture...' : 'Confirmer la cloture'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal title="Valider l inventaire" open={validateConfirmOpen} onClose={() => setValidateConfirmOpen(false)}>
        <div className="inventory-confirm-body">
          <p>La validation applique les ecarts au stock, cree les mouvements INVENTORY_GAIN / INVENTORY_LOSS et verrouille definitivement l inventaire.</p>
          <ul className="inventory-close-summary">
            <li>Lignes : <strong>{effectiveRows.length}</strong></li>
            <li>Ecarts + : <strong>{formatQuantity(totals.gainQty)}</strong></li>
            <li>Ecarts - : <strong>{formatQuantity(totals.lossQty)}</strong></li>
            <li>Valeur nette : <strong>{formatMoney(totals.netValue, 'USD')}</strong></li>
          </ul>
          <div className="modal-actions">
            <button className="ghost-button compact-button" type="button" onClick={() => setValidateConfirmOpen(false)}>Annuler</button>
            <button className="button compact-button" type="button" disabled={validate.isPending} onClick={() => validate.mutate()}>
              {validate.isPending ? 'Validation...' : 'Confirmer la validation'}
            </button>
          </div>
        </div>
      </Modal>

      <section className={`inventory-print-sheet ${printMode ? 'active' : ''}`}>
        <header className="inventory-print-header">
          <div>
            <h2>Feuille de comptage inventaire</h2>
            <p>{current.siteName ?? 'Pharmacie'}</p>
          </div>
          <div className="inventory-print-meta">
            <span>Inventaire : {current.inventoryNumber}</span>
            <span>Site : {current.siteName ?? '-'}</span>
            <span>Date : {formatDate(current.inventoryDate)}</span>
            <span>Responsable : {currentUser?.fullName ?? '-'}</span>
            <span>Statut : {current.status}</span>
            <span>Heure impression : {new Date().toLocaleString('fr-FR')}</span>
          </div>
        </header>
        <table className="inventory-print-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Code article</th>
              <th>Article</th>
              <th>Lot</th>
              <th>Expiration</th>
              <th>Unite stock</th>
              <th>Stock systeme</th>
              <th>Stock physique compte</th>
              <th>Ecart</th>
              <th>Observation</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((item, index) => (
              <tr key={`print-${item.inventoryItemId}`}>
                <td>{index + 1}</td>
                <td>{item.articleCode ?? '-'}</td>
                <td>{item.commercialName ?? '-'}</td>
                <td>{item.lotNumber ?? '-'}</td>
                <td>{formatDate(item.expiryDate)}</td>
                <td>{item.stockUnitLabel ?? 'Non renseignee'}</td>
                <td>{formatQuantity(item.systemQuantity)}</td>
                <td>{printMode === 'filled' && item.physicalQuantity !== null ? formatQuantity(item.physicalQuantity) : ''}</td>
                <td>{printMode === 'filled' && item.differenceQuantity !== null ? formatQuantity(item.differenceQuantity) : ''}</td>
                <td>{printMode === 'filled' ? item.reason ?? '' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function readInventoryDraft(storageKey: string) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw) as StoredDraft;
  } catch {
    return null;
  }
}

function inventoryStockSuggestions(
  stocks: Stock[],
  query: string,
  articleById: Map<string, { dci: string | null; barcode: string | null }>,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return stocks;
  return stocks
    .filter((stock) =>
      [stock.articleCode, stock.commercialName, articleById.get(stock.articleId)?.dci, articleById.get(stock.articleId)?.barcode, stock.lotNumber, stock.expiryDate, stock.quantityAvailable, stock.siteName]
        .some((value) => String(value ?? '').toLowerCase().includes(needle)),
    )
    .sort((left, right) =>
      Number(String(articleById.get(right.articleId)?.barcode ?? '').toLowerCase() === needle) -
      Number(String(articleById.get(left.articleId)?.barcode ?? '').toLowerCase() === needle),
    );
}

function inventoryTotals(items: InventoryItem[], prices: Map<string, { purchasePrice: number }>) {
  return items.reduce(
    (acc, item) => {
      const system = Number(item.systemQuantity ?? 0);
      const physical = item.physicalQuantity === null || item.physicalQuantity === undefined ? system : Number(item.physicalQuantity);
      const diff = item.physicalQuantity === null || item.physicalQuantity === undefined ? 0 : Number(item.differenceQuantity ?? physical - system);
      const value = Math.abs(diff) * Number(prices.get(item.lotId)?.purchasePrice ?? 0);
      acc.systemQty += system;
      acc.physicalQty += physical;
      acc.netQty += diff;
      if (diff > 0) {
        acc.gainQty += diff;
        acc.gainValue += value;
      }
      if (diff < 0) {
        acc.lossQty += Math.abs(diff);
        acc.lossValue += value;
      }
      acc.netValue += diff >= 0 ? value : -value;
      return acc;
    },
    { systemQty: 0, physicalQty: 0, gainQty: 0, lossQty: 0, netQty: 0, gainValue: 0, lossValue: 0, netValue: 0 },
  );
}

function inventoryHeaderRows(
  current: { inventoryNumber: string; siteName: string | null; inventoryDate: string; status: string },
  totals: ReturnType<typeof inventoryTotals>,
  progressPercent: number,
  countedCount: number,
  remainingCount: number,
) {
  return [
    ['Numero', current.inventoryNumber],
    ['Site', current.siteName ?? '-'],
    ['Date', formatDate(current.inventoryDate)],
    ['Statut', current.status],
    ['Progression', `${progressPercent}%`],
    ['Lignes saisies', countedCount],
    ['Lignes restantes', remainingCount],
    ['Quantite systeme', totals.systemQty],
    ['Quantite physique', totals.physicalQty],
    ['Valeur nette ecart', formatMoney(totals.netValue, 'USD')],
  ];
}

function inventoryLineRows(items: InventoryItem[]) {
  return [
    ['Article', 'Code', 'Lot', 'Expiration', 'Unite stock', 'Stock systeme', 'Stock physique', 'Ecart', 'Observation'],
    ...items.map((item) => [
      item.commercialName ?? '-',
      item.articleCode ?? '-',
      item.lotNumber ?? '-',
      formatDate(item.expiryDate),
      item.stockUnitLabel ?? 'Non renseignee',
      item.systemQuantity,
      item.physicalQuantity ?? '',
      item.differenceQuantity ?? '',
      item.reason ?? '',
    ]),
  ];
}

function inventoryStatusClass(status: string) {
  if (status === 'VALIDATED') return 'badge-success';
  if (status === 'CLOSED') return 'badge-info';
  if (status === 'IN_PROGRESS') return 'badge-warning';
  if (status === 'DRAFT') return 'badge-muted';
  return 'badge-muted';
}

function inventoryLineStatus(status: string, item: InventoryItem, saveState?: SaveState) {
  if (status !== 'IN_PROGRESS') return { label: 'Verrouille', badgeClass: 'badge-muted', className: 'inventory-line-locked' };
  if (saveState === 'saving') return { label: 'Enregistrement...', badgeClass: 'badge-info', className: 'inventory-line-saving' };
  if (saveState === 'error') return { label: 'Erreur', badgeClass: 'badge-danger', className: 'inventory-line-error-row' };
  if (saveState === 'dirty') return { label: 'Modifie', badgeClass: 'badge-warning', className: 'inventory-line-dirty' };
  if (saveState === 'saved') return { label: 'Enregistre', badgeClass: 'badge-success', className: 'inventory-line-saved' };
  if (item.physicalQuantity === null) return { label: 'Non saisi', badgeClass: 'badge-muted', className: 'inventory-line-empty' };
  return { label: 'Enregistre', badgeClass: 'badge-success', className: 'inventory-line-saved' };
}

function lineLevel(diff: number | null | undefined) {
  if (diff === null || diff === undefined || diff === 0) return 'line-valid';
  if (Math.abs(diff) <= 2) return 'line-warning';
  return 'line-danger';
}

function resolveStockUnitLabel(articleId: string, articleById: Map<string, { packaging?: string | null }>) {
  const article = articleById.get(articleId);
  return article?.packaging ?? 'Non renseignee';
}

function formatQuantity(value: number | null | undefined) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(value ?? 0));
}
