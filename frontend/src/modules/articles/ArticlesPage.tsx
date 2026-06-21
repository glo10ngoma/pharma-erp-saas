import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { articlesService } from '../../services/articles.service';
import { referenceService } from '../../services/reference.service';

export function ArticlesPage() {
  const qc = useQueryClient();
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

  const articles = useQuery({ queryKey: ['articles', search], queryFn: async () => (await articlesService.getAll({ search: search || undefined })).data });
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await referenceService.categories.getAll()).data });
  const subCategories = useQuery({ queryKey: ['sub-categories'], queryFn: async () => (await referenceService.subCategories.getAll()).data });
  const forms = useQuery({ queryKey: ['galenic-forms'], queryFn: async () => (await referenceService.galenicForms.getAll()).data });
  const routes = useQuery({ queryKey: ['administration-routes'], queryFn: async () => (await referenceService.administrationRoutes.getAll()).data });
  const productTypes = useQuery({ queryKey: ['product-types'], queryFn: async () => (await referenceService.productTypes.getAll()).data });
  const create = useMutation({ mutationFn: articlesService.create, onSuccess: () => { setArticleCode(''); setCommercialName(''); setDci(''); setDosage(''); setAtcCode(''); setBarcode(''); qc.invalidateQueries({ queryKey: ['articles'] }); } });

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
      <h1>Articles</h1>
      <form className="card form-grid" onSubmit={submit}>
        <input className="input" placeholder="Code article" value={articleCode} onChange={(e)=>setArticleCode(e.target.value)} required />
        <input className="input" placeholder="Nom commercial" value={commercialName} onChange={(e)=>setCommercialName(e.target.value)} required />
        <input className="input" placeholder="DCI" value={dci} onChange={(e)=>setDci(e.target.value)} />
        <input className="input" placeholder="Dosage" value={dosage} onChange={(e)=>setDosage(e.target.value)} />
        <select className="input" value={categoryId} onChange={(e)=>setCategoryId(e.target.value)}><option value="">Categorie</option>{(categories.data??[]).map(i=><option key={i.categoryId} value={i.categoryId}>{i.categoryName}</option>)}</select>
        <select className="input" value={subCategoryId} onChange={(e)=>setSubCategoryId(e.target.value)}><option value="">Sous-categorie</option>{(subCategories.data??[]).filter(i=>!categoryId || i.categoryId===categoryId).map(i=><option key={i.subCategoryId} value={i.subCategoryId}>{i.subCategoryName}</option>)}</select>
        <select className="input" value={formId} onChange={(e)=>setFormId(e.target.value)}><option value="">Forme</option>{(forms.data??[]).map(i=><option key={i.formId} value={i.formId}>{i.formName}</option>)}</select>
        <select className="input" value={routeId} onChange={(e)=>setRouteId(e.target.value)}><option value="">Voie</option>{(routes.data??[]).map(i=><option key={i.routeId} value={i.routeId}>{i.routeName}</option>)}</select>
        <select className="input" value={productTypeId} onChange={(e)=>setProductTypeId(e.target.value)}><option value="">Type produit</option>{(productTypes.data??[]).map(i=><option key={i.productTypeId} value={i.productTypeId}>{i.typeName}</option>)}</select>
        <input className="input" placeholder="ATC" value={atcCode} onChange={(e)=>setAtcCode(e.target.value)} />
        <input className="input" placeholder="Code-barres" value={barcode} onChange={(e)=>setBarcode(e.target.value)} />
        <input className="input" placeholder="Stock min" type="number" value={defaultStockMin} onChange={(e)=>setDefaultStockMin(e.target.value)} />
        <input className="input" placeholder="Stock max" type="number" value={defaultStockMax} onChange={(e)=>setDefaultStockMax(e.target.value)} />
        <button className="button" disabled={create.isPending}>Creer</button>
      </form>
      <div className="card">
        <input className="input" placeholder="Recherche article, DCI ou code-barres" value={search} onChange={(e)=>setSearch(e.target.value)} />
      </div>
      <div className="card">
        {articles.isLoading ? 'Chargement...' : (
          <table className="data-table">
            <thead><tr><th>Code</th><th>Nom commercial</th><th>DCI</th><th>Dosage</th><th>Stock min</th><th>Actif</th></tr></thead>
            <tbody>{(articles.data?.items ?? []).map((article) => (
              <tr key={article.articleId}><td>{article.articleCode}</td><td>{article.commercialName}</td><td>{article.dci || '-'}</td><td>{article.dosage || '-'}</td><td>{article.defaultStockMin}</td><td>{article.isActive ? 'Oui' : 'Non'}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
