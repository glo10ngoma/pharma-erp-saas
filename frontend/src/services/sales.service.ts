import { apiClient } from './apiClient';

export type SaleItem = { saleItemId: string; articleId: string; commercialName: string | null; lotId: string; lotNumber: string | null; expiryDate: string | null; quantity: number; unitPrice: number; lineTotal: number };
export type Payment = { paymentId: string; saleId: string; paymentDate: string; methodName: string; currencyCode?: string | null; currencySymbol?: string | null; amount: number; referencePayment: string | null; receivedBy?: string | null; receivedByName?: string | null };
export type Sale = { saleId: string; saleNumber: string; saleDate: string; customerId: string | null; customerName: string | null; organizationId?: string | null; organizationName?: string | null; membershipId?: string | null; planName?: string | null; coveragePercent?: number | null; siteId: string; siteName: string | null; currencyId: string; currencyCode?: string | null; currencySymbol?: string | null; exchangeRate?: number; subtotal?: number; discountAmount?: number; totalAmount: number; insuranceCoveredAmount: number; customerPayableAmount: number; creditAmount: number; amountPaidUsd?: number; amountPaidCdf?: number; amountReturnedUsd?: number; amountReturnedCdf?: number; netReceivedUsd?: number; netReceivedCdf?: number; settlementDifferenceUsd?: number; settlementDifferenceType?: string; settlementDifferenceReason?: string | null; settlementDifferenceNote?: string | null; saleType: string; status: string; createdAt?: string; validatedAt?: string | null; createdBy?: string | null; createdByName?: string | null; paymentModes?: string | null; items?: SaleItem[]; payments?: Payment[] };
export type SalesListResponse = {
  items: Sale[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
export type SalesSummary = {
  revenueNet: number;
  saleCount: number;
  averageBasket: number;
  itemsSold: number;
  receivedUsd: number;
  receivedCdf: number;
  changeUsd: number;
  changeCdf: number;
  settlementDifferenceUsd: number;
  settlementDifferenceCount: number;
  cancelledCount: number;
};

export const salesService = {
  getAll: () => apiClient.get<Sale[]>('/sales'),
  getList: (params: Record<string, string | number | undefined>) => apiClient.get<SalesListResponse>('/sales/list', { params }),
  getSummary: (params: Record<string, string | number | undefined>) => apiClient.get<SalesSummary>('/sales/summary', { params }),
  getById: (id: string) => apiClient.get<Sale>(`/sales/${id}`),
  create: (payload: Record<string, unknown>) => apiClient.post<Sale>('/sales', payload),
  updateDraft: (saleId: string, payload: Record<string, unknown>) => apiClient.patch<Sale>(`/sales/${saleId}`, payload),
  addItemFefo: (saleId: string, payload: Record<string, unknown>) => apiClient.post<Sale>(`/sales/${saleId}/items/fefo`, payload),
  updateItem: (saleId: string, itemId: string, payload: Record<string, unknown>) => apiClient.patch<Sale>(`/sales/${saleId}/items/${itemId}`, payload),
  removeItem: (saleId: string, itemId: string) => apiClient.delete<Sale>(`/sales/${saleId}/items/${itemId}`),
  applyInsurance: (saleId: string, payload: Record<string, unknown>) => apiClient.post<Sale>(`/sales/${saleId}/apply-insurance`, payload),
  validate: (saleId: string, payload: Record<string, unknown>) => apiClient.post<Sale>(`/sales/${saleId}/validate`, payload),
  cancel: (saleId: string) => apiClient.post<Sale>(`/sales/${saleId}/cancel`),
};
