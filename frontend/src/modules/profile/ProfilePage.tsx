import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { apiErrorMessage } from '../../services/apiError';
import { authService } from '../../services/auth.service';

export function ProfilePage() {
  const navigate = useNavigate();
  const { currentUser: user, logout } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.changePassword({ oldPassword, newPassword, confirmPassword });
      logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const displayName = user?.fullName ?? 'Utilisateur';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';

  return (
    <section className="profile-page">
      <header className="page-heading">
        <div>
          <span className="breadcrumb">Compte</span>
          <h1>Mon profil</h1>
          <p>Identite utilisateur et securite de connexion.</p>
        </div>
      </header>

      <div className="profile-grid">
        <section className="card profile-identity-card">
          <div className="profile-avatar" aria-hidden="true">
            {initials}
          </div>
          <div className="profile-identity-main">
            <h2>{displayName}</h2>
            <p>{user?.email ?? 'Email non defini'}</p>
            <div className="profile-meta">
              <span>{user?.role ?? 'Role non defini'}</span>
              <span>{user?.siteId ? 'Site rattache' : 'Tous sites'}</span>
            </div>
          </div>
        </section>

        <form className="card profile-security-card" onSubmit={submit}>
          <div>
            <h2>Securite</h2>
            <p>Changer le mot de passe de ce compte.</p>
          </div>
          <div className="profile-form">
            <label>
              <span>Ancien mot de passe</span>
              <input className="input" type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} required />
            </label>
            <label>
              <span>Nouveau mot de passe</span>
              <input className="input" type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
            </label>
            <label>
              <span>Confirmation</span>
              <input className="input" type="password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="button" disabled={loading}>
            {loading ? 'Changement...' : 'Changer le mot de passe'}
          </button>
        </form>
      </div>
    </section>
  );
}
