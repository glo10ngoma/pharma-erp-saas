import { apiClient } from './apiClient';
import { PurchaseAttachment } from './purchases.service';
import { Sale, SalesListResponse } from './sales.service';

export type CustomerReturnItem = {
  customerReturnItemId: string;
  customerReturnId: string;
  saleId: string;
  saleItemId: string;
  articleId: string;
  articleCode?: string | null;
  commercialName?: string | null;
  lotId?: string | null;
  lotNumber?: string | null;
  expiryDate?: string | null;
  saleQuantity: number;
  returnedQuantity: number;
  conditionStatus: string;
  note?: string | null;
  createdAt: string;
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
  createdBy?: string | null;
  inspectedBy?: string | null;
  validatedBy?: string | null;
  createdAt: string;
  inspectedAt?: string | null;
  validatedAt?: string | null;
  cancelledAt?: string | null;
  itemsCount?: number;
  items?: CustomerReturnItem[];
  sale?: CustomerReturnSale;
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
  addItem: (id: string, payload: Record<string, unknown>) => apiClient.post<CustomerReturn>(`/customer-returns/${id}/items`, payload),
  removeItem: (id: string, itemId: string) => apiClient.delete<CustomerReturn>(`/customer-returns/${id}/items/${itemId}`),
  submitInspection: (id: string) => apiClient.post<{ submitted: boolean }>(`/customer-returns/${id}/submit-inspection`),
  inspect: (id: string, payload: Record<string, unknown>) => apiClient.post<{ inspected: boolean; status: string }>(`/customer-returns/${id}/inspect`, payload),
  validate: (id: string) => apiClient.post<{ validated: boolean }>(`/customer-returns/${id}/validate`),
  cancel: (id: string) => apiClient.post<{ cancelled: boolean }>(`/customer-returns/${id}/cancel`),
  searchValidatedSales: (params?: Record<string, string | number | undefined>) =>
    apiClient.get<SalesListResponse>('/customer-returns/validated-sales', { params }),
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
