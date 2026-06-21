import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth.service';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authService.login(email, password);
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('currentUser', JSON.stringify(response.data.user));
      navigate('/dashboard');
    } catch {
      setError('Identifiants invalides ou utilisateur inactif.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-panel" onSubmit={handleSubmit}>
        <h1>PharmaERP SaaS</h1>
        <p>Connexion utilisateur</p>
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
        {error && <p className="form-error">{error}</p>}
        <button className="button" disabled={loading}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
