const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OFFLINE_CONTEXT_PATH = path.join(REPO_ROOT, 'frontend', 'src', 'modules', 'offline', 'offline-context.ts');

function loadTsModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  }).outputText;

  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports }, { filename: filePath });
  return module.exports;
}

const {
  isOfflineSnapshotContextCompatible,
  resolveBootstrapSiteId,
} = loadTsModule(OFFLINE_CONTEXT_PATH);

assert.strictEqual(
  resolveBootstrapSiteId({
    userTenantId: 'CANA',
    userSiteId: 'CANA-MATETE',
    snapshotTenantId: 'CANA',
    snapshotSiteId: 'CANA-MATETE',
  }),
  'CANA-MATETE',
  'mono-site user should reuse a matching local snapshot site',
);

assert.strictEqual(
  isOfflineSnapshotContextCompatible({
    userTenantId: 'CANA',
    userSiteId: 'CANA-MATETE',
    snapshotTenantId: 'PLATFORM',
    snapshotSiteId: 'PLATFORM-SITE',
  }),
  false,
  'snapshot from another tenant must not be reused',
);

assert.strictEqual(
  resolveBootstrapSiteId({
    userTenantId: 'CANA',
    userSiteId: 'CANA-MATETE',
    snapshotTenantId: 'PLATFORM',
    snapshotSiteId: 'PLATFORM-SITE',
  }),
  'CANA-MATETE',
  'mono-site user must fall back to the authenticated site when local snapshot is from another tenant',
);

assert.strictEqual(
  resolveBootstrapSiteId({
    userTenantId: 'CANA',
    userSiteId: 'CANA-MATETE',
    snapshotTenantId: 'CANA',
    snapshotSiteId: 'OTHER-SITE',
  }),
  'CANA-MATETE',
  'mono-site user must not reuse a different site from the local snapshot',
);

assert.strictEqual(
  resolveBootstrapSiteId({
    userTenantId: 'CANA',
    userSiteId: null,
    snapshotTenantId: 'CANA',
    snapshotSiteId: 'CANA-MATETE',
  }),
  'CANA-MATETE',
  'tenant-level user may reuse a same-tenant local snapshot site',
);

assert.strictEqual(
  resolveBootstrapSiteId({
    requestedSiteId: 'REQUESTED-SITE',
    userTenantId: 'CANA',
    userSiteId: 'CANA-MATETE',
    snapshotTenantId: 'CANA',
    snapshotSiteId: 'CANA-MATETE',
  }),
  'REQUESTED-SITE',
  'explicit site selection must remain authoritative and backend-authorized',
);

assert.strictEqual(
  resolveBootstrapSiteId({
    userTenantId: 'PLATFORM',
    userSiteId: null,
    snapshotTenantId: 'CANA',
    snapshotSiteId: 'CANA-MATETE',
  }),
  '',
  'platform user without active CANA context must not inherit CANA from local snapshot',
);

assert.strictEqual(
  isOfflineSnapshotContextCompatible({
    userTenantId: 'CANA',
    userSiteId: 'CANA-MATETE',
    snapshotTenantId: 'CANA',
    snapshotSiteId: 'CANA-MATETE',
  }),
  true,
  'active CANA/MATETE context must accept the matching local snapshot',
);

console.log('validate-offline-context-resolution: PASS');
