import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { FloatingSearchPopover } from '../../components/FloatingSearchPopover';
import { Article, articlesService } from '../../services/articles.service';
import { apiErrorMessage } from '../../services/apiError';
import { customerReturnsService } from '../../services/customerReturns.service';
import { SiteItem, sitesService } from '../../services/sites.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import { customerReturnStatusClass, customerReturnStatusLabel } from './customerReturnLabels';

export function CustomerReturnCreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { permissions, currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [siteId, setSiteId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [origin, setOrigin] = useState<'LINKED' | 'UNLINKED'>('LINKED');
  const [linkedSalesPopoverOpen, setLinkedSalesPopoverOpen] = useState(false);
  const [unlinkedMode, setUnlinkedMode] = useState<'RETURN' | 'DECLARE'>('RETURN');
  const [declaredArticlePopoverOpen, setDeclaredArticlePopoverOpen] = useState(false);
  const [probableSaleSearch, setProbableSaleSearch] = useState('');
  const [declaredCustomerName, setDeclaredCustomerName] = useState('');
  const [declaredCustomerPhone, setDeclaredCustomerPhone] = useState('');
  const [declaredArticleSearch, setDeclaredArticleSearch] = useState('');
  const [declaredArticleId, setDeclaredArticleId] = useState('');
  const [declaredQuantity, setDeclaredQuantity] = useState('1');
  const [declaredLotNumber, setDeclaredLotNumber] = useState('');
  const [declaredExpiryDate, setDeclaredExpiryDate] = useState('');
  const [approximatePurchaseDate, setApproximatePurchaseDate] = useState('');
  const [supposedSiteId, setSupposedSiteId] = useState('');
  const [declaredPrice, setDeclaredPrice] = useState('');
  const [responsibilityOrigin, setResponsibilityOrigin] = useState('OTHER');
  const [commercialDecision, setCommercialDecision] = useState('INSPECTION_REQUIRED');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const canCreate = permissions.includes('customer_returns.create');
  const canCreateUnlinked = permissions.includes('customer_returns.unlinked.create');

  const query = useQuery({
    queryKey: ['customer-returns-validated-sales', search, siteId, dateFrom, dateTo],
    queryFn: async () => (await customerReturnsService.searchValidatedSales({
      search: search || undefined,
      siteId: siteId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page: 1,
      limit: 25,
    })).data,
    placeholderData: (previous) => previous,
    enabled: canCreate && origin === 'LINKED',
  });

  const probableSalesQuery = useQuery({
    queryKey: ['customer-returns-sales-search', probableSaleSearch, declaredCustomerPhone, declaredCustomerName, declaredArticleSearch, declaredLotNumber, approximatePurchaseDate, supposedSiteId, declaredPrice],
    queryFn: async () => (await customerReturnsService.searchProbableSales({
      search: probableSaleSearch || undefined,
      phone: declaredCustomerPhone || undefined,
      customerName: declaredCustomerName || undefined,
      article: declaredArticleSearch || undefined,
      lotNumber: declaredLotNumber || undefined,
      approximateDate: approximatePurchaseDate || undefined,
      siteId: supposedSiteId || undefined,
      approximateAmount: declaredPrice ? Number(declaredPrice) : undefined,
      page: 1,
      limit: 25,
    })).data,
    enabled: canCreateUnlinked && origin === 'UNLINKED',
    placeholderData: (previous) => previous,
  });

  const articlesQuery = useQuery({
    queryKey: ['customer-return-create-articles', declaredArticleSearch],
    queryFn: async () => (await articlesService.getAll({ search: declaredArticleSearch || undefined, page: 1, limit: 50 })).data.items,
    enabled: canCreateUnlinked && origin === 'UNLINKED',
    placeholderData: (previous) => previous,
  });

  const sitesQuery = useQuery({
    queryKey: ['customer-return-create-sites'],
    queryFn: async () => (await sitesService.getAll()).data,
    enabled: canCreateUnlinked && origin === 'UNLINKED',
  });

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) => customerReturnsService.create(payload),
    onSuccess: async (response) => {
      await qc.invalidateQueries({ queryKey: ['customer-returns'] });
      navigate(`/customer-returns/${response.data.customerReturnId}`);
    },
  });

  const sales = query.data?.items ?? [];
  const probableSales = probableSalesQuery.data ?? [];
  const articles = articlesQuery.data ?? [];
  const sites = sitesQuery.data ?? [];
  const selectedDeclaredArticle = articles.find((article) => article.articleId === declaredArticleId);
  const filteredSales = useMemo(() => sales.filter((sale) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [
      sale.saleNumber,
      sale.customerName,
      sale.organizationName,
      sale.siteName,
    ].some((value) => String(value ?? '').toLowerCase().includes(term));
  }), [sales, search]);

  useEffect(() => {
    setLinkedSalesPopoverOpen(false);
    setDeclaredArticlePopoverOpen(false);
  }, [origin]);

  return (
    <>
      <div className="breadcrumb">
        <Link to="/customer-returns">Retours clients</Link>
        <span>&gt;</span>
        <strong>Nouveau dossier</strong>
      </div>
      <div className="toolbar">
        <div>
          <h1>Nouveau retour client</h1>
          <p className="muted">Selectionnez une vente validee ou ouvrez un dossier exceptionnel sans facture avec tracabilite renforcee.</p>
        </div>
        <Link className="ghost-button compact-button" to="/customer-returns">Retour liste</Link>
      </div>

      {!canCreate ? (
        <div className="card">
          <p className="empty-state">Permission customer_returns.create requise.</p>
        </div>
      ) : (
        <>
          <div className="card compact-card">
            <div className="panel-heading">
              <div>
                <h2>Origine du retour</h2>
                <p className="muted">Le retour avec vente identifiee reste le flux standard.</p>
              </div>
            </div>
            <div className="segmented-control">
              <button className={origin === 'LINKED' ? 'is-active' : ''} type="button" onClick={() => setOrigin('LINKED')}>
                Vente identifiee
              </button>
              <button className={origin === 'UNLINKED' ? 'is-active' : ''} type="button" onClick={() => setOrigin('UNLINKED')} disabled={!canCreateUnlinked}>
                Vente non retrouvee / sans facture
              </button>
            </div>
            {!canCreateUnlinked && origin === 'LINKED' ? (
              <p className="muted">Permission customer_returns.unlinked.create requise pour les retours sans facture.</p>
            ) : null}
          </div>

          {origin === 'LINKED' ? (
            <>
              <div className="card sales-filters">
                <div className="sales-filter-grid">
                  <label className="field-block">
                    <span>Site</span>
                    <input className="input" value={siteId} onChange={(event) => setSiteId(event.target.value)} placeholder="UUID du site ou filtre deja applique" />
                  </label>
                  <label className="field-block">
                    <span>Date debut</span>
                    <input className="input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                  </label>
                  <label className="field-block">
                    <span>Date fin</span>
                    <input className="input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                  </label>
                </div>
              </div>

              <div className="card">
                <div className="panel-heading">
                  <div>
                    <h2>Ventes validees</h2>
                    <p className="muted">Recherchez puis selectionnez la vente source du dossier.</p>
                  </div>
                </div>

                {query.isError ? (
                  <div className="error-state">
                    <p>{apiErrorMessage(query.error)}</p>
                    <button className="ghost-button compact-button" type="button" onClick={() => query.refetch()}>Reessayer</button>
                  </div>
                ) : (
                  <FloatingSearchPopover
                    value={search}
                    onChange={setSearch}
                    onOpen={() => setLinkedSalesPopoverOpen(true)}
                    onClose={() => setLinkedSalesPopoverOpen(false)}
                    onSelect={(sale) => create.mutate({ saleId: sale.saleId, saleLinkStatus: 'LINKED', reason: reason || undefined, note: note || undefined })}
                    open={linkedSalesPopoverOpen}
                    placeholder="Scanner ou rechercher une vente validee..."
                    searchPlaceholder="Rechercher une vente, un client, un site..."
                    suggestions={filteredSales}
                    getKey={(sale) => sale.saleId}
                    columns={[
                      { header: 'Vente', render: (sale) => sale.saleNumber },
                      { header: 'Date', render: (sale) => formatDate(sale.saleDate) },
                      { header: 'Client', render: (sale) => sale.customerName || sale.organizationName || 'Comptoir' },
                      { header: 'Site', render: (sale) => sale.siteName ?? '-' },
                      { header: 'Total', render: (sale) => formatMoney(sale.totalAmount, sale.currencyCode ?? 'USD', sale.currencySymbol) },
                      { header: 'Statut', render: (sale) => <span className={`badge ${customerReturnStatusClass(sale.status)}`}>{customerReturnStatusLabel(sale.status)}</span> },
                    ]}
                    footerLabel="Entree pour creer le dossier - Echap pour fermer"
                    maxVisible={25}
                  />
                )}

                {create.isError ? <p className="form-error">{apiErrorMessage(create.error)}</p> : null}
                {create.isPending ? <p className="loading-state">Creation du dossier...</p> : null}
              </div>
            </>
          ) : (
            <div className="card">
              <div className="panel-heading">
                <div>
                  <h2>Retour sans facture</h2>
                  <p className="muted">La trace du dossier reste distincte: retour sans facture ou vente non retrouvee.</p>
                </div>
              </div>

              <div className="segmented-control" role="tablist" aria-label="Flux sans facture">
                <button
                  type="button"
                  role="tab"
                  id="customer-return-unlinked-tab-return"
                  aria-controls="customer-return-unlinked-panel-return"
                  aria-selected={unlinkedMode === 'RETURN'}
                  className={unlinkedMode === 'RETURN' ? 'is-active' : ''}
                  onClick={() => setUnlinkedMode('RETURN')}
                >
                  Retour sans facture
                </button>
                <button
                  type="button"
                  role="tab"
                  id="customer-return-unlinked-tab-declare"
                  aria-controls="customer-return-unlinked-panel-declare"
                  aria-selected={unlinkedMode === 'DECLARE'}
                  className={unlinkedMode === 'DECLARE' ? 'is-active' : ''}
                  onClick={() => setUnlinkedMode('DECLARE')}
                >
                  Declarer une vente non retrouvee
                </button>
              </div>

              <div className="grid-form">
                <label className="field-block">
                  <span>Nom client</span>
                  <input className="input" value={declaredCustomerName} onChange={(event) => setDeclaredCustomerName(event.target.value)} placeholder="Nom declare" />
                </label>
                <label className="field-block">
                  <span>Telephone</span>
                  <input className="input" value={declaredCustomerPhone} onChange={(event) => setDeclaredCustomerPhone(event.target.value)} placeholder="Telephone declare" />
                </label>
                <label className="field-block">
                  <span>Motif</span>
                  <input className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motif obligatoire" />
                </label>
                <label className="field-block">
                  <span>Observation</span>
                  <input className="input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Observation, photo produit a joindre ensuite" />
                </label>
              </div>

              <div role="tabpanel" id="customer-return-unlinked-panel-return" aria-labelledby="customer-return-unlinked-tab-return" hidden={unlinkedMode !== 'RETURN'}>
                <div className="card compact-card">
                  <div className="panel-heading">
                    <div>
                      <h3>Ventes probables</h3>
                      <p className="muted">Recherchez une trace plausible puis liez le dossier au resultat le plus credible.</p>
                    </div>
                  </div>
                  <div className="grid-form">
                    <label className="field-block">
                      <span>Recherche multicritere</span>
                      <input className="input" value={probableSaleSearch} onChange={(event) => setProbableSaleSearch(event.target.value)} placeholder="Ticket, facture, QR, client, article..." />
                    </label>
                  </div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Vente probable</th>
                          <th>Date</th>
                          <th>Client</th>
                          <th>Site</th>
                          <th>Montant</th>
                          <th>Confiance</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {probableSales.length === 0 ? (
                          <tr><td colSpan={7}><p className="empty-state">Aucune vente probable trouvee avec ces criteres.</p></td></tr>
                        ) : probableSales.map((sale) => (
                          <tr key={sale.saleId}>
                            <td><strong>{sale.saleNumber}</strong></td>
                            <td>{formatDate(sale.saleDate)}</td>
                            <td>{sale.customerName || sale.customerPhone || 'Comptoir'}</td>
                            <td>{sale.siteName || '-'}</td>
                            <td className="numeric-text">{formatMoney(sale.totalAmount, sale.currencyCode || 'USD')}</td>
                            <td><span className="badge badge-info">{sale.confidenceScore}% - {sale.traceabilityLabel}</span></td>
                            <td>
                              <button className="ghost-button compact-button" type="button" onClick={() => create.mutate({ saleId: sale.saleId, probableSaleId: sale.saleId, saleLinkStatus: 'PROBABLE', reason: reason || undefined, note: note || undefined })}>
                                Utiliser
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div role="tabpanel" id="customer-return-unlinked-panel-declare" aria-labelledby="customer-return-unlinked-tab-declare" hidden={unlinkedMode !== 'DECLARE'}>
                <div className="card compact-card">
                  <div className="panel-heading">
                    <div>
                      <h3>Declarer une vente non retrouvee</h3>
                      <p className="muted">Aucun remboursement, echange, stock ou caisse n est genere a cette etape.</p>
                    </div>
                  </div>
                  <div className="grid-form">
                    <label className="field-block">
                      <span>Article</span>
                      <FloatingSearchPopover
                        value={declaredArticleSearch}
                        onChange={setDeclaredArticleSearch}
                        onOpen={() => setDeclaredArticlePopoverOpen(true)}
                        onClose={() => setDeclaredArticlePopoverOpen(false)}
                        onSelect={(article: Article) => {
                          setDeclaredArticleId(article.articleId);
                          setDeclaredArticleSearch(article.commercialName || article.articleCode);
                          if (!declaredPrice && article.sellingPrice) setDeclaredPrice(String(article.sellingPrice));
                        }}
                        open={declaredArticlePopoverOpen}
                        placeholder="Rechercher article, code, DCI..."
                        searchPlaceholder="Code, nom, DCI, barcode..."
                        suggestions={articles}
                        getKey={(article) => article.articleId}
                        columns={[
                          { header: 'Code', render: (article) => article.articleCode },
                          { header: 'Nom', render: (article) => article.commercialName },
                          { header: 'DCI', render: (article) => article.dci || '-' },
                          { header: 'Prix', render: (article) => formatMoney(article.sellingPrice || 0, 'USD') },
                        ]}
                        footerLabel="Entree pour selectionner - Echap pour fermer"
                        maxVisible={25}
                      />
                    </label>
                    <label className="field-block">
                      <span>Quantite</span>
                      <input className="input" type="number" min="0.001" step="0.001" value={declaredQuantity} onChange={(event) => setDeclaredQuantity(event.target.value)} />
                    </label>
                    <label className="field-block">
                      <span>Lot</span>
                      <input className="input" value={declaredLotNumber} onChange={(event) => setDeclaredLotNumber(event.target.value)} placeholder="Numero de lot" />
                    </label>
                    <label className="field-block">
                      <span>Expiration</span>
                      <input className="input" type="date" value={declaredExpiryDate} onChange={(event) => setDeclaredExpiryDate(event.target.value)} />
                    </label>
                    <label className="field-block">
                      <span>Date achat approx.</span>
                      <input className="input" type="date" value={approximatePurchaseDate} onChange={(event) => setApproximatePurchaseDate(event.target.value)} />
                    </label>
                    <label className="field-block">
                      <span>Site suppose</span>
                      <select className="input" value={supposedSiteId || currentUser?.siteId || ''} onChange={(event) => setSupposedSiteId(event.target.value)}>
                        <option value="">Choisir site</option>
                        {sites.map((site: SiteItem) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}
                      </select>
                    </label>
                    <label className="field-block">
                      <span>Prix declare</span>
                      <input className="input" type="number" min="0" step="0.01" value={declaredPrice} onChange={(event) => setDeclaredPrice(event.target.value)} />
                    </label>
                    <label className="field-block">
                      <span>Responsabilite</span>
                      <select className="input" value={responsibilityOrigin} onChange={(event) => setResponsibilityOrigin(event.target.value)}>
                        <option value="PHARMACY_ERROR">Erreur pharmacie</option>
                        <option value="CUSTOMER_ERROR">Erreur client</option>
                        <option value="SUPPLIER_DEFECT">Defectueux fournisseur</option>
                        <option value="OTHER">Autre</option>
                      </select>
                    </label>
                    <label className="field-block">
                      <span>Decision</span>
                      <select className="input" value={commercialDecision} onChange={(event) => setCommercialDecision(event.target.value)}>
                        <option value="INSPECTION_REQUIRED">Retour a inspecter</option>
                        <option value="ACCEPTED_WITH_RESERVE">Accepte sous reserve</option>
                        <option value="REFUSED">Retour refuse</option>
                      </select>
                    </label>
                  </div>
                  <div className="detail-grid">
                    <div><span>Article retenu</span><strong>{selectedDeclaredArticle?.commercialName || '-'}</strong></div>
                    <div><span>Trace attendue</span><strong>Validation responsable obligatoire</strong></div>
                    <div><span>Stock</span><strong>Aucun mouvement</strong></div>
                    <div><span>Caisse</span><strong>Aucun remboursement automatique</strong></div>
                  </div>
                  {create.isError ? <p className="form-error">{apiErrorMessage(create.error)}</p> : null}
                  <div className="modal-actions">
                    <button
                      className="button compact-button"
                      type="button"
                      disabled={create.isPending || !declaredCustomerName || !declaredCustomerPhone || !declaredArticleId || !declaredLotNumber || !declaredExpiryDate || !approximatePurchaseDate || !(supposedSiteId || currentUser?.siteId) || !reason}
                      onClick={() => create.mutate({
                        saleLinkStatus: 'UNLINKED',
                        declaredCustomerName,
                        declaredCustomerPhone,
                        declaredArticleId,
                        declaredQuantity: Number(declaredQuantity),
                        declaredLotNumber,
                        declaredExpiryDate,
                        approximatePurchaseDate,
                        supposedSiteId: supposedSiteId || currentUser?.siteId,
                        declaredPrice: Number(declaredPrice || 0),
                        responsibilityOrigin,
                        commercialDecision,
                        reason,
                        note,
                      })}
                    >
                      {create.isPending ? 'Creation...' : 'Creer le retour sans facture'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
