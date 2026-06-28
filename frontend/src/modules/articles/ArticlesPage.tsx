import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { usePermission } from '../../hooks/usePermission';
import { articlesService, Article } from '../../services/articles.service';
import { codeGeneratorService } from '../../services/codeGenerator.service';
import { lotsService } from '../../services/lots.service';
import { referenceService } from '../../services/reference.service';
import { stocksService } from '../../services/stocks.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import { ActiveBadge, ReferenceExportActions, ReferenceHeader, ReferenceSummary, summarizeActive } from '../reference/reference-ui';

export function ArticlesPage() {
  const qc = useQueryClient();
  const { can } = usePermission();
  const [modalOpen, setModalOpen] = useState(false);
  const [detailArticle, setDetailArticle] = useState<Article | null>(null);
  const [search, setSearch] = useState('');
  const [articleCode, setArticleCode] = useState('');
  const [commercialName, setCommercialName] = useState('');
  const [dci, setDci] = useState('');
  const [dosage, setDosage] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [formId, setFormId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [productTypeId, setProductTypeId] = useState('');
  const [atcCode, setAtcCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [defaultStockMin, setDefaultStockMin] = useState('0');
  const [defaultStockMax, setDefaultStockMax] = useState('');

  const articles = useQuery({ queryKey: ['articles', search], queryFn: async () => fetchArticlesForList(search) });
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await referenceService.categories.getAll()).data });
  const subCategories = useQuery({ queryKey: ['sub-categories'], queryFn: async () => (await referenceService.subCategories.getAll()).data });
  const forms = useQuery({ queryKey: ['galenic-forms'], queryFn: async () => (await referenceService.galenicForms.getAll()).data });
  const routes = useQuery({ queryKey: ['administration-routes'], queryFn: async () => (await referenceService.administrationRoutes.getAll()).data });
  const productTypes = useQuery({ queryKey: ['product-types'], queryFn: async () => (await referenceService.productTypes.getAll()).data });
  const lots = useQuery({ queryKey: ['lots', 'articles-detail'], queryFn: async () => (await lotsService.getAll()).data });
  const stocks = useQuery({ queryKey: ['stocks', 'articles-detail'], queryFn: async () => (await stocksService.getAll()).data });
  const nextCode = useQuery({ queryKey: ['next-code', 'articles', modalOpen], enabled: modalOpen && can('articles.create'), queryFn: async () => (await codeGeneratorService.next('articles')).data.code });
  const create = useMutation({ mutationFn: articlesService.create, onSuccess: () => { resetForm(); setModalOpen(false); qc.invalidateQueries({ queryKey: ['articles'] }); } });

  const rows = articles.data?.items ?? [];
  const categoryById = useMemo(() => new Map((categories.data ?? []).map((item) => [item.categoryId, item.categoryName])), [categories.data]);
  const subCategoryById = useMemo(() => new Map((subCategories.data ?? []).map((item) => [item.subCategoryId, item.subCategoryName])), [subCategories.data]);
  const formById = useMemo(() => new Map((forms.data ?? []).map((item) => [item.formId, item.formName])), [forms.data]);
  const routeById = useMemo(() => new Map((routes.data ?? []).map((item) => [item.routeId, item.routeName])), [routes.data]);
  const typeById = useMemo(() => new Map((productTypes.data ?? []).map((item) => [item.productTypeId, item.typeName])), [productTypes.data]);
  const summary = summarizeActive(rows);
  const exportRows = useMemo(() => [
    ['Code article', 'Nom', 'DCI', 'Dosage', 'Forme', 'Voie', 'Type produit', 'Categorie', 'Sous-categorie', 'Code-barres', 'Stock min', 'Stock max', 'Statut'],
    ...rows.map((article) => [
      article.articleCode,
      article.commercialName,
      article.dci ?? '-',
      article.dosage ?? '-',
      formById.get(article.formId ?? '') ?? '-',
      routeById.get(article.routeId ?? '') ?? '-',
      typeById.get(article.productTypeId ?? '') ?? '-',
      categoryById.get(article.categoryId ?? '') ?? '-',
      subCategoryById.get(article.subCategoryId ?? '') ?? '-',
      article.barcode ?? '-',
      article.defaultStockMin,
      article.defaultStockMax ?? '-',
      article.isActive ? 'Actif' : 'Inactif',
    ]),
  ], [categoryById, formById, routeById, rows, subCategoryById, typeById]);

  function openCreate() {
    setArticleCode(nextCode.data ?? '');
    setModalOpen(true);
  }

  function resetForm() {
    setArticleCode('');
    setCommercialName('');
    setDci('');
    setDosage('');
    setCategoryId('');
    setSubCategoryId('');
    setFormId('');
    setRouteId('');
    setProductTypeId('');
    setAtcCode('');
    setBarcode('');
    setDefaultStockMin('0');
    setDefaultStockMax('');
  }

  useEffect(() => {
    if (modalOpen && !articleCode && nextCode.data) setArticleCode(nextCode.data);
  }, [articleCode, modalOpen, nextCode.data]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    create.mutate({
      articleCode,
      commercialName,
      dci: dci || undefined,
      dosage: dosage || undefined,
      categoryId: categoryId || undefined,
      subCategoryId: subCategoryId || undefined,
      formId: formId || undefined,
      routeId: routeId || undefined,
      productTypeId: productTypeId || undefined,
      atcCode: atcCode || undefined,
      barcode: barcode || undefined,
      prescriptionRequired: false,
      defaultStockMin: Number(defaultStockMin || 0),
      defaultStockMax: defaultStockMax ? Number(defaultStockMax) : undefined,
    });
  }

  return (
    <>
      <ReferenceHeader title="Articles">
        <div className="reference-actions">
          <ReferenceExportActions baseName="articles" sheetName="Articles" rows={exportRows} jsonData={rows} disabled={rows.length === 0} />
          {can('articles.create') && <button className="button compact-button" onClick={openCreate}>Nouvel article</button>}
        </div>
      </ReferenceHeader>
      <ReferenceSummary total={articles.data?.total ?? rows.length} filtered={rows.length} active={summary.active} inactive={summary.inactive} />
      {create.isError && <p className="form-error">Impossible de creer l'article.</p>}
      <Modal title="Nouvel article" open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="form-grid reference-form" onSubmit={submit}>
          <label><span>Code</span><input className="input compact-input" placeholder={nextCode.data ?? 'Code article'} value={articleCode || nextCode.data || ''} onChange={(e) => setArticleCode(e.target.value)} required /></label>
          <label><span>Nom</span><input className="input compact-input" placeholder="Nom commercial" value={commercialName} onChange={(e) => setCommercialName(e.target.value)} required /></label>
          <label><span>DCI</span><input className="input compact-input" placeholder="DCI" value={dci} onChange={(e) => setDci(e.target.value)} /></label>
          <label><span>Dosage</span><input className="input compact-input" placeholder="Dosage" value={dosage} onChange={(e) => setDosage(e.target.value)} /></label>
          <label><span>Categorie</span><select className="input compact-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Categorie</option>{(categories.data ?? []).map((item) => <option key={item.categoryId} value={item.categoryId}>{item.categoryName}</option>)}</select></label>
          <label><span>Sous-categorie</span><select className="input compact-input" value={subCategoryId} onChange={(e) => setSubCategoryId(e.target.value)}><option value="">Sous-categorie</option>{(subCategories.data ?? []).filter((item) => !categoryId || item.categoryId === categoryId).map((item) => <option key={item.subCategoryId} value={item.subCategoryId}>{item.subCategoryName}</option>)}</select></label>
          <label><span>Forme</span><select className="input compact-input" value={formId} onChange={(e) => setFormId(e.target.value)}><option value="">Forme</option>{(forms.data ?? []).map((item) => <option key={item.formId} value={item.formId}>{item.formName}</option>)}</select></label>
          <label><span>Voie</span><select className="input compact-input" value={routeId} onChange={(e) => setRouteId(e.target.value)}><option value="">Voie</option>{(routes.data ?? []).map((item) => <option key={item.routeId} value={item.routeId}>{item.routeName}</option>)}</select></label>
          <label><span>Type</span><select className="input compact-input" value={productTypeId} onChange={(e) => setProductTypeId(e.target.value)}><option value="">Type produit</option>{(productTypes.data ?? []).map((item) => <option key={item.productTypeId} value={item.productTypeId}>{item.typeName}</option>)}</select></label>
          <label><span>ATC</span><input className="input compact-input" placeholder="ATC" value={atcCode} onChange={(e) => setAtcCode(e.target.value)} /></label>
          <label><span>Barcode</span><input className="input compact-input" placeholder="Code-barres" value={barcode} onChange={(e) => setBarcode(e.target.value)} /></label>
          <label><span>Stock min</span><input className="input compact-input" placeholder="Min" type="number" value={defaultStockMin} onChange={(e) => setDefaultStockMin(e.target.value)} /></label>
          <label><span>Stock max</span><input className="input compact-input" placeholder="Max" type="number" value={defaultStockMax} onChange={(e) => setDefaultStockMax(e.target.value)} /></label>
          <div className="modal-actions"><button className="ghost-button compact-button" type="button" onClick={() => setModalOpen(false)}>Annuler</button><button className="button compact-button" disabled={create.isPending}>{create.isPending ? 'Creation...' : 'Enregistrer'}</button></div>
        </form>
      </Modal>
      <div className="card reference-filters">
        <input className="input compact-input" placeholder="Scanner un code-barres ou taper un nom/code/DCI." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="card table-card">
        {articles.isLoading ? <p className="loading-state">Chargement des articles...</p> : rows.length === 0 ? <p className="empty-state">Aucun article trouve. Creez un article ou importez le catalogue.</p> : (
          <div className="table-wrap reference-table-wrap articles-table-wrap">
            <table className="data-table reference-table articles-table">
              <thead><tr><th>Code</th><th>Nom</th><th>DCI</th><th>Dosage</th><th>Categorie</th><th>Forme</th><th>Barcode</th><th>Stock min</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>{rows.map((article) => (
                <tr key={article.articleId}>
                  <td><strong>{article.articleCode}</strong></td>
                  <td>{article.commercialName}</td>
                  <td>{article.dci || '-'}</td>
                  <td>{article.dosage || '-'}</td>
                  <td>{categoryById.get(article.categoryId ?? '') ?? '-'}</td>
                  <td>{formById.get(article.formId ?? '') ?? '-'}</td>
                  <td>{article.barcode || '-'}</td>
                  <td className="quantity-cell">{article.defaultStockMin}</td>
                  <td><ActiveBadge active={article.isActive} /></td>
                  <td><button className="ghost-button compact-button article-view-button" onClick={() => setDetailArticle(article)}>Voir</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
      {detailArticle && (
        <ArticleDetailModal
          article={detailArticle}
          categoryName={categoryById.get(detailArticle.categoryId ?? '') ?? '-'}
          formName={formById.get(detailArticle.formId ?? '') ?? '-'}
          lots={lots.data ?? []}
          routeName={routeById.get(detailArticle.routeId ?? '') ?? '-'}
          stocks={stocks.data ?? []}
          subCategoryName={subCategoryById.get(detailArticle.subCategoryId ?? '') ?? '-'}
          typeName={typeById.get(detailArticle.productTypeId ?? '') ?? '-'}
          onClose={() => setDetailArticle(null)}
        />
      )}
    </>
  );
}

async function fetchArticlesForList(search: string) {
  const params = { search: search || undefined, limit: 100, page: 1 };
  const firstPage = (await articlesService.getAll(params)).data;
  const pageCount = Math.ceil(firstPage.total / firstPage.limit);
  if (pageCount <= 1) return firstPage;

  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      articlesService.getAll({ ...params, page: index + 2 }),
    ),
  );

  return {
    ...firstPage,
    items: [
      ...firstPage.items,
      ...remainingPages.flatMap((page) => page.data.items),
    ],
  };
}

function ArticleDetailModal({
  article,
  categoryName,
  formName,
  lots,
  onClose,
  routeName,
  stocks,
  subCategoryName,
  typeName,
}: {
  article: Article;
  categoryName: string;
  formName: string;
  lots: Awaited<ReturnType<typeof lotsService.getAll>>['data'];
  onClose: () => void;
  routeName: string;
  stocks: Awaited<ReturnType<typeof stocksService.getAll>>['data'];
  subCategoryName: string;
  typeName: string;
}) {
  const articleStocks = stocks.filter((stock) => stock.articleId === article.articleId);
  const articleLots = lots.filter((lot) => lot.articleId === article.articleId);
  const stockTotal = articleStocks.reduce((sum, stock) => sum + Number(stock.quantityAvailable ?? 0), 0);
  const averageSalePrice = articleLots.length ? articleLots.reduce((sum, lot) => sum + Number(lot.sellingPrice ?? 0), 0) / articleLots.length : Number(article.sellingPrice ?? 0);
  const nextExpiry = articleLots.map((lot) => lot.expiryDate).filter(Boolean).sort()[0];
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel article-detail-modal">
        <div className="modal-header">
          <div>
            <h2>{article.commercialName}</h2>
            <p className="muted">{article.articleCode} - {article.dci ?? 'DCI non renseignee'}</p>
          </div>
          <button className="ghost-button compact-button" type="button" onClick={onClose}>Fermer</button>
        </div>
        <div className="detail-grid">
          <div><span>Code article</span><strong>{article.articleCode}</strong></div>
          <div><span>Code-barres</span><strong>{article.barcode ?? '-'}</strong></div>
          <div><span>Dosage</span><strong>{article.dosage ?? '-'}</strong></div>
          <div><span>Statut</span><strong><ActiveBadge active={article.isActive} /></strong></div>
          <div><span>Categorie</span><strong>{categoryName}</strong></div>
          <div><span>Sous-categorie</span><strong>{subCategoryName}</strong></div>
          <div><span>Forme</span><strong>{formName}</strong></div>
          <div><span>Voie</span><strong>{routeName}</strong></div>
          <div><span>Type produit</span><strong>{typeName}</strong></div>
          <div><span>Stock min</span><strong>{article.defaultStockMin}</strong></div>
          <div><span>Stock max</span><strong>{article.defaultStockMax ?? '-'}</strong></div>
          <div><span>ATC</span><strong>{article.atcCode ?? '-'}</strong></div>
          <div><span>Stock total</span><strong>{stockTotal}</strong></div>
          <div><span>Prix vente moyen</span><strong>{formatMoney(averageSalePrice, 'USD')}</strong></div>
          <div><span>Prochaine expiration</span><strong>{nextExpiry ? formatDate(nextExpiry) : '-'}</strong></div>
        </div>
        <div className="table-wrap">
          <table className="data-table reference-table">
            <thead><tr><th>Lot</th><th>Expiration</th><th>Fournisseur</th><th>Prix achat</th><th>Prix vente</th><th>Bloque</th></tr></thead>
            <tbody>{articleLots.length === 0 ? <tr><td colSpan={6}>Aucun lot lie.</td></tr> : articleLots.slice(0, 8).map((lot) => <tr key={lot.lotId}><td>{lot.lotNumber}</td><td>{formatDate(lot.expiryDate)}</td><td>{lot.supplierName ?? '-'}</td><td className="numeric-text">{formatMoney(lot.purchasePrice, lot.currencyCode ?? 'USD', lot.currencySymbol)}</td><td className="numeric-text">{formatMoney(lot.sellingPrice, lot.currencyCode ?? 'USD', lot.currencySymbol)}</td><td>{lot.isBlocked ? 'Oui' : 'Non'}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
