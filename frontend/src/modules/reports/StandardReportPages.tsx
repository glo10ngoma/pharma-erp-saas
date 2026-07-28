import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { apiErrorMessage } from '../../services/apiError';
import { cashService } from '../../services/cash.service';
import { insuranceService } from '../../services/insurance.service';
import { inventoriesService } from '../../services/inventories.service';
import { lotsService } from '../../services/lots.service';
import { purchasesService } from '../../services/purchases.service';
import { reportsService } from '../../services/reports.service';
import { salesService } from '../../services/sales.service';
import { stocksService } from '../../services/stocks.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import { ReportActions, ReportColumn, ReportFiltersBar, ReportKpiCards, ReportPageShell, ReportPreview } from './report-ui';

type ReportKind = 'sales' | 'purchases' | 'stocks' | 'inventories' | 'fefo' | 'cash' | 'insurance' | 'margins';
type ReportRow = Record<string, string | number | boolean | null | undefined>;

type ReportConfig = {
  kind: ReportKind;
  title: string;
  description: string;
  permission: string;
  filename: string;
  sheetName: string;
  columns: ReportColumn<ReportRow>[];
  load: () => Promise<ReportRow[]>;
  kpis: (rows: ReportRow[]) => { label: string; value: string; tone?: 'success' | 'warning' | 'danger' }[];
};

const configs: Record<ReportKind, ReportConfig> = {
  sales: {
    kind: 'sales',
    title: 'Rapport Ventes',
    description: 'Ventes CASH et ASSURANCE avec totaux, clients, sites et statuts.',
    permission: 'reports.sales',
    filename: 'rapport_ventes',
    sheetName: 'Ventes',
    load: async () => (await salesService.getAll()).data.map((sale) => ({
      date: sale.saleDate,
      number: sale.saleNumber,
      customer: sale.customerName || 'Client comptoir',
      site: sale.siteName || '-',
      type: sale.saleType,
      total: sale.totalAmount,
      patient: sale.customerPayableAmount,
      insurance: sale.insuranceCoveredAmount,
      currency: sale.currencyCode || 'USD',
      status: sale.status,
    })),
    columns: moneyColumns([
      ['date', 'Date'],
      ['number', 'N vente'],
      ['customer', 'Client'],
      ['site', 'Site'],
      ['type', 'Type'],
      ['total', 'Total', 'right'],
      ['patient', 'Part patient', 'right'],
      ['insurance', 'Part assurance', 'right'],
      ['status', 'Statut', 'center'],
    ]),
    kpis: (rows) => [
      { label: 'Ventes', value: String(rows.length) },
      { label: 'Total', value: money(sum(rows, 'total')) },
      { label: 'CASH', value: money(sum(rows.filter((row) => String(row.type).toUpperCase() === 'CASH'), 'total')) },
      { label: 'ASSURANCE', value: money(sum(rows.filter((row) => String(row.type).toUpperCase() === 'INSURANCE'), 'total')) },
    ],
  },
  purchases: {
    kind: 'purchases',
    title: 'Rapport Achats',
    description: 'Achats fournisseurs, sites, montants et statuts.',
    permission: 'purchases.read',
    filename: 'rapport_achats',
    sheetName: 'Achats',
    load: async () => (await purchasesService.getAll()).data.map((purchase) => ({
      date: purchase.purchaseDate,
      number: purchase.purchaseNumber,
      supplier: purchase.supplierName || '-',
      site: purchase.siteName || '-',
      currency: purchase.currencyCode || 'USD',
      exchangeRate: purchase.exchangeRate,
      total: purchase.totalAmount,
      status: purchase.status,
    })),
    columns: moneyColumns([
      ['date', 'Date'],
      ['number', 'N achat'],
      ['supplier', 'Fournisseur'],
      ['site', 'Site'],
      ['currency', 'Devise', 'center'],
      ['exchangeRate', 'Taux', 'right'],
      ['total', 'Total', 'right'],
      ['status', 'Statut', 'center'],
    ]),
    kpis: (rows) => [
      { label: 'Achats', value: String(rows.length) },
      { label: 'Total achats', value: money(sum(rows, 'total')) },
      { label: 'Brouillons', value: String(countStatus(rows, 'DRAFT')) },
      { label: 'Valides', value: String(countStatus(rows, 'VALIDATED')), tone: 'success' },
    ],
  },
  stocks: {
    kind: 'stocks',
    title: 'Rapport Stocks',
    description: 'Stock disponible par article, lot et site.',
    permission: 'reports.stock',
    filename: 'rapport_stocks',
    sheetName: 'Stocks',
    load: async () => (await stocksService.getAll()).data.map((stock) => ({
      article: `${stock.articleCode || ''} ${stock.commercialName || ''}`.trim(),
      site: stock.siteName || '-',
      lot: stock.lotNumber || '-',
      expiry: stock.expiryDate,
      available: stock.quantityAvailable,
      reserved: stock.quantityReserved,
      total: Number(stock.quantityAvailable || 0) + Number(stock.quantityReserved || 0),
      stockMin: stock.stockMin ?? 0,
      status: stockStatus(stock.quantityAvailable, stock.stockMin ?? 0),
    })),
    columns: [
      { key: 'article', label: 'Article' },
      { key: 'site', label: 'Site' },
      { key: 'lot', label: 'Lot' },
      { key: 'expiry', label: 'Expiration', render: (row) => formatDate(String(row.expiry || '')) },
      { key: 'available', label: 'Disponible', align: 'right' },
      { key: 'reserved', label: 'Reserve', align: 'right' },
      { key: 'total', label: 'Total', align: 'right' },
      { key: 'stockMin', label: 'Min', align: 'right' },
      { key: 'status', label: 'Statut', align: 'center' },
    ],
    kpis: (rows) => [
      { label: 'Lignes stock', value: String(rows.length) },
      { label: 'Quantite disponible', value: String(sum(rows, 'available')) },
      { label: 'Stocks faibles', value: String(rows.filter((row) => row.status === 'Faible').length), tone: 'warning' },
      { label: 'Ruptures', value: String(rows.filter((row) => row.status === 'Rupture').length), tone: 'danger' },
    ],
  },
  inventories: {
    kind: 'inventories',
    title: 'Rapport Inventaires',
    description: 'Inventaires physiques, statuts et ecarts saisis.',
    permission: 'inventories.read',
    filename: 'rapport_inventaires',
    sheetName: 'Inventaires',
    load: async () => (await inventoriesService.getAll()).data.map((inventory) => {
      const items = inventory.items || [];
      const gains = items.reduce((total, item) => total + Math.max(Number(item.differenceQuantity || 0), 0), 0);
      const losses = items.reduce((total, item) => total + Math.abs(Math.min(Number(item.differenceQuantity || 0), 0)), 0);
      return {
        date: inventory.inventoryDate,
        number: inventory.inventoryNumber,
        site: inventory.siteName || '-',
        type: inventory.inventoryType,
        lines: items.length,
        gains,
        losses,
        status: inventory.status,
        notes: inventory.notes || '',
      };
    }),
    columns: [
      { key: 'date', label: 'Date', render: (row) => formatDate(String(row.date || '')) },
      { key: 'number', label: 'N inventaire' },
      { key: 'site', label: 'Site' },
      { key: 'type', label: 'Type' },
      { key: 'lines', label: 'Lignes', align: 'right' },
      { key: 'gains', label: 'Ecarts +', align: 'right' },
      { key: 'losses', label: 'Ecarts -', align: 'right' },
      { key: 'status', label: 'Statut', align: 'center' },
    ],
    kpis: (rows) => [
      { label: 'Inventaires', value: String(rows.length) },
      { label: 'En cours', value: String(rows.filter((row) => row.status === 'IN_PROGRESS').length) },
      { label: 'Valides', value: String(countStatus(rows, 'VALIDATED')), tone: 'success' },
      { label: 'Ecarts nets', value: String(sum(rows, 'gains') - sum(rows, 'losses')) },
    ],
  },
  fefo: {
    kind: 'fefo',
    title: 'Rapport FEFO',
    description: 'Lots a prioriser selon expiration, blocage et quantite disponible.',
    permission: 'reports.expiry',
    filename: 'rapport_fefo',
    sheetName: 'FEFO',
    load: async () => {
      const [lots, stocks] = await Promise.all([lotsService.getAll(), stocksService.getAll()]);
      return lots.data.map((lot) => {
        const stockQuantity = stocks.data
          .filter((stock) => stock.lotId === lot.lotId)
          .reduce((total, stock) => total + Number(stock.quantityAvailable || 0), 0);
        const days = daysUntil(lot.expiryDate);
        return {
          priority: lot.isBlocked ? 'Bloque' : days < 0 ? 'Expire' : days <= 30 ? 'Rouge' : days <= 90 ? 'Orange' : 'Vert',
          article: `${lot.articleCode || ''} ${lot.commercialName || ''}`.trim(),
          supplier: lot.supplierName || '-',
          lot: lot.lotNumber,
          expiry: lot.expiryDate,
          days,
          quantity: stockQuantity,
          value: stockQuantity * Number(lot.sellingPrice || 0),
          action: fefoAction(days, lot.isBlocked),
        };
      }).sort((a, b) => Number(a.days) - Number(b.days) || Number(b.value) - Number(a.value));
    },
    columns: moneyColumns([
      ['priority', 'Priorite', 'center'],
      ['article', 'Article'],
      ['supplier', 'Fournisseur'],
      ['lot', 'Lot'],
      ['expiry', 'Expiration'],
      ['days', 'Jours', 'right'],
      ['quantity', 'Stock', 'right'],
      ['value', 'Valeur stock', 'right'],
      ['action', 'Action recommandee'],
    ]),
    kpis: (rows) => [
      { label: 'Lots suivis', value: String(rows.length) },
      { label: '<= 30 jours', value: String(rows.filter((row) => Number(row.days) >= 0 && Number(row.days) <= 30).length), tone: 'danger' },
      { label: '<= 90 jours', value: String(rows.filter((row) => Number(row.days) > 30 && Number(row.days) <= 90).length), tone: 'warning' },
      { label: 'Valeur a risque', value: money(sum(rows.filter((row) => Number(row.days) <= 90), 'value')) },
    ],
  },
  cash: {
    kind: 'cash',
    title: 'Rapport Caisse',
    description: 'Sessions et mouvements caisse sur la periode.',
    permission: 'reports.cash',
    filename: 'rapport_caisse',
    sheetName: 'Caisse',
    load: async () => {
      const [sessions, movements, sales] = await Promise.all([cashService.getSessions(), cashService.getMovements(), salesService.getAll()]);
      const saleById = new Map(sales.data.map((sale) => [sale.saleId, sale]));
      return [
        ...sessions.data.map((session) => ({
          date: session.openedAt,
          type: 'SESSION',
          label: session.registerName || 'Caisse',
          site: session.siteName || '-',
          user: session.userName || '-',
          receivedUsd: 0,
          changeUsd: 0,
          netUsd: Number(session.expectedClosingBalanceUsd ?? session.expectedClosingBalance ?? 0),
          receivedCdf: 0,
          changeCdf: 0,
          netCdf: Number(session.expectedClosingBalanceCdf ?? 0),
          settlementDifferenceUsd: 0,
          physicalDifferenceUsd: Number(session.closingDifferenceUsd ?? session.differenceAmount ?? 0),
          physicalDifferenceCdf: Number(session.closingDifferenceCdf ?? 0),
          expectedUsd: Number(session.expectedClosingBalanceUsd ?? session.expectedClosingBalance ?? 0),
          expectedCdf: Number(session.expectedClosingBalanceCdf ?? 0),
          countedUsd: Number(session.countedClosingBalanceUsd ?? session.closingBalance ?? 0),
          countedCdf: Number(session.countedClosingBalanceCdf ?? 0),
          settlementType: 'SESSION',
          reason: '',
          note: '',
          status: session.status,
        })),
        ...movements.data.map((movement) => ({
          date: movement.movementDate,
          type: movement.movementType,
          label: movement.description || movement.referenceType || '-',
          site: '-',
          user: '-',
          receivedUsd: movement.movementType === 'SALE_PAYMENT' && movement.currencyCode === 'USD' ? movement.amount : 0,
          changeUsd: movement.movementType === 'SALE_CHANGE' && movement.currencyCode === 'USD' ? movement.amount : 0,
          netUsd: movement.movementType === 'SALE_PAYMENT' && movement.currencyCode === 'USD'
            ? movement.amount
            : movement.movementType === 'SALE_CHANGE' && movement.currencyCode === 'USD'
              ? -movement.amount
              : 0,
          receivedCdf: movement.movementType === 'SALE_PAYMENT' && movement.currencyCode === 'CDF' ? movement.amount : 0,
          changeCdf: movement.movementType === 'SALE_CHANGE' && movement.currencyCode === 'CDF' ? movement.amount : 0,
          netCdf: movement.movementType === 'SALE_PAYMENT' && movement.currencyCode === 'CDF'
            ? movement.amount
            : movement.movementType === 'SALE_CHANGE' && movement.currencyCode === 'CDF'
              ? -movement.amount
              : 0,
          settlementDifferenceUsd: movement.referenceType === 'SALE' && movement.referenceId ? Number(saleById.get(movement.referenceId)?.settlementDifferenceUsd ?? 0) : 0,
          physicalDifferenceUsd: 0,
          physicalDifferenceCdf: 0,
          expectedUsd: 0,
          expectedCdf: 0,
          countedUsd: 0,
          countedCdf: 0,
          settlementType: movement.referenceType === 'SALE' && movement.referenceId ? String(saleById.get(movement.referenceId)?.settlementDifferenceType ?? 'NONE') : 'NONE',
          reason: movement.referenceType === 'SALE' && movement.referenceId ? String(saleById.get(movement.referenceId)?.settlementDifferenceReason ?? '') : '',
          note: movement.referenceType === 'SALE' && movement.referenceId ? String(saleById.get(movement.referenceId)?.settlementDifferenceNote ?? '') : '',
          status: movement.currencyCode || 'USD',
        })),
      ];
    },
    columns: moneyColumns([
      ['date', 'Date'],
      ['type', 'Type'],
      ['label', 'Libelle'],
      ['site', 'Site'],
      ['user', 'Utilisateur'],
      ['receivedUsd', 'Remis USD', 'right'],
      ['changeUsd', 'Rendu USD', 'right'],
      ['netUsd', 'Net USD', 'right'],
      ['receivedCdf', 'Remis CDF', 'right'],
      ['changeCdf', 'Rendu CDF', 'right'],
      ['netCdf', 'Net CDF', 'right'],
      ['settlementType', 'Type ecart', 'center'],
      ['reason', 'Motif'],
      ['settlementDifferenceUsd', 'Ecart reglement USD', 'right'],
      ['expectedUsd', 'Attendu USD', 'right'],
      ['countedUsd', 'Compte USD', 'right'],
      ['physicalDifferenceUsd', 'Ecart physique USD', 'right'],
      ['physicalDifferenceCdf', 'Ecart physique CDF', 'right'],
      ['status', 'Statut', 'center'],
    ]),
    kpis: (rows) => [
      { label: 'Lignes caisse', value: String(rows.length) },
      { label: 'Paiements bruts USD', value: money(sum(rows, 'receivedUsd')) },
      { label: 'Monnaie rendue USD', value: money(sum(rows, 'changeUsd')) },
      { label: 'Net encaisse USD', value: money(sum(rows, 'netUsd')) },
      { label: 'Ecart physique USD', value: money(sum(rows, 'physicalDifferenceUsd')) },
    ],
  },
  insurance: {
    kind: 'insurance',
    title: 'Rapport Assurances',
    description: 'Creances assurances, paiements et soldes.',
    permission: 'reports.receivables',
    filename: 'rapport_assurances',
    sheetName: 'Assurances',
    load: async () => (await insuranceService.receivables.getAll()).data.map((receivable) => ({
      customer: receivable.customerName || '-',
      organization: receivable.organizationName || '-',
      type: receivable.receivableType,
      amountDue: receivable.amountDue,
      amountPaid: receivable.amountPaid,
      balance: receivable.balance,
      currency: receivable.currencyCode || 'USD',
      status: receivable.status,
    })),
    columns: moneyColumns([
      ['customer', 'Client'],
      ['organization', 'Assurance'],
      ['type', 'Type'],
      ['amountDue', 'Du', 'right'],
      ['amountPaid', 'Paye', 'right'],
      ['balance', 'Solde', 'right'],
      ['currency', 'Devise', 'center'],
      ['status', 'Statut', 'center'],
    ]),
    kpis: (rows) => [
      { label: 'Creances', value: String(rows.length) },
      { label: 'Montant du', value: money(sum(rows, 'amountDue')) },
      { label: 'Paye', value: money(sum(rows, 'amountPaid')), tone: 'success' },
      { label: 'Solde ouvert', value: money(sum(rows, 'balance')), tone: sum(rows, 'balance') > 0 ? 'warning' : 'success' },
    ],
  },
  margins: {
    kind: 'margins',
    title: 'Rapport Marges',
    description: 'Marge brute estimee depuis les rapports BI existants.',
    permission: 'reports.margins',
    filename: 'rapport_marges',
    sheetName: 'Marges',
    load: async () => (await reportsService.margins()).data.map((row) => ({
      article: String(row.articleName ?? row.commercialName ?? row.articleCode ?? '-'),
      quantity: Number(row.quantitySold ?? row.quantity ?? 0),
      revenue: Number(row.revenue ?? row.totalAmount ?? row.saleValue ?? 0),
      cost: Number(row.estimatedCost ?? row.purchaseValue ?? row.cost ?? 0),
      margin: Number(row.grossMargin ?? row.margin ?? 0),
      rate: Number(row.marginRate ?? row.marginPercent ?? 0),
    })),
    columns: moneyColumns([
      ['article', 'Article'],
      ['quantity', 'Quantite', 'right'],
      ['revenue', 'CA', 'right'],
      ['cost', 'Cout estime', 'right'],
      ['margin', 'Marge', 'right'],
      ['rate', 'Marge %', 'right'],
    ]),
    kpis: (rows) => [
      { label: 'Lignes', value: String(rows.length) },
      { label: 'CA', value: money(sum(rows, 'revenue')) },
      { label: 'Cout estime', value: money(sum(rows, 'cost')) },
      { label: 'Marge brute', value: money(sum(rows, 'margin')), tone: 'success' },
    ],
  },
};

export function SalesReportPage() { return <StandardReportPage config={configs.sales} />; }
export function PurchasesReportPage() { return <StandardReportPage config={configs.purchases} />; }
export function StocksReportPage() { return <StandardReportPage config={configs.stocks} />; }
export function InventoriesReportPage() { return <StandardReportPage config={configs.inventories} />; }
export function FefoReportPage() { return <StandardReportPage config={configs.fefo} />; }
export function CashReportPage() { return <StandardReportPage config={configs.cash} />; }
export function InsuranceReportPage() { return <StandardReportPage config={configs.insurance} />; }
export function MarginsReportPage() { return <StandardReportPage config={configs.margins} />; }

function StandardReportPage({ config }: { config: ReportConfig }) {
  const { permissions, currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [site, setSite] = useState('');
  const enabled = permissions.includes(config.permission);
  const query = useQuery({ queryKey: ['printable-report', config.kind], queryFn: config.load, enabled });

  const rows = useMemo(() => filterRows(query.data ?? [], search, from, to, site), [from, query.data, search, site, to]);
  const sites = useMemo(() => Array.from(new Set((query.data ?? []).map((row) => String(row.site || '')).filter(Boolean))).sort(), [query.data]);
  const period = from || to ? `${from ? formatDate(from) : '...'} - ${to ? formatDate(to) : '...'}` : 'Toutes dates';

  if (!enabled) {
    return (
      <ReportPageShell title={config.title} description={config.description}>
        <div className="card form-error">Acces refuse : permission {config.permission} requise.</div>
      </ReportPageShell>
    );
  }

  return (
    <ReportPageShell title={config.title} description={config.description}>
      <ReportFiltersBar>
        <input className="input" placeholder="Rechercher..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <input className="input compact-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input className="input compact-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        {sites.length > 0 && (
          <select className="input compact-input" value={site} onChange={(event) => setSite(event.target.value)}>
            <option value="">Tous les sites</option>
            {sites.map((siteName) => <option key={siteName} value={siteName}>{siteName}</option>)}
          </select>
        )}
        <ReportActions filename={config.filename} sheetName={config.sheetName} rows={rows} columns={config.columns} />
      </ReportFiltersBar>

      {query.isLoading && <div className="card loading-state">Chargement du rapport...</div>}
      {query.isError && <div className="card form-error">{apiErrorMessage(query.error)}</div>}

      <ReportKpiCards cards={config.kpis(rows)} />

      <ReportPreview
        title={config.title}
        subtitle={config.description}
        company={currentUser?.role ? `Pharmacie - ${currentUser.role}` : 'Pharmacie'}
        site={site || undefined}
        period={period}
        rows={rows}
        columns={config.columns}
        totals={<ReportTotals rows={rows} />}
      />
    </ReportPageShell>
  );
}

function ReportTotals({ rows }: { rows: ReportRow[] }) {
  return (
    <>
      <span>Lignes : <strong>{rows.length}</strong></span>
      <span>Total : <strong>{money(sum(rows, 'total') || sum(rows, 'revenue') || sum(rows, 'amountDue') || sum(rows, 'value'))}</strong></span>
    </>
  );
}

function filterRows(rows: ReportRow[], search: string, from: string, to: string, site: string) {
  const term = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (site && String(row.site || '') !== site) return false;
    if (from || to) {
      const rawDate = String(row.date || row.expiry || '');
      const date = rawDate.slice(0, 10);
      if (from && date && date < from) return false;
      if (to && date && date > to) return false;
    }
    if (!term) return true;
    return Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(term));
  });
}

function moneyColumns(source: Array<[key: string, label: string, align?: 'left' | 'center' | 'right']>): ReportColumn<ReportRow>[] {
  const moneyKeys = new Set([
    'total', 'patient', 'insurance', 'value', 'in', 'out', 'difference', 'amountDue', 'amountPaid', 'balance', 'revenue', 'cost', 'margin',
    'receivedUsd', 'changeUsd', 'netUsd', 'receivedCdf', 'changeCdf', 'netCdf', 'settlementDifferenceUsd', 'physicalDifferenceUsd', 'physicalDifferenceCdf',
    'expectedUsd', 'expectedCdf', 'countedUsd', 'countedCdf',
  ]);
  return source.map(([key, label, align]) => ({
    key,
    label,
    align,
    render: (row) => {
      const value = row[key];
      if (key === 'date' || key === 'expiry') return formatDate(String(value || ''));
      if (['receivedCdf', 'changeCdf', 'netCdf', 'physicalDifferenceCdf', 'expectedCdf', 'countedCdf'].includes(key)) return money(Number(value || 0), 'CDF');
      if (moneyKeys.has(key)) return money(Number(value || 0), String(row.currency || 'USD'));
      return value;
    },
  }));
}

function stockStatus(quantity: number, min: number) {
  if (quantity <= 0) return 'Rupture';
  if (quantity <= min) return 'Faible';
  return 'Disponible';
}

function daysUntil(date: string) {
  const expiry = new Date(date);
  if (Number.isNaN(expiry.getTime())) return 9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
}

function fefoAction(days: number, blocked: boolean) {
  if (blocked) return 'Controle lot bloque';
  if (days < 0) return 'Retirer du rayon';
  if (days <= 7) return 'Rotation immediate';
  if (days <= 30) return 'Mettre en tete de rayon';
  if (days <= 90) return 'Promotion recommandee';
  return 'Surveillance';
}

function countStatus(rows: ReportRow[], status: string) {
  return rows.filter((row) => String(row.status).toUpperCase() === status).length;
}

function sum(rows: ReportRow[], key: string) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function money(value: number, currency = 'USD') {
  return formatMoney(value, currency);
}
