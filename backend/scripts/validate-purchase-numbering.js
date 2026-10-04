const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const files = {
  migration: 'database/migrations/20261003_purchase_number_counters.sql',
  repository: 'backend/src/purchases/purchases.repository.ts',
  service: 'backend/src/purchases/purchases.service.ts',
  dto: 'backend/src/purchases/dto/create-purchase.dto.ts',
  newPurchase: 'frontend/src/modules/purchases/NewPurchasePage.tsx',
  purchases: 'frontend/src/modules/purchases/PurchasesPage.tsx',
};

const checks = [];
function assert(name, condition, details = '') {
  checks.push({ name, pass: Boolean(condition), details });
}

const migration = read(files.migration);
const repository = read(files.repository);
const service = read(files.service);
const dto = read(files.dto);
const newPurchase = read(files.newPurchase);
const purchases = read(files.purchases);

assert('COUNTER_TABLE_CREATED', /CREATE TABLE IF NOT EXISTS purchase_number_counters/.test(migration));
assert('COUNTER_TENANT_PRIMARY_KEY', /tenant_id UUID PRIMARY KEY/.test(migration));
assert('COUNTER_INITIALIZED_FROM_ACH_ONLY', /purchase_number ~ '\^ACH-\[0-9\]\+\$'/.test(migration) && !/PUR-/.test(migration));
assert('GLOBAL_UNIQUE_CONSTRAINT_DROPPED_ONLY_BY_NAME', /purchases_purchase_number_key/.test(migration) && /ALTER TABLE purchases DROP CONSTRAINT purchases_purchase_number_key/.test(migration));
assert('TENANT_UNIQUE_PRESERVED', /uq_purchases_tenant_number/.test(migration) && /ON purchases\(tenant_id, purchase_number\)/.test(migration));

assert('BACKEND_TRANSACTION_USED', /this\.db\.transaction\(async \(client\)/.test(repository));
assert('BACKEND_COUNTER_INSERT_ON_CONFLICT', /INSERT INTO purchase_number_counters/.test(repository) && /ON CONFLICT \(tenant_id\)/.test(repository));
assert('BACKEND_COUNTER_AND_INSERT_SHARE_CLIENT', /await this\.nextPurchaseNumber\(user\.tenantId, client\)/.test(repository) && /await client\.query<PurchaseRow>/.test(repository));
assert('BACKEND_NO_PUR_DATE_NOW_FALLBACK', !/PUR-\$\{Date\.now\(\)\}/.test(repository));
assert('CLIENT_OVERRIDE_REJECTED', /PURCHASE_NUMBER_CLIENT_OVERRIDE_NOT_ALLOWED/.test(repository) && /hasClientPurchaseNumber/.test(repository));
assert('TENANT_COLLISION_HANDLED', /uq_purchases_tenant_number/.test(service));
assert('DTO_DOES_NOT_EXPOSE_PURCHASE_NUMBER', !/purchaseNumber\?: string/.test(dto));

const frontendCombined = `${newPurchase}\n${purchases}`;
assert('FRONTEND_NO_PURCHASE_CODE_GENERATOR_IMPORT', !/codeGeneratorService/.test(frontendCombined));
assert('FRONTEND_NO_PURCHASE_CODE_GENERATOR_QUERY', !/next-code', 'purchases/.test(frontendCombined));
assert('FRONTEND_CREATE_DOES_NOT_SEND_PURCHASE_NUMBER', !/purchaseNumber:\s*form\.purchaseNumber/.test(frontendCombined));
assert('FRONTEND_CODE_READ_ONLY', /value=\{form\.purchaseNumber \|\| 'ACH-\.\.\.'\} readOnly/.test(frontendCombined));

function format(number) {
  return `ACH-${String(number).padStart(6, '0')}`;
}

const counters = new Map();
function allocate(tenant) {
  const next = (counters.get(tenant) ?? 0) + 1;
  counters.set(tenant, next);
  return format(next);
}

assert('TENANT_A_SEQUENCE_TEST', allocate('tenant-a') === 'ACH-000001' && allocate('tenant-a') === 'ACH-000002');
assert('TENANT_B_SEQUENCE_TEST', allocate('tenant-b') === 'ACH-000001');

const concurrent = ['tenant-c', 'tenant-c'].map(allocate);
assert('CONCURRENT_SAME_TENANT_DISTINCT_NUMBERS', new Set(concurrent).size === concurrent.length && concurrent.includes('ACH-000001') && concurrent.includes('ACH-000002'));
assert('CANCEL_DELETE_DOES_NOT_REUSE_NUMBER', allocate('tenant-c') === 'ACH-000003');
assert('LEGACY_PUR_READABLE_NOT_SEEDED', !migration.includes('PUR-1789554777978'));

for (const check of checks) {
  console.log(`${check.name}=${check.pass ? 'PASS' : 'FAIL'}${check.details ? ` ${check.details}` : ''}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`PURCHASE_NUMBERING_VALIDATION=FAIL failed=${failed.map((check) => check.name).join(',')}`);
  process.exit(1);
}

console.log('PURCHASE_NUMBERING_VALIDATION=PASS');
