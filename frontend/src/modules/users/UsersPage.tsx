import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { apiErrorMessage } from '../../services/apiError';
import { rolesService } from '../../services/roles.service';
import { sitesService } from '../../services/sites.service';
import { CreateUserPayload, UserItem, usersService } from '../../services/users.service';
import { AdminExportActions, AdminSummary } from '../administration/admin-ui';

type UserFormState = {
  firstName: string;
  lastName: string;
  postName: string;
  gender: string;
  birthDate: string;
  phone: string;
  jobTitle: string;
  employeeNumber: string;
  department: string;
  email: string;
  password: string;
  roleId: string;
  siteId: string;
  isActive: boolean;
};

const emptyForm: UserFormState = {
  firstName: '',
  lastName: '',
  postName: '',
  gender: '',
  birthDate: '',
  phone: '',
  jobTitle: '',
  employeeNumber: '',
  department: '',
  email: '',
  password: '',
  roleId: '',
  siteId: '',
  isActive: true,
};

export function UsersPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState<UserFormState>(emptyForm);
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
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const update = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: Omit<CreateUserPayload, 'password'> }) => usersService.update(userId, payload),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  useEffect(() => {
    if (!modalOpen) setShowPassword(false);
  }, [modalOpen]);

  function updateForm<K extends keyof UserFormState>(key: K, value: UserFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setEditingUser(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(user: UserItem) {
    setEditingUser(user);
    setForm({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      postName: user.postName ?? '',
      gender: user.gender ?? '',
      birthDate: user.birthDate ? String(user.birthDate).slice(0, 10) : '',
      phone: user.phone ?? '',
      jobTitle: user.jobTitle ?? '',
      employeeNumber: user.employeeNumber ?? '',
      department: user.department ?? '',
      email: user.email ?? '',
      password: '',
      roleId: user.roleId,
      siteId: user.siteId,
      isActive: user.isActive,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingUser(null);
    setForm(emptyForm);
    setShowPassword(false);
    create.reset();
    update.reset();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    const payload = cleanPayload({
      fullName: buildFullName(form),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      postName: form.postName.trim(),
      gender: form.gender,
      birthDate: form.birthDate,
      phone: form.phone.trim(),
      jobTitle: form.jobTitle.trim(),
      employeeNumber: form.employeeNumber.trim(),
      department: form.department.trim(),
      username: email,
      email,
      roleId: form.roleId,
      siteId: form.siteId,
      isActive: form.isActive,
    });

    if (editingUser) {
      update.mutate({ userId: editingUser.userId, payload });
      return;
    }

    create.mutate({ ...payload, password: form.password });
  }

  const rows = filterRows(users.data ?? [], search, (user) => [
    user.fullName,
    user.firstName,
    user.lastName,
    user.postName,
    user.email,
    user.phone,
    user.employeeNumber,
    user.jobTitle,
    user.department,
    user.roleName,
    user.siteName,
  ])
    .filter((user) => !roleFilter || user.roleId === roleFilter)
    .filter((user) => !siteFilter || user.siteId === siteFilter)
    .filter((user) => !statusFilter || String(user.isActive) === statusFilter);
  const exportRows = useMemo(
    () => [
      ['Nom', 'Email', 'Fonction', 'Matricule', 'Telephone', 'Role', 'Site', 'Actif'],
      ...rows.map((user) => [user.fullName, user.email ?? '-', user.jobTitle ?? '-', user.employeeNumber ?? '-', user.phone ?? '-', user.roleName ?? '-', user.siteName ?? '-', user.isActive ? 'Oui' : 'Non']),
    ],
    [rows],
  );
  const error = create.error || update.error;
  const isSaving = create.isPending || update.isPending;

  return (
    <>
      <div className="page-heading reference-heading">
        <div><h1>Utilisateurs</h1><p className="muted">Comptes, roles, fonctions et sites rattaches.</p></div>
        <div className="reference-actions"><AdminExportActions baseName="utilisateurs" sheetName="Utilisateurs" rows={exportRows} jsonData={rows} disabled={rows.length === 0} /><button className="button compact-button" onClick={openCreate}>Nouvel utilisateur</button></div>
      </div>
      <AdminSummary cards={[{ label: 'Total', value: users.data?.length ?? 0 }, { label: 'Actifs', value: (users.data ?? []).filter((user) => user.isActive).length }, { label: 'Inactifs', value: (users.data ?? []).filter((user) => !user.isActive).length }, { label: 'Admins', value: (users.data ?? []).filter((user) => user.roleName === 'ADMIN').length }]} />
      <Modal title={editingUser ? 'Modifier utilisateur' : 'Nouvel utilisateur'} open={modalOpen} onClose={closeModal}>
        <form className="admin-user-form" onSubmit={submit}>
          <UserFormSections
            form={form}
            editing={Boolean(editingUser)}
            isSaving={isSaving}
            showPassword={showPassword}
            roles={roles.data ?? []}
            sites={sites.data ?? []}
            onChange={updateForm}
            onTogglePassword={() => setShowPassword((current) => !current)}
          />
          {error ? <p className="form-error">{apiErrorMessage(error)}</p> : null}
          <div className="modal-actions admin-user-modal-actions">
            <button type="button" className="ghost-button" onClick={closeModal}>Annuler</button>
            <button className="button" disabled={isSaving}>{editingUser ? 'Enregistrer' : "Creer l'utilisateur"}</button>
          </div>
        </form>
      </Modal>
      <div className="card reference-filters admin-user-filters"><SearchBox value={search} onChange={setSearch} placeholder="Nom, prenom, email, telephone, matricule..." /><select className="input compact-input" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="">Tous roles</option>{(roles.data ?? []).map((role) => <option key={role.roleId} value={role.roleId}>{role.roleName}</option>)}</select><select className="input compact-input" value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}><option value="">Tous sites</option>{(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}</select><select className="input compact-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Tous statuts</option><option value="true">Actifs</option><option value="false">Inactifs</option></select></div>
      <div className="card">
        {users.isLoading ? <p className="loading-state">Chargement des utilisateurs...</p> : rows.length === 0 ? <p className="empty-state">Aucun utilisateur trouve.</p> : (
          <div className="table-wrap">
          <table className="data-table admin-users-table">
            <thead><tr><th>Utilisateur</th><th>Fonction</th><th>Role</th><th>Site</th><th>Telephone</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>{rows.map((user) => (
              <tr key={user.userId}><td><strong>{user.fullName}</strong><span className="admin-user-secondary">{user.email || user.username}</span></td><td>{user.jobTitle || '-'}</td><td>{user.roleName || '-'}</td><td>{user.siteName || '-'}</td><td>{user.phone || '-'}</td><td><span className={`badge ${user.isActive ? 'badge-success' : 'badge-muted'}`}>{user.isActive ? 'Actif' : 'Inactif'}</span></td><td><button className="ghost-button compact-button" onClick={() => openEdit(user)}>Modifier</button></td></tr>
            ))}</tbody>
          </table>
          </div>
        )}
      </div>
    </>
  );
}

function UserFormSections({
  form,
  editing,
  isSaving,
  showPassword,
  roles,
  sites,
  onChange,
  onTogglePassword,
}: {
  form: UserFormState;
  editing: boolean;
  isSaving: boolean;
  showPassword: boolean;
  roles: Array<{ roleId: string; roleName: string }>;
  sites: Array<{ siteId: string; siteName: string }>;
  onChange: <K extends keyof UserFormState>(key: K, value: UserFormState[K]) => void;
  onTogglePassword: () => void;
}) {
  return (
    <>
      <section className="admin-user-section">
        <h3>Informations personnelles</h3>
        <div className="admin-user-grid">
          <Field label="Nom *"><input className="input" value={form.lastName} onChange={(event) => onChange('lastName', event.target.value)} placeholder="Ngoma" required /></Field>
          <Field label="Post-nom"><input className="input" value={form.postName} onChange={(event) => onChange('postName', event.target.value)} placeholder="Kabasele" /></Field>
          <Field label="Prenom *"><input className="input" value={form.firstName} onChange={(event) => onChange('firstName', event.target.value)} placeholder="Oricia" required /></Field>
          <Field label="Sexe"><select className="input" value={form.gender} onChange={(event) => onChange('gender', event.target.value)}><option value="">Non renseigne</option><option value="MALE">Homme</option><option value="FEMALE">Femme</option><option value="OTHER">Autre</option></select></Field>
          <Field label="Date de naissance"><input className="input" type="date" max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={(event) => onChange('birthDate', event.target.value)} /></Field>
          <Field label="Telephone"><input className="input" value={form.phone} onChange={(event) => onChange('phone', event.target.value)} placeholder="+243..." /></Field>
        </div>
      </section>

      <section className="admin-user-section">
        <h3>Informations professionnelles</h3>
        <div className="admin-user-grid">
          <Field label="Fonction / Poste *"><input className="input" value={form.jobTitle} onChange={(event) => onChange('jobTitle', event.target.value)} placeholder="Pharmacien, Caissier..." required /></Field>
          <Field label="Matricule employe"><input className="input" value={form.employeeNumber} onChange={(event) => onChange('employeeNumber', event.target.value)} placeholder="EMP-0001" /></Field>
          <Field label="Service / Departement"><input className="input" value={form.department} onChange={(event) => onChange('department', event.target.value)} placeholder="Officine, Caisse..." /></Field>
        </div>
      </section>

      <section className="admin-user-section">
        <h3>Compte & acces PharmaERP</h3>
        <div className="admin-user-grid">
          <Field label="Email / Identifiant *"><input className="input" type="email" value={form.email} onChange={(event) => onChange('email', event.target.value)} placeholder="utilisateur@pharmaerp.local" required /></Field>
          <Field label="Role *"><select className="input" value={form.roleId} onChange={(event) => onChange('roleId', event.target.value)} required><option value="">Selectionner un role</option>{roles.map((role) => <option key={role.roleId} value={role.roleId}>{role.roleName}</option>)}</select></Field>
          <Field label="Site principal *"><select className="input" value={form.siteId} onChange={(event) => onChange('siteId', event.target.value)} required><option value="">Selectionner un site</option>{sites.map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}</select></Field>
          {!editing ? <Field label="Mot de passe temporaire *"><div className="admin-password-field"><input className="input" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => onChange('password', event.target.value)} minLength={6} placeholder="6 caracteres minimum" required /><button type="button" className="ghost-button compact-button" onClick={onTogglePassword}>{showPassword ? 'Masquer' : 'Afficher'}</button></div><small>Minimum 6 caracteres. Il ne sera pas affiche apres creation.</small></Field> : null}
          <Field label="Statut"><select className="input" value={String(form.isActive)} onChange={(event) => onChange('isActive', event.target.value === 'true')} disabled={isSaving}><option value="true">Actif</option><option value="false">Inactif</option></select></Field>
        </div>
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field-block"><span>{label}</span>{children}</label>;
}

function buildFullName(form: UserFormState) {
  return [form.firstName, form.lastName, form.postName].map((part) => part.trim()).filter(Boolean).join(' ');
}

function cleanPayload<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, value === '' ? undefined : value])) as T;
}
