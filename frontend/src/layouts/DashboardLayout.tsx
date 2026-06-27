import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

type NavLinkItem = [to: string, label: string, permission?: string];
type NavGroup = { title: string; icon: string; links: NavLinkItem[] };

export function DashboardLayout() {
  const navigate = useNavigate();
  const { accessToken, currentUser, permissions, loading, logout: clearAuth } = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const groups = useMemo<NavGroup[]>(() => [
    {
      title: 'Pilotage',
      icon: 'TB',
      links: [
        ['/dashboard', 'Dashboard', undefined],
        ['/profile', 'Mon profil', undefined],
      ],
    },
    {
      title: 'Administration',
      icon: 'AD',
      links: [
        ['/users', 'Users', 'users.read'],
        ['/roles', 'Roles', 'roles.read'],
        ['/permissions', 'Permissions', 'permissions.read'],
        ['/sites', 'Sites', 'sites.read'],
      ],
    },
    {
      title: 'Referentiel',
      icon: 'RF',
      links: [
        ['/articles', 'Articles', 'articles.read'],
        ['/categories', 'Categories', 'categories.read'],
        ['/sub-categories', 'Sous-categories', 'sub_categories.read'],
        ['/galenic-forms', 'Formes', 'galenic_forms.read'],
        ['/administration-routes', 'Voies', 'administration_routes.read'],
        ['/product-types', 'Types produits', 'product_types.read'],
        ['/suppliers', 'Fournisseurs', 'suppliers.read'],
        ['/customers', 'Clients', 'customers.read'],
      ],
    },
    {
      title: 'Stock',
      icon: 'ST',
      links: [
        ['/purchases', 'Achats', 'purchases.read'],
        ['/lots', 'Lots', 'lots.read'],
        ['/fefo/highlight', 'Produits a mettre en avant', 'lots.read'],
        ['/fefo/rotation', 'Rotation des rayons', 'lots.read'],
        ['/stocks', 'Stocks', 'stocks.read'],
        ['/transfers', 'Transferts', 'transfers.read'],
        ['/inventories', 'Inventaires', 'inventories.read'],
      ],
    },
    {
      title: 'Vente',
      icon: 'VN',
      links: [
        ['/pos', 'POS', 'sales.create'],
        ['/sales', 'Ventes', 'sales.read'],
        ['/cash', 'Caisse', 'cash_registers.read'],
      ],
    },
    {
      title: 'Assurances & creances',
      icon: 'AS',
      links: [
        ['/organizations', 'Organisations', 'organizations.read'],
        ['/insurance-plans', 'Plans assurance', 'insurance_plans.read'],
        ['/memberships', 'Memberships', 'memberships.read'],
        ['/receivables', 'Creances', 'receivables.read'],
      ],
    },
    {
      title: 'Finance',
      icon: 'FI',
      links: [
        ['/accounting/accounts', 'Comptes', 'accounting.read'],
        ['/accounting/journals', 'Journaux', 'accounting.read'],
        ['/accounting/entries', 'Ecritures', 'accounting.read'],
        ['/accounting/general-ledger', 'Grand livre', 'accounting.general_ledger'],
        ['/accounting/trial-balance', 'Balance', 'accounting.trial_balance'],
      ],
    },
    {
      title: 'BI',
      icon: 'BI',
      links: [
        ['/reports', 'Dashboard BI', 'reports.dashboard'],
      ],
    },
    {
      title: 'Parametres',
      icon: 'PM',
      links: [
        ['/settings/exchange-rate', 'Taux de change', 'settings.exchange_rate.read'],
      ],
    },
  ], []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  if (loading) return <main className="content"><p className="loading-state">Chargement du profil...</p></main>;
  if (!accessToken) return <Navigate to="/login" replace />;
  if (!currentUser) return <Navigate to="/login" replace />;

  function logout() {
    clearAuth();
    navigate('/login');
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <h2>PharmaERP</h2>
          <span>SaaS pharmacie V1</span>
        </div>
        <button className="ghost-button theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? 'Theme light' : 'Theme dark'}
        </button>
        <nav>
          {groups.map((group) => {
            const visibleLinks = group.links.filter(([, , permission]) => !permission || permissions.includes(permission));
            if (visibleLinks.length === 0) return null;
            if (group.title === 'Parametres') {
              return (
                <div className="nav-group" key={group.title}>
                  <button className="nav-group-title nav-group-button" type="button" onClick={() => navigate(visibleLinks[0][0])}>
                    <span>{group.icon}</span> {group.title}
                  </button>
                  {visibleLinks.map(([to, label]) => (
                    <Link className="nav-link" key={to} to={to}>
                      {label}
                    </Link>
                  ))}
                </div>
              );
            }
            return (
              <details className="nav-group" key={group.title} open>
                <summary className="nav-group-title"><span>{group.icon}</span> {group.title}</summary>
                {visibleLinks.map(([to, label]) => (
                  <Link className="nav-link" key={to} to={to}>
                    {label}
                  </Link>
                ))}
              </details>
            );
          })}
        </nav>
        <button className="ghost-button" onClick={logout}>
          Deconnexion
        </button>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
