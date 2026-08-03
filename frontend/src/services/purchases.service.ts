import { apiClient } from './apiClient';

export type PurchaseItem = {
  purchaseItemId: string;
  articleId: string;
  lotId?: string | null;
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

export type PurchaseAttachment = {
  purchaseAttachmentId: string;
  purchaseId?: string | null;
  purchaseReturnId?: string | null;
  customerReturnId?: string | null;
  attachmentScope: 'PURCHASE' | 'PURCHASE_RETURN' | 'CUSTOMER_RETURN';
  attachmentType: string;
  fileName: string;
  originalFileName: string;
  storageBucket: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  description?: string | null;
  uploadedBy?: string | null;
  uploadedAt: string;
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
  update: (purchaseId: string, payload: Record<string, unknown>) => apiClient.patch<Purchase>(`/purchases/${purchaseId}`, payload),
  addItem: (purchaseId: string, payload: Record<string, unknown>) => apiClient.post<Purchase>(`/purchases/${purchaseId}/items`, payload),
  removeItem: (purchaseId: string, itemId: string) => apiClient.delete<Purchase>(`/purchases/${purchaseId}/items/${itemId}`),
  validate: (purchaseId: string) => apiClient.post<Purchase>(`/purchases/${purchaseId}/validate`),
  getAttachments: (purchaseId: string) => apiClient.get<PurchaseAttachment[]>(`/purchases/${purchaseId}/attachments`),
  uploadAttachment: (purchaseId: string, payload: { file: File; attachmentType?: string; description?: string }) => {
    const form = new FormData();
    form.append('file', payload.file);
    if (payload.attachmentType) form.append('attachmentType', payload.attachmentType);
    if (payload.description) form.append('description', payload.description);
    return apiClient.post<PurchaseAttachment>(`/purchases/${purchaseId}/attachments`, form);
  },
  getAttachmentUrl: (purchaseId: string, attachmentId: string) => apiClient.get<{ signedUrl: string } & PurchaseAttachment>(`/purchases/${purchaseId}/attachments/${attachmentId}/url`),
  deleteAttachment: (purchaseId: string, attachmentId: string) => apiClient.delete<{ deleted: boolean }>(`/purchases/${purchaseId}/attachments/${attachmentId}`),
};
