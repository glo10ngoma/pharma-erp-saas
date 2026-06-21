import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rolesService } from '../../services/roles.service';
import { sitesService } from '../../services/sites.service';
import { usersService } from '../../services/users.service';

export function UsersPage() {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [siteId, setSiteId] = useState('');
  const users = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await usersService.getAll()).data,
  });
  const roles = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await rolesService.getAll()).data,
  });
  const sites = useQuery({
    queryKey: ['sites'],
    queryFn: async () => (await sitesService.getAll()).data,
  });
  const create = useMutation({
    mutationFn: usersService.create,
    onSuccess: () => {
      setFullName('');
      setUsername('');
      setEmail('');
      setPassword('');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate({ fullName, username, email, password, roleId, siteId });
  }

  return (
    <>
      <h1>Users</h1>
      <form className="card form-grid" onSubmit={submit}>
        <input className="input" placeholder="Nom complet" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <input className="input" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" placeholder="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <select className="input" value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
          <option value="">Role</option>
          {(roles.data ?? []).map((role) => <option key={role.roleId} value={role.roleId}>{role.roleName}</option>)}
        </select>
        <select className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
          <option value="">Site</option>
          {(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}
        </select>
        <button className="button" disabled={create.isPending}>Creer</button>
      </form>
      <div className="card">
        {users.isLoading ? 'Chargement...' : (
          <table className="data-table">
            <thead><tr><th>Nom</th><th>Username</th><th>Email</th><th>Role</th><th>Site</th><th>Actif</th></tr></thead>
            <tbody>{(users.data ?? []).map((user) => (
              <tr key={user.userId}><td>{user.fullName}</td><td>{user.username}</td><td>{user.email || '-'}</td><td>{user.roleName || '-'}</td><td>{user.siteName || '-'}</td><td>{user.isActive ? 'Oui' : 'Non'}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
