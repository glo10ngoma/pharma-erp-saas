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

  return (
    <>
      <h1>Mon profil</h1>
      <div className="card">
        <h2>{user?.fullName ?? 'Utilisateur'}</h2>
        <p>{user?.email ?? 'Email non defini'}</p>
        <p>{user?.role ?? 'Role non defini'}</p>
      </div>
      <form className="card form-grid" onSubmit={submit}>
        <label>
          Ancien mot de passe
          <input className="input" type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} required />
        </label>
        <label>
          Nouveau mot de passe
          <input className="input" type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
        </label>
        <label>
          Confirmation
          <input className="input" type="password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="button" disabled={loading}>
          {loading ? 'Changement...' : 'Changer le mot de passe'}
        </button>
      </form>
    </>
  );
}
