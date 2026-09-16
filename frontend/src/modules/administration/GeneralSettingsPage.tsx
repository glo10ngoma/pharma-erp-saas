import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { settingsService } from '../../services/settings.service';
import { formatDate } from '../../utils/date';

export function GeneralSettingsPage() {
  const { currentUser } = useAuth();
  const rate = useQuery({ queryKey: ['settings', 'exchange-rate'], queryFn: async () => (await settingsService.getExchangeRate()).data });
  return (
    <>
      <div className="page-heading reference-heading">
        <div><h1>Parametres generaux</h1><p className="muted">Socle V1 lecture seule pour le deploiement.</p></div>
      </div>
      <div className="admin-settings-grid">
        <div className="card detail-grid">
          <div><span>Application</span><strong>PharmaERP SaaS</strong></div>
          <div><span>Tenant courant</span><strong>{currentUser?.tenantId ?? '-'}</strong></div>
          <div><span>Role</span><strong>{currentUser?.role ?? '-'}</strong></div>
          <div><span>Devise interne</span><strong>USD</strong></div>
          <div><span>Devise client RDC</span><strong>CDF / FC</strong></div>
          <div><span>Timezone</span><strong>Africa/Lubumbashi</strong></div>
          <div><span>Taux USD/CDF</span><strong>{rate.data?.rate ? rate.data.rate : 'Non configure'}</strong></div>
          <div><span>Derniere modification taux</span><strong>{rate.data?.updatedAt ? formatDate(rate.data.updatedAt) : '-'}</strong></div>
        </div>
        <div className="card">
          <h2>Mode V1</h2>
          <p className="muted">Ces parametres sont exposes pour audit administrateur. Les editions avancees seront rattachees a un module Parametres dedie.</p>
        </div>
      </div>
    </>
  );
}
