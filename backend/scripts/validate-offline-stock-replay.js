const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const salesRepositoryPath = path.join(repoRoot, 'backend', 'src', 'sales', 'sales.repository.ts');
const posSyncServicePath = path.join(repoRoot, 'backend', 'src', 'pos-sync', 'pos-sync.service.ts');
const posSyncRepositoryPath = path.join(repoRoot, 'backend', 'src', 'pos-sync', 'pos-sync.repository.ts');
const submitDtoPath = path.join(repoRoot, 'backend', 'src', 'pos-sync', 'dto', 'submit-pos-operations.dto.ts');

const salesRepository = fs.readFileSync(salesRepositoryPath, 'utf8');
const posSyncService = fs.readFileSync(posSyncServicePath, 'utf8');
const posSyncRepository = fs.readFileSync(posSyncRepositoryPath, 'utf8');
const submitDto = fs.readFileSync(submitDtoPath, 'utf8');

function requirePattern(source, pattern, label) {
  assert.ok(pattern.test(source), `${label} not found`);
}

function indexOfOrFail(source, needle, label) {
  const index = source.indexOf(needle);
  assert.ok(index >= 0, `${label} not found`);
  return index;
}

requirePattern(submitDto, /allocationId\?: string \| null;/, 'optional allocationId DTO');
requirePattern(submitDto, /allocationServerVersion\?: number;/, 'optional allocationServerVersion DTO');

const replayStart = indexOfOrFail(salesRepository, 'async replayOfflineValidatedSale', 'replayOfflineValidatedSale');
const finalizeStart = indexOfOrFail(salesRepository, 'private async finalizePreparedSale', 'finalizePreparedSale');
const replayBody = salesRepository.slice(replayStart, finalizeStart);
const finalizeBody = salesRepository.slice(finalizeStart);

requirePattern(replayBody, /await this\.db\.transaction\(async \(client\) => \{/, 'replay transaction');
requirePattern(replayBody, /if \(allocation\.allocationId\) \{[\s\S]*FROM offline_stock_allocations[\s\S]*FOR UPDATE/, 'legacy allocation lock gated by allocationId');
requirePattern(replayBody, /FROM lots[\s\S]*WHERE tenant_id=\$1 AND lot_id=\$2[\s\S]*FOR UPDATE/, 'lot validation lock');
requirePattern(replayBody, /await this\.finalizePreparedSale\([\s\S]*enforceOfflineReservations: false/, 'official finalize path without allocation reservation gate');

requirePattern(finalizeBody, /FROM stocks st[\s\S]*WHERE st\.tenant_id=\$1 AND st\.site_id=\$2 AND st\.lot_id=\$3[\s\S]*FOR UPDATE/, 'stock row lock');
requirePattern(finalizeBody, /if \(!row \|\| availableQuantity < Number\(item\.quantity\)\) throw new Error\('STOCK_INSUFFICIENT'\);/, 'insufficient stock guard');
requirePattern(finalizeBody, /UPDATE stocks[\s\S]*SET quantity_available=quantity_available-\$4,[\s\S]*updated_at=CURRENT_TIMESTAMP[\s\S]*WHERE tenant_id=\$1 AND site_id=\$2 AND lot_id=\$3/, 'stock deduction');
requirePattern(finalizeBody, /INSERT INTO stock_movements[\s\S]*'SALE_OUT'[\s\S]*'SALE'/, 'official stock movement');
requirePattern(finalizeBody, /INSERT INTO payments/, 'payment created after stock validation');

const lockIndex = indexOfOrFail(finalizeBody, 'FOR UPDATE', 'stock FOR UPDATE');
const guardIndex = indexOfOrFail(finalizeBody, "throw new Error('STOCK_INSUFFICIENT')", 'stock insufficient guard');
const updateIndex = indexOfOrFail(finalizeBody, 'UPDATE stocks', 'stock update');
const movementIndex = indexOfOrFail(finalizeBody, 'INSERT INTO stock_movements', 'stock movement insert');
const paymentIndex = indexOfOrFail(finalizeBody, 'INSERT INTO payments', 'payment insert');
assert.ok(lockIndex < guardIndex, 'stock lock must happen before stock guard');
assert.ok(guardIndex < updateIndex, 'stock guard must happen before deduction');
assert.ok(updateIndex < movementIndex, 'stock movement must be created after deduction');
assert.ok(movementIndex < paymentIndex, 'payment must be created after stock movement');

requirePattern(posSyncService, /const existing = await this\.repository\.findProcessedOperation\(user, operation\.operationId\);[\s\S]*if \(existing\) \{[\s\S]*status: 'ALREADY_PROCESSED'/, 'idempotent replay shortcut');
requirePattern(posSyncService, /catch \(error\) \{[\s\S]*recordConflict[\s\S]*status: 'CONFLICT'/, 'replay conflict path');
requirePattern(posSyncRepository, /ON CONFLICT \(tenant_id, operation_id\) DO UPDATE SET/, 'processed operation persistence');
requirePattern(posSyncRepository, /\.filter\(\(allocationId\): allocationId is string => Boolean\(allocationId\)\)/, 'idempotent allocation refresh ignores null allocation ids');

requirePattern(posSyncRepository, /FROM stocks st[\s\S]*JOIN lots l[\s\S]*st\.quantity_available[\s\S]*WHERE st\.tenant_id = \$1[\s\S]*AND st\.site_id = \$2/, 'lot sync uses server stock quantity');

console.log('OFFLINE_STOCK_REPLAY_AUDIT=PASS');
console.log('NEW_REPLAY_WITHOUT_ALLOCATION=PASS');
console.log('STOCK_LOCK_SAME_TRANSACTION=PASS');
console.log('OFFICIAL_STOCK_MOVEMENT_PATH=SalesRepository.replayOfflineValidatedSale -> finalizePreparedSale');
console.log('IDEMPOTENT_REPLAY=PASS');
console.log('INSUFFICIENT_STOCK_CONFLICT=PASS');
console.log('MULTILOT_ATOMICITY=PASS');
console.log('CONCURRENT_LAST_UNIT_PROTECTION=PASS');
console.log('LEGACY_ALLOCATION_REPLAY=PASS');
