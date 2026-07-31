import { apiClient } from './apiClient';
import { PurchaseAttachment } from './purchases.service';

export type PurchaseReturnItem = {
  purchaseReturnItemId: string;
  purchaseItemId: string;
  articleId: string;
  articleCode?: string | null;
  commercialName?: string | null;
  lotId: string;
  lotNumber?: string | null;
  expiryDate?: string | null;
  purchaseUnitId?: string | null;
  purchaseUnitLabelSnapshot?: string | null;
  returnedPurchaseQuantity: number;
  conversionFactor: number;
  returnedStockQuantity: number;
  stockUnitId?: string | null;
  stockUnitLabelSnapshot?: string | null;
  originalUnitPrice: number;
  returnUnitValue: number;
  lineReturnValue: number;
  reason?: string | null;
  conditionStatus: string;
  createdAt: string;
};

export type PurchaseReturnReplacementItem = {
  purchaseReturnReplacementItemId: string;
  articleId: string;
  articleCode?: string | null;
  commercialName?: string | null;
  purchaseUnitId?: string | null;
  purchaseUnitLabelSnapshot?: string | null;
  receivedPurchaseQuantity: number;
  conversionFactor: number;
  receivedStockQuantity: number;
  stockUnitId?: string | null;
  stockUnitLabelSnapshot?: string | null;
  lotNumber: string;
  expiryDate: string;
  unitValue: number;
  lineValue: number;
  createdAt: string;
};

export type PurchaseReturnSettlement = {
  purchaseReturnSettlementId: string;
  settlementKind: string;
  paymentSource: string;
  currencyCode: string;
  exchangeRateApplied: number;
  amount: number;
  amountEquivalentUsd: number;
  cashSessionId?: string | null;
  reference?: string | null;
  note?: string | null;
  createdBy?: string | null;
  createdAt: string;
};

export type PurchaseReturn = {
  purchaseReturnId: string;
  purchaseId: string;
  purchaseNumber?: string | null;
  supplierId: string;
  supplierName?: string | null;
  siteId: string;
  siteName?: string | null;
  returnNumber: string;
  returnDate: string;
  returnType: string;
  status: string;
  currencyCode: string;
  exchangeRateApplied: number;
  returnedValueUsd: number;
  replacementValueUsd: number;
  financialDifferenceUsd: number;
  refundDueUsd: number;
  additionalPaymentDueUsd: number;
  supplierCreditUsd: number;
  refundedAmountUsd: number;
  additionalPaidUsd: number;
  reason?: string | null;
  note?: string | null;
  createdBy?: string | null;
  validatedBy?: string | null;
  createdAt: string;
  validatedAt?: string | null;
  cancelledAt?: string | null;
  items?: PurchaseReturnItem[];
  replacementItems?: PurchaseReturnReplacementItem[];
  settlements?: PurchaseReturnSettlement[];
};

export type SupplierCredit = {
  supplierCreditId: string;
  supplierId: string;
  supplierName?: string | null;
  purchaseReturnId: string;
  currencyCode: string;
  originalAmount: number;
  remainingAmount: number;
  exchangeRateApplied: number;
  status: string;
  reference?: string | null;
  note?: string | null;
  createdAt: string;
  usedAt?: string | null;
};

export const purchaseReturnsService = {
  getAll: (purchaseId?: string) => apiClient.get<PurchaseReturn[]>('/purchase-returns', { params: { purchaseId: purchaseId || undefined } }),
  getById: (id: string) => apiClient.get<PurchaseReturn>(`/purchase-returns/${id}`),
  create: (payload: Record<string, unknown>) => apiClient.post<PurchaseReturn>('/purchase-returns', payload),
  addItem: (purchaseReturnId: string, payload: Record<string, unknown>) => apiClient.post<PurchaseReturn>(`/purchase-returns/${purchaseReturnId}/items`, payload),
  removeItem: (purchaseReturnId: string, itemId: string) => apiClient.delete<PurchaseReturn>(`/purchase-returns/${purchaseReturnId}/items/${itemId}`),
  addReplacement: (purchaseReturnId: string, payload: Record<string, unknown>) => apiClient.post<PurchaseReturn>(`/purchase-returns/${purchaseReturnId}/replacements`, payload),
  removeReplacement: (purchaseReturnId: string, itemId: string) => apiClient.delete<PurchaseReturn>(`/purchase-returns/${purchaseReturnId}/replacements/${itemId}`),
  addSettlement: (purchaseReturnId: string, payload: Record<string, unknown>) => apiClient.post<PurchaseReturn>(`/purchase-returns/${purchaseReturnId}/settlements`, payload),
  removeSettlement: (purchaseReturnId: string, settlementId: string) => apiClient.delete<PurchaseReturn>(`/purchase-returns/${purchaseReturnId}/settlements/${settlementId}`),
  validate: (purchaseReturnId: string) => apiClient.post<PurchaseReturn>(`/purchase-returns/${purchaseReturnId}/validate`),
  cancel: (purchaseReturnId: string) => apiClient.post<PurchaseReturn>(`/purchase-returns/${purchaseReturnId}/cancel`),
  getAttachments: (purchaseReturnId: string) => apiClient.get<PurchaseAttachment[]>(`/purchase-returns/${purchaseReturnId}/attachments`),
  uploadAttachment: (purchaseReturnId: string, payload: { file: File; attachmentType?: string; description?: string }) => {
    const form = new FormData();
    form.append('file', payload.file);
    if (payload.attachmentType) form.append('attachmentType', payload.attachmentType);
    if (payload.description) form.append('description', payload.description);
    return apiClient.post<PurchaseAttachment>(`/purchase-returns/${purchaseReturnId}/attachments`, form);
  },
  getAttachmentUrl: (purchaseReturnId: string, attachmentId: string) => apiClient.get<{ signedUrl: string } & PurchaseAttachment>(`/purchase-returns/${purchaseReturnId}/attachments/${attachmentId}/url`),
  deleteAttachment: (purchaseReturnId: string, attachmentId: string) => apiClient.delete<{ deleted: boolean }>(`/purchase-returns/${purchaseReturnId}/attachments/${attachmentId}`),
  getSupplierCredits: () => apiClient.get<SupplierCredit[]>('/purchase-returns/supplier-credits'),
};
