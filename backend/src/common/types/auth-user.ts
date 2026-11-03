export type AuthUser = {
  userId: string;
  email?: string;
  fullName: string;
  homeTenantId?: string;
  homeSiteId?: string;
  tenantId: string;
  siteId?: string;
  role: string;
  permissions: string[];
};
