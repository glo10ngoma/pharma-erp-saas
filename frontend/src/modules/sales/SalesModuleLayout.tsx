import { NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';

function navClass(isActive: boolean) {
  return `sales-module-nav-link${isActive ? ' active' : ''}`;
}

export function SalesModuleLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { permissions } = useAuth();
  const [searchParams] = useSearchParams();
  const canCreateSale = permissions.includes('sales.create');
  const canRefresh = permissions.includes('sales.read');
  const querySuffix = searchParams.toString() ? `?${searchParams.toString()}` : '';

  function refreshSalesModule() {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const [root] = query.queryKey as [string | undefined];
        return typeof root === 'string' && (root.startsWith('sales') || root.startsWith('reports'));
      },
    });
  }

  return (
    <section className="sales-module-shell">
      <header className="page-heading sales-module-heading">
        <div>
          <span className="breadcrumb">Ventes</span>
          <h1>Ventes</h1>
          <p>Tableau de bord, liste et rapports de ventes dans des vues dediees.</p>
        </div>
        <div className="page-heading-actions">
          {canRefresh && (
            <button className="ghost-button compact-button" type="button" onClick={refreshSalesModule}>
              Actualiser
            </button>
          )}
          {canCreateSale && (
            <button className="button compact-button" type="button" onClick={() => navigate('/pos')}>
              + Nouvelle vente
            </button>
          )}
        </div>
      </header>

      <nav className="sales-module-nav" aria-label="Navigation interne Ventes">
        <NavLink className={({ isActive }) => navClass(isActive)} to="/sales/dashboard" end>
          Dashboard
        </NavLink>
        <NavLink className={({ isActive }) => navClass(isActive)} to={`/sales/list${querySuffix}`}>
          Liste des ventes
        </NavLink>
        <NavLink className={({ isActive }) => navClass(isActive)} to={`/sales/reports/yesterday${querySuffix}`}>
          Rapport ventes d'hier
        </NavLink>
        <NavLink className={({ isActive }) => navClass(isActive)} to={`/sales/reports/end-of-day${querySuffix}`}>
          Rapport fin de journee
        </NavLink>
      </nav>

      <Outlet />
    </section>
  );
}
