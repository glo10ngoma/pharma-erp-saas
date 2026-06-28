import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { cashService } from '../../services/cash.service';
import { insuranceService } from '../../services/insurance.service';
import { inventoriesService } from '../../services/inventories.service';
import { lotsService } from '../../services/lots.service';
import { reportsService } from '../../services/reports.service';
import { stocksService } from '../../services/stocks.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';

export type NotificationPriority = 'CRITICAL' | 'WARNING' | 'INFO';
export type NotificationCategory = 'STOCK' | 'FEFO' | 'ACHATS' | 'VENTES' | 'CAISSE' | 'ASSURANCE' | 'INVENTAIRE' | 'SYSTEME';
export type NotificationStatus = 'READ' | 'UNREAD';

export type GeneratedNotification = {
  id: string;
  priority: NotificationPriority;
  category: NotificationCategory;
  title: string;
  message: string;
  site: string;
  date: string;
  status: NotificationStatus;
  route: string;
  routeLabel: string;
};

export type NotificationState = Record<string, { read?: boolean; deleted?: boolean }>;

const todayIso = new Date().toISOString();
const storageKey = 'pharmaerp.notificationState.v1';
const insuranceBatchesKey = 'pharmaerp.insuranceBatches.v2';
const insuranceDisputesKey = 'pharmaerp.insuranceDisputes.v2';

export function useGeneratedNotifications(state: NotificationState = {}, enabled = true) {
  const queries = useQueries({
    queries: [
      { queryKey: ['notifications', 'stocks'], queryFn: async () => (await stocksService.getAll()).data, enabled },
      { queryKey: ['notifications', 'lots'], queryFn: async () => (await lotsService.getAll()).data, enabled },
      { queryKey: ['notifications', 'inventories'], queryFn: async () => (await inventoriesService.getAll()).data, enabled },
      { queryKey: ['notifications', 'receivables'], queryFn: async () => (await insuranceService.receivables.getAll()).data, enabled },
      { queryKey: ['notifications', 'cash-sessions'], queryFn: async () => (await cashService.getSessions()).data, enabled },
      { queryKey: ['notifications', 'dashboard'], queryFn: async () => (await reportsService.dashboard()).data, enabled },
    ],
  });

  const [stocks, lots, inventories, receivables, sessions, dashboard] = queries;
  const notifications = useMemo(() => buildNotifications({
    stocks: stocks.data ?? [],
    lots: lots.data ?? [],
    inventories: inventories.data ?? [],
    receivables: receivables.data ?? [],
    sessions: sessions.data ?? [],
    dashboard: dashboard.data,
    state,
  }), [dashboard.data, inventories.data, lots.data, receivables.data, sessions.data, state, stocks.data]);

  return {
    notifications,
    loading: queries.some((query) => query.isLoading),
    error: queries.find((query) => query.isError)?.error,
  };
}

export function readNotificationState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as NotificationState;
  } catch {
    return {};
  }
}

export function writeNotificationState(state: NotificationState) {
  localStorage.setItem(storageKey, JSON.stringify(state));
  window.dispatchEvent(new Event('notifications-updated'));
}

export function canReadNotifications(permissions: string[], role?: string) {
  return permissions.includes('notifications.read')
    || role === 'ADMIN'
    || role === 'MANAGER'
    || role === 'PHARMACIEN'
    || permissions.includes('reports.dashboard')
    || permissions.includes('stocks.read');
}

function buildNotifications({ stocks, lots, inventories, receivables, sessions, dashboard, state }: any) {
  const rows: GeneratedNotification[] = [];

  for (const stock of stocks) {
    const quantity = Number(stock.quantityAvailable || 0);
    const min = Number(stock.stockMin || 0);
    if (quantity < 0) rows.push(notification('stock-negative', stock.stockId, 'CRITICAL', 'STOCK', 'Stock negatif', `${stock.commercialName || stock.articleCode} a un stock negatif (${quantity}).`, stock.siteName, '/stocks', 'Ouvrir Stocks'));
    else if (quantity <= 0) rows.push(notification('stockout', stock.stockId, 'CRITICAL', 'STOCK', 'Rupture stock', `${stock.commercialName || stock.articleCode} est en rupture sur le lot ${stock.lotNumber || '-'}.`, stock.siteName, '/stocks', 'Ouvrir Stocks'));
    else if (min > 0 && quantity <= min) rows.push(notification('low-stock', stock.stockId, 'WARNING', 'STOCK', 'Stock faible', `${stock.commercialName || stock.articleCode} est sous le seuil minimum (${quantity}/${min}).`, stock.siteName, '/stocks', 'Ouvrir Stocks'));
  }

  for (const lot of lots) {
    const days = daysUntil(lot.expiryDate);
    if (days < 0) rows.push(notification('lot-expired', lot.lotId, 'CRITICAL', 'FEFO', 'Produit expire', `${lot.commercialName || lot.articleCode} - lot ${lot.lotNumber} expire depuis le ${formatDate(lot.expiryDate)}.`, '-', '/reports/fefo-report', 'Ouvrir FEFO'));
    else if (days === 0) rows.push(notification('lot-today', lot.lotId, 'CRITICAL', 'FEFO', 'Expire aujourd hui', `${lot.commercialName || lot.articleCode} - lot ${lot.lotNumber} expire aujourd hui.`, '-', '/reports/fefo-report', 'Ouvrir FEFO'));
    else if (days <= 30) rows.push(notification('lot-30', lot.lotId, 'WARNING', 'FEFO', 'Expire sous 30 jours', `${lot.commercialName || lot.articleCode} - lot ${lot.lotNumber} expire dans ${days} jour(s).`, '-', '/reports/fefo-report', 'Ouvrir FEFO'));
    else if (days <= 90) rows.push(notification('lot-90', lot.lotId, 'INFO', 'FEFO', 'Expire sous 90 jours', `${lot.commercialName || lot.articleCode} - lot ${lot.lotNumber} expire dans ${days} jour(s).`, '-', '/reports/fefo-report', 'Ouvrir FEFO'));
  }

  for (const receivable of receivables) {
    const balance = Number(receivable.balance || 0);
    if (balance >= 100) rows.push(notification('receivable-high', receivable.receivableId, 'WARNING', 'ASSURANCE', 'Creance importante', `${receivable.organizationName || 'Assurance'} doit encore ${formatMoney(balance, receivable.currencyCode || 'USD')}.`, '-', '/reports/insurance-report', 'Ouvrir Assurance'));
    const age = ageDays(receivable.dueDate || receivable.issueDate || receivable.createdAt);
    if (balance > 0 && age > 90) rows.push(notification('receivable-90', receivable.receivableId, 'CRITICAL', 'ASSURANCE', 'Creance >90 jours', `${receivable.organizationName || 'Assurance'} - ${receivable.customerName || 'client'} : ${formatMoney(balance, receivable.currencyCode || 'USD')}.`, '-', '/insurance/reminders', 'Ouvrir Relances'));
    else if (balance > 0 && age > 60) rows.push(notification('receivable-60', receivable.receivableId, 'WARNING', 'ASSURANCE', 'Creance >60 jours', `${receivable.organizationName || 'Assurance'} - relance importante.`, '-', '/insurance/reminders', 'Ouvrir Relances'));
    else if (balance > 0 && age > 30) rows.push(notification('receivable-30', receivable.receivableId, 'WARNING', 'ASSURANCE', 'Creance >30 jours', `${receivable.organizationName || 'Assurance'} - relance simple.`, '-', '/insurance/reminders', 'Ouvrir Relances'));
  }

  for (const dispute of readLocal<{ id: string; type: string; status: string }>(insuranceDisputesKey)) {
    if (dispute.status !== 'CLOSED') rows.push(notification('dispute-open', dispute.id, 'WARNING', 'ASSURANCE', 'Litige ouvert', `${dispute.type} en attente de resolution.`, '-', '/insurance/disputes', 'Ouvrir Litiges'));
  }

  for (const batch of readLocal<{ id: string; number: string; status: string; amount: number }>(insuranceBatchesKey)) {
    if (batch.status === 'DRAFT') rows.push(notification('batch-send', batch.id, 'INFO', 'ASSURANCE', 'Bordereau a envoyer', `${batch.number} est pret pour envoi assurance.`, '-', '/insurance/batches', 'Ouvrir Bordereaux'));
  }

  for (const inventory of inventories) {
    if (inventory.status === 'DRAFT') rows.push(notification('inventory-draft', inventory.inventoryId, 'INFO', 'INVENTAIRE', 'Inventaire a demarrer', `${inventory.inventoryNumber} est encore en brouillon.`, inventory.siteName, '/inventories', 'Ouvrir Inventaires'));
    if (inventory.status === 'IN_PROGRESS') rows.push(notification('inventory-open', inventory.inventoryId, 'WARNING', 'INVENTAIRE', 'Inventaire non valide', `${inventory.inventoryNumber} est en cours et doit etre cloture puis valide.`, inventory.siteName, '/inventories', 'Ouvrir Inventaires'));
    if (inventory.status === 'CLOSED') rows.push(notification('inventory-closed', inventory.inventoryId, 'WARNING', 'INVENTAIRE', 'Inventaire non valide', `${inventory.inventoryNumber} est cloture mais pas encore valide.`, inventory.siteName, '/inventories', 'Ouvrir Inventaires'));
  }

  const openSessions = sessions.filter((session: any) => session.status === 'OPEN');
  for (const session of openSessions) {
    rows.push(notification('cash-open', session.cashSessionId, 'INFO', 'CAISSE', 'Caisse ouverte', `${session.registerName || 'Caisse'} ouverte par ${session.userName || 'utilisateur'}.`, session.siteName, '/reports/cash-report', 'Ouvrir Caisse'));
    const openedAt = new Date(session.openedAt);
    if (daysBetween(openedAt, new Date()) >= 1) rows.push(notification('cash-forgotten', session.cashSessionId, 'WARNING', 'CAISSE', 'Fermeture oubliee', `${session.registerName || 'Caisse'} est ouverte depuis le ${formatDate(session.openedAt)}.`, session.siteName, '/cash', 'Ouvrir Caisse'));
  }
  if (sessions.length > 0 && openSessions.length === 0) {
    rows.push(notification('cash-none-open', 'current', 'WARNING', 'CAISSE', 'Caisse non ouverte', 'Aucune session caisse ouverte detectee.', '-', '/cash', 'Ouvrir Caisse'));
  }

  if (dashboard?.lowStockProductsCount > 0) rows.push(notification('dashboard-low-stock', 'kpi', 'WARNING', 'STOCK', 'Produits sous seuil', `${dashboard.lowStockProductsCount} produit(s) sous seuil stock.`, '-', '/reports/stocks-report', 'Rapport Stocks'));
  if (dashboard?.openReceivables > 0) rows.push(notification('dashboard-receivable', 'kpi', 'WARNING', 'ASSURANCE', 'Creances ouvertes', `Creances ouvertes : ${formatMoney(dashboard.openReceivables, dashboard.baseCurrency || 'USD')}.`, '-', '/reports/insurance-report', 'Rapport Assurance'));

  return rows
    .map((row) => ({ ...row, status: state[row.id]?.read ? 'READ' as const : 'UNREAD' as const }))
    .filter((row) => !state[row.id]?.deleted)
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.date.localeCompare(a.date));
}

function notification(prefix: string, id: string, priority: NotificationPriority, category: NotificationCategory, title: string, message: string, site: string | null, route: string, routeLabel: string): GeneratedNotification {
  return {
    id: `${prefix}:${id}`,
    priority,
    category,
    title,
    message,
    site: site || '-',
    date: todayIso,
    status: 'UNREAD',
    route,
    routeLabel,
  };
}

function daysUntil(date: string) {
  const expiry = new Date(date);
  if (Number.isNaN(expiry.getTime())) return 9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
}

function daysBetween(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function ageDays(date?: string | null) {
  if (!date) return 0;
  const start = new Date(date);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, daysBetween(start, new Date()));
}

function readLocal<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as T[];
  } catch {
    return [];
  }
}

function priorityRank(priority: NotificationPriority) {
  if (priority === 'CRITICAL') return 0;
  if (priority === 'WARNING') return 1;
  return 2;
}
