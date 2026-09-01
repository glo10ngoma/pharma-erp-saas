const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const { webcrypto } = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FRONTEND_ROOT = path.join(REPO_ROOT, 'frontend', 'src', 'modules', 'offline');
const OFFLINE_CASH_MODULE_PATH = path.join(FRONTEND_ROOT, 'offline-cash.ts');
const SYNC_ENGINE_MODULE_PATH = path.join(FRONTEND_ROOT, 'sync-engine.ts');

const configuredOfflineTestApiUrl = String(process.env.OFFLINE_TEST_API_URL || '').trim();
const baseUrl = configuredOfflineTestApiUrl || process.env.MVP_API_URL || 'http://127.0.0.1:3000/api/v1';
if (!configuredOfflineTestApiUrl && !isLocalApiUrl(baseUrl)) {
  throw new Error('OFFLINE_TEST_API_URL_REQUIRED_FOR_REMOTE_RUNTIME');
}
const connectionString = String(process.env.DATABASE_URL || '').replace(/^[ '"]+|[ '"]+$/g, '');
const client = new Client({
  connectionString,
  ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
});

const PASSWORD = 'admin123';
const TENANT_CODE = 'OFFLINE_STAGING';
const EXPECTED_OFFLINE_STAGING_TENANT_ID = '93809af1-afe7-4d66-baf3-1f8158ca64e1';
const EXPECTED_OFFLINE_STAGING_SITE_ID = '3ff0c8d2-117d-4a0a-b155-69fe31a1e5d1';
const MAIN_SITE_CODE = 'OFF-STG-SITE';
const SECOND_SITE_CODE = 'OFF-STG-SITE-2';
const WS1_CODE = 'POS-STG-01';
const WS2_CODE = 'POS-STG-02';
const ADMIN_EMAIL = 'admin@offline-staging.local';
const ADMIN_USERNAME = 'admin.offline.staging';
const CLEANUP_SQL = path.join(REPO_ROOT, 'database', 'cleanup_offline_5_demo.sql');
const ONLY_SCENARIOS = new Set(
  String(process.env.OFFLINE5_ONLY_SCENARIOS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

let token = '';
let currentUser = null;

const summary = {
  local: {},
  autosync: {},
  integration: {},
  admin: {},
  notes: [],
};

function currentUserId() {
  return currentUser?.userId ?? currentUser?.id ?? null;
}

function shouldRunScenario(name) {
  return ONLY_SCENARIOS.size === 0 || ONLY_SCENARIOS.has(name);
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function unwrap(body) {
  return body && Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;
}

function isLocalApiUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isoNow() {
  return new Date().toISOString();
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
    crypto: global.crypto,
    window: global.window,
    document: global.document,
    navigator: global.navigator,
    localStorage: global.localStorage,
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

async function api(pathname, options = {}) {
  const response = await fetch(baseUrl + pathname, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text || null;
  }
  const body = unwrap(parsed);
  if (!response.ok) {
    const error = new Error(body?.message || body?.error || text || `HTTP ${response.status}`);
    error.status = response.status;
    error.body = body;
    error.endpoint = pathname;
    throw error;
  }
  return body;
}

async function q(sql, params = []) {
  return client.query(sql, params);
}

async function countBy(sql, params = []) {
  const result = await q(sql, params);
  return Number(result.rows[0]?.total ?? 0);
}

async function runCleanup() {
  const sql = fs.readFileSync(CLEANUP_SQL, 'utf8');
  await client.query(sql);
}

function isRemoteApiRuntime() {
  return !isLocalApiUrl(baseUrl);
}

async function assertOfflineStagingRemoteGuard() {
  if (!isRemoteApiRuntime()) return;

  const tenant = (
    await q(
      `SELECT tenant_id, tenant_code FROM tenants WHERE tenant_code = $1 LIMIT 1`,
      [TENANT_CODE],
    )
  ).rows[0];
  if (!tenant || tenant.tenant_id !== EXPECTED_OFFLINE_STAGING_TENANT_ID) {
    throw new Error(`ABORT_OFFLINE_STAGING_TENANT_GUARD: expected ${EXPECTED_OFFLINE_STAGING_TENANT_ID}, got ${tenant?.tenant_id ?? 'missing'}`);
  }

  const site = (
    await q(
      `SELECT site_id, site_code, site_name FROM sites WHERE tenant_id = $1 AND site_code = $2 LIMIT 1`,
      [EXPECTED_OFFLINE_STAGING_TENANT_ID, MAIN_SITE_CODE],
    )
  ).rows[0];
  if (!site || site.site_id !== EXPECTED_OFFLINE_STAGING_SITE_ID) {
    throw new Error(`ABORT_OFFLINE_STAGING_SITE_GUARD: expected ${EXPECTED_OFFLINE_STAGING_SITE_ID}, got ${site?.site_id ?? 'missing'}`);
  }

  const user = (
    await q(
      `SELECT user_id, tenant_id, site_id, email FROM users WHERE email = $1 LIMIT 1`,
      [ADMIN_EMAIL],
    )
  ).rows[0];
  if (!user || user.tenant_id !== EXPECTED_OFFLINE_STAGING_TENANT_ID || user.email !== ADMIN_EMAIL) {
    throw new Error(`ABORT_OFFLINE_STAGING_USER_GUARD: expected ${ADMIN_EMAIL} on ${EXPECTED_OFFLINE_STAGING_TENANT_ID}`);
  }

  summary.notes.push({
    OFFLINE_STAGING_GUARD: 'PASS',
    tenantId: tenant.tenant_id,
    siteId: site.site_id,
    userEmail: user.email,
    apiUrl: baseUrl,
  });
}

async function ensureGlobalSettings() {
  await q(`
    INSERT INTO currencies (currency_code, currency_name, is_default)
    VALUES
      ('USD', 'Dollar americain', TRUE),
      ('CDF', 'Franc congolais', FALSE)
    ON CONFLICT (currency_code) DO UPDATE
    SET currency_name = EXCLUDED.currency_name,
        is_default = CASE WHEN EXCLUDED.currency_code = 'USD' THEN TRUE ELSE currencies.is_default END
  `);

  await q(`
    INSERT INTO payment_methods (method_code, method_name, is_active)
    VALUES ('CASH', 'Cash', TRUE)
    ON CONFLICT (method_code) DO UPDATE
    SET method_name = EXCLUDED.method_name,
        is_active = TRUE
  `);
}

async function setupOfflineTenant() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await q(
    `
    INSERT INTO tenants (
      tenant_code, tenant_name, tenant_type, legal_name, phone, email, address,
      country, city, subscription_status, is_active
    )
    VALUES (
      $1, 'Offline Staging', 'PHARMACY', 'Offline Staging SARL', '+243810320000',
      'contact@offline-staging.local', 'Kinshasa - Validation Offline 5',
      'RDC', 'Kinshasa', 'ACTIVE', TRUE
    )
    ON CONFLICT (tenant_code) DO UPDATE
    SET tenant_name = EXCLUDED.tenant_name,
        tenant_type = EXCLUDED.tenant_type,
        legal_name = EXCLUDED.legal_name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        address = EXCLUDED.address,
        country = EXCLUDED.country,
        city = EXCLUDED.city,
        subscription_status = EXCLUDED.subscription_status,
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP
    `,
    [TENANT_CODE],
  );

  const tenantId = (
    await q(`SELECT tenant_id FROM tenants WHERE tenant_code = $1 LIMIT 1`, [TENANT_CODE])
  ).rows[0].tenant_id;

  await q(
    `
    INSERT INTO sites (tenant_id, site_code, site_name, site_type, address, phone, is_active)
    VALUES
      ($1, $2, 'OFF-STG Site principal', 'PHARMACY', 'Kinshasa', '+243810320001', TRUE),
      ($1, $3, 'OFF-STG Site secondaire', 'PHARMACY', 'Kinshasa', '+243810320002', TRUE)
    ON CONFLICT (site_code) DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id,
        site_name = EXCLUDED.site_name,
        site_type = EXCLUDED.site_type,
        address = EXCLUDED.address,
        phone = EXCLUDED.phone,
        is_active = TRUE
    `,
    [tenantId, MAIN_SITE_CODE, SECOND_SITE_CODE],
  );

  await q(
    `
    INSERT INTO roles (tenant_id, role_name, description, is_active)
    VALUES ($1, 'ADMIN', 'Administrateur offline staging', TRUE)
    ON CONFLICT (tenant_id, role_name) DO UPDATE
    SET description = EXCLUDED.description,
        is_active = TRUE
    `,
    [tenantId],
  );

  const roleId = (
    await q(`SELECT role_id FROM roles WHERE tenant_id = $1 AND role_name = 'ADMIN' LIMIT 1`, [tenantId])
  ).rows[0].role_id;

  await q(
    `
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT $1, permission_id
    FROM permissions
    ON CONFLICT (role_id, permission_id) DO NOTHING
    `,
    [roleId],
  );

  const sites = await q(`SELECT site_id, site_code FROM sites WHERE tenant_id = $1 ORDER BY site_code`, [tenantId]);
  const mainSiteId = sites.rows.find((row) => row.site_code === MAIN_SITE_CODE).site_id;
  const secondSiteId = sites.rows.find((row) => row.site_code === SECOND_SITE_CODE).site_id;

  await q(
    `
    INSERT INTO tenant_settings (tenant_id, setting_key, setting_value)
    VALUES ($1, 'USD_CDF_RATE', '2800')
    ON CONFLICT (tenant_id, setting_key) DO UPDATE
    SET setting_value = EXCLUDED.setting_value,
        updated_at = CURRENT_TIMESTAMP
    `,
    [tenantId],
  );

  await q(
    `
    INSERT INTO users (
      tenant_id, site_id, role_id, full_name, username, email, phone, password_hash, is_active
    )
    VALUES ($1, $2, $3, 'Admin Offline Staging', $4, $5, '+243810320010', $6, TRUE)
    ON CONFLICT (username) DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id,
        site_id = EXCLUDED.site_id,
        role_id = EXCLUDED.role_id,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        password_hash = EXCLUDED.password_hash,
        is_active = TRUE
    `,
    [tenantId, mainSiteId, roleId, ADMIN_USERNAME, ADMIN_EMAIL, passwordHash],
  );

  return { tenantId, roleId, mainSiteId, secondSiteId };
}

async function loginOfflineAdmin() {
  const auth = await api('/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: PASSWORD },
  });
  token = auth.accessToken;
  currentUser = await api('/auth/me');
  return currentUser;
}

async function ensureReferences(tenantId) {
  const categoryId = (
    await q(
      `
      INSERT INTO categories (tenant_id, category_code, category_name, description, is_active)
      VALUES ($1, 'OFF-STG-CAT', 'OFF-STG Categorie', 'Validation Offline 5', TRUE)
      ON CONFLICT (category_code) DO UPDATE
      SET tenant_id = EXCLUDED.tenant_id,
          category_name = EXCLUDED.category_name,
          description = EXCLUDED.description,
          is_active = TRUE
      RETURNING category_id
      `,
      [tenantId],
    )
  ).rows[0].category_id;

  const subCategoryId = (
    await q(
      `
      INSERT INTO sub_categories (tenant_id, category_id, sub_category_code, sub_category_name, description, is_active)
      VALUES ($1, $2, 'OFF-STG-SUB', 'OFF-STG Sous-categorie', 'Validation Offline 5', TRUE)
      ON CONFLICT (category_id, sub_category_code) DO UPDATE
      SET sub_category_name = EXCLUDED.sub_category_name,
          description = EXCLUDED.description,
          is_active = TRUE
      RETURNING sub_category_id
      `,
      [tenantId, categoryId],
    )
  ).rows[0].sub_category_id;

  const formId = (
    await q(
      `
      INSERT INTO galenic_forms (tenant_id, form_code, form_name)
      VALUES ($1, 'OFF-STG-FORM', 'OFF-STG Forme')
      ON CONFLICT (form_code) DO UPDATE
      SET tenant_id = EXCLUDED.tenant_id,
          form_name = EXCLUDED.form_name
      RETURNING form_id
      `,
      [tenantId],
    )
  ).rows[0].form_id;

  const routeId = (
    await q(
      `
      INSERT INTO administration_routes (tenant_id, route_code, route_name)
      VALUES ($1, 'OFF-STG-ROUTE', 'OFF-STG Voie')
      ON CONFLICT (route_code) DO UPDATE
      SET tenant_id = EXCLUDED.tenant_id,
          route_name = EXCLUDED.route_name
      RETURNING route_id
      `,
      [tenantId],
    )
  ).rows[0].route_id;

  const productTypeId = (
    await q(
      `
      INSERT INTO product_types (tenant_id, type_code, type_name)
      VALUES ($1, 'OFF-STG-TYPE', 'OFF-STG Type')
      ON CONFLICT (type_code) DO UPDATE
      SET tenant_id = EXCLUDED.tenant_id,
          type_name = EXCLUDED.type_name
      RETURNING product_type_id
      `,
      [tenantId],
    )
  ).rows[0].product_type_id;

  const supplierId = (
    await q(
      `
      INSERT INTO suppliers (tenant_id, supplier_code, supplier_name, phone, email, address, is_active)
      VALUES ($1, 'OFF-STG-SUP', 'OFF-STG Fournisseur', '+243810320011', 'supplier@offline-staging.local', 'Kinshasa', TRUE)
      ON CONFLICT (tenant_id, supplier_code) DO UPDATE
      SET supplier_name = EXCLUDED.supplier_name,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          address = EXCLUDED.address,
          is_active = TRUE
      RETURNING supplier_id
      `,
      [tenantId],
    )
  ).rows[0].supplier_id;

  const currencyId = (
    await q(`SELECT currency_id FROM currencies WHERE currency_code = 'USD' LIMIT 1`)
  ).rows[0].currency_id;

  return { categoryId, subCategoryId, formId, routeId, productTypeId, supplierId, currencyId };
}

async function createWorkstation(tenantId, siteId, code) {
  await q(
    `
    INSERT INTO pos_workstations (
      tenant_id, site_id, workstation_code, workstation_name, workstation_type,
      device_uuid, offline_status, sync_state, is_active
    )
    VALUES ($1, $2, $3, $3, 'POS', $3, 'OFFLINE_READY', 'SYNCED', TRUE)
    ON CONFLICT (tenant_id, workstation_code) DO UPDATE
    SET site_id = EXCLUDED.site_id,
        workstation_name = EXCLUDED.workstation_name,
        workstation_type = EXCLUDED.workstation_type,
        device_uuid = EXCLUDED.device_uuid,
        offline_status = EXCLUDED.offline_status,
        sync_state = EXCLUDED.sync_state,
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP
    `,
    [tenantId, siteId, code],
  );
  return (
    await q(
      `SELECT workstation_id, workstation_code, workstation_name, device_uuid FROM pos_workstations WHERE tenant_id = $1 AND workstation_code = $2 LIMIT 1`,
      [tenantId, code],
    )
  ).rows[0];
}

async function closeOpenSessions(tenantId, userId) {
  const sessions = await q(
    `SELECT cash_session_id FROM cash_sessions WHERE tenant_id = $1 AND user_id = $2 AND status = 'OPEN'`,
    [tenantId, userId],
  );
  for (const row of sessions.rows) {
    const totals = await q(
      `SELECT cs.opening_balance,
              COALESCE(SUM(CASE WHEN cm.movement_type IN ('SALE_PAYMENT','RECEIVABLE_PAYMENT','CASH_IN','ADVANCE','ADJUSTMENT') THEN cm.amount ELSE 0 END),0)::numeric AS total_in,
              COALESCE(SUM(CASE WHEN cm.movement_type IN ('SALE_CHANGE','EXPENSE','CASH_OUT','BANK_DEPOSIT') THEN cm.amount ELSE 0 END),0)::numeric AS total_out
       FROM cash_sessions cs
       LEFT JOIN cash_movements cm ON cm.cash_session_id = cs.cash_session_id AND cm.tenant_id = cs.tenant_id
       WHERE cs.cash_session_id = $1
       GROUP BY cs.opening_balance`,
      [row.cash_session_id],
    );
    const countedClosingBalance = Number(totals.rows[0]?.opening_balance ?? 0)
      + Number(totals.rows[0]?.total_in ?? 0)
      - Number(totals.rows[0]?.total_out ?? 0);
    try {
      await api(`/cash/sessions/${row.cash_session_id}/close`, {
        method: 'POST',
        body: { countedClosingBalance, notes: 'validate-offline-5 cleanup' },
      });
    } catch {}
  }
}

async function ensureOnlineCashSession(siteId, workstationId, deviceUuid) {
  await closeOpenSessions(currentUser.tenantId, currentUserId());
  return api('/cash/sessions/open', {
    method: 'POST',
    body: {
      siteId,
      openingBalance: 100,
      workstationId,
      deviceUuid,
      notes: 'validate-offline-5 online session',
    },
  });
}

async function createArticleWithLots(refs, tenantId, siteId, codeSuffix, lotDefinitions) {
  const article = await api('/articles', {
    method: 'POST',
    body: {
      articleCode: `OFF-STG-ARTICLE-${codeSuffix}`,
      commercialName: `OFF-STG-${codeSuffix}`,
      categoryId: refs.categoryId,
      subCategoryId: refs.subCategoryId,
      formId: refs.formId,
      routeId: refs.routeId,
      productTypeId: refs.productTypeId,
      dci: `OFF-STG DCI ${codeSuffix}`,
      dosage: '1 u',
      prescriptionRequired: false,
      defaultStockMin: 1,
      defaultStockMax: 100,
    },
  });

  const purchase = await api('/purchases', {
    method: 'POST',
    body: {
      supplierId: refs.supplierId,
      siteId,
      currencyId: refs.currencyId,
      exchangeRate: 1,
    },
  });

  for (const lot of lotDefinitions) {
    await api(`/purchases/${purchase.purchaseId}/items`, {
      method: 'POST',
      body: {
        articleId: article.articleId,
        lotNumber: lot.lotNumber,
        expiryDate: lot.expiryDate,
        quantity: lot.quantity,
        purchaseUnitPrice: lot.purchaseUnitPrice ?? 1,
        sellingUnitPrice: lot.sellingUnitPrice ?? 2,
      },
    });
  }

  await api(`/purchases/${purchase.purchaseId}/validate`, { method: 'POST' });

  const lots = await q(
    `SELECT lot_id, lot_number, expiry_date FROM lots WHERE tenant_id = $1 AND article_id = $2 ORDER BY lot_number ASC`,
    [tenantId, article.articleId],
  );

  return { article, purchase, lots: lots.rows };
}

async function createAllocation(params) {
  const allocationId = crypto.randomUUID();
  await q(
    `
    INSERT INTO offline_stock_allocations (
      allocation_id, tenant_id, site_id, workstation_id, article_id, lot_id,
      allocated_quantity, consumed_quantity, status, server_version, allocated_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `,
    [
      allocationId,
      params.tenantId,
      params.siteId,
      params.workstationId,
      params.articleId,
      params.lotId,
      params.allocatedQuantity,
      params.consumedQuantity ?? 0,
      params.status ?? 'ACTIVE',
      params.serverVersion ?? 1,
      currentUserId(),
    ],
  );
  return allocationId;
}

function buildOpenOperation(input) {
  return {
    operationType: 'CASH_SESSION_OPEN',
    operationId: input.operationId,
    localCashSessionId: input.localCashSessionId,
    offlineCashReference: input.offlineCashReference,
    tenantId: input.tenantId,
    siteId: input.siteId,
    workstationId: input.workstationId,
    deviceId: input.deviceId,
    userId: input.userId,
    openingBalanceUsd: input.openingBalanceUsd,
    openingBalanceCdf: input.openingBalanceCdf,
    note: input.note ?? null,
    openedLocallyAt: input.openedLocallyAt ?? isoNow(),
  };
}

function buildSaleOperation(input) {
  const total = roundMoney(input.quantity * input.unitPrice);
  return {
    operationType: 'SALE_VALIDATE',
    operationId: input.operationId,
    localSaleId: input.localSaleId,
    offlineReference: input.offlineReference,
    tenantId: input.tenantId,
    siteId: input.siteId,
    workstationId: input.workstationId,
    deviceId: input.deviceId,
    userId: input.userId,
    cashSessionId: input.serverCashSessionId ?? null,
    localCashSessionId: input.localCashSessionId,
    cashSessionOpenOperationId: input.cashSessionOpenOperationId ?? null,
    customerId: null,
    currency: 'USD',
    exchangeRateSnapshot: 2800,
    createdAt: input.createdAt ?? isoNow(),
    validatedAt: input.validatedAt ?? isoNow(),
    saleMode: 'IMMEDIATE',
    saleType: 'CASH',
    note: input.note ?? null,
    subtotal: total,
    total,
    payment: {
      amountPaidUsd: total,
      amountPaidCdf: 0,
      amountReturnedUsd: 0,
      amountReturnedCdf: 0,
      suggestedChangeUsd: 0,
      suggestedChangeCdf: 0,
      netReceivedUsd: total,
      netReceivedCdf: 0,
      netTotalEquivalentUsd: total,
      settlementDifferenceUsd: 0,
    },
    items: [
      {
        articleId: input.articleId,
        articleCode: input.articleCode,
        articleName: input.articleName,
        quantity: input.quantity,
        unitPriceSnapshot: input.unitPrice,
        lotAllocations: input.allocations.map((row) => ({
          allocationId: row.allocationId,
          lotId: row.lotId,
          lotNumber: row.lotNumber,
          expiryDate: row.expiryDate,
          quantity: row.quantity,
          allocationServerVersion: row.allocationServerVersion,
        })),
      },
    ],
  };
}

function buildExpenseOperation(input) {
  return {
    operationType: 'CASH_EXPENSE',
    operationId: input.operationId,
    localCashSessionId: input.localCashSessionId,
    offlineCashReference: input.offlineCashReference,
    tenantId: input.tenantId,
    siteId: input.siteId,
    workstationId: input.workstationId,
    deviceId: input.deviceId,
    userId: input.userId,
    serverCashSessionId: input.serverCashSessionId ?? null,
    cashSessionOpenOperationId: input.cashSessionOpenOperationId ?? null,
    localMovementId: input.localMovementId,
    amount: input.amount,
    currency: input.currency,
    expenseCategory: input.expenseCategory,
    description: input.description,
    createdLocallyAt: input.createdLocallyAt ?? isoNow(),
  };
}

function buildCloseOperation(input) {
  return {
    operationType: 'CASH_SESSION_CLOSE',
    operationId: input.operationId,
    localCashSessionId: input.localCashSessionId,
    offlineCashReference: input.offlineCashReference,
    tenantId: input.tenantId,
    siteId: input.siteId,
    workstationId: input.workstationId,
    deviceId: input.deviceId,
    userId: input.userId,
    serverCashSessionId: input.serverCashSessionId ?? null,
    cashSessionOpenOperationId: input.cashSessionOpenOperationId ?? null,
    declaredClosingUsd: input.declaredClosingUsd,
    declaredClosingCdf: input.declaredClosingCdf,
    expectedClosingUsd: input.expectedClosingUsd,
    expectedClosingCdf: input.expectedClosingCdf,
    differenceUsd: input.differenceUsd,
    differenceCdf: input.differenceCdf,
    note: input.note ?? null,
    closedLocallyAt: input.closedLocallyAt ?? isoNow(),
  };
}

async function pushSingleOperation(operation) {
  const response = await api('/pos-sync/operations', {
    method: 'POST',
    body: { operations: [operation] },
  });
  return response.results[0];
}

async function listServerOps(operationIds) {
  const result = await q(
    `SELECT operation_id, operation_type, status, processed_at
     FROM pos_sync_operations
     WHERE tenant_id = $1
       AND operation_id = ANY($2::uuid[])
     ORDER BY processed_at ASC, created_at ASC`,
    [currentUser.tenantId, operationIds],
  );
  return result.rows.map((row) => ({
    operationId: row.operation_id,
    operationType: row.operation_type,
    status: row.status,
    processedAt: row.processed_at ? row.processed_at.toISOString() : null,
  }));
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

function createOfflineCashLocalHarness(options = {}) {
  const memory = {
    snapshot: {
      auth: {
        tenantId: 'tenant-1',
        siteId: 'site-1',
        userId: 'user-1',
        displayName: 'Offline Test',
        role: 'ADMIN',
        permissions: options.permissions ?? ['cash_sessions.open', 'cash_expenses.create', 'cash_sessions.close'],
        lastServerValidationAt: isoNow(),
        offlineAuthorizationExpiresAt: '2026-08-13T00:00:00.000Z',
      },
      workstation: {
        siteId: 'site-1',
        siteCode: 'OFF',
        siteName: 'Offline Site',
        workstationId: 'ws-1',
        workstationCode: 'POS-STG-01',
        workstationName: 'POS-STG-01',
        deviceId: 'device-1',
        status: 'OFFLINE_READY',
        syncState: 'SYNCED',
        appVersion: 'offline-5-test',
      },
    },
    sessions: [],
    movements: [],
    counts: [],
    events: [],
    queue: [],
    logs: [],
  };

  const previousGlobals = {
    crypto: global.crypto,
    structuredClone: global.structuredClone,
    localStorage: global.localStorage,
  };

  global.crypto = webcrypto;
  global.structuredClone = global.structuredClone ?? deepClone;
  global.localStorage = createLocalStorage();

  const bootstrapStub = {
    calculateAuthorizationState() {
      return options.authorizationState ?? 'AUTHORIZED';
    },
  };

  const storageStub = {
    async appendOfflineActivityLog(entry) {
      memory.logs.push({ ...deepClone(entry), createdAt: isoNow() });
    },
    async appendOfflineSyncQueueEntry(entry) {
      memory.queue.push({
        localId: crypto.randomUUID(),
        createdAt: isoNow(),
        updatedAt: isoNow(),
        status: 'PENDING',
        ...deepClone(entry),
      });
    },
    async readOfflineCashCounts() {
      return deepClone(memory.counts);
    },
    async readOfflineCashMovements() {
      return deepClone(memory.movements);
    },
    async readOfflineCashReconciliationEvents() {
      return deepClone(memory.events);
    },
    async readOfflineCashSession() {
      return deepClone(memory.sessions[0] ?? null);
    },
    async readOfflineCashSessions() {
      return deepClone(memory.sessions);
    },
    async readOfflineSnapshot() {
      return deepClone(memory.snapshot);
    },
    async saveOfflineCashCounts(rows) {
      memory.counts = deepClone(rows);
    },
    async saveOfflineCashMovements(rows) {
      memory.movements = deepClone(rows);
    },
    async saveOfflineCashReconciliationEvents(rows) {
      memory.events = deepClone(rows);
    },
    async saveOfflineCashSessions(rows) {
      memory.sessions = deepClone(rows);
      memory.snapshot.cashSession = deepClone(rows.find((row) => ['LOCAL_OPEN', 'OPEN_PENDING_SYNC', 'OPEN_SYNCED', 'LOCAL_CLOSING', 'CLOSED_PENDING_SYNC'].includes(row.status)) ?? null);
    },
  };

  const offlineCash = loadTsModule(OFFLINE_CASH_MODULE_PATH, {
    './offline-storage': storageStub,
    './offline-bootstrap': bootstrapStub,
  });

  return {
    memory,
    module: offlineCash,
    cleanup() {
      global.crypto = previousGlobals.crypto;
      global.structuredClone = previousGlobals.structuredClone;
      global.localStorage = previousGlobals.localStorage;
    },
  };
}

function createCashSyncHarness() {
  const fastBackoff = '[15, 30, 45, 60, 75] as const';
  const sourceTransform = (source) =>
    source
      .replace('const AUTO_SYNC_INTERVAL_MS = 60_000;', 'const AUTO_SYNC_INTERVAL_MS = 25;')
      .replace("const BACKOFF_STEPS_MS = [60_000, 120_000, 300_000, 600_000, 1_800_000] as const;", `const BACKOFF_STEPS_MS = ${fastBackoff};`)
      .replace(/import\.meta\.env\.VITE_APP_VERSION \?\? 'web'/g, "'web'");

  const memory = {
    sessions: [
      {
        localCashSessionId: 'local-session-a',
        serverCashSessionId: null,
        serverSessionReference: null,
        status: 'OPEN_PENDING_SYNC',
        openingOperationId: 'open-a',
      },
      {
        localCashSessionId: 'local-session-b',
        serverCashSessionId: null,
        serverSessionReference: null,
        status: 'OPEN_PENDING_SYNC',
        openingOperationId: 'open-b',
      },
    ],
    queue: [],
    conflicts: [],
    logs: [],
    snapshot: {
      syncState: {
        syncCursor: null,
        lastSuccessfulSyncAt: null,
        lastAttemptAt: null,
        snapshotStatus: 'FRESH',
        networkStatus: 'ONLINE',
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      workstation: {
        workstationId: 'ws-1',
        deviceId: 'device-1',
        appVersion: 'offline-5-test',
      },
    },
    pushOrder: [],
  };

  const now = new Date('2026-08-12T10:00:00.000Z');
  function nextTime(minutes) {
    return new Date(now.getTime() + minutes * 60_000).toISOString();
  }

  memory.queue = [
    {
      localId: '1',
      operationId: 'open-a',
      operationType: 'CASH_SESSION_OPEN',
      workstationId: 'ws-1',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      payload: buildOpenOperation({
        operationId: 'open-a',
        localCashSessionId: 'local-session-a',
        offlineCashReference: 'OFF-CASH-A',
        tenantId: 'tenant-1',
        siteId: 'site-1',
        workstationId: 'ws-1',
        deviceId: 'device-1',
        userId: 'user-1',
        openingBalanceUsd: 20,
        openingBalanceCdf: 0,
        openedLocallyAt: nextTime(0),
      }),
      status: 'PENDING',
      relatedLocalCashSessionId: 'local-session-a',
      dependencyGroup: 'CASH_SESSION:local-session-a',
      createdAt: nextTime(0),
      updatedAt: nextTime(0),
    },
    {
      localId: '2',
      operationId: 'sale-a-1',
      operationType: 'SALE_VALIDATE',
      workstationId: 'ws-1',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      payload: buildSaleOperation({
        operationId: 'sale-a-1',
        localSaleId: 'local-sale-a-1',
        offlineReference: 'OFF-SALE-A-1',
        tenantId: 'tenant-1',
        siteId: 'site-1',
        workstationId: 'ws-1',
        deviceId: 'device-1',
        userId: 'user-1',
        localCashSessionId: 'local-session-a',
        cashSessionOpenOperationId: 'open-a',
        articleId: 'article-1',
        articleCode: 'A1',
        articleName: 'Article A1',
        quantity: 1,
        unitPrice: 5,
        allocations: [{ allocationId: 'alloc-1', lotId: 'lot-1', lotNumber: 'LOT-1', expiryDate: '2028-12-31', quantity: 1, allocationServerVersion: 1 }],
        createdAt: nextTime(1),
        validatedAt: nextTime(1),
      }),
      status: 'PENDING',
      relatedLocalCashSessionId: 'local-session-a',
      dependsOnOperationId: 'open-a',
      dependencyGroup: 'CASH_SESSION:local-session-a',
      createdAt: nextTime(1),
      updatedAt: nextTime(1),
    },
    {
      localId: '3',
      operationId: 'sale-a-2',
      operationType: 'SALE_VALIDATE',
      workstationId: 'ws-1',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      payload: buildSaleOperation({
        operationId: 'sale-a-2',
        localSaleId: 'local-sale-a-2',
        offlineReference: 'OFF-SALE-A-2',
        tenantId: 'tenant-1',
        siteId: 'site-1',
        workstationId: 'ws-1',
        deviceId: 'device-1',
        userId: 'user-1',
        localCashSessionId: 'local-session-a',
        cashSessionOpenOperationId: 'open-a',
        articleId: 'article-1',
        articleCode: 'A1',
        articleName: 'Article A1',
        quantity: 1,
        unitPrice: 5,
        allocations: [{ allocationId: 'alloc-2', lotId: 'lot-1', lotNumber: 'LOT-1', expiryDate: '2028-12-31', quantity: 1, allocationServerVersion: 1 }],
        createdAt: nextTime(2),
        validatedAt: nextTime(2),
      }),
      status: 'PENDING',
      relatedLocalCashSessionId: 'local-session-a',
      dependsOnOperationId: 'open-a',
      dependencyGroup: 'CASH_SESSION:local-session-a',
      createdAt: nextTime(2),
      updatedAt: nextTime(2),
    },
    {
      localId: '4',
      operationId: 'sale-a-3',
      operationType: 'SALE_VALIDATE',
      workstationId: 'ws-1',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      payload: buildSaleOperation({
        operationId: 'sale-a-3',
        localSaleId: 'local-sale-a-3',
        offlineReference: 'OFF-SALE-A-3',
        tenantId: 'tenant-1',
        siteId: 'site-1',
        workstationId: 'ws-1',
        deviceId: 'device-1',
        userId: 'user-1',
        localCashSessionId: 'local-session-a',
        cashSessionOpenOperationId: 'open-a',
        articleId: 'article-1',
        articleCode: 'A1',
        articleName: 'Article A1',
        quantity: 1,
        unitPrice: 5,
        allocations: [{ allocationId: 'alloc-3', lotId: 'lot-1', lotNumber: 'LOT-1', expiryDate: '2028-12-31', quantity: 1, allocationServerVersion: 1 }],
        createdAt: nextTime(3),
        validatedAt: nextTime(3),
      }),
      status: 'PENDING',
      relatedLocalCashSessionId: 'local-session-a',
      dependsOnOperationId: 'open-a',
      dependencyGroup: 'CASH_SESSION:local-session-a',
      createdAt: nextTime(3),
      updatedAt: nextTime(3),
    },
    {
      localId: '5',
      operationId: 'expense-a',
      operationType: 'CASH_EXPENSE',
      workstationId: 'ws-1',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      payload: buildExpenseOperation({
        operationId: 'expense-a',
        localCashSessionId: 'local-session-a',
        offlineCashReference: 'OFF-CASH-A',
        tenantId: 'tenant-1',
        siteId: 'site-1',
        workstationId: 'ws-1',
        deviceId: 'device-1',
        userId: 'user-1',
        cashSessionOpenOperationId: 'open-a',
        localMovementId: 'movement-a',
        amount: 3,
        currency: 'USD',
        expenseCategory: 'Divers',
        description: 'Expense A',
        createdLocallyAt: nextTime(4),
      }),
      status: 'PENDING',
      relatedLocalCashSessionId: 'local-session-a',
      dependsOnOperationId: 'open-a',
      dependencyGroup: 'CASH_SESSION:local-session-a',
      createdAt: nextTime(4),
      updatedAt: nextTime(4),
    },
    {
      localId: '6',
      operationId: 'close-a',
      operationType: 'CASH_SESSION_CLOSE',
      workstationId: 'ws-1',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      payload: buildCloseOperation({
        operationId: 'close-a',
        localCashSessionId: 'local-session-a',
        offlineCashReference: 'OFF-CASH-A',
        tenantId: 'tenant-1',
        siteId: 'site-1',
        workstationId: 'ws-1',
        deviceId: 'device-1',
        userId: 'user-1',
        cashSessionOpenOperationId: 'open-a',
        declaredClosingUsd: 32,
        declaredClosingCdf: 0,
        expectedClosingUsd: 32,
        expectedClosingCdf: 0,
        differenceUsd: 0,
        differenceCdf: 0,
        closedLocallyAt: nextTime(5),
      }),
      status: 'PENDING',
      relatedLocalCashSessionId: 'local-session-a',
      dependsOnOperationId: 'open-a',
      dependencyGroup: 'CASH_SESSION:local-session-a',
      createdAt: nextTime(5),
      updatedAt: nextTime(5),
    },
    {
      localId: '7',
      operationId: 'open-b',
      operationType: 'CASH_SESSION_OPEN',
      workstationId: 'ws-2',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      payload: buildOpenOperation({
        operationId: 'open-b',
        localCashSessionId: 'local-session-b',
        offlineCashReference: 'OFF-CASH-B',
        tenantId: 'tenant-1',
        siteId: 'site-1',
        workstationId: 'ws-2',
        deviceId: 'device-2',
        userId: 'user-1',
        openingBalanceUsd: 10,
        openingBalanceCdf: 0,
        openedLocallyAt: nextTime(6),
      }),
      status: 'PENDING',
      relatedLocalCashSessionId: 'local-session-b',
      dependencyGroup: 'CASH_SESSION:local-session-b',
      createdAt: nextTime(6),
      updatedAt: nextTime(6),
    },
    {
      localId: '8',
      operationId: 'sale-b-1',
      operationType: 'SALE_VALIDATE',
      workstationId: 'ws-2',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      payload: buildSaleOperation({
        operationId: 'sale-b-1',
        localSaleId: 'local-sale-b-1',
        offlineReference: 'OFF-SALE-B-1',
        tenantId: 'tenant-1',
        siteId: 'site-1',
        workstationId: 'ws-2',
        deviceId: 'device-2',
        userId: 'user-1',
        localCashSessionId: 'local-session-b',
        cashSessionOpenOperationId: 'open-b',
        articleId: 'article-1',
        articleCode: 'A1',
        articleName: 'Article A1',
        quantity: 1,
        unitPrice: 4,
        allocations: [{ allocationId: 'alloc-4', lotId: 'lot-1', lotNumber: 'LOT-1', expiryDate: '2028-12-31', quantity: 1, allocationServerVersion: 1 }],
        createdAt: nextTime(7),
        validatedAt: nextTime(7),
      }),
      status: 'PENDING',
      relatedLocalCashSessionId: 'local-session-b',
      dependsOnOperationId: 'open-b',
      dependencyGroup: 'CASH_SESSION:local-session-b',
      createdAt: nextTime(7),
      updatedAt: nextTime(7),
    },
    {
      localId: '9',
      operationId: 'close-b',
      operationType: 'CASH_SESSION_CLOSE',
      workstationId: 'ws-2',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      payload: buildCloseOperation({
        operationId: 'close-b',
        localCashSessionId: 'local-session-b',
        offlineCashReference: 'OFF-CASH-B',
        tenantId: 'tenant-1',
        siteId: 'site-1',
        workstationId: 'ws-2',
        deviceId: 'device-2',
        userId: 'user-1',
        cashSessionOpenOperationId: 'open-b',
        declaredClosingUsd: 14,
        declaredClosingCdf: 0,
        expectedClosingUsd: 14,
        expectedClosingCdf: 0,
        differenceUsd: 0,
        differenceCdf: 0,
        closedLocallyAt: nextTime(8),
      }),
      status: 'PENDING',
      relatedLocalCashSessionId: 'local-session-b',
      dependsOnOperationId: 'open-b',
      dependencyGroup: 'CASH_SESSION:local-session-b',
      createdAt: nextTime(8),
      updatedAt: nextTime(8),
    },
  ];

  const previousGlobals = {
    window: global.window,
    document: global.document,
    navigator: global.navigator,
    localStorage: global.localStorage,
    crypto: global.crypto,
    structuredClone: global.structuredClone,
  };
  global.window = {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    addEventListener() {},
    removeEventListener() {},
  };
  global.document = {
    visibilityState: 'visible',
    addEventListener() {},
    removeEventListener() {},
  };
  global.navigator = { onLine: true };
  global.localStorage = createLocalStorage();
  global.crypto = webcrypto;
  global.structuredClone = global.structuredClone ?? deepClone;

  const storageStub = {
    async appendSyncConflict(entry) {
      memory.conflicts.push({ ...deepClone(entry), createdAt: isoNow() });
    },
    async appendSyncLog(entry) {
      memory.logs.push({ ...deepClone(entry), createdAt: isoNow() });
    },
    async patchOfflineSyncQueueEntry(operationId, mutate) {
      const index = memory.queue.findIndex((row) => row.operationId === operationId);
      if (index === -1) return null;
      memory.queue[index] = mutate(deepClone(memory.queue[index]));
      return deepClone(memory.queue[index]);
    },
    async readOfflineCashSessions() {
      return deepClone(memory.sessions);
    },
    async readOfflineConflicts() {
      return deepClone(memory.conflicts);
    },
    async readOfflineSnapshot() {
      return deepClone(memory.snapshot);
    },
    async readOfflineSyncQueue() {
      return deepClone(memory.queue);
    },
    async resetStaleSyncingQueueEntries() {
      return deepClone(memory.queue);
    },
    async updateOfflineSyncOperationResult({ operationId, nextStatus, result, errorCode, errorMessage }) {
      const queueIndex = memory.queue.findIndex((row) => row.operationId === operationId);
      if (queueIndex >= 0) {
        memory.queue[queueIndex] = {
          ...memory.queue[queueIndex],
          status: nextStatus,
          updatedAt: isoNow(),
          lastErrorCode: errorCode ?? null,
          lastErrorMessage: errorMessage ?? null,
        };
      }

      const entry = memory.queue[queueIndex];
      if (!entry) return;
      const sessionIndex = memory.sessions.findIndex((row) => row.localCashSessionId === entry.relatedLocalCashSessionId);
      if (sessionIndex === -1) return;

      if (entry.operationType === 'CASH_SESSION_OPEN' && nextStatus === 'SYNCED') {
        memory.sessions[sessionIndex] = {
          ...memory.sessions[sessionIndex],
          status: 'OPEN_SYNCED',
          serverCashSessionId: result?.serverCashSessionId ?? 'server-session-a',
          serverSessionReference: result?.serverSessionReference ?? memory.sessions[sessionIndex].serverSessionReference,
        };
      }
      if (entry.operationType === 'CASH_SESSION_CLOSE' && nextStatus === 'SYNCED') {
        memory.sessions[sessionIndex] = {
          ...memory.sessions[sessionIndex],
          status: 'CLOSED_SYNCED',
        };
      }
      if (nextStatus === 'CONFLICT') {
        memory.sessions[sessionIndex] = {
          ...memory.sessions[sessionIndex],
          status: 'CONFLICT',
        };
      }
    },
    async writeOfflineSyncState(syncState) {
      memory.snapshot.syncState = deepClone(syncState);
    },
  };

  const bootstrapStub = {
    getStableDeviceId() {
      return 'device-1';
    },
    async pingPosSync() {
      return { networkStatus: 'ONLINE', ping: { status: 'OK', serverTime: isoNow(), appVersion: 'offline-5-test' } };
    },
    async applyChanges() {
      memory.snapshot.syncState.lastSuccessfulSyncAt = isoNow();
      memory.snapshot.syncState.syncCursor = `cursor-${memory.pushOrder.length}`;
    },
  };

  const posSyncServiceStub = {
    posSyncService: {
      async heartbeat() {
        return { data: { workstationId: 'ws-1', status: 'ONLINE', serverTime: isoNow() } };
      },
      async pushOperations(payload) {
        const operation = payload.operations[0];
        memory.pushOrder.push({
          operationType: operation.operationType,
          operationId: operation.operationId,
          serverCashSessionId:
            operation.operationType === 'SALE_VALIDATE'
            || operation.operationType === 'CASH_EXPENSE'
            || operation.operationType === 'CASH_SESSION_CLOSE'
              ? operation.cashSessionId ?? operation.serverCashSessionId ?? null
              : null,
        });

        if (operation.operationId === 'close-a') {
          return {
            data: {
              serverTime: isoNow(),
              results: [{ operationId: operation.operationId, status: 'CONFLICT', errorCode: 'CASH_EXPECTED_BALANCE_MISMATCH', message: 'CASH_EXPECTED_BALANCE_MISMATCH' }],
            },
          };
        }

        if (operation.operationType === 'CASH_SESSION_OPEN') {
          return {
            data: {
              serverTime: isoNow(),
              results: [{
                operationId: operation.operationId,
                status: 'SYNCED',
                serverCashSessionId: operation.operationId === 'open-a' ? 'server-session-a' : 'server-session-b',
                serverSessionReference: operation.offlineCashReference,
              }],
            },
          };
        }

        if (operation.operationType === 'CASH_EXPENSE') {
          return {
            data: {
              serverTime: isoNow(),
              results: [{
                operationId: operation.operationId,
                status: 'SYNCED',
                serverCashSessionId: operation.serverCashSessionId,
                serverMovementId: `movement-${operation.operationId}`,
              }],
            },
          };
        }

        if (operation.operationType === 'CASH_SESSION_CLOSE') {
          return {
            data: {
              serverTime: isoNow(),
              results: [{
                operationId: operation.operationId,
                status: 'SYNCED',
                serverCashSessionId: operation.serverCashSessionId,
                serverClosedAt: isoNow(),
                serverExpectedUsd: operation.expectedClosingUsd,
                serverExpectedCdf: operation.expectedClosingCdf,
                serverDeclaredUsd: operation.declaredClosingUsd,
                serverDeclaredCdf: operation.declaredClosingCdf,
                serverDifferenceUsd: operation.differenceUsd,
                serverDifferenceCdf: operation.differenceCdf,
              }],
            },
          };
        }

        return {
          data: {
            serverTime: isoNow(),
            results: [{
              operationId: operation.operationId,
              status: 'SYNCED',
              serverSaleId: `sale-${operation.operationId}`,
              serverSaleNumber: `SAL-${operation.operationId}`,
            }],
          },
        };
      },
    },
  };

  const syncEngine = loadTsModule(
    SYNC_ENGINE_MODULE_PATH,
    {
      '../../services/posSync.service': posSyncServiceStub,
      './offline-storage': storageStub,
      './offline-bootstrap': bootstrapStub,
      './offline-config': {
        OFFLINE_APP_VERSION: 'web',
        OFFLINE_DB_VERSION: 6,
      },
    },
    sourceTransform,
  );

  return {
    memory,
    syncEngine,
    cleanup() {
      global.window = previousGlobals.window;
      global.document = previousGlobals.document;
      global.navigator = previousGlobals.navigator;
      global.localStorage = previousGlobals.localStorage;
      global.crypto = previousGlobals.crypto;
      global.structuredClone = previousGlobals.structuredClone;
    },
  };
}

async function runLocalScenarios() {
  if (!shouldRunScenario('local')) return null;
  const harness = createOfflineCashLocalHarness();
  try {
    const opened = await harness.module.openOfflineCashSession({
      openingBalanceUsd: 10,
      openingBalanceCdf: 28000,
      note: 'Open local',
    });

    const afterOpen = {
      sessionStatus: opened.status,
      movementCount: harness.memory.movements.length,
      queueTypes: harness.memory.queue.map((row) => row.operationType),
    };

    const afterExpense = await harness.module.createOfflineCashExpense({
      localCashSessionId: opened.localCashSessionId,
      amount: 3,
      currency: 'USD',
      expenseCategory: 'Divers',
      description: 'Expense local',
    });

    const afterClose = await harness.module.closeOfflineCashSession({
      localCashSessionId: opened.localCashSessionId,
      declaredClosingUsd: 7,
      declaredClosingCdf: 28000,
      note: 'Close local',
    });

    const zeroHarness = createOfflineCashLocalHarness();
    let zeroOpen;
    try {
      zeroOpen = await zeroHarness.module.openOfflineCashSession({
        openingBalanceUsd: 0,
        openingBalanceCdf: 0,
        note: 'Zero open',
      });
    } finally {
      zeroHarness.cleanup();
    }

    const legacyExpiryHarness = createOfflineCashLocalHarness({
      authorizationState: 'AUTHORIZED',
    });
    let legacyExpiryStatus = null;
    try {
      const legacySession = await legacyExpiryHarness.module.openOfflineCashSession({
        openingBalanceUsd: 1,
        openingBalanceCdf: 0,
      });
      legacyExpiryStatus = legacySession.status;
    } catch (error) {
      legacyExpiryStatus = error.message;
    } finally {
      legacyExpiryHarness.cleanup();
    }

    const revokedHarness = createOfflineCashLocalHarness({ authorizationState: 'REVOKED' });
    let revokedMessage = null;
    try {
      await revokedHarness.module.openOfflineCashSession({
        openingBalanceUsd: 1,
        openingBalanceCdf: 0,
      });
    } catch (error) {
      revokedMessage = error.message;
    } finally {
      revokedHarness.cleanup();
    }

    const permissionHarness = createOfflineCashLocalHarness({ permissions: ['cash_sessions.open'] });
    let permissionMessage = null;
    try {
      const permissionSession = await permissionHarness.module.openOfflineCashSession({
        openingBalanceUsd: 1,
        openingBalanceCdf: 0,
      });
      await permissionHarness.module.createOfflineCashExpense({
        localCashSessionId: permissionSession.localCashSessionId,
        amount: 1,
        currency: 'USD',
        expenseCategory: 'Divers',
        description: 'Should fail',
      });
    } catch (error) {
      permissionMessage = error.message;
    } finally {
      permissionHarness.cleanup();
    }

    const passed =
      afterOpen.sessionStatus === 'OPEN_PENDING_SYNC'
      && afterOpen.movementCount === 2
      && harness.memory.queue.length === 3
      && harness.memory.counts.length === 1
      && afterExpense.expectedClosingUsd === 7
      && afterClose.status === 'CLOSED_PENDING_SYNC'
      && zeroOpen.status === 'OPEN_PENDING_SYNC'
      && legacyExpiryStatus === 'OPEN_PENDING_SYNC'
      && revokedMessage === 'WORKSTATION_REVOKED'
      && permissionMessage === 'PERMISSION_DENIED';

    return {
      passed,
      afterOpen,
      afterExpenseExpectedUsd: afterExpense.expectedClosingUsd,
      afterCloseStatus: afterClose.status,
      queueTypes: harness.memory.queue.map((row) => row.operationType),
      zeroOpeningStatus: zeroOpen.status,
      legacyExpiryStatus,
      revokedMessage,
      permissionMessage,
    };
  } finally {
    harness.cleanup();
  }
}

async function runCashAutosyncScenario() {
  if (!shouldRunScenario('autosync')) return null;
  const harness = createCashSyncHarness();
  try {
    const results = await harness.syncEngine.processPendingOfflineQueue();
    const order = harness.memory.pushOrder.map((row) => row.operationType);
    const closeBeforeExpense = harness.memory.pushOrder.findIndex((row) => row.operationId === 'close-a')
      < harness.memory.pushOrder.findIndex((row) => row.operationId === 'expense-a');
    const salePayloads = harness.memory.pushOrder.filter((row) => row.operationType === 'SALE_VALIDATE');
    const sessionBClosed = harness.memory.queue.find((row) => row.operationId === 'close-b')?.status === 'SYNCED';
    const sessionAConflict = harness.memory.queue.find((row) => row.operationId === 'close-a')?.status === 'CONFLICT';

    const passed =
      JSON.stringify(order) === JSON.stringify([
        'CASH_SESSION_OPEN',
        'SALE_VALIDATE',
        'SALE_VALIDATE',
        'SALE_VALIDATE',
        'CASH_EXPENSE',
        'CASH_SESSION_CLOSE',
        'CASH_SESSION_OPEN',
        'SALE_VALIDATE',
        'CASH_SESSION_CLOSE',
      ])
      && closeBeforeExpense === false
      && salePayloads.every((row) => row.serverCashSessionId === 'server-session-a' || row.serverCashSessionId === 'server-session-b')
      && sessionAConflict
      && sessionBClosed
      && results.some((row) => row.operationId === 'close-a' && row.status === 'CONFLICT');

    return {
      passed,
      order,
      salePayloads,
      queueStatuses: harness.memory.queue.map((row) => ({ operationId: row.operationId, status: row.status })),
      resultStatuses: results.map((row) => ({ operationId: row.operationId, status: row.status, errorCode: row.errorCode ?? null })),
    };
  } finally {
    harness.cleanup();
  }
}

async function runIntegrationScenarios(setup, refs, workstations) {
  const ws1 = workstations.ws1;
  const ws2 = workstations.ws2;
  const happyArticle = await createArticleWithLots(refs, setup.tenantId, setup.mainSiteId, 'CASH-HAPPY', [
    { lotNumber: 'OFF-STG-LOT-CASH-HAPPY-1', expiryDate: '2028-12-31', quantity: 1, purchaseUnitPrice: 1, sellingUnitPrice: 5 },
    { lotNumber: 'OFF-STG-LOT-CASH-HAPPY-2', expiryDate: '2028-12-31', quantity: 1, purchaseUnitPrice: 1, sellingUnitPrice: 5 },
    { lotNumber: 'OFF-STG-LOT-CASH-HAPPY-3', expiryDate: '2028-12-31', quantity: 1, purchaseUnitPrice: 1, sellingUnitPrice: 5 },
  ]);
  const allocationContexts = [];
  for (let index = 0; index < 3; index += 1) {
    const lot = happyArticle.lots[index];
    const allocationId = await createAllocation({
      tenantId: setup.tenantId,
      siteId: setup.mainSiteId,
      workstationId: ws1.workstation_id,
      articleId: happyArticle.article.articleId,
      lotId: lot.lot_id,
      allocatedQuantity: 1,
      serverVersion: 1,
    });
    allocationContexts.push({ allocationId, lot });
  }

  const localCashSessionId = crypto.randomUUID();
  const openOperationId = crypto.randomUUID();
  const openOperation = buildOpenOperation({
    operationId: openOperationId,
    localCashSessionId,
    offlineCashReference: 'OFF-CASH-HAPPY-0001',
    tenantId: setup.tenantId,
    siteId: setup.mainSiteId,
    workstationId: ws1.workstation_id,
    deviceId: ws1.device_uuid,
    userId: currentUserId(),
    openingBalanceUsd: 20,
    openingBalanceCdf: 28000,
    note: 'Happy open',
  });
  const openResult = await pushSingleOperation(openOperation);
  const retryOpenResult = await pushSingleOperation(openOperation);
  const serverCashSessionId = openResult.serverCashSessionId;

  const saleResults = [];
  const saleOperationIds = [];
  for (let index = 0; index < 3; index += 1) {
    const saleOperation = buildSaleOperation({
      operationId: crypto.randomUUID(),
      localSaleId: crypto.randomUUID(),
      offlineReference: `OFF-STG-SALE-${index + 1}`,
      tenantId: setup.tenantId,
      siteId: setup.mainSiteId,
      workstationId: ws1.workstation_id,
      deviceId: ws1.device_uuid,
      userId: currentUserId(),
      serverCashSessionId,
      localCashSessionId,
        cashSessionOpenOperationId: openOperationId,
        articleId: happyArticle.article.articleId,
        articleCode: happyArticle.article.articleCode,
        articleName: happyArticle.article.commercialName,
        quantity: 1,
        unitPrice: 5,
        allocations: [{
          allocationId: allocationContexts[index].allocationId,
          lotId: allocationContexts[index].lot.lot_id,
          lotNumber: allocationContexts[index].lot.lot_number,
          expiryDate: String(allocationContexts[index].lot.expiry_date).slice(0, 10),
          quantity: 1,
          allocationServerVersion: 1,
        }],
      });
    saleOperationIds.push(saleOperation.operationId);
    saleResults.push(await pushSingleOperation(saleOperation));
  }

  const expenseOperation = buildExpenseOperation({
    operationId: crypto.randomUUID(),
    localCashSessionId,
    offlineCashReference: 'OFF-CASH-HAPPY-0001',
    tenantId: setup.tenantId,
    siteId: setup.mainSiteId,
    workstationId: ws1.workstation_id,
    deviceId: ws1.device_uuid,
    userId: currentUserId(),
    serverCashSessionId,
    cashSessionOpenOperationId: openOperationId,
    localMovementId: crypto.randomUUID(),
    amount: 4,
    currency: 'USD',
    expenseCategory: 'Divers',
    description: 'Expense happy',
  });
  const expenseResult = await pushSingleOperation(expenseOperation);
  const retryExpenseResult = await pushSingleOperation(expenseOperation);

  const closeOperation = buildCloseOperation({
    operationId: crypto.randomUUID(),
    localCashSessionId,
    offlineCashReference: 'OFF-CASH-HAPPY-0001',
    tenantId: setup.tenantId,
    siteId: setup.mainSiteId,
    workstationId: ws1.workstation_id,
    deviceId: ws1.device_uuid,
    userId: currentUserId(),
    serverCashSessionId,
    cashSessionOpenOperationId: openOperationId,
    declaredClosingUsd: 31,
    declaredClosingCdf: 28000,
    expectedClosingUsd: 31,
    expectedClosingCdf: 28000,
    differenceUsd: 0,
    differenceCdf: 0,
    note: 'Happy close',
  });
  const closeResult = await pushSingleOperation(closeOperation);
  const retryCloseResult = await pushSingleOperation(closeOperation);

  const serverOps = await listServerOps([
    openOperationId,
    ...saleOperationIds,
    expenseOperation.operationId,
    closeOperation.operationId,
  ]);

  const saleCount = await countBy(`SELECT COUNT(*)::int AS total FROM sales WHERE tenant_id = $1`, [setup.tenantId]);
  const paymentCount = await countBy(`SELECT COUNT(*)::int AS total FROM payments WHERE tenant_id = $1`, [setup.tenantId]);
  const expenseCount = await countBy(`SELECT COUNT(*)::int AS total FROM cash_expenses WHERE tenant_id = $1`, [setup.tenantId]);
  const saleCashMovements = await countBy(
    `SELECT COUNT(*)::int AS total FROM cash_movements WHERE tenant_id = $1 AND reference_type = 'SALE'`,
    [setup.tenantId],
  );

  const sessionRow = (
    await q(
      `SELECT status, counted_closing_balance_usd, counted_closing_balance_cdf, expected_closing_balance_usd, expected_closing_balance_cdf, closing_difference_usd, closing_difference_cdf
       FROM cash_sessions WHERE tenant_id = $1 AND cash_session_id = $2 LIMIT 1`,
      [setup.tenantId, serverCashSessionId],
    )
  ).rows[0];

  const mismatchLocalSessionId = crypto.randomUUID();
  const mismatchOpenOperation = buildOpenOperation({
    operationId: crypto.randomUUID(),
    localCashSessionId: mismatchLocalSessionId,
    offlineCashReference: 'OFF-CASH-MISMATCH-0001',
    tenantId: setup.tenantId,
    siteId: setup.mainSiteId,
    workstationId: ws2.workstation_id,
    deviceId: ws2.device_uuid,
    userId: currentUserId(),
    openingBalanceUsd: 5,
    openingBalanceCdf: 0,
  });
  const mismatchOpenResult = await pushSingleOperation(mismatchOpenOperation);
  const mismatchCloseOperation = buildCloseOperation({
    operationId: crypto.randomUUID(),
    localCashSessionId: mismatchLocalSessionId,
    offlineCashReference: 'OFF-CASH-MISMATCH-0001',
    tenantId: setup.tenantId,
    siteId: setup.mainSiteId,
    workstationId: ws2.workstation_id,
    deviceId: ws2.device_uuid,
    userId: currentUserId(),
    serverCashSessionId: mismatchOpenResult.serverCashSessionId,
    cashSessionOpenOperationId: mismatchOpenOperation.operationId,
    declaredClosingUsd: 5,
    declaredClosingCdf: 0,
    expectedClosingUsd: 6,
    expectedClosingCdf: 0,
    differenceUsd: -1,
    differenceCdf: 0,
    note: 'Mismatch close',
  });
  const mismatchResult = await pushSingleOperation(mismatchCloseOperation);

  const conflicts = await api('/pos-sync/admin/conflicts');
  const mismatchConflict = conflicts.find((row) => row.operationId === mismatchCloseOperation.operationId) ?? null;
  let resolvedConflict = null;
  let propagatedConflict = null;
  if (mismatchConflict) {
    const bootstrapBeforeResolve = await api(`/pos-sync/bootstrap?workstationId=${encodeURIComponent(ws2.workstation_id)}&deviceId=${encodeURIComponent(ws2.device_uuid)}`);
    resolvedConflict = await api(`/pos-sync/admin/conflicts/${mismatchConflict.conflictId}/resolve`, {
      method: 'POST',
      body: { resolutionType: 'MANUAL_REVIEW_COMPLETED', note: 'validate-offline-5 mismatch resolved' },
    });

    const changes = await api(`/pos-sync/changes?workstationId=${encodeURIComponent(ws2.workstation_id)}&deviceId=${encodeURIComponent(ws2.device_uuid)}&cursor=${encodeURIComponent(bootstrapBeforeResolve.syncCursor)}`);
    propagatedConflict = (changes.changes?.conflicts ?? []).find((row) => row.conflictId === mismatchConflict.conflictId) ?? null;
  }

  await api(`/pos-sync/admin/workstations/${ws2.workstation_id}/revoke`, { method: 'POST', body: {} });
  let revokedOpenResult;
  try {
    revokedOpenResult = await pushSingleOperation(buildOpenOperation({
      operationId: crypto.randomUUID(),
      localCashSessionId: crypto.randomUUID(),
      offlineCashReference: 'OFF-CASH-REVOKED-0001',
      tenantId: setup.tenantId,
      siteId: setup.mainSiteId,
      workstationId: ws2.workstation_id,
      deviceId: ws2.device_uuid,
      userId: currentUserId(),
      openingBalanceUsd: 1,
      openingBalanceCdf: 0,
    }));
  } catch (error) {
    revokedOpenResult = { thrown: error.message };
  }

  let mismatchExpenseResult;
  try {
    mismatchExpenseResult = await pushSingleOperation(buildExpenseOperation({
      operationId: crypto.randomUUID(),
      localCashSessionId,
      offlineCashReference: 'OFF-CASH-HAPPY-0001',
      tenantId: setup.tenantId,
      siteId: setup.mainSiteId,
      workstationId: ws2.workstation_id,
      deviceId: ws2.device_uuid,
      userId: currentUserId(),
      serverCashSessionId,
      cashSessionOpenOperationId: openOperationId,
      localMovementId: crypto.randomUUID(),
      amount: 1,
      currency: 'USD',
      expenseCategory: 'Mismatch',
      description: 'Wrong workstation',
    }));
  } catch (error) {
    mismatchExpenseResult = { thrown: error.message };
  }

  const cashSessionsList = await api('/cash/sessions');
  const adminWorkstations = await api('/pos-sync/admin/workstations');
  const adminDashboard = await api('/pos-sync/admin/dashboard');
  const adminLogs = await api('/pos-sync/admin/logs');

  const happyPassed =
    openResult.status === 'SYNCED'
    && retryOpenResult.status === 'ALREADY_PROCESSED'
    && saleResults.every((row) => row.status === 'SYNCED')
    && expenseResult.status === 'SYNCED'
    && retryExpenseResult.status === 'ALREADY_PROCESSED'
    && closeResult.status === 'SYNCED'
    && retryCloseResult.status === 'ALREADY_PROCESSED'
    && JSON.stringify(serverOps.map((row) => row.operationType)) === JSON.stringify([
      'CASH_SESSION_OPEN',
      'SALE_VALIDATE',
      'SALE_VALIDATE',
      'SALE_VALIDATE',
      'CASH_EXPENSE',
      'CASH_SESSION_CLOSE',
    ])
    && saleCount === 3
    && paymentCount === 3
    && expenseCount === 1
    && saleCashMovements === 3
    && sessionRow.status === 'CLOSED';

  const reconciliationPassed =
    mismatchResult.status === 'CONFLICT'
    && mismatchResult.errorCode === 'CASH_EXPECTED_BALANCE_MISMATCH'
    && Boolean(mismatchConflict)
    && resolvedConflict?.status === 'RESOLVED'
    && propagatedConflict?.status === 'RESOLVED';

  const adminPassed =
    Array.isArray(cashSessionsList)
    && Array.isArray(adminWorkstations)
    && Array.isArray(adminLogs)
    && typeof adminDashboard?.workstations?.total === 'number';

  return {
    happyPath: {
      passed: happyPassed,
      openResult,
      retryOpenResult,
      saleResults,
      expenseResult,
      retryExpenseResult,
      closeResult,
      retryCloseResult,
      serverOps,
      saleCount,
      paymentCount,
      expenseCount,
      saleCashMovements,
      sessionRow,
    },
    reconciliation: {
      passed: reconciliationPassed,
      mismatchResult,
      mismatchConflict,
      resolvedConflict,
      propagatedConflict,
    },
    admin: {
      passed: adminPassed,
      cashSessions: cashSessionsList.length,
      workstations: adminWorkstations.length,
      logs: adminLogs.length,
      dashboard: adminDashboard,
    },
    runtimeFindings: {
      revokedOpenResult,
      mismatchExpenseResult,
    },
  };
}

async function main() {
  await client.connect();
  await assertOfflineStagingRemoteGuard();
  await runCleanup();
  await ensureGlobalSettings();

  const setup = await setupOfflineTenant();
  await loginOfflineAdmin();
  const refs = await ensureReferences(setup.tenantId);
  const ws1 = await createWorkstation(setup.tenantId, setup.mainSiteId, WS1_CODE);
  const ws2 = await createWorkstation(setup.tenantId, setup.mainSiteId, WS2_CODE);
  await ensureOnlineCashSession(setup.mainSiteId, ws1.workstation_id, ws1.device_uuid);

  summary.local = await runLocalScenarios();
  summary.autosync = await runCashAutosyncScenario();
  summary.integration = await runIntegrationScenarios(setup, refs, { ws1, ws2 });
  summary.admin = summary.integration?.admin ?? {};

  const openPass = Boolean(summary.local?.passed) && Boolean(summary.integration?.happyPath?.passed);
  const movementsPass = Boolean(summary.local?.passed) && Boolean(summary.integration?.happyPath?.passed);
  const closePass = Boolean(summary.local?.passed) && Boolean(summary.integration?.happyPath?.passed);
  const reconciliationPass = Boolean(summary.integration?.reconciliation?.passed);
  const autosyncPass = Boolean(summary.autosync?.passed);

  summary.conclusion = {
    OFFLINE_5_CASH_OPEN: openPass ? 'PASS' : 'FAIL',
    OFFLINE_5_CASH_MOVEMENTS: movementsPass ? 'PASS' : 'FAIL',
    OFFLINE_5_CASH_CLOSE: closePass ? 'PASS' : 'FAIL',
    OFFLINE_5_CASH_RECONCILIATION: reconciliationPass ? 'PASS' : 'FAIL',
    OFFLINE_5_CASH_AUTOSYNC: autosyncPass ? 'PASS' : 'FAIL',
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!openPass || !movementsPass || !closePass || !reconciliationPass || !autosyncPass) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          message: error?.message || String(error),
          status: error?.status || null,
          endpoint: error?.endpoint || null,
          body: error?.body || null,
          stack: error?.stack || null,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await client.end();
    } catch {}
  });
