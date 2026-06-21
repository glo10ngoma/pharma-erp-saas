import { apiClient } from './apiClient';

export type Lot = { lotId: string; articleId: string; articleCode: string | null; commercialName: string | null; supplierName: string | null; lotNumber: string; expiryDate: string; purchasePrice: number; sellingPrice: number; isBlocked: boolean; blockReason: string | null };

export const lotsService = {
  getAll: () => apiClient.get<Lot[]>('/lots'),
  block: (id: string, reason?: string) => apiClient.post<Lot>(`/lots/${id}/block`, { reason }),
  unblock: (id: string) => apiClient.post<Lot>(`/lots/${id}/unblock`),
};
