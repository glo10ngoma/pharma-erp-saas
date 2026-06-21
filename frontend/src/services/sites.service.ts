import { apiClient } from './apiClient';

export type SiteItem = {
  siteId: string;
  tenantId: string;
  siteCode: string;
  siteName: string;
  siteType: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
};

export type CreateSitePayload = {
  siteCode: string;
  siteName: string;
  siteType: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
};

export const sitesService = {
  getAll: () => apiClient.get<SiteItem[]>('/sites'),
  create: (payload: CreateSitePayload) => apiClient.post<SiteItem>('/sites', payload),
};
