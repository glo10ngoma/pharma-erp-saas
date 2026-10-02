import { apiClient } from './apiClient';

export type UserItem = {
  userId: string;
  tenantId: string;
  siteId: string;
  roleId: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  postName: string | null;
  gender: string | null;
  birthDate: string | null;
  jobTitle: string | null;
  employeeNumber: string | null;
  department: string | null;
  username: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  roleName: string | null;
  siteName: string | null;
};

export type CreateUserPayload = {
  fullName: string;
  firstName: string;
  lastName: string;
  postName?: string;
  gender?: string;
  birthDate?: string;
  jobTitle: string;
  department?: string;
  username: string;
  email: string;
  phone?: string;
  siteId: string;
  roleId: string;
  password: string;
  isActive?: boolean;
};

export type UpdateUserPayload = Omit<CreateUserPayload, 'password'> & {
  password?: string;
};

export const usersService = {
  getAll: () => apiClient.get<UserItem[]>('/users'),
  create: (payload: CreateUserPayload) => apiClient.post<UserItem>('/users', payload),
  update: (userId: string, payload: UpdateUserPayload) => apiClient.patch<UserItem>(`/users/${userId}`, payload),
};
