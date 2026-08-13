const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const baseUrl = process.env.MVP_API_URL || 'http://127.0.0.1:3000/api/v1';
const connectionString = String(process.env.DATABASE_URL || '').replace(/^[ '"]+|[ '"]+$/g, '');
const client = new Client({
  connectionString,
  ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
});

const PASSWORD = 'admin123';
const TENANT_CODE = 'OFFLINE_STAGING';
const MAIN_SITE_CODE = 'OFF-STG-SITE';
const SECOND_SITE_CODE = 'OFF-STG-SITE-2';
const WS1_CODE = 'POS-STG-01';
const WS2_CODE = 'POS-STG-02';
const ADMIN_EMAIL = 'admin@offline-staging.local';
const ADMIN_USERNAME = 'admin.offline.staging';
const CLEANUP_SQL = path.join(__dirname, '..', '..', 'database', 'cleanup_offline_32_demo.sql');
const ONLY_SCENARIOS = new Set(
  String(process.env.OFFLINE32_ONLY_SCENARIOS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

let token = '';
let currentUser = null;
const workstationDeviceMap = new Map();
let summary = {
  dataCreated: {},
  scenarios: {},
  defects: [],
};

function currentUserId() {
  return currentUser?.userId ?? currentUser?.id ?? null;
}

function unwrap(body) {
  return body && Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function shouldRunScenario(name) {
  return ONLY_SCENARIOS.size === 0 || ONLY_SCENARIOS.has(name);
}

function toJsonError(error) {
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error),
    status: error?.status || null,
    endpoint: error?.endpoint || null,
    body: error?.body || null,
    stack: error?.stack || null,
  };
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

async function runCleanup() {
  const cleanupSql = fs.readFileSync(CLEANUP_SQL, 'utf8');
  await client.query(cleanupSql);
}

async function ensureGlobalSettings() {
  await q(
    `
    INSERT INTO currencies (currency_code, currency_name, is_default)
    VALUES
      ('USD', 'Dollar americain', TRUE),
      ('CDF', 'Franc congolais', FALSE)
    ON CONFLICT (currency_code) DO UPDATE
    SET currency_name = EXCLUDED.currency_name,
        is_default = CASE WHEN currencies.currency_code = 'USD' THEN TRUE ELSE currencies.is_default END
    `,
  );

  await q(
    `
    INSERT INTO payment_methods (method_code, method_name, is_active)
    VALUES ('CASH', 'Cash', TRUE)
    ON CONFLICT (method_code) DO UPDATE
    SET method_name = EXCLUDED.method_name,
        is_active = TRUE
    `,
  );
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
      'contact@offline-staging.local', 'Kinshasa - Validation Offline 3.2',
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

  const tenantRow = await q(`SELECT tenant_id FROM tenants WHERE tenant_code = $1 LIMIT 1`, [TENANT_CODE]);
  const tenantId = tenantRow.rows[0].tenant_id;

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

  const roleRow = await q(`SELECT role_id FROM roles WHERE tenant_id = $1 AND role_name = 'ADMIN' LIMIT 1`, [tenantId]);
  const roleId = roleRow.rows[0].role_id;

  await q(
    `
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT $1, permission_id
    FROM permissions
    ON CONFLICT (role_id, permission_id) DO NOTHING
    `,
    [roleId],
  );

  const siteRows = await q(`SELECT site_id, site_code FROM sites WHERE tenant_id = $1`, [tenantId]);
  const mainSiteId = siteRows.rows.find((row) => row.site_code === MAIN_SITE_CODE).site_id;
  const secondSiteId = siteRows.rows.find((row) => row.site_code === SECOND_SITE_CODE).site_id;

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
    VALUES (
      $1, $2, $3, 'Admin Offline Staging', $4, $5, '+243810320010', $6, TRUE
    )
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

  summary.dataCreated.tenant = TENANT_CODE;
  summary.dataCreated.sites = [MAIN_SITE_CODE, SECOND_SITE_CODE];
  summary.dataCreated.user = ADMIN_EMAIL;

  return { tenantId, mainSiteId, secondSiteId, roleId };
}

async function loginOfflineAdmin() {
  const auth = await api('/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: PASSWORD },
  });
  token = auth.accessToken;
  currentUser = await api('/auth/me');
  summary.dataCreated.loggedUser = {
    email: currentUser.email,
    tenantId: currentUser.tenantId,
    siteId: currentUser.siteId,
    role: currentUser.role,
  };
}

async function ensureReferences() {
  const category = (
    await q(
      `
      INSERT INTO categories (tenant_id, category_code, category_name, description, is_active)
      VALUES ($1, 'OFF-STG-CAT', 'OFF-STG Categorie', 'Validation Offline 3.2', TRUE)
      ON CONFLICT (category_code) DO UPDATE
      SET tenant_id = EXCLUDED.tenant_id,
          category_name = EXCLUDED.category_name,
          description = EXCLUDED.description,
          is_active = TRUE
      RETURNING category_id, tenant_id, category_code, category_name
      `,
      [currentUser.tenantId],
    )
  ).rows[0];

  const subCategory = (
    await q(
      `
      INSERT INTO sub_categories (
        tenant_id, category_id, sub_category_code, sub_category_name, description, is_active
      )
      VALUES ($1, $2, 'OFF-STG-SUB', 'OFF-STG Sous-categorie', 'Validation Offline 3.2', TRUE)
      ON CONFLICT (category_id, sub_category_code) DO UPDATE
      SET sub_category_name = EXCLUDED.sub_category_name,
          description = EXCLUDED.description,
          is_active = TRUE
      RETURNING sub_category_id, tenant_id, category_id, sub_category_code, sub_category_name
      `,
      [currentUser.tenantId, category.category_id],
    )
  ).rows[0];

  const form = (
    await q(
      `
      INSERT INTO galenic_forms (tenant_id, form_code, form_name)
      VALUES ($1, 'OFF-STG-FORM', 'OFF-STG Forme')
      ON CONFLICT (form_code) DO UPDATE
      SET tenant_id = EXCLUDED.tenant_id,
          form_name = EXCLUDED.form_name
      RETURNING form_id, tenant_id, form_code, form_name
      `,
      [currentUser.tenantId],
    )
  ).rows[0];

  const route = (
    await q(
      `
      INSERT INTO administration_routes (tenant_id, route_code, route_name)
      VALUES ($1, 'OFF-STG-ROUTE', 'OFF-STG Voie')
      ON CONFLICT (route_code) DO UPDATE
      SET tenant_id = EXCLUDED.tenant_id,
          route_name = EXCLUDED.route_name
      RETURNING route_id, tenant_id, route_code, route_name
      `,
      [currentUser.tenantId],
    )
  ).rows[0];

  const productType = (
    await q(
      `
      INSERT INTO product_types (tenant_id, type_code, type_name)
      VALUES ($1, 'OFF-STG-TYPE', 'OFF-STG Type')
      ON CONFLICT (type_code) DO UPDATE
      SET tenant_id = EXCLUDED.tenant_id,
          type_name = EXCLUDED.type_name
      RETURNING product_type_id, tenant_id, type_code, type_name
      `,
      [currentUser.tenantId],
    )
  ).rows[0];

  const supplier = (
    await q(
      `
      INSERT INTO suppliers (
        tenant_id, supplier_code, supplier_name, phone, email, address, is_active
      )
      VALUES (
        $1, 'OFF-STG-SUP', 'OFF-STG Fournisseur', '+243810320011',
        'supplier@offline-staging.local', 'Kinshasa', TRUE
      )
      ON CONFLICT (tenant_id, supplier_code) DO UPDATE
      SET supplier_name = EXCLUDED.supplier_name,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          address = EXCLUDED.address,
          is_active = TRUE
      RETURNING supplier_id, tenant_id, supplier_code, supplier_name
      `,
      [currentUser.tenantId],
    )
  ).rows[0];

  return {
    category: {
      categoryId: category.category_id,
      tenantId: category.tenant_id,
      categoryCode: category.category_code,
      categoryName: category.category_name,
    },
    subCategory: {
      subCategoryId: subCategory.sub_category_id,
      tenantId: subCategory.tenant_id,
      categoryId: subCategory.category_id,
      subCategoryCode: subCategory.sub_category_code,
      subCategoryName: subCategory.sub_category_name,
    },
    form: {
      formId: form.form_id,
      tenantId: form.tenant_id,
      formCode: form.form_code,
      formName: form.form_name,
    },
    route: {
      routeId: route.route_id,
      tenantId: route.tenant_id,
      routeCode: route.route_code,
      routeName: route.route_name,
    },
    productType: {
      productTypeId: productType.product_type_id,
      tenantId: productType.tenant_id,
      typeCode: productType.type_code,
      typeName: productType.type_name,
    },
    supplier: {
      supplierId: supplier.supplier_id,
      tenantId: supplier.tenant_id,
      supplierCode: supplier.supplier_code,
      supplierName: supplier.supplier_name,
    },
  };
}

async function createWorkstations(mainSiteId) {
  async function upsertWorkstation(code) {
    const existing = await q(
      `
      SELECT workstation_id, tenant_id, site_id, workstation_code, workstation_name, workstation_type, device_uuid
      FROM pos_workstations
      WHERE tenant_id = $1
        AND (workstation_code = $2 OR device_uuid = $2)
      LIMIT 1
      `,
      [currentUser.tenantId, code],
    );
    if (existing.rows[0]) {
      await q(
        `
        UPDATE pos_workstations
        SET site_id = $3,
            workstation_name = $2,
            workstation_type = 'POS',
            device_uuid = $2,
            offline_status = 'OFFLINE_READY',
            sync_state = 'SYNCED',
            is_active = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE workstation_id = $1
        `,
        [existing.rows[0].workstation_id, code, mainSiteId],
      );
    } else {
      await q(
        `
        INSERT INTO pos_workstations (
          tenant_id, site_id, workstation_code, workstation_name, workstation_type, device_uuid,
          offline_status, sync_state, is_active
        )
        VALUES ($1, $2, $3, $3, 'POS', $3, 'OFFLINE_READY', 'SYNCED', TRUE)
        `,
        [currentUser.tenantId, mainSiteId, code],
      );
    }

    const refreshed = await q(
      `
      SELECT workstation_id, tenant_id, site_id, workstation_code, workstation_name, workstation_type, device_uuid
      FROM pos_workstations
      WHERE tenant_id = $1
        AND workstation_code = $2
      LIMIT 1
      `,
      [currentUser.tenantId, code],
    );
    const row = refreshed.rows[0];
    return {
      workstationId: row.workstation_id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      workstationCode: row.workstation_code,
      workstationName: row.workstation_name,
      workstationType: row.workstation_type,
      deviceUuid: row.device_uuid,
    };
  }

  const ws1 = await upsertWorkstation(WS1_CODE);
  const ws2 = await upsertWorkstation(WS2_CODE);
  workstationDeviceMap.set(ws1.workstationId, ws1.deviceUuid);
  workstationDeviceMap.set(ws2.workstationId, ws2.deviceUuid);
  summary.dataCreated.workstations = [ws1.workstationCode, ws2.workstationCode];
  return { ws1, ws2 };
}

async function ensureOpenCashSession(mainSiteId, workstationId, deviceUuid) {
  const sessions = await q(
    `SELECT cash_session_id FROM cash_sessions WHERE tenant_id = $1 AND user_id = $2 AND status = 'OPEN'`,
    [currentUser.tenantId, currentUserId()],
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
    const totalsRow = totals.rows[0];
    const countedClosingBalance =
      Number(totalsRow?.opening_balance ?? 0)
      + Number(totalsRow?.total_in ?? 0)
      - Number(totalsRow?.total_out ?? 0);
    try {
      await api(`/cash/sessions/${row.cash_session_id}/close`, {
        method: 'POST',
        body: { countedClosingBalance, notes: 'validate-offline-32 cleanup' },
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'CASH_SESSION_NOT_OPEN') {
        continue;
      }
      throw error;
    }
  }
  return api('/cash/sessions/open', {
    method: 'POST',
    body: {
      siteId: mainSiteId,
      openingBalance: 100,
      workstationId,
      deviceUuid,
      notes: 'Session offline validation',
    },
  });
}

async function createArticle(refs, suffix) {
  return api('/articles', {
    method: 'POST',
    body: {
      articleCode: `OFF-STG-ARTICLE-${suffix}`,
      commercialName: `OFF-STG-${suffix}`,
      categoryId: refs.category.categoryId,
      subCategoryId: refs.subCategory.subCategoryId,
      formId: refs.form.formId,
      routeId: refs.route.routeId,
      productTypeId: refs.productType.typeId,
      dci: `OFF-STG DCI ${suffix}`,
      dosage: '1 u',
      prescriptionRequired: false,
      defaultStockMin: 1,
      defaultStockMax: 50,
    },
  });
}

async function createPurchase(mainSiteId, currencyId, supplierId, articleId, lots) {
  const purchaseResponse = await api('/purchases', {
    method: 'POST',
    body: {
      supplierId,
      siteId: mainSiteId,
      currencyId,
      exchangeRate: 1,
    },
  });
  const purchaseId =
    purchaseResponse?.purchaseId
    ?? purchaseResponse?.id
    ?? purchaseResponse?.data?.purchaseId
    ?? purchaseResponse?.data?.id
    ?? null;
  if (!purchaseId) {
    throw new Error('PURCHASE_ID_MISSING_IN_CREATE_RESPONSE');
  }
  const createdPurchase = await api(`/purchases/${purchaseId}`, { method: 'GET' });
  for (const lot of lots) {
    await api(`/purchases/${purchaseId}/items`, {
      method: 'POST',
      body: {
        articleId,
        lotNumber: lot.lotNumber,
        expiryDate: lot.expiryDate,
        quantity: lot.quantity,
        purchaseUnitPrice: lot.purchaseUnitPrice ?? 1,
        sellingUnitPrice: lot.sellingUnitPrice ?? 2,
      },
    });
  }
  await api(`/purchases/${purchaseId}/validate`, { method: 'POST' });
  const lotRows = await q(
    `SELECT lot_id, lot_number, expiry_date FROM lots WHERE tenant_id = $1 AND article_id = $2 ORDER BY lot_number ASC`,
    [currentUser.tenantId, articleId],
  );
  return { purchase: createdPurchase, lots: lotRows.rows };
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

async function createOnlineSale(siteId, currencyId, articleId, quantity, amountPaid) {
  const sale = await api('/sales', {
    method: 'POST',
    body: { siteId, currencyId, saleType: 'CASH' },
  });
  await api(`/sales/${sale.saleId}/items/fefo`, {
    method: 'POST',
    body: { articleId, quantity },
  });
  const saleDetail = await api(`/sales/${sale.saleId}`);
  const totalAmount = Number(saleDetail.totalAmount ?? 0);
  return api(`/sales/${sale.saleId}/validate`, {
    method: 'POST',
    body: {
      amountPaid,
      settlementDifferenceReason:
        Number(amountPaid) > totalAmount ? 'OFFLINE_STAGING_RECIPE_OVERPAYMENT' : undefined,
    },
  });
}

async function tryAddFefo(siteId, currencyId, articleId, quantity) {
  const sale = await api('/sales', {
    method: 'POST',
    body: { siteId, currencyId, saleType: 'CASH' },
  });
  try {
    await api(`/sales/${sale.saleId}/items/fefo`, {
      method: 'POST',
      body: { articleId, quantity },
    });
    return { ok: true, saleId: sale.saleId };
  } catch (error) {
    return { ok: false, saleId: sale.saleId, error: error.message, status: error.status };
  }
}

function isoDateTime(value) {
  return `${value}T09:00:00.000Z`;
}

async function replayOfflineSale({
  tenantId,
  siteId,
  workstationId,
  cashSessionId,
  article,
  unitPrice,
  validatedAt,
  allocations,
  operationId,
  localSaleId,
  note,
}) {
  const totalQuantity = allocations.reduce((sum, item) => sum + item.quantity, 0);
  const total = roundMoney(totalQuantity * unitPrice);
  return api('/pos-sync/operations', {
    method: 'POST',
    body: {
      operations: [
        {
          operationType: 'SALE_VALIDATE',
          operationId: operationId ?? crypto.randomUUID(),
          localSaleId: localSaleId ?? crypto.randomUUID(),
          localCashSessionId: crypto.randomUUID(),
          offlineReference: `OFF32-${Date.now()}`,
          tenantId,
          siteId,
          workstationId,
          deviceId: workstationDeviceMap.get(workstationId) ?? workstationId,
          userId: currentUserId(),
          cashSessionId,
          customerId: null,
          currency: 'USD',
          exchangeRateSnapshot: 1,
          createdAt: validatedAt,
          validatedAt,
          saleMode: 'IMMEDIATE',
          saleType: 'CASH',
          note: note ?? '',
          subtotal: total,
          total,
          payment: {
            amountPaidUsd: total,
            amountPaidCdf: 0,
            amountReturnedUsd: 0,
            amountReturnedCdf: 0,
            netReceivedUsd: total,
            netReceivedCdf: 0,
          },
          items: [
            {
              articleId: article.articleId,
              articleCode: article.articleCode,
              articleName: article.commercialName,
              quantity: totalQuantity,
              unitPriceSnapshot: unitPrice,
              lotAllocations: allocations,
            },
          ],
        },
      ],
    },
  });
}

async function countBy(query, params = []) {
  const result = await q(query, params);
  return Number(result.rows[0]?.total ?? 0);
}

async function runRecipe(setup) {
  const { mainSiteId, secondSiteId, currencyId, refs, ws1, ws2, cashSession } = setup;

  // Reserved stock vs online sellable
  if (shouldRunScenario('reservedStockOnline')) {
    const article = await createArticle(refs, 'RESERVED');
    const purchase = await createPurchase(mainSiteId, currencyId, refs.supplier.supplierId, article.articleId, [
      { lotNumber: 'OFF-STG-LOT-RESERVED', expiryDate: '2028-12-31', quantity: 10 },
    ]);
    const lotId = purchase.lots[0].lot_id;
    await createAllocation({ tenantId: currentUser.tenantId, siteId: mainSiteId, workstationId: ws1.workstationId, articleId: article.articleId, lotId, allocatedQuantity: 4 });
    await createAllocation({ tenantId: currentUser.tenantId, siteId: mainSiteId, workstationId: ws2.workstationId, articleId: article.articleId, lotId, allocatedQuantity: 3 });
    const qty3 = await tryAddFefo(mainSiteId, currencyId, article.articleId, 3);
    const qty4 = await tryAddFefo(mainSiteId, currencyId, article.articleId, 4);
    summary.scenarios.reservedStockOnline = {
      expected: { onlineSellable: 3, sale3: 'OK', sale4: 'REFUS' },
      actual: { sale3: qty3.ok ? 'OK' : qty3.error, sale4: qty4.ok ? 'OK' : qty4.error },
      passed: qty3.ok && !qty4.ok,
    };
  }

  // Online + offline
  if (shouldRunScenario('onlineAndOffline')) {
    const article = await createArticle(refs, 'ONLINE-OFFLINE');
    const purchase = await createPurchase(mainSiteId, currencyId, refs.supplier.supplierId, article.articleId, [
      { lotNumber: 'OFF-STG-LOT-ONLINE-OFFLINE', expiryDate: '2028-12-31', quantity: 10 },
    ]);
    const lotId = purchase.lots[0].lot_id;
    const allocationId = await createAllocation({ tenantId: currentUser.tenantId, siteId: mainSiteId, workstationId: ws1.workstationId, articleId: article.articleId, lotId, allocatedQuantity: 5 });
    await createOnlineSale(mainSiteId, currencyId, article.articleId, 5, 10);
    const replay = await replayOfflineSale({
      tenantId: currentUser.tenantId,
      siteId: mainSiteId,
      workstationId: ws1.workstationId,
      cashSessionId: cashSession.cashSessionId,
      article,
      unitPrice: 2,
      validatedAt: new Date().toISOString(),
      allocations: [{ allocationId, lotId, lotNumber: 'OFF-STG-LOT-ONLINE-OFFLINE', expiryDate: '2028-12-31', quantity: 5, allocationServerVersion: 1 }],
    });
    const stockQty = await q(`SELECT quantity_available::numeric AS qty FROM stocks WHERE tenant_id = $1 AND site_id = $2 AND lot_id = $3`, [currentUser.tenantId, mainSiteId, lotId]);
    const alloc = await q(`SELECT consumed_quantity::numeric AS consumed, status FROM offline_stock_allocations WHERE allocation_id = $1`, [allocationId]);
    summary.scenarios.onlineAndOffline = {
      expected: { stockFinal: 0, allocationConsumed: 5, status: 'SYNCED' },
      actual: {
        status: replay.results[0].status,
        errorCode: replay.results[0].errorCode ?? null,
        stockFinal: Number(stockQty.rows[0]?.qty ?? 0),
        allocationConsumed: Number(alloc.rows[0]?.consumed ?? 0),
        allocationStatus: alloc.rows[0]?.status ?? null,
      },
      passed:
        replay.results[0].status === 'SYNCED'
        && Number(stockQty.rows[0]?.qty ?? 0) === 0
        && Number(alloc.rows[0]?.consumed ?? 0) === 5,
    };
  }

  // 2 POS offline
  if (shouldRunScenario('twoOfflinePos')) {
    const article = await createArticle(refs, 'TWO-POS');
    const purchase = await createPurchase(mainSiteId, currencyId, refs.supplier.supplierId, article.articleId, [
      { lotNumber: 'OFF-STG-LOT-TWO-POS', expiryDate: '2028-12-31', quantity: 10 },
    ]);
    const lotId = purchase.lots[0].lot_id;
    const alloc1 = await createAllocation({ tenantId: currentUser.tenantId, siteId: mainSiteId, workstationId: ws1.workstationId, articleId: article.articleId, lotId, allocatedQuantity: 5 });
    const alloc2 = await createAllocation({ tenantId: currentUser.tenantId, siteId: mainSiteId, workstationId: ws2.workstationId, articleId: article.articleId, lotId, allocatedQuantity: 5 });
    const replay1 = await replayOfflineSale({
      tenantId: currentUser.tenantId,
      siteId: mainSiteId,
      workstationId: ws1.workstationId,
      cashSessionId: cashSession.cashSessionId,
      article,
      unitPrice: 2,
      validatedAt: new Date().toISOString(),
      allocations: [{ allocationId: alloc1, lotId, lotNumber: 'OFF-STG-LOT-TWO-POS', expiryDate: '2028-12-31', quantity: 5, allocationServerVersion: 1 }],
    });
    const replay2 = await replayOfflineSale({
      tenantId: currentUser.tenantId,
      siteId: mainSiteId,
      workstationId: ws2.workstationId,
      cashSessionId: cashSession.cashSessionId,
      article,
      unitPrice: 2,
      validatedAt: new Date().toISOString(),
      allocations: [{ allocationId: alloc2, lotId, lotNumber: 'OFF-STG-LOT-TWO-POS', expiryDate: '2028-12-31', quantity: 5, allocationServerVersion: 1 }],
    });
    const stockQty = await q(`SELECT quantity_available::numeric AS qty FROM stocks WHERE tenant_id = $1 AND site_id = $2 AND lot_id = $3`, [currentUser.tenantId, mainSiteId, lotId]);
    summary.scenarios.twoOfflinePos = {
      expected: { replay1: 'SYNCED', replay2: 'SYNCED', stockFinal: 0 },
      actual: {
        replay1: replay1.results[0].status,
        replay1Error: replay1.results[0].errorCode ?? null,
        replay2: replay2.results[0].status,
        replay2Error: replay2.results[0].errorCode ?? null,
        stockFinal: Number(stockQty.rows[0]?.qty ?? 0),
      },
      passed:
        replay1.results[0].status === 'SYNCED'
        && replay2.results[0].status === 'SYNCED'
        && Number(stockQty.rows[0]?.qty ?? 0) === 0,
    };
  }

  // Multi-lots + idempotence + lost ACK retry
  if (shouldRunScenario('multiLotAndIdempotence')) {
    const article = await createArticle(refs, 'MULTILOT');
    const purchase = await createPurchase(mainSiteId, currencyId, refs.supplier.supplierId, article.articleId, [
      { lotNumber: 'OFF-STG-LOT-MULTI-A', expiryDate: '2028-12-31', quantity: 2 },
      { lotNumber: 'OFF-STG-LOT-MULTI-B', expiryDate: '2028-12-31', quantity: 2 },
    ]);
    const lotA = purchase.lots.find((row) => row.lot_number === 'OFF-STG-LOT-MULTI-A');
    const lotB = purchase.lots.find((row) => row.lot_number === 'OFF-STG-LOT-MULTI-B');
    const allocA = await createAllocation({ tenantId: currentUser.tenantId, siteId: mainSiteId, workstationId: ws1.workstationId, articleId: article.articleId, lotId: lotA.lot_id, allocatedQuantity: 2 });
    const allocB = await createAllocation({ tenantId: currentUser.tenantId, siteId: mainSiteId, workstationId: ws1.workstationId, articleId: article.articleId, lotId: lotB.lot_id, allocatedQuantity: 2 });
    const operationId = crypto.randomUUID();
    const localSaleId = crypto.randomUUID();
    const validatedAt = new Date().toISOString();
    const first = await replayOfflineSale({
      tenantId: currentUser.tenantId,
      siteId: mainSiteId,
      workstationId: ws1.workstationId,
      cashSessionId: cashSession.cashSessionId,
      article,
      unitPrice: 2,
      validatedAt,
      operationId,
      localSaleId,
      allocations: [
        { allocationId: allocA, lotId: lotA.lot_id, lotNumber: 'OFF-STG-LOT-MULTI-A', expiryDate: '2028-12-31', quantity: 2, allocationServerVersion: 1 },
        { allocationId: allocB, lotId: lotB.lot_id, lotNumber: 'OFF-STG-LOT-MULTI-B', expiryDate: '2028-12-31', quantity: 2, allocationServerVersion: 1 },
      ],
    });
    const retry = await replayOfflineSale({
      tenantId: currentUser.tenantId,
      siteId: mainSiteId,
      workstationId: ws1.workstationId,
      cashSessionId: cashSession.cashSessionId,
      article,
      unitPrice: 2,
      validatedAt,
      operationId,
      localSaleId,
      allocations: [
        { allocationId: allocA, lotId: lotA.lot_id, lotNumber: 'OFF-STG-LOT-MULTI-A', expiryDate: '2028-12-31', quantity: 2, allocationServerVersion: 1 },
        { allocationId: allocB, lotId: lotB.lot_id, lotNumber: 'OFF-STG-LOT-MULTI-B', expiryDate: '2028-12-31', quantity: 2, allocationServerVersion: 1 },
      ],
    });
    const saleId = first.results[0].serverSaleId;
    const saleOuts = await q(
      `SELECT l.lot_number, sm.quantity::numeric AS quantity
       FROM stock_movements sm
       JOIN lots l ON l.lot_id = sm.lot_id
       WHERE sm.tenant_id = $1
         AND sm.reference_type = 'SALE'
         AND sm.reference_id = $2
       ORDER BY l.lot_number`,
      [currentUser.tenantId, saleId],
    );
    const saleCount = await countBy(`SELECT COUNT(*)::int AS total FROM sales WHERE tenant_id = $1 AND sale_id = $2`, [currentUser.tenantId, saleId]);
    const paymentCount = await countBy(`SELECT COUNT(*)::int AS total FROM payments WHERE tenant_id = $1 AND sale_id = $2`, [currentUser.tenantId, saleId]);
    const cashMovementCount = await countBy(`SELECT COUNT(*)::int AS total FROM cash_movements WHERE tenant_id = $1 AND reference_type = 'SALE' AND reference_id = $2`, [currentUser.tenantId, saleId]);
    summary.scenarios.multiLotAndIdempotence = {
      expected: {
        first: 'SYNCED',
        retry: 'ALREADY_PROCESSED',
        saleOuts: [
          { lotNumber: 'OFF-STG-LOT-MULTI-A', quantity: 2 },
          { lotNumber: 'OFF-STG-LOT-MULTI-B', quantity: 2 },
        ],
        saleCount: 1,
        paymentCount: 1,
      },
      actual: {
        first: first.results[0].status,
        firstError: first.results[0].errorCode ?? null,
        retry: retry.results[0].status,
        retryError: retry.results[0].errorCode ?? null,
        saleOuts: saleOuts.rows.map((row) => ({ lotNumber: row.lot_number, quantity: Number(row.quantity) })),
        saleCount,
        paymentCount,
        cashMovementCount,
        allocationsAck: first.results[0].allocations,
      },
      passed:
        first.results[0].status === 'SYNCED'
        && retry.results[0].status === 'ALREADY_PROCESSED'
        && saleCount === 1
        && paymentCount === 1,
    };
  }

  // Stale version
  if (shouldRunScenario('staleVersion')) {
    const article = await createArticle(refs, 'STALE-OK');
    const purchase = await createPurchase(mainSiteId, currencyId, refs.supplier.supplierId, article.articleId, [
      { lotNumber: 'OFF-STG-LOT-STALE-OK', expiryDate: '2028-12-31', quantity: 2 },
    ]);
    const lotId = purchase.lots[0].lot_id;
    const allocOk = await createAllocation({
      tenantId: currentUser.tenantId,
      siteId: mainSiteId,
      workstationId: ws1.workstationId,
      articleId: article.articleId,
      lotId,
      allocatedQuantity: 2,
      consumedQuantity: 0,
      serverVersion: 5,
    });
    const okResult = await replayOfflineSale({
      tenantId: currentUser.tenantId,
      siteId: mainSiteId,
      workstationId: ws1.workstationId,
      cashSessionId: cashSession.cashSessionId,
      article,
      unitPrice: 2,
      validatedAt: new Date().toISOString(),
      allocations: [{ allocationId: allocOk, lotId, lotNumber: 'OFF-STG-LOT-STALE-OK', expiryDate: '2028-12-31', quantity: 2, allocationServerVersion: 4 }],
    });

    const article2 = await createArticle(refs, 'STALE-KO');
    const purchase2 = await createPurchase(mainSiteId, currencyId, refs.supplier.supplierId, article2.articleId, [
      { lotNumber: 'OFF-STG-LOT-STALE-KO', expiryDate: '2028-12-31', quantity: 2 },
    ]);
    const lotId2 = purchase2.lots[0].lot_id;
    const allocKo = await createAllocation({
      tenantId: currentUser.tenantId,
      siteId: mainSiteId,
      workstationId: ws1.workstationId,
      articleId: article2.articleId,
      lotId: lotId2,
      allocatedQuantity: 2,
      consumedQuantity: 1,
      serverVersion: 5,
    });
    const koResult = await replayOfflineSale({
      tenantId: currentUser.tenantId,
      siteId: mainSiteId,
      workstationId: ws1.workstationId,
      cashSessionId: cashSession.cashSessionId,
      article: article2,
      unitPrice: 2,
      validatedAt: new Date().toISOString(),
      allocations: [{ allocationId: allocKo, lotId: lotId2, lotNumber: 'OFF-STG-LOT-STALE-KO', expiryDate: '2028-12-31', quantity: 2, allocationServerVersion: 4 }],
    });
    summary.scenarios.staleVersion = {
      expected: { staleWithRemaining: 'SYNCED', staleWithoutRemaining: 'CONFLICT:ALLOCATION_EXHAUSTED' },
      actual: {
        staleWithRemaining: `${okResult.results[0].status}${okResult.results[0].errorCode ? `:${okResult.results[0].errorCode}` : ''}`,
        staleWithoutRemaining: `${koResult.results[0].status}:${koResult.results[0].errorCode}`,
      },
      passed:
        okResult.results[0].status === 'SYNCED'
        && koResult.results[0].status === 'CONFLICT'
        && koResult.results[0].errorCode === 'ALLOCATION_EXHAUSTED',
    };
  }

  // Lot mismatch
  if (shouldRunScenario('lotMismatch')) {
    const article = await createArticle(refs, 'MISMATCH');
    const purchase = await createPurchase(mainSiteId, currencyId, refs.supplier.supplierId, article.articleId, [
      { lotNumber: 'OFF-STG-LOT-MISMATCH-A', expiryDate: '2028-12-31', quantity: 2 },
      { lotNumber: 'OFF-STG-LOT-MISMATCH-B', expiryDate: '2028-12-31', quantity: 2 },
    ]);
    const lotA = purchase.lots.find((row) => row.lot_number === 'OFF-STG-LOT-MISMATCH-A');
    const lotB = purchase.lots.find((row) => row.lot_number === 'OFF-STG-LOT-MISMATCH-B');
    const allocationId = await createAllocation({ tenantId: currentUser.tenantId, siteId: mainSiteId, workstationId: ws1.workstationId, articleId: article.articleId, lotId: lotA.lot_id, allocatedQuantity: 2 });
    const result = await replayOfflineSale({
      tenantId: currentUser.tenantId,
      siteId: mainSiteId,
      workstationId: ws1.workstationId,
      cashSessionId: cashSession.cashSessionId,
      article,
      unitPrice: 2,
      validatedAt: new Date().toISOString(),
      allocations: [{ allocationId, lotId: lotB.lot_id, lotNumber: 'OFF-STG-LOT-MISMATCH-B', expiryDate: '2028-12-31', quantity: 1, allocationServerVersion: 1 }],
    });
    summary.scenarios.lotMismatch = {
      expected: 'CONFLICT:ALLOCATION_MISMATCH',
      actual: `${result.results[0].status}:${result.results[0].errorCode}`,
      passed: result.results[0].status === 'CONFLICT' && result.results[0].errorCode === 'ALLOCATION_MISMATCH',
    };
  }

  // Lot blocked
  if (shouldRunScenario('blockedLot')) {
    const article = await createArticle(refs, 'BLOCKED');
    const purchase = await createPurchase(mainSiteId, currencyId, refs.supplier.supplierId, article.articleId, [
      { lotNumber: 'OFF-STG-LOT-BLOCKED', expiryDate: '2028-12-31', quantity: 2 },
    ]);
    const lotId = purchase.lots[0].lot_id;
    const allocationId = await createAllocation({ tenantId: currentUser.tenantId, siteId: mainSiteId, workstationId: ws1.workstationId, articleId: article.articleId, lotId, allocatedQuantity: 1 });
    await q(`UPDATE lots SET is_blocked = true, block_reason = 'OFF-STG blocked after local sale' WHERE tenant_id = $1 AND lot_id = $2`, [currentUser.tenantId, lotId]);
    const result = await replayOfflineSale({
      tenantId: currentUser.tenantId,
      siteId: mainSiteId,
      workstationId: ws1.workstationId,
      cashSessionId: cashSession.cashSessionId,
      article,
      unitPrice: 2,
      validatedAt: new Date().toISOString(),
      allocations: [{ allocationId, lotId, lotNumber: 'OFF-STG-LOT-BLOCKED', expiryDate: '2028-12-31', quantity: 1, allocationServerVersion: 1 }],
    });
    summary.scenarios.blockedLot = {
      expected: 'CONFLICT:LOT_BLOCKED_AFTER_OFFLINE_SALE',
      actual: `${result.results[0].status}:${result.results[0].errorCode}`,
      passed: result.results[0].status === 'CONFLICT' && result.results[0].errorCode === 'LOT_BLOCKED_AFTER_OFFLINE_SALE',
    };
  }

  // Expiration
  if (shouldRunScenario('expiration')) {
    const article1 = await createArticle(refs, 'EXPIRE-LATE');
    const purchase1 = await createPurchase(mainSiteId, currencyId, refs.supplier.supplierId, article1.articleId, [
      { lotNumber: 'OFF-STG-LOT-EXPIRE-LATE', expiryDate: '2028-12-31', quantity: 2 },
    ]);
    const lotId1 = purchase1.lots[0].lot_id;
    await q(`UPDATE lots SET expiry_date = '2026-08-11' WHERE tenant_id = $1 AND lot_id = $2`, [currentUser.tenantId, lotId1]);
    const alloc1 = await createAllocation({ tenantId: currentUser.tenantId, siteId: mainSiteId, workstationId: ws1.workstationId, articleId: article1.articleId, lotId: lotId1, allocatedQuantity: 1 });
    const lateResult = await replayOfflineSale({
      tenantId: currentUser.tenantId,
      siteId: mainSiteId,
      workstationId: ws1.workstationId,
      cashSessionId: cashSession.cashSessionId,
      article: article1,
      unitPrice: 2,
      validatedAt: isoDateTime('2026-08-10'),
      allocations: [{ allocationId: alloc1, lotId: lotId1, lotNumber: 'OFF-STG-LOT-EXPIRE-LATE', expiryDate: '2026-08-11', quantity: 1, allocationServerVersion: 1 }],
    });

    const article2 = await createArticle(refs, 'EXPIRE-NOW');
    const purchase2 = await createPurchase(mainSiteId, currencyId, refs.supplier.supplierId, article2.articleId, [
      { lotNumber: 'OFF-STG-LOT-EXPIRE-NOW', expiryDate: '2028-12-31', quantity: 2 },
    ]);
    const lotId2 = purchase2.lots[0].lot_id;
    await q(`UPDATE lots SET expiry_date = '2026-08-11' WHERE tenant_id = $1 AND lot_id = $2`, [currentUser.tenantId, lotId2]);
    const alloc2 = await createAllocation({ tenantId: currentUser.tenantId, siteId: mainSiteId, workstationId: ws1.workstationId, articleId: article2.articleId, lotId: lotId2, allocatedQuantity: 1 });
    const nowResult = await replayOfflineSale({
      tenantId: currentUser.tenantId,
      siteId: mainSiteId,
      workstationId: ws1.workstationId,
      cashSessionId: cashSession.cashSessionId,
      article: article2,
      unitPrice: 2,
      validatedAt: isoDateTime('2026-08-11'),
      allocations: [{ allocationId: alloc2, lotId: lotId2, lotNumber: 'OFF-STG-LOT-EXPIRE-NOW', expiryDate: '2026-08-11', quantity: 1, allocationServerVersion: 1 }],
    });

    summary.scenarios.expiration = {
      expected: { validAtSaleThenExpiredAtSync: 'SYNCED', expiredAtLocalSale: 'CONFLICT:LOT_EXPIRED_AT_OFFLINE_SALE' },
      actual: {
        validAtSaleThenExpiredAtSync: `${lateResult.results[0].status}${lateResult.results[0].errorCode ? `:${lateResult.results[0].errorCode}` : ''}`,
        expiredAtLocalSale: `${nowResult.results[0].status}:${nowResult.results[0].errorCode}`,
      },
      passed:
        lateResult.results[0].status === 'SYNCED'
        && nowResult.results[0].status === 'CONFLICT'
        && nowResult.results[0].errorCode === 'LOT_EXPIRED_AT_OFFLINE_SALE',
    };
  }

  // Cash session closed after local sale
  if (shouldRunScenario('closedCashSession')) {
    const tempSession = await ensureOpenCashSession(mainSiteId, ws1.workstationId, ws1.deviceUuid);
    const article = await createArticle(refs, 'SESSION-CLOSED');
    const purchase = await createPurchase(mainSiteId, currencyId, refs.supplier.supplierId, article.articleId, [
      { lotNumber: 'OFF-STG-LOT-SESSION-CLOSED', expiryDate: '2028-12-31', quantity: 2 },
    ]);
    const lotId = purchase.lots[0].lot_id;
    const allocationId = await createAllocation({ tenantId: currentUser.tenantId, siteId: mainSiteId, workstationId: ws1.workstationId, articleId: article.articleId, lotId, allocatedQuantity: 1 });
    const totals = await q(
      `SELECT cs.opening_balance,
              COALESCE(SUM(CASE WHEN cm.movement_type IN ('SALE_PAYMENT','RECEIVABLE_PAYMENT','CASH_IN','ADVANCE','ADJUSTMENT') THEN cm.amount ELSE 0 END),0)::numeric AS total_in,
              COALESCE(SUM(CASE WHEN cm.movement_type IN ('SALE_CHANGE','EXPENSE','CASH_OUT','BANK_DEPOSIT') THEN cm.amount ELSE 0 END),0)::numeric AS total_out
       FROM cash_sessions cs
       LEFT JOIN cash_movements cm ON cm.cash_session_id = cs.cash_session_id AND cm.tenant_id = cs.tenant_id
       WHERE cs.cash_session_id = $1
       GROUP BY cs.opening_balance`,
      [tempSession.cashSessionId],
    );
    const countedClosingBalance =
      Number(totals.rows[0]?.opening_balance ?? 0)
      + Number(totals.rows[0]?.total_in ?? 0)
      - Number(totals.rows[0]?.total_out ?? 0);
    await api(`/cash/sessions/${tempSession.cashSessionId}/close`, {
      method: 'POST',
      body: { countedClosingBalance, notes: 'Close before replay' },
    });
    const result = await replayOfflineSale({
      tenantId: currentUser.tenantId,
      siteId: mainSiteId,
      workstationId: ws1.workstationId,
      cashSessionId: tempSession.cashSessionId,
      article,
      unitPrice: 2,
      validatedAt: new Date().toISOString(),
      allocations: [{ allocationId, lotId, lotNumber: 'OFF-STG-LOT-SESSION-CLOSED', expiryDate: '2028-12-31', quantity: 1, allocationServerVersion: 1 }],
    });
    const serverSaleId = result.results[0].serverSaleId;
    const saleCashSession = serverSaleId
      ? await q(`SELECT cash_session_id FROM sales WHERE tenant_id = $1 AND sale_id = $2`, [currentUser.tenantId, serverSaleId])
      : { rows: [] };
    const cashMovements = serverSaleId
      ? await countBy(`SELECT COUNT(*)::int AS total FROM cash_movements WHERE tenant_id = $1 AND reference_type = 'SALE' AND reference_id = $2`, [currentUser.tenantId, serverSaleId])
      : 0;
    summary.scenarios.closedCashSession = {
      expected: 'CONFLICT:CASH_SESSION_CLOSED_AFTER_OFFLINE_SALE',
      actual: {
        status: result.results[0].status,
        error: result.results[0].errorCode ?? null,
        saleCashSessionId: saleCashSession.rows[0]?.cash_session_id ?? null,
        cashMovementCount: cashMovements,
      },
      passed:
        result.results[0].status === 'CONFLICT'
        && result.results[0].errorCode === 'CASH_SESSION_CLOSED_AFTER_OFFLINE_SALE',
    };
    if (!summary.scenarios.closedCashSession.passed) {
      summary.defects.push({
        code: 'CASH_SESSION_CLOSED_AFTER_OFFLINE_SALE',
        message: 'Le replay offline valide encore la vente alors que la session caisse referencee est deja fermee.',
      });
    }
    await ensureOpenCashSession(mainSiteId, ws1.workstationId, ws1.deviceUuid);
  }

  // Transfer reserved stock
  if (shouldRunScenario('transferReservedStock')) {
    const article = await createArticle(refs, 'TRANSFER');
    const purchase = await createPurchase(mainSiteId, currencyId, refs.supplier.supplierId, article.articleId, [
      { lotNumber: 'OFF-STG-LOT-TRANSFER', expiryDate: '2028-12-31', quantity: 10 },
    ]);
    const lotId = purchase.lots[0].lot_id;
    await createAllocation({ tenantId: currentUser.tenantId, siteId: mainSiteId, workstationId: ws1.workstationId, articleId: article.articleId, lotId, allocatedQuantity: 7 });
    const transfer = await api('/transfers', {
      method: 'POST',
      body: {
        fromSiteId: mainSiteId,
        toSiteId: secondSiteId,
        transferDate: '2026-08-11',
        notes: 'OFF-STG transfer validation',
      },
    });
    await api(`/transfers/${transfer.transferId}/items`, {
      method: 'POST',
      body: { articleId: article.articleId, lotId, quantity: 4 },
    });
    let outcome;
    try {
      await api(`/transfers/${transfer.transferId}/validate`, { method: 'POST' });
      outcome = { status: 'VALIDATED', error: null };
    } catch (error) {
      outcome = { status: 'CONFLICT', error: error.message };
    }
    summary.scenarios.transferReservedStock = {
      expected: 'CONFLICT:OFFLINE_RESERVED_STOCK_IN_USE',
      actual: `${outcome.status}:${outcome.error}`,
      passed: outcome.status === 'CONFLICT' && outcome.error === 'OFFLINE_RESERVED_STOCK_IN_USE',
    };
  }

  // POS online still works
  if (shouldRunScenario('posOnline')) {
    const article = await createArticle(refs, 'POS-ONLINE');
    await createPurchase(mainSiteId, currencyId, refs.supplier.supplierId, article.articleId, [
      { lotNumber: 'OFF-STG-LOT-POS-ONLINE', expiryDate: '2028-12-31', quantity: 5 },
    ]);
    const validated = await createOnlineSale(mainSiteId, currencyId, article.articleId, 2, 10);
    summary.scenarios.posOnline = {
      expected: 'VALIDATED',
      actual: validated.status,
      passed: validated.status === 'VALIDATED',
    };
  }

  // Final counters
  summary.finalState = {
    stockRows: await countBy(`SELECT COUNT(*)::int AS total FROM stocks WHERE tenant_id = $1`, [currentUser.tenantId]),
    allocationRows: await countBy(`SELECT COUNT(*)::int AS total FROM offline_stock_allocations WHERE tenant_id = $1`, [currentUser.tenantId]),
    sales: await countBy(`SELECT COUNT(*)::int AS total FROM sales WHERE tenant_id = $1`, [currentUser.tenantId]),
    saleOutMovements: await countBy(`SELECT COUNT(*)::int AS total FROM stock_movements WHERE tenant_id = $1 AND movement_type = 'SALE_OUT'`, [currentUser.tenantId]),
    payments: await countBy(`SELECT COUNT(*)::int AS total FROM payments WHERE tenant_id = $1`, [currentUser.tenantId]),
    cashMovements: await countBy(`SELECT COUNT(*)::int AS total FROM cash_movements WHERE tenant_id = $1`, [currentUser.tenantId]),
  };
}

async function main() {
  await client.connect();
  await runCleanup();
  await ensureGlobalSettings();
  const setup = await setupOfflineTenant();
  await loginOfflineAdmin();
  const refs = await ensureReferences();
  const currencies = await q(`SELECT currency_id FROM currencies WHERE currency_code = 'USD' LIMIT 1`);
  const { ws1, ws2 } = await createWorkstations(setup.mainSiteId);
  const cashSession = await ensureOpenCashSession(setup.mainSiteId, ws1.workstationId, ws1.deviceUuid);
  summary.dataCreated.cashSession = cashSession.cashSessionId;
  await runRecipe({
    ...setup,
    refs,
    currencyId: currencies.rows[0].currency_id,
    ws1,
    ws2,
    cashSession,
  });

  const passed = Object.values(summary.scenarios).every((scenario) => scenario.passed !== false);
  summary.conclusion = passed ? 'RESOLVED' : 'NOT_RESOLVED';
  console.log(JSON.stringify(summary, null, 2));
  if (!passed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ fatal: toJsonError(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await client.end();
    } catch {}
  });
