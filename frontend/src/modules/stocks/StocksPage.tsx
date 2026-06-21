import { useQuery } from '@tanstack/react-query';
import { stocksService } from '../../services/stocks.service';

export function StocksPage() {
  const stocks = useQuery({ queryKey: ['stocks'], queryFn: async () => (await stocksService.getAll()).data });
  const movements = useQuery({ queryKey: ['stock-movements'], queryFn: async () => (await stocksService.getMovements()).data });
  return <><h1>Stocks</h1><div className="card">{stocks.isLoading?'Chargement...':<table className="data-table"><thead><tr><th>Article</th><th>Lot</th><th>Expiration</th><th>Site</th><th>Disponible</th></tr></thead><tbody>{(stocks.data??[]).map(s=><tr key={s.stockId}><td>{s.commercialName}</td><td>{s.lotNumber}</td><td>{s.expiryDate}</td><td>{s.siteName}</td><td>{s.quantityAvailable}</td></tr>)}</tbody></table>}</div><h1>Mouvements</h1><div className="card">{movements.isLoading?'Chargement...':<table className="data-table"><thead><tr><th>Date</th><th>Type</th><th>Article</th><th>Lot</th><th>Qte</th></tr></thead><tbody>{(movements.data??[]).map(m=><tr key={m.movementId}><td>{m.movementDate}</td><td>{m.movementType}</td><td>{m.commercialName}</td><td>{m.lotNumber}</td><td>{m.quantity}</td></tr>)}</tbody></table>}</div></>;
}
