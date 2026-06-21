const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const baseUrl = process.env.MVP_API_URL || 'http://localhost:3000/api/v1';
const suite = process.argv[2] || 'all';
const connectionString = (process.env.DATABASE_URL || '').replace(/^[ '"]+|[ '"]+$/g, '');
const client = new Client({
  connectionString,
  ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
});

let token = '';
let context = {};

function unwrap(body) {
  return body && Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;
}

async function api(path, options = {}) {
  const response = await fetch(baseUrl + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });
  const text = await response.text();
  let body = text ? JSON.parse(text) : null;
  body = unwrap(body);
  if (!response.ok) {
    const message = body?.message || body?.error || text || `HTTP ${response.status}`;
    throw Object.assign(new Error(message), { status: response.status, body });
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
  const list = await api('/articles');
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
            COALESCE(SUM(CASE WHEN cm.movement_type IN ('EXPENSE','CASH_OUT','BANK_DEPOSIT') THEN cm.amount ELSE 0 END),0)::numeric AS total_out
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
  await closeCurrentIfAny();
  const opened = await api('/cash/sessions/open', {
    method: 'POST',
    body: { siteId: context.site_id, openingBalance: 100 },
  });
  let blocked = false;
  try {
    await api('/cash/sessions/open', {
      method: 'POST',
      body: { siteId: context.site_id, openingBalance: 100 },
    });
  } catch (error) {
    blocked = error.status === 409;
  }
  await api('/cash/expenses', {
    method: 'POST',
    body: {
      cashSessionId: opened.cashSessionId,
      expenseCategory: 'Validation',
      description: 'Depense validate:mvp',
      amount: 5,
    },
  });
  const closed = await api(`/cash/sessions/${opened.cashSessionId}/close`, {
    method: 'POST',
    body: { countedClosingBalance: 95 },
  });
  return opened.status === 'OPEN' && blocked && closed.status === 'CLOSED' && closed.differenceAmount === 0;
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
    console.error(JSON.stringify({ error: error.message, status: error.status, body: error.body }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await client.end();
    } catch {}
  });
