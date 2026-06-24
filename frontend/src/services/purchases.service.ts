import { apiClient } from './apiClient';

export type PurchaseItem = { purchaseItemId: string; articleId: string; articleCode: string | null; commercialName: string | null; lotNumber: string; expiryDate: string; quantity: number; purchaseUnitPrice: number; sellingUnitPrice: number; lineTotal: number };
export type Purchase = { purchaseId: string; purchaseNumber: string; purchaseDate: string; supplierId: string; supplierName: string | null; siteId: string; siteName: string | null; currencyId: string | null; currencyCode?: string | null; currencySymbol?: string | null; exchangeRate: number; totalAmount: number; status: string; items?: PurchaseItem[] };

export const purchasesService = {
  getAll: (status?: string) => apiClient.get<Purchase[]>('/purchases', { params: { status: status || undefined } }),
  getById: (id: string) => apiClient.get<Purchase>(`/purchases/${id}`),
  create: (payload: Record<string, unknown>) => apiClient.post<Purchase>('/purchases', payload),
  addItem: (purchaseId: string, payload: Record<string, unknown>) => apiClient.post<Purchase>(`/purchases/${purchaseId}/items`, payload),
  removeItem: (purchaseId: string, itemId: string) => apiClient.delete<Purchase>(`/purchases/${purchaseId}/items/${itemId}`),
  validate: (purchaseId: string) => apiClient.post<Purchase>(`/purchases/${purchaseId}/validate`),
};
