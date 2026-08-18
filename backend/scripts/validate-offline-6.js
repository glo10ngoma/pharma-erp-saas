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

async function main() {
  const config = read('frontend/src/modules/offline/offline-config.ts');
  const storage = read('frontend/src/modules/offline/offline-storage.ts');
  const recovery = read('frontend/src/modules/offline/offline-recovery.ts');
  const workstation = read('frontend/src/modules/offline/OfflineWorkstationPage.tsx');
  const syncEngine = read('frontend/src/modules/offline/sync-engine.ts');
  const manifest = read('frontend/public/manifest.webmanifest');
  const installDoc = read('docs/POS_OFFLINE_INSTALLATION.md');
  const readinessDoc = read('docs/POS_OFFLINE_PRODUCTION_READINESS.md');

  assertIncludes(config, 'OFFLINE_DB_VERSION = 7', 'offline-config.ts');
  assertIncludes(config, 'OFFLINE_RETENTION_DAYS', 'offline-config.ts');
  assertIncludes(storage, 'OFFLINE_METADATA_STORE', 'offline-storage.ts');
  assertIncludes(storage, 'createDefaultOfflineMetadata', 'offline-storage.ts');
  assert(!storage.includes('indexedDB.deleteDatabase'), 'offline-storage.ts must not delete the IndexedDB database');
  assertIncludes(syncEngine, 'localDbVersion: String(OFFLINE_DB_VERSION)', 'sync-engine.ts');
  assertIncludes(recovery, 'runOfflineRecovery', 'offline-recovery.ts');
  assertIncludes(recovery, 'SALE_WITHOUT_QUEUE', 'offline-recovery.ts');
  assertIncludes(recovery, 'resetStaleSyncingQueueEntries', 'offline-recovery.ts');
  assertIncludes(workstation, 'Exporter diagnostic', 'OfflineWorkstationPage.tsx');
  assertIncludes(workstation, 'Nettoyer donnees synchronisees', 'OfflineWorkstationPage.tsx');
  assertIncludes(manifest, '"name": "PharmaERP POS"', 'manifest.webmanifest');
  assertIncludes(installDoc, 'Installation POS Offline', 'POS_OFFLINE_INSTALLATION.md');
  assertIncludes(readinessDoc, 'Production Readiness Offline 6', 'POS_OFFLINE_PRODUCTION_READINESS.md');

  console.log('OFFLINE_6_STORAGE_VERSIONING = PASS');
  console.log('OFFLINE_6_RECOVERY_GUARDS = PASS');
  console.log('OFFLINE_6_WORKSTATION_HEALTH_UI = PASS');
  console.log('OFFLINE_6_INSTALLATION_DOCS = PASS');
}

main().catch((error) => {
  console.error(`validate-offline-6 failed: ${error.message}`);
  process.exit(1);
});
