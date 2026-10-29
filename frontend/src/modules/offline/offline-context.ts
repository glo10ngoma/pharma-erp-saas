export type OfflineBootstrapSiteResolutionInput = {
  requestedSiteId?: string | null;
  userTenantId?: string | null;
  userSiteId?: string | null;
  snapshotTenantId?: string | null;
  snapshotSiteId?: string | null;
};

export function isOfflineSnapshotContextCompatible(input: OfflineBootstrapSiteResolutionInput) {
  const userTenantId = input.userTenantId?.trim() || '';
  const snapshotTenantId = input.snapshotTenantId?.trim() || '';
  const snapshotSiteId = input.snapshotSiteId?.trim() || '';
  const userSiteId = input.userSiteId?.trim() || '';

  if (!userTenantId || !snapshotTenantId || !snapshotSiteId) return false;
  if (snapshotTenantId !== userTenantId) return false;
  if (userSiteId && snapshotSiteId !== userSiteId) return false;
  return true;
}

export function resolveBootstrapSiteId(input: OfflineBootstrapSiteResolutionInput) {
  const requestedSiteId = input.requestedSiteId?.trim();
  if (requestedSiteId) return requestedSiteId;

  if (isOfflineSnapshotContextCompatible(input)) {
    return input.snapshotSiteId?.trim() ?? '';
  }

  return input.userSiteId?.trim() ?? '';
}
