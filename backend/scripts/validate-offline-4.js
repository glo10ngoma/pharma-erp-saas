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
const SITE_CODE = 'OFF-STG-SITE';
const WS1_CODE = 'POS-STG-01';
const WS2_CODE = 'POS-STG-02';
const ADMIN_EMAIL = 'admin@offline-staging.local';
const OFFLINE_PERMISSIONS = [
  ['pos_sync.read', 'Consulter synchronisation POS offline', 'Offline', 'Lire le bootstrap et les changements descendants POS offline'],
  ['pos_sync.execute', 'Executer synchronisation POS offline', 'Offline', 'Enregistrer un poste POS offline et executer le bootstrap'],
  ['offline_allocations.read', 'Consulter allocations offline', 'Offline', 'Lire les allocations offline affectees a un poste'],
  ['pos_offline.admin.read', 'Consulter supervision offline', 'Offline', 'Voir le dashboard de supervision des postes offline'],
  ['pos_offline.workstations.read', 'Consulter postes offline', 'Offline', 'Voir les postes POS offline et leur etat'],
  ['offline_allocations.manage', 'Gerer allocations offline', 'Offline', 'Creer, modifier, suspendre et liberer les allocations offline'],
  ['offline_allocations.transfer', 'Transferer allocations offline', 'Offline', 'Transferer un quota offline entre postes d un meme site'],
  ['offline_allocations.rebalance', 'Reequilibrer allocations offline', 'Offline', 'Repartir automatiquement les quotas offline entre postes'],
  ['pos_sync.conflicts.read', 'Consulter conflits offline', 'Offline', 'Voir les conflits de synchronisation offline'],
  ['pos_sync.conflicts.resolve', 'Resoudre conflits offline', 'Offline', 'Resoudre administrativement les conflits de synchronisation offline'],
  ['pos_sync.logs.read', 'Consulter journal offline', 'Offline', 'Voir le journal de supervision POS offline'],
];

let token = '';

function unwrap(body) {
  return body && Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;
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

async function setupTenant() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await q(
    `
    INSERT INTO permissions (permission_code, permission_name, module_name, description, is_system_permission)
    VALUES ${OFFLINE_PERMISSIONS.map((_, index) => `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4}, TRUE)`).join(', ')}
    ON CONFLICT (permission_code) DO UPDATE
    SET permission_name = EXCLUDED.permission_name,
        module_name = EXCLUDED.module_name,
        description = EXCLUDED.description,
        is_system_permission = EXCLUDED.is_system_permission
    `,
    OFFLINE_PERMISSIONS.flat(),
  );
  await q(
    `
    INSERT INTO tenants (tenant_code, tenant_name, tenant_type, legal_name, subscription_status, is_active)
    VALUES ($1, 'Offline Staging', 'PHARMACY', 'Offline Staging SARL', 'ACTIVE', TRUE)
    ON CONFLICT (tenant_code) DO UPDATE
    SET tenant_name = EXCLUDED.tenant_name,
        tenant_type = EXCLUDED.tenant_type,
        legal_name = EXCLUDED.legal_name,
        subscription_status = EXCLUDED.subscription_status,
        is_active = TRUE
    `,
    [TENANT_CODE],
  );
  const tenantId = (await q(`SELECT tenant_id FROM tenants WHERE tenant_code = $1`, [TENANT_CODE])).rows[0].tenant_id;

  await q(
    `
    INSERT INTO sites (tenant_id, site_code, site_name, site_type, is_active)
    VALUES ($1, $2, 'OFF-STG Site principal', 'PHARMACY', TRUE)
    ON CONFLICT (site_code) DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id,
        site_name = EXCLUDED.site_name,
        site_type = EXCLUDED.site_type,
        is_active = TRUE
    `,
    [tenantId, SITE_CODE],
  );
  const siteId = (await q(`SELECT site_id FROM sites WHERE tenant_id = $1 AND site_code = $2`, [tenantId, SITE_CODE])).rows[0].site_id;

  await q(
    `
    INSERT INTO roles (tenant_id, role_name, description, is_active)
    VALUES ($1, 'ADMIN', 'Administrateur Offline 4', TRUE)
    ON CONFLICT (tenant_id, role_name) DO UPDATE
    SET description = EXCLUDED.description,
        is_active = TRUE
    `,
    [tenantId],
  );
  const roleId = (await q(`SELECT role_id FROM roles WHERE tenant_id = $1 AND role_name = 'ADMIN'`, [tenantId])).rows[0].role_id;

  await q(
    `
    INSERT INTO users (tenant_id, site_id, role_id, full_name, username, email, password_hash, is_active)
    VALUES ($1, $2, $3, 'Admin Offline Staging', 'admin.offline.staging', $4, $5, TRUE)
    ON CONFLICT (username) DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id,
        site_id = EXCLUDED.site_id,
        role_id = EXCLUDED.role_id,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        is_active = TRUE
    `,
    [tenantId, siteId, roleId, ADMIN_EMAIL, passwordHash],
  );

  const userId = (await q(`SELECT user_id FROM users WHERE username = 'admin.offline.staging'`)).rows[0].user_id;

  await q(
    `
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT $1, permission_id
    FROM permissions
    WHERE permission_code IN (
      'pos_sync.read',
      'pos_sync.execute',
      'pos_offline.admin.read',
      'pos_offline.workstations.read',
      'offline_allocations.read',
      'offline_allocations.manage',
      'offline_allocations.transfer',
      'offline_allocations.rebalance',
      'pos_sync.conflicts.read',
      'pos_sync.conflicts.resolve',
      'pos_sync.logs.read',
      'articles.read',
      'purchases.read',
      'sales.create',
      'cash_registers.read'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING
    `,
    [roleId],
  );

  return { tenantId, siteId, roleId, userId };
}

async function login() {
  const auth = await api('/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: PASSWORD },
  });
  token = auth.accessToken;
  return api('/auth/me');
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
      `SELECT workstation_id, workstation_code, device_uuid FROM pos_workstations WHERE tenant_id = $1 AND workstation_code = $2`,
      [tenantId, code],
    )
  ).rows[0];
}

async function ensureMinimalArticle(tenantId, siteId) {
  const categoryId = (
    await q(
      `INSERT INTO categories (tenant_id, category_code, category_name, is_active)
       VALUES ($1, 'OFF-STG-CAT', 'OFF-STG Category', TRUE)
       ON CONFLICT (category_code) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, category_name = EXCLUDED.category_name, is_active = TRUE
       RETURNING category_id`,
      [tenantId],
    )
  ).rows[0].category_id;

  const formId = (
    await q(
      `INSERT INTO galenic_forms (tenant_id, form_code, form_name)
       VALUES ($1, 'OFF-STG-FORM', 'OFF-STG Form')
       ON CONFLICT (form_code) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, form_name = EXCLUDED.form_name
       RETURNING form_id`,
      [tenantId],
    )
  ).rows[0].form_id;

  const routeId = (
    await q(
      `INSERT INTO administration_routes (tenant_id, route_code, route_name)
       VALUES ($1, 'OFF-STG-ROUTE', 'OFF-STG Route')
       ON CONFLICT (route_code) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, route_name = EXCLUDED.route_name
       RETURNING route_id`,
      [tenantId],
    )
  ).rows[0].route_id;

  const typeId = (
    await q(
      `INSERT INTO product_types (tenant_id, type_code, type_name)
       VALUES ($1, 'OFF-STG-TYPE', 'OFF-STG Type')
       ON CONFLICT (type_code) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, type_name = EXCLUDED.type_name
       RETURNING product_type_id`,
      [tenantId],
    )
  ).rows[0].product_type_id;

  const articleId = (
    await q(
      `INSERT INTO articles (
         tenant_id, article_code, commercial_name, category_id, form_id, route_id, product_type_id,
         default_stock_min, is_active
       )
       VALUES ($1, 'OFF-STG-ARTICLE-4', 'OFF-STG Article 4', $2, $3, $4, $5, 1, TRUE)
       ON CONFLICT (article_code) DO UPDATE
       SET tenant_id = EXCLUDED.tenant_id,
           commercial_name = EXCLUDED.commercial_name,
           category_id = EXCLUDED.category_id,
           form_id = EXCLUDED.form_id,
           route_id = EXCLUDED.route_id,
           product_type_id = EXCLUDED.product_type_id,
           default_stock_min = EXCLUDED.default_stock_min,
           is_active = TRUE
       RETURNING article_id`,
      [tenantId, categoryId, formId, routeId, typeId],
    )
  ).rows[0].article_id;

  const lot = (
    await q(
      `INSERT INTO lots (
         tenant_id, article_id, lot_number, expiry_date, purchase_price, selling_price, is_blocked
       )
       VALUES ($1, $2, 'OFF-STG-LOT-4', '2028-12-31', 1, 2, FALSE)
       ON CONFLICT DO NOTHING
       RETURNING lot_id`,
      [tenantId, articleId],
    )
  ).rows[0];

  const lotId = lot?.lot_id ?? (
    await q(`SELECT lot_id FROM lots WHERE tenant_id = $1 AND article_id = $2 AND lot_number = 'OFF-STG-LOT-4'`, [tenantId, articleId])
  ).rows[0].lot_id;

  await q(
    `INSERT INTO stocks (tenant_id, site_id, lot_id, quantity_available, quantity_reserved)
     VALUES ($1, $2, $3, 40, 0)
     ON CONFLICT (site_id, lot_id) DO UPDATE
     SET quantity_available = 40, quantity_reserved = 0, updated_at = CURRENT_TIMESTAMP`,
    [tenantId, siteId, lotId],
  );

  return { articleId, lotId };
}

function createFakeOperation(context) {
  return {
    operationType: 'SALE_VALIDATE',
    operationId: crypto.randomUUID(),
    localSaleId: crypto.randomUUID(),
    offlineReference: 'OFF-STG-CONFLICT-4',
    tenantId: context.tenantId,
    siteId: context.siteId,
    workstationId: context.workstationId,
    deviceId: context.deviceId,
    userId: context.userId,
    cashSessionId: crypto.randomUUID(),
    customerId: null,
    currency: 'USD',
    exchangeRateSnapshot: 2800,
    createdAt: new Date().toISOString(),
    validatedAt: new Date().toISOString(),
    saleMode: 'IMMEDIATE',
    saleType: 'CASH',
    note: 'OFF-STG conflict generation',
    subtotal: 2,
    total: 2,
    payment: {
      amountPaidUsd: 2,
      amountPaidCdf: 0,
      amountReturnedUsd: 0,
      amountReturnedCdf: 0,
      netReceivedUsd: 2,
      netReceivedCdf: 0,
    },
    items: [
      {
        articleId: context.articleId,
        articleCode: 'OFF-STG-ARTICLE-4',
        articleName: 'OFF-STG Article 4',
        quantity: 1,
        unitPriceSnapshot: 2,
        lotAllocations: [
          {
            allocationId: context.allocationId,
            lotId: context.lotId,
            lotNumber: 'OFF-STG-LOT-4',
            expiryDate: '2028-12-31',
            quantity: 1,
            allocationServerVersion: 1,
          },
        ],
      },
    ],
  };
}

async function main() {
  await client.connect();

  const summary = {
    autosync: { status: 'NOT_EXECUTED' },
    supervision: {},
    conflicts: {},
    allocations: {},
    cleanup: 'database/cleanup_offline_4_demo.sql',
  };

  const setup = await setupTenant();
  const currentUser = await login();
  const ws1 = await createWorkstation(setup.tenantId, setup.siteId, WS1_CODE);
  const ws2 = await createWorkstation(setup.tenantId, setup.siteId, WS2_CODE);
  const stockContext = await ensureMinimalArticle(setup.tenantId, setup.siteId);

  const heartbeat = await api('/pos-sync/heartbeat', {
    method: 'POST',
    body: {
      workstationId: ws1.workstation_id,
      deviceId: ws1.device_uuid,
      appVersion: 'validate-offline-4',
      localDbVersion: '4',
      pendingCount: 0,
      conflictCount: 0,
      snapshotStatus: 'FRESH',
    },
  });

  const allocation = await api('/offline-allocations', {
    method: 'POST',
    body: {
      siteId: setup.siteId,
      workstationId: ws1.workstation_id,
      articleId: stockContext.articleId,
      lotId: stockContext.lotId,
      quantity: 9,
    },
  });

  const transfer = await api('/offline-allocations/transfer', {
    method: 'POST',
    body: {
      sourceWorkstationId: ws1.workstation_id,
      targetWorkstationId: ws2.workstation_id,
      allocationId: allocation.allocationId,
      quantity: 3,
    },
  });

  const rebalance = await api('/offline-allocations/rebalance', {
    method: 'POST',
    body: {
      siteId: setup.siteId,
      articleId: stockContext.articleId,
      lotId: stockContext.lotId,
      mode: 'AUTOMATIC_EQUAL',
      workstationIds: [ws1.workstation_id, ws2.workstation_id],
      quantityToAllocate: 6,
    },
  });

  const suspended = await api(`/offline-allocations/${allocation.allocationId}/suspend`, { method: 'POST' });
  const released = await api(`/offline-allocations/${allocation.allocationId}/release`, { method: 'POST' });

  const dashboardBeforeRevoke = await api('/pos-sync/admin/dashboard');
  const workstationsBeforeRevoke = await api('/pos-sync/admin/workstations');
  const detailBeforeRevoke = await api(`/pos-sync/admin/workstations/${ws1.workstation_id}`);

  const revoked = await api(`/pos-sync/admin/workstations/${ws1.workstation_id}/revoke`, { method: 'POST' });

  let revokedHeartbeat;
  try {
    await api('/pos-sync/heartbeat', {
      method: 'POST',
      body: {
        workstationId: ws1.workstation_id,
        deviceId: ws1.device_uuid,
        appVersion: 'validate-offline-4',
        snapshotStatus: 'REVOKED',
      },
    });
    revokedHeartbeat = { blocked: false };
  } catch (error) {
    revokedHeartbeat = { blocked: true, error: error.message, status: error.status };
  }

  const fakeOperation = createFakeOperation({
    tenantId: setup.tenantId,
    siteId: setup.siteId,
    workstationId: ws1.workstation_id,
    deviceId: ws1.device_uuid,
    userId: currentUser.id,
    articleId: stockContext.articleId,
    lotId: stockContext.lotId,
    allocationId: allocation.allocationId,
  });

  const conflictPush = await api('/pos-sync/operations', {
    method: 'POST',
    body: { operations: [fakeOperation] },
  });
  const conflicts = await api('/pos-sync/admin/conflicts');
  const conflict = conflicts[0] ?? null;
  const resolved = conflict
    ? await api(`/pos-sync/admin/conflicts/${conflict.conflictId}/resolve`, {
        method: 'POST',
        body: { resolutionType: 'MANUAL_REVIEW_COMPLETED', note: 'Validation Offline 4' },
      })
    : null;
  const logs = await api('/pos-sync/admin/logs');

  summary.supervision = {
    heartbeat,
    dashboardBeforeRevoke,
    workstationsBeforeRevoke: workstationsBeforeRevoke.length,
    detailBeforeRevoke,
    revoked,
    revokedHeartbeat,
  };
  summary.allocations = {
    create: allocation,
    transfer,
    rebalanceCount: Array.isArray(rebalance) ? rebalance.length : 0,
    suspendedStatus: suspended.status,
    releasedStatus: released.status,
  };
  summary.conflicts = {
    pushResult: conflictPush.results?.[0] ?? null,
    listed: conflicts.length,
    firstConflict: conflict,
    resolved,
    logs: logs.length,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      message: error?.message || String(error),
      status: error?.status || null,
      endpoint: error?.endpoint || null,
      body: error?.body || null,
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await client.end();
    } catch {}
  });
