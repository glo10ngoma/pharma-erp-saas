import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { codeGeneratorService } from '../../services/codeGenerator.service';
import { sitesService } from '../../services/sites.service';

export function SitesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteType, setSiteType] = useState('PHARMACY');
  const { data, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => (await sitesService.getAll()).data,
  });
  const nextCode = useQuery({ queryKey: ['next-code', 'sites', modalOpen], enabled: modalOpen, queryFn: async () => (await codeGeneratorService.next('sites')).data.code });
  const create = useMutation({
    mutationFn: sitesService.create,
    onSuccess: () => {
      setSiteCode('');
      setSiteName('');
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate({ siteCode, siteName, siteType });
  }
  useEffect(() => {
    if (modalOpen && !siteCode && nextCode.data) setSiteCode(nextCode.data);
  }, [modalOpen, nextCode.data, siteCode]);
  const rows = filterRows(data ?? [], search, (site) => [site.siteCode, site.siteName, site.siteType]);

  return (
    <>
      <div className="toolbar"><h1>Sites</h1><button className="button" onClick={() => setModalOpen(true)}>Nouveau site</button></div>
      <Modal title="Nouveau site" open={modalOpen} onClose={() => setModalOpen(false)}>
      <form className="form-grid" onSubmit={submit}>
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
      </Modal>
      <div className="card"><SearchBox value={search} onChange={setSearch} placeholder="Rechercher un site..." /></div>
      <div className="card">
        {isLoading ? <p className="loading-state">Chargement des sites...</p> : rows.length === 0 ? <p className="empty-state">Aucun site trouve.</p> : (
          <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Code</th><th>Nom</th><th>Type</th><th>Actif</th></tr></thead>
            <tbody>{rows.map((site) => (
              <tr key={site.siteId}><td>{site.siteCode}</td><td>{site.siteName}</td><td>{site.siteType}</td><td><span className={`badge ${site.isActive ? 'badge-success' : 'badge-muted'}`}>{site.isActive ? 'Actif' : 'Inactif'}</span></td></tr>
            ))}</tbody>
          </table>
          </div>
        )}
      </div>
    </>
  );
}
