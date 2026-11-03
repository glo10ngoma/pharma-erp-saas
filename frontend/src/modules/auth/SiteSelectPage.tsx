import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export function SiteSelectPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (auth.loading || !auth.currentUser) return;
    if (auth.availableSites.length === 0) {
      setError('Aucun site actif accessible pour cette organisation.');
      return;
    }
    if (auth.availableSites.length === 1) {
      void selectSite(auth.availableSites[0].id);
    }
  }, [auth.loading, auth.currentUser, auth.availableSites.length]);

  async function selectSite(siteId: string) {
    setError('');
    setBusyId(siteId);
    try {
      await auth.switchSite(siteId);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Site non autorise.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="content">
      <section className="card compact-card context-select-card">
        <h1>Choisir un site</h1>
        <p className="muted">Selectionnez le site actif pour cette session.</p>
        {error && <p className="form-error">{error}</p>}
        <div className="context-select-list">
          {auth.availableSites.map((site) => (
            <button
              className="ghost-button context-select-option"
              disabled={busyId !== null}
              key={site.id}
              type="button"
              onClick={() => selectSite(site.id)}
            >
              <strong>{site.name}</strong>
              <span>{site.code ?? site.id}</span>
              {busyId === site.id ? <em>Activation...</em> : null}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
