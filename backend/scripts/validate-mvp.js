const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const baseUrl = process.env.MVP_API_URL || 'http://localhost:3000/api/v1';
const suite = process.argv[2] || 'all';
const connectionString = (process.env.DATABASE_URL || '').replace(/^[ '"]+|[ '"]+$/g, '');
const client = new Client({
  connectionString,
  ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
});

function describeError(error) {
  if (!(error instanceof Error)) return { value: String(error) };
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    errno: error.errno,
    address: error.address,
    port: error.port,
    endpoint: error.endpoint,
    status: error.status,
    body: error.body,
    rawBody: error.rawBody,
    cause: error.cause ? describeError(error.cause) : undefined,
    errors: Array.isArray(error.errors) ? error.errors.map(describeError) : undefined,
    stack: error.stack,
  };
}

let token = '';
let context = {};
const stamp = Date.now();

function unwrap(body) {
  return body && Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;
}

async function api(path, options = {}) {
  const url = baseUrl + path;
  const authToken = options.authToken ?? token;
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers || {}),
      },
      body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
    });
  } catch (error) {
    throw Object.assign(new Error(`NETWORK_ERROR:${error.message || error}`), { endpoint: path, cause: error });
  }

  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text || null;
  }
  const body = unwrap(parsed);
  if (!response.ok) {
    const message = body?.message || body?.error || text || `HTTP ${response.status}`;
    throw Object.assign(new Error(message), { status: response.status, body, rawBody: text, endpoint: path });
  }
  return body;
}

async function loadContext() {
  const result = await client.query(`
    SELECT t.tenant_id, s.site_id, c.currency_id
    FROM tenants t
    JOIN sites s ON s.tenant_id = t.tenant_id AND s.site_code = 'DEMO-SITE'
    JOIN currencies c ON c.currency_code = 'USD'
    WHERE t.tenant_code = 'DEMO'
    LIMIT 1
  `);
  context = result.rows[0];
}

async function auth() {
  const login = await api('/auth/login', {
    method: 'POST',
    body: { email: 'admin@demo.local', password: 'admin123' },
  });
  token = login.accessToken;
  const me = await api('/auth/me');
  return Boolean(token && me.tenantId && Array.isArray(me.permissions));
}

async function loginAs(email, password) {
  const login = await api('/auth/login', {
    method: 'POST',
    authToken: '',
    body: { email, password },
  });
  return login.accessToken;
}

async function articles() {
  const article = await api('/articles', {
    method: 'POST',
    body: {
      articleCode: `MVP-ART-${Date.now()}`,
      commercialName: 'Article validation MVP',
      dci: 'Test',
      dosage: '1 mg',
      prescriptionRequired: false,
      defaultStockMin: 1,
      defaultStockMax: 20,
    },
  });
  const list = await api(`/articles?search=${encodeURIComponent(article.articleCode)}`);
  context.article = article;
  return Boolean(list.items.find((item) => item.articleId === article.articleId));
}

async function supplier() {
  const list = await api('/suppliers');
  if (list[0]) return list[0];
  return api('/suppliers', {
    method: 'POST',
    body: {
      supplierCode: `MVP-SUP-${Date.now()}`,
      supplierName: 'Supplier validation MVP',
      isActive: true,
    },
  });
}

async function purchaseToStock() {
  if (!context.article) await articles();
  const purchase = await api('/purchases', {
    method: 'POST',
    body: {
      supplierId: (await supplier()).supplierId,
      siteId: context.site_id,
      currencyId: context.currency_id,
      exchangeRate: 1,
    },
  });
  await api(`/purchases/${purchase.purchaseId}/items`, {
    method: 'POST',
    body: {
      articleId: context.article.articleId,
      lotNumber: `MVP-LOT-${Date.now()}`,
      expiryDate: '2028-12-31',
      quantity: 8,
      purchaseUnitPrice: 2,
      sellingUnitPrice: 4,
    },
  });
  const validated = await api(`/purchases/${purchase.purchaseId}/validate`, { method: 'POST' });
  const movement = await client.query(
    `SELECT COUNT(*)::int AS total FROM stock_movements WHERE tenant_id=$1 AND reference_id=$2 AND movement_type='PURCHASE_IN'`,
    [context.tenant_id, purchase.purchaseId],
  );
  return validated.status === 'VALIDATED' && Number(movement.rows[0].total) > 0;
}

async function saleFefo() {
  if (!context.article) await articles();
  await purchaseToStock();
  const sale = await api('/sales', {
    method: 'POST',
    body: { siteId: context.site_id, currencyId: context.currency_id, saleType: 'CASH' },
  });
  await api(`/sales/${sale.saleId}/items/fefo`, {
    method: 'POST',
    body: { articleId: context.article.articleId, quantity: 2 },
  });
  const validated = await api(`/sales/${sale.saleId}/validate`, {
    method: 'POST',
    body: { amountPaid: 8 },
  });
  const movement = await client.query(
    `SELECT COUNT(*)::int AS total FROM stock_movements WHERE tenant_id=$1 AND reference_id=$2 AND movement_type='SALE_OUT'`,
    [context.tenant_id, sale.saleId],
  );
  return validated.status === 'VALIDATED' && Number(movement.rows[0].total) > 0;
}

async function closeCurrentIfAny() {
  const current = await api(`/cash/sessions/current?siteId=${context.site_id}`);
  if (!current) return;
  const totals = await client.query(
    `SELECT cs.opening_balance,
            COALESCE(SUM(CASE WHEN cm.movement_type IN ('SALE_PAYMENT','RECEIVABLE_PAYMENT','CASH_IN','ADVANCE','ADJUSTMENT') THEN cm.amount ELSE 0 END),0)::numeric AS total_in,
            COALESCE(SUM(CASE WHEN cm.movement_type IN ('SALE_CHANGE','EXPENSE','CASH_OUT','BANK_DEPOSIT') THEN cm.amount ELSE 0 END),0)::numeric AS total_out
     FROM cash_sessions cs
     LEFT JOIN cash_movements cm ON cm.cash_session_id=cs.cash_session_id AND cm.tenant_id=cs.tenant_id
     WHERE cs.cash_session_id=$1
     GROUP BY cs.opening_balance`,
    [current.cashSessionId],
  );
  const row = totals.rows[0];
  const expected = Number(row.opening_balance) + Number(row.total_in) - Number(row.total_out);
  await api(`/cash/sessions/${current.cashSessionId}/close`, {
    method: 'POST',
    body: { countedClosingBalance: expected, notes: 'Auto-close validate:mvp' },
  });
}

async function cashSession() {
  const adminToken = token;
  const permissions = await api('/permissions', { authToken: adminToken });
  const permissionIds = (codes) => permissions.filter((permission) => codes.includes(permission.permissionCode)).map((permission) => permission.permissionId);
  const basicCodes = ['cash_sessions.open', 'cash_sessions.close', 'cash_registers.read'];
  const standardRole = await api('/roles', {
    method: 'POST',
    authToken: adminToken,
    body: {
      roleName: `MVP_STD_${stamp}`,
      description: 'Role validation MVP standard',
      permissionIds: permissionIds(basicCodes),
    },
  });
  const multiRole = await api('/roles', {
    method: 'POST',
    authToken: adminToken,
    body: {
      roleName: `MVP_MULTI_${stamp}`,
      description: 'Role validation MVP multi-session',
      permissionIds: permissionIds([...basicCodes, 'sessions.multiple']),
    },
  });

  const createUser = (suffix, roleId) => api('/users', {
    method: 'POST',
    authToken: adminToken,
    body: {
      fullName: `MVP ${suffix}`,
      username: `mvp.${suffix.toLowerCase()}.${stamp}`,
      email: `mvp.${suffix.toLowerCase()}.${stamp}@demo.local`,
      roleId,
      siteId: context.site_id,
      password: 'Recipe123!',
      isActive: true,
    },
  });

  const standardUserA = await createUser('StandardA', standardRole.roleId);
  const standardUserB = await createUser('StandardB', standardRole.roleId);
  const multiUser = await createUser('Multi', multiRole.roleId);

  const createWorkstation = (code, name, deviceUuid) => api('/workstations', {
    method: 'POST',
    authToken: adminToken,
    body: {
      siteId: context.site_id,
      workstationCode: `${code}-${stamp}`,
      workstationName: `${name} ${stamp}`,
      workstationType: 'POS',
      deviceUuid,
    },
  });

  const workstationA = await createWorkstation('MVP-WS-A', 'MVP Poste A', `mvp-device-a-${stamp}`);
  const workstationB = await createWorkstation('MVP-WS-B', 'MVP Poste B', `mvp-device-b-${stamp}`);
  const workstationC = await createWorkstation('MVP-WS-C', 'MVP Poste C', `mvp-device-c-${stamp}`);

  const standardTokenA = await loginAs(standardUserA.email, 'Recipe123!');
  const standardTokenB = await loginAs(standardUserB.email, 'Recipe123!');
  const multiToken = await loginAs(multiUser.email, 'Recipe123!');

  const closeSessionExact = (authToken, sessionId, countedClosingBalance = 100) => api(`/cash/sessions/${sessionId}/close`, {
    method: 'POST',
    authToken,
    body: { countedClosingBalance, notes: 'Auto-close validate:mvp' },
  });

  const standardOpened = await api('/cash/sessions/open', {
    method: 'POST',
    authToken: standardTokenA,
    body: { siteId: context.site_id, openingBalance: 100, workstationId: workstationA.workstationId, deviceUuid: `mvp-device-a-${stamp}` },
  });
  let standardBlocked = false;
  try {
    await api('/cash/sessions/open', {
      method: 'POST',
      authToken: standardTokenA,
      body: { siteId: context.site_id, openingBalance: 100, workstationId: workstationB.workstationId, deviceUuid: `mvp-device-b-${stamp}` },
    });
  } catch (error) {
    standardBlocked = error.status === 409;
  }
  const standardClosed = await closeSessionExact(standardTokenA, standardOpened.cashSessionId, 100);

  const multiOpenedA = await api('/cash/sessions/open', {
    method: 'POST',
    authToken: multiToken,
    body: { siteId: context.site_id, openingBalance: 100, workstationId: workstationA.workstationId, deviceUuid: `mvp-device-a-${stamp}-multi` },
  });
  const multiOpenedB = await api('/cash/sessions/open', {
    method: 'POST',
    authToken: multiToken,
    body: { siteId: context.site_id, openingBalance: 100, workstationId: workstationB.workstationId, deviceUuid: `mvp-device-b-${stamp}-multi` },
  });
  let sameWorkstationBlocked = false;
  try {
    await api('/cash/sessions/open', {
      method: 'POST',
      authToken: multiToken,
      body: { siteId: context.site_id, openingBalance: 100, workstationId: workstationA.workstationId, deviceUuid: `mvp-device-a-${stamp}-again` },
    });
  } catch (error) {
    sameWorkstationBlocked = error.status === 409;
  }
  const multiClosedA = await closeSessionExact(multiToken, multiOpenedA.cashSessionId, 100);
  const multiClosedB = await closeSessionExact(multiToken, multiOpenedB.cashSessionId, 100);

  const parallelOpenedA = await api('/cash/sessions/open', {
    method: 'POST',
    authToken: standardTokenA,
    body: { siteId: context.site_id, openingBalance: 100, workstationId: workstationA.workstationId, deviceUuid: `mvp-device-a-${stamp}-parallel` },
  });
  const parallelOpenedB = await api('/cash/sessions/open', {
    method: 'POST',
    authToken: standardTokenB,
    body: { siteId: context.site_id, openingBalance: 100, workstationId: workstationC.workstationId, deviceUuid: `mvp-device-c-${stamp}-parallel` },
  });
  const parallelClosedA = await closeSessionExact(standardTokenA, parallelOpenedA.cashSessionId, 100);
  const parallelClosedB = await closeSessionExact(standardTokenB, parallelOpenedB.cashSessionId, 100);

  return Boolean(
    standardOpened.status === 'OPEN' &&
    standardBlocked &&
    standardClosed.status === 'CLOSED' &&
    multiOpenedA.status === 'OPEN' &&
    multiOpenedB.status === 'OPEN' &&
    sameWorkstationBlocked &&
    multiClosedA.status === 'CLOSED' &&
    multiClosedB.status === 'CLOSED' &&
    parallelOpenedA.status === 'OPEN' &&
    parallelOpenedB.status === 'OPEN' &&
    parallelClosedA.status === 'CLOSED' &&
    parallelClosedB.status === 'CLOSED'
  );
}

const suites = {
  auth,
  articles,
  'purchase-stock': purchaseToStock,
  'sale-fefo': saleFefo,
  'cash-session': cashSession,
};

(async () => {
  await client.connect();
  await auth();
  await loadContext();
  const names = suite === 'all' ? Object.keys(suites) : [suite];
  const results = {};
  for (const name of names) {
    if (!suites[name]) throw new Error(`UNKNOWN_SUITE:${name}`);
    results[name] = await suites[name]();
  }
  console.log(JSON.stringify(results, null, 2));
})()
  .catch((error) => {
    console.error(JSON.stringify(describeError(error), null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await client.end();
    } catch {}
  });
