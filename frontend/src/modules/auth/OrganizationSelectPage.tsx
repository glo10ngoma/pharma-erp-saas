import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export function OrganizationSelectPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (auth.loading || !auth.currentUser) return;
    if (auth.availableOrganizations.length === 0) {
      setError('Aucune organisation active ne vous est affectee.');
      return;
    }
    if (auth.availableOrganizations.length === 1) {
      void selectOrganization(auth.availableOrganizations[0].id);
    }
  }, [auth.loading, auth.currentUser, auth.availableOrganizations.length]);

  async function selectOrganization(tenantId: string) {
    setError('');
    setBusyId(tenantId);
    try {
      const user = await auth.switchOrganization(tenantId);
      if (!user.siteId) {
        navigate('/site-select', { replace: true });
        return;
      }
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Organisation non autorisee.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="content">
      <section className="card compact-card context-select-card">
        <h1>Choisir une organisation</h1>
        <p className="muted">Selectionnez l organisation active pour cette session.</p>
        {error && <p className="form-error">{error}</p>}
        <div className="context-select-list">
          {auth.availableOrganizations.map((organization) => (
            <button
              className="ghost-button context-select-option"
              disabled={busyId !== null}
              key={organization.id}
              type="button"
              onClick={() => selectOrganization(organization.id)}
            >
              <strong>{organization.name}</strong>
              <span>{organization.code ?? organization.id}</span>
              {busyId === organization.id ? <em>Activation...</em> : null}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
