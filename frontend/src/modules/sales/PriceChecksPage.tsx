import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PriceCheck, PriceCheckQuote, priceChecksService } from '../../services/priceChecks.service';
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

const availabilityLabels: Record<string, string> = {
  AVAILABLE: 'Disponible',
  INSUFFICIENT_STOCK: 'Stock insuffisant',
  UNAVAILABLE: 'Indisponible',
  UNREFERENCED: 'Non reference',
};

export function PriceChecksPage() {
  const { currentUser, permissions } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isOfflineShell = location.pathname.startsWith('/offline/');
  const [siteId, setSiteId] = useState(currentUser?.siteId ?? '');
  const [search, setSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualQuantity, setManualQuantity] = useState('1');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [selectedCheck, setSelectedCheck] = useState<PriceCheck | null>(null);

  const canCreate = permissions.includes('price_checks.create') || permissions.includes('sales.create');
  const canRead = permissions.includes('price_checks.read') || permissions.includes('sales.read');
  const canPrint = permissions.includes('price_checks.print') || canCreate || canRead;

  const sites = useQuery({
    queryKey: ['sites', 'price-checks'],
    queryFn: () => sitesService.getAll().then((response) => response.data),
    enabled: !currentUser?.siteId,
  });

  const quotes = useQuery({
    queryKey: ['price-check-quotes', siteId, search],
    queryFn: () => priceChecksService.searchArticles({ siteId, search }).then((response) => response.data),
    enabled: canCreate && Boolean(siteId) && search.trim().length >= 1,
  });

  const history = useQuery({
    queryKey: ['price-checks', historySearch],
    queryFn: () => priceChecksService.list({ search: historySearch || undefined }).then((response) => response.data),
    enabled: canRead,
  });

  const createMutation = useMutation({
    mutationFn: () => priceChecksService.create({
      siteId,
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
      setLines([]);
      setSearch('');
      setManualDescription('');
      setManualQuantity('1');
      queryClient.invalidateQueries({ queryKey: ['price-checks'] });
    },
  });

  const draftTotals = useMemo(() => {
    const totalUsd = roundMoney(lines.reduce((sum, line) => sum + lineSubtotal(line), 0));
    return { totalUsd };
  }, [lines]);

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

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!siteId || lines.length === 0 || createMutation.isPending) return;
    createMutation.mutate();
  }

  function printCheck(check: PriceCheck) {
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) return;
    popup.document.write(buildPrintDocument(check));
    popup.document.close();
    popup.focus();
    popup.print();
  }

  return (
    <section className="price-check-page">
      <header className="page-heading">
        <div>
          <span className="breadcrumb">{isOfflineShell ? 'POS' : 'Ventes'}</span>
          <h1>Verification de prix</h1>
          <p>Bordereau informatif pour ordonnance client, sans vente, sans paiement et sans reservation de stock.</p>
        </div>
        <div className="page-heading-actions">
          {isOfflineShell ? (
            <Link className="ghost-button compact-button" to="/pos">
              Retour POS
            </Link>
          ) : null}
        </div>
      </header>

      <div className="price-check-layout">
        <form className="card compact-card price-check-editor" onSubmit={submit}>
          <div className="offline-panel-heading">
            <h3>Nouvelle verification</h3>
          </div>
          <div className="detail-grid compact-detail-grid">
            <label>
              <span>Site</span>
              {currentUser?.siteId ? (
                <input className="input compact-input" value={siteId} readOnly />
              ) : (
                <select className="input compact-input" value={siteId} onChange={(event) => setSiteId(event.target.value)} required>
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

          <label>
            <span>Rechercher / scanner un produit</span>
            <input className="input compact-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Code, code-barres ou nom produit" disabled={!siteId || !canCreate} />
          </label>
          {quotes.data && search.trim() ? (
            <div className="price-check-results">
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

          <div className="price-check-manual-line">
            <input className="input compact-input" value={manualDescription} onChange={(event) => setManualDescription(event.target.value)} placeholder="Produit non reference sur l ordonnance" />
            <input className="input compact-input" type="number" min="0.001" step="0.001" value={manualQuantity} onChange={(event) => setManualQuantity(event.target.value)} />
            <button className="ghost-button compact-button" type="button" onClick={addManualLine}>Ajouter manuel</button>
          </div>

          <div className="table-wrap">
            <table className="data-table compact-table">
              <thead><tr><th>Produit</th><th>Qte</th><th>PU</th><th>Total</th><th>Disponibilite</th><th /></tr></thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.key}>
                    <td><strong>{line.articleName}</strong><div className="muted">{line.articleCode ?? 'Non reference'} {line.unitName ? `- ${line.unitName}` : ''}</div></td>
                    <td><input className="input compact-input price-check-qty" type="number" min="0.001" step="0.001" value={line.requestedQuantity} onChange={(event) => updateQuantity(line.key, event.target.value)} /></td>
                    <td>{line.unitPrice === null ? '-' : formatMoney(line.unitPrice, 'USD')}</td>
                    <td>{formatMoney(lineSubtotal(line), 'USD')}</td>
                    <td>{availabilityLabels[line.availabilityStatus]}{line.availabilityStatus === 'INSUFFICIENT_STOCK' ? ` (${line.availableQuantity} / ${line.requestedQuantity})` : ''}</td>
                    <td><button className="ghost-button compact-button" type="button" onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}>Retirer</button></td>
                  </tr>
                ))}
                {lines.length === 0 ? <tr><td colSpan={6} className="muted">Ajoutez les produits de l ordonnance.</td></tr> : null}
              </tbody>
            </table>
          </div>

          <textarea className="input compact-input" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Note facultative" />
          <div className="price-check-total-row">
            <strong>Total estimatif USD: {formatMoney(draftTotals.totalUsd, 'USD')}</strong>
            <button className="button compact-button" type="submit" disabled={!canCreate || !siteId || lines.length === 0 || createMutation.isPending}>
              Enregistrer la verification
            </button>
          </div>
          {createMutation.isError ? <p className="error-text">Impossible d enregistrer cette verification.</p> : null}
        </form>

        <aside className="card compact-card price-check-history">
          <div className="offline-panel-heading">
            <h3>Historique</h3>
          </div>
          <input className="input compact-input" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Reference, client, telephone" />
          <div className="price-check-history-list">
            {history.data?.items.map((check) => (
              <button type="button" key={check.priceCheckId} className="price-check-history-item" onClick={() => priceChecksService.getById(check.priceCheckId).then((response) => setSelectedCheck(response.data))}>
                <strong>{check.checkNumber}</strong>
                <span>{new Date(check.createdAt).toLocaleString('fr-FR')}</span>
                <span>{check.customerName || check.patientName || 'Client comptoir'}</span>
                <span>{formatMoney(check.totalUsd, 'USD')}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>

      {selectedCheck ? (
        <section className="card compact-card price-check-preview">
          <div className="page-heading">
            <div>
              <span className="breadcrumb">Bordereau de prix</span>
              <h2>{selectedCheck.checkNumber}</h2>
            </div>
            <div className="page-heading-actions">
              {canPrint ? <button className="button compact-button" type="button" onClick={() => printCheck(selectedCheck)}>Imprimer / PDF</button> : null}
            </div>
          </div>
          <PriceCheckDocument check={selectedCheck} />
        </section>
      ) : null}
    </section>
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

function buildPrintDocument(check: PriceCheck) {
  return `<!doctype html><html><head><title>${check.checkNumber}</title><style>
body{font-family:Arial,sans-serif;color:#111827;margin:24px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #d1d5db;padding:8px;text-align:left}h1{margin:0 0 4px}.muted{color:#6b7280}.total{font-size:18px;font-weight:700}.disclaimer{border-top:1px solid #d1d5db;margin-top:18px;padding-top:12px;font-size:12px}
</style></head><body>
<h1>PHARMAERP</h1><h2>VERIFICATION DE PRIX</h2>
<p>${check.siteName ?? 'Site'} - ${new Date(check.createdAt).toLocaleString('fr-FR')} - ${check.checkNumber}</p>
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
