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
    readOfflinePendingConsumptions: async () => [],
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
const lotId = '87c31f89-ea60-44e9-a056-338d9d68a906';
const now = new Date().toISOString();

function buildLot(overrides = {}) {
  const lot = {
    localKey: `tenant-1:${overrides.lotId ?? lotId}`,
    tenantId: 'tenant-1',
    siteId: 'site-1',
    articleId,
    lotId,
    lotNumber: 'DMCSER00-20260916-001',
    expiryDate: '2027-07-16',
    isBlocked: false,
    blockReason: null,
    sellingPrice: 3,
    quantityAvailable: 4,
    updatedAt: now,
    lastSyncedAt: now,
    ...overrides,
  };
  lot.localKey = `tenant-1:${lot.lotId}`;
  return lot;
}

function buildPending(lot, quantity, status = 'PENDING') {
  return {
    pendingConsumptionId: `pending-${lot.lotId}-${quantity}-${status}`,
    tenantId: 'tenant-1',
    siteId: 'site-1',
    workstationId: 'workstation-1',
    operationId: 'operation-1',
    cartId: 'cart-other',
    articleId,
    allocationId: null,
    lotId: lot.lotId,
    lotNumber: lot.lotNumber,
    expiryDate: lot.expiryDate,
    quantity,
    allocationServerVersion: undefined,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

function buildContext({ lots = [buildLot()], pendingConsumptions = [], reservations = [], allocations = [] } = {}) {
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
    lots,
    allocations,
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
      createdAt: now,
      updatedAt: now,
    }],
    reservations,
    pendingConsumptions,
  };
}

function getSearchRow(context) {
  const index = cartModule.buildOfflineArticleSearchIndex(
    context.snapshot,
    context.reservations,
    'cart-1',
    context.pendingConsumptions,
  );
  const row = index.rows.find((entry) => entry.article.articleId === articleId);
  assert.ok(row, 'article should be indexed');
  return row;
}

function addOne(context) {
  return cartModule.prepareOfflineCartItemUpdateWithContext({
    cartId: 'cart-1',
    articleId,
    quantityDelta: 1,
  }, context);
}

const realBugContext = buildContext({ lots: [buildLot({ quantityAvailable: 4 })] });
const realBugRow = getSearchRow(realBugContext);
assert.strictEqual(realBugRow.status, 'READY');
assert.strictEqual(realBugRow.offlineAvailableQuantity, 4);
const realBugPlan = addOne(realBugContext);
assert.strictEqual(realBugPlan.cart.items.length, 1);
assert.strictEqual(realBugPlan.cart.items[0].quantity, 1);
assert.strictEqual(realBugPlan.cart.items[0].lotAllocations[0].allocationId, null);

const pendingContext = buildContext({
  lots: [buildLot({ quantityAvailable: 4 })],
  pendingConsumptions: [buildPending(buildLot(), 1)],
});
const pendingRow = getSearchRow(pendingContext);
assert.strictEqual(pendingRow.status, 'READY');
assert.strictEqual(pendingRow.offlineAvailableQuantity, 3);

const syncedContext = buildContext({
  lots: [buildLot({ quantityAvailable: 3 })],
  pendingConsumptions: [buildPending(buildLot(), 1, 'SYNCED')],
});
const syncedRow = getSearchRow(syncedContext);
assert.strictEqual(syncedRow.status, 'READY');
assert.strictEqual(syncedRow.offlineAvailableQuantity, 3);

const exhaustedContext = buildContext({
  lots: [buildLot({ quantityAvailable: 1 })],
  pendingConsumptions: [buildPending(buildLot(), 1)],
});
const exhaustedRow = getSearchRow(exhaustedContext);
assert.strictEqual(exhaustedRow.status, 'OUT_OF_STOCK');
assert.strictEqual(exhaustedRow.offlineAvailableQuantity, 0);

const legacyQuotaZeroContext = buildContext({
  lots: [buildLot({ quantityAvailable: 10 })],
  allocations: [{
    localId: 'legacy-allocation',
    allocationId: 'legacy-allocation',
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
    serverConsumedQuantity: 12,
    localPendingConsumption: 0,
    allocationStatus: 'EXHAUSTED',
    serverVersion: 99,
    updatedAt: now,
    lastSyncedAt: now,
  }],
});
const legacyQuotaZeroRow = getSearchRow(legacyQuotaZeroContext);
assert.strictEqual(legacyQuotaZeroRow.status, 'READY');
assert.strictEqual(legacyQuotaZeroRow.offlineAvailableQuantity, 10);

const fefoContext = buildContext({
  lots: [
    buildLot({ lotId, lotNumber: 'A-EARLY', expiryDate: '2027-01-01', quantityAvailable: 2 }),
    buildLot({ lotId: 'later-lot-1', lotNumber: 'B-LATER', expiryDate: '2027-12-31', quantityAvailable: 5 }),
  ],
});
const fefoPlan = cartModule.prepareOfflineCartItemUpdateWithContext({
  cartId: 'cart-1',
  articleId,
  quantityDelta: 3,
}, fefoContext);
assert.strictEqual(
  JSON.stringify(fefoPlan.cart.items[0].lotAllocations.map((allocation) => ({
    lotNumber: allocation.lotNumber,
    quantity: allocation.quantity,
    allocationId: allocation.allocationId,
  }))),
  JSON.stringify([
    { lotNumber: 'A-EARLY', quantity: 2, allocationId: null },
    { lotNumber: 'B-LATER', quantity: 1, allocationId: null },
  ]),
);

const blockedExpiredContext = buildContext({
  lots: [
    buildLot({ lotId: 'blocked', lotNumber: 'BLOCKED', isBlocked: true, quantityAvailable: 8 }),
    buildLot({ lotId: 'expired', lotNumber: 'EXPIRED', expiryDate: '2020-01-01', quantityAvailable: 8 }),
  ],
});
const blockedExpiredRow = getSearchRow(blockedExpiredContext);
assert.strictEqual(blockedExpiredRow.status, 'OUT_OF_STOCK');
assert.strictEqual(blockedExpiredRow.offlineAvailableQuantity, 0);

console.log('POS_LOCAL_STOCK_REGRESSION=PASS');
console.log('SERVER_SNAPSHOT_AVAILABLE=4');
console.log('PENDING_LOCAL_CONSUMPTION=0');
console.log('OFFLINE_AVAILABLE=4');
console.log('ARTICLE_STATUS=READY');
console.log('CART_QUANTITY=1');
console.log('FEFO_MULTILOT=PASS');
