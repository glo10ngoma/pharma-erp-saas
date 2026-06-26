import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { apiErrorMessage } from '../../services/apiError';
import { inventoriesService, Inventory } from '../../services/inventories.service';
import { sitesService } from '../../services/sites.service';
import { stocksService } from '../../services/stocks.service';
import { formatDate, fileDateStamp } from '../../utils/date';
import { downloadCsv, downloadJson, downloadXlsx } from '../../utils/export';
import { formatMoney } from '../../utils/money';

type StatusFilter = 'ALL' | 'DRAFT' | 'IN_PROGRESS' | 'CLOSED' | 'VALIDATED';

type InventorySummary = Inventory & {
  lineCount: number;
  gainQty: number;
  lossQty: number;
  varianceValue: number;
};

export function InventoriesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [siteId, setSiteId] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [dateFilter, setDateFilter] = useState('');

  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const stocks = useQuery({ queryKey: ['stocks', 'inventory-preload'], queryFn: async () => (await stocksService.getAll()).data });
  const query = useQuery({
    queryKey: ['inventories', 'with-summary'],
    queryFn: async () => {
      const list = (await inventoriesService.getAll()).data;
      return Promise.all(list.map(async (inventory) => {
        try {
          return (await inventoriesService.getById(inventory.inventoryId)).data;
        } catch {
          return inventory;
        }
      }));
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      const inventory = (await inventoriesService.create({ siteId, inventoryType: 'FULL' })).data;
      await inventoriesService.start(inventory.inventoryId);
      const siteStocks = (stocks.data ?? []).filter((stock) => stock.siteId === siteId && stock.quantityAvailable >= 0);
      for (const stock of siteStocks) {
        await inventoriesService.addItem(inventory.inventoryId, { articleId: stock.articleId, lotId: stock.lotId });
      }
      return inventory;
    },
    onSuccess: (inventory) => {
      setModalOpen(false);
      setSiteId('');
      qc.invalidateQueries({ queryKey: ['inventories'] });
      qc.invalidateQueries({ queryKey: ['inventory', inventory.inventoryId] });
      navigate(`/inventories/${inventory.inventoryId}`);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate();
  }

  const summaryRows = useMemo(() => (query.data ?? []).map(toSummary), [query.data]);
  const rows = useMemo(() => {
    const searched = filterRows(summaryRows, search, (row) => [row.inventoryNumber, row.siteName, row.inventoryDate, row.status, row.notes]);
    return searched.filter((row) => {
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      if (siteFilter && row.siteId !== siteFilter) return false;
      if (dateFilter && String(row.inventoryDate).split('T')[0] !== dateFilter) return false;
      return true;
    });
  }, [dateFilter, search, siteFilter, statusFilter, summaryRows]);

  function exportRows(format: 'xlsx' | 'csv' | 'json') {
    const stamp = fileDateStamp();
    const data = inventoryExportRows(rows);
    if (format === 'xlsx') downloadXlsx(`inventaires_${stamp}.xlsx`, [{ name: 'Inventaires', rows: data }]);
    if (format === 'csv') downloadCsv(`inventaires_${stamp}.csv`, data);
    if (format === 'json') downloadJson(`inventaires_${stamp}.json`, rows.map(inventoryExportObject));
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Inventaires</h1>
          <p className="muted">Sessions de comptage physique, cloture et validation des ecarts.</p>
        </div>
        <button className="button" onClick={() => setModalOpen(true)}>Nouvel inventaire</button>
      </div>

      {create.isError && <p className="form-error">{apiErrorMessage(create.error)}</p>}

      <Modal title="Nouvel inventaire" open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={submit}>
          <select className="input" value={siteId} onChange={(event) => setSiteId(event.target.value)} required>
            <option value="">Site</option>
            {(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}
          </select>
          <button className="button" disabled={create.isPending || stocks.isLoading}>{create.isPending ? 'Creation et prechargement...' : 'Creer inventaire'}</button>
        </form>
      </Modal>

      <div className="card inventory-filters">
        <SearchBox value={search} onChange={setSearch} placeholder="Rechercher numero, site, statut, date ou commentaire..." />
        <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
          <option value="ALL">Tous statuts</option>
          <option value="DRAFT">DRAFT</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="CLOSED">CLOSED</option>
          <option value="VALIDATED">VALIDATED</option>
        </select>
        <select className="input" value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}>
          <option value="">Tous sites</option>
          {(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}
        </select>
        <input className="input inventory-date-input" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
        <div className="export-actions inventory-export-actions">
          <details className="export-menu">
            <summary className="ghost-button compact-button">Exporter</summary>
            <div className="export-menu-panel">
              <button type="button" disabled={rows.length === 0} onClick={() => exportRows('xlsx')}>Excel</button>
              <button type="button" disabled={rows.length === 0} onClick={() => exportRows('csv')}>CSV</button>
              <button type="button" disabled={rows.length === 0} onClick={() => exportRows('json')}>JSON</button>
              <button type="button" disabled>PDF</button>
            </div>
          </details>
        </div>
      </div>

      <div className="card">
        {query.isLoading ? <p className="loading-state">Chargement...</p> : rows.length === 0 ? <p className="empty-state">Aucun inventaire trouve.</p> : (
          <div className="table-wrap">
            <table className="data-table inventories-table">
              <thead><tr><th>Numero</th><th>Site</th><th>Date</th><th>Statut</th><th>Lignes</th><th>Ecarts +</th><th>Ecarts -</th><th>Valeur ecart</th><th>Actions</th></tr></thead>
              <tbody>{rows.map((inventory) => (
                <tr className="clickable-row inventories-row" key={inventory.inventoryId}>
                  <td><strong>{inventory.inventoryNumber}</strong></td>
                  <td>{inventory.siteName ?? '-'}</td>
                  <td>{formatDate(inventory.inventoryDate)}</td>
                  <td><span className={`badge compact-badge ${inventoryStatusClass(inventory.status)}`}>{inventory.status}</span></td>
                  <td className="quantity-cell">{inventory.lineCount}</td>
                  <td className="quantity-cell">{formatQuantity(inventory.gainQty)}</td>
                  <td className="quantity-cell">{formatQuantity(inventory.lossQty)}</td>
                  <td className="numeric-text">{formatMoney(inventory.varianceValue, 'USD')}</td>
                  <td><Link className="ghost-button compact-button" to={`/inventories/${inventory.inventoryId}`}>Voir</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function toSummary(inventory: Inventory): InventorySummary {
  const items = inventory.items ?? [];
  const gainQty = items.reduce((sum, item) => sum + Math.max(Number(item.differenceQuantity ?? 0), 0), 0);
  const lossQty = items.reduce((sum, item) => sum + Math.abs(Math.min(Number(item.differenceQuantity ?? 0), 0)), 0);
  return {
    ...inventory,
    lineCount: items.length,
    gainQty,
    lossQty,
    varianceValue: gainQty - lossQty,
  };
}

function inventoryStatusClass(status: string) {
  if (status === 'VALIDATED') return 'badge-success';
  if (status === 'CLOSED') return 'badge-info';
  if (status === 'IN_PROGRESS') return 'badge-warning';
  if (status === 'DRAFT') return 'badge-muted';
  return 'badge-muted';
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function inventoryExportRows(rows: InventorySummary[]) {
  return [
    ['Numero', 'Site', 'Date', 'Statut', 'Lignes', 'Ecarts +', 'Ecarts -', 'Valeur ecart'],
    ...rows.map((row) => [row.inventoryNumber, row.siteName ?? '-', formatDate(row.inventoryDate), row.status, row.lineCount, row.gainQty, row.lossQty, formatMoney(row.varianceValue, 'USD')]),
  ];
}

function inventoryExportObject(row: InventorySummary) {
  return {
    numero: row.inventoryNumber,
    site: row.siteName ?? '-',
    date: formatDate(row.inventoryDate),
    statut: row.status,
    lignes: row.lineCount,
    ecartsPlus: row.gainQty,
    ecartsMoins: row.lossQty,
    valeurEcart: formatMoney(row.varianceValue, 'USD'),
  };
}
