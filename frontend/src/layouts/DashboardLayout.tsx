import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';

export function DashboardLayout() {
  const navigate = useNavigate();
  const token = localStorage.getItem('accessToken');

  if (!token) return <Navigate to="/login" replace />;

  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentUser');
    navigate('/login');
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>PharmaERP</h2>
        <nav style={{ display: 'grid', gap: 12 }}>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/articles">Articles</Link>
          <Link to="/categories">Categories</Link>
          <Link to="/sub-categories">SubCategories</Link>
          <Link to="/galenic-forms">Formes</Link>
          <Link to="/administration-routes">Voies</Link>
          <Link to="/product-types">Types produits</Link>
          <Link to="/suppliers">Fournisseurs</Link>
          <Link to="/customers">Clients</Link>
          <Link to="/purchases">Achats</Link>
          <Link to="/lots">Lots</Link>
          <Link to="/stocks">Stocks</Link>
          <Link to="/inventories">Inventaires</Link>
          <Link to="/accounting/accounts">Plan comptable</Link>
          <Link to="/accounting/journals">Journaux</Link>
          <Link to="/accounting/entries">Ecritures</Link>
          <Link to="/accounting/general-ledger">Grand livre</Link>
          <Link to="/accounting/trial-balance">Balance</Link>
          <Link to="/reports">Reporting BI</Link>
          <Link to="/sales">Ventes</Link>
          <Link to="/pos">POS</Link>
          <Link to="/cash">Caisse</Link>
          <Link to="/organizations">Organizations</Link>
          <Link to="/insurance-plans">Plans assurance</Link>
          <Link to="/memberships">Memberships</Link>
          <Link to="/receivables">Creances</Link>
          <Link to="/users">Users</Link>
          <Link to="/roles">Roles</Link>
          <Link to="/permissions">Permissions</Link>
          <Link to="/sites">Sites</Link>
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
