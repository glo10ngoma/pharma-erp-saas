import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { PriceCheck, PriceCheckQuote, priceChecksService } from '../../services/priceChecks.service';
import { settingsService } from '../../services/settings.service';
import { sitesService } from '../../services/sites.service';
import { formatMoney } from '../../utils/money';

type DraftLine = {
  key: string;
  articleId: string | null;
  articleCode: string | null;
  articleName: string;
  unitName: string | null;
  unitPrice: number | null;
  requestedQuantity: number;
  availableQuantity: number;
  availabilityStatus: PriceCheckQuote['availabilityStatus'];
  manualDescription?: string | null;
};

type PriceCheckModalProps = {
  isOpen: boolean;
  onClose: () => void;
  siteId?: string | null;
  siteName?: string | null;
};

const availabilityLabels: Record<string, string> = {
  AVAILABLE: 'Disponible',
  INSUFFICIENT_STOCK: 'Stock insuffisant',
  UNAVAILABLE: 'Indisponible',
  UNREFERENCED: 'Non reference',
};

export function PriceChecksPage() {
  const { permissions } = useAuth();
  const [historySearch, setHistorySearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<PriceCheck | null>(null);
  const canRead = permissions.includes('price_checks.read') || permissions.includes('sales.read');
  const canCreate = permissions.includes('price_checks.create') || permissions.includes('sales.create');
  const canPrint = permissions.includes('price_checks.print') || canCreate || canRead;

  const history = useQuery({
    queryKey: ['price-checks', historySearch],
    queryFn: () => priceChecksService.list({ search: historySearch || undefined }).then((response) => response.data),
    enabled: canRead,
  });

  return (
    <section className="price-check-page">
      <header className="page-heading">
        <div>
          <span className="breadcrumb">Ventes</span>
          <h1>Verification de prix</h1>
          <p>Historique des estimations indicatives pour ordonnances client, sans vente et sans reservation de stock.</p>
        </div>
        <div className="page-heading-actions">
          <button className="button compact-button" type="button" onClick={() => setModalOpen(true)} disabled={!canCreate}>
            Nouvelle verification
          </button>
        </div>
      </header>

      <section className="card compact-card price-check-history-page">
        <div className="price-check-history-toolbar">
          <input
            className="input compact-input"
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
            placeholder="Rechercher reference, client, patient ou telephone"
          />
        </div>
        <div className="table-wrap">
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Client / patient</th>
                <th>Site</th>
                <th>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.data?.items.map((check) => (
                <tr key={check.priceCheckId}>
                  <td><strong>{check.checkNumber}</strong></td>
                  <td>{new Date(check.createdAt).toLocaleString('fr-FR')}</td>
                  <td>{check.customerName || check.patientName || 'Client comptoir'}<br /><span className="muted">{check.phone || '-'}</span></td>
                  <td>{check.siteName || 'Site courant'}</td>
                  <td>{formatMoney(check.totalUsd, 'USD')}</td>
                  <td>
                    <div className="table-actions">
                      <button className="ghost-button compact-button" type="button" onClick={() => priceChecksService.getById(check.priceCheckId).then((response) => setSelectedCheck(response.data))}>
                        Voir
                      </button>
                      {canPrint ? (
                        <button className="ghost-button compact-button" type="button" onClick={() => priceChecksService.getById(check.priceCheckId).then((response) => printCheck(response.data))}>
                          Imprimer
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {history.data?.items.length === 0 ? <tr><td colSpan={6} className="muted">Aucune verification trouvee.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedCheck ? (
        <section className="card compact-card price-check-preview">
          <div className="page-heading">
            <div>
              <span className="breadcrumb">Bordereau de prix</span>
              <h2>{selectedCheck.checkNumber}</h2>
            </div>
            <div className="page-heading-actions">
              {canPrint ? <button className="button compact-button" type="button" onClick={() => printCheck(selectedCheck)}>Imprimer / PDF</button> : null}
              <button className="ghost-button compact-button" type="button" onClick={() => setSelectedCheck(null)}>Fermer</button>
            </div>
          </div>
          <PriceCheckDocument check={selectedCheck} />
        </section>
      ) : null}

      <PriceCheckModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  );
}

export function PriceCheckModal({ isOpen, onClose, siteId: forcedSiteId, siteName }: PriceCheckModalProps) {
  const { accessToken, currentUser, permissions, offlineAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'new' | 'history' | 'view'>('new');
  const [selectedSiteId, setSelectedSiteId] = useState(forcedSiteId ?? currentUser?.siteId ?? '');
  const [search, setSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDescription, setManualDescription] = useState('');
  const [manualQuantity, setManualQuantity] = useState('1');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [selectedCheck, setSelectedCheck] = useState<PriceCheck | null>(null);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const saveLockRef = useRef(false);

  const canCreate = permissions.includes('price_checks.create') || permissions.includes('sales.create');
  const canRead = permissions.includes('price_checks.read') || permissions.includes('sales.read');
  const canPrint = permissions.includes('price_checks.print') || canCreate || canRead;
  const hasServerSession = Boolean(accessToken) && !offlineAuthenticated;
  const isOnlineMode = hasServerSession && navigator.onLine;
  const siteLocked = Boolean(forcedSiteId || currentUser?.siteId);

  const sites = useQuery({
    queryKey: ['sites', 'price-checks-modal'],
    queryFn: () => sitesService.getAll().then((response) => response.data),
    enabled: isOpen && !siteLocked,
  });

  const quotes = useQuery({
    queryKey: ['price-check-quotes', selectedSiteId, search],
    queryFn: () => priceChecksService.searchArticles({ siteId: selectedSiteId, search }).then((response) => response.data),
    enabled: isOpen && activeTab === 'new' && isOnlineMode && canCreate && Boolean(selectedSiteId) && search.trim().length >= 1,
  });

  const history = useQuery({
    queryKey: ['price-checks', historySearch],
    queryFn: () => priceChecksService.list({ search: historySearch || undefined }).then((response) => response.data),
    enabled: isOpen && activeTab === 'history' && isOnlineMode && canRead,
  });

  const draftTotalUsd = useMemo(() => roundMoney(lines.reduce((sum, line) => sum + lineSubtotal(line), 0)), [lines]);
  const draftTotalCdf = exchangeRate ? Math.round(draftTotalUsd * exchangeRate) : 0;
  const isDirty = lines.length > 0 || customerName.trim() || patientName.trim() || phone.trim() || notes.trim();
  const displaySiteName = siteName || sites.data?.find((site) => site.siteId === selectedSiteId)?.siteName || 'Site courant';

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('new');
    setSelectedSiteId(forcedSiteId ?? currentUser?.siteId ?? '');
    setSaveError('');
    window.setTimeout(() => searchInputRef.current?.focus(), 80);
  }, [currentUser?.siteId, forcedSiteId, isOpen]);

  useEffect(() => {
    if (!isOpen || !isOnlineMode) return;
    settingsService.getExchangeRate()
      .then((response) => {
        const rate = Number(response.data.rate);
        setExchangeRate(Number.isFinite(rate) && rate > 0 ? rate : null);
      })
      .catch(() => setExchangeRate(null));
  }, [isOpen, isOnlineMode]);

  useEffect(() => {
    if (!isOpen) return;
    function handleModalKeys(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeSafely();
        return;
      }
      if (event.key >= 'F2' && event.key <= 'F8') {
        event.stopPropagation();
      }
    }
    window.addEventListener('keydown', handleModalKeys, true);
    return () => window.removeEventListener('keydown', handleModalKeys, true);
  }, [isOpen, isDirty]);

  const createMutation = useMutation({
    mutationFn: () => priceChecksService.create({
      siteId: selectedSiteId,
      customerName: customerName.trim() || null,
      patientName: patientName.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
      items: lines.map((line) => ({
        articleId: line.articleId,
        manualDescription: line.manualDescription,
        requestedQuantity: line.requestedQuantity,
      })),
    }).then((response) => response.data),
    onSuccess: (created) => {
      setSelectedCheck(created);
      setActiveTab('view');
      queryClient.invalidateQueries({ queryKey: ['price-checks'] });
    },
  });

  if (!isOpen) return null;

  function resetDraft() {
    setSearch('');
    setCustomerName('');
    setPatientName('');
    setPhone('');
    setNotes('');
    setManualDescription('');
    setManualQuantity('1');
    setManualOpen(false);
    setLines([]);
    setSelectedCheck(null);
    setSaveError('');
    saveLockRef.current = false;
    setSaving(false);
    setActiveTab('new');
    window.setTimeout(() => searchInputRef.current?.focus(), 60);
  }

  function closeSafely() {
    if (activeTab === 'new' && isDirty && !window.confirm('Fermer cette verification sans enregistrer ?')) return;
    onClose();
  }

  function addQuote(quote: PriceCheckQuote) {
    setLines((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        articleId: quote.articleId,
        articleCode: quote.articleCode,
        articleName: quote.articleName,
        unitName: quote.unitName,
        unitPrice: quote.unitPrice,
        requestedQuantity: 1,
        availableQuantity: quote.availableQuantity,
        availabilityStatus: quote.availabilityStatus,
      },
    ]);
    setSearch('');
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function addManualLine() {
    const quantity = Number(manualQuantity || 0);
    if (!manualDescription.trim() || !Number.isFinite(quantity) || quantity <= 0) return;
    setLines((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        articleId: null,
        articleCode: null,
        articleName: manualDescription.trim(),
        unitName: null,
        unitPrice: null,
        requestedQuantity: quantity,
        availableQuantity: 0,
        availabilityStatus: 'UNREFERENCED',
        manualDescription: manualDescription.trim(),
      },
    ]);
    setManualDescription('');
    setManualQuantity('1');
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function updateQuantity(key: string, value: string) {
    const quantity = Number(value || 0);
    setLines((current) => current.map((line) => {
      if (line.key !== key) return line;
      const status = line.articleId
        ? line.availableQuantity <= 0
          ? 'UNAVAILABLE'
          : line.availableQuantity < quantity
            ? 'INSUFFICIENT_STOCK'
            : 'AVAILABLE'
        : 'UNREFERENCED';
      return { ...line, requestedQuantity: quantity, availabilityStatus: status };
    }));
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    const firstQuote = quotes.data?.[0];
    if (!firstQuote) return;
    event.preventDefault();
    addQuote(firstQuote);
  }

  async function savePriceCheck(printAfterSave: boolean) {
    if (!selectedSiteId || lines.length === 0 || !isOnlineMode || saveLockRef.current) return;
    saveLockRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const created = await createMutation.mutateAsync();
      if (printAfterSave) {
        window.setTimeout(() => printCheck(created), 120);
      }
    } catch {
      saveLockRef.current = false;
      setSaveError('Impossible d enregistrer cette verification.');
    } finally {
      setSaving(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void savePriceCheck(false);
  }

  return (
    <div className="price-check-modal-backdrop" role="dialog" aria-modal="true" aria-label="Verification de prix">
      <section className="price-check-modal-shell">
        <header className="price-check-modal-header">
          <div>
            <span className="breadcrumb">Estimation indicative pour ordonnance client</span>
            <h2>Verification de prix</h2>
            <p>{displaySiteName} - {new Date().toLocaleString('fr-FR')}{selectedCheck ? ` - ${selectedCheck.checkNumber}` : ''}</p>
          </div>
          <div className="price-check-modal-header-actions">
            <button className={`ghost-button compact-button ${activeTab === 'history' ? 'is-active' : ''}`} type="button" onClick={() => setActiveTab('history')} disabled={!canRead || !isOnlineMode}>
              Historique
            </button>
            <button className={`ghost-button compact-button ${activeTab === 'new' ? 'is-active' : ''}`} type="button" onClick={() => setActiveTab('new')}>
              Nouvelle verification
            </button>
            <button className="icon-button" type="button" aria-label="Fermer" onClick={closeSafely}>X</button>
          </div>
        </header>

        <main className="price-check-modal-body">
          {!isOnlineMode ? (
            <div className="offline-seller-banner is-warning">
              Mode hors ligne - la recherche locale reste disponible dans le POS, mais la verification ne peut pas encore etre enregistree.
            </div>
          ) : null}

          {activeTab === 'new' ? (
            <form className="price-check-modal-form" onSubmit={submit}>
              <div className="price-check-identity-row">
                <label>
                  <span>Site</span>
                  {siteLocked ? (
                    <input className="input compact-input" value={displaySiteName} readOnly />
                  ) : (
                    <select className="input compact-input" value={selectedSiteId} onChange={(event) => setSelectedSiteId(event.target.value)} required>
                      <option value="">Selectionner un site</option>
                      {sites.data?.map((site) => (
                        <option key={site.siteId} value={site.siteId}>{site.siteName}</option>
                      ))}
                    </select>
                  )}
                </label>
                <label><span>Client</span><input className="input compact-input" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Facultatif" /></label>
                <label><span>Patient</span><input className="input compact-input" value={patientName} onChange={(event) => setPatientName(event.target.value)} placeholder="Facultatif" /></label>
                <label><span>Telephone</span><input className="input compact-input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Facultatif" /></label>
              </div>

              <div className="price-check-search-zone">
                <label>
                  <span>Rechercher / scanner un produit</span>
                  <input
                    ref={searchInputRef}
                    className="input compact-input"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Code, code-barres ou nom produit"
                    disabled={!selectedSiteId || !canCreate || !isOnlineMode}
                  />
                </label>
                {quotes.data && search.trim() ? (
                  <div className="price-check-results-dropdown">
                    {quotes.data.map((quote) => (
                      <button type="button" key={quote.articleId} className="price-check-result" onClick={() => addQuote(quote)}>
                        <strong>{quote.articleName}</strong>
                        <span>{quote.articleCode}</span>
                        <span>{formatMoney(quote.unitPrice ?? 0, 'USD')}</span>
                        <span>{availabilityLabel(quote)}</span>
                      </button>
                    ))}
                    {quotes.data.length === 0 ? <p className="muted">Aucun article trouve.</p> : null}
                  </div>
                ) : null}
              </div>

              <div className="price-check-table-panel">
                <div className="table-wrap">
                  <table className="data-table compact-table">
                    <thead><tr><th>Produit</th><th>Qte</th><th>Unite</th><th>PU</th><th>Total</th><th>Disponibilite</th><th /></tr></thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.key}>
                          <td><strong>{line.articleName}</strong><div className="muted">{line.articleCode ?? 'Non reference'}</div></td>
                          <td><input className="input compact-input price-check-qty" type="number" min="0.001" step="0.001" value={line.requestedQuantity} onChange={(event) => updateQuantity(line.key, event.target.value)} /></td>
                          <td>{line.unitName ?? '-'}</td>
                          <td>{line.unitPrice === null ? '-' : formatMoney(line.unitPrice, 'USD')}</td>
                          <td>{formatMoney(lineSubtotal(line), 'USD')}</td>
                          <td>{availabilityLabels[line.availabilityStatus]}{line.availabilityStatus === 'INSUFFICIENT_STOCK' ? ` (${line.availableQuantity} / ${line.requestedQuantity})` : ''}</td>
                          <td><button className="ghost-button compact-button" type="button" onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}>Retirer</button></td>
                        </tr>
                      ))}
                      {lines.length === 0 ? <tr><td colSpan={7} className="muted">Scannez ou recherchez les produits de l ordonnance.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <details className="price-check-manual-panel" open={manualOpen} onToggle={(event) => setManualOpen(event.currentTarget.open)}>
                <summary>+ Ajouter un produit non reference</summary>
                <div className="price-check-manual-line">
                  <input className="input compact-input" value={manualDescription} onChange={(event) => setManualDescription(event.target.value)} placeholder="Produit non reference sur l ordonnance" />
                  <input className="input compact-input" type="number" min="0.001" step="0.001" value={manualQuantity} onChange={(event) => setManualQuantity(event.target.value)} />
                  <button className="ghost-button compact-button" type="button" onClick={addManualLine}>Ajouter</button>
                </div>
              </details>

              <textarea className="input compact-input" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Note facultative" />
              {saveError ? <p className="error-text">{saveError}</p> : null}
            </form>
          ) : null}

          {activeTab === 'history' ? (
            <section className="price-check-history-modal">
              <input className="input compact-input" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Reference, client, patient, telephone" />
              <div className="price-check-history-list">
                {history.data?.items.map((check) => (
                  <button type="button" key={check.priceCheckId} className="price-check-history-item" onClick={() => priceChecksService.getById(check.priceCheckId).then((response) => { setSelectedCheck(response.data); setActiveTab('view'); })}>
                    <strong>{check.checkNumber}</strong>
                    <span>{new Date(check.createdAt).toLocaleString('fr-FR')}</span>
                    <span>{check.customerName || check.patientName || 'Client comptoir'}</span>
                    <span>{formatMoney(check.totalUsd, 'USD')}</span>
                  </button>
                ))}
                {history.data?.items.length === 0 ? <p className="muted">Aucune verification trouvee.</p> : null}
              </div>
            </section>
          ) : null}

          {activeTab === 'view' && selectedCheck ? (
            <section className="price-check-saved-view">
              <div className="offline-seller-banner">
                Verification enregistree : <strong>{selectedCheck.checkNumber}</strong>
              </div>
              <PriceCheckDocument check={selectedCheck} />
            </section>
          ) : null}
        </main>

        <footer className="price-check-modal-footer">
          {activeTab === 'new' ? (
            <>
              <button className="ghost-button compact-button" type="button" onClick={closeSafely}>Fermer</button>
              <div className="price-check-total-box">
                <span>Total USD</span>
                <strong>{formatMoney(draftTotalUsd, 'USD')}</strong>
                <span>Total FC</span>
                <strong>{exchangeRate ? `${draftTotalCdf.toLocaleString('fr-FR')} FC` : '-'}</strong>
                <small>{exchangeRate ? `Taux 1 USD = ${exchangeRate.toLocaleString('fr-FR')} FC` : 'Taux non disponible'}</small>
              </div>
              <button className="ghost-button compact-button" type="button" onClick={() => void savePriceCheck(false)} disabled={!canCreate || !selectedSiteId || lines.length === 0 || saving || !isOnlineMode}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button className="button compact-button" type="button" onClick={() => void savePriceCheck(true)} disabled={!canCreate || !selectedSiteId || lines.length === 0 || saving || !isOnlineMode}>
                Enregistrer et imprimer
              </button>
            </>
          ) : activeTab === 'view' && selectedCheck ? (
            <>
              <button className="ghost-button compact-button" type="button" onClick={closeSafely}>Fermer</button>
              {canPrint ? <button className="ghost-button compact-button" type="button" onClick={() => printCheck(selectedCheck)}>Imprimer</button> : null}
              <button className="button compact-button" type="button" onClick={resetDraft}>Nouvelle verification</button>
            </>
          ) : (
            <button className="ghost-button compact-button" type="button" onClick={closeSafely}>Fermer</button>
          )}
        </footer>
      </section>
    </div>
  );
}

function PriceCheckDocument({ check }: { check: PriceCheck }) {
  return (
    <div className="price-check-document">
      <p><strong>PharmaERP - Verification de prix</strong></p>
      <p>{check.siteName ?? 'Site'} - {new Date(check.createdAt).toLocaleString('fr-FR')} - {check.checkNumber}</p>
      <p>Client: {check.customerName || '-'} | Patient: {check.patientName || '-'} | Tel: {check.phone || '-'}</p>
      <table className="data-table compact-table">
        <thead><tr><th>Produit</th><th>Qte</th><th>Unite</th><th>PU</th><th>Total</th><th>Disponibilite</th></tr></thead>
        <tbody>
          {check.items.map((item) => (
            <tr key={item.priceCheckItemId}>
              <td><strong>{item.articleName}</strong><div className="muted">{item.articleCode ?? 'Non reference'}</div></td>
              <td>{item.requestedQuantity}</td>
              <td>{item.unitName ?? '-'}</td>
              <td>{item.unitPrice === null ? '-' : formatMoney(item.unitPrice, 'USD')}</td>
              <td>{formatMoney(item.subtotal, 'USD')}</td>
              <td>{availabilityLabels[item.availabilityStatus]}{item.availabilityStatus === 'INSUFFICIENT_STOCK' ? ` (${item.availableQuantity} / ${item.requestedQuantity})` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p><strong>Total estimatif USD:</strong> {formatMoney(check.totalUsd, 'USD')}</p>
      <p><strong>Total estimatif FC:</strong> {Math.round(check.totalCdf).toLocaleString('fr-FR')} FC</p>
      <p><strong>Taux utilise:</strong> 1 USD = {Number(check.exchangeRate).toLocaleString('fr-FR')} FC</p>
      <p className="price-check-disclaimer">Document informatif - ne constitue pas une facture ni une reservation de stock. Prix et disponibilite constates au moment de l etablissement.</p>
    </div>
  );
}

function printCheck(check: PriceCheck) {
  const popup = window.open('', '_blank', 'width=900,height=700');
  if (!popup) return;
  popup.document.write(buildPrintDocument(check));
  popup.document.close();
  popup.focus();
  popup.print();
}

function buildPrintDocument(check: PriceCheck) {
  return `<!doctype html><html><head><title>${check.checkNumber}</title><style>
body{font-family:Arial,sans-serif;color:#111827;margin:24px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #d1d5db;padding:8px;text-align:left}h1{margin:0 0 4px}.muted{color:#6b7280}.total{font-size:18px;font-weight:700}.disclaimer{border-top:1px solid #d1d5db;margin-top:18px;padding-top:12px;font-size:12px}
</style></head><body>
<h1>PHARMAERP</h1><h2>VERIFICATION DE PRIX</h2>
<p>${escapeHtml(check.siteName ?? 'Site')} - ${new Date(check.createdAt).toLocaleString('fr-FR')} - ${escapeHtml(check.checkNumber)}</p>
<p>Client: ${escapeHtml(check.customerName || '-')} | Patient: ${escapeHtml(check.patientName || '-')} | Tel: ${escapeHtml(check.phone || '-')}</p>
<table><thead><tr><th>Produit</th><th>Qte</th><th>Unite</th><th>PU</th><th>Total</th><th>Disponibilite</th></tr></thead><tbody>
${check.items.map((item) => `<tr><td>${escapeHtml(item.articleName)}<br><span class="muted">${escapeHtml(item.articleCode || 'Non reference')}</span></td><td>${item.requestedQuantity}</td><td>${escapeHtml(item.unitName || '-')}</td><td>${item.unitPrice === null ? '-' : formatMoney(item.unitPrice, 'USD')}</td><td>${formatMoney(item.subtotal, 'USD')}</td><td>${availabilityLabels[item.availabilityStatus]}${item.availabilityStatus === 'INSUFFICIENT_STOCK' ? ` (${item.availableQuantity} / ${item.requestedQuantity})` : ''}</td></tr>`).join('')}
</tbody></table>
<p class="total">TOTAL ESTIMATIF USD: ${formatMoney(check.totalUsd, 'USD')}</p>
<p class="total">TOTAL ESTIMATIF FC: ${Math.round(check.totalCdf).toLocaleString('fr-FR')} FC</p>
<p>Taux utilise: 1 USD = ${Number(check.exchangeRate).toLocaleString('fr-FR')} FC</p>
<p class="disclaimer">Document informatif - ne constitue pas une facture ni une reservation de stock. Prix et disponibilite constates au moment de l etablissement.</p>
</body></html>`;
}

function availabilityLabel(quote: PriceCheckQuote) {
  if (quote.availabilityStatus === 'INSUFFICIENT_STOCK') return `Stock insuffisant (${quote.availableQuantity})`;
  return availabilityLabels[quote.availabilityStatus];
}

function lineSubtotal(line: DraftLine) {
  if (line.unitPrice === null) return 0;
  return roundMoney(line.unitPrice * line.requestedQuantity);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char] ?? char);
}
