const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertContains(name, content, expected) {
  if (!content.includes(expected)) {
    throw new Error(`${name}: missing ${expected}`);
  }
}

const usersRepository = read('src/users/users.repository.ts');
const usersService = read('src/users/users.service.ts');
const rolesRepository = read('src/roles/roles.repository.ts');
const rolesService = read('src/roles/roles.service.ts');
const sitesService = read('src/sites/sites.service.ts');
const apiError = fs.readFileSync(path.join(root, '..', 'frontend/src/services/apiError.ts'), 'utf8');

assertContains(
  'users.repository update site scope',
  usersRepository,
  'AND ($11::uuid IS NULL OR site_id = $11::uuid)',
);
assertContains(
  'users.repository remove site scope',
  usersRepository,
  'AND ($3::uuid IS NULL OR site_id = $3::uuid)',
);
assertContains('users.repository count admins', usersRepository, 'countActiveAdmins');
assertContains('users.service self guard', usersService, 'SELF_DEACTIVATION_FORBIDDEN');
assertContains('users.service last admin guard', usersService, 'LAST_ADMIN_REQUIRED');
assertContains('users.service site forbidden mapping', usersService, 'ForbiddenException');
assertContains('roles.repository count role users', rolesRepository, 'countActiveUsersForRole');
assertContains('roles.service role in use guard', rolesService, 'ROLE_IN_USE');
assertContains('sites.service site forbidden mapping', sitesService, 'SITE_NOT_ALLOWED');
assertContains('api error role in use label', apiError, 'ROLE_IN_USE');
assertContains('api error last admin label', apiError, 'LAST_ADMIN_REQUIRED');

console.log('ADMIN_SECURITY_VALIDATION=PASS');
