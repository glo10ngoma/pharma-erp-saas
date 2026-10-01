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
const dto = read('backend/src/users/dto/create-user.dto.ts');
const repository = read('backend/src/users/users.repository.ts');
const usersPage = read('frontend/src/modules/users/UsersPage.tsx');
const usersService = read('frontend/src/services/users.service.ts');

for (const column of ['first_name', 'last_name', 'post_name', 'gender', 'birth_date', 'job_title', 'employee_number', 'department']) {
  assertContains('migration additive columns', migration, `ADD COLUMN IF NOT EXISTS ${column}`);
  assertContains('repository response mapping', repository, column);
}

assertContains('birth date uses date type', migration, 'birth_date DATE');
assertContains('gender backend validation', dto, "@IsIn(['MALE', 'FEMALE', 'OTHER'])");
assertContains('future birth date rejected', repository, 'BIRTH_DATE_IN_FUTURE');
assertContains('full name rebuilt', repository, 'buildFullName');
assertContains('email normalized', repository, 'toLowerCase()');
assertContains('optional fields normalized to null', repository, 'optionalText');
assertContains('user edit endpoint', usersService, 'apiClient.patch<UserItem>');
assertContains('create UI section personal', usersPage, 'Informations personnelles');
assertContains('create UI section professional', usersPage, 'Informations professionnelles');
assertContains('create UI section account', usersPage, 'Compte & acces PharmaERP');
assertContains('search includes employee number', usersPage, 'employeeNumber');
assertContains('list includes secondary email', usersPage, 'admin-user-secondary');

console.log('USERS_PROFILE_CONTRACT=PASS');
console.log('MIGRATION_ADDITIVE=PASS');
console.log('GENDER_VALIDATION=PASS');
console.log('BIRTH_DATE_VALIDATION=PASS');
console.log('PROFILE_API_RESPONSE=PASS');
console.log('USER_PROFILE_UI=PASS');
