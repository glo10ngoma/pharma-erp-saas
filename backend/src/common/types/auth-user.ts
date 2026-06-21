export type AuthUser = {
  userId: string;
  email?: string;
  fullName: string;
  tenantId: string;
  siteId?: string;
  role: string;
  permissions: string[];
};
