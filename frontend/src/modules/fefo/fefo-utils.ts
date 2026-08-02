import type { Article } from '../../services/articles.service';
import type { Lot } from '../../services/lots.service';
import type { Stock } from '../../services/stocks.service';

export type FefoPriority = 'EXPIRED' | 'RED' | 'ORANGE' | 'GREEN';

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
};

export type FefoRotationRow = {
  key: string;
  articleId: string;
  articleCode: string;
  articleName: string;
  dci: string;
  siteId: string;
  siteName: string;
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
};

export type FefoKpis = {
  priorityToday: number;
  expiring30: number;
  expiring90: number;
  expired: number;
  riskValue: number;
};

export type RotationKpis = {
  recommended: number;
  mispositioned: number;
  critical: number;
  concernedValue: number;
  health: number;
};

export type FefoPriorityMeta = {
  label: string;
  className: string;
  icon: string;
  description: string;
};

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
        priority: priorityForDays(daysRemaining),
        action: recommendedAction(daysRemaining, quantityAvailable * purchasePrice),
      };
    });

  return rows.sort((a, b) => a.daysRemaining - b.daysRemaining || b.stockValue - a.stockValue);
}

export function buildFefoKpis(rows: FefoRiskRow[]): FefoKpis {
  return rows.reduce(
    (kpis, row) => {
      if (row.daysRemaining >= 0 && row.daysRemaining <= 30) kpis.priorityToday += 1;
      if (row.daysRemaining >= 0 && row.daysRemaining <= 30) kpis.expiring30 += 1;
      if (row.daysRemaining >= 0 && row.daysRemaining <= 90) kpis.expiring90 += 1;
      if (row.daysRemaining < 0) kpis.expired += 1;
      if (row.daysRemaining <= 90) kpis.riskValue += row.stockValue;
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
    const ordered = [...rows].sort((a, b) => a.daysRemaining - b.daysRemaining || b.quantityAvailable - a.quantityAvailable);
    const fefo = ordered[0];
    if (!fefo) return;

    const newerDominates = ordered.slice(1).some((row) => row.quantityAvailable > fefo.quantityAvailable || row.stockValue > fefo.stockValue);
    const critical = fefo.daysRemaining < 0 || fefo.daysRemaining <= 30;
    const action = rotationAction(fefo.daysRemaining, newerDominates, ordered.length);

    rotationRows.push({
      key,
      articleId: fefo.articleId,
      articleCode: fefo.articleCode,
      articleName: fefo.articleName,
      dci: fefo.dci,
      siteId: fefo.siteId,
      siteName: fefo.siteName,
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
    });
  });

  return rotationRows.sort((a, b) => a.daysRemaining - b.daysRemaining || b.stockValue - a.stockValue);
}

export function buildRotationKpis(rows: FefoRotationRow[]): RotationKpis {
  const recommended = rows.filter((row) => row.action !== 'Conserver').length;
  const mispositioned = rows.filter((row) => row.mispositioned).length;
  const critical = rows.filter((row) => row.critical).length;
  const concernedValue = rows.filter((row) => row.action !== 'Conserver').reduce((sum, row) => sum + row.stockValue, 0);
  const health = rows.length === 0 ? 100 : Math.max(0, Math.round(((rows.length - mispositioned - critical) / rows.length) * 100));
  return { recommended, mispositioned, critical, concernedValue, health };
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
      label: 'Expiré',
      className: 'badge fefo-priority fefo-priority-expired',
      icon: '✕',
      description: "Date d'expiration dépassée.",
    };
  }
  if (priority === 'RED') {
    return {
      label: 'Rouge',
      className: 'badge fefo-priority fefo-priority-red',
      icon: '!',
      description: "Échéance très proche, lot non expiré.",
    };
  }
  if (priority === 'ORANGE') {
    return {
      label: 'Orange',
      className: 'badge fefo-priority fefo-priority-orange',
      icon: '▲',
      description: 'Surveillance FEFO renforcée.',
    };
  }
  return {
    label: 'Vert',
    className: 'badge fefo-priority fefo-priority-green',
    icon: '●',
    description: 'Situation FEFO stable.',
  };
}

export function fefoPriorityLegend(): FefoPriorityMeta[] {
  return [
    priorityMeta('EXPIRED'),
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

function priorityForDays(daysRemaining: number): FefoPriority {
  if (daysRemaining < 0) return 'EXPIRED';
  if (daysRemaining <= 30) return 'RED';
  if (daysRemaining <= 90) return 'ORANGE';
  return 'GREEN';
}

function recommendedAction(daysRemaining: number, stockValue: number) {
  if (daysRemaining < 0) return 'Retour fournisseur / retrait';
  if (daysRemaining <= 7) return 'Rotation immediate';
  if (daysRemaining <= 30) return stockValue > 100 ? 'Promotion recommandee' : 'Mettre en tete de rayon';
  if (daysRemaining <= 90) return 'Surveillance';
  return 'Conserver';
}

function rotationAction(daysRemaining: number, newerDominates: boolean, lotCount: number) {
  if (daysRemaining < 0) return 'Retirer du rayon';
  if (daysRemaining <= 7) return 'Deplacer immediatement';
  if (daysRemaining <= 30) return 'Deplacer devant';
  if (newerDominates && lotCount > 1) return 'Controler';
  return 'Conserver';
}

function atLocalMidnight(date: string | Date) {
  const parsed = date instanceof Date ? date : new Date(String(date).split('T')[0] + 'T00:00:00');
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}
