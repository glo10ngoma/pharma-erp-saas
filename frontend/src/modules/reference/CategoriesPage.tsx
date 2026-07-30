import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { usePermission } from '../../hooks/usePermission';
import { filterRows } from '../../lib/search';
import { apiErrorMessage } from '../../services/apiError';
import { articlesService } from '../../services/articles.service';
import { codeGeneratorService } from '../../services/codeGenerator.service';
import { CategoryItem, referenceService, SubCategoryItem } from '../../services/reference.service';
import { ActiveBadge, ReferenceExportActions, ReferenceHeader, ReferenceSummary, summarizeActive } from './reference-ui';

export function CategoriesPage() {
  const qc = useQueryClient();
  const { can } = usePermission();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [detailCategoryId, setDetailCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryCode, setCode] = useState('');
  const [categoryName, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState('');
  const focusedCategoryId = detailCategoryId ?? editingCategoryId;

  const query = useQuery({ queryKey: ['categories'], queryFn: async () => (await referenceService.categories.getAll()).data });
  const subCategories = useQuery({ queryKey: ['sub-categories'], queryFn: async () => (await referenceService.subCategories.getAll()).data });
  const detailQuery = useQuery({
    queryKey: ['categories', detailCategoryId],
    enabled: Boolean(detailCategoryId),
    queryFn: async () => (await referenceService.categories.getById(detailCategoryId as string)).data,
  });
  const detailArticles = useQuery({
    queryKey: ['articles', 'category-detail', focusedCategoryId],
    enabled: Boolean(focusedCategoryId),
    queryFn: async () => (await articlesService.getAll({ categoryId: focusedCategoryId, page: 1, limit: 1 })).data,
  });
  const nextCode = useQuery({
    queryKey: ['next-code', 'categories', modalOpen],
    enabled: modalOpen && can('categories.create') && !editingCategoryId,
    queryFn: async () => (await codeGeneratorService.next('categories')).data.code,
  });

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      editingCategoryId
        ? (await referenceService.categories.update(editingCategoryId, payload)).data
        : (await referenceService.categories.create(payload)).data,
    onSuccess: (saved) => {
      setFormError('');
      resetForm();
      setModalOpen(false);
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['sub-categories'] });
      setDetailCategoryId(saved.categoryId);
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  });

  const rows = filterRows(query.data ?? [], search, (category) => [category.categoryCode, category.categoryName, category.description]);
  const summary = summarizeActive(query.data ?? []);
  const exportRows = useMemo(
    () => [['Code', 'Nom', 'Description', 'Statut'], ...rows.map((row) => [row.categoryCode, row.categoryName, row.description ?? '', row.isActive ? 'Actif' : 'Inactif'])],
    [rows],
  );
  const linkedSubCategories = useMemo(
    () => (subCategories.data ?? []).filter((row) => row.categoryId === detailCategoryId),
    [detailCategoryId, subCategories.data],
  );
  const detailCategory = detailQuery.data ?? rows.find((row) => row.categoryId === detailCategoryId) ?? null;
  const articleCount = detailArticles.data?.total ?? 0;
  const deactivationWarning = !isActive && editingCategoryId && articleCount > 0
    ? "Cette categorie contient deja des articles. Sa desactivation ne supprimera ni ne modifiera les articles existants."
    : '';

  useEffect(() => {
    if (modalOpen && !editingCategoryId && !categoryCode && nextCode.data) {
      setCode(nextCode.data);
    }
  }, [categoryCode, editingCategoryId, modalOpen, nextCode.data]);

  function resetForm() {
    setEditingCategoryId(null);
    setCode('');
    setName('');
    setDescription('');
    setIsActive(true);
    setFormError('');
  }

  function openCreate() {
    resetForm();
    setCode(nextCode.data ?? '');
    setModalOpen(true);
  }

  function openEdit(category: CategoryItem) {
    setEditingCategoryId(category.categoryId);
    setCode(category.categoryCode);
    setName(category.categoryName);
    setDescription(category.description ?? '');
    setIsActive(category.isActive);
    setFormError('');
    setModalOpen(true);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');
    save.mutate({
      categoryCode,
      categoryName,
      description: description || undefined,
      isActive,
    });
  }

  return (
    <>
      <ReferenceHeader title="Categories">
        <div className="reference-actions">
          <ReferenceExportActions baseName="categories" sheetName="Categories" rows={exportRows} jsonData={rows} disabled={rows.length === 0} />
          {can('categories.create') && <button className="button compact-button" onClick={openCreate}>Nouvelle categorie</button>}
        </div>
      </ReferenceHeader>
      {(save.isError && !formError) && <p className="form-error">{apiErrorMessage(save.error)}</p>}
      <ReferenceSummary total={(query.data ?? []).length} filtered={rows.length} active={summary.active} inactive={summary.inactive} />

      <Modal title={editingCategoryId ? 'Modifier la categorie' : 'Nouvelle categorie'} open={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }}>
        <form className="form-grid reference-form" onSubmit={submit}>
          {formError && <p className="form-error">{formError}</p>}
          {deactivationWarning && <p className="form-warning">{deactivationWarning}</p>}
          <label><span>Code</span><input className="input compact-input" placeholder={nextCode.data ?? 'Code'} value={categoryCode || nextCode.data || ''} onChange={(e) => setCode(e.target.value)} required /></label>
          <label><span>Nom</span><input className="input compact-input" placeholder="Nom categorie" value={categoryName} onChange={(e) => setName(e.target.value)} required /></label>
          <label><span>Description</span><input className="input compact-input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <label className="reference-toggle"><span>Actif</span><input checked={isActive} type="checkbox" onChange={(e) => setIsActive(e.target.checked)} /></label>
          <div className="modal-actions">
            <button className="ghost-button compact-button" type="button" onClick={() => { setModalOpen(false); resetForm(); }}>Annuler</button>
            <button className="button compact-button" disabled={save.isPending}>{save.isPending ? 'Enregistrement...' : editingCategoryId ? 'Enregistrer les modifications' : 'Enregistrer'}</button>
          </div>
        </form>
      </Modal>

      <div className="card reference-filters"><SearchBox value={search} onChange={setSearch} placeholder="Rechercher code, nom, description..." /></div>

      <div className="card table-card">
        {query.isLoading ? <p className="loading-state">Chargement...</p> : rows.length === 0 ? <p className="empty-state">Aucune categorie trouvee.</p> : (
          <div className="table-wrap reference-table-wrap">
            <table className="data-table reference-table">
              <thead><tr><th>Code</th><th>Nom</th><th>Description</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.categoryId}>
                  <td><strong>{row.categoryCode}</strong></td>
                  <td>{row.categoryName}</td>
                  <td>{row.description ?? '-'}</td>
                  <td><ActiveBadge active={row.isActive} /></td>
                  <td>
                    <div className="article-action-group">
                      <button className="ghost-button compact-button article-view-button" type="button" onClick={() => setDetailCategoryId(row.categoryId)}>Voir</button>
                      {can('categories.update') && <button className="ghost-button compact-button article-edit-button" type="button" onClick={() => openEdit(row)}>Modifier</button>}
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      <CategoryDetailModal
        articleCount={articleCount}
        canEdit={can('categories.update')}
        category={detailCategory}
        isError={detailQuery.isError}
        isLoading={detailQuery.isLoading}
        onClose={() => setDetailCategoryId(null)}
        onEdit={() => detailCategory && openEdit(detailCategory)}
        subCategories={linkedSubCategories}
      />
    </>
  );
}

function CategoryDetailModal({
  articleCount,
  canEdit,
  category,
  isError,
  isLoading,
  onClose,
  onEdit,
  subCategories,
}: {
  articleCount: number;
  canEdit: boolean;
  category: CategoryItem | null;
  isError: boolean;
  isLoading: boolean;
  onClose: () => void;
  onEdit: () => void;
  subCategories: SubCategoryItem[];
}) {
  if (!category && !isLoading && !isError) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel article-detail-modal">
        <div className="modal-header">
          <div>
            <h2>{category?.categoryName ?? 'Categorie'}</h2>
            <p className="muted">{category?.categoryCode ?? 'Chargement...'}</p>
          </div>
          <div className="reference-actions">
            {canEdit && category && <button className="ghost-button compact-button article-edit-button" type="button" onClick={onEdit}>Modifier</button>}
            <button className="ghost-button compact-button article-view-button" type="button" onClick={onClose}>Retour</button>
          </div>
        </div>
        {isLoading ? <p className="loading-state">Chargement du detail...</p> : isError ? <p className="form-error">Impossible de charger la categorie.</p> : !category ? <p className="empty-state">Categorie introuvable.</p> : (
          <>
            <div className="detail-grid">
              <div><span>Code</span><strong>{category.categoryCode}</strong></div>
              <div><span>Nom</span><strong>{category.categoryName}</strong></div>
              <div><span>Description</span><strong>{category.description || '-'}</strong></div>
              <div><span>Statut</span><strong><ActiveBadge active={category.isActive} /></strong></div>
              <div><span>Articles associes</span><strong>{articleCount}</strong></div>
              <div><span>Sous-categories</span><strong>{subCategories.length}</strong></div>
            </div>
            {!category.isActive && articleCount > 0 && (
              <p className="form-warning">Cette categorie contient deja des articles. Sa desactivation ne supprimera ni ne modifiera les articles existants.</p>
            )}
            <div className="table-wrap">
              <table className="data-table reference-table">
                <thead><tr><th>Sous-categorie</th><th>Code</th><th>Statut</th></tr></thead>
                <tbody>
                  {subCategories.length === 0 ? <tr><td colSpan={3}>Aucune sous-categorie associee.</td></tr> : subCategories.map((row) => (
                    <tr key={row.subCategoryId}>
                      <td>{row.subCategoryName}</td>
                      <td>{row.subCategoryCode}</td>
                      <td><ActiveBadge active={row.isActive} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
