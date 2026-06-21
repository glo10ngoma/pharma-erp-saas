import { FormEvent, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { articlesService } from '../../services/articles.service';
import { apiErrorMessage } from '../../services/apiError';
import { purchasesService } from '../../services/purchases.service';
import { referenceService } from '../../services/reference.service';
import { sitesService } from '../../services/sites.service';

export function NewPurchasePage() {
  const navigate = useNavigate();
  const [supplierId, setSupplierId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [articleId, setArticleId] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [purchaseUnitPrice, setPurchasePrice] = useState('0');
  const [sellingUnitPrice, setSellingPrice] = useState('0');
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: async () => (await referenceService.suppliers.getAll()).data });
  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const articles = useQuery({ queryKey: ['articles'], queryFn: async () => (await articlesService.getAll()).data.items });
  const create = useMutation({
    mutationFn: async () => {
      const purchase = (await purchasesService.create({ supplierId, siteId, purchaseDate, exchangeRate: 1 })).data;
      await purchasesService.addItem(purchase.purchaseId, { articleId, lotNumber, expiryDate, quantity: Number(quantity), purchaseUnitPrice: Number(purchaseUnitPrice), sellingUnitPrice: Number(sellingUnitPrice) });
      return purchase;
    },
    onSuccess: (purchase) => navigate(`/purchases/${purchase.purchaseId}`),
  });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate(); }
  return <><h1>Nouvel achat</h1>{create.isError && <p className="form-error">{apiErrorMessage(create.error)}</p>}<form className="card form-grid" onSubmit={submit}><select className="input" value={supplierId} onChange={(e)=>setSupplierId(e.target.value)} required><option value="">Fournisseur</option>{(suppliers.data??[]).map(s=><option key={s.supplierId} value={s.supplierId}>{s.supplierName}</option>)}</select><select className="input" value={siteId} onChange={(e)=>setSiteId(e.target.value)} required><option value="">Site</option>{(sites.data??[]).map(s=><option key={s.siteId} value={s.siteId}>{s.siteName}</option>)}</select><input className="input" type="date" value={purchaseDate} onChange={(e)=>setPurchaseDate(e.target.value)} required/><select className="input" value={articleId} onChange={(e)=>setArticleId(e.target.value)} required><option value="">Article</option>{(articles.data??[]).map(a=><option key={a.articleId} value={a.articleId}>{a.commercialName}</option>)}</select><input className="input" placeholder="Lot" value={lotNumber} onChange={(e)=>setLotNumber(e.target.value)} required/><input className="input" type="date" value={expiryDate} onChange={(e)=>setExpiryDate(e.target.value)} required/><input className="input" type="number" min="0.001" step="0.001" value={quantity} onChange={(e)=>setQuantity(e.target.value)} required/><input className="input" type="number" min="0" step="0.01" value={purchaseUnitPrice} onChange={(e)=>setPurchasePrice(e.target.value)} required/><input className="input" type="number" min="0" step="0.01" value={sellingUnitPrice} onChange={(e)=>setSellingPrice(e.target.value)} required/><button className="button" disabled={create.isPending || suppliers.isLoading || sites.isLoading || articles.isLoading}>Creer achat</button></form></>;
}
