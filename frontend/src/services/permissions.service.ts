import { apiClient } from './apiClient';

export type PermissionItem = {
  permissionId: string;
  permissionCode: string;
  permissionName: string;
  moduleName: string;
  description: string | null;
  isSystemPermission: boolean;
};

export type CreatePermissionPayload = {
  permissionCode: string;
  permissionName: string;
  moduleName: string;
  description?: string;
  isSystemPermission?: boolean;
};

export const permissionsService = {
  getAll: () => apiClient.get<PermissionItem[]>('/permissions'),
  create: (payload: CreatePermissionPayload) =>
    apiClient.post<PermissionItem>('/permissions', payload),
};
