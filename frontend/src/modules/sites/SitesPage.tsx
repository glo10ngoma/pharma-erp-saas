import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sitesService } from '../../services/sites.service';

export function SitesPage() {
  const queryClient = useQueryClient();
  const [siteCode, setSiteCode] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteType, setSiteType] = useState('PHARMACY');
  const { data, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => (await sitesService.getAll()).data,
  });
  const create = useMutation({
    mutationFn: sitesService.create,
    onSuccess: () => {
      setSiteCode('');
      setSiteName('');
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate({ siteCode, siteName, siteType });
  }

  return (
    <>
      <h1>Sites</h1>
      <form className="card form-grid" onSubmit={submit}>
        <input className="input" placeholder="Code" value={siteCode} onChange={(e) => setSiteCode(e.target.value)} required />
        <input className="input" placeholder="Nom" value={siteName} onChange={(e) => setSiteName(e.target.value)} required />
        <select className="input" value={siteType} onChange={(e) => setSiteType(e.target.value)}>
          <option value="PHARMACY">PHARMACY</option>
          <option value="WAREHOUSE">WAREHOUSE</option>
          <option value="OFFICE">OFFICE</option>
          <option value="OTHER">OTHER</option>
        </select>
        <button className="button" disabled={create.isPending}>Creer</button>
      </form>
      <div className="card">
        {isLoading ? 'Chargement...' : (
          <table className="data-table">
            <thead><tr><th>Code</th><th>Nom</th><th>Type</th><th>Actif</th></tr></thead>
            <tbody>{(data ?? []).map((site) => (
              <tr key={site.siteId}><td>{site.siteCode}</td><td>{site.siteName}</td><td>{site.siteType}</td><td>{site.isActive ? 'Oui' : 'Non'}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
