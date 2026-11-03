import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { organizationSelectionError } from './organization-selection-error';
import './organization-select.css';

export function OrganizationSelectPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const attempted = useRef<string | null>(null);
  const organizations = auth.availableOrganizations;
  const onlyId = organizations.length === 1 ? organizations[0].id : null;

  useEffect(() => {
    if (auth.loading || refreshing || !auth.currentUser || !onlyId) return;
    const key = `${auth.currentUser.id}:${onlyId}`;
    if (attempted.current === key) return;
    attempted.current = key;
    void selectOrganization(onlyId);
  }, [auth.loading, refreshing, auth.currentUser?.id, onlyId]);

  async function selectOrganization(tenantId: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(''); setBusyId(tenantId);
    try {
      const user = await auth.switchOrganization(tenantId);
      navigate(user.siteId ? '/dashboard' : '/site-select', { replace: true });
    } catch (cause) { setError(organizationSelectionError(cause)); }
    finally { inFlight.current = false; setBusyId(null); }
  }

  async function refreshOrganizations() {
    if (inFlight.current) return;
    inFlight.current = true; setRefreshing(true); setError('');
    try { await auth.refreshContext(); }
    catch (cause) { setError(organizationSelectionError(cause)); }
    finally { inFlight.current = false; setRefreshing(false); }
  }

  const pending = auth.loading || busyId !== null || refreshing;
  const filtered = organizations.filter((item) => `${item.name} ${item.code ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return (
    <main className="organization-selection">
      <header className="organization-selection-header">
        <div className="organization-selection-brand"><span className="organization-selection-logo" aria-hidden="true">✚</span><span>Pharma<span className="organization-selection-accent">ERP</span></span></div>
        <button className="ghost-button" type="button" disabled={pending} onClick={() => { auth.logout(); navigate('/login', { replace: true }); }}>Se déconnecter</button>
      </header>
      <section className="organization-selection-panel" aria-labelledby="organization-title" aria-busy={pending}>
        <div className="organization-selection-step">VOTRE ESPACE DE TRAVAIL</div>
        <h1 id="organization-title">Choisir une organisation</h1>
        <p className="organization-selection-intro">Bonjour{auth.currentUser?.fullName ? ` ${auth.currentUser.fullName}` : ''}, sélectionnez l’organisation dans laquelle vous souhaitez travailler.</p>
        <div className="organization-selection-toolbar"><span>{organizations.length} organisation{organizations.length > 1 ? 's' : ''} accessible{organizations.length > 1 ? 's' : ''}</span><button className="ghost-button" type="button" disabled={pending} onClick={() => void refreshOrganizations()}>{refreshing ? 'Actualisation…' : 'Actualiser'}</button></div>
        {organizations.length > 4 && <label className="organization-selection-search">Rechercher une organisation<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom ou code de l’organisation" disabled={pending} /></label>}
        {error && <div className="organization-selection-error" role="alert"><strong>Impossible d’ouvrir l’organisation</strong><p>{error}</p><span>Vous pouvez réessayer en sélectionnant une organisation ci-dessous.</span></div>}
        {auth.loading ? <p className="organization-selection-empty" role="status">Chargement de vos organisations…</p> : organizations.length === 0 ? <div className="organization-selection-empty"><h2>Aucune organisation disponible</h2><p>Aucune organisation active n’est accessible avec ce compte. Actualisez la liste ou contactez votre administrateur.</p></div> : filtered.length === 0 ? <p className="organization-selection-empty" role="status">Aucune organisation ne correspond à votre recherche.</p> : <div className="organization-selection-list">{filtered.map((item) => <button className="organization-selection-option" disabled={pending} key={item.id} type="button" onClick={() => void selectOrganization(item.id)}><span className="organization-selection-monogram" aria-hidden="true">{item.name.trim().slice(0, 2).toLocaleUpperCase()}</span><span className="organization-selection-option-text"><strong>{item.name}</strong>{item.code && <span>{item.code}</span>}</span><span className="organization-selection-open">{busyId === item.id ? 'Ouverture…' : 'Ouvrir →'}</span></button>)}</div>}
        <p className="organization-selection-status" role="status">{busyId ? 'Activation de votre organisation et préparation du site…' : 'Le site sera sélectionné automatiquement si un seul est accessible.'}</p>
      </section>
      <footer className="organization-selection-footer">PharmaERP · Gestion de pharmacie</footer>
    </main>
  );
}
