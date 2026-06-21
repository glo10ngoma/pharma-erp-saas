import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { permissionsService } from '../../services/permissions.service';

export function PermissionsPage() {
  const queryClient = useQueryClient();
  const [permissionCode, setPermissionCode] = useState('');
  const [permissionName, setPermissionName] = useState('');
  const [moduleName, setModuleName] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => (await permissionsService.getAll()).data,
  });
  const create = useMutation({
    mutationFn: permissionsService.create,
    onSuccess: () => {
      setPermissionCode('');
      setPermissionName('');
      setModuleName('');
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate({ permissionCode, permissionName, moduleName });
  }

  return (
    <>
      <h1>Permissions</h1>
      <form className="card form-grid" onSubmit={submit}>
        <input className="input" placeholder="Code" value={permissionCode} onChange={(e) => setPermissionCode(e.target.value)} required />
        <input className="input" placeholder="Nom" value={permissionName} onChange={(e) => setPermissionName(e.target.value)} required />
        <input className="input" placeholder="Module" value={moduleName} onChange={(e) => setModuleName(e.target.value)} required />
        <button className="button" disabled={create.isPending}>Creer</button>
      </form>
      <div className="card">
        {isLoading ? 'Chargement...' : (
          <table className="data-table">
            <thead><tr><th>Code</th><th>Nom</th><th>Module</th></tr></thead>
            <tbody>{(data ?? []).map((permission) => (
              <tr key={permission.permissionId}><td>{permission.permissionCode}</td><td>{permission.permissionName}</td><td>{permission.moduleName}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
