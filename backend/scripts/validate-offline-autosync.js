const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const { webcrypto } = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SYNC_ENGINE_PATH = path.join(REPO_ROOT, 'frontend', 'src', 'modules', 'offline', 'sync-engine.ts');

const FAST_INTERVAL_MS = 25;
const FAST_BACKOFF_STEPS = [15, 30, 45, 60, 75];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs = 1_000, stepMs = 5) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) return true;
    await wait(stepMs);
  }
  return false;
}

function deepClone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function createLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const bucket = listeners.get(type) ?? new Set();
      bucket.add(listener);
      listeners.set(type, bucket);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type) {
      for (const listener of Array.from(listeners.get(type) ?? [])) {
        listener();
      }
    },
  };
}

function transformSyncEngineSource(source) {
  return source
    .replace(
      'const AUTO_SYNC_INTERVAL_MS = 60_000;',
      `const AUTO_SYNC_INTERVAL_MS = ${FAST_INTERVAL_MS};`,
    )
    .replace(
      "const BACKOFF_STEPS_MS = [60_000, 120_000, 300_000, 600_000, 1_800_000] as const;",
      `const BACKOFF_STEPS_MS = [${FAST_BACKOFF_STEPS.join(', ')}] as const;`,
    )
    .replace(/import\.meta\.env\.VITE_APP_VERSION \?\? 'web'/g, "'web'");
}

function loadTsModule(filePath, moduleStubs, sourceTransform) {
  const rawSource = fs.readFileSync(filePath, 'utf8');
  const source = sourceTransform ? sourceTransform(rawSource) : rawSource;
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
      if (moduleStubs && Object.prototype.hasOwnProperty.call(moduleStubs, specifier)) {
        return moduleStubs[specifier];
      }
      throw new Error(`Stub missing for ${specifier} while loading ${filePath}`);
    },
    __filename: filePath,
    __dirname: path.dirname(filePath),
    console,
    window: global.window,
    document: global.document,
    navigator: global.navigator,
    localStorage: global.localStorage,
    crypto: global.crypto,
    fetch: global.fetch,
    structuredClone: global.structuredClone,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
  };
  vm.runInNewContext(output, context, { filename: filePath });
  return module.exports;
}

function buildQueueEntry(id, status = 'PENDING', overrides = {}) {
  const now = new Date().toISOString();
  return {
    localId: `local-${id}`,
    operationId: `operation-${id}`,
    operationType: 'SALE_VALIDATE',
    workstationId: 'ws-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    payload: {
      operationType: 'SALE_VALIDATE',
      operationId: `operation-${id}`,
      localSaleId: `sale-${id}`,
      offlineReference: `OFF-AUTO-${id}`,
      tenantId: 'tenant-1',
      siteId: 'site-1',
      workstationId: 'ws-1',
      deviceId: 'device-1',
      userId: 'user-1',
      cashSessionId: 'cash-1',
      customerId: null,
      currency: 'USD',
      exchangeRateSnapshot: 2800,
      createdAt: now,
      validatedAt: now,
      saleMode: 'IMMEDIATE',
      saleType: 'CASH',
      note: '',
      subtotal: 10,
      total: 10,
      payment: {
        amountPaidUsd: 10,
        amountPaidCdf: 0,
        amountReturnedUsd: 0,
        amountReturnedCdf: 0,
        netReceivedUsd: 10,
        netReceivedCdf: 0,
      },
      items: [
        {
          articleId: 'article-1',
          articleCode: 'OFF-AUTO-ARTICLE',
          articleName: 'Article auto-sync',
          quantity: 1,
          unitPriceSnapshot: 10,
          lotAllocations: [
            {
              allocationId: 'allocation-1',
              lotId: 'lot-1',
              lotNumber: 'LOT-1',
              expiryDate: '2028-12-31',
              quantity: 1,
              allocationServerVersion: 1,
            },
          ],
        },
      ],
    },
    status,
    relatedLocalSaleId: `sale-${id}`,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createHarness(options = {}) {
  const memory = {
    queue: deepClone(options.queue ?? [buildQueueEntry('1')]),
    conflicts: deepClone(options.conflicts ?? []),
    logs: [],
    sales: deepClone(
      options.sales ?? [
        {
          localSaleId: 'sale-1',
          status: 'PENDING_SYNC',
          syncStatus: 'PENDING',
          serverSaleId: null,
          serverSaleNumber: null,
          syncedAt: null,
        },
      ],
    ),
    pendingConsumptions: deepClone(
      options.pendingConsumptions ?? [
        {
          pendingConsumptionId: 'pc-1',
          localSaleId: 'sale-1',
          operationId: 'operation-1',
          allocationId: 'allocation-1',
          quantity: 1,
          status: 'PENDING',
          syncedAt: null,
        },
      ],
    ),
    allocations: deepClone(
      options.allocations ?? [
        {
          allocationId: 'allocation-1',
          serverConsumedQuantity: 0,
          localPendingConsumption: 1,
          allocationStatus: 'ACTIVE',
          serverVersion: 1,
          updatedAt: new Date().toISOString(),
          lastSyncedAt: null,
        },
      ],
    ),
    snapshot: deepClone({
      articles: [],
      lots: [],
      allocations: [],
      customers: [],
      settings: null,
      auth: {
        tenantId: 'tenant-1',
        siteId: 'site-1',
        userId: 'user-1',
      },
      workstation: {
        workstationId: 'ws-1',
        deviceId: 'device-1',
        appVersion: 'test',
        siteId: 'site-1',
        tenantId: 'tenant-1',
        status: 'OFFLINE_READY',
      },
      cashSession: {
        cashSessionId: 'cash-1',
        status: 'OPEN',
      },
      syncState: {
        id: 'sync-state',
        tenantId: 'tenant-1',
        siteId: 'site-1',
        workstationId: 'ws-1',
        bootstrapVersion: 'offline-1',
        syncCursor: 'cursor-0',
        serverTime: new Date().toISOString(),
        lastSuccessfulSyncAt: null,
        lastAttemptAt: null,
        snapshotStatus: 'FRESH',
        networkStatus: 'ONLINE',
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      ...(options.snapshot ?? {}),
    }),
  };

  const server = {
    pushCalls: [],
    heartbeatCalls: [],
    applyChangesCalls: [],
    pingCalls: [],
    processedOperationIds: new Set(),
    syncPendingCalls: 0,
    ...deepClone(options.server ?? {}),
  };

  const behavior = options.behavior ?? {};
  const localStorage = createLocalStorage();
  const windowTarget = createEventTarget();
  const documentTarget = createEventTarget();
  const documentObject = {
    ...documentTarget,
    visibilityState: 'visible',
  };
  const navigatorObject = {
    onLine: options.navigatorOnline ?? true,
  };

  const previousGlobals = {
    window: global.window,
    document: global.document,
    navigator: global.navigator,
    localStorage: global.localStorage,
    crypto: global.crypto,
    structuredClone: global.structuredClone,
  };

  const scheduledTimeouts = new Set();
  const scheduledIntervals = new Set();

  const wrappedSetTimeout = (callback, delay, ...args) => {
    const handle = setTimeout(() => {
      scheduledTimeouts.delete(handle);
      callback(...args);
    }, delay);
    scheduledTimeouts.add(handle);
    return handle;
  };

  const wrappedClearTimeout = (handle) => {
    scheduledTimeouts.delete(handle);
    clearTimeout(handle);
  };

  const wrappedSetInterval = (callback, delay, ...args) => {
    const handle = setInterval(() => callback(...args), delay);
    scheduledIntervals.add(handle);
    return handle;
  };

  const wrappedClearInterval = (handle) => {
    scheduledIntervals.delete(handle);
    clearInterval(handle);
  };

  global.window = {
    setTimeout: wrappedSetTimeout,
    clearTimeout: wrappedClearTimeout,
    setInterval: wrappedSetInterval,
    clearInterval: wrappedClearInterval,
    addEventListener: windowTarget.addEventListener,
    removeEventListener: windowTarget.removeEventListener,
  };
  global.document = documentObject;
  global.navigator = navigatorObject;
  global.localStorage = localStorage;
  global.crypto = webcrypto;
  global.structuredClone = global.structuredClone ?? deepClone;

  function restoreGlobals() {
    for (const handle of Array.from(scheduledTimeouts)) {
      clearTimeout(handle);
    }
    for (const handle of Array.from(scheduledIntervals)) {
      clearInterval(handle);
    }
    scheduledTimeouts.clear();
    scheduledIntervals.clear();
    global.window = previousGlobals.window;
    global.document = previousGlobals.document;
    global.navigator = previousGlobals.navigator;
    global.localStorage = previousGlobals.localStorage;
    global.crypto = previousGlobals.crypto;
    global.structuredClone = previousGlobals.structuredClone;
  }

  const storageStub = {
    async appendSyncConflict(entry) {
      memory.conflicts.push({
        localId: `conflict-${memory.conflicts.length + 1}`,
        createdAt: new Date().toISOString(),
        ...deepClone(entry),
      });
    },
    async appendSyncLog(entry) {
      memory.logs.push({
        localId: `log-${memory.logs.length + 1}`,
        createdAt: new Date().toISOString(),
        ...deepClone(entry),
      });
    },
    async readOfflineConflicts() {
      return deepClone(memory.conflicts);
    },
    async readOfflineSnapshot() {
      return deepClone(memory.snapshot);
    },
    async readOfflineCashSessions() {
      return memory.snapshot.cashSession ? [deepClone(memory.snapshot.cashSession)] : [];
    },
    async readOfflineSyncQueue() {
      return deepClone(memory.queue);
    },
    async patchOfflineSyncQueueEntry(operationId, updater) {
      let patched = null;
      memory.queue = memory.queue.map((row) => {
        if (row.operationId !== operationId) return row;
        patched = updater(deepClone(row));
        return deepClone(patched);
      });
      return patched ? deepClone(patched) : null;
    },
    async resetStaleSyncingQueueEntries(maxAgeMs = 5 * 60 * 1000) {
      const now = Date.now();
      memory.queue = memory.queue.map((row) => {
        if (row.status !== 'SYNCING') return row;
        const updatedAtMs = new Date(row.updatedAt).getTime();
        if (Number.isNaN(updatedAtMs) || now - updatedAtMs < maxAgeMs) return row;
        return {
          ...row,
          status: 'PENDING',
          updatedAt: new Date().toISOString(),
          lastErrorCode: row.lastErrorCode ?? 'SYNC_RECOVERED_AFTER_RELOAD',
          lastErrorMessage: row.lastErrorMessage ?? 'Operation remise en attente apres reprise locale.',
        };
      });
      return deepClone(memory.queue);
    },
    async saveOfflineSyncQueue(rows) {
      memory.queue = deepClone(rows);
    },
    async updateOfflineSyncOperationResult(params) {
      const now = new Date().toISOString();
      memory.queue = memory.queue.map((row) =>
        row.operationId === params.operationId
          ? {
              ...row,
              status: params.nextStatus,
              updatedAt: now,
              lastErrorCode: params.errorCode ?? null,
              lastErrorMessage: params.errorMessage ?? null,
            }
          : row,
      );

      const queueEntry = memory.queue.find((row) => row.operationId === params.operationId);
      const localSaleId = params.result?.localSaleId ?? queueEntry?.payload?.localSaleId ?? queueEntry?.relatedLocalSaleId ?? null;

      if (localSaleId) {
        memory.sales = memory.sales.map((row) =>
          row.localSaleId === localSaleId
            ? {
                ...row,
                status: params.nextStatus === 'SYNCED' ? 'SYNCED' : params.nextStatus,
                syncStatus: params.nextStatus,
                serverSaleId: params.result?.serverSaleId ?? row.serverSaleId ?? null,
                serverSaleNumber: params.result?.serverSaleNumber ?? row.serverSaleNumber ?? null,
                syncedAt: params.nextStatus === 'SYNCED' ? now : row.syncedAt ?? null,
              }
            : row,
        );

        memory.pendingConsumptions = memory.pendingConsumptions.map((row) =>
          row.localSaleId === localSaleId
            ? {
                ...row,
                status: params.nextStatus === 'SYNCED' ? 'SYNCED' : row.status,
                syncedAt: params.nextStatus === 'SYNCED' ? now : row.syncedAt ?? null,
              }
            : row,
        );
      }

      const allocationAcks = new Map((params.result?.allocations ?? []).map((ack) => [ack.allocationId, ack]));
      memory.allocations = memory.allocations.map((row) => {
        const ack = allocationAcks.get(row.allocationId);
        if (!ack) return row;
        return {
          ...row,
          serverConsumedQuantity: ack.serverConsumedQuantity,
          localPendingConsumption: Math.max(0, Number(row.localPendingConsumption ?? 0) - Number(ack.acknowledgedQuantity ?? 0)),
          allocationStatus: ack.status,
          serverVersion: ack.serverVersion,
          updatedAt: now,
          lastSyncedAt: now,
        };
      });
    },
    async writeOfflineSyncState(syncState) {
      memory.snapshot.syncState = deepClone(syncState);
    },
  };

  const offlineBootstrapStub = {
    getStableDeviceId() {
      return 'device-1';
    },
    async pingPosSync() {
      server.pingCalls.push({ at: Date.now(), online: navigatorObject.onLine });
      if (typeof behavior.pingPosSync === 'function') {
        return behavior.pingPosSync({ memory, server, navigator: navigatorObject });
      }
      if (!navigatorObject.onLine) {
        return { networkStatus: 'OFFLINE', ping: null };
      }
      return { networkStatus: 'ONLINE', ping: { status: 'OK', serverTime: new Date().toISOString(), appVersion: 'test' } };
    },
    async applyChanges() {
      server.applyChangesCalls.push({ at: Date.now() });
      if (typeof behavior.applyChanges === 'function') {
        await behavior.applyChanges({ memory, server });
      }
      memory.snapshot.syncState = {
        ...memory.snapshot.syncState,
        syncCursor: `cursor-${server.applyChangesCalls.length}`,
        serverTime: new Date().toISOString(),
        lastSuccessfulSyncAt: new Date().toISOString(),
        lastAttemptAt: new Date().toISOString(),
      };
    },
  };

  const posSyncServiceStub = {
    posSyncService: {
      async pushOperations(payload) {
        const operations = payload?.operations ?? [];
        const results = [];
        for (const operation of operations) {
          server.pushCalls.push({
            at: Date.now(),
            operationId: operation.operationId,
            localSaleId: operation.localSaleId ?? null,
            operationType: operation.operationType,
          });
          const outcome = await behavior.onPush({ entry: { payload: deepClone(operation), operationId: operation.operationId, operationType: operation.operationType }, memory, server });
          if (!outcome) {
            throw new Error('SYNC_OUTCOME_MISSING');
          }
          if (outcome.throwMessage) {
            throw new Error(outcome.throwMessage);
          }
          results.push({
            operationId: operation.operationId,
            localSaleId: operation.localSaleId ?? null,
            status: outcome.status,
            serverSaleId: outcome.serverSaleId ?? null,
            serverSaleNumber: outcome.serverSaleNumber ?? null,
            serverCashSessionId: outcome.serverCashSessionId ?? null,
            serverSessionReference: outcome.serverSessionReference ?? null,
            serverMovementId: outcome.serverMovementId ?? null,
            serverVersion: outcome.serverVersion ?? null,
            serverOpenedAt: outcome.serverOpenedAt ?? null,
            serverClosedAt: outcome.serverClosedAt ?? null,
            serverExpectedUsd: outcome.serverExpectedUsd ?? null,
            serverExpectedCdf: outcome.serverExpectedCdf ?? null,
            serverDeclaredUsd: outcome.serverDeclaredUsd ?? null,
            serverDeclaredCdf: outcome.serverDeclaredCdf ?? null,
            serverDifferenceUsd: outcome.serverDifferenceUsd ?? null,
            serverDifferenceCdf: outcome.serverDifferenceCdf ?? null,
            allocations: outcome.allocations ?? [],
            errorCode: outcome.errorCode ?? null,
            message: outcome.message ?? null,
          });
        }
        return { data: { results } };
      },
      async heartbeat(payload) {
        server.heartbeatCalls.push({ at: Date.now(), payload: deepClone(payload) });
        if (typeof behavior.heartbeat === 'function') {
          return behavior.heartbeat({ payload, memory, server });
        }
        return {
          data: {
            workstationId: payload.workstationId ?? memory.snapshot.workstation.workstationId,
            status: 'ONLINE',
            serverTime: new Date().toISOString(),
          },
        };
      },
    },
  };

  const syncEngine = loadTsModule(
    SYNC_ENGINE_PATH,
    {
      '../../services/posSync.service': posSyncServiceStub,
      './offline-storage': storageStub,
      './offline-bootstrap': offlineBootstrapStub,
      './offline-config': {
        OFFLINE_APP_VERSION: 'web',
        OFFLINE_DB_VERSION: 6,
      },
    },
    transformSyncEngineSource,
  );

  return {
    memory,
    server,
    behavior,
    syncEngine,
    navigator: navigatorObject,
    windowDispatch(type) {
      windowTarget.dispatch(type);
    },
    setVisibility(state) {
      documentObject.visibilityState = state;
      documentTarget.dispatch('visibilitychange');
    },
    async settle(ms = 80) {
      await wait(ms);
    },
    cleanup() {
      restoreGlobals();
    },
  };
}

async function withHarness(options, callback) {
  const harness = createHarness(options);
  try {
    return await callback(harness);
  } finally {
    harness.cleanup();
  }
}

async function runAutosyncWithoutClick() {
  return withHarness(
    {
      behavior: {
        async onPush({ entry }) {
          return {
            status: 'SYNCED',
            serverSaleId: `server-${entry.payload.localSaleId}`,
            serverSaleNumber: 'SAL-AUTO-1',
            allocations: [
              {
                allocationId: 'allocation-1',
                lotId: 'lot-1',
                acknowledgedQuantity: 1,
                serverConsumedQuantity: 1,
                availableQuantity: 0,
                serverVersion: 2,
                status: 'EXHAUSTED',
              },
            ],
          };
        },
      },
    },
    async ({ syncEngine, server, memory, settle }) => {
      const unsubscribe = syncEngine.subscribeSyncEngine(() => {});
      try {
        const completed = await waitFor(() => server.pushCalls.length === 1 && memory.queue[0].status === 'SYNCED', 1_000);
        assert.ok(completed, 'autosyncWithoutClick did not complete automatically');
        await settle();
        assert.strictEqual(server.pushCalls.length, 1);
        assert.strictEqual(memory.queue[0].status, 'SYNCED');
        assert.strictEqual(memory.sales[0].syncStatus, 'SYNCED');
        assert.strictEqual(memory.pendingConsumptions[0].status, 'SYNCED');
        assert.strictEqual(memory.allocations[0].serverVersion, 2);
        return { passed: true, pushCalls: server.pushCalls.length };
      } finally {
        unsubscribe();
      }
    },
  );
}

async function runReconnection() {
  const queue = [buildQueueEntry('1'), buildQueueEntry('2'), buildQueueEntry('3')];
  return withHarness(
    {
      queue,
      navigatorOnline: false,
      behavior: {
        async onPush({ entry }) {
          return {
            status: 'SYNCED',
            serverSaleId: `server-${entry.payload.localSaleId}`,
            serverSaleNumber: `SAL-${entry.payload.localSaleId}`,
            allocations: [],
          };
        },
      },
    },
    async ({ syncEngine, navigator, windowDispatch, server, memory }) => {
      const unsubscribe = syncEngine.subscribeSyncEngine(() => {});
      try {
        await waitFor(() => server.pingCalls.length >= 1, 1_000);
        assert.strictEqual(server.pushCalls.length, 0);
        navigator.onLine = true;
        windowDispatch('online');
        const completed = await waitFor(() => memory.queue.every((row) => row.status === 'SYNCED'), 1_000);
        assert.ok(completed, 'reconnection did not flush pending queue');
        assert.strictEqual(server.pushCalls.length, 3);
        return { passed: true, pushCalls: server.pushCalls.length };
      } finally {
        unsubscribe();
      }
    },
  );
}

async function runMutex() {
  return withHarness(
    {
      behavior: {
        async onPush() {
          await wait(40);
          return { status: 'SYNCED', serverSaleId: 'server-sale-1', serverSaleNumber: 'SAL-MUTEX-1', allocations: [] };
        },
      },
    },
    async ({ syncEngine, server, memory }) => {
      await Promise.all([syncEngine.runSync('manual'), syncEngine.runSync('manual')]);
      const completed = await waitFor(() => memory.queue[0].status === 'SYNCED', 1_000);
      assert.ok(completed, 'mutex sync did not complete');
      assert.strictEqual(server.pushCalls.length, 1);
      return { passed: true, pushCalls: server.pushCalls.length };
    },
  );
}

async function runDoubleTrigger() {
  return withHarness(
    {
      behavior: {
        async onPush() {
          await wait(50);
          return { status: 'SYNCED', serverSaleId: 'server-sale-1', serverSaleNumber: 'SAL-DOUBLE-1', allocations: [] };
        },
      },
    },
    async ({ syncEngine, server, windowDispatch, memory }) => {
      const unsubscribe = syncEngine.subscribeSyncEngine(() => {});
      try {
        const inFlight = syncEngine.runSync('manual');
        windowDispatch('online');
        void syncEngine.runSync('manual');
        await inFlight;
        const completed = await waitFor(() => memory.queue[0].status === 'SYNCED', 1_000);
        assert.ok(completed, 'doubleTrigger sync did not complete');
        assert.strictEqual(server.pushCalls.length, 1);
        return { passed: true, pushCalls: server.pushCalls.length };
      } finally {
        unsubscribe();
      }
    },
  );
}

async function runBackoff() {
  const queue = [buildQueueEntry('1')];
  const callTimes = [];
  let attempt = 0;
  return withHarness(
    {
      queue,
      behavior: {
        async onPush() {
          callTimes.push(Date.now());
          attempt += 1;
          if (attempt < 3) {
            throw new Error('POS_SYNC_BACKEND_UNREACHABLE');
          }
          return {
            status: 'SYNCED',
            serverSaleId: 'server-sale-backoff',
            serverSaleNumber: 'SAL-BACKOFF-1',
            allocations: [],
          };
        },
      },
    },
    async ({ syncEngine, memory }) => {
      await syncEngine.runSync('manual');
      const completed = await waitFor(() => memory.queue[0].status === 'SYNCED', 1_500);
      assert.ok(completed, 'backoff scenario did not eventually sync');
      assert.ok(callTimes.length >= 3, 'expected at least 3 retry attempts');
      return {
        passed: true,
        attempts: callTimes.length,
        delays: [callTimes[1] - callTimes[0], callTimes[2] - callTimes[1]],
      };
    },
  );
}

async function runSyncingRecovery() {
  const stale = buildQueueEntry('1', 'SYNCING', {
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  });
  return withHarness(
    {
      queue: [stale],
      behavior: {
        async onPush({ entry }) {
          return {
            status: 'SYNCED',
            serverSaleId: `server-${entry.payload.localSaleId}`,
            serverSaleNumber: 'SAL-RECOVERY-1',
            allocations: [],
          };
        },
      },
    },
    async ({ syncEngine, server, memory }) => {
      const unsubscribe = syncEngine.subscribeSyncEngine(() => {});
      try {
        const completed = await waitFor(() => memory.queue[0].status === 'SYNCED', 1_000);
        assert.ok(completed, 'syncingRecovery did not replay stale operation');
        assert.strictEqual(server.pushCalls[0].operationId, 'operation-1');
        return { passed: true, operationId: server.pushCalls[0].operationId };
      } finally {
        unsubscribe();
      }
    },
  );
}

async function runLostAck() {
  const processed = new Set();
  let firstAttempt = true;
  return withHarness(
    {
      behavior: {
        async onPush({ entry }) {
          if (firstAttempt) {
            firstAttempt = false;
            processed.add(entry.operationId);
            throw new Error('POS_SYNC_BACKEND_UNREACHABLE');
          }
          if (processed.has(entry.operationId)) {
            return {
              status: 'ALREADY_PROCESSED',
              serverSaleId: `server-${entry.payload.localSaleId}`,
              serverSaleNumber: 'SAL-LOSTACK-1',
              allocations: [],
            };
          }
          return {
            status: 'SYNCED',
            serverSaleId: `server-${entry.payload.localSaleId}`,
            serverSaleNumber: 'SAL-LOSTACK-1',
            allocations: [],
          };
        },
      },
    },
    async ({ syncEngine, server, memory }) => {
      await syncEngine.runSync('manual');
      const completed = await waitFor(() => memory.queue[0].status === 'SYNCED', 1_500);
      assert.ok(completed, 'lostAck did not recover to SYNCED');
      assert.strictEqual(server.pushCalls.length, 2);
      assert.strictEqual(memory.sales[0].serverSaleNumber, 'SAL-LOSTACK-1');
      return { passed: true, attempts: server.pushCalls.length, processedCount: processed.size };
    },
  );
}

async function runQueueContinuesAfterConflict() {
  const queue = [buildQueueEntry('1'), buildQueueEntry('2'), buildQueueEntry('3')];
  return withHarness(
    {
      queue,
      sales: [
        { localSaleId: 'sale-1', status: 'PENDING_SYNC', syncStatus: 'PENDING' },
        { localSaleId: 'sale-2', status: 'PENDING_SYNC', syncStatus: 'PENDING' },
        { localSaleId: 'sale-3', status: 'PENDING_SYNC', syncStatus: 'PENDING' },
      ],
      pendingConsumptions: [],
      behavior: {
        async onPush({ entry }) {
          if (entry.operationId === 'operation-2') {
            return { status: 'CONFLICT', errorCode: 'ALLOCATION_MISMATCH', message: 'ALLOCATION_MISMATCH' };
          }
          return {
            status: 'SYNCED',
            serverSaleId: `server-${entry.payload.localSaleId}`,
            serverSaleNumber: `SAL-${entry.payload.localSaleId}`,
            allocations: [],
          };
        },
      },
    },
    async ({ syncEngine, memory, server }) => {
      await syncEngine.runSync('manual');
      const completed = await waitFor(
        () =>
          memory.queue.find((row) => row.operationId === 'operation-1')?.status === 'SYNCED'
          && memory.queue.find((row) => row.operationId === 'operation-2')?.status === 'CONFLICT'
          && memory.queue.find((row) => row.operationId === 'operation-3')?.status === 'SYNCED',
        1_000,
      );
      assert.ok(completed, 'queue did not continue after conflict');
      assert.strictEqual(server.pushCalls.length, 3);
      return {
        passed: true,
        statuses: memory.queue.map((row) => ({ operationId: row.operationId, status: row.status })),
      };
    },
  );
}

async function runDescendingSyncAfterAck() {
  return withHarness(
    {
      conflicts: [
        {
          localId: 'existing-conflict',
          conflictId: 'conflict-1',
          code: 'ALLOCATION_MISMATCH',
          message: 'Old conflict',
          status: 'OPEN',
          severity: 'WARNING',
          createdAt: new Date().toISOString(),
        },
      ],
      behavior: {
        async onPush({ entry }) {
          return {
            status: 'SYNCED',
            serverSaleId: `server-${entry.payload.localSaleId}`,
            serverSaleNumber: 'SAL-DESC-1',
            allocations: [
              {
                allocationId: 'allocation-1',
                lotId: 'lot-1',
                acknowledgedQuantity: 1,
                serverConsumedQuantity: 1,
                availableQuantity: 0,
                serverVersion: 2,
                status: 'EXHAUSTED',
              },
            ],
          };
        },
        async applyChanges({ memory }) {
          memory.allocations = memory.allocations.map((row) =>
            row.allocationId === 'allocation-1'
              ? {
                  ...row,
                  serverConsumedQuantity: 1,
                  serverVersion: 3,
                  allocationStatus: 'EXHAUSTED',
                  localPendingConsumption: 0,
                }
              : row,
          );
          memory.conflicts = [];
        },
      },
    },
    async ({ syncEngine, memory, server }) => {
      await syncEngine.runSync('manual');
      const completed = await waitFor(
        () => memory.queue[0].status === 'SYNCED' && memory.allocations[0].serverVersion === 3 && memory.conflicts.length === 0,
        1_000,
      );
      assert.ok(completed, 'descending sync was not applied after ACK');
      assert.strictEqual(server.applyChangesCalls.length, 1);
      return {
        passed: true,
        serverVersion: memory.allocations[0].serverVersion,
        conflictCount: memory.conflicts.length,
      };
    },
  );
}

async function auditEngine() {
  const source = fs.readFileSync(SYNC_ENGINE_PATH, 'utf8');
  return {
    triggers: ['timer', 'online', 'visibility', 'sale', 'manual via runSync export'],
    mutex: source.includes('if (isSyncing) return state;'),
    backoffStepsMs: FAST_BACKOFF_STEPS,
    staleSyncingRecovery: source.includes('resetStaleSyncingQueueEntries'),
    descendingSync: source.includes('applyChanges();'),
    heartbeat: source.includes('syncHeartbeat();'),
    listeners: {
      online: source.includes("window.addEventListener('online'"),
      visibility: source.includes("document.addEventListener('visibilitychange'"),
    },
  };
}

async function main() {
  const audit = await auditEngine();
  const results = {};

  results.autosyncWithoutClick = await runAutosyncWithoutClick();
  results.reconnection = await runReconnection();
  results.mutex = await runMutex();
  results.doubleTrigger = await runDoubleTrigger();
  results.backoff = await runBackoff();
  results.syncingRecovery = await runSyncingRecovery();
  results.lostAck = await runLostAck();
  results.queueContinuesAfterConflict = await runQueueContinuesAfterConflict();
  results.descendingSyncAfterAck = await runDescendingSyncAfterAck();

  const allPass = Object.values(results).every((entry) => entry.passed === true);

  console.log(JSON.stringify({ audit, results, conclusion: allPass ? 'PASS' : 'FAIL' }, null, 2));

  if (!allPass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
