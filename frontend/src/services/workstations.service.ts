import { apiClient } from './apiClient';

export type Workstation = {
  workstationId: string;
  tenantId: string;
  siteId?: string | null;
  siteName?: string | null;
  workstationCode: string;
  workstationName: string;
  workstationType: string;
  isActive: boolean;
  deviceUuid?: string | null;
  offlineStatus: string;
  syncState: string;
  isSynced: boolean;
  lastSyncAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export const workstationsService = {
  getAll: () => apiClient.get<Workstation[]>('/workstations'),
  getById: (id: string) => apiClient.get<Workstation>(`/workstations/${id}`),
  create: (payload: Record<string, unknown>) => apiClient.post<Workstation>('/workstations', payload),
  update: (id: string, payload: Record<string, unknown>) => apiClient.patch<Workstation>(`/workstations/${id}`, payload),
};
