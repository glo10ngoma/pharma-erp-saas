import { apiClient } from './apiClient';

export type UserItem = {
  userId: string;
  tenantId: string;
  siteId: string;
  roleId: string;
  fullName: string;
  username: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  roleName: string | null;
  siteName: string | null;
};

export type CreateUserPayload = {
  fullName: string;
  username: string;
  email?: string;
  phone?: string;
  siteId: string;
  roleId: string;
  password: string;
  isActive?: boolean;
};

export const usersService = {
  getAll: () => apiClient.get<UserItem[]>('/users'),
  create: (payload: CreateUserPayload) => apiClient.post<UserItem>('/users', payload),
};
