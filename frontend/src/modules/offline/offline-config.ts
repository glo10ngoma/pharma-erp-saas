export const OFFLINE_DB_NAME = 'PharmaErpPosDb';
export const OFFLINE_DB_VERSION = 6;
export const OFFLINE_SNAPSHOT_SCHEMA_VERSION = 2;
export const OFFLINE_APP_VERSION = import.meta.env.VITE_APP_VERSION ?? 'web';

export const OFFLINE_STORAGE_THRESHOLDS = {
  warningUsageRatio: 0.7,
  criticalUsageRatio: 0.85,
};

export const OFFLINE_RETENTION_DAYS = {
  syncedSales: 90,
  syncedQueue: 30,
  activityLogs: 30,
  resolvedConflicts: 90,
};

export const OFFLINE_STALE_SYNCING_MS = 5 * 60 * 1000;
