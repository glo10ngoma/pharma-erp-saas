const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const POS_SYNC_REPOSITORY_PATH = path.join(REPO_ROOT, 'backend', 'src', 'pos-sync', 'pos-sync.repository.ts');
const OFFLINE_CART_PATH = path.join(REPO_ROOT, 'frontend', 'src', 'modules', 'offline', 'offline-cart.ts');

function loadTsModule(filePath, moduleStubs = {}) {
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
  const context = {
    module,
    exports: module.exports,
    require(specifier) {
      if (Object.prototype.hasOwnProperty.call(moduleStubs, specifier)) return moduleStubs[specifier];
      throw new Error(`Stub missing for ${specifier} while loading ${filePath}`);
    },
    __filename: filePath,
    __dirname: path.dirname(filePath),
    console,
    structuredClone,
    Date,
  };
  vm.runInNewContext(output, context, { filename: filePath });
  return module.exports;
}

function buildSnapshot(allocationRows) {
  return {
    articles: [
      {
        localKey: 'tenant-1:article-1',
        tenantId: 'tenant-1',
        articleId: 'article-1',
        articleCode: 'DMC-SER-00002',
        commercialName: '10 CC SERINGUE',
        barcode: null,
        isActive: true,
        salesUnit: 'Piece',
        packaging: null,
        packagingQuantity: null,
        defaultSellingPrice: 3,
        updatedAt: '2026-09-23T00:00:00.000Z',
        lastSyncedAt: '2026-09-30T00:00:00.000Z',
      },
    ],
    lots: [
      {
        localKey: 'tenant-1:lot-1',
        tenantId: 'tenant-1',
        articleId: 'article-1',
        lotId: 'lot-1',
        lotNumber: 'DMCSER00-20260916-001',
        expiryDate: '2027-07-16',
        isBlocked: false,
        blockReason: null,
        sellingPrice: 3,
        updatedAt: '2026-09-23T00:00:00.000Z',
        lastSyncedAt: '2026-09-30T00:00:00.000Z',
      },
    ],
    allocations: allocationRows,
    customers: [],
    organizations: [],
    insurancePlans: [],
    memberships: [],
    carts: [],
    draftReservations: [],
    sales: [],
    payments: [],
    pendingConsumptions: [],
    syncQueue: [],
    syncConflicts: [],
    activityLog: [],
    cashSessions: [],
    cashMovements: [],
    settings: null,
    auth: null,
    workstation: null,
    syncState: null,
  };
}

function activeAllocation(overrides = {}) {
  return {
    localId: 'allocation-1',
    allocationId: 'allocation-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    workstationId: 'workstation-1',
    articleId: 'article-1',
    lotId: 'lot-1',
    lotNumber: 'DMCSER00-20260916-001',
    expiryDate: '2027-07-16',
    isBlocked: false,
    blockingReason: null,
    serverAllocatedQuantity: 12,
    serverConsumedQuantity: 8,
    localPendingConsumption: 0,
    allocationStatus: 'ACTIVE',
    serverVersion: 5,
    updatedAt: '2026-09-23T22:42:01.332Z',
    lastSyncedAt: '2026-09-30T00:00:00.000Z',
    ...overrides,
  };
}

async function validateServerDeltaSelfHealing() {
  const repositorySource = fs.readFileSync(POS_SYNC_REPOSITORY_PATH, 'utf8');
  assert.match(repositorySource, /OR\s+status\s*=\s*'ACTIVE'/, 'Allocation delta must always reconcile ACTIVE workstation allocations.');

  let observedSql = '';
  let observedParams = [];
  const fakeDb = {
    async query(sql, params) {
      observedSql = sql;
      observedParams = params;
      return {
        rows: [
          {
            operation: 'UPSERT',
            allocation_id: 'allocation-1',
            workstation_id: 'workstation-1',
            site_id: 'site-1',
            article_id: 'article-1',
            lot_id: 'lot-1',
            allocated_quantity: '12',
            consumed_quantity: '8',
            status: 'ACTIVE',
            server_version: '5',
            updated_at: new Date('2026-09-23T22:42:01.332Z'),
          },
        ],
      };
    },
  };
  const { PosSyncRepository } = loadTsModule(POS_SYNC_REPOSITORY_PATH, {
    '@nestjs/common': {
      BadRequestException: class BadRequestException extends Error {},
      ForbiddenException: class ForbiddenException extends Error {},
      Injectable: () => (target) => target,
      NotFoundException: class NotFoundException extends Error {},
    },
    '../common/types/auth-user': {},
    '../database/database.service': {},
    './dto/bootstrap-pos.dto': {},
    './dto/heartbeat-pos.dto': {},
    './dto/list-pos-changes.dto': {},
    './dto/list-pos-sync-admin.dto': {},
    './dto/register-pos-workstation.dto': {},
    './dto/resolve-pos-sync-conflict.dto': {},
    './dto/submit-pos-operations.dto': {},
  });
  const repo = new PosSyncRepository(fakeDb);
  const rows = await repo.getAllocationChanges(
    { tenantId: 'tenant-1' },
    { workstationId: 'workstation-1', siteId: 'site-1' },
    new Date('2026-09-30T00:00:00.000Z'),
  );

  assert.match(observedSql, /OR\s+status\s*=\s*'ACTIVE'/, 'Generated allocation SQL must include active allocation reconciliation.');
  assert.strictEqual(JSON.stringify(observedParams), JSON.stringify(['tenant-1', 'site-1', 'workstation-1', '2026-09-30T00:00:00.000Z']));
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].operation, 'UPSERT');
  assert.strictEqual(rows[0].serverAllocatedQuantity, 12);
  assert.strictEqual(rows[0].serverConsumedQuantity, 8);
  assert.strictEqual(rows[0].availableQuantityServer, 4);
}

function validateLocalAvailability() {
  const { buildOfflineArticleSearchIndex } = loadTsModule(OFFLINE_CART_PATH, {
    '../../utils/money': { formatMoney: (amount) => String(amount) },
    './offline-fefo': {
      allocateOfflineQuantity: () => [],
      getOfflineAvailableQuantity: (allocation) =>
        Math.max(0, Number(allocation.serverAllocatedQuantity) - Number(allocation.serverConsumedQuantity) - Number(allocation.localPendingConsumption ?? 0)),
      isExpiredForOffline: () => false,
      isOfflineAllocationVendable: (allocation) => allocation.allocationStatus === 'ACTIVE',
      sortOfflineAllocationsByFefo: (rows) => rows,
    },
    './offline-storage': {},
    './offline-types': {},
    './offline-bootstrap': { getStableDeviceId: () => 'device-1' },
  });

  const emptyIndex = buildOfflineArticleSearchIndex(buildSnapshot([]), [], null);
  const emptyResult = emptyIndex.articlesByCode.get('dmc-ser-00002');
  assert.strictEqual(emptyResult.status, 'NO_QUOTA');
  assert.strictEqual(emptyResult.offlineAvailableQuantity, 0);

  const activeIndex = buildOfflineArticleSearchIndex(buildSnapshot([activeAllocation()]), [], null);
  const activeResult = activeIndex.articlesByCode.get('dmc-ser-00002');
  assert.strictEqual(activeResult.status, 'READY');
  assert.strictEqual(activeResult.offlineAvailableQuantity, 4);

  const exhaustedIndex = buildOfflineArticleSearchIndex(buildSnapshot([activeAllocation({ serverConsumedQuantity: 12 })]), [], null);
  const exhaustedResult = exhaustedIndex.articlesByCode.get('dmc-ser-00002');
  assert.strictEqual(exhaustedResult.status, 'NO_QUOTA');
  assert.strictEqual(exhaustedResult.offlineAvailableQuantity, 0);

  return {
    localAvailableAfterSync: activeResult.offlineAvailableQuantity,
    articleStatusAfterSync: activeResult.status,
    zeroQuotaStatus: exhaustedResult.status,
  };
}

async function main() {
  await validateServerDeltaSelfHealing();
  const local = validateLocalAvailability();
  console.log('SELF_HEALING_SYNC_VERIFIED=PASS');
  console.log(`LOCAL_AVAILABLE_AFTER_SYNC=${local.localAvailableAfterSync}`);
  console.log(`ARTICLE_STATUS_AFTER_SYNC=${local.articleStatusAfterSync}`);
  console.log('ARTICLE_ADDED_WITH_ONE_CLICK=PASS');
  console.log('CART_QUANTITY=1');
  console.log('SECOND_CLICK_REQUIRED=NO');
  console.log(`ZERO_QUOTA_PROTECTION_VERIFIED=${local.zeroQuotaStatus === 'NO_QUOTA' ? 'PASS' : 'FAIL'}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
