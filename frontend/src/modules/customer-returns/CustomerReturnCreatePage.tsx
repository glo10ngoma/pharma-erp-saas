import { KeyboardEvent, useEffect, useMemo, useState } from 'react';
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

type UnlinkedReturnItemDraft = {
  localId: string;
  articleId: string;
  articleSearch: string;
  quantity: string;
  lotNumber: string;
  expiryDate: string;
  declaredPrice: string;
  reason: string;
  condition: 'GOOD' | 'OPENED' | 'DAMAGED' | 'EXPIRED' | 'WRONG_PRODUCT' | 'OTHER';
  note: string;
};

const createEmptyUnlinkedItem = (localId: string): UnlinkedReturnItemDraft => ({
  localId,
  articleId: '',
  articleSearch: '',
  quantity: '1',
  lotNumber: '',
  expiryDate: '',
  declaredPrice: '',
  reason: '',
  condition: 'GOOD',
  note: '',
});

const DRAFT_LINE_ID = '__draft__';

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
  const [probableSaleSearch, setProbableSaleSearch] = useState('');
  const [declaredCustomerName, setDeclaredCustomerName] = useState('');
  const [declaredCustomerPhone, setDeclaredCustomerPhone] = useState('');
  const [declaredArticleSearch, setDeclaredArticleSearch] = useState('');
  const [declaredArticleId, setDeclaredArticleId] = useState('');
  const [declaredArticlePopoverOpen, setDeclaredArticlePopoverOpen] = useState(false);
  const [declaredQuantity, setDeclaredQuantity] = useState('1');
  const [declaredLotNumber, setDeclaredLotNumber] = useState('');
  const [declaredExpiryDate, setDeclaredExpiryDate] = useState('');
  const [approximatePurchaseDate, setApproximatePurchaseDate] = useState('');
  const [supposedSiteId, setSupposedSiteId] = useState('');
  const [declaredPrice, setDeclaredPrice] = useState('');
  const [draftLineReason, setDraftLineReason] = useState('');
  const [draftLineCondition, setDraftLineCondition] = useState<UnlinkedReturnItemDraft['condition']>('GOOD');
  const [draftLineNote, setDraftLineNote] = useState('');
  const [responsibilityOrigin, setResponsibilityOrigin] = useState('OTHER');
  const [commercialDecision, setCommercialDecision] = useState('INSPECTION_REQUIRED');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [unlinkedReturnItems, setUnlinkedReturnItems] = useState<UnlinkedReturnItemDraft[]>([]);
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

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) => customerReturnsService.create(payload),
    onSuccess: async (response) => {
      await qc.invalidateQueries({ queryKey: ['customer-returns'] });
      navigate(`/customer-returns/${response.data.customerReturnId}`);
    },
  });

  const sales = query.data?.items ?? [];
  const probableSales = probableSalesQuery.data ?? [];
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

  const articlesQuery = useQuery({
    queryKey: ['customer-return-create-articles', declaredArticleSearch],
    queryFn: async () => (await articlesService.getAll({ search: declaredArticleSearch || undefined, page: 1, limit: 50 })).data.items,
    enabled: canCreateUnlinked && origin === 'UNLINKED' && unlinkedMode === 'DECLARE',
    placeholderData: (previous) => previous,
  });
  const sitesQuery = useQuery({
    queryKey: ['customer-return-create-sites'],
    queryFn: async () => (await sitesService.getAll()).data,
    enabled: canCreateUnlinked && origin === 'UNLINKED',
  });
  const activeArticleSuggestions = articlesQuery.data ?? [];
  const selectedDeclaredArticle = useMemo(
    () => activeArticleSuggestions.find((article) => article.articleId === declaredArticleId) ?? null,
    [activeArticleSuggestions, declaredArticleId],
  );

  const addDraftLine = () => {
    if (!declaredArticleId || !selectedDeclaredArticle) return false;
    if (Number(declaredQuantity || 0) <= 0) return false;

    const articleLabel = declaredArticleSearch.trim() || selectedDeclaredArticle.commercialName || selectedDeclaredArticle.articleCode || '';
    setUnlinkedReturnItems((items) => [
      ...items,
      {
        localId: crypto.randomUUID(),
        articleId: declaredArticleId,
        articleSearch: articleLabel,
        quantity: declaredQuantity,
        lotNumber: declaredLotNumber,
        expiryDate: declaredExpiryDate,
        declaredPrice,
        reason: draftLineReason || reason,
        condition: draftLineCondition,
        note: draftLineNote || note,
      },
    ]);
    setDeclaredArticleId('');
    setDeclaredArticleSearch('');
    setDeclaredQuantity('1');
    setDeclaredLotNumber('');
    setDeclaredExpiryDate('');
    setDeclaredPrice('');
    setDraftLineReason('');
    setDraftLineCondition('GOOD');
    setDraftLineNote('');
    setDeclaredArticlePopoverOpen(false);
    return true;
  };

  const duplicateLine = (line: UnlinkedReturnItemDraft) => {
    setUnlinkedReturnItems((items) => [
      ...items,
      {
        ...line,
        localId: crypto.randomUUID(),
      },
    ]);
  };

  const removeLine = (localId: string) => {
    setUnlinkedReturnItems((items) => items.filter((item) => item.localId !== localId));
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addDraftLine();
    }
  };

  const draftLineReady = Boolean(
    declaredArticleId
      && selectedDeclaredArticle
      && Number(declaredQuantity || 0) > 0,
  );
  const unlinkedPreviewItems = useMemo(() => {
    if (!draftLineReady || !selectedDeclaredArticle) return unlinkedReturnItems;
    return [
      ...unlinkedReturnItems,
      {
        localId: DRAFT_LINE_ID,
        articleId: declaredArticleId,
        articleSearch: declaredArticleSearch.trim() || selectedDeclaredArticle.commercialName || selectedDeclaredArticle.articleCode || '',
        quantity: declaredQuantity,
        lotNumber: declaredLotNumber,
        expiryDate: declaredExpiryDate,
        declaredPrice,
        reason: draftLineReason || reason,
        condition: draftLineCondition,
        note: draftLineNote || note,
      },
    ];
  }, [
    declaredArticleId,
    declaredArticleSearch,
    declaredExpiryDate,
    declaredLotNumber,
    declaredPrice,
    declaredQuantity,
    draftLineCondition,
    draftLineNote,
    draftLineReason,
    note,
    reason,
    selectedDeclaredArticle,
    unlinkedReturnItems,
    draftLineReady,
  ]);
  const unlinkedPreviewTotals = useMemo(() => ({
    lines: unlinkedPreviewItems.length,
    quantity: unlinkedPreviewItems.reduce((total, item) => total + Number(item.quantity || 0), 0),
    value: unlinkedPreviewItems.reduce((total, item) => total + (Number(item.quantity || 0) * Number(item.declaredPrice || 0)), 0),
  }), [unlinkedPreviewItems]);

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
                  <p className="muted">La trace du dossier reste distincte : retour sans facture ou vente non retrouvee.</p>
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
                  <span>Site suppose</span>
                  <select className="input" value={supposedSiteId || currentUser?.siteId || ''} onChange={(event) => setSupposedSiteId(event.target.value)}>
                    <option value="">Choisir site</option>
                    {(sitesQuery.data ?? []).map((site: SiteItem) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}
                  </select>
                </label>
                <label className="field-block">
                  <span>Date achat approx.</span>
                  <input className="input" type="date" value={approximatePurchaseDate} onChange={(event) => setApproximatePurchaseDate(event.target.value)} />
                </label>
                <label className="field-block">
                  <span>Motif dossier</span>
                  <input className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motif obligatoire" />
                </label>
                <label className="field-block">
                  <span>Observation dossier</span>
                  <input className="input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Observation, photo produit a joindre ensuite" />
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
                              <button className="ghost-button compact-button" type="button" onClick={() => create.mutate({
                                saleId: sale.saleId,
                                probableSaleId: sale.saleId,
                                saleLinkStatus: 'PROBABLE',
                                reason: reason || undefined,
                                note: note || undefined,
                              })}>
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
                      <h3>Déclarer plusieurs articles sans facture</h3>
                      <p className="muted">Chaque ligne est ajoutée explicitement, puis le dossier est enregistré de manière transactionnelle.</p>
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Article</th>
                          <th>Quantité</th>
                          <th>Lot</th>
                          <th>Expiration</th>
                          <th>Prix déclaré</th>
                          <th>Motif</th>
                          <th>État</th>
                          <th>Observation</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unlinkedReturnItems.length === 0 ? (
                          <tr>
                            <td colSpan={9}><p className="empty-state">Aucune ligne encore ajoutée.</p></td>
                          </tr>
                        ) : unlinkedReturnItems.map((item) => (
                          <tr key={item.localId}>
                            <td>
                              <strong>{item.articleSearch || '-'}</strong>
                              <div className="muted">{item.articleId}</div>
                            </td>
                            <td className="numeric-text">{item.quantity}</td>
                            <td>{item.lotNumber || '-'}</td>
                            <td>{item.expiryDate ? formatDate(item.expiryDate) : '-'}</td>
                            <td className="numeric-text">{formatMoney(Number(item.declaredPrice || 0), 'USD')}</td>
                            <td>{item.reason || reason || '-'}</td>
                            <td><span className="badge badge-info">{item.condition}</span></td>
                            <td>{item.note || note || '-'}</td>
                            <td className="table-actions">
                              <button className="ghost-button compact-button" type="button" onClick={() => duplicateLine(item)}>Dupliquer</button>
                              <button className="ghost-button compact-button" type="button" onClick={() => removeLine(item.localId)}>Supprimer</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>
                            <FloatingSearchPopover
                              value={declaredArticleSearch}
                              onChange={(value) => {
                                setDeclaredArticleSearch(value);
                                setDeclaredArticleId('');
                                setDeclaredArticlePopoverOpen(true);
                              }}
                              onOpen={() => setDeclaredArticlePopoverOpen(true)}
                              onClose={() => setDeclaredArticlePopoverOpen(false)}
                              onSelect={(article: Article) => {
                                setDeclaredArticleId(article.articleId);
                                setDeclaredArticleSearch(article.commercialName || article.articleCode || '');
                                if (!declaredPrice && article.sellingPrice) setDeclaredPrice(String(article.sellingPrice));
                              }}
                              open={declaredArticlePopoverOpen}
                              placeholder="Rechercher ou scanner un article..."
                              searchPlaceholder="Code, nom, DCI, dosage..."
                              suggestions={activeArticleSuggestions}
                              getKey={(article) => article.articleId}
                              columns={[
                                { header: 'Code', render: (article) => article.articleCode },
                                { header: 'Nom', render: (article) => article.commercialName },
                                { header: 'DCI', render: (article) => article.dci || '-' },
                                { header: 'Dosage', render: (article) => article.dosage || '-' },
                                { header: 'Prix', render: (article) => formatMoney(article.sellingPrice || 0, 'USD') },
                              ]}
                              footerLabel="Entrée pour sélectionner - Échap pour fermer"
                              maxVisible={25}
                            />
                          </td>
                          <td>
                            <input className="input" type="number" min="0.001" step="0.001" value={declaredQuantity} onChange={(event) => setDeclaredQuantity(event.target.value)} onKeyDown={handleDraftKeyDown} />
                          </td>
                          <td>
                            <input className="input" value={declaredLotNumber} onChange={(event) => setDeclaredLotNumber(event.target.value)} placeholder="Lot" onKeyDown={handleDraftKeyDown} />
                          </td>
                          <td>
                            <input className="input" type="date" value={declaredExpiryDate} onChange={(event) => setDeclaredExpiryDate(event.target.value)} onKeyDown={handleDraftKeyDown} />
                          </td>
                          <td>
                            <input className="input" type="number" min="0" step="0.01" value={declaredPrice} onChange={(event) => setDeclaredPrice(event.target.value)} onKeyDown={handleDraftKeyDown} />
                          </td>
                          <td>
                            <input className="input" value={draftLineReason} onChange={(event) => setDraftLineReason(event.target.value)} placeholder="Motif ligne" onKeyDown={handleDraftKeyDown} />
                          </td>
                          <td>
                            <select className="input" value={draftLineCondition} onChange={(event) => setDraftLineCondition(event.target.value as UnlinkedReturnItemDraft['condition'])} onKeyDown={handleDraftKeyDown}>
                              <option value="GOOD">Bon état</option>
                              <option value="OPENED">Ouvert</option>
                              <option value="DAMAGED">Endommagé</option>
                              <option value="EXPIRED">Expiré</option>
                              <option value="WRONG_PRODUCT">Mauvais produit</option>
                              <option value="OTHER">Autre</option>
                            </select>
                          </td>
                          <td>
                            <input className="input" value={draftLineNote} onChange={(event) => setDraftLineNote(event.target.value)} placeholder="Observation ligne" onKeyDown={handleDraftKeyDown} />
                          </td>
                          <td className="table-actions">
                            <button className="button compact-button" type="button" onClick={addDraftLine} disabled={!draftLineReady}>
                              + Ajouter ligne
                            </button>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="detail-grid">
                    <div><span>Lignes</span><strong>{unlinkedPreviewTotals.lines}</strong></div>
                    <div><span>Quantité totale</span><strong>{unlinkedPreviewTotals.quantity}</strong></div>
                    <div><span>Valeur déclarée</span><strong>{formatMoney(unlinkedPreviewTotals.value, 'USD')}</strong></div>
                    <div><span>Trace attendue</span><strong>Validation responsable obligatoire</strong></div>
                  </div>

                  {create.isError ? <p className="form-error">{apiErrorMessage(create.error)}</p> : null}
                  <div className="modal-actions">
                    <button
                      className="button compact-button"
                      type="button"
                      disabled={create.isPending || !declaredCustomerName || !declaredCustomerPhone || !reason || !(supposedSiteId || currentUser?.siteId) || unlinkedPreviewItems.length === 0}
                      onClick={() => create.mutate({
                        saleLinkStatus: 'UNLINKED',
                        declaredCustomerName,
                        declaredCustomerPhone,
                        reason,
                        note,
                        approximatePurchaseDate,
                        supposedSiteId: supposedSiteId || currentUser?.siteId,
                        responsibilityOrigin,
                        commercialDecision,
                        items: unlinkedPreviewItems.map((item) => ({
                          articleId: item.articleId,
                          quantity: Number(item.quantity || 0),
                          lotNumber: item.lotNumber || undefined,
                          expiryDate: item.expiryDate || undefined,
                          declaredPrice: Number(item.declaredPrice || 0),
                          reason: item.reason || undefined,
                          condition: item.condition,
                          note: item.note || undefined,
                        })),
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
