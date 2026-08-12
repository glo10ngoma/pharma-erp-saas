import { apiClient } from './apiClient';

export type OfflineAllocationRecord = {
  allocationId: string;
  tenantId: string;
  siteId: string;
  siteName: string | null;
  workstationId: string;
  workstationName: string | null;
  articleId: string;
  articleCode: string | null;
  articleName: string | null;
  lotId: string;
  lotNumber: string | null;
  expiryDate: string | null;
  isBlocked: boolean;
  blockReason: string | null;
  allocatedQuantity: number;
  consumedQuantity: number;
  remainingQuantity: number;
  status: string;
  serverVersion: number;
  updatedAt: string | null;
};

export type OfflineAllocationListQuery = {
  siteId?: string;
  workstationId?: string;
  articleId?: string;
  lotId?: string;
  status?: string;
  search?: string;
};

export const offlineAllocationsService = {
  getAll: (params: OfflineAllocationListQuery = {}) =>
    apiClient.get<OfflineAllocationRecord[]>('/offline-allocations', { params }),
  getById: (id: string) =>
    apiClient.get<OfflineAllocationRecord>(`/offline-allocations/${id}`),
  create: (payload: Record<string, unknown>) =>
    apiClient.post<OfflineAllocationRecord>('/offline-allocations', payload),
  update: (id: string, payload: Record<string, unknown>) =>
    apiClient.patch<OfflineAllocationRecord>(`/offline-allocations/${id}`, payload),
  suspend: (id: string) =>
    apiClient.post<OfflineAllocationRecord>(`/offline-allocations/${id}/suspend`, {}),
  revoke: (id: string) =>
    apiClient.post<OfflineAllocationRecord>(`/offline-allocations/${id}/revoke`, {}),
  release: (id: string) =>
    apiClient.post<OfflineAllocationRecord>(`/offline-allocations/${id}/release`, {}),
  transfer: (payload: Record<string, unknown>) =>
    apiClient.post<{ source: OfflineAllocationRecord; target: OfflineAllocationRecord | null }>('/offline-allocations/transfer', payload),
  rebalance: (payload: Record<string, unknown>) =>
    apiClient.post<OfflineAllocationRecord[]>('/offline-allocations/rebalance', payload),
};
