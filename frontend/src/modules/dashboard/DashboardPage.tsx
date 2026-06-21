export function DashboardPage() {
  const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const modules = ['Auth', 'Articles', 'Achats', 'Stock', 'POS', 'Caisse', 'Assurances', 'Inventaires', 'Comptabilite', 'BI'];

  return (
    <>
      <h1>Dashboard</h1>
      <div className="toolbar">
        <div>
          <strong>{user?.fullName || 'Utilisateur'}</strong>
          <span>
            {user?.role || 'Role'} - Tenant {user?.tenantId || '-'}
          </span>
        </div>
      </div>
      <div className="stats-grid">
        <div className="card">
          <strong>Version</strong>
          <h2>V1</h2>
        </div>
        <div className="card">
          <strong>Tenant</strong>
          <h2>Filtre ON</h2>
        </div>
        <div className="card">
          <strong>Site</strong>
          <h2>{user?.siteId ? 'Controle' : 'Global'}</h2>
        </div>
        <div className="card">
          <strong>Permissions</strong>
          <h2>{user?.permissions?.length || 0}</h2>
        </div>
      </div>
      <div className="card">
        <h2>Modules actifs V1</h2>
        <p>{modules.join(' | ')}</p>
      </div>
    </>
  );
}
