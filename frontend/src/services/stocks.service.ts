import { apiClient } from './apiClient';

export type Stock = { stockId: string; siteId: string; siteName: string | null; lotId: string; lotNumber: string; expiryDate: string; articleId: string; articleCode: string | null; commercialName: string | null; quantityAvailable: number; quantityReserved: number; stockMin?: number; stockMax?: number | null };
export type StockMovement = { movementId: string; movementDate: string; siteId?: string; siteName: string | null; articleId?: string; articleCode: string | null; commercialName: string | null; lotId?: string | null; lotNumber: string | null; movementType: string; quantity: number; referenceType: string | null };

export const stocksService = {
  getAll: () => apiClient.get<Stock[]>('/stocks'),
  getByArticle: (articleId: string) => apiClient.get<Stock[]>(`/stocks/articles/${articleId}`),
  getMovements: () => apiClient.get<StockMovement[]>('/stock-movements'),
};
