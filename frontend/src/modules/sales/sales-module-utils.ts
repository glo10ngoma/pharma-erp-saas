import { type SalesSummary, Sale, salesService } from '../../services/sales.service';
import { cashService } from '../../services/cash.service';
import { reportsService } from '../../services/reports.service';
import { fileDateStamp, formatDate, formatDateTime } from '../../utils/date';
import { fetchAllPages } from '../../utils/fetchAllPages';
import { downloadCsv, downloadJson, downloadXlsx } from '../../utils/export';
import { formatMoney } from '../../utils/money';

export type PeriodPreset = 'today' | 'yesterday' | 'week' | 'month' | 'previous-month' | 'custom';

export type SalesModuleFilters = {
  siteId?: string;
  seller?: string;
  saleType?: string;
  saleMode?: string;
  status?: string;
  customer?: string;
  saleNumber?: string;
  paymentMode?: string;
  from?: string;
  to?: string;
  period?: PeriodPreset;
};

export type SalesDaySnapshot = {
  title: string;
  subtitle: string;
  siteLabel: string;
  periodLabel: string;
  from: string;
  to: string;
  summary: {
    revenueNet: number;
    saleCount: number;
    immediateSaleCount: number;
    advanceSaleCount: number;
    averageBasket: number;
    itemsSold: number;
    receivedUsd: number;
    receivedCdf: number;
    changeUsd: number;
    changeCdf: number;
    settlementDifferenceUsd: number;
    cancelledCount: number;
    advancePendingCount: number;
    advanceFulfilledCount: number;
    advancePendingRevenue: number;
    advanceFulfilledRevenue: number;
  };
  modeData: Array<{ name: string; value: number }>;
  paymentData: Array<{ name: string; value: number }>;
  trendData: Array<{ label: string; revenue: number; count: number }>;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  sales: Sale[];
  saleBreakdown: Array<{ saleType: string; count: number; totalAmount: number; patientAmount: number; insuranceAmount: number }>;
  cashBreakdown: Array<{ movementType: string; count: number; amount: number }>;
  cashTotal: number;
  exportName: string;
  exportFilters: Record<string, string | number | undefined>;
};

export function salesPeriodRange(period: PeriodPreset, today = new Date()) {
  const end = toIso(today);
  const start = new Date(today);
  if (period === 'today') return { from: end, to: end };
  if (period === 'yesterday') {
    start.setDate(start.getDate() - 1);
    return { from: toIso(start), to: toIso(start) };
  }
  if (period === 'week') {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    return { from: toIso(start), to: end };
  }
  if (period === 'month') {
    start.setDate(1);
    return { from: toIso(start), to: end };
  }
  if (period === 'previous-month') {
    start.setMonth(start.getMonth() - 1, 1);
    const previousEnd = new Date(today);
    previousEnd.setDate(0);
    return { from: toIso(start), to: toIso(previousEnd) };
  }
  return { from: '', to: '' };
}

export function salesPeriodLabel(period?: PeriodPreset, from?: string, to?: string) {
  if (period === 'today') return "Aujourd'hui";
  if (period === 'yesterday') return 'Hier';
  if (period === 'week') return 'Cette semaine';
  if (period === 'month') return 'Ce mois';
  if (period === 'previous-month') return 'Mois precedent';
  if (from || to) return `${from ? formatDate(from) : '...'} - ${to ? formatDate(to) : '...'}`;
  return 'Periode libre';
}

export function salesFiltersToQuery(filters: SalesModuleFilters) {
  return {
    siteId: filters.siteId || undefined,
    seller: filters.seller || undefined,
    saleType: filters.saleType || undefined,
    saleMode: filters.saleMode || undefined,
    status: filters.status || undefined,
    customer: filters.customer || undefined,
    saleNumber: filters.saleNumber || undefined,
    paymentMode: filters.paymentMode || undefined,
    dateFrom: filters.from || undefined,
    dateTo: filters.to || undefined,
    sortBy: 'saleDate' as const,
    sortOrder: 'desc' as const,
  };
}

export async function fetchAllSales(filters: SalesModuleFilters) {
  const query = salesFiltersToQuery(filters);
  return fetchAllPages(
    async ({ page, limit }) => (await salesService.getList({ ...query, page, limit })).data,
    { getKey: (sale) => sale.saleId },
  );
}

export async function loadSalesSnapshot(options: {
  title: string;
  subtitle: string;
  period: PeriodPreset;
  from: string;
  to: string;
  siteId?: string;
  siteLabel: string;
  includeCash?: boolean;
  exportName: string;
  filters?: Partial<SalesModuleFilters>;
}): Promise<SalesDaySnapshot> {
  const filters: SalesModuleFilters = {
    from: options.from,
    to: options.to,
    siteId: options.siteId,
    status: 'VALIDATED',
    ...options.filters,
  };
  const [summaryResp, saleRows, topProductsResp, salesBreakdownResp, cashBreakdownResp, sessionsResp] = await Promise.all([
    salesService.getSummary(salesFiltersToQuery(filters)),
    fetchAllSales(filters),
    reportsService.topProducts(salesFiltersToQuery(filters)),
    reportsService.sales(salesFiltersToQuery(filters)),
    options.includeCash ? reportsService.cash(salesFiltersToQuery(filters)) : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    options.includeCash ? cashService.getSessions() : Promise.resolve({ data: [] as Array<{ openedAt?: string; closedAt?: string | null; siteId?: string; status?: string }> }),
  ]);

  const saleSummary = summaryResp.data;
  const topProducts = (topProductsResp.data ?? []).slice(0, 10).map((row) => ({
    name: String(row.commercialName ?? row.articleCode ?? row.name ?? '-'),
    quantity: Number(row.quantity ?? 0),
    revenue: Number(row.revenue ?? 0),
  }));
  const saleBreakdown = (salesBreakdownResp.data ?? []).map((row) => ({
    saleType: String(row.saleType ?? row.sale_type ?? '-'),
    count: Number(row.count ?? 0),
    totalAmount: Number(row.totalAmount ?? row.total_amount ?? 0),
    patientAmount: Number(row.patientAmount ?? row.patient_amount ?? 0),
    insuranceAmount: Number(row.insuranceAmount ?? row.insurance_amount ?? 0),
  }));
  const cashBreakdown = (cashBreakdownResp.data ?? []).map((row) => ({
    movementType: String(row.movementType ?? row.movement_type ?? '-'),
    count: Number(row.count ?? 0),
    amount: Number(row.amount ?? 0),
  }));
  const salesByDay = buildSalesTrend(saleRows, options.period, options.from, options.to);
  const modeData = buildSaleModeData(saleSummary);
  const paymentData = buildPaymentData(cashBreakdown);
  const cashTotal = cashBreakdown.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const sessions = (sessionsResp.data ?? []).filter((session) => {
    if (!session.openedAt) return false;
    const opened = new Date(session.openedAt);
    if (Number.isNaN(opened.getTime())) return false;
    if (opened < new Date(`${options.from}T00:00:00`) || opened > new Date(`${options.to}T23:59:59.999`)) return false;
    if (options.siteId && session.siteId && session.siteId !== options.siteId) return false;
    return true;
  });

  return {
    title: options.title,
    subtitle: options.subtitle,
    siteLabel: options.siteLabel,
    periodLabel: salesPeriodLabel(options.period, options.from, options.to),
    from: options.from,
    to: options.to,
    summary: {
      revenueNet: saleSummary.revenueNet ?? 0,
      saleCount: saleSummary.saleCount ?? 0,
      immediateSaleCount: saleSummary.immediateSaleCount ?? 0,
      advanceSaleCount: saleSummary.advanceSaleCount ?? 0,
      averageBasket: saleSummary.averageBasket ?? 0,
      itemsSold: saleSummary.itemsSold ?? 0,
      receivedUsd: saleSummary.receivedUsd ?? 0,
      receivedCdf: saleSummary.receivedCdf ?? 0,
      changeUsd: saleSummary.changeUsd ?? 0,
      changeCdf: saleSummary.changeCdf ?? 0,
      settlementDifferenceUsd: saleSummary.settlementDifferenceUsd ?? 0,
      cancelledCount: saleSummary.cancelledCount ?? 0,
      advancePendingCount: saleSummary.advancePendingCount ?? 0,
      advanceFulfilledCount: saleSummary.advanceFulfilledCount ?? 0,
      advancePendingRevenue: saleSummary.advancePendingRevenue ?? 0,
      advanceFulfilledRevenue: saleSummary.advanceFulfilledRevenue ?? 0,
    },
    modeData,
    paymentData,
    trendData: salesByDay,
    topProducts,
    sales: saleRows,
    saleBreakdown,
    cashBreakdown,
    cashTotal,
    exportName: options.exportName,
    exportFilters: salesFiltersToQuery(filters),
  };
}

export function salesExportRows(sales: Sale[]) {
  return [
    ['Numero', 'Date', 'Client', 'Site', 'Caissier', 'Type', 'Mode', 'Livraison', 'Total', 'Net USD', 'Net FC', 'Paiements', 'Statut'],
    ...sales.map((sale) => [
      sale.saleNumber,
      formatDateTime(sale.saleDate),
      sale.customerName || sale.organizationName || 'Comptoir',
      sale.siteName ?? '-',
      sale.createdByName ?? '-',
      sale.saleType,
      sale.saleMode ?? '-',
      sale.fulfillmentStatus ?? '-',
      formatMoney(sale.totalAmount, sale.currencyCode ?? 'USD', sale.currencySymbol),
      formatMoney(sale.netReceivedUsd ?? 0, 'USD'),
      formatMoney(sale.netReceivedCdf ?? 0, 'CDF', 'FC'),
      sale.paymentModes ?? '-',
      sale.status,
    ]),
  ];
}

export function salesExportObjects(sales: Sale[]) {
  return sales.map((sale) => ({
    numero: sale.saleNumber,
    date: formatDateTime(sale.saleDate),
    client: sale.customerName || sale.organizationName || 'Comptoir',
    site: sale.siteName ?? '-',
    caissier: sale.createdByName ?? '-',
    type: sale.saleType,
    mode: sale.saleMode ?? '-',
    livraison: sale.fulfillmentStatus ?? '-',
    total: formatMoney(sale.totalAmount, sale.currencyCode ?? 'USD', sale.currencySymbol),
    netUsd: formatMoney(sale.netReceivedUsd ?? 0, 'USD'),
    netFc: formatMoney(sale.netReceivedCdf ?? 0, 'CDF', 'FC'),
    paiements: sale.paymentModes ?? '-',
    statut: sale.status,
  }));
}

export async function exportSalesSnapshot(snapshot: SalesDaySnapshot, format: 'xlsx' | 'csv' | 'json') {
  const sales = snapshot.sales;
  const stamp = fileDateStamp(new Date(snapshot.to || new Date()));
  const sheets = [
    { name: 'Resume', rows: salesSnapshotSummaryRows(snapshot) },
    { name: 'Ventes', rows: salesExportRows(sales) },
    { name: 'Top produits', rows: [['Article', 'Quantite', 'CA'], ...snapshot.topProducts.map((item) => [item.name, item.quantity, formatMoney(item.revenue, 'USD')])] },
  ];
  if (snapshot.cashBreakdown.length > 0) {
    sheets.push({ name: 'Caisse', rows: [['Type mouvement', 'Nombre', 'Montant'], ...snapshot.cashBreakdown.map((item) => [item.movementType, item.count, formatMoney(item.amount, 'USD')])] });
  }
  if (format === 'xlsx') {
    downloadXlsx(`${snapshot.exportName}_${stamp}.xlsx`, sheets);
    return;
  }
  if (format === 'csv') {
    downloadCsv(`${snapshot.exportName}_${stamp}.csv`, salesExportRows(sales));
    return;
  }
  downloadJson(`${snapshot.exportName}_${stamp}.json`, {
    title: snapshot.title,
    subtitle: snapshot.subtitle,
    summary: salesSnapshotSummaryRows(snapshot).slice(1).map(([label, value]) => ({ label, value })),
    sales: salesExportObjects(sales),
    topProducts: snapshot.topProducts,
    cashBreakdown: snapshot.cashBreakdown,
  });
}

export function salesSnapshotSummaryRows(snapshot: SalesDaySnapshot) {
  return [
    ['Metrique', 'Valeur'],
    ['CA net', formatMoney(snapshot.summary.revenueNet ?? 0, 'USD')],
    ['Ventes valides', snapshot.summary.saleCount ?? 0],
    ['Ventes immediates', snapshot.summary.immediateSaleCount ?? 0],
    ['Avances', snapshot.summary.advanceSaleCount ?? 0],
    ['Panier moyen', formatMoney(snapshot.summary.averageBasket ?? 0, 'USD')],
    ['Articles vendus', snapshot.summary.itemsSold ?? 0],
    ['Encaisse USD', formatMoney(snapshot.summary.receivedUsd ?? 0, 'USD')],
    ['Encaisse FC', formatMoney(snapshot.summary.receivedCdf ?? 0, 'CDF', 'FC')],
    ['Rendu USD', formatMoney(snapshot.summary.changeUsd ?? 0, 'USD')],
    ['Rendu FC', formatMoney(snapshot.summary.changeCdf ?? 0, 'CDF', 'FC')],
    ['Ecart reglement USD', formatMoney(snapshot.summary.settlementDifferenceUsd ?? 0, 'USD')],
    ['Ventes annulees', snapshot.summary.cancelledCount ?? 0],
    ['Sessions ouvertes', snapshot.cashBreakdown.length > 0 ? snapshot.cashBreakdown.length : 0],
  ];
}

function buildSalesTrend(sales: Sale[], period: PeriodPreset, from: string, to: string) {
  const map = new Map<string, { revenue: number; count: number }>();
  const start = from ? new Date(from) : new Date();
  const end = to ? new Date(to) : new Date();
  const bucket = period === 'today' || period === 'yesterday' ? 'hour' : 'day';
  if (bucket === 'hour') {
    for (let hour = 0; hour < 24; hour += 1) map.set(String(hour).padStart(2, '0'), { revenue: 0, count: 0 });
  } else {
    for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) map.set(toIso(date), { revenue: 0, count: 0 });
  }

  for (const sale of sales) {
    if (!sale.saleDate) continue;
    const date = new Date(sale.saleDate);
    if (Number.isNaN(date.getTime())) continue;
    const key = bucket === 'hour' ? String(date.getHours()).padStart(2, '0') : toIso(date);
    const current = map.get(key);
    if (!current) continue;
    current.revenue += Number(sale.totalAmount ?? 0);
    current.count += 1;
  }

  return Array.from(map.entries()).map(([key, value]) => ({
    label: bucket === 'hour' ? `${key} h` : formatDate(key),
    revenue: value.revenue,
    count: value.count,
  }));
}

function buildSaleModeData(summary: Partial<SalesSummary>) {
  return [
    { name: 'Immed. / CASH', value: Number(summary.immediateSaleCount ?? 0) },
    { name: 'Avances', value: Number(summary.advanceSaleCount ?? 0) },
  ];
}

function buildPaymentData(cashBreakdown: Array<{ movementType: string; count: number; amount: number }>) {
  const grouped = new Map<string, number>();
  for (const movement of cashBreakdown) {
    const label = cashMovementLabel(movement.movementType);
    grouped.set(label, (grouped.get(label) ?? 0) + Number(movement.amount ?? 0));
  }
  return Array.from(grouped.entries()).map(([name, value]) => ({ name, value }));
}

function cashMovementLabel(movementType: string) {
  if (movementType.includes('SALE_PAYMENT')) return 'Paiements';
  if (movementType.includes('SALE_CHANGE')) return 'Rendus';
  if (movementType.includes('RECEIVABLE_PAYMENT')) return 'Creances';
  if (movementType.includes('PURCHASE_REFUND')) return 'Avoirs';
  if (movementType.includes('ADVANCE')) return 'Avances';
  if (movementType.includes('CASH_IN')) return 'Entrees';
  if (movementType.includes('CASH_OUT')) return 'Sorties';
  if (movementType.includes('BANK_DEPOSIT')) return 'Banque';
  if (movementType.includes('EXPENSE')) return 'Depenses';
  return movementType || 'Autres';
}

function toIso(date: Date) {
  return date.toISOString().slice(0, 10);
}
