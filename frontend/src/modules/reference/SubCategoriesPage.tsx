import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { usePermission } from '../../hooks/usePermission';
import { apiErrorMessage } from '../../services/apiError';
import { Article, articlesService } from '../../services/articles.service';
import { codeGeneratorService } from '../../services/codeGenerator.service';
import { CategoryItem, referenceService, SubCategoryItem } from '../../services/reference.service';
import { ActiveBadge, ReferenceExportActions, ReferenceHeader, ReferenceSummary, summarizeActive } from './reference-ui';

export function SubCategoriesPage() {
  const qc = useQueryClient();
  const { can } = usePermission();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubCategoryId, setEditingSubCategoryId] = useState<string | null>(null);
  const [detailSubCategoryId, setDetailSubCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryCode, setCode] = useState('');
  const [subCategoryName, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await referenceService.categories.getAll()).data });
  const query = useQuery({ queryKey: ['sub-categories'], queryFn: async () => (await referenceService.subCategories.getAll()).data });
  const detailQuery = useQuery({
    queryKey: ['sub-categories', detailSubCategoryId],
    enabled: Boolean(detailSubCategoryId),
    queryFn: async () => (await referenceService.subCategories.getById(detailSubCategoryId as string)).data,
  });
  const articles = useQuery({
    queryKey: ['articles', 'sub-category-detail'],
    queryFn: async () => fetchAllArticles(),
  });
  const nextCode = useQuery({
    queryKey: ['next-code', 'sub_categories', modalOpen],
    enabled: modalOpen && can('sub_categories.create') && !editingSubCategoryId,
    queryFn: async () => (await codeGeneratorService.next('sub_categories')).data.code,
  });

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      editingSubCategoryId
        ? (await referenceService.subCategories.update(editingSubCategoryId, payload)).data
        : (await referenceService.subCategories.create(payload)).data,
    onSuccess: (saved) => {
      resetForm();
      setFormError('');
      setModalOpen(false);
      qc.invalidateQueries({ queryKey: ['sub-categories'] });
      setDetailSubCategoryId(saved.subCategoryId);
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  });

  const rows = filterRows(query.data ?? [], search, (row) => [row.subCategoryCode, row.subCategoryName, row.categoryName, row.description]);
  const summary = summarizeActive(query.data ?? []);
  const exportRows = useMemo(
    () => [['Code', 'Nom', 'Parent', 'Description', 'Statut'], ...rows.map((row) => [row.subCategoryCode, row.subCategoryName, row.categoryName ?? '-', row.description ?? '', row.isActive ? 'Actif' : 'Inactif'])],
    [rows],
  );
  const detailSubCategory = detailQuery.data ?? rows.find((row) => row.subCategoryId === detailSubCategoryId) ?? null;
  const parentCategory = useMemo(
    () => (categories.data ?? []).find((item) => item.categoryId === (detailSubCategory?.categoryId ?? categoryId)) ?? null,
    [categories.data, categoryId, detailSubCategory?.categoryId],
  );
  const associatedArticleCount = useMemo(
    () => (articles.data ?? []).filter((article) => article.subCategoryId === (detailSubCategoryId ?? editingSubCategoryId)).length,
    [articles.data, detailSubCategoryId, editingSubCategoryId],
  );
  const deactivationWarning = !isActive && (editingSubCategoryId || detailSubCategoryId) && associatedArticleCount > 0
    ? "Cette sous-categorie contient deja des articles. Sa desactivation ne supprimera ni ne modifiera les articles existants."
    : '';

  useEffect(() => {
    if (modalOpen && !editingSubCategoryId && !subCategoryCode && nextCode.data) {
      setCode(nextCode.data);
    }
  }, [editingSubCategoryId, modalOpen, nextCode.data, subCategoryCode]);

  function resetForm() {
    setEditingSubCategoryId(null);
    setCategoryId('');
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

  function openEdit(subCategory: SubCategoryItem) {
    setEditingSubCategoryId(subCategory.subCategoryId);
    setCategoryId(subCategory.categoryId);
    setCode(subCategory.subCategoryCode);
    setName(subCategory.subCategoryName);
    setDescription(subCategory.description ?? '');
    setIsActive(subCategory.isActive);
    setFormError('');
    setModalOpen(true);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');
    save.mutate({
      categoryId,
      subCategoryCode,
      subCategoryName,
      description: description || undefined,
      isActive,
    });
  }

  return (
    <>
      <ReferenceHeader title="Sous-categories">
        <div className="reference-actions">
          <ReferenceExportActions baseName="sous_categories" sheetName="Sous categories" rows={exportRows} jsonData={rows} disabled={rows.length === 0} />
          {can('sub_categories.create') && <button className="button compact-button" onClick={openCreate}>Nouvelle sous-categorie</button>}
        </div>
      </ReferenceHeader>
      {(save.isError && !formError) && <p className="form-error">{apiErrorMessage(save.error)}</p>}
      <ReferenceSummary total={(query.data ?? []).length} filtered={rows.length} active={summary.active} inactive={summary.inactive} />

      <Modal title={editingSubCategoryId ? 'Modifier la sous-categorie' : 'Nouvelle sous-categorie'} open={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }}>
        <form className="form-grid reference-form" onSubmit={submit}>
          {formError && <p className="form-error">{formError}</p>}
          {deactivationWarning && <p className="form-warning">{deactivationWarning}</p>}
          <label><span>Parent</span><select className="input compact-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required><option value="">Categorie</option>{(categories.data ?? []).map((category) => <option key={category.categoryId} value={category.categoryId}>{category.categoryName}</option>)}</select></label>
          <label><span>Code</span><input className="input compact-input" placeholder={nextCode.data ?? 'Code'} value={subCategoryCode || nextCode.data || ''} onChange={(e) => setCode(e.target.value)} required /></label>
          <label><span>Nom</span><input className="input compact-input" placeholder="Nom sous-categorie" value={subCategoryName} onChange={(e) => setName(e.target.value)} required /></label>
          <label><span>Description</span><input className="input compact-input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <label className="reference-toggle"><span>Actif</span><input checked={isActive} type="checkbox" onChange={(e) => setIsActive(e.target.checked)} /></label>
          <div className="modal-actions">
            <button className="ghost-button compact-button" type="button" onClick={() => { setModalOpen(false); resetForm(); }}>Annuler</button>
            <button className="button compact-button" disabled={save.isPending}>{save.isPending ? 'Enregistrement...' : editingSubCategoryId ? 'Enregistrer les modifications' : 'Enregistrer'}</button>
          </div>
        </form>
      </Modal>

      <div className="card reference-filters"><SearchBox value={search} onChange={setSearch} placeholder="Rechercher code, nom, parent..." /></div>
      <div className="card table-card">
        {query.isLoading ? <p className="loading-state">Chargement...</p> : rows.length === 0 ? <p className="empty-state">Aucune sous-categorie trouvee.</p> : (
          <div className="table-wrap reference-table-wrap">
            <table className="data-table reference-table">
              <thead><tr><th>Code</th><th>Nom</th><th>Parent</th><th>Description</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.subCategoryId}>
                  <td><strong>{row.subCategoryCode}</strong></td>
                  <td>{row.subCategoryName}</td>
                  <td>{row.categoryName ?? '-'}</td>
                  <td>{row.description ?? '-'}</td>
                  <td><ActiveBadge active={row.isActive} /></td>
                  <td>
                    <div className="article-action-group">
                      <button className="ghost-button compact-button article-view-button" type="button" onClick={() => setDetailSubCategoryId(row.subCategoryId)}>Voir</button>
                      {can('sub_categories.update') && <button className="ghost-button compact-button article-edit-button" type="button" onClick={() => openEdit(row)}>Modifier</button>}
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      <SubCategoryDetailModal
        articleCount={associatedArticleCount}
        canEdit={can('sub_categories.update')}
        isError={detailQuery.isError}
        isLoading={detailQuery.isLoading}
        onClose={() => setDetailSubCategoryId(null)}
        onEdit={() => detailSubCategory && openEdit(detailSubCategory)}
        parentCategory={parentCategory}
        subCategory={detailSubCategory}
      />
    </>
  );
}

function SubCategoryDetailModal({
  articleCount,
  canEdit,
  isError,
  isLoading,
  onClose,
  onEdit,
  parentCategory,
  subCategory,
}: {
  articleCount: number;
  canEdit: boolean;
  isError: boolean;
  isLoading: boolean;
  onClose: () => void;
  onEdit: () => void;
  parentCategory: CategoryItem | null;
  subCategory: SubCategoryItem | null;
}) {
  if (!subCategory && !isLoading && !isError) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel article-detail-modal">
        <div className="modal-header">
          <div>
            <h2>{subCategory?.subCategoryName ?? 'Sous-categorie'}</h2>
            <p className="muted">{subCategory?.subCategoryCode ?? 'Chargement...'}</p>
          </div>
          <div className="reference-actions">
            {canEdit && subCategory && <button className="ghost-button compact-button article-edit-button" type="button" onClick={onEdit}>Modifier</button>}
            <button className="ghost-button compact-button article-view-button" type="button" onClick={onClose}>Retour</button>
          </div>
        </div>
        {isLoading ? <p className="loading-state">Chargement du detail...</p> : isError ? <p className="form-error">Impossible de charger la sous-categorie.</p> : !subCategory ? <p className="empty-state">Sous-categorie introuvable.</p> : (
          <>
            <div className="detail-grid">
              <div><span>Parent</span><strong>{parentCategory?.categoryName ?? subCategory.categoryName ?? '-'}</strong></div>
              <div><span>Code</span><strong>{subCategory.subCategoryCode}</strong></div>
              <div><span>Nom</span><strong>{subCategory.subCategoryName}</strong></div>
              <div><span>Description</span><strong>{subCategory.description || '-'}</strong></div>
              <div><span>Statut</span><strong><ActiveBadge active={subCategory.isActive} /></strong></div>
              <div><span>Articles associes</span><strong>{articleCount}</strong></div>
            </div>
            {!subCategory.isActive && articleCount > 0 && (
              <p className="form-warning">Cette sous-categorie contient deja des articles. Sa desactivation ne supprimera ni ne modifiera les articles existants.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

async function fetchAllArticles() {
  const firstPage = (await articlesService.getAll({ page: 1, limit: 100 })).data;
  const pageCount = Math.ceil(firstPage.total / firstPage.limit);
  if (pageCount <= 1) return firstPage.items;

  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => articlesService.getAll({ page: index + 2, limit: 100 })),
  );

  return [
    ...firstPage.items,
    ...remainingPages.flatMap((page) => page.data.items),
  ];
}
