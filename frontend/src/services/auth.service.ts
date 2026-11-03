import { apiClient } from './apiClient';

export type AuthUser = {
  id: string;
  homeTenantId?: string;
  homeSiteId?: string;
  tenantId: string;
  siteId?: string;
  activeTenantId?: string;
  activeSiteId?: string;
  fullName: string;
  email?: string;
  role: string;
  permissions: string[];
};

export type AccessibleOrganization = {
  id: string;
  code: string | null;
  name: string;
};

export type AccessibleSite = {
  id: string;
  code: string | null;
  name: string;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export type SwitchContextResponse = {
  accessToken: string;
  user: AuthUser;
  sites: AccessibleSite[];
};

export const authService = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>('/auth/login', { email, password }),
  me: () => apiClient.get<AuthUser>('/auth/me'),
  organizations: () => apiClient.get<AccessibleOrganization[]>('/auth/organizations'),
  sites: (tenantId?: string) => apiClient.get<AccessibleSite[]>('/auth/sites', { params: tenantId ? { tenantId } : undefined }),
  switchOrganization: (tenantId: string) =>
    apiClient.post<SwitchContextResponse>('/auth/switch-organization', { tenantId }),
  switchSite: (siteId: string) =>
    apiClient.post<SwitchContextResponse>('/auth/switch-site', { siteId }),
  changePassword: (payload: { oldPassword: string; newPassword: string; confirmPassword: string }) =>
    apiClient.post<{ changed: boolean }>('/auth/change-password', payload),
};
