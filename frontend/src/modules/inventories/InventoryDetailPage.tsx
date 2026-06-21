import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { apiErrorMessage } from '../../services/apiError';
import { inventoriesService } from '../../services/inventories.service';
import { stocksService } from '../../services/stocks.service';

export function InventoryDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [lotId, setLotId] = useState('');
  const [physicalByItem, setPhysicalByItem] = useState<Record<string, string>>({});
  const inventory = useQuery({ queryKey: ['inventory', id], queryFn: async () => (await inventoriesService.getById(id)).data });
  const stocks = useQuery({ queryKey: ['stocks'], queryFn: async () => (await stocksService.getAll()).data });
  const current = inventory.data;
  const rows = current?.items ?? [];
  const availableStocks = (stocks.data ?? []).filter((s) => !current?.siteId || s.siteId === current.siteId);
  const selectedStock = availableStocks.find((s) => s.lotId === lotId);
  const totals = useMemo(() => rows.reduce((acc, item) => { const diff = item.differenceQuantity ?? 0; if (diff > 0) acc.plus += diff; if (diff < 0) acc.minus += Math.abs(diff); return acc; }, { plus: 0, minus: 0 }), [rows]);
  function refresh() { qc.invalidateQueries({ queryKey: ['inventory', id] }); qc.invalidateQueries({ queryKey: ['inventories'] }); qc.invalidateQueries({ queryKey: ['stocks'] }); }
  const start = useMutation({ mutationFn: () => inventoriesService.start(id), onSuccess: refresh });
  const close = useMutation({ mutationFn: () => inventoriesService.close(id), onSuccess: refresh });
  const validate = useMutation({ mutationFn: () => inventoriesService.validate(id), onSuccess: refresh });
  const addItem = useMutation({ mutationFn: () => inventoriesService.addItem(id, { articleId: selectedStock?.articleId, lotId }), onSuccess: refresh });
  const updateItem = useMutation({ mutationFn: ({ itemId, value }: { itemId: string; value: string }) => inventoriesService.updateItem(id, itemId, { physicalQuantity: Number(value) }), onSuccess: refresh });
  function submitAdd(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (selectedStock) addItem.mutate(); }
  const error = start.error || close.error || validate.error || addItem.error || updateItem.error;
  return <><h1>Detail inventaire</h1>{error && <p className="form-error">{apiErrorMessage(error)}</p>}{!current ? <div className="card">Chargement...</div> : <><div className="card toolbar"><div><strong>{current.inventoryNumber}</strong><span>{current.siteName} - {current.status}</span></div><div style={{ display:'flex', gap: 8 }}>{current.status==='DRAFT' && <button className="button" onClick={()=>start.mutate()} disabled={start.isPending}>Start</button>}{current.status==='IN_PROGRESS' && <button className="button" onClick={()=>close.mutate()} disabled={close.isPending}>Close</button>}{current.status==='CLOSED' && <button className="button" onClick={()=>validate.mutate()} disabled={validate.isPending || rows.length===0}>Validate</button>}</div></div>{current.status==='IN_PROGRESS' && <form className="card form-grid" onSubmit={submitAdd}><select className="input" value={lotId} onChange={(e)=>setLotId(e.target.value)} required><option value="">Lot en stock</option>{availableStocks.map(s=><option key={s.stockId} value={s.lotId}>{s.commercialName} - {s.lotNumber} - stock {s.quantityAvailable}</option>)}</select><button className="button" disabled={addItem.isPending || !selectedStock}>Ajouter ligne</button></form>}<div className="stats-grid"><div className="card"><strong>{totals.plus}</strong><br />Ecarts +</div><div className="card"><strong>{totals.minus}</strong><br />Ecarts -</div><div className="card"><strong>{rows.length}</strong><br />Lignes</div><div className="card"><strong>{current.status}</strong><br />Statut</div></div><div className="card">{rows.length===0 ? <p>Aucune ligne inventaire.</p> : <table className="data-table"><thead><tr><th>Article</th><th>Lot</th><th>Systeme</th><th>Physique</th><th>Ecart</th><th></th></tr></thead><tbody>{rows.map(item=><tr key={item.inventoryItemId}><td>{item.commercialName}</td><td>{item.lotNumber}</td><td>{item.systemQuantity}</td><td>{current.status==='IN_PROGRESS' ? <input className="input" type="number" min="0" step="0.001" value={physicalByItem[item.inventoryItemId] ?? item.physicalQuantity ?? ''} onChange={(e)=>setPhysicalByItem({...physicalByItem,[item.inventoryItemId]:e.target.value})}/> : item.physicalQuantity}</td><td>{item.differenceQuantity ?? '-'}</td><td>{current.status==='IN_PROGRESS' && <button className="button" onClick={()=>updateItem.mutate({ itemId: item.inventoryItemId, value: physicalByItem[item.inventoryItemId] ?? String(item.physicalQuantity ?? '') })}>Enregistrer</button>}</td></tr>)}</tbody></table>}</div></>}</>;
}
