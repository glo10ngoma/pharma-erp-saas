import { apiClient } from './apiClient';

export type TransferItem = {
  transferItemId: string;
  transferId: string;
  articleId: string;
  articleCode: string | null;
  commercialName: string | null;
  lotId: string;
  lotNumber: string | null;
  expiryDate: string | null;
  quantity: number;
  quantitySent: number | null;
  quantityReceived: number | null;
  notes: string | null;
};

export type Transfer = {
  transferId: string;
  transferNumber: string;
  fromSiteId: string;
  fromSiteName: string | null;
  toSiteId: string;
  toSiteName: string | null;
  transferDate: string;
  status: string;
  notes: string | null;
  createdAt: string;
  validatedAt: string | null;
  items?: TransferItem[];
};

export const transfersService = {
  getAll: (status?: string) => apiClient.get<Transfer[]>('/transfers', { params: { status: status || undefined } }),
  getById: (id: string) => apiClient.get<Transfer>(`/transfers/${id}`),
  create: (payload: Record<string, unknown>) => apiClient.post<Transfer>('/transfers', payload),
  addItem: (transferId: string, payload: Record<string, unknown>) => apiClient.post<Transfer>(`/transfers/${transferId}/items`, payload),
  removeItem: (transferId: string, itemId: string) => apiClient.delete<Transfer>(`/transfers/${transferId}/items/${itemId}`),
  validate: (transferId: string) => apiClient.post<Transfer>(`/transfers/${transferId}/validate`),
};
