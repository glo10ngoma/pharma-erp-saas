import { FormEvent, ReactNode, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { articlesService } from '../../services/articles.service';
import { apiErrorMessage } from '../../services/apiError';
import { insuranceService } from '../../services/insurance.service';
import { referenceService } from '../../services/reference.service';
import { salesService } from '../../services/sales.service';
import { sitesService } from '../../services/sites.service';
import { formatMoney } from '../../utils/money';

function Field({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  return (
    <label className="field-block">
      <span>{label}</span>
      {children}
      <small>{help}</small>
    </label>
  );
}

export function PosPage() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [siteId, setSiteId] = useState('');
  const [saleType, setSaleType] = useState('CASH');
  const [customerId, setCustomerId] = useState('');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [membershipId, setMembershipId] = useState('');
  const [articleId, setArticleId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [amountPaid, setAmountPaid] = useState('');
  const [saleId, setSaleId] = useState('');
  const [sale, setSale] = useState<any>(null);
  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const articles = useQuery({ queryKey: ['articles'], queryFn: async () => (await articlesService.getAll()).data.items });
  const customers = useQuery({ queryKey: ['customers'], queryFn: async () => (await referenceService.customers.getAll()).data });
  const memberships = useQuery({ queryKey: ['customer-memberships', customerId], queryFn: async () => (await insuranceService.memberships.getByCustomer(customerId)).data, enabled: Boolean(customerId) });
  const createDraft = useMutation({
    mutationFn: () => salesService.create({ siteId, saleType, customerId: customerId || undefined, exchangeRate: Number(exchangeRate || 1) }),
    onSuccess: (r) => {
      setSaleId(r.data.saleId);
      setSale(r.data);
      setCreateOpen(false);
    },
  });
  const addItem = useMutation({ mutationFn: () => salesService.addItemFefo(saleId, { articleId, quantity: Number(quantity) }), onSuccess: (r) => { setSale(r.data); setAmountPaid(String(r.data.totalAmount)); } });
  const applyInsurance = useMutation({ mutationFn: () => salesService.applyInsurance(saleId, { membershipId }), onSuccess: (r) => { setSale(r.data); setAmountPaid(String(r.data.customerPayableAmount)); } });
  const validate = useMutation({ mutationFn: () => salesService.validate(saleId, { amountPaid: Number(amountPaid) }), onSuccess: (r) => navigate(`/sales/${r.data.saleId}`) });
  function start(e: FormEvent<HTMLFormElement>) { e.preventDefault(); createDraft.mutate(); }
  const saleItems = sale?.items ?? [];
  const error = createDraft.error || addItem.error || applyInsurance.error || validate.error;
  return <>
    <div className="toolbar">
      <div>
        <h1>POS</h1>
        <p className="muted">Vente comptoir avec sortie de stock FEFO, paiement et assurance.</p>
      </div>
      {!saleId && <button className="button" type="button" onClick={() => setCreateOpen(true)}>+ Nouvelle Vente</button>}
    </div>
    {error && <p className="form-error">{apiErrorMessage(error)}</p>}
    {!saleId ? (
      <div className="card">
        <p className="empty-state">Aucune vente en cours. Creez une vente pour ajouter les produits en FEFO.</p>
      </div>
    ) : <>
      <div className="card form-grid">
        <select className="input" value={articleId} onChange={(e)=>setArticleId(e.target.value)}><option value="">Article</option>{(articles.data??[]).map(a=><option key={a.articleId} value={a.articleId}>{a.commercialName}</option>)}</select>
        <input className="input" type="number" min="0.001" step="0.001" value={quantity} onChange={(e)=>setQuantity(e.target.value)}/>
        <button className="button" onClick={()=>addItem.mutate()} disabled={addItem.isPending || !articleId || sale?.status!=='DRAFT'}>{addItem.isPending ? 'Ajout...' : 'Ajouter FEFO'}</button>
        {sale?.saleType==='INSURANCE' && <>
          <select className="input" value={membershipId} onChange={(e)=>setMembershipId(e.target.value)}><option value="">Membership</option>{(memberships.data??[]).filter(m=>m.isActive).map(m=><option key={m.membershipId} value={m.membershipId}>{m.organizationName} - {m.planName} ({m.coveragePercent}%)</option>)}</select>
          <button className="button" onClick={()=>applyInsurance.mutate()} disabled={!membershipId || saleItems.length===0 || applyInsurance.isPending}>{applyInsurance.isPending ? 'Application...' : 'Appliquer assurance'}</button>
        </>}
      </div>
      <div className="card">{saleItems.length===0 ? <p className="empty-state">Aucune ligne vente. Selectionnez un article pour appliquer FEFO.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Produit</th><th>Lot</th><th>Expiration</th><th>Qte</th><th>Prix</th><th>Total</th></tr></thead><tbody>{saleItems.map((i:any)=><tr key={i.saleItemId}><td>{i.commercialName}</td><td>{i.lotNumber}</td><td>{i.expiryDate}</td><td>{i.quantity}</td><td>{formatMoney(i.unitPrice, sale?.currencyCode ?? 'USD', sale?.currencySymbol)}</td><td>{formatMoney(i.lineTotal, sale?.currencyCode ?? 'USD', sale?.currencySymbol)}</td></tr>)}</tbody></table></div>}</div>
      <div className="stats-grid"><div className="card kpi-card"><span className="kpi-label">Total</span><p className="metric">{formatMoney(sale?.totalAmount ?? 0, sale?.currencyCode ?? 'USD', sale?.currencySymbol)}</p></div><div className="card kpi-card"><span className="kpi-label">Part patient</span><p className="metric">{formatMoney(sale?.customerPayableAmount ?? sale?.totalAmount ?? 0, sale?.currencyCode ?? 'USD', sale?.currencySymbol)}</p></div><div className="card kpi-card"><span className="kpi-label">Part assurance</span><p className="metric">{formatMoney(sale?.insuranceCoveredAmount ?? 0, sale?.currencyCode ?? 'USD', sale?.currencySymbol)}</p></div><div className="card kpi-card"><span className="kpi-label">Statut</span><span className={`badge ${sale?.status === 'VALIDATED' ? 'badge-success' : 'badge-warning'}`}>{sale?.status}</span></div></div>
      <div className="card form-grid"><input className="input" type="number" value={amountPaid} onChange={(e)=>setAmountPaid(e.target.value)} placeholder="Paiement patient"/><button className="button" onClick={()=>validate.mutate()} disabled={validate.isPending || saleItems.length===0 || sale?.status!=='DRAFT'}>{validate.isPending ? 'Validation...' : 'Valider vente'}</button></div>
    </>}

    <Modal title="Nouvelle vente POS" open={createOpen} onClose={() => !createDraft.isPending && setCreateOpen(false)}>
      {createDraft.isError && <p className="form-error">{apiErrorMessage(createDraft.error)}</p>}
      <form className="purchase-form" onSubmit={start}>
        <div className="form-section">
          <h3>Parametres vente</h3>
          <div className="form-grid">
            <Field label="Client" help="Client qui achete les produits. Obligatoire pour une vente assurance.">
              <select className="input" value={customerId} onChange={(e)=>setCustomerId(e.target.value)} required={saleType==='INSURANCE'}><option value="">Client comptoir</option>{(customers.data??[]).map(c=><option key={c.customerId} value={c.customerId}>{c.customerName}</option>)}</select>
            </Field>
            <Field label="Type vente" help="CASH = paiement immediat, INSURANCE = prise en charge assurance.">
              <select className="input" value={saleType} onChange={(e)=>setSaleType(e.target.value)}><option value="CASH">CASH</option><option value="INSURANCE">INSURANCE</option></select>
            </Field>
            <Field label="Site" help="Site qui effectue la vente. Le stock sortira de ce site.">
              <select className="input" value={siteId} onChange={(e)=>setSiteId(e.target.value)} required><option value="">Site</option>{(sites.data??[]).map(s=><option key={s.siteId} value={s.siteId}>{s.siteName}</option>)}</select>
            </Field>
            <Field label="Devise" help="Devise utilisee pour cette transaction. USD est la devise de base V1.1.">
              <select className="input" value="USD" disabled><option value="USD">USD - Dollar americain</option></select>
            </Field>
            <Field label="Taux de change" help="Obligatoire si la devise n'est pas USD. Pour USD, laissez 1.">
              <input className="input" type="number" min="1" step="0.0001" placeholder="1" value={exchangeRate} onChange={(e)=>setExchangeRate(e.target.value)} required/>
            </Field>
          </div>
        </div>
        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={() => setCreateOpen(false)} disabled={createDraft.isPending}>Annuler</button>
          <button className="button" disabled={createDraft.isPending}>{createDraft.isPending ? 'Ouverture...' : 'Creer vente'}</button>
        </div>
      </form>
    </Modal>
  </>;
}
