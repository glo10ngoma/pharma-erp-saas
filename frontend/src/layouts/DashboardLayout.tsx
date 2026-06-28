import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { canReadNotifications, readNotificationState, useGeneratedNotifications } from '../modules/notifications/notifications-data';

type NavLinkItem = [to: string, label: string, permission?: string];
type NavGroup = { title: string; icon: string; links: NavLinkItem[] };

export function DashboardLayout() {
  const navigate = useNavigate();
  const { accessToken, currentUser, permissions, loading, logout: clearAuth } = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [notificationState, setNotificationState] = useState(() => readNotificationState());
  const canSeeNotifications = canReadNotifications(permissions, currentUser?.role);
  const { notifications } = useGeneratedNotifications(notificationState, canSeeNotifications);
  const unreadCount = notifications.filter((notification) => notification.status === 'UNREAD').length;
  const groups = useMemo<NavGroup[]>(() => [
    {
      title: 'Pilotage',
      icon: 'TB',
      links: [
        [permissions.includes('reports.dashboard') ? '/reports/dashboard' : '/dashboard', permissions.includes('reports.dashboard') ? 'Dashboard BI' : 'Dashboard', undefined],
        ['/notifications', 'Notifications', undefined],
        ['/profile', 'Mon profil', undefined],
      ],
    },
    {
      title: 'Administration',
      icon: 'AD',
      links: [
        ['/users', 'Utilisateurs', 'users.read'],
        ['/roles', 'Roles', 'roles.read'],
        ['/permissions', 'Permissions', 'permissions.read'],
        ['/sites', 'Sites', 'sites.read'],
        ['/administration/cash-registers', 'Caisses', 'cash_registers.read'],
        ['/administration/general-settings', 'Parametres generaux', 'settings.exchange_rate.read'],
        ['/settings/exchange-rate', 'Taux de change', 'settings.exchange_rate.read'],
        ['/administration/numbering', 'Numerotation', 'articles.read'],
        ['/administration/audit-logs', 'Journaux audit', 'audit.read'],
        ['/administration/company', 'Entreprise', 'sites.read'],
        ['/administration/backups', 'Sauvegardes', 'permissions.read'],
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
        ['/reports/dashboard', 'Dashboard BI', 'reports.dashboard'],
      ],
    },
    {
      title: 'Rapports',
      icon: 'RP',
      links: [
        ['/reports', 'Centre de rapports', 'reports.dashboard'],
        ['/reports/sales-report', 'Ventes', 'reports.sales'],
        ['/reports/purchases-report', 'Achats', 'purchases.read'],
        ['/reports/stocks-report', 'Stocks', 'reports.stock'],
        ['/reports/inventories-report', 'Inventaires', 'inventories.read'],
        ['/reports/fefo-report', 'FEFO', 'reports.expiry'],
        ['/reports/cash-report', 'Caisse', 'reports.cash'],
        ['/reports/insurance-report', 'Assurances', 'reports.receivables'],
        ['/reports/margins-report', 'Marges', 'reports.margins'],
      ],
    },
    {
      title: 'Analyses',
      icon: 'AN',
      links: [
        ['/analytics', 'Vue ensemble', 'reports.dashboard'],
        ['/analytics/abc', 'ABC / Pareto', 'reports.sales'],
        ['/analytics/stock-rotation', 'Rotation stocks', 'reports.stock'],
        ['/analytics/dormant-products', 'Produits dormants', 'reports.stock'],
        ['/analytics/margins', 'Marges', 'reports.margins'],
        ['/analytics/suppliers', 'Fournisseurs', 'purchases.read'],
        ['/analytics/sellers', 'Vendeurs', 'reports.sales'],
      ],
    },
  ], [permissions]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    function refreshNotificationState() {
      setNotificationState(readNotificationState());
    }
    window.addEventListener('storage', refreshNotificationState);
    window.addEventListener('notifications-updated', refreshNotificationState);
    return () => {
      window.removeEventListener('storage', refreshNotificationState);
      window.removeEventListener('notifications-updated', refreshNotificationState);
    };
  }, []);

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
            const visibleLinks = group.links.filter(([to, , permission]) => {
              if (to === '/notifications') return canSeeNotifications;
              return !permission || permissions.includes(permission);
            });
            if (visibleLinks.length === 0) return null;
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
        <div className="app-topbar">
          <Link className="notification-bell" to="/notifications" aria-label="Notifications">
            <svg aria-hidden="true" className="notification-bell-icon" viewBox="0 0 24 24">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            {unreadCount > 0 && <strong>{unreadCount}</strong>}
          </Link>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
