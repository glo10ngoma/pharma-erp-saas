import { apiClient } from './apiClient';

export type RoleItem = {
  roleId: string;
  tenantId: string;
  roleName: string;
  description: string | null;
  isActive: boolean;
  permissions: string[];
};

export type CreateRolePayload = {
  roleName: string;
  description?: string;
  permissionIds?: string[];
  isActive?: boolean;
};

export const rolesService = {
  getAll: () => apiClient.get<RoleItem[]>('/roles'),
  create: (payload: CreateRolePayload) => apiClient.post<RoleItem>('/roles', payload),
  assignPermissions: (roleId: string, permissionIds: string[]) =>
    apiClient.put<RoleItem>(`/roles/${roleId}/permissions`, { permissionIds }),
};
