import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FloatingSearchPopover } from '../../components/FloatingSearchPopover';
import { Modal } from '../../components/Modal';
import { usePermission } from '../../hooks/usePermission';
import { Article, articlesService } from '../../services/articles.service';
import { codeGeneratorService } from '../../services/codeGenerator.service';
import { lotsService } from '../../services/lots.service';
import {
  ActiveIngredientItem,
  AtcCodeItem,
  DosageItem,
  ProductUnitItem,
  referenceService,
} from '../../services/reference.service';
import { stocksService } from '../../services/stocks.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import {
  ActiveBadge,
  ReferenceExportActions,
  ReferenceHeader,
  ReferenceSummary,
  summarizeActive,
} from '../reference/reference-ui';

type SearchOption<T> =
  | { kind: 'existing'; item: T }
  | { kind: 'create'; label: string };

export function ArticlesPage() {
  const qc = useQueryClient();
  const { can } = usePermission();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [detailArticle, setDetailArticle] = useState<Article | null>(null);
  const [search, setSearch] = useState('');
  const [articleCode, setArticleCode] = useState('');
  const [commercialName, setCommercialName] = useState('');
  const [dciId, setDciId] = useState('');
  const [dciSearch, setDciSearch] = useState('');
  const [dciOpen, setDciOpen] = useState(false);
  const [dosageId, setDosageId] = useState('');
  const [dosageSearch, setDosageSearch] = useState('');
  const [dosageOpen, setDosageOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [formId, setFormId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [productTypeId, setProductTypeId] = useState('');
  const [atcId, setAtcId] = useState('');
  const [atcSearch, setAtcSearch] = useState('');
  const [atcOpen, setAtcOpen] = useState(false);
  const [salesUnitId, setSalesUnitId] = useState('');
  const [salesUnitSearch, setSalesUnitSearch] = useState('');
  const [salesUnitOpen, setSalesUnitOpen] = useState(false);
  const [packagingUnitId, setPackagingUnitId] = useState('');
  const [packagingUnitSearch, setPackagingUnitSearch] = useState('');
  const [packagingUnitOpen, setPackagingUnitOpen] = useState(false);
  const [unitsPerPackage, setUnitsPerPackage] = useState('');
  const [barcode, setBarcode] = useState('');
  const [defaultStockMin, setDefaultStockMin] = useState('0');
  const [defaultStockMax, setDefaultStockMax] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [editingArticleSnapshot, setEditingArticleSnapshot] = useState<Article | null>(null);

  const articles = useQuery({ queryKey: ['articles', search], queryFn: async () => fetchArticlesForList(search) });
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await referenceService.categories.getAll()).data });
  const subCategories = useQuery({ queryKey: ['sub-categories'], queryFn: async () => (await referenceService.subCategories.getAll()).data });
  const forms = useQuery({ queryKey: ['galenic-forms'], queryFn: async () => (await referenceService.galenicForms.getAll()).data });
  const routes = useQuery({ queryKey: ['administration-routes'], queryFn: async () => (await referenceService.administrationRoutes.getAll()).data });
  const productTypes = useQuery({ queryKey: ['product-types'], queryFn: async () => (await referenceService.productTypes.getAll()).data });
  const productUnits = useQuery({ queryKey: ['product-units'], queryFn: async () => (await referenceService.productUnits.getAll()).data });
  const dosages = useQuery({ queryKey: ['dosages'], queryFn: async () => (await referenceService.dosages.getAll()).data });
  const activeIngredients = useQuery({ queryKey: ['active-ingredients'], queryFn: async () => (await referenceService.activeIngredients.getAll()).data });
  const atcCodes = useQuery({ queryKey: ['atc-codes'], queryFn: async () => (await referenceService.atcCodes.getAll()).data });
  const lots = useQuery({ queryKey: ['lots', 'articles-detail'], queryFn: async () => (await lotsService.getAll()).data });
  const stocks = useQuery({ queryKey: ['stocks', 'articles-detail'], queryFn: async () => (await stocksService.getAll()).data });
  const nextCode = useQuery({
    queryKey: ['next-code', 'articles', modalOpen],
    enabled: modalOpen && can('articles.create') && !editingArticleId,
    queryFn: async () => (await codeGeneratorService.next('articles')).data.code,
  });

  const saveArticle = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      editingArticleId
        ? (await articlesService.update(editingArticleId, payload)).data
        : (await articlesService.create(payload)).data,
    onSuccess: () => {
      resetForm();
      setModalOpen(false);
      qc.invalidateQueries({ queryKey: ['articles'] });
    },
  });

  const createIngredient = useMutation({
    mutationFn: async (payload: { canonicalName: string }) => (await referenceService.activeIngredients.create(payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-ingredients'] }),
  });

  const createDosage = useMutation({
    mutationFn: async (payload: { dosageLabel: string }) => (await referenceService.dosages.create(payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dosages'] }),
  });

  const createAtc = useMutation({
    mutationFn: async (payload: { atcCode: string; atcLabel: string }) => (await referenceService.atcCodes.create(payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['atc-codes'] }),
  });

  const createProductUnit = useMutation({
    mutationFn: async (payload: { unitCode: string; unitLabel: string }) => (await referenceService.productUnits.create(payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-units'] }),
  });

  const rows = articles.data?.items ?? [];
  const categoryById = useMemo(() => new Map((categories.data ?? []).map((item) => [item.categoryId, item.categoryName])), [categories.data]);
  const subCategoryById = useMemo(() => new Map((subCategories.data ?? []).map((item) => [item.subCategoryId, item.subCategoryName])), [subCategories.data]);
  const formById = useMemo(() => new Map((forms.data ?? []).map((item) => [item.formId, item.formName])), [forms.data]);
  const routeById = useMemo(() => new Map((routes.data ?? []).map((item) => [item.routeId, item.routeName])), [routes.data]);
  const typeById = useMemo(() => new Map((productTypes.data ?? []).map((item) => [item.productTypeId, item.typeName])), [productTypes.data]);
  const unitById = useMemo(() => new Map((productUnits.data ?? []).map((item) => [item.productUnitId, item.unitLabel])), [productUnits.data]);
  const summary = summarizeActive(rows);
  const visibleUnitItems = useMemo(
    () =>
      (productUnits.data ?? []).filter(
        (item) => item.isActive || item.productUnitId === salesUnitId || item.productUnitId === packagingUnitId,
      ),
    [packagingUnitId, productUnits.data, salesUnitId],
  );
  const exportRows = useMemo(
    () => [
      [
        'Code article',
        'Nom',
        'DCI',
        'Dosage',
        'Unite vente',
        'Unite conditionnement',
        'Quantite par conditionnement',
        'Forme',
        'Voie',
        'Type produit',
        'Categorie',
        'Sous-categorie',
        'ATC',
        'Code-barres',
        'Stock min',
        'Stock max',
        'Statut',
      ],
      ...rows.map((article) => [
        article.articleCode,
        article.commercialName,
        article.dci ?? '-',
        article.dosage ?? '-',
        unitById.get(article.salesUnitId ?? '') ?? '-',
        unitById.get(article.packagingUnitId ?? '') ?? article.packaging ?? '-',
        article.unitsPerPackage ?? '-',
        formById.get(article.formId ?? '') ?? '-',
        routeById.get(article.routeId ?? '') ?? '-',
        typeById.get(article.productTypeId ?? '') ?? '-',
        categoryById.get(article.categoryId ?? '') ?? '-',
        subCategoryById.get(article.subCategoryId ?? '') ?? '-',
        article.atcCode ?? '-',
        article.barcode ?? '-',
        article.defaultStockMin,
        article.defaultStockMax ?? '-',
        article.isActive ? 'Actif' : 'Inactif',
      ]),
    ],
    [categoryById, formById, routeById, rows, subCategoryById, typeById, unitById],
  );

  const filteredDciOptions = useMemo(
    () => buildSearchOptions(activeIngredients.data ?? [], dciSearch, can('active_ingredients.create'), (item) => item.canonicalName),
    [activeIngredients.data, can, dciSearch],
  );
  const filteredDosageOptions = useMemo(
    () => buildSearchOptions(dosages.data ?? [], dosageSearch, can('dosages.create'), (item) => item.dosageLabel),
    [can, dosageSearch, dosages.data],
  );
  const filteredAtcOptions = useMemo(
    () => buildAtcOptions(atcCodes.data ?? [], atcSearch, can('atc_codes.create')),
    [atcCodes.data, atcSearch, can],
  );
  const filteredSalesUnitOptions = useMemo(
    () => buildSearchOptions(visibleUnitItems, salesUnitSearch, can('product_units.create'), (item) => item.unitLabel),
    [can, salesUnitSearch, visibleUnitItems],
  );
  const filteredPackagingUnitOptions = useMemo(
    () => buildSearchOptions(visibleUnitItems, packagingUnitSearch, can('product_units.create'), (item) => item.unitLabel),
    [can, packagingUnitSearch, visibleUnitItems],
  );
  const initialSalesUnitLabel = useMemo(
    () => (editingArticleSnapshot ? unitById.get(editingArticleSnapshot.salesUnitId ?? '') ?? '' : ''),
    [editingArticleSnapshot, unitById],
  );
  const initialPackagingUnitLabel = useMemo(
    () =>
      editingArticleSnapshot
        ? unitById.get(editingArticleSnapshot.packagingUnitId ?? '') ?? editingArticleSnapshot.packaging ?? ''
        : '',
    [editingArticleSnapshot, unitById],
  );
  const unitValidationError = useMemo(() => {
    if (salesUnitSearch.trim() && !salesUnitId && normalizeSearch(salesUnitSearch) !== normalizeSearch(initialSalesUnitLabel)) {
      return "Selectionnez une unite de vente existante ou creez-la depuis la liste.";
    }
    if (
      packagingUnitSearch.trim() &&
      !packagingUnitId &&
      normalizeSearch(packagingUnitSearch) !== normalizeSearch(initialPackagingUnitLabel)
    ) {
      return "Selectionnez une unite de conditionnement existante ou creez-la depuis la liste.";
    }
    if (unitsPerPackage && Number(unitsPerPackage) <= 0) {
      return 'La quantite par conditionnement doit etre strictement positive.';
    }
    return '';
  }, [initialPackagingUnitLabel, initialSalesUnitLabel, packagingUnitId, packagingUnitSearch, salesUnitId, salesUnitSearch, unitsPerPackage]);
  const unitChangeWarning = useMemo(() => {
    if (!editingArticleSnapshot || editingArticleSnapshot.stockAvailable <= 0) return '';
    const salesChanged = normalizeSearch(salesUnitSearch) !== normalizeSearch(initialSalesUnitLabel);
    const packagingChanged = normalizeSearch(packagingUnitSearch) !== normalizeSearch(initialPackagingUnitLabel);
    if (!salesChanged && !packagingChanged) return '';
    return "La modification de l'unite ne convertit pas automatiquement le stock existant. Verifiez la coherence des lots et du stock avant de continuer.";
  }, [editingArticleSnapshot, initialPackagingUnitLabel, initialSalesUnitLabel, packagingUnitSearch, salesUnitSearch]);

  function openCreate() {
    resetForm();
    setArticleCode(nextCode.data ?? '');
    setModalOpen(true);
  }

  function openEdit(article: Article) {
    setEditingArticleSnapshot(article);
    setEditingArticleId(article.articleId);
    setArticleCode(article.articleCode);
    setCommercialName(article.commercialName);
    setDciId(article.dciId ?? '');
    setDciSearch(article.dci ?? '');
    setDosageId(article.dosageId ?? '');
    setDosageSearch(article.dosage ?? '');
    setCategoryId(article.categoryId ?? '');
    setSubCategoryId(article.subCategoryId ?? '');
    setFormId(article.formId ?? '');
    setRouteId(article.routeId ?? '');
    setProductTypeId(article.productTypeId ?? '');
    setAtcId(article.atcId ?? '');
    setAtcSearch(article.atcCode ?? '');
    setSalesUnitId(article.salesUnitId ?? '');
    setSalesUnitSearch(unitById.get(article.salesUnitId ?? '') ?? '');
    setPackagingUnitId(article.packagingUnitId ?? '');
    setPackagingUnitSearch(unitById.get(article.packagingUnitId ?? '') ?? article.packaging ?? '');
    setUnitsPerPackage(article.unitsPerPackage === null ? '' : String(article.unitsPerPackage));
    setBarcode(article.barcode ?? '');
    setDefaultStockMin(String(article.defaultStockMin ?? 0));
    setDefaultStockMax(article.defaultStockMax === null ? '' : String(article.defaultStockMax));
    setIsActive(article.isActive);
    setFormError('');
    setDetailArticle(null);
    setModalOpen(true);
  }

  function resetForm() {
    setEditingArticleSnapshot(null);
    setEditingArticleId(null);
    setArticleCode('');
    setCommercialName('');
    setDciId('');
    setDciSearch('');
    setDciOpen(false);
    setDosageId('');
    setDosageSearch('');
    setDosageOpen(false);
    setCategoryId('');
    setSubCategoryId('');
    setFormId('');
    setRouteId('');
    setProductTypeId('');
    setAtcId('');
    setAtcSearch('');
    setAtcOpen(false);
    setSalesUnitId('');
    setSalesUnitSearch('');
    setSalesUnitOpen(false);
    setPackagingUnitId('');
    setPackagingUnitSearch('');
    setPackagingUnitOpen(false);
    setUnitsPerPackage('');
    setBarcode('');
    setDefaultStockMin('0');
    setDefaultStockMax('');
    setIsActive(true);
    setFormError('');
  }

  useEffect(() => {
    if (modalOpen && !editingArticleId && !articleCode && nextCode.data) setArticleCode(nextCode.data);
  }, [articleCode, editingArticleId, modalOpen, nextCode.data]);

  useEffect(() => {
    if (!editingArticleSnapshot || !modalOpen) return;
    if (editingArticleSnapshot.salesUnitId && !salesUnitSearch) {
      setSalesUnitSearch(unitById.get(editingArticleSnapshot.salesUnitId) ?? '');
    }
    if (!packagingUnitSearch) {
      setPackagingUnitSearch(
        unitById.get(editingArticleSnapshot.packagingUnitId ?? '') ?? editingArticleSnapshot.packaging ?? '',
      );
    }
  }, [editingArticleSnapshot, modalOpen, packagingUnitSearch, salesUnitSearch, unitById]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');
    if (unitValidationError) {
      setFormError(unitValidationError);
      return;
    }
    saveArticle.mutate({
      articleCode,
      commercialName,
      dciId: dciId || undefined,
      dci: dciSearch || undefined,
      dosageId: dosageId || undefined,
      dosage: dosageSearch || undefined,
      categoryId: categoryId || undefined,
      subCategoryId: subCategoryId || undefined,
      formId: formId || undefined,
      routeId: routeId || undefined,
      productTypeId: productTypeId || undefined,
      atcId: atcId || undefined,
      atcCode: atcSearch || undefined,
      salesUnitId: salesUnitId || undefined,
      packagingUnitId: packagingUnitId || undefined,
      unitsPerPackage: unitsPerPackage ? Number(unitsPerPackage) : undefined,
      barcode: barcode || undefined,
      prescriptionRequired: false,
      defaultStockMin: Number(defaultStockMin || 0),
      defaultStockMax: defaultStockMax ? Number(defaultStockMax) : undefined,
      isActive,
    });
  }

  async function selectDci(option: SearchOption<ActiveIngredientItem>) {
    if (option.kind === 'create') {
      const created = await createIngredient.mutateAsync({ canonicalName: option.label });
      setDciId(created.activeIngredientId);
      setDciSearch(created.canonicalName);
      return;
    }
    setDciId(option.item.activeIngredientId);
    setDciSearch(option.item.canonicalName);
  }

  async function selectDosage(option: SearchOption<DosageItem>) {
    if (option.kind === 'create') {
      const created = await createDosage.mutateAsync({ dosageLabel: option.label });
      setDosageId(created.dosageId);
      setDosageSearch(created.dosageLabel);
      return;
    }
    setDosageId(option.item.dosageId);
    setDosageSearch(option.item.dosageLabel);
  }

  async function selectAtc(option: SearchOption<AtcCodeItem>) {
    if (option.kind === 'create') {
      const created = await createAtc.mutateAsync({ atcCode: option.label.toUpperCase(), atcLabel: option.label });
      setAtcId(created.atcId);
      setAtcSearch(created.atcCode);
      return;
    }
    setAtcId(option.item.atcId);
    setAtcSearch(option.item.atcCode);
  }

  async function selectUnit(
    option: SearchOption<ProductUnitItem>,
    onSelectExisting: (unit: ProductUnitItem) => void,
  ) {
    if (option.kind === 'create') {
      const created = await createProductUnit.mutateAsync({
        unitCode: buildUnitCode(option.label),
        unitLabel: option.label.trim(),
      });
      onSelectExisting(created);
      return;
    }
    onSelectExisting(option.item);
  }

  async function selectSalesUnit(option: SearchOption<ProductUnitItem>) {
    await selectUnit(option, (unit) => {
      setSalesUnitId(unit.productUnitId);
      setSalesUnitSearch(unit.unitLabel);
    });
  }

  async function selectPackagingUnit(option: SearchOption<ProductUnitItem>) {
    await selectUnit(option, (unit) => {
      setPackagingUnitId(unit.productUnitId);
      setPackagingUnitSearch(unit.unitLabel);
    });
  }

  const isSavingReference = createIngredient.isPending || createDosage.isPending || createAtc.isPending || createProductUnit.isPending;

  return (
    <>
      <ReferenceHeader title="Articles">
        <div className="reference-actions">
          <ReferenceExportActions baseName="articles" sheetName="Articles" rows={exportRows} jsonData={rows} disabled={rows.length === 0} />
          {can('articles.create') && <button className="button compact-button" onClick={openCreate}>Nouvel article</button>}
        </div>
      </ReferenceHeader>
      <ReferenceSummary total={articles.data?.total ?? rows.length} filtered={rows.length} active={summary.active} inactive={summary.inactive} />
      {(saveArticle.isError || createIngredient.isError || createDosage.isError || createAtc.isError || createProductUnit.isError) && <p className="form-error">Impossible d'enregistrer les informations pharmaceutiques de l'article.</p>}
      <Modal title={editingArticleId ? 'Modifier article' : 'Nouvel article'} open={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }}>
        <form className="form-grid reference-form" onSubmit={submit}>
          {formError && <p className="form-error">{formError}</p>}
          {unitChangeWarning && <p className="form-warning">{unitChangeWarning}</p>}
          <label><span>Code</span><input className="input compact-input" placeholder={nextCode.data ?? 'Code article'} value={articleCode || nextCode.data || ''} onChange={(e) => setArticleCode(e.target.value)} required /></label>
          <label><span>Nom</span><input className="input compact-input" placeholder="Nom commercial" value={commercialName} onChange={(e) => setCommercialName(e.target.value)} required /></label>
          <label><span>Categorie</span><select className="input compact-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Categorie</option>{(categories.data ?? []).map((item) => <option key={item.categoryId} value={item.categoryId}>{item.categoryName}</option>)}</select></label>
          <label><span>Sous-categorie</span><select className="input compact-input" value={subCategoryId} onChange={(e) => setSubCategoryId(e.target.value)}><option value="">Sous-categorie</option>{(subCategories.data ?? []).filter((item) => !categoryId || item.categoryId === categoryId).map((item) => <option key={item.subCategoryId} value={item.subCategoryId}>{item.subCategoryName}</option>)}</select></label>
          <label><span>Forme</span><select className="input compact-input" value={formId} onChange={(e) => setFormId(e.target.value)}><option value="">Forme</option>{(forms.data ?? []).map((item) => <option key={item.formId} value={item.formId}>{item.formName}</option>)}</select></label>
          <label><span>Voie</span><select className="input compact-input" value={routeId} onChange={(e) => setRouteId(e.target.value)}><option value="">Voie</option>{(routes.data ?? []).map((item) => <option key={item.routeId} value={item.routeId}>{item.routeName}</option>)}</select></label>
          <label><span>Type</span><select className="input compact-input" value={productTypeId} onChange={(e) => setProductTypeId(e.target.value)}><option value="">Type produit</option>{(productTypes.data ?? []).map((item) => <option key={item.productTypeId} value={item.productTypeId}>{item.typeName}</option>)}</select></label>
          <label><span>Code-barres</span><input className="input compact-input" placeholder="Code-barres" value={barcode} onChange={(e) => setBarcode(e.target.value)} /></label>
          <div className="reference-section-title">Informations pharmaceutiques et conditionnement</div>
          <label><span>DCI</span>
            <FloatingSearchPopover
              columns={[
                { header: 'DCI', render: (option: SearchOption<ActiveIngredientItem>) => option.kind === 'create' ? `Creer "${option.label}"` : option.item.canonicalName },
              ]}
              getKey={(option) => option.kind === 'create' ? `create-${option.label}` : option.item.activeIngredientId}
              onChange={(value) => { setDciSearch(value); setDciId(''); }}
              onClose={() => setDciOpen(false)}
              onOpen={() => setDciOpen(true)}
              onSelect={selectDci}
              open={dciOpen}
              placeholder="Rechercher une DCI"
              searchPlaceholder="Rechercher une DCI"
              suggestions={filteredDciOptions}
              value={dciSearch}
            />
          </label>
          <label><span>Dosage</span>
            <FloatingSearchPopover
              columns={[
                { header: 'Dosage', render: (option: SearchOption<DosageItem>) => option.kind === 'create' ? `Creer "${option.label}"` : option.item.dosageLabel },
              ]}
              getKey={(option) => option.kind === 'create' ? `create-${option.label}` : option.item.dosageId}
              onChange={(value) => { setDosageSearch(value); setDosageId(''); }}
              onClose={() => setDosageOpen(false)}
              onOpen={() => setDosageOpen(true)}
              onSelect={selectDosage}
              open={dosageOpen}
              placeholder="Rechercher un dosage"
              searchPlaceholder="Rechercher un dosage"
              suggestions={filteredDosageOptions}
              value={dosageSearch}
            />
          </label>
          <label><span>Code ATC</span>
            <FloatingSearchPopover
              columns={[
                { header: 'Code', render: (option: SearchOption<AtcCodeItem>) => option.kind === 'create' ? 'Nouveau' : option.item.atcCode },
                { header: 'Libelle', render: (option: SearchOption<AtcCodeItem>) => option.kind === 'create' ? `Creer "${option.label}"` : option.item.atcLabel },
              ]}
              getKey={(option) => option.kind === 'create' ? `create-${option.label}` : option.item.atcId}
              onChange={(value) => { setAtcSearch(value); setAtcId(''); }}
              onClose={() => setAtcOpen(false)}
              onOpen={() => setAtcOpen(true)}
              onSelect={selectAtc}
              open={atcOpen}
              placeholder="Rechercher un code ATC"
              searchPlaceholder="Rechercher un code ou libelle ATC"
              suggestions={filteredAtcOptions}
              value={atcSearch}
            />
          </label>
          <label><span>Unite vente</span>
            <FloatingSearchPopover
              columns={[
                { header: 'Code', render: (option: SearchOption<ProductUnitItem>) => option.kind === 'create' ? 'Nouveau' : option.item.unitCode },
                { header: 'Libelle', render: (option: SearchOption<ProductUnitItem>) => option.kind === 'create' ? `Creer "${option.label}"` : option.item.unitLabel },
              ]}
              emptyText="Aucune unite produit."
              getKey={(option) => option.kind === 'create' ? `create-${option.label}` : option.item.productUnitId}
              onChange={(value) => { setSalesUnitSearch(value); setSalesUnitId(''); setFormError(''); }}
              onClose={() => setSalesUnitOpen(false)}
              onOpen={() => setSalesUnitOpen(true)}
              onSelect={selectSalesUnit}
              open={salesUnitOpen}
              placeholder="Rechercher une unite de vente"
              searchPlaceholder="Rechercher une unite de vente"
              suggestions={filteredSalesUnitOptions}
              value={salesUnitSearch}
            />
          </label>
          <label><span>Unite conditionnement</span>
            <FloatingSearchPopover
              columns={[
                { header: 'Code', render: (option: SearchOption<ProductUnitItem>) => option.kind === 'create' ? 'Nouveau' : option.item.unitCode },
                { header: 'Libelle', render: (option: SearchOption<ProductUnitItem>) => option.kind === 'create' ? `Creer "${option.label}"` : option.item.unitLabel },
              ]}
              emptyText="Aucune unite produit."
              getKey={(option) => option.kind === 'create' ? `create-${option.label}` : option.item.productUnitId}
              onChange={(value) => { setPackagingUnitSearch(value); setPackagingUnitId(''); setFormError(''); }}
              onClose={() => setPackagingUnitOpen(false)}
              onOpen={() => setPackagingUnitOpen(true)}
              onSelect={selectPackagingUnit}
              open={packagingUnitOpen}
              placeholder="Rechercher une unite de conditionnement"
              searchPlaceholder="Rechercher une unite de conditionnement"
              suggestions={filteredPackagingUnitOptions}
              value={packagingUnitSearch}
            />
          </label>
          <label><span>Qte / conditionnement</span><input className="input compact-input" placeholder="10" type="number" min="0.0001" step="0.0001" value={unitsPerPackage} onChange={(e) => setUnitsPerPackage(e.target.value)} /><small className="field-help">Nombre d'unites de vente contenues dans une unite de conditionnement.</small></label>
          <label><span>Stock min</span><input className="input compact-input" placeholder="Min" type="number" value={defaultStockMin} onChange={(e) => setDefaultStockMin(e.target.value)} /></label>
          <label><span>Stock max</span><input className="input compact-input" placeholder="Max" type="number" value={defaultStockMax} onChange={(e) => setDefaultStockMax(e.target.value)} /></label>
          <label className="reference-toggle"><span>Actif</span><input checked={isActive} type="checkbox" onChange={(e) => setIsActive(e.target.checked)} /></label>
          <div className="modal-actions">
            <button className="ghost-button compact-button" type="button" onClick={() => { setModalOpen(false); resetForm(); }}>Annuler</button>
            <button className="button compact-button" disabled={saveArticle.isPending || isSavingReference}>{saveArticle.isPending ? 'Enregistrement...' : editingArticleId ? 'Mettre a jour' : 'Enregistrer'}</button>
          </div>
        </form>
      </Modal>
      <div className="card reference-filters">
        <input className="input compact-input" placeholder="Scanner un code-barres ou taper un nom/code/DCI." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="card table-card">
        {articles.isLoading ? <p className="loading-state">Chargement des articles...</p> : rows.length === 0 ? <p className="empty-state">Aucun article trouve. Creez un article ou importez le catalogue.</p> : (
          <div className="table-wrap reference-table-wrap articles-table-wrap">
            <table className="data-table reference-table articles-table">
              <thead><tr><th>Code</th><th>Nom</th><th>DCI</th><th>Dosage</th><th>Unite vente</th><th>Categorie</th><th>Forme</th><th>Barcode</th><th>Stock min</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>{rows.map((article) => (
                <tr key={article.articleId}>
                  <td><strong>{article.articleCode}</strong></td>
                  <td>{article.commercialName}</td>
                  <td>{article.dci || '-'}</td>
                  <td>{article.dosage || '-'}</td>
                  <td>{unitById.get(article.salesUnitId ?? '') ?? '-'}</td>
                  <td>{categoryById.get(article.categoryId ?? '') ?? '-'}</td>
                  <td>{formById.get(article.formId ?? '') ?? '-'}</td>
                  <td>{article.barcode || '-'}</td>
                  <td className="quantity-cell">{article.defaultStockMin}</td>
                  <td><ActiveBadge active={article.isActive} /></td>
                  <td>
                    <div className="article-action-group">
                      <button className="ghost-button compact-button article-view-button" onClick={() => setDetailArticle(article)}>Voir</button>
                      {can('articles.update') && <button className="ghost-button compact-button article-edit-button" onClick={() => openEdit(article)}>Modifier</button>}
                    </div>
                  </td>
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
          salesUnitName={unitById.get(detailArticle.salesUnitId ?? '') ?? '-'}
          packagingUnitName={unitById.get(detailArticle.packagingUnitId ?? '') ?? detailArticle.packaging ?? '-'}
          stocks={stocks.data ?? []}
          subCategoryName={subCategoryById.get(detailArticle.subCategoryId ?? '') ?? '-'}
          typeName={typeById.get(detailArticle.productTypeId ?? '') ?? '-'}
          canEdit={can('articles.update')}
          onClose={() => setDetailArticle(null)}
          onEdit={() => openEdit(detailArticle)}
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
  onEdit,
  routeName,
  salesUnitName,
  packagingUnitName,
  stocks,
  subCategoryName,
  typeName,
  canEdit,
}: {
  article: Article;
  categoryName: string;
  formName: string;
  lots: Awaited<ReturnType<typeof lotsService.getAll>>['data'];
  onClose: () => void;
  onEdit: () => void;
  routeName: string;
  salesUnitName: string;
  packagingUnitName: string;
  stocks: Awaited<ReturnType<typeof stocksService.getAll>>['data'];
  subCategoryName: string;
  typeName: string;
  canEdit: boolean;
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
          <div className="reference-actions">
            {canEdit && <button className="ghost-button compact-button" type="button" onClick={onEdit}>Modifier</button>}
            <button className="ghost-button compact-button" type="button" onClick={onClose}>Fermer</button>
          </div>
        </div>
        <div className="detail-grid">
          <div><span>Code article</span><strong>{article.articleCode}</strong></div>
          <div><span>Code-barres</span><strong>{article.barcode ?? '-'}</strong></div>
          <div><span>DCI</span><strong>{article.dci ?? '-'}</strong></div>
          <div><span>Dosage</span><strong>{article.dosage ?? '-'}</strong></div>
          <div><span>ATC</span><strong>{article.atcCode ?? '-'}</strong></div>
          <div><span>Statut</span><strong><ActiveBadge active={article.isActive} /></strong></div>
          <div><span>Categorie</span><strong>{categoryName}</strong></div>
          <div><span>Sous-categorie</span><strong>{subCategoryName}</strong></div>
          <div><span>Forme</span><strong>{formName}</strong></div>
          <div><span>Voie</span><strong>{routeName}</strong></div>
          <div><span>Type produit</span><strong>{typeName}</strong></div>
          <div><span>Unite vente</span><strong>{salesUnitName}</strong></div>
          <div><span>Unite conditionnement</span><strong>{packagingUnitName}</strong></div>
          <div><span>Qte / conditionnement</span><strong>{article.unitsPerPackage ?? '-'}</strong></div>
          <div><span>Stock min</span><strong>{article.defaultStockMin}</strong></div>
          <div><span>Stock max</span><strong>{article.defaultStockMax ?? '-'}</strong></div>
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
        <div className="stock-detail-actions">
          <Link className="ghost-button compact-button" to={`/stocks/movements?articleId=${article.articleId}`}>Voir les mouvements de cet article</Link>
        </div>
      </div>
    </div>
  );
}

function buildSearchOptions<T>(
  items: T[],
  search: string,
  canCreate: boolean,
  getLabel: (item: T) => string,
): SearchOption<T>[] {
  const normalizedSearch = normalizeSearch(search);
  const filtered: SearchOption<T>[] = items
    .filter((item) => !normalizedSearch || normalizeSearch(getLabel(item)).includes(normalizedSearch))
    .map((item) => ({ kind: 'existing' as const, item }));

  const exactMatch = filtered.some((option) => option.kind === 'existing' && normalizeSearch(getLabel(option.item)) === normalizedSearch);
  if (normalizedSearch && canCreate && !exactMatch) {
    filtered.unshift({ kind: 'create' as const, label: search.trim() });
  }
  return filtered;
}

function buildAtcOptions(
  items: AtcCodeItem[],
  search: string,
  canCreate: boolean,
): SearchOption<AtcCodeItem>[] {
  const normalizedSearch = normalizeSearch(search);
  const filtered: SearchOption<AtcCodeItem>[] = items
    .filter((item) => !normalizedSearch || normalizeSearch(`${item.atcCode} ${item.atcLabel}`).includes(normalizedSearch))
    .map((item) => ({ kind: 'existing' as const, item }));

  const exactMatch = filtered.some((option) => option.kind === 'existing' && (normalizeSearch(option.item.atcCode) === normalizedSearch || normalizeSearch(option.item.atcLabel) === normalizedSearch));
  if (normalizedSearch && canCreate && !exactMatch) {
    filtered.unshift({ kind: 'create' as const, label: search.trim() });
  }
  return filtered;
}

function buildUnitCode(label: string) {
  const normalized = normalizeSearch(label)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return (normalized || 'UNIT').slice(0, 40);
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
