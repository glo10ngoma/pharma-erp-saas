import { apiClient } from './apiClient';

export type AuthUser = {
  id: string;
  tenantId: string;
  siteId?: string;
  fullName: string;
  email?: string;
  role: string;
  permissions: string[];
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export const authService = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>('/auth/login', { email, password }),
  me: () => apiClient.get<AuthUser>('/auth/me'),
};
