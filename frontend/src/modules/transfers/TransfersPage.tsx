import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { Transfer, transfersService } from '../../services/transfers.service';
import { formatDate, fileDateStamp } from '../../utils/date';
import { downloadCsv, downloadJson, downloadXlsx } from '../../utils/export';

type StatusFilter = 'ALL' | 'DRAFT' | 'VALIDATED';

export function TransfersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const transfers = useQuery({ queryKey: ['transfers'], queryFn: async () => (await transfersService.getAll()).data });

  const rows = useMemo(() => {
    const searched = filterRows(transfers.data ?? [], search, (transfer) => [
      transfer.transferNumber,
      transfer.fromSiteName,
      transfer.toSiteName,
      transfer.status,
      transfer.transferDate,
      transfer.notes,
    ]);
    return searched.filter((transfer) => status === 'ALL' || transfer.status === status);
  }, [search, status, transfers.data]);

  function exportRows(format: 'xlsx' | 'csv' | 'json') {
    const data = transferExportRows(rows);
    const stamp = fileDateStamp();
    if (format === 'xlsx') downloadXlsx(`transferts_${stamp}.xlsx`, [{ name: 'Transferts', rows: data }]);
    if (format === 'csv') downloadCsv(`transferts_${stamp}.csv`, data);
    if (format === 'json') downloadJson(`transferts_${stamp}.json`, rows.map(transferExportObject));
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Transferts</h1>
          <p className="muted">Transferts de stock entre sites avec mouvements TRANSFER_OUT / TRANSFER_IN.</p>
        </div>
        <Link className="button compact-button" to="/transfers/new">+ Nouveau Transfert</Link>
      </div>

      <div className="card transfers-filters">
        <SearchBox value={search} onChange={setSearch} placeholder="Rechercher numero, site, statut, date ou commentaire..." />
        <select className="input" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
          <option value="ALL">Tous les statuts</option>
          <option value="DRAFT">DRAFT</option>
          <option value="VALIDATED">VALIDATED</option>
        </select>
        <div className="export-actions">
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
        {transfers.isLoading ? <p className="loading-state">Chargement des transferts...</p> : rows.length === 0 ? <p className="empty-state">Aucun transfert trouve.</p> : (
          <div className="table-wrap">
            <table className="data-table transfers-table">
              <thead><tr><th>Numero</th><th>Source</th><th>Destination</th><th>Date</th><th>Statut</th><th>Lignes</th><th>Commentaire</th><th>Actions</th></tr></thead>
              <tbody>{rows.map((transfer) => (
                <tr className="clickable-row" key={transfer.transferId}>
                  <td><strong>{transfer.transferNumber}</strong></td>
                  <td>{transfer.fromSiteName ?? '-'}</td>
                  <td>{transfer.toSiteName ?? '-'}</td>
                  <td>{formatDate(transfer.transferDate)}</td>
                  <td><span className={`badge compact-badge ${transfer.status === 'VALIDATED' ? 'badge-success' : 'badge-warning'}`}>{transfer.status}</span></td>
                  <td className="quantity-cell">{transfer.items?.length ?? '-'}</td>
                  <td>{transfer.notes ?? '-'}</td>
                  <td><Link className="ghost-button compact-button" to={`/transfers/${transfer.transferId}`}>Voir</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function transferExportRows(transfers: Transfer[]) {
  return [
    ['Numero', 'Source', 'Destination', 'Date', 'Statut', 'Commentaire'],
    ...transfers.map((transfer) => [
      transfer.transferNumber,
      transfer.fromSiteName ?? '-',
      transfer.toSiteName ?? '-',
      formatDate(transfer.transferDate),
      transfer.status,
      transfer.notes ?? '-',
    ]),
  ];
}

function transferExportObject(transfer: Transfer) {
  return {
    numero: transfer.transferNumber,
    source: transfer.fromSiteName ?? '-',
    destination: transfer.toSiteName ?? '-',
    date: formatDate(transfer.transferDate),
    statut: transfer.status,
    commentaire: transfer.notes ?? '-',
  };
}
