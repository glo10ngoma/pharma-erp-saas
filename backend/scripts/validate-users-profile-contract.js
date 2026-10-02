const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function assertContains(name, content, expected) {
  if (!content.includes(expected)) {
    throw new Error(`${name}: missing ${expected}`);
  }
}

const migration = read('database/migrations/20261002_users_profile_fields.sql');
const employeeCounterMigration = read('database/migrations/20261002_user_employee_counters.sql');
const dto = read('backend/src/users/dto/create-user.dto.ts');
const repository = read('backend/src/users/users.repository.ts');
const usersPage = read('frontend/src/modules/users/UsersPage.tsx');
const usersService = read('frontend/src/services/users.service.ts');

for (const column of ['first_name', 'last_name', 'post_name', 'gender', 'birth_date', 'job_title', 'employee_number', 'department']) {
  assertContains('migration additive columns', migration, `ADD COLUMN IF NOT EXISTS ${column}`);
  assertContains('repository response mapping', repository, column);
}

assertContains('birth date uses date type', migration, 'birth_date DATE');
assertContains('employee counter table', employeeCounterMigration, 'CREATE TABLE IF NOT EXISTS user_employee_counters');
assertContains('tenant scoped employee counter', employeeCounterMigration, 'tenant_id UUID PRIMARY KEY');
assertContains('tenant scoped employee number unique index', employeeCounterMigration, 'users_tenant_employee_number_unique');
assertContains('employee numbers tenant setting', employeeCounterMigration, 'EMPLOYEE_NUMBERS_ENABLED');
assertContains('cana employee number seed', employeeCounterMigration, "lower('odnoricia@gmail.com')");
assertContains('gender backend validation', dto, "@IsIn(['MALE', 'FEMALE', 'OTHER'])");
assertContains('future birth date rejected', repository, 'BIRTH_DATE_IN_FUTURE');
assertContains('full name rebuilt', repository, 'buildFullName');
assertContains('email normalized', repository, 'toLowerCase()');
assertContains('optional fields normalized to null', repository, 'optionalText');
assertContains('employee number generated atomically', repository, 'nextEmployeeNumber');
assertContains('employee number generation tenant setting', repository, 'EMPLOYEE_NUMBERS_ENABLED');
assertContains('employee counter uses upsert', repository, 'ON CONFLICT (tenant_id)');
assertContains('employee counter returns number', repository, 'RETURNING last_number AS next_number');
assertContains('employee number format', repository, "padStart(6, '0')");
assertContains('user edit endpoint', usersService, 'apiClient.patch<UserItem>');
assertContains('create UI section personal', usersPage, 'Informations personnelles');
assertContains('create UI section professional', usersPage, 'Informations professionnelles');
assertContains('create UI section account', usersPage, 'Compte & acces PharmaERP');
assertContains('create UI generated employee number', usersPage, 'Genere automatiquement a la creation');
assertContains('edit UI employee number readonly', usersPage, 'readOnly');
assertContains('search includes employee number', usersPage, 'employeeNumber');
assertContains('list includes secondary email', usersPage, 'admin-user-secondary');
if (dto.includes('employeeNumber?: string')) {
  throw new Error('create dto must not accept frontend supplied employeeNumber');
}
if (usersService.includes('employeeNumber?: string')) {
  throw new Error('create user payload must not accept frontend supplied employeeNumber');
}

console.log('USERS_PROFILE_CONTRACT=PASS');
console.log('MIGRATION_ADDITIVE=PASS');
console.log('EMPLOYEE_NUMBER_COUNTER=PASS');
console.log('TENANT_SCOPED_EMPLOYEE_SEQUENCE=PASS');
console.log('EMPLOYEE_NUMBER_UI_READONLY=PASS');
console.log('GENDER_VALIDATION=PASS');
console.log('BIRTH_DATE_VALIDATION=PASS');
console.log('PROFILE_API_RESPONSE=PASS');
console.log('USER_PROFILE_UI=PASS');
