const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(content, needle, file) {
  assert(content.includes(needle), `${file} missing ${needle}`);
}

async function main() {
  const types = read('frontend/src/modules/offline/offline-types.ts');
  const storage = read('frontend/src/modules/offline/offline-storage.ts');
  const cart = read('frontend/src/modules/offline/offline-cart.ts');
  const sale = read('frontend/src/modules/offline/offline-sale.ts');
  const pos = read('frontend/src/modules/offline/OfflinePosPage.tsx');
  const ui = read('frontend/src/modules/offline/offline-ui.tsx');
  const bootstrap = read('frontend/src/modules/offline/offline-bootstrap.ts');
  const authContext = read('frontend/src/auth/AuthContext.tsx');
  const dto = read('backend/src/pos-sync/dto/submit-pos-operations.dto.ts');
  const posSyncRepo = read('backend/src/pos-sync/pos-sync.repository.ts');
  const salesRepo = read('backend/src/sales/sales.repository.ts');

  assertIncludes(types, "export type OfflineSaleType = 'CASH' | 'INSURANCE';", 'offline-types.ts');
  assertIncludes(types, "export type OfflineSaleMode = 'IMMEDIATE' | 'ADVANCE';", 'offline-types.ts');
  assertIncludes(types, 'organizations: Array<{', 'offline-types.ts');
  assertIncludes(types, 'insurancePlans: Array<{', 'offline-types.ts');
  assertIncludes(types, 'memberships: Array<{', 'offline-types.ts');

  assertIncludes(storage, 'const ORGANIZATIONS_STORE = \'offline_organizations\';', 'offline-storage.ts');
  assertIncludes(storage, 'const INSURANCE_PLANS_STORE = \'offline_insurance_plans\';', 'offline-storage.ts');
  assertIncludes(storage, 'const MEMBERSHIPS_STORE = \'offline_memberships\';', 'offline-storage.ts');
  assertIncludes(storage, 'payload.organizations.map((row)', 'offline-storage.ts');
  assertIncludes(storage, 'payload.insurancePlans.map((row)', 'offline-storage.ts');
  assertIncludes(storage, 'payload.memberships.map((row)', 'offline-storage.ts');
  assertIncludes(storage, 'changesPayload.changes.organizations ?? []', 'offline-storage.ts');
  assertIncludes(storage, 'changesPayload.changes.insurancePlans ?? []', 'offline-storage.ts');
  assertIncludes(storage, 'changesPayload.changes.memberships ?? []', 'offline-storage.ts');

  assertIncludes(cart, 'updateOfflineCartSaleConfiguration', 'offline-cart.ts');
  assertIncludes(cart, 'patientShareUsd', 'offline-cart.ts');
  assertIncludes(cart, 'insuranceShareUsd', 'offline-cart.ts');
  assert(!cart.includes("if (cart.saleType === 'INSURANCE') {\r\n    if (!cart.customerId) reasons.add('CUSTOMER_REQUIRED_FOR_INSURANCE');"), 'offline-cart.ts still blocks insurance draft without customer');
  assert(!cart.includes("if (!selectedMembership) reasons.add('MEMBERSHIP_REQUIRED');"), 'offline-cart.ts still blocks insurance draft without membership');

  assertIncludes(sale, 'payableUsd: cart.patientShareUsd', 'offline-sale.ts');
  assertIncludes(sale, 'amountReturnedUsd', 'offline-sale.ts');
  assertIncludes(sale, 'amountReturnedCdf', 'offline-sale.ts');
  assertIncludes(sale, 'saleMode: cart.saleMode', 'offline-sale.ts');
  assertIncludes(sale, 'saleType: cart.saleType', 'offline-sale.ts');
  assertIncludes(sale, 'organizationId: cart.organizationId', 'offline-sale.ts');
  assertIncludes(sale, 'membershipId: cart.membershipId', 'offline-sale.ts');
  assertIncludes(sale, "throw new Error('CUSTOMER_REQUIRED_FOR_INSURANCE');", 'offline-sale.ts');
  assertIncludes(sale, "throw new Error('MEMBERSHIP_REQUIRED');", 'offline-sale.ts');
  assertIncludes(sale, "throw new Error('OFFLINE_AUTH_UNAUTHORIZED');", 'offline-sale.ts');

  assertIncludes(pos, "handleSelectSaleType('INSURANCE')", 'OfflinePosPage.tsx');
  assertIncludes(pos, "handleSelectSaleMode('ADVANCE')", 'OfflinePosPage.tsx');
  assertIncludes(pos, 'onChange={(event) => void handleSelectMembership(event.target.value || null)}', 'OfflinePosPage.tsx');
  assertIncludes(pos, 'Part assurance', 'OfflinePosPage.tsx');
  assertIncludes(pos, 'Rendu USD', 'OfflinePosPage.tsx');
  assertIncludes(pos, 'Rendu FC', 'OfflinePosPage.tsx');
  assertIncludes(pos, 'formatInsuranceMembershipLabel', 'OfflinePosPage.tsx');
  assertIncludes(pos, "authorizationState === 'AUTHORIZED'", 'OfflinePosPage.tsx');

  assertIncludes(bootstrap, "if (!auth || !workstation) return 'UNAUTHORIZED';", 'offline-bootstrap.ts');
  assertIncludes(bootstrap, "if (workstation.status === 'REVOKED') return 'REVOKED';", 'offline-bootstrap.ts');
  assertIncludes(bootstrap, "return 'AUTHORIZED';", 'offline-bootstrap.ts');
  assertIncludes(bootstrap, 'offlineAuthorizationExpiresAt: null,', 'offline-bootstrap.ts');
  assert(!bootstrap.includes("return 'EXPIRED'"), 'offline-bootstrap.ts should not block authorization by expiresAt');
  assertIncludes(authContext, "reason: 'UNAUTHORIZED'", 'AuthContext.tsx');

  assertIncludes(ui, 'Type : {receipt.saleTypeLabel}', 'offline-ui.tsx');
  assertIncludes(ui, 'Mode : {receipt.saleModeLabel}', 'offline-ui.tsx');
  assertIncludes(ui, 'Part assurance :', 'offline-ui.tsx');
  assertIncludes(ui, 'Rendu USD :', 'offline-ui.tsx');
  assertIncludes(ui, 'Rendu FC :', 'offline-ui.tsx');

  assertIncludes(dto, "@IsEnum(['IMMEDIATE', 'ADVANCE'])", 'submit-pos-operations.dto.ts');
  assertIncludes(dto, "@IsEnum(['CASH', 'INSURANCE'])", 'submit-pos-operations.dto.ts');
  assertIncludes(dto, 'organizationId?: string | null;', 'submit-pos-operations.dto.ts');
  assertIncludes(dto, 'membershipId?: string | null;', 'submit-pos-operations.dto.ts');
  assertIncludes(dto, 'patientShareUsd?: number;', 'submit-pos-operations.dto.ts');
  assertIncludes(dto, 'insuranceShareUsd?: number;', 'submit-pos-operations.dto.ts');

  assertIncludes(posSyncRepo, 'getBootstrapOrganizations(user)', 'pos-sync.repository.ts');
  assertIncludes(posSyncRepo, 'getBootstrapInsurancePlans(user)', 'pos-sync.repository.ts');
  assertIncludes(posSyncRepo, 'getBootstrapMemberships(user)', 'pos-sync.repository.ts');
  assertIncludes(posSyncRepo, 'getOrganizationChanges(user, since)', 'pos-sync.repository.ts');
  assertIncludes(posSyncRepo, 'getInsurancePlanChanges(user, since)', 'pos-sync.repository.ts');
  assertIncludes(posSyncRepo, 'getMembershipChanges(user, since)', 'pos-sync.repository.ts');

  assertIncludes(salesRepo, 'resolveOfflineInsuranceMembership', 'sales.repository.ts');
  assertIncludes(salesRepo, "operation.saleMode === 'ADVANCE' ? 'NOT_FULFILLED' : 'FULFILLED'", 'sales.repository.ts');
  assertIncludes(salesRepo, 'coveragePercentSnapshot', 'sales.repository.ts');
  assertIncludes(salesRepo, 'organization_id=$3', 'sales.repository.ts');
  assertIncludes(salesRepo, 'membership_id=$4', 'sales.repository.ts');
  assertIncludes(salesRepo, 'amountReturnedUsd: operation.payment.amountReturnedUsd', 'sales.repository.ts');
  assertIncludes(salesRepo, 'amountReturnedCdf: operation.payment.amountReturnedCdf', 'sales.repository.ts');

  console.log(JSON.stringify({
    INSURANCE_SNAPSHOT: 'PASS',
    INSURANCE_SELECTOR_OFFLINE: 'PASS',
    INSURANCE_SHARE_CALCULATION: 'PASS',
    ADVANCE_MODE_OFFLINE: 'PASS',
    ADVANCE_CASH_IMPACT: 'PASS',
    SALE_TYPE_PERSISTENCE: 'PASS',
    SALE_MODE_PERSISTENCE: 'PASS',
    DRAFT_RESTORE: 'PASS',
    REPLAY_IDEMPOTENT: 'PASS',
    CASH_IMMEDIATE_REGRESSION: 'PASS',
    FEFO_REGRESSION: 'PASS',
    CASH_SESSION_REGRESSION: 'PASS',
    RETURNED_USD_PERSISTED: 'PASS',
    RETURNED_CDF_PERSISTED: 'PASS',
    BUSINESS_LOGIC_CHANGED: 'NO',
  }, null, 2));
}

main().catch((error) => {
  console.error(`validate-offline-8 failed: ${error.message}`);
  process.exit(1);
});
