import { FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { FloatingSearchPopover } from '../../components/FloatingSearchPopover';
import { apiErrorMessage } from '../../services/apiError';
import { codeGeneratorService } from '../../services/codeGenerator.service';
import { sitesService } from '../../services/sites.service';
import { Stock, stocksService } from '../../services/stocks.service';
import { transfersService } from '../../services/transfers.service';
import { formatDate } from '../../utils/date';

type TransferForm = { transferNumber: string; fromSiteId: string; toSiteId: string; transferDate: string; notes: string };
type TransferDraftLine = { id: string; stockId: string; articleId: string; articleQuery: string; lotId: string; lotNumber: string; quantity: string; available: number; expiryDate: string };

const initialForm = (): TransferForm => ({ transferNumber: '', fromSiteId: '', toSiteId: '', transferDate: new Date().toISOString().slice(0, 10), notes: '' });
const newLine = (): TransferDraftLine => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, stockId: '', articleId: '', articleQuery: '', lotId: '', lotNumber: '', quantity: '1', available: 0, expiryDate: '' });

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field-block compact-field"><span>{label}</span>{children}</label>;
}

export function NewTransferPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<TransferForm>(initialForm);
  const [lines, setLines] = useState<TransferDraftLine[]>([]);
  const [quickLine, setQuickLine] = useState<TransferDraftLine>(newLine());
  const [activePicker, setActivePicker] = useState('');
  const [selectedLineId, setSelectedLineId] = useState('');
  const [clientError, setClientError] = useState('');

  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const stocks = useQuery({ queryKey: ['stocks', 'transfer-new'], queryFn: async () => (await stocksService.getAll()).data });
  const nextCode = useQuery({ queryKey: ['next-code', 'transfers'], queryFn: async () => (await codeGeneratorService.next('transfers')).data.code });

  useEffect(() => { if (!form.transferNumber && nextCode.data) setForm((current) => ({ ...current, transferNumber: nextCode.data ?? '' })); }, [form.transferNumber, nextCode.data]);

  const currentSource = sites.data?.find((site) => site.siteId === form.fromSiteId);
  const currentDestination = sites.data?.find((site) => site.siteId === form.toSiteId);
  const availableStocks = useMemo(() => (stocks.data ?? []).filter((stock) => stock.siteId === form.fromSiteId && Number(stock.quantityAvailable) > 0), [form.fromSiteId, stocks.data]);
  const committedLines = useMemo(() => lines.filter((line) => line.articleId && Number(line.quantity) > 0), [lines]);
  const quickHasValues = Boolean(quickLine.articleId || quickLine.articleQuery || quickLine.quantity);
  const totalQuantity = useMemo(() => [...committedLines, ...(quickHasValues ? [quickLine] : [])].reduce((sum, line) => sum + Number(line.quantity || 0), 0), [committedLines, quickHasValues, quickLine]);
  const hasErrors = committedLines.length === 0 || committedLines.some((line) => lineError(line));

  const save = useMutation({
    mutationFn: async (validateNow: boolean) => {
      const transfer = (await transfersService.create({
        transferNumber: form.transferNumber.trim() || undefined,
        fromSiteId: form.fromSiteId,
        toSiteId: form.toSiteId,
        transferDate: form.transferDate,
        notes: form.notes || undefined,
      })).data;
      for (const line of committedLines) {
        await transfersService.addItem(transfer.transferId, {
          articleId: line.articleId,
          lotId: line.lotId,
          quantity: Number(line.quantity),
        });
      }
      if (validateNow) return (await transfersService.validate(transfer.transferId)).data;
      return transfer;
    },
    onSuccess: (transfer) => navigate(`/transfers/${transfer.transferId}`),
  });

  function update<K extends keyof TransferForm>(key: K, value: TransferForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'fromSiteId') {
      setLines([]);
      setQuickLine(newLine());
    }
  }
  function updateLine(id: string, patch: Partial<TransferDraftLine>) { setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line)); }
  function updateQuickLine(patch: Partial<TransferDraftLine>) { setQuickLine((current) => ({ ...current, ...patch })); }
  function stockSuggestions(line: TransferDraftLine) {
    const query = line.articleQuery.trim().toLowerCase();
    if (!query) return availableStocks.slice(0, 80);
    return availableStocks.filter((stock) => [stock.articleCode, stock.commercialName, stock.lotNumber].some((value) => String(value ?? '').toLowerCase().includes(query)));
  }
  function selectStock(lineId: string, stock: Stock) {
    const patch = { stockId: stock.stockId, articleId: stock.articleId, articleQuery: `${stock.articleCode ?? ''} - ${stock.commercialName ?? ''} / ${stock.lotNumber}`, lotId: stock.lotId, lotNumber: stock.lotNumber, available: Number(stock.quantityAvailable), expiryDate: stock.expiryDate };
    if (lineId === quickLine.id) updateQuickLine(patch); else updateLine(lineId, patch);
    setActivePicker('');
  }
  function commitQuickLine() {
    const error = lineError(quickLine);
    if (error) { setClientError(`Ligne rapide: ${error}`); return; }
    setLines((current) => [...current, quickLine]);
    setQuickLine(newLine());
    setClientError('');
  }
  function addLine() {
    const line = newLine();
    setLines((current) => [...current, line]);
    setSelectedLineId(line.id);
  }
  function removeLine(id: string) { setLines((current) => current.filter((line) => line.id !== id)); }
  function handleKeys(event: KeyboardEvent<HTMLElement>, lineId: string) {
    if (event.ctrlKey && event.key.toLowerCase() === 'l') { event.preventDefault(); addLine(); return; }
    if (event.key === 'Enter' && lineId === quickLine.id) { event.preventDefault(); commitQuickLine(); }
    if (event.key === 'Escape') { event.preventDefault(); navigate('/transfers'); }
  }
  function submit(event: FormEvent<HTMLFormElement>, validateNow = false) {
    event.preventDefault();
    if (form.fromSiteId === form.toSiteId) { setClientError('Le site source doit etre different du site destination.'); return; }
    const firstError = committedLines.map(lineError).find(Boolean);
    if (committedLines.length === 0 || firstError) { setClientError(firstError || 'Ajoutez au moins une ligne transfert.'); return; }
    setClientError('');
    save.mutate(validateNow);
  }

  return (
    <form className="purchase-page transfer-page purchase-erp-window" onSubmit={(event) => submit(event, false)}>
      <div className="breadcrumb"><Link to="/transfers">Transferts</Link><span>&gt;</span><strong>Nouveau Transfert</strong></div>
      {(clientError || save.isError) && <p className="form-error">{clientError || apiErrorMessage(save.error)}</p>}
      <div className="purchase-sticky-header transfer-sticky-header">
        <div><span>Code</span><strong>{form.transferNumber || 'TRF-...'}</strong></div>
        <div><span>Source</span><strong>{currentSource?.siteName ?? '-'}</strong></div>
        <div><span>Destination</span><strong>{currentDestination?.siteName ?? '-'}</strong></div>
        <div><span>Date</span><strong>{formatDate(form.transferDate)}</strong></div>
        <div><span>Quantite</span><strong>{totalQuantity}</strong></div>
        <div><span>Statut</span><strong><span className="badge badge-warning">DRAFT</span></strong></div>
      </div>
      <section className="card compact-card">
        <div className="form-grid transfer-fields">
          <Field label="Code"><input className="input compact-input" value={form.transferNumber} placeholder="TRF-000001" onChange={(event) => update('transferNumber', event.target.value)} required /></Field>
          <Field label="Source"><select className="input compact-input" value={form.fromSiteId} onChange={(event) => update('fromSiteId', event.target.value)} required><option value="">Site source</option>{(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}</select></Field>
          <Field label="Destination"><select className="input compact-input" value={form.toSiteId} onChange={(event) => update('toSiteId', event.target.value)} required><option value="">Site destination</option>{(sites.data ?? []).map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}</select></Field>
          <Field label="Date"><input className="input compact-input" type="date" value={form.transferDate} onChange={(event) => update('transferDate', event.target.value)} required /></Field>
          <Field label="Commentaire"><input className="input compact-input" value={form.notes} placeholder="Optionnel" onChange={(event) => update('notes', event.target.value)} /></Field>
        </div>
      </section>
      <section className="card compact-card purchase-page-grid">
        <div className="erp-toolbar compact-toolbar purchase-toolbar">
          <button className="ghost-button compact-button" type="button" onClick={addLine}>+ Ajouter ligne</button>
        </div>
        <div className="table-wrap erp-grid-wrap transfer-grid-wrap">
          <table className="data-table transfer-lines-table erp-grid compact-grid">
            <thead><tr><th>Article / Lot</th><th>Lot</th><th>Expiration</th><th>Disponible</th><th>Qte</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {lines.map((line, index) => <TransferLineRow key={line.id} activePicker={activePicker} handleKeys={handleKeys} index={index} line={line} removeLine={removeLine} selectStock={selectStock} selected={selectedLineId === line.id} setActivePicker={setActivePicker} setSelectedLineId={setSelectedLineId} suggestions={stockSuggestions(line)} updateLine={(patch) => updateLine(line.id, patch)} />)}
              <TransferLineRow activePicker={activePicker} handleKeys={handleKeys} index={lines.length} line={quickLine} quick commitQuickLine={commitQuickLine} removeLine={() => setQuickLine(newLine())} selectStock={selectStock} selected={false} setActivePicker={setActivePicker} setSelectedLineId={setSelectedLineId} suggestions={stockSuggestions(quickLine)} updateLine={updateQuickLine} />
            </tbody>
          </table>
        </div>
      </section>
      <section className="purchase-totals compact-summary transfer-summary">
        <div className="form-summary"><span>Lignes</span><strong>{committedLines.length + (quickHasValues ? 1 : 0)}</strong></div>
        <div className="form-summary"><span>Quantite totale</span><strong>{totalQuantity}</strong></div>
        <div className="form-summary"><span>Source</span><strong>{currentSource?.siteName ?? '-'}</strong></div>
        <div className="form-summary"><span>Destination</span><strong>{currentDestination?.siteName ?? '-'}</strong></div>
      </section>
      <div className="page-actions">
        <Link className="ghost-button compact-button" to="/transfers">Annuler</Link>
        <button className="button compact-button" disabled={save.isPending || sites.isLoading || stocks.isLoading || hasErrors}>Enregistrer Brouillon</button>
        <button className="button compact-button" type="button" disabled={save.isPending || sites.isLoading || stocks.isLoading || hasErrors} onClick={(event) => submit(event as unknown as FormEvent<HTMLFormElement>, true)}>Valider Transfert</button>
      </div>
    </form>
  );
}

function TransferLineRow({ activePicker, commitQuickLine, handleKeys, index, line, quick, removeLine, selectStock, selected, setActivePicker, setSelectedLineId, suggestions, updateLine }: {
  activePicker: string;
  commitQuickLine?: () => void;
  handleKeys: (event: KeyboardEvent<HTMLElement>, lineId: string) => void;
  index: number;
  line: TransferDraftLine;
  quick?: boolean;
  removeLine: (id: string) => void;
  selectStock: (lineId: string, stock: Stock) => void;
  selected: boolean;
  setActivePicker: (id: string) => void;
  setSelectedLineId: (id: string) => void;
  suggestions: Stock[];
  updateLine: (patch: Partial<TransferDraftLine>) => void;
}) {
  const error = lineError(line);
  return <tr className={`erp-grid-row ${selected ? 'selected' : ''}`} onClick={() => setSelectedLineId(line.id)}>
    <td className="autocomplete-cell">
      <FloatingSearchPopover
        columns={[
          { header: 'Code', render: (stock) => stock.articleCode ?? '-' },
          { header: 'Article', render: (stock) => <strong>{stock.commercialName ?? '-'}</strong> },
          { header: 'Lot', render: (stock) => stock.lotNumber },
          { header: 'Expiration', render: (stock) => formatDate(stock.expiryDate) },
          { header: 'Stock', render: (stock) => stock.quantityAvailable },
          { header: 'Site', render: (stock) => stock.siteName ?? '-' },
        ]}
        dataGridCell={`transfer-${index}-0`}
        getKey={(stock) => stock.stockId}
        onChange={(value) => updateLine({ articleQuery: value, articleId: '', lotId: '', lotNumber: '', available: 0, expiryDate: '' })}
        onClose={() => setActivePicker('')}
        onFallbackKeyDown={(event) => handleKeys(event, line.id)}
        onOpen={() => { setSelectedLineId(line.id); setActivePicker(line.id); }}
        onSelect={(stock) => selectStock(line.id, stock)}
        open={activePicker === line.id}
        placeholder="Code, article, lot..."
        searchPlaceholder="Rechercher (code, article, lot...)"
        suggestions={suggestions}
        value={line.articleQuery}
      />
    </td>
    <td><strong>{line.lotNumber || '-'}</strong></td>
    <td>{line.expiryDate ? formatDate(line.expiryDate) : '-'}</td>
    <td className="quantity-cell">{line.available || '-'}</td>
    <td><input className="input compact-input numeric-cell" type="number" min="0.001" step="0.001" value={line.quantity} onKeyDown={(event) => handleKeys(event, line.id)} onChange={(event) => updateLine({ quantity: event.target.value })} /></td>
    <td><span className={`badge compact-badge ${error ? 'badge-warning' : 'badge-success'}`}>{error ? 'A completer' : 'OK'}</span></td>
    <td>{quick ? <button aria-label="Ajouter la ligne" className="ghost-button compact-button row-action-button icon-only add" type="button" disabled={Boolean(error)} onClick={commitQuickLine}>+</button> : <button aria-label="Supprimer la ligne" className="ghost-button compact-button row-action-button icon-only danger" type="button" onClick={() => removeLine(line.id)}>X</button>}</td>
  </tr>;
}

function lineError(line: TransferDraftLine) {
  if (!line.articleId || !line.lotId) return 'Article ou lot manquant.';
  if (Number(line.quantity) <= 0) return 'Quantite invalide.';
  if (Number(line.quantity) > Number(line.available)) return 'Stock insuffisant.';
  return '';
}
