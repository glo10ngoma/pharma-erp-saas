import type { Article } from '../../services/articles.service';
import type { Lot } from '../../services/lots.service';
import type { Stock } from '../../services/stocks.service';

export type FefoPriority = 'EXPIRED' | 'BLOCKED' | 'RED' | 'ORANGE' | 'GREEN';

export type FefoRiskRow = {
  key: string;
  articleId: string;
  articleCode: string;
  articleName: string;
  dci: string;
  categoryId: string | null;
  lotId: string;
  lotNumber: string;
  siteId: string;
  siteName: string;
  quantityAvailable: number;
  expiryDate: string;
  daysRemaining: number;
  purchasePrice: number;
  sellingPrice: number;
  currencyCode: string;
  currencySymbol?: string | null;
  stockValue: number;
  priority: FefoPriority;
  action: string;
  isBlocked: boolean;
  blockReason: string | null;
};

export type FefoRotationRow = {
  key: string;
  articleId: string;
  articleCode: string;
  articleName: string;
  dci: string;
  siteId: string;
  siteName: string;
  lotId: string;
  lotNumber: string;
  expiryDate: string;
  daysRemaining: number;
  quantityAvailable: number;
  stockValue: number;
  priority: FefoPriority;
  action: string;
  mispositioned: boolean;
  critical: boolean;
  currencyCode: string;
  currencySymbol?: string | null;
  isBlocked: boolean;
  blockReason: string | null;
};

export type FefoKpis = {
  priorityToday: number;
  expiring30: number;
  expiring90: number;
  expired: number;
  riskValue: number;
};

export type RotationKpis = {
  lotsToHandle: number;
  expired: number;
  red: number;
  orange: number;
  green: number;
  blocked: number;
  actionsCompleted: number;
  concernedValue: number;
};

export type FefoPriorityMeta = {
  label: string;
  className: string;
  icon: string;
  description: string;
};

export type FefoActionableRow = Pick<FefoRiskRow, 'lotId' | 'siteId' | 'priority' | 'stockValue'>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function buildFefoRiskRows(lots: Lot[], stocks: Stock[], articles: Article[], today = new Date()): FefoRiskRow[] {
  const articleById = new Map(articles.map((article) => [article.articleId, article]));
  const lotById = new Map(lots.map((lot) => [lot.lotId, lot]));

  const rows = stocks
    .filter((stock) => Number(stock.quantityAvailable) > 0)
    .map((stock) => {
      const lot = lotById.get(stock.lotId);
      const article = articleById.get(stock.articleId);
      const expiryDate = lot?.expiryDate ?? stock.expiryDate;
      const daysRemaining = daysUntil(expiryDate, today);
      const purchasePrice = Number(lot?.purchasePrice ?? 0);
      const sellingPrice = Number(lot?.sellingPrice ?? article?.sellingPrice ?? 0);
      const quantityAvailable = Number(stock.quantityAvailable ?? 0);
      const isBlocked = Boolean(lot?.isBlocked);
      return {
        key: `${stock.siteId}-${stock.lotId}`,
        articleId: stock.articleId,
        articleCode: article?.articleCode ?? stock.articleCode ?? '-',
        articleName: article?.commercialName ?? stock.commercialName ?? '-',
        dci: article?.dci ?? '-',
        categoryId: article?.categoryId ?? null,
        lotId: stock.lotId,
        lotNumber: lot?.lotNumber ?? stock.lotNumber ?? '-',
        siteId: stock.siteId,
        siteName: stock.siteName ?? '-',
        quantityAvailable,
        expiryDate,
        daysRemaining,
        purchasePrice,
        sellingPrice,
        currencyCode: lot?.currencyCode ?? 'USD',
        currencySymbol: lot?.currencySymbol,
        stockValue: quantityAvailable * purchasePrice,
        priority: priorityForLot(daysRemaining, isBlocked),
        action: recommendedAction(daysRemaining, quantityAvailable * purchasePrice, isBlocked),
        isBlocked,
        blockReason: lot?.blockReason ?? null,
      };
    });

  return rows.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority) || a.daysRemaining - b.daysRemaining || b.stockValue - a.stockValue);
}

export function buildFefoKpis(rows: FefoRiskRow[]): FefoKpis {
  return rows.reduce(
    (kpis, row) => {
      if (row.daysRemaining >= 0 && row.daysRemaining <= 30) kpis.priorityToday += 1;
      if (row.daysRemaining >= 0 && row.daysRemaining <= 30) kpis.expiring30 += 1;
      if (row.daysRemaining >= 0 && row.daysRemaining <= 90) kpis.expiring90 += 1;
      if (row.daysRemaining < 0) kpis.expired += 1;
      if (row.daysRemaining <= 90 || row.isBlocked) kpis.riskValue += row.stockValue;
      return kpis;
    },
    { priorityToday: 0, expiring30: 0, expiring90: 0, expired: 0, riskValue: 0 },
  );
}

export function buildRotationRows(riskRows: FefoRiskRow[]): FefoRotationRow[] {
  const groups = new Map<string, FefoRiskRow[]>();
  riskRows.forEach((row) => {
    const key = `${row.siteId}-${row.articleId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  const rotationRows: FefoRotationRow[] = [];
  groups.forEach((rows, key) => {
    const ordered = [...rows].sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority) || a.daysRemaining - b.daysRemaining || b.quantityAvailable - a.quantityAvailable);
    const fefo = ordered[0];
    if (!fefo) return;

    const newerDominates = ordered.slice(1).some((row) => row.quantityAvailable > fefo.quantityAvailable || row.stockValue > fefo.stockValue);
    const critical = fefo.priority === 'EXPIRED' || fefo.priority === 'RED' || fefo.priority === 'BLOCKED';
    const action = rotationAction(fefo.priority, newerDominates, ordered.length);

    rotationRows.push({
      key,
      articleId: fefo.articleId,
      articleCode: fefo.articleCode,
      articleName: fefo.articleName,
      dci: fefo.dci,
      siteId: fefo.siteId,
      siteName: fefo.siteName,
      lotId: fefo.lotId,
      lotNumber: fefo.lotNumber,
      expiryDate: fefo.expiryDate,
      daysRemaining: fefo.daysRemaining,
      quantityAvailable: fefo.quantityAvailable,
      stockValue: fefo.stockValue,
      priority: fefo.priority,
      action,
      mispositioned: newerDominates,
      critical,
      currencyCode: fefo.currencyCode,
      currencySymbol: fefo.currencySymbol,
      isBlocked: fefo.isBlocked,
      blockReason: fefo.blockReason,
    });
  });

  return rotationRows.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority) || a.daysRemaining - b.daysRemaining || b.stockValue - a.stockValue);
}

export function buildRotationKpis(rows: FefoRiskRow[], completedActionKeys: Set<string>): RotationKpis {
  const actionable = rows.filter((row) => row.priority !== 'GREEN');
  return {
    lotsToHandle: actionable.length,
    expired: rows.filter((row) => row.priority === 'EXPIRED').length,
    red: rows.filter((row) => row.priority === 'RED').length,
    orange: rows.filter((row) => row.priority === 'ORANGE').length,
    green: rows.filter((row) => row.priority === 'GREEN').length,
    blocked: rows.filter((row) => row.priority === 'BLOCKED').length,
    actionsCompleted: actionable.filter((row) => completedActionKeys.has(fefoActionKey(row.siteId, row.lotId, expectedActionType(row.priority)))).length,
    concernedValue: actionable.reduce((sum, row) => sum + row.stockValue, 0),
  };
}

export function expectedActionType(priority: FefoPriority) {
  if (priority === 'EXPIRED') return 'REMOVED_EXPIRED';
  if (priority === 'RED') return 'HIGHLIGHT_CONFIRMED';
  if (priority === 'ORANGE') return 'SHELF_ROTATION_CONFIRMED';
  return null;
}

export function fefoActionKey(siteId: string, lotId: string, actionType: string | null) {
  return `${siteId}:${lotId}:${actionType ?? 'NONE'}`;
}

export function priorityLabel(priority: FefoPriority) {
  return priorityMeta(priority).label;
}

export function priorityClass(priority: FefoPriority) {
  return priorityMeta(priority).className;
}

export function priorityMeta(priority: FefoPriority): FefoPriorityMeta {
  if (priority === 'EXPIRED') {
    return {
      label: 'Expire',
      className: 'badge fefo-priority fefo-priority-expired',
      icon: 'x',
      description: 'Date de peremption depassee.',
    };
  }
  if (priority === 'BLOCKED') {
    return {
      label: 'Bloque',
      className: 'badge fefo-priority fefo-priority-blocked',
      icon: '#',
      description: 'Lot bloque et non vendable.',
    };
  }
  if (priority === 'RED') {
    return {
      label: 'Rouge',
      className: 'badge fefo-priority fefo-priority-red',
      icon: '!',
      description: 'Echeance tres proche, lot non expire.',
    };
  }
  if (priority === 'ORANGE') {
    return {
      label: 'Orange',
      className: 'badge fefo-priority fefo-priority-orange',
      icon: '^',
      description: 'Surveillance FEFO renforcee.',
    };
  }
  return {
    label: 'Vert',
    className: 'badge fefo-priority fefo-priority-green',
    icon: 'o',
    description: 'Situation FEFO stable.',
  };
}

export function fefoPriorityLegend(): FefoPriorityMeta[] {
  return [
    priorityMeta('EXPIRED'),
    priorityMeta('BLOCKED'),
    priorityMeta('RED'),
    priorityMeta('ORANGE'),
    priorityMeta('GREEN'),
  ];
}

export function daysUntil(expiryDate: string, today = new Date()) {
  const expiry = atLocalMidnight(expiryDate);
  const current = atLocalMidnight(today);
  return Math.floor((expiry.getTime() - current.getTime()) / MS_PER_DAY);
}

function priorityForLot(daysRemaining: number, isBlocked: boolean): FefoPriority {
  if (daysRemaining < 0) return 'EXPIRED';
  if (isBlocked) return 'BLOCKED';
  if (daysRemaining <= 30) return 'RED';
  if (daysRemaining <= 90) return 'ORANGE';
  return 'GREEN';
}

function recommendedAction(daysRemaining: number, stockValue: number, isBlocked: boolean) {
  if (daysRemaining < 0) return 'Retirer du stock';
  if (isBlocked) return 'Consulter le motif';
  if (daysRemaining <= 7) return 'Mise en avant immediate';
  if (daysRemaining <= 30) return stockValue > 100 ? 'Promotion recommandee' : 'Mettre en tete de rayon';
  if (daysRemaining <= 90) return 'Confirmer rotation';
  return 'Conserver';
}

function rotationAction(priority: FefoPriority, newerDominates: boolean, lotCount: number) {
  if (priority === 'EXPIRED') return 'Retirer du stock';
  if (priority === 'BLOCKED') return 'Consulter le motif';
  if (priority === 'RED') return 'Confirmer mise en avant';
  if (priority === 'ORANGE') return newerDominates && lotCount > 1 ? 'Confirmer rotation' : 'Surveiller';
  if (newerDominates && lotCount > 1) return 'Controler';
  return 'Conserver';
}

function priorityOrder(priority: FefoPriority) {
  if (priority === 'EXPIRED') return 0;
  if (priority === 'BLOCKED') return 1;
  if (priority === 'RED') return 2;
  if (priority === 'ORANGE') return 3;
  return 4;
}

function atLocalMidnight(date: string | Date) {
  const parsed = date instanceof Date ? date : new Date(String(date).split('T')[0] + 'T00:00:00');
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}
