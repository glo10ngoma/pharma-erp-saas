import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { lotsService, Lot } from '../../services/lots.service';
import { stocksService, Stock, StockMovement } from '../../services/stocks.service';
import { formatDate, fileDateStamp } from '../../utils/date';
import { downloadCsv, downloadJson, downloadXlsx } from '../../utils/export';
import { formatMoney } from '../../utils/money';

type ExpiryFilter = 'ALL' | 'EXPIRED' | 'LT30' | 'LT90' | 'VALID';
type StatusFilter = 'ALL' | 'AVAILABLE' | 'BLOCKED' | 'EXPIRED' | 'NEAR_EXPIRY';

type LotView = Lot & {
  siteNames: string;
  quantityInitial: number;
  quantityAvailable: number;
  statusLabel: string;
  statusClass: string;
  daysToExpiry: number | null;
};

export function LotsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('ALL');
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);

  const lots = useQuery({ queryKey: ['lots'], queryFn: async () => (await lotsService.getAll()).data });
  const stocks = useQuery({ queryKey: ['stocks'], queryFn: async () => (await stocksService.getAll()).data });
  const movements = useQuery({ queryKey: ['stock-movements'], queryFn: async () => (await stocksService.getMovements()).data, enabled: Boolean(selectedLotId) });
  const block = useMutation({ mutationFn: (id: string) => lotsService.block(id, 'Blocage manuel'), onSuccess: () => qc.invalidateQueries({ queryKey: ['lots'] }) });
  const unblock = useMutation({ mutationFn: (id: string) => lotsService.unblock(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['lots'] }) });

  const stocksByLot = useMemo(() => groupStocksByLot(stocks.data ?? []), [stocks.data]);
  const lotRows = useMemo(() => (lots.data ?? []).map((lot) => toLotView(lot, stocksByLot.get(lot.lotId) ?? [])), [lots.data, stocksByLot]);
  const rows = useMemo(() => {
    const searched = filterRows(lotRows, search, (lot) => [
      lot.lotNumber,
      lot.articleCode,
      lot.commercialName,
      lot.supplierName,
      lot.statusLabel,
      lot.siteNames,
    ]);
    return searched.filter((lot) => matchesStatus(lot, statusFilter) && matchesExpiry(lot, expiryFilter));
  }, [lotRows, search, statusFilter, expiryFilter]);

  const selectedLot = rows.find((lot) => lot.lotId === selectedLotId) ?? lotRows.find((lot) => lot.lotId === selectedLotId) ?? null;
  const selectedStocks = selectedLot ? stocksByLot.get(selectedLot.lotId) ?? [] : [];
  const selectedMovements = selectedLot ? (movements.data ?? []).filter((movement) => movement.lotNumber === selectedLot.lotNumber).slice(0, 12) : [];

  function exportRows(format: 'xlsx' | 'csv' | 'json') {
    const data = lotExportRows(rows);
    const stamp = fileDateStamp();
    if (format === 'xlsx') downloadXlsx(`lots_${stamp}.xlsx`, [{ name: 'Lots', rows: data }]);
    if (format === 'csv') downloadCsv(`lots_${stamp}.csv`, data);
    if (format === 'json') downloadJson(`lots_${stamp}.json`, rows.map(lotExportObject));
  }

  const loading = lots.isLoading || stocks.isLoading;

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Lots</h1>
          <p className="muted">Suivi des lots, peremptions, disponibilites et blocages FEFO.</p>
        </div>
      </div>

      <div className="card lots-filters">
        <SearchBox value={search} onChange={setSearch} placeholder="Rechercher lot, article, fournisseur, statut ou site..." />
        <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
          <option value="ALL">Tous les statuts</option>
          <option value="AVAILABLE">Disponibles</option>
          <option value="BLOCKED">Bloques</option>
          <option value="EXPIRED">Expires</option>
          <option value="NEAR_EXPIRY">Proche expiration</option>
        </select>
        <select className="input" value={expiryFilter} onChange={(event) => setExpiryFilter(event.target.value as ExpiryFilter)}>
          <option value="ALL">Toutes expirations</option>
          <option value="EXPIRED">Expires</option>
          <option value="LT30">Expire &lt; 30 jours</option>
          <option value="LT90">Expire &lt; 90 jours</option>
          <option value="VALID">Valides</option>
        </select>
        <div className="export-actions lots-export-actions">
          <details className="export-menu">
            <summary className="ghost-button compact-button">Exporter</summary>
            <div className="export-menu-panel">
              <button type="button" disabled={rows.length === 0} onClick={() => exportRows('xlsx')}>Excel</button>
              <button type="button" disabled={rows.length === 0} onClick={() => exportRows('csv')}>CSV</button>
              <button type="button" disabled={rows.length === 0} onClick={() => exportRows('json')}>JSON</button>
            </div>
          </details>
        </div>
      </div>

      <div className="card">
        {loading ? <p className="loading-state">Chargement des lots...</p> : rows.length === 0 ? <p className="empty-state">Aucun lot trouve. Ajustez la recherche ou les filtres.</p> : (
          <div className="table-wrap">
            <table className="data-table lots-table">
              <thead>
                <tr><th>Lot</th><th>Article</th><th>Site</th><th>Expiration</th><th>Qte initiale</th><th>Qte dispo</th><th>Prix achat</th><th>Prix vente</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>{rows.map((lot) => (
                <tr className="clickable-row lots-row" key={lot.lotId} onClick={() => setSelectedLotId(lot.lotId)}>
                  <td className="lots-cell"><strong>{lot.lotNumber}</strong></td>
                  <td className="lots-cell"><span>{lot.commercialName ?? '-'}</span><small>{lot.articleCode ?? ''}</small></td>
                  <td className="lots-cell">{lot.siteNames}</td>
                  <td className="lots-cell">{formatDate(lot.expiryDate)}</td>
                  <td className="lots-cell quantity-cell">{lot.quantityInitial}</td>
                  <td className="lots-cell quantity-cell">{lot.quantityAvailable}</td>
                  <td className="lots-cell numeric-text">{formatMoney(lot.purchasePrice, lot.currencyCode ?? 'USD', lot.currencySymbol)}</td>
                  <td className="lots-cell numeric-text">{formatMoney(lot.sellingPrice, lot.currencyCode ?? 'USD', lot.currencySymbol)}</td>
                  <td className="lots-cell"><span className={`badge compact-badge ${lot.statusClass}`}>{lot.statusLabel}</span></td>
                  <td className="lots-cell">
                    <button className="ghost-button compact-button" type="button" onClick={(event) => { event.stopPropagation(); setSelectedLotId(lot.lotId); }}>Voir</button>
                    {lot.isBlocked
                      ? <button className="ghost-button compact-button" type="button" disabled={unblock.isPending} onClick={(event) => { event.stopPropagation(); unblock.mutate(lot.lotId); }}>Debloquer</button>
                      : <button className="ghost-button compact-button danger" type="button" disabled={block.isPending} onClick={(event) => { event.stopPropagation(); block.mutate(lot.lotId); }}>Bloquer</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      <Modal title="Detail lot" open={Boolean(selectedLot)} onClose={() => setSelectedLotId(null)}>
        {selectedLot && <LotDetail lot={selectedLot} stocks={selectedStocks} movements={selectedMovements} />}
      </Modal>
    </>
  );
}

function LotDetail({ lot, stocks, movements }: { lot: LotView; stocks: Stock[]; movements: StockMovement[] }) {
  return (
    <div className="lot-detail">
      <div className="detail-grid">
        <div><span>Lot</span><strong>{lot.lotNumber}</strong></div>
        <div><span>Article</span><strong>{lot.commercialName ?? lot.articleCode ?? '-'}</strong></div>
        <div><span>Site</span><strong>{lot.siteNames}</strong></div>
        <div><span>Expiration</span><strong>{formatDate(lot.expiryDate)}</strong></div>
        <div><span>Qte initiale</span><strong>{lot.quantityInitial}</strong></div>
        <div><span>Qte disponible</span><strong>{lot.quantityAvailable}</strong></div>
        <div><span>Prix achat</span><strong>{formatMoney(lot.purchasePrice, lot.currencyCode ?? 'USD', lot.currencySymbol)}</strong></div>
        <div><span>Prix vente</span><strong>{formatMoney(lot.sellingPrice, lot.currencyCode ?? 'USD', lot.currencySymbol)}</strong></div>
        <div><span>Statut</span><strong><span className={`badge compact-badge ${lot.statusClass}`}>{lot.statusLabel}</span></strong></div>
        <div><span>Fournisseur</span><strong>{lot.supplierName ?? '-'}</strong></div>
      </div>

      <h3>Stock par site</h3>
      <div className="table-wrap">
        <table className="data-table lots-detail-table">
          <thead><tr><th>Site</th><th>Qte disponible</th><th>Qte reservee</th></tr></thead>
          <tbody>{stocks.length === 0 ? <tr><td colSpan={3}>Aucun stock disponible.</td></tr> : stocks.map((stock) => (
            <tr key={stock.stockId}><td>{stock.siteName ?? '-'}</td><td className="quantity-cell">{stock.quantityAvailable}</td><td className="quantity-cell">{stock.quantityReserved}</td></tr>
          ))}</tbody>
        </table>
      </div>

      <h3>Mouvements stock recents</h3>
      <div className="table-wrap">
        <table className="data-table lots-detail-table">
          <thead><tr><th>Date</th><th>Type</th><th>Site</th><th>Quantite</th><th>Reference</th></tr></thead>
          <tbody>{movements.length === 0 ? <tr><td colSpan={5}>Aucun mouvement accessible.</td></tr> : movements.map((movement) => (
            <tr key={movement.movementId}><td>{formatDate(movement.movementDate)}</td><td>{movement.movementType}</td><td>{movement.siteName ?? '-'}</td><td className="quantity-cell">{movement.quantity}</td><td>{movement.referenceType ?? '-'}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function groupStocksByLot(stocks: Stock[]) {
  const map = new Map<string, Stock[]>();
  for (const stock of stocks) {
    map.set(stock.lotId, [...(map.get(stock.lotId) ?? []), stock]);
  }
  return map;
}

function toLotView(lot: Lot, stocks: Stock[]): LotView {
  const quantityAvailable = stocks.reduce((sum, stock) => sum + Number(stock.quantityAvailable ?? 0), 0);
  const quantityReserved = stocks.reduce((sum, stock) => sum + Number(stock.quantityReserved ?? 0), 0);
  const status = lotStatus(lot);
  return {
    ...lot,
    siteNames: unique(stocks.map((stock) => stock.siteName).filter(Boolean) as string[]).join(', ') || '-',
    quantityInitial: quantityAvailable + quantityReserved,
    quantityAvailable,
    daysToExpiry: daysUntil(lot.expiryDate),
    statusLabel: status.label,
    statusClass: status.className,
  };
}

function lotStatus(lot: Lot) {
  const days = daysUntil(lot.expiryDate);
  if (lot.isBlocked) return { label: 'Bloque', className: 'badge-danger' };
  if (days !== null && days < 0) return { label: 'Expire', className: 'badge-danger' };
  if (days !== null && days <= 90) return { label: 'Proche expiration', className: 'badge-warning' };
  return { label: 'Disponible', className: 'badge-success' };
}

function daysUntil(date: string) {
  if (!date) return null;
  const target = new Date(`${date.split('T')[0]}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function matchesStatus(lot: LotView, filter: StatusFilter) {
  if (filter === 'ALL') return true;
  if (filter === 'AVAILABLE') return lot.statusLabel === 'Disponible';
  if (filter === 'BLOCKED') return lot.isBlocked;
  if (filter === 'EXPIRED') return (lot.daysToExpiry ?? 0) < 0;
  if (filter === 'NEAR_EXPIRY') return !lot.isBlocked && (lot.daysToExpiry ?? 9999) >= 0 && (lot.daysToExpiry ?? 9999) <= 90;
  return true;
}

function matchesExpiry(lot: LotView, filter: ExpiryFilter) {
  const days = lot.daysToExpiry;
  if (filter === 'ALL') return true;
  if (filter === 'EXPIRED') return days !== null && days < 0;
  if (filter === 'LT30') return days !== null && days >= 0 && days < 30;
  if (filter === 'LT90') return days !== null && days >= 0 && days < 90;
  if (filter === 'VALID') return days === null || days >= 0;
  return true;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function lotExportRows(lots: LotView[]) {
  return [
    ['Lot', 'Article', 'Code article', 'Fournisseur', 'Site', 'Expiration', 'Qte initiale', 'Qte disponible', 'Prix achat', 'Prix vente', 'Statut'],
    ...lots.map((lot) => [
      lot.lotNumber,
      lot.commercialName ?? '-',
      lot.articleCode ?? '-',
      lot.supplierName ?? '-',
      lot.siteNames,
      formatDate(lot.expiryDate),
      lot.quantityInitial,
      lot.quantityAvailable,
      formatMoney(lot.purchasePrice, lot.currencyCode ?? 'USD', lot.currencySymbol),
      formatMoney(lot.sellingPrice, lot.currencyCode ?? 'USD', lot.currencySymbol),
      lot.statusLabel,
    ]),
  ];
}

function lotExportObject(lot: LotView) {
  return {
    lot: lot.lotNumber,
    article: lot.commercialName ?? '-',
    articleCode: lot.articleCode ?? '-',
    fournisseur: lot.supplierName ?? '-',
    site: lot.siteNames,
    expiration: formatDate(lot.expiryDate),
    quantiteInitiale: lot.quantityInitial,
    quantiteDisponible: lot.quantityAvailable,
    prixAchat: formatMoney(lot.purchasePrice, lot.currencyCode ?? 'USD', lot.currencySymbol),
    prixVente: formatMoney(lot.sellingPrice, lot.currencyCode ?? 'USD', lot.currencySymbol),
    statut: lot.statusLabel,
  };
}
