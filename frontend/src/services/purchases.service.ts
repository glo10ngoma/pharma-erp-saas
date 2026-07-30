import { apiClient } from './apiClient';

export type PurchaseItem = {
  purchaseItemId: string;
  articleId: string;
  articleCode: string | null;
  commercialName: string | null;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
  purchaseUnitId?: string | null;
  purchaseUnitLabelSnapshot?: string | null;
  purchaseQuantity?: number;
  conversionFactor?: number;
  stockUnitId?: string | null;
  stockUnitLabelSnapshot?: string | null;
  stockQuantity?: number;
  lineOrder?: number;
  unitPriceCurrency?: string | null;
  lineTotalCurrency?: number;
  purchaseUnitPrice: number;
  sellingUnitPrice: number;
  lineTotal: number;
};

export type PurchasePayment = {
  purchasePaymentId: string;
  purchaseId: string;
  cashSessionId?: string | null;
  currencyCode?: string | null;
  amount: number;
  exchangeRateApplied: number;
  amountEquivalentUsd: number;
  paymentSource?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  paymentNote?: string | null;
  status?: string | null;
  createdAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  cashMovementId?: string | null;
};

export type Purchase = {
  purchaseId: string;
  purchaseNumber: string;
  purchaseDate: string;
  supplierId: string;
  supplierName: string | null;
  siteId: string;
  siteName: string | null;
  currencyId: string | null;
  currencyCode?: string | null;
  currencySymbol?: string | null;
  exchangeRate: number;
  totalAmount: number;
  paymentStatus?: string;
  paymentSource?: string | null;
  paymentMethod?: string | null;
  totalEquivalentUsd?: number;
  amountPaidUsd?: number;
  amountPaidCdf?: number;
  paidEquivalentUsd?: number;
  outstandingBalanceUsd?: number;
  cashSessionId?: string | null;
  paymentReference?: string | null;
  paymentNote?: string | null;
  status: string;
  payments?: PurchasePayment[];
  items?: PurchaseItem[];
};

export const purchasesService = {
  getAll: (status?: string) => apiClient.get<Purchase[]>('/purchases', { params: { status: status || undefined } }),
  getById: (id: string) => apiClient.get<Purchase>(`/purchases/${id}`),
  create: (payload: Record<string, unknown>) => apiClient.post<Purchase>('/purchases', payload),
  addItem: (purchaseId: string, payload: Record<string, unknown>) => apiClient.post<Purchase>(`/purchases/${purchaseId}/items`, payload),
  removeItem: (purchaseId: string, itemId: string) => apiClient.delete<Purchase>(`/purchases/${purchaseId}/items/${itemId}`),
  validate: (purchaseId: string) => apiClient.post<Purchase>(`/purchases/${purchaseId}/validate`),
};
