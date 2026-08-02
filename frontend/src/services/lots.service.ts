import { apiClient } from './apiClient';

export type Lot = { lotId: string; articleId: string; articleCode: string | null; commercialName: string | null; supplierName: string | null; lotNumber: string; expiryDate: string; purchasePrice: number; sellingPrice: number; currencyCode?: string | null; currencySymbol?: string | null; isBlocked: boolean; blockReason: string | null };
export type FefoAction = {
  fefoActionId: string;
  tenantId: string;
  siteId: string;
  siteName: string | null;
  articleId: string;
  articleCode: string | null;
  articleName: string | null;
  lotId: string;
  lotNumber: string | null;
  priorityAtAction: 'EXPIRED' | 'BLOCKED' | 'RED' | 'ORANGE' | 'GREEN';
  actionType: 'HIGHLIGHT_CONFIRMED' | 'SHELF_ROTATION_CONFIRMED' | 'REMOVED_EXPIRED' | 'COMMENT_ADDED';
  actionStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  quantity: number | null;
  note: string | null;
  requestKey?: string | null;
  stockMovementId?: string | null;
  performedBy?: string | null;
  performedByName?: string | null;
  performedAt: string;
  createdAt: string;
};

export const lotsService = {
  getAll: () => apiClient.get<Lot[]>('/lots'),
  block: (id: string, reason?: string) => apiClient.post<Lot>(`/lots/${id}/block`, { reason }),
  unblock: (id: string) => apiClient.post<Lot>(`/lots/${id}/unblock`),
  getFefoActions: (params?: { siteId?: string }) => apiClient.get<FefoAction[]>('/lots/fefo-actions', { params }),
  confirmFefoAction: (id: string, payload: { siteId: string; actionType: 'HIGHLIGHT_CONFIRMED' | 'SHELF_ROTATION_CONFIRMED'; note?: string; requestKey?: string }) =>
    apiClient.post<FefoAction>(`/lots/${id}/fefo-actions`, payload),
  removeExpiredStock: (id: string, payload: { siteId: string; quantity: number; reason?: string; note?: string; requestKey?: string }) =>
    apiClient.post<FefoAction>(`/lots/${id}/remove-expired-stock`, payload),
};
