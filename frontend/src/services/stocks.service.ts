import { apiClient } from './apiClient';

export type Stock = { stockId: string; siteId: string; siteName: string | null; lotId: string; lotNumber: string; expiryDate: string; articleId: string; articleCode: string | null; commercialName: string | null; quantityAvailable: number; quantityReserved: number; stockMin?: number; stockMax?: number | null };
export type StockMovementDirection = 'IN' | 'OUT' | 'OTHER';
export type StockMovement = {
  movementId: string;
  movementDate: string;
  siteId?: string;
  siteName: string | null;
  articleId?: string;
  articleCode: string | null;
  commercialName: string | null;
  dci?: string | null;
  lotId?: string | null;
  lotNumber: string | null;
  movementType: string;
  direction: StockMovementDirection;
  quantity: number;
  unitLabel?: string | null;
  stockBefore?: number | null;
  stockAfter?: number | null;
  referenceType: string | null;
  referenceId?: string | null;
  referenceNumber?: string | null;
  referenceLabel?: string | null;
  notes?: string | null;
  userId?: string | null;
  userName?: string | null;
  workstationId?: string | null;
  workstationName?: string | null;
  isBlocked?: boolean;
  blockReason?: string | null;
};
export type StockMovementSummary = {
  movementCount: number;
  articlesCount: number;
  lotsCount: number;
  usersCount: number;
  entryCount: number;
  exitCount: number;
  purchaseInCount: number;
  saleOutCount: number;
  inventoryGainCount: number;
  inventoryLossCount: number;
  transferInCount: number;
  transferOutCount: number;
  purchaseReturnOutCount: number;
  purchaseExchangeInCount: number;
  mixedUnits: boolean;
};
export type StockMovementListResponse = {
  items: StockMovement[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary: StockMovementSummary;
};
export type StockMovementExportResponse = {
  items: StockMovement[];
  summary: StockMovementSummary;
  exportedAt: string;
  truncated: boolean;
  total: number;
};
export type StockSummary = {
  articleId: string;
  articleCode: string | null;
  commercialName: string | null;
  dci: string | null;
  siteId: string;
  siteName: string | null;
  quantityAvailable: number;
  quantityReserved: number;
  quantityTotal: number;
  stockMin: number;
  purchaseValue: number;
  saleValue: number;
  nextExpiryDate: string | null;
  statusCode: 'AVAILABLE' | 'LOW' | 'OUT' | 'RESERVED';
};
export type StockSummaryResponse = {
  items: StockSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
export type StockDetail = {
  articleId: string;
  articleCode: string | null;
  articleName: string | null;
  dci: string | null;
  siteId: string;
  siteName: string | null;
  quantityAvailable: number;
  quantityReserved: number;
  quantityTotal: number;
  stockMin: number;
  purchaseValue: number;
  saleValue: number;
  lots: Array<{
    lotId: string;
    lotNumber: string;
    expiryDate: string;
    quantityAvailable: number;
    quantityReserved: number;
    purchasePrice: number;
    sellingPrice: number;
  }>;
  movements: Array<{
    movementId: string;
    movementDate: string;
    movementType: string;
    quantity: number;
    referenceType: string | null;
    lotId: string | null;
    lotNumber: string | null;
  }>;
};

export const stocksService = {
  getAll: () => apiClient.get<Stock[]>('/stocks'),
  getByArticle: (articleId: string) => apiClient.get<Stock[]>(`/stocks/articles/${articleId}`),
  getMovements: (params?: Record<string, string | number | undefined>) => apiClient.get<StockMovementListResponse>('/stock-movements', { params }),
  exportMovements: (params?: Record<string, string | number | undefined>) => apiClient.get<StockMovementExportResponse>('/stock-movements/export', { params }),
  getSummary: (params: Record<string, string | number | undefined>) => apiClient.get<StockSummaryResponse>('/stocks/summary', { params }),
  getDetail: (params: { articleId: string; siteId: string }) => apiClient.get<StockDetail>('/stocks/detail', { params }),
};
