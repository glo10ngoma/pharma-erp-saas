const { execFileSync } = require('child_process');
const { readFileSync } = require('fs');
const { join } = require('path');

function runNodeScript(script, args = []) {
  execFileSync(process.execPath, [script, ...args], { cwd: __dirname + '/..', stdio: 'inherit' });
}

function routeAudit() {
  const appPath = join(__dirname, '..', '..', 'frontend', 'src', 'App.tsx');
  const content = readFileSync(appPath, 'utf8');
  const requiredRoutes = [
    '/login',
    '/articles',
    '/purchases',
    '/purchases/new',
    '/lots',
    '/stocks',
    '/inventories',
    '/transfers',
    '/pos',
    '/sales',
    '/cash',
    '/insurance/dashboard',
    '/insurance/receivables',
    '/insurance/batches',
    '/insurance/payments',
    '/accounting/accounts',
    '/accounting/entries',
    '/accounting/general-ledger',
    '/accounting/trial-balance',
    '/reports/dashboard',
    '/reports',
    '/notifications',
    '/analytics',
    '/users',
    '/roles',
    '/permissions',
    '/sites',
    '/settings/exchange-rate',
  ];
  const missing = requiredRoutes.filter((route) => !content.includes(`path="${route}"`));
  if (missing.length > 0) {
    throw new Error(`RC1_ROUTES_MISSING:${missing.join(',')}`);
  }
  console.log(JSON.stringify({ routes: true, checked: requiredRoutes.length }, null, 2));
}

(async () => {
  console.log('RC1: validate:mvp -- all');
  runNodeScript('scripts/validate-mvp.js', ['all']);
  console.log('RC1: validate:v1');
  runNodeScript('scripts/validate-v1.js');
  console.log('RC1: route audit');
  routeAudit();
  console.log(JSON.stringify({ rc1: true }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ rc1: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
