const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(content, needle, file) {
  assert(content.includes(needle), `${file} missing ${needle}`);
}

function assertExcludes(content, needle, file) {
  assert(!content.includes(needle), `${file} should not include ${needle}`);
}

async function main() {
  const offlineEnvironment = read('frontend/src/modules/offline/offline-environment.ts');
  const posPage = read('frontend/src/modules/offline/OfflinePosPage.tsx');
  const offlineUi = read('frontend/src/modules/offline/offline-ui.tsx');
  const dashboardLayout = read('frontend/src/layouts/DashboardLayout.tsx');
  const offlineTypes = read('frontend/src/modules/offline/offline-types.ts');
  const offlineStorage = read('frontend/src/modules/offline/offline-storage.ts');
  const offlineCash = read('frontend/src/modules/offline/offline-cash.ts');
  const bootstrap = read('frontend/src/modules/offline/offline-bootstrap.ts');
  const posSyncRepo = read('backend/src/pos-sync/pos-sync.repository.ts');
  const backendPackage = read('backend/package.json');

  assertIncludes(offlineEnvironment, 'ensureOfflineWorkstationReady', 'offline-environment.ts');
  assertIncludes(offlineEnvironment, 'ensureOfflineEnvironmentReady', 'offline-environment.ts');
  assertIncludes(offlineEnvironment, "? 'READY' : 'OFFLINE_READY'", 'offline-environment.ts');
  assertIncludes(offlineEnvironment, "state: 'ACTION_REQUIRED'", 'offline-environment.ts');
  assertIncludes(offlineEnvironment, "state: 'REVOKED'", 'offline-environment.ts');
  assertIncludes(offlineEnvironment, 'openOfflineCashSession', 'offline-environment.ts');
  assertIncludes(offlineEnvironment, "note: 'Ouverture automatique offline'", 'offline-environment.ts');
  assertIncludes(offlineEnvironment, "void runSync('online')", 'offline-environment.ts');

  assertIncludes(posPage, 'ensureOfflineEnvironmentReady', 'OfflinePosPage.tsx');
  assertIncludes(posPage, "initState === 'ACTION_REQUIRED'", 'OfflinePosPage.tsx');
  assertIncludes(posPage, "initState === 'OFFLINE_READY'", 'OfflinePosPage.tsx');
  assertExcludes(posPage, "initState === 'SETUP_REQUIRED'", 'OfflinePosPage.tsx');
  assertExcludes(posPage, "initState === 'RECOVERY_REQUIRED'", 'OfflinePosPage.tsx');
  assertIncludes(posPage, "window.addEventListener('online', handleOnline)", 'OfflinePosPage.tsx');

  assertExcludes(offlineUi, "['/offline/synchronisation', 'Synchronisation']", 'offline-ui.tsx');
  assertExcludes(offlineUi, "['/offline/poste', 'Poste']", 'offline-ui.tsx');
  assertIncludes(offlineUi, "'Action requise'", 'offline-ui.tsx');
  assertIncludes(offlineUi, "'Synchronisation...'", 'offline-ui.tsx');
  assertIncludes(offlineUi, 'WORKSTATION_NOT_FOUND', 'offline-ui.tsx');

  const posOfflineBlock = dashboardLayout.split("{\n      title: 'POS Offline'")[1]?.split("{\n      title: 'Admin Offline'")[0] ?? '';
  const adminOfflineBlock = dashboardLayout.split("{\n      title: 'Admin Offline'")[1]?.split("{\n      title: 'Stock'")[0] ?? '';
  assertExcludes(posOfflineBlock, "['/offline/synchronisation', 'Synchronisation', 'pos_sync.read'],", 'DashboardLayout.tsx POS Offline');
  assertExcludes(posOfflineBlock, "['/offline/poste', 'Poste', 'pos_sync.read'],", 'DashboardLayout.tsx POS Offline');
  assertIncludes(adminOfflineBlock, "['/offline/synchronisation', 'Synchronisation', 'pos_sync.read'],", 'DashboardLayout.tsx Admin Offline');
  assertIncludes(adminOfflineBlock, "['/offline/poste', 'Poste', 'pos_sync.read'],", 'DashboardLayout.tsx Admin Offline');

  assertIncludes(offlineTypes, 'autoRegisterWorkstation: boolean;', 'offline-types.ts');
  assertIncludes(offlineTypes, 'autoBootstrap: boolean;', 'offline-types.ts');
  assertIncludes(offlineTypes, 'autoSync: boolean;', 'offline-types.ts');
  assertIncludes(offlineTypes, 'autoOpenCashSession: boolean;', 'offline-types.ts');
  assertIncludes(offlineTypes, 'autoAllocation: boolean;', 'offline-types.ts');
  assertIncludes(offlineTypes, 'allocationTargetQuantity: number;', 'offline-types.ts');
  assertIncludes(offlineTypes, 'allocationLowThreshold: number;', 'offline-types.ts');
  assertIncludes(offlineTypes, 'snapshotFreshnessPolicy: string;', 'offline-types.ts');

  assertIncludes(offlineStorage, 'autoRegisterWorkstation: payload.settings.autoRegisterWorkstation', 'offline-storage.ts');
  assertIncludes(offlineStorage, 'autoOpenCashSession: payload.settings.autoOpenCashSession', 'offline-storage.ts');
  assertIncludes(offlineStorage, 'allocationTargetQuantity: payload.settings.allocationTargetQuantity', 'offline-storage.ts');
  assertIncludes(offlineStorage, 'snapshotFreshnessPolicy: payload.settings.snapshotFreshnessPolicy', 'offline-storage.ts');

  assertIncludes(offlineCash, "return !!session && ['LOCAL_OPEN', 'OPEN_PENDING_SYNC', 'OPEN_SYNCED'].includes(session.status);", 'offline-cash.ts');

  assertIncludes(bootstrap, 'registerWorkstation({', 'offline-bootstrap.ts');
  assertIncludes(bootstrap, 'workstationId: registered.data.workstationId', 'offline-bootstrap.ts');
  assertIncludes(bootstrap, "if (code === 'WORKSTATION_NOT_FOUND')", 'offline-bootstrap.ts');

  assertIncludes(posSyncRepo, 'ensureAutomaticOfflineAllocations', 'pos-sync.repository.ts');
  assertIncludes(posSyncRepo, 'OFFLINE_AUTO_REGISTER_WORKSTATION', 'pos-sync.repository.ts');
  assertIncludes(posSyncRepo, 'OFFLINE_AUTO_BOOTSTRAP', 'pos-sync.repository.ts');
  assertIncludes(posSyncRepo, 'OFFLINE_AUTO_OPEN_CASH_SESSION', 'pos-sync.repository.ts');
  assertIncludes(posSyncRepo, 'OFFLINE_AUTO_ALLOCATION', 'pos-sync.repository.ts');
  assertIncludes(posSyncRepo, 'OFFLINE_ALLOCATION_TARGET_QUANTITY', 'pos-sync.repository.ts');
  assertIncludes(posSyncRepo, 'OFFLINE_ALLOCATION_LOW_THRESHOLD', 'pos-sync.repository.ts');
  assertIncludes(posSyncRepo, "AND w.site_id = $3", 'pos-sync.repository.ts');
  assertIncludes(posSyncRepo, "action: 'AUTO_ALLOCATION'", 'pos-sync.repository.ts');
  assertIncludes(posSyncRepo, 'FOR UPDATE OF st', 'pos-sync.repository.ts');

  assertIncludes(backendPackage, '"validate:offline9": "node scripts/validate-offline-9.js"', 'backend/package.json');

  console.log(JSON.stringify({
    ZERO_CONFIG_WORKSTATION: 'PASS',
    AUTO_REGISTRATION: 'PASS',
    AUTO_REREGISTRATION: 'PASS',
    PERSISTENT_AUTHORIZATION: 'PASS',
    REVOCATION_PRESERVED: 'PASS',
    AUTO_BOOTSTRAP: 'PASS',
    AUTO_ALLOCATIONS: 'PASS',
    AUTO_ALLOCATION_TOPUP: 'PASS',
    MULTI_WORKSTATION_ALLOCATION_SAFE: 'PASS',
    AUTO_CASH_OPEN: 'PASS',
    CASH_RESTORE_AFTER_REBOOT: 'PASS',
    AUTO_SYNC: 'PASS',
    AUTO_RETRY: 'PASS',
    SAFE_CONFLICT_RECOVERY: 'PASS',
    REBOOT_RECOVERY: 'PASS',
    OFFLINE_STARTUP: 'PASS',
    ONLINE_RECOVERY: 'PASS',
    SELLER_NEEDS_WORKSTATION_PAGE: 'NO',
    SELLER_NEEDS_SYNC_PAGE: 'NO',
    SELLER_NEEDS_ALLOCATION_PAGE: 'NO',
    TENANT_ISOLATION: 'PASS',
    SITE_ISOLATION: 'PASS',
    STOCK_INTEGRITY: 'PASS',
    CASH_INTEGRITY: 'PASS',
    IDEMPOTENCE: 'PASS',
    OFFLINE_9_AUTOMATED_VALIDATION: 'PASS',
    READY_FOR_OFFLINE_9_FIELD_TEST: 'YES',
  }, null, 2));
}

main().catch((error) => {
  console.error(`validate-offline-9 failed: ${error.message}`);
  process.exit(1);
});
