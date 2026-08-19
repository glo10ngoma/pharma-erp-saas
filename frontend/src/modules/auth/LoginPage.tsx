import axios from 'axios';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { landingPathForUser } from '../../auth/landing';

export function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (auth.offlineAuthenticated && !auth.accessToken) {
      navigate('/offline/pos', { replace: true });
      return;
    }

    if (auth.loading || auth.accessToken || auth.offlineAuthenticated) {
      return;
    }

    let cancelled = false;

    async function tryOfflineRestore() {
      const candidate = await auth.inspectOfflineRestore();
      if (cancelled) return;
      if (!candidate.allowed) {
        if (!navigator.onLine) {
          setInfo(candidate.reason === 'WORKSTATION_REVOKED'
            ? 'Ce poste n est plus autorise pour le mode hors ligne.'
            : candidate.reason === 'UNAUTHORIZED'
              ? 'Ce poste n est pas autorise pour le mode hors ligne.'
              : 'Connexion Internet requise pour vous connecter sur ce poste.');
        }
        return;
      }

      setRestoring(true);
      const user = await auth.restoreOfflineSession();
      if (cancelled) return;
      setRestoring(false);
      if (user) {
        navigate('/offline/pos', { replace: true });
      }
    }

    if (!navigator.onLine) {
      void tryOfflineRestore();
    }

    return () => {
      cancelled = true;
    };
  }, [auth, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      const user = await auth.login(email, password);
      navigate(landingPathForUser(user), { replace: true });
    } catch (error) {
      if (!navigator.onLine || (axios.isAxiosError(error) && !error.response)) {
        const candidate = await auth.inspectOfflineRestore();
        if (candidate.allowed) {
          const restored = await auth.restoreOfflineSession();
          if (restored) {
            navigate('/offline/pos', { replace: true });
            return;
          }
        }
        setError(candidate.reason === 'WORKSTATION_REVOKED'
          ? 'Ce poste n est plus autorise pour le mode hors ligne.'
          : candidate.reason === 'UNAUTHORIZED'
            ? 'Ce poste n est pas autorise pour le mode hors ligne.'
            : 'Impossible de joindre le serveur.');
      } else {
        setError('Identifiants invalides ou utilisateur inactif.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-panel" onSubmit={handleSubmit}>
        <h1>PharmaERP SaaS</h1>
        <p className="muted">Connexion securisee a votre espace pharmacie</p>
        {auth.offlineAuthenticated ? (
          <p className="muted">
            Session hors ligne restauree.
          </p>
        ) : null}
        <label>
          Email
          <input
            className="input"
            placeholder="exemple@pharmacie.cd"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
          />
        </label>
        <label>
          Mot de passe
          <input
            className="input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            required
          />
        </label>
        {info && <p className="muted">{info}</p>}
        {error && <p className="form-error">{error}</p>}
        <button className="button" disabled={loading || restoring}>
          {loading || restoring ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
