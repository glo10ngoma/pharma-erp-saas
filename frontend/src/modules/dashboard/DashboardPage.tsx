import { useAuth } from '../../auth/AuthContext';

export function DashboardPage() {
  const { currentUser: user } = useAuth();
  const modules = ['Auth', 'Articles', 'Achats', 'Stock', 'POS', 'Caisse', 'Assurances', 'Inventaires', 'Comptabilite', 'BI'];

  return (
    <section className="erp-home-page">
      <header className="page-heading">
        <div>
          <span className="breadcrumb">Pilotage</span>
          <h1>Dashboard</h1>
          <p>Vue d'accueil de l'environnement PharmaERP et des modules actifs.</p>
        </div>
      </header>
      <div className="toolbar erp-identity-strip">
        <strong>{user?.fullName || 'Utilisateur'}</strong>
        <span>{user?.role || 'Role'}</span>
        <span>{user?.siteId ? 'Site controle' : 'Vue globale'}</span>
      </div>
      <div className="stats-grid">
        <div className="card kpi-card">
          <span className="kpi-label">Version</span>
          <p className="metric">V1</p>
        </div>
        <div className="card kpi-card">
          <span className="kpi-label">Tenant</span>
          <p className="metric">Filtre ON</p>
        </div>
        <div className="card kpi-card">
          <span className="kpi-label">Site</span>
          <p className="metric">{user?.siteId ? 'Controle' : 'Global'}</p>
        </div>
        <div className="card kpi-card">
          <span className="kpi-label">Permissions</span>
          <p className="metric">{user?.permissions?.length || 0}</p>
        </div>
      </div>
      <div className="card">
        <h2>Modules actifs V1</h2>
        <div className="erp-chip-list">
          {modules.map((module) => <span className="badge badge-muted" key={module}>{module}</span>)}
        </div>
      </div>
    </section>
  );
}
