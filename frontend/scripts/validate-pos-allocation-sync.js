const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const { webcrypto } = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OFFLINE_CART_PATH = path.join(REPO_ROOT, 'frontend', 'src', 'modules', 'offline', 'offline-cart.ts');
const OFFLINE_FEFO_PATH = path.join(REPO_ROOT, 'frontend', 'src', 'modules', 'offline', 'offline-fefo.ts');

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
    crypto: webcrypto,
    Date,
    Math,
    Number,
    String,
    JSON,
  };
  vm.runInNewContext(output, context, { filename: filePath });
  return module.exports;
}

const fefo = loadTsModule(OFFLINE_FEFO_PATH, { './offline-types': {} });
const cartModule = loadTsModule(OFFLINE_CART_PATH, {
  '../../utils/money': { formatMoney: (amount) => String(amount) },
  './offline-fefo': fefo,
  './offline-storage': {
    readOfflineActivityLog: async () => [],
    readOfflineCart: async () => null,
    readOfflineCarts: async () => [],
    readOfflineDraftReservations: async () => [],
    readOfflineSnapshot: async () => null,
    saveOfflineCart: async () => undefined,
    saveOfflineCarts: async () => undefined,
    writeOfflineDraftReservations: async () => undefined,
  },
  './offline-types': {},
  './offline-bootstrap': { getStableDeviceId: () => 'device-1' },
  './pos-client-allocation-probe': {
    logPosClientAllocationProbe: () => undefined,
    PROBE_ARTICLE_ID: 'c4ce1658-145b-4531-8059-dc45738712c1',
  },
});

const articleId = 'c4ce1658-145b-4531-8059-dc45738712c1';
const allocationId = 'cea23721-ee1e-4601-90d8-69d5c04c8b23';
const lotId = '87c31f89-ea60-44e9-a056-338d9d68a906';

function buildContext({ localPendingConsumption = 0, reservations = [] } = {}) {
  const now = new Date().toISOString();
  const snapshot = {
    articles: [{
      localKey: `tenant-1:${articleId}`,
      tenantId: 'tenant-1',
      articleId,
      articleCode: 'DMC-SER-00002',
      commercialName: '10 CC SERINGUE',
      barcode: null,
      isActive: true,
      salesUnit: 'Piece',
      packaging: null,
      packagingQuantity: null,
      defaultSellingPrice: 3,
      updatedAt: now,
      lastSyncedAt: now,
    }],
    lots: [{
      localKey: `tenant-1:${lotId}`,
      tenantId: 'tenant-1',
      articleId,
      lotId,
      lotNumber: 'DMCSER00-20260916-001',
      expiryDate: '2027-07-16',
      isBlocked: false,
      blockReason: null,
      sellingPrice: 3,
      updatedAt: now,
      lastSyncedAt: now,
    }],
    allocations: [{
      localId: allocationId,
      allocationId,
      tenantId: 'tenant-1',
      siteId: 'site-1',
      workstationId: 'workstation-1',
      articleId,
      lotId,
      lotNumber: 'DMCSER00-20260916-001',
      expiryDate: '2027-07-16',
      isBlocked: false,
      blockingReason: null,
      serverAllocatedQuantity: 12,
      serverConsumedQuantity: 8,
      localPendingConsumption,
      allocationStatus: 'ACTIVE',
      serverVersion: 5,
      updatedAt: now,
      lastSyncedAt: now,
    }],
    customers: [],
    organizations: [],
    insurancePlans: [],
    memberships: [],
    settings: null,
    auth: null,
    workstation: null,
    cashSession: null,
    syncState: null,
  };
  return {
    snapshot,
    carts: [{
      cartId: 'cart-1',
      offlineReference: 'DRAFT-1',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      workstationId: 'workstation-1',
      sellerUserId: 'user-1',
      sellerNameSnapshot: 'Seller',
      customerId: null,
      customerNameSnapshot: null,
      saleType: 'CASH',
      saleMode: 'IMMEDIATE',
      currency: 'USD',
      exchangeRateSnapshot: 2250,
      items: [],
      subtotal: 0,
      total: 0,
      itemCount: 0,
      quantityTotal: 0,
      patientShareUsd: 0,
      insuranceShareUsd: 0,
      note: '',
      status: 'DRAFT',
      saveState: 'SAVED',
      blockedReasons: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }],
    reservations,
  };
}

const readyContext = buildContext();
const readyIndex = cartModule.buildOfflineArticleSearchIndex(readyContext.snapshot, readyContext.reservations, 'cart-1');
const readyRow = readyIndex.rows.find((row) => row.article.articleId === articleId);
assert.strictEqual(readyRow.status, 'READY');
assert.strictEqual(readyRow.offlineAvailableQuantity, 4);

const plan = cartModule.prepareOfflineCartItemUpdateWithContext({
  cartId: 'cart-1',
  articleId,
  quantityDelta: 1,
}, readyContext);
assert.strictEqual(plan.cart.items.length, 1);
assert.strictEqual(plan.cart.items[0].quantity, 1);
assert.strictEqual(plan.cart.quantityTotal, 1);

const protectedContext = buildContext({ localPendingConsumption: 4 });
const protectedIndex = cartModule.buildOfflineArticleSearchIndex(protectedContext.snapshot, protectedContext.reservations, 'cart-1');
const protectedRow = protectedIndex.rows.find((row) => row.article.articleId === articleId);
assert.strictEqual(protectedRow.status, 'NO_QUOTA');
assert.strictEqual(protectedRow.offlineAvailableQuantity, 0);

console.log('POS_ALLOCATION_SYNC_REGRESSION=PASS');
console.log('SERVER_ALLOCATED=12');
console.log('SERVER_CONSUMED=8');
console.log('LOCAL_PENDING=0');
console.log('OFFLINE_AVAILABLE=4');
console.log('ARTICLE_STATUS=READY');
console.log('CART_QUANTITY=1');
