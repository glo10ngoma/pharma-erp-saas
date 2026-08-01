import { Link, useLocation } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import { StockMovementsView } from './StockMovementsView';
import { StocksOverviewView } from './StocksOverviewView';

export function StocksPage() {
  const location = useLocation();
  const { can } = usePermission();
  const pathname = location.pathname;
  const mode = pathname.endsWith('/movements') ? 'movements' : pathname.endsWith('/as-of') ? 'as-of' : 'current';

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Stocks</h1>
          <p className="muted">Stock actuel, historique des mouvements et consultation a date, en lecture seule.</p>
        </div>
      </div>

      <nav className="stocks-subnav" aria-label="Navigation interne Stocks">
        <Link className={`stocks-subnav-link ${mode === 'current' ? 'is-active' : ''}`} to="/stocks">
          Stock actuel
        </Link>
        {can('stock_movements.read') && (
          <Link className={`stocks-subnav-link ${mode === 'movements' ? 'is-active' : ''}`} to="/stocks/movements">
            Mouvements
          </Link>
        )}
        <Link className={`stocks-subnav-link ${mode === 'as-of' ? 'is-active' : ''}`} to="/stocks/as-of">
          Stock a date
        </Link>
      </nav>

      {mode === 'movements' ? <StockMovementsView /> : <StocksOverviewView mode={mode === 'as-of' ? 'as-of' : 'current'} />}
    </>
  );
}
