import { apiClient } from './apiClient';
import { PurchaseAttachment } from './purchases.service';
import { Sale, SalesListResponse } from './sales.service';

export type CustomerReturnItem = {
  customerReturnItemId: string;
  customerReturnId: string;
  saleId?: string | null;
  saleItemId?: string | null;
  articleId: string;
  articleCode?: string | null;
  commercialName?: string | null;
  lotId?: string | null;
  lotNumber?: string | null;
  expiryDate?: string | null;
  declaredLotNumber?: string | null;
  declaredExpiryDate?: string | null;
  saleQuantity: number;
  returnedQuantity: number;
  conditionStatus: string;
  reason?: string | null;
  note?: string | null;
  unitPriceSnapshot?: number;
  declaredUnitPrice?: number;
  lineReturnValue?: number;
  salesUnitSnapshot?: string | null;
  packagingSnapshot?: string | null;
  createdAt: string;
};

export type CustomerReturnReplacementItem = {
  customerReturnReplacementItemId: string;
  customerReturnId: string;
  articleId: string;
  articleCode?: string | null;
  commercialName?: string | null;
  salesUnitId?: string | null;
  salesUnitSnapshot?: string | null;
  packagingSnapshot?: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
  createdBy?: string | null;
  createdAt: string;
};

export type CustomerReturnSettlement = {
  customerReturnSettlementId: string;
  customerReturnId: string;
  customerId?: string | null;
  settlementKind: string;
  paymentSource: string;
  currencyCode: string;
  exchangeRateApplied: number;
  amount: number;
  amountEquivalentUsd: number;
  cashSessionId?: string | null;
  expirationDate?: string | null;
  reference?: string | null;
  note?: string | null;
  createdBy?: string | null;
  createdAt: string;
};

export type CustomerCredit = {
  customerCreditId: string;
  customerId: string;
  customerName?: string | null;
  customerReturnId?: string | null;
  currencyCode: string;
  initialAmount: number;
  remainingAmount: number;
  exchangeRateApplied: number;
  status: string;
  expirationDate?: string | null;
  reference?: string | null;
  note?: string | null;
  createdBy?: string | null;
  createdAt: string;
  usedAt?: string | null;
  cancelledAt?: string | null;
};

export type CustomerReturnSaleItem = NonNullable<Sale['items']>[number] & {
  soldQuantity: number;
  returnedQuantity: number;
  availableQuantity: number;
};

export type CustomerReturnSale = Sale & {
  returnableItems?: CustomerReturnSaleItem[];
};

export type CustomerReturn = {
  customerReturnId: string;
  tenantId: string;
  siteId: string;
  siteName?: string | null;
  saleId: string;
  saleNumberSnapshot: string;
  saleDateSnapshot: string;
  saleTypeSnapshot: string;
  customerId?: string | null;
  customerNameSnapshot?: string | null;
  organizationId?: string | null;
  organizationNameSnapshot?: string | null;
  membershipId?: string | null;
  siteNameSnapshot: string;
  currencyCode: string;
  exchangeRateSnapshot: number;
  returnNumber: string;
  returnDate: string;
  status: string;
  reason?: string | null;
  note?: string | null;
  inspectionNote?: string | null;
  returnedValueUsd?: number;
  replacementValueUsd?: number;
  financialDifferenceUsd?: number;
  refundDueUsd?: number;
  additionalPaymentDueUsd?: number;
  customerCreditUsd?: number;
  refundedAmountUsd?: number;
  additionalPaidUsd?: number;
  saleLinkStatus?: string;
  traceabilityStatus?: string;
  probableSaleId?: string | null;
  confidenceScore?: number;
  createdWithoutSale?: boolean;
  approvedWithoutSale?: boolean;
  approvedBy?: string | null;
  approvedAt?: string | null;
  declaredCustomerName?: string | null;
  declaredCustomerPhone?: string | null;
  declaredArticleId?: string | null;
  declaredArticleName?: string | null;
  declaredQuantity?: number | null;
  declaredLotNumber?: string | null;
  declaredExpiryDate?: string | null;
  approximatePurchaseDate?: string | null;
  supposedSiteId?: string | null;
  declaredPrice?: number | null;
  responsibilityOrigin?: string | null;
  commercialDecision?: string | null;
  traceabilityNote?: string | null;
  createdBy?: string | null;
  inspectedBy?: string | null;
  validatedBy?: string | null;
  createdAt: string;
  inspectedAt?: string | null;
  validatedAt?: string | null;
  cancelledAt?: string | null;
  itemsCount?: number;
  items?: CustomerReturnItem[];
  replacementItems?: CustomerReturnReplacementItem[];
  settlements?: CustomerReturnSettlement[];
  customerCredits?: CustomerCredit[];
  sale?: CustomerReturnSale | null;
};

export type CustomerReturnListResponse = {
  items: CustomerReturn[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export const customerReturnsService = {
  getAll: (params?: Record<string, string | number | undefined>) =>
    apiClient.get<CustomerReturnListResponse>('/customer-returns', { params }),
  getById: (id: string) => apiClient.get<CustomerReturn>(`/customer-returns/${id}`),
  create: (payload: Record<string, unknown>) => apiClient.post<CustomerReturn>('/customer-returns', payload),
  update: (id: string, payload: Record<string, unknown>) => apiClient.patch<CustomerReturn>(`/customer-returns/${id}`, payload),
  addItem: (id: string, payload: Record<string, unknown>) => apiClient.post<CustomerReturn>(`/customer-returns/${id}/items`, payload),
  removeItem: (id: string, itemId: string) => apiClient.delete<CustomerReturn>(`/customer-returns/${id}/items/${itemId}`),
  addReplacement: (id: string, payload: Record<string, unknown>) => apiClient.post<CustomerReturn>(`/customer-returns/${id}/replacements`, payload),
  removeReplacement: (id: string, itemId: string) => apiClient.delete<CustomerReturn>(`/customer-returns/${id}/replacements/${itemId}`),
  addSettlement: (id: string, payload: Record<string, unknown>) => apiClient.post<CustomerReturn>(`/customer-returns/${id}/settlements`, payload),
  removeSettlement: (id: string, settlementId: string) => apiClient.delete<CustomerReturn>(`/customer-returns/${id}/settlements/${settlementId}`),
  submitInspection: (id: string) => apiClient.post<{ submitted: boolean }>(`/customer-returns/${id}/submit-inspection`),
  inspect: (id: string, payload: Record<string, unknown>) => apiClient.post<{ inspected: boolean; status: string }>(`/customer-returns/${id}/inspect`, payload),
  validate: (id: string) => apiClient.post<{ validated: boolean }>(`/customer-returns/${id}/validate`),
  cancel: (id: string) => apiClient.post<{ cancelled: boolean }>(`/customer-returns/${id}/cancel`),
  getCustomerCredits: (customerId?: string) => apiClient.get<CustomerCredit[]>('/customer-returns/customer-credits', { params: { customerId: customerId || undefined } }),
  searchValidatedSales: (params?: Record<string, string | number | undefined>) =>
    apiClient.get<SalesListResponse>('/customer-returns/validated-sales', { params }),
  searchProbableSales: (params?: Record<string, string | number | undefined>) =>
    apiClient.get<Array<{
      saleId: string;
      saleNumber: string;
      saleDate: string;
      customerName?: string | null;
      customerPhone?: string | null;
      siteId: string;
      siteName?: string | null;
      totalAmount: number;
      currencyCode?: string | null;
      articleHits: number;
      lotHits: number;
      confidenceScore: number;
      traceabilityLabel: string;
    }>>('/customer-returns/sales-search', { params }),
  getTraceability: (id: string) => apiClient.get<Record<string, unknown>>(`/customer-returns/${id}/traceability`),
  approveUnlinked: (id: string) => apiClient.post<CustomerReturn>(`/customer-returns/${id}/approve-unlinked`),
  getAttachments: (customerReturnId: string) => apiClient.get<PurchaseAttachment[]>(`/customer-returns/${customerReturnId}/attachments`),
  uploadAttachment: (customerReturnId: string, payload: { file: File; attachmentType?: string; description?: string }) => {
    const form = new FormData();
    form.append('file', payload.file);
    if (payload.attachmentType) form.append('attachmentType', payload.attachmentType);
    if (payload.description) form.append('description', payload.description);
    return apiClient.post<PurchaseAttachment>(`/customer-returns/${customerReturnId}/attachments`, form);
  },
  getAttachmentUrl: (customerReturnId: string, attachmentId: string) =>
    apiClient.get<{ signedUrl: string } & PurchaseAttachment>(`/customer-returns/${customerReturnId}/attachments/${attachmentId}/url`),
  deleteAttachment: (customerReturnId: string, attachmentId: string) =>
    apiClient.delete<{ deleted: boolean }>(`/customer-returns/${customerReturnId}/attachments/${attachmentId}`),
};
