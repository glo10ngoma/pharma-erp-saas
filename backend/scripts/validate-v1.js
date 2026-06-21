const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const baseUrl = process.env.MVP_API_URL || 'http://127.0.0.1:3000/api/v1';
const connectionString = (process.env.DATABASE_URL || '').replace(/^[ '"]+|[ '"]+$/g, '');
const client = new Client({
  connectionString,
  ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
});

let token = '';
let context = {};
const stamp = Date.now();

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
    JOIN sites s ON s.tenant_id=t.tenant_id AND s.site_code='DEMO-SITE'
    JOIN currencies c ON c.currency_code='USD'
    WHERE t.tenant_code='DEMO'
    LIMIT 1
  `);
  context = result.rows[0];
}

async function auth() {
  const login = await api('/auth/login', { method: 'POST', body: { email: 'admin@demo.local', password: 'admin123' } });
  token = login.accessToken;
  const me = await api('/auth/me');
  return Boolean(token && me.tenantId && Array.isArray(me.permissions) && !Object.prototype.hasOwnProperty.call(me, 'passwordHash'));
}

async function usersRolesSites() {
  const permissions = await api('/permissions');
  const articleRead = permissions.find((permission) => permission.permissionCode === 'articles.read');
  const role = await api('/roles', {
    method: 'POST',
    body: { roleName: `V1_ROLE_${stamp}`, description: 'Role validation V1', permissionIds: articleRead ? [articleRead.permissionId] : [] },
  });
  if (articleRead) await api(`/roles/${role.roleId}/permissions`, { method: 'PUT', body: { permissionIds: [articleRead.permissionId] } });
  const sites = await api('/sites');
  const user = await api('/users', {
    method: 'POST',
    body: {
      fullName: 'Agent Validation V1',
      username: `agent.v1.${stamp}`,
      email: `agent.v1.${stamp}@demo.local`,
      roleId: role.roleId,
      siteId: context.site_id,
      password: 'agent123',
      isActive: true,
    },
  });
  return Boolean(role.roleId && user.userId && sites.find((site) => site.siteId === context.site_id));
}

async function reference() {
  const category = await api('/categories', { method: 'POST', body: { categoryCode: `V1CAT${stamp}`, categoryName: `Categorie V1 ${stamp}`, isActive: true } });
  const subCategory = await api('/sub-categories', { method: 'POST', body: { categoryId: category.categoryId, subCategoryCode: `V1SUB${stamp}`, subCategoryName: `Sous categorie V1 ${stamp}`, isActive: true } });
  const form = await api('/galenic-forms', { method: 'POST', body: { formCode: `V1F${stamp}`, formName: `Forme V1 ${stamp}` } });
  const route = await api('/administration-routes', { method: 'POST', body: { routeCode: `V1R${stamp}`, routeName: `Voie V1 ${stamp}` } });
  const productType = await api('/product-types', { method: 'POST', body: { typeCode: `V1T${stamp}`, typeName: `Type V1 ${stamp}` } });
  const supplier = await api('/suppliers', { method: 'POST', body: { supplierCode: `V1SUP${stamp}`, supplierName: 'Fournisseur V1', isActive: true } });
  const customer = await api('/customers', { method: 'POST', body: { customerCode: `V1CLI${stamp}`, customerName: 'Client V1', customerType: 'INSURANCE_MEMBER', isActive: true } });
  const article = await api('/articles', {
    method: 'POST',
    body: {
      articleCode: `V1ART${stamp}`,
      commercialName: 'Article Validation V1',
      categoryId: category.categoryId,
      subCategoryId: subCategory.subCategoryId,
      formId: form.formId,
      routeId: route.routeId,
      productTypeId: productType.productTypeId,
      dci: 'Test',
      dosage: '1 mg',
      prescriptionRequired: false,
      defaultStockMin: 1,
      defaultStockMax: 50,
    },
  });
  context.article = article;
  context.supplier = supplier;
  context.customer = customer;
  return Boolean(category.categoryId && subCategory.subCategoryId && form.formId && route.routeId && productType.productTypeId && supplier.supplierId && customer.customerId && article.articleId);
}

async function purchaseStock() {
  if (!context.article) await reference();
  const purchase = await api('/purchases', {
    method: 'POST',
    body: { supplierId: context.supplier.supplierId, siteId: context.site_id, currencyId: context.currency_id, exchangeRate: 1 },
  });
  await api(`/purchases/${purchase.purchaseId}/items`, {
    method: 'POST',
    body: { articleId: context.article.articleId, lotNumber: `V1LOT${stamp}`, expiryDate: '2028-12-31', quantity: 20, purchaseUnitPrice: 2, sellingUnitPrice: 5 },
  });
  const validated = await api(`/purchases/${purchase.purchaseId}/validate`, { method: 'POST' });
  const lot = await client.query(`SELECT lot_id FROM lots WHERE article_id=$1 AND lot_number=$2 LIMIT 1`, [context.article.articleId, `V1LOT${stamp}`]);
  const movement = await client.query(`SELECT COUNT(*)::int AS total FROM stock_movements WHERE reference_id=$1 AND movement_type='PURCHASE_IN'`, [purchase.purchaseId]);
  context.purchase = purchase;
  context.lotId = lot.rows[0]?.lot_id;
  return validated.status === 'VALIDATED' && Boolean(context.lotId) && Number(movement.rows[0].total) > 0;
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
  await api(`/cash/sessions/${current.cashSessionId}/close`, { method: 'POST', body: { countedClosingBalance: expected, notes: 'Auto-close validate:v1' } });
}

async function saleCash() {
  await closeCurrentIfAny();
  const session = await api('/cash/sessions/open', { method: 'POST', body: { siteId: context.site_id, openingBalance: 100 } });
  const sale = await api('/sales', { method: 'POST', body: { siteId: context.site_id, currencyId: context.currency_id, saleType: 'CASH' } });
  await api(`/sales/${sale.saleId}/items/fefo`, { method: 'POST', body: { articleId: context.article.articleId, quantity: 2 } });
  const validated = await api(`/sales/${sale.saleId}/validate`, { method: 'POST', body: { amountPaid: 10 } });
  const cashMovement = await client.query(`SELECT COUNT(*)::int AS total FROM cash_movements WHERE reference_id=$1 AND movement_type='SALE_PAYMENT'`, [sale.saleId]);
  await api(`/cash/sessions/${session.cashSessionId}/close`, { method: 'POST', body: { countedClosingBalance: 110 } });
  return validated.status === 'VALIDATED' && Number(cashMovement.rows[0].total) > 0;
}

async function insuranceReceivable() {
  const organization = await api('/organizations', { method: 'POST', body: { organizationCode: `V1ORG${stamp}`, organizationName: 'Assurance V1', organizationType: 'INSURANCE', isActive: true } });
  const plan = await api('/insurance-plans', { method: 'POST', body: { organizationId: organization.organizationId, planCode: `V1PLAN${stamp}`, planName: 'Plan V1 80', coveragePercent: 80, isActive: true } });
  const membership = await api('/memberships', { method: 'POST', body: { customerId: context.customer.customerId, organizationId: organization.organizationId, planId: plan.planId, memberNumber: `V1MEM${stamp}`, validFrom: '2026-01-01', validTo: '2028-12-31', isActive: true } });
  const sale = await api('/sales', { method: 'POST', body: { siteId: context.site_id, currencyId: context.currency_id, customerId: context.customer.customerId, saleType: 'CASH' } });
  await api(`/sales/${sale.saleId}/items/fefo`, { method: 'POST', body: { articleId: context.article.articleId, quantity: 1 } });
  await api(`/sales/${sale.saleId}/apply-insurance`, { method: 'POST', body: { membershipId: membership.membershipId } });
  const validated = await api(`/sales/${sale.saleId}/validate`, { method: 'POST', body: { amountPaid: 1 } });
  const receivable = (await api('/receivables')).find((item) => item.saleId === sale.saleId);
  if (receivable) await api(`/receivables/${receivable.receivableId}/pay`, { method: 'POST', body: { amount: receivable.balance } });
  const paid = receivable ? await api(`/receivables/${receivable.receivableId}`) : null;
  return validated.status === 'VALIDATED' && receivable?.receivableId && paid?.status === 'PAID';
}

async function inventory() {
  const inventory = await api('/inventories', { method: 'POST', body: { siteId: context.site_id, inventoryType: 'PARTIAL' } });
  await api(`/inventories/${inventory.inventoryId}/start`, { method: 'POST' });
  const stock = await client.query(`SELECT quantity_available::numeric AS qty FROM stocks WHERE site_id=$1 AND lot_id=$2 LIMIT 1`, [context.site_id, context.lotId]);
  const physical = Math.max(0, Number(stock.rows[0].qty) - 1);
  await api(`/inventories/${inventory.inventoryId}/items`, { method: 'POST', body: { articleId: context.article.articleId, lotId: context.lotId, physicalQuantity: physical, reason: 'Validation V1' } });
  await api(`/inventories/${inventory.inventoryId}/close`, { method: 'POST' });
  const validated = await api(`/inventories/${inventory.inventoryId}/validate`, { method: 'POST' });
  const movement = await client.query(`SELECT COUNT(*)::int AS total FROM stock_movements WHERE reference_id=$1 AND movement_type IN ('INVENTORY_GAIN','INVENTORY_LOSS')`, [inventory.inventoryId]);
  return validated.status === 'VALIDATED' && Number(movement.rows[0].total) > 0;
}

async function accounting() {
  const balance = await api('/accounting/trial-balance');
  const debit = balance.reduce((sum, row) => sum + row.debit, 0);
  const credit = balance.reduce((sum, row) => sum + row.credit, 0);
  const ledger = await api('/accounting/general-ledger?accountCode=57');
  return Math.abs(debit - credit) < 0.01 && Array.isArray(ledger);
}

async function reporting() {
  const query = '?from=2020-01-01&to=2030-12-31';
  const dashboard = await api('/reports/dashboard' + query);
  const sales = await api('/reports/sales' + query);
  const stock = await api('/reports/stock' + query);
  const expiry = await api('/reports/expiry' + query);
  return typeof dashboard.revenueToday === 'number' && Array.isArray(sales) && Array.isArray(stock) && Array.isArray(expiry);
}

const suites = {
  auth,
  'users-roles-sites': usersRolesSites,
  reference,
  'achat-stock': purchaseStock,
  'vente-caisse': saleCash,
  'assurance-creance': insuranceReceivable,
  inventaire: inventory,
  comptabilite: accounting,
  reporting,
};

(async () => {
  await client.connect();
  await auth();
  await loadContext();
  const results = {};
  for (const [name, run] of Object.entries(suites)) {
    results[name] = await run();
  }
  console.log(JSON.stringify(results, null, 2));
  if (!Object.values(results).every(Boolean)) process.exitCode = 1;
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
