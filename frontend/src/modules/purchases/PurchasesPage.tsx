import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { articlesService } from '../../services/articles.service';
import { apiErrorMessage } from '../../services/apiError';
import { codeGeneratorService } from '../../services/codeGenerator.service';
import { purchasesService, Purchase } from '../../services/purchases.service';
import { referenceService } from '../../services/reference.service';
import { sitesService } from '../../services/sites.service';
import { Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { filterRows } from '../../lib/search';
import { formatMoney } from '../../utils/money';

type PurchaseForm = {
  purchaseNumber: string;
  supplierId: string;
  siteId: string;
  purchaseDate: string;
  currencyCode: string;
  exchangeRate: string;
  observation: string;
  articleId: string;
  lotNumber: string;
  expiryDate: string;
  quantity: string;
  purchaseUnitPrice: string;
  sellingUnitPrice: string;
};

const initialForm = (): PurchaseForm => ({
  purchaseNumber: '',
  supplierId: '',
  siteId: '',
  purchaseDate: new Date().toISOString().slice(0, 10),
  currencyCode: 'USD',
  exchangeRate: '1',
  observation: '',
  articleId: '',
  lotNumber: '',
  expiryDate: '',
  quantity: '1',
  purchaseUnitPrice: '0',
  sellingUnitPrice: '0',
});

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help: string;
  children: ReactNode;
}) {
  return (
    <label className="field-block">
      <span>{label}</span>
      {children}
      <small>{help}</small>
    </label>
  );
}

function statusBadge(status: string) {
  if (status === 'VALIDATED') return 'badge-success';
  if (status === 'DRAFT') return 'badge-warning';
  return 'badge-muted';
}

export function PurchasesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [form, setForm] = useState<PurchaseForm>(initialForm);

  const purchases = useQuery({
    queryKey: ['purchases', status],
    queryFn: async () => (await purchasesService.getAll(status)).data,
  });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: async () => (await referenceService.suppliers.getAll()).data });
  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const articles = useQuery({ queryKey: ['articles'], queryFn: async () => (await articlesService.getAll()).data.items });
  const nextCode = useQuery({
    queryKey: ['next-code', 'purchases', createOpen],
    enabled: createOpen,
    queryFn: async () => (await codeGeneratorService.next('purchases')).data.code,
  });
  const detail = useQuery({
    queryKey: ['purchase', selectedPurchaseId],
    enabled: Boolean(selectedPurchaseId),
    queryFn: async () => (await purchasesService.getById(selectedPurchaseId as string)).data,
  });

  useEffect(() => {
    if (createOpen && !form.purchaseNumber && nextCode.data) {
      setForm((current) => ({ ...current, purchaseNumber: nextCode.data ?? '' }));
    }
  }, [createOpen, form.purchaseNumber, nextCode.data]);

  const rows = useMemo(
    () => filterRows(purchases.data ?? [], search, (purchase) => [
      purchase.purchaseNumber,
      purchase.supplierName,
      purchase.status,
      purchase.purchaseDate,
      purchase.siteName,
    ]),
    [purchases.data, search],
  );

  const lineTotal = Number(form.quantity || 0) * Number(form.purchaseUnitPrice || 0);

  const create = useMutation({
    mutationFn: async () => {
      const purchase = (await purchasesService.create({
        purchaseNumber: form.purchaseNumber.trim() || undefined,
        supplierId: form.supplierId,
        siteId: form.siteId,
        purchaseDate: form.purchaseDate,
        exchangeRate: Number(form.exchangeRate || 1),
      })).data;
      await purchasesService.addItem(purchase.purchaseId, {
        articleId: form.articleId,
        lotNumber: form.lotNumber.trim(),
        expiryDate: form.expiryDate,
        quantity: Number(form.quantity),
        purchaseUnitPrice: Number(form.purchaseUnitPrice),
        sellingUnitPrice: Number(form.sellingUnitPrice),
      });
      return purchase;
    },
    onSuccess: async (purchase) => {
      setCreateOpen(false);
      setForm(initialForm());
      setSelectedPurchaseId(purchase.purchaseId);
      await qc.invalidateQueries({ queryKey: ['purchases'] });
      await qc.invalidateQueries({ queryKey: ['purchase', purchase.purchaseId] });
    },
  });

  const validate = useMutation({
    mutationFn: (purchaseId: string) => purchasesService.validate(purchaseId),
    onSuccess: async (_result, purchaseId) => {
      await qc.invalidateQueries({ queryKey: ['purchases'] });
      await qc.invalidateQueries({ queryKey: ['purchase', purchaseId] });
    },
  });

  function update<K extends keyof PurchaseForm>(key: K, value: PurchaseForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function closeCreate() {
    if (!create.isPending) {
      setCreateOpen(false);
      setForm(initialForm());
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate();
  }

  const selectedPurchase = detail.data;
  const detailItems = selectedPurchase?.items ?? [];
  const detailTotal = detailItems.reduce((sum, item) => sum + Number(item.lineTotal ?? 0), 0);

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Achats</h1>
          <p className="muted">Suivi des achats, lignes fournisseur et validation vers lots et stock.</p>
        </div>
        <button className="button" type="button" onClick={() => setCreateOpen(true)}>
          + Nouvel Achat
        </button>
      </div>

      <div className="card purchase-filters">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par code, fournisseur, statut, date ou site..."
        />
        <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="DRAFT">Brouillon</option>
          <option value="VALIDATED">Valide</option>
        </select>
      </div>

      <div className="card">
        {purchases.isLoading ? (
          <p className="loading-state">Chargement des achats...</p>
        ) : rows.length === 0 ? (
          <p className="empty-state">Aucun achat trouve. Ajustez la recherche ou creez un nouvel achat.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table purchase-table">
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Fournisseur</th>
                  <th>Site</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((purchase) => (
                  <tr
                    className="clickable-row"
                    key={purchase.purchaseId}
                    onClick={() => setSelectedPurchaseId(purchase.purchaseId)}
                  >
                    <td><strong>{purchase.purchaseNumber}</strong></td>
                    <td>{purchase.supplierName ?? '-'}</td>
                    <td>{purchase.siteName ?? '-'}</td>
                    <td>{purchase.purchaseDate}</td>
                    <td>{formatMoney(purchase.totalAmount, purchase.currencyCode ?? 'USD', purchase.currencySymbol)}</td>
                    <td><span className={`badge ${statusBadge(purchase.status)}`}>{purchase.status}</span></td>
                    <td>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedPurchaseId(purchase.purchaseId);
                        }}
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal title="Nouvel achat" open={createOpen} onClose={closeCreate}>
        {create.isError && <p className="form-error">{apiErrorMessage(create.error)}</p>}
        <form className="purchase-form" onSubmit={submit}>
          <div className="form-section">
            <h3>Informations generales</h3>
            <div className="form-grid">
              <Field label="Code achat" help="Affecte automatiquement. Peut etre modifie avant creation.">
                <input className="input" placeholder="ACH-000001" value={form.purchaseNumber} onChange={(event) => update('purchaseNumber', event.target.value)} required />
              </Field>
              <Field label="Fournisseur" help="Selectionnez le fournisseur qui livre les produits.">
                <select className="input" value={form.supplierId} onChange={(event) => update('supplierId', event.target.value)} required>
                  <option value="">Choisir un fournisseur</option>
                  {(suppliers.data ?? []).map((supplier) => <option key={supplier.supplierId} value={supplier.supplierId}>{supplier.supplierName}</option>)}
                </select>
              </Field>
              <Field label="Date achat" help="Date de reception ou de creation de l'achat.">
                <input className="input" type="date" value={form.purchaseDate} onChange={(event) => update('purchaseDate', event.target.value)} required />
              </Field>
              <Field label="Devise" help="Devise utilisee pour cette commande. USD est la devise de base V1.1.">
                <select className="input" value={form.currencyCode} onChange={(event) => update('currencyCode', event.target.value)} disabled>
                  <option value="USD">USD - Dollar americain</option>
                </select>
              </Field>
              <Field label="Taux de change" help="Obligatoire si la devise n'est pas USD. Pour USD, laissez 1.">
                <input className="input" type="number" min="1" step="0.0001" placeholder="1" value={form.exchangeRate} onChange={(event) => update('exchangeRate', event.target.value)} required />
              </Field>
              <Field label="Site" help="Site qui recevra le stock apres validation.">
                <select className="input" value={form.siteId} onChange={(event) => update('siteId', event.target.value)} required>
                  <option value="">Choisir un site</option>
                  {(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Observation" help="Informations complementaires facultatives. Non persistantes en V1.1 car le schema ne contient pas encore ce champ.">
              <textarea className="input" rows={3} placeholder="Exemple : livraison partielle, reference facture fournisseur..." value={form.observation} onChange={(event) => update('observation', event.target.value)} />
            </Field>
          </div>

          <div className="form-section">
            <h3>Premiere ligne achat</h3>
            <div className="form-grid">
              <Field label="Article" help="Produit recu dans cet achat. D'autres lignes peuvent etre ajoutees depuis le detail achat.">
                <select className="input" value={form.articleId} onChange={(event) => update('articleId', event.target.value)} required>
                  <option value="">Choisir un article</option>
                  {(articles.data ?? []).map((article) => <option key={article.articleId} value={article.articleId}>{article.articleCode} - {article.commercialName}</option>)}
                </select>
              </Field>
              <Field label="Numero de lot" help="Identifiant du lot fournisseur. Il servira a creer ou reutiliser le lot.">
                <input className="input" placeholder="LOT-2026-001" value={form.lotNumber} onChange={(event) => update('lotNumber', event.target.value)} required />
              </Field>
              <Field label="Date expiration" help="Date future obligatoire pour permettre l'entree en stock.">
                <input className="input" type="date" value={form.expiryDate} onChange={(event) => update('expiryDate', event.target.value)} required />
              </Field>
              <Field label="Quantite" help="Quantite recue pour cette ligne. Doit etre superieure a zero.">
                <input className="input" type="number" min="0.001" step="0.001" placeholder="1" value={form.quantity} onChange={(event) => update('quantity', event.target.value)} required />
              </Field>
              <Field label="Prix achat" help="Prix d'achat unitaire dans la devise selectionnee.">
                <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.purchaseUnitPrice} onChange={(event) => update('purchaseUnitPrice', event.target.value)} required />
              </Field>
              <Field label="Prix vente" help="Prix de vente unitaire attendu pour ce lot.">
                <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.sellingUnitPrice} onChange={(event) => update('sellingUnitPrice', event.target.value)} required />
              </Field>
            </div>
          </div>

          <div className="form-summary">
            <span>Total ligne estime</span>
            <strong>{formatMoney(lineTotal, form.currencyCode)}</strong>
          </div>
          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={closeCreate} disabled={create.isPending}>Annuler</button>
            <button className="button" disabled={create.isPending || suppliers.isLoading || sites.isLoading || articles.isLoading}>
              {create.isPending ? 'Creation...' : 'Creer achat'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Detail achat" open={Boolean(selectedPurchaseId)} onClose={() => setSelectedPurchaseId(null)}>
        {validate.isError && <p className="form-error">{apiErrorMessage(validate.error)}</p>}
        {detail.isLoading || !selectedPurchase ? (
          <p className="loading-state">Chargement du detail achat...</p>
        ) : (
          <PurchaseDetailModal
            purchase={selectedPurchase}
            itemCount={detailItems.length}
            itemsTotal={detailTotal}
            onValidate={() => validate.mutate(selectedPurchase.purchaseId)}
            validating={validate.isPending}
          />
        )}
      </Modal>
    </>
  );
}

function PurchaseDetailModal({
  purchase,
  itemCount,
  itemsTotal,
  onValidate,
  validating,
}: {
  purchase: Purchase;
  itemCount: number;
  itemsTotal: number;
  onValidate: () => void;
  validating: boolean;
}) {
  const currencyCode = purchase.currencyCode ?? 'USD';
  const currencySymbol = purchase.currencySymbol;

  return (
    <div className="purchase-detail">
      <div className="detail-grid">
        <div><span>Code</span><strong>{purchase.purchaseNumber}</strong></div>
        <div><span>Date</span><strong>{purchase.purchaseDate}</strong></div>
        <div><span>Fournisseur</span><strong>{purchase.supplierName ?? '-'}</strong></div>
        <div><span>Site</span><strong>{purchase.siteName ?? '-'}</strong></div>
        <div><span>Statut</span><strong><span className={`badge ${statusBadge(purchase.status)}`}>{purchase.status}</span></strong></div>
        <div><span>Devise</span><strong>{currencyCode}</strong></div>
        <div><span>Taux de change</span><strong>{purchase.exchangeRate}</strong></div>
        <div><span>Total</span><strong>{formatMoney(purchase.totalAmount, currencyCode, currencySymbol)}</strong></div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Article</th>
              <th>Quantite</th>
              <th>Prix achat</th>
              <th>Total ligne</th>
            </tr>
          </thead>
          <tbody>
            {(purchase.items ?? []).map((item) => (
              <tr key={item.purchaseItemId}>
                <td>{item.commercialName ?? item.articleCode ?? '-'}</td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.purchaseUnitPrice, currencyCode, currencySymbol)}</td>
                <td>{formatMoney(item.lineTotal, currencyCode, currencySymbol)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="form-summary">
        <span>{itemCount} ligne(s)</span>
        <strong>{formatMoney(itemsTotal, currencyCode, currencySymbol)}</strong>
      </div>

      {purchase.status === 'DRAFT' && (
        <div className="modal-actions">
          <button className="button" type="button" onClick={onValidate} disabled={validating || itemCount === 0}>
            {validating ? 'Validation...' : 'Valider achat'}
          </button>
        </div>
      )}
    </div>
  );
}
