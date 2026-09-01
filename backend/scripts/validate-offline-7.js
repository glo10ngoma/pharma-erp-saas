const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(content, needle, file) {
  assert(content.includes(needle), `${file} missing ${needle}`);
}

async function main() {
  const layout = read('frontend/src/layouts/DashboardLayout.tsx');
  const app = read('frontend/src/App.tsx');
  const pos = read('frontend/src/modules/offline/OfflinePosPage.tsx');
  const cash = read('frontend/src/modules/offline/OfflineCashPage.tsx');
  const sales = read('frontend/src/modules/offline/OfflineSalesPage.tsx');
  const workstation = read('frontend/src/modules/offline/OfflineWorkstationPage.tsx');
  const login = read('frontend/src/modules/auth/LoginPage.tsx');
  const authContext = read('frontend/src/auth/AuthContext.tsx');
  const ui = read('frontend/src/modules/offline/offline-ui.tsx');
  const cart = read('frontend/src/modules/offline/offline-cart.ts');
  const sale = read('frontend/src/modules/offline/offline-sale.ts');
  const bootstrap = read('frontend/src/modules/offline/offline-bootstrap.ts');
  const config = read('frontend/src/modules/offline/offline-config.ts');
  const manifest = read('frontend/public/manifest.webmanifest');
  const main = read('frontend/src/main.tsx');
  const serviceWorker = read('frontend/public/sw.js');
  const checklist = read('docs/POS_OFFLINE_FIELD_TEST_CHECKLIST.md');
  const syncEngine = read('frontend/src/modules/offline/sync-engine.ts');

  assertIncludes(layout, "title: 'Admin Offline'", 'DashboardLayout.tsx');
  assertIncludes(layout, "['/pos', 'Point de vente', 'sales.create']", 'DashboardLayout.tsx');
  assert(!layout.includes("title: 'POS Offline'"), 'DashboardLayout.tsx should not expose a separate POS Offline nav group');
  assertIncludes(app, 'path="/pos" element={<OfflinePosPage />}', 'App.tsx');
  assertIncludes(app, 'path="/offline/pos" element={<RedirectToUnifiedPos />}', 'App.tsx');
  assertIncludes(pos, 'OfflineWorkspaceLayout', 'OfflinePosPage.tsx');
  assertIncludes(pos, 'ENCAISSER', 'OfflinePosPage.tsx');
  assertIncludes(pos, 'Scannez ou recherchez un article pour commencer.', 'OfflinePosPage.tsx');
  assertIncludes(pos, 'OfflineReceiptTicket', 'OfflinePosPage.tsx');
  assertIncludes(pos, 'flushSync', 'OfflinePosPage.tsx');
  assertIncludes(pos, 'setLastReceiptSale(result.sale);', 'OfflinePosPage.tsx');
  assertIncludes(pos, 'printOfflineReceipt({', 'OfflinePosPage.tsx');
  assertIncludes(pos, "authorizationState === 'AUTHORIZED'", 'OfflinePosPage.tsx');
  assert(!pos.includes('allocationId}</td>'), 'OfflinePosPage.tsx should not render allocationId in the main cart table');
  assertIncludes(cash, 'gapLabel', 'OfflineCashPage.tsx');
  assertIncludes(sales, 'Reimprimer ticket', 'OfflineSalesPage.tsx');
  assertIncludes(sales, 'flushSync', 'OfflineSalesPage.tsx');
  assertIncludes(workstation, 'Assistant premier demarrage', 'OfflineWorkstationPage.tsx');
  assertIncludes(login, 'Impossible de joindre le serveur.', 'LoginPage.tsx');
  assertIncludes(login, 'Connexion Internet requise pour vous connecter sur ce poste.', 'LoginPage.tsx');
  assertIncludes(authContext, 'restoreOfflineSession', 'AuthContext.tsx');
  assertIncludes(authContext, 'inspectOfflineRestore', 'AuthContext.tsx');
  assertIncludes(authContext, 'offlineAuthenticated', 'AuthContext.tsx');
  assertIncludes(ui, 'mapOfflineSellerMessage', 'offline-ui.tsx');
  assertIncludes(ui, 'INTERNAL_SERVER_ERROR', 'offline-ui.tsx');
  assertIncludes(ui, 'buildOfflineReceiptHtml', 'offline-ui.tsx');
  assertIncludes(ui, 'window.open', 'offline-ui.tsx');
  assertIncludes(cart, 'Ouvrez la caisse avant d encaisser une vente.', 'offline-cart.ts');
  assertIncludes(sale, "throw new Error('OFFLINE_AUTH_UNAUTHORIZED');", 'offline-sale.ts');
  assertIncludes(bootstrap, "if (workstation.status === 'REVOKED') return 'REVOKED';", 'offline-bootstrap.ts');
  assertIncludes(bootstrap, "return 'AUTHORIZED';", 'offline-bootstrap.ts');
  assert(!bootstrap.includes("return 'EXPIRED'"), 'offline-bootstrap.ts should no longer expire authorization by time');
  assertIncludes(config, 'OFFLINE_DB_VERSION = 7', 'offline-config.ts');
  assertIncludes(manifest, '"display": "standalone"', 'manifest.webmanifest');
  assertIncludes(manifest, '"start_url": "/pos"', 'manifest.webmanifest');
  assertIncludes(manifest, '"scope": "/"', 'manifest.webmanifest');
  assertIncludes(main, "navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })", 'main.tsx');
  assertIncludes(serviceWorker, "const SHELL_CACHE_PREFIX = 'pharmaerp-pos-shell-';", 'sw.js');
  assertIncludes(serviceWorker, "const SHELL_CACHE = `${SHELL_CACHE_PREFIX}v2`;", 'sw.js');
  assertIncludes(serviceWorker, 'await updateShellFromResponse(response);', 'sw.js');
  assertIncludes(serviceWorker, "await cache.put('/index.html', shellResponse.clone());", 'sw.js');
  assertIncludes(serviceWorker, "if (url.pathname.startsWith('/api/')) {", 'sw.js');
  assertIncludes(serviceWorker, 'event.respondWith(fetch(request));', 'sw.js');
  assertIncludes(serviceWorker, "const networkResponse = await fetch(request, { cache: 'no-store' });", 'sw.js');
  assertIncludes(serviceWorker, 'await updateShellFromResponse(networkResponse.clone());', 'sw.js');
  assertIncludes(serviceWorker, "return (await cache.match('/index.html')) || (await cache.match(SHELL_ENTRY)) || Response.error();", 'sw.js');
  assertIncludes(syncEngine, 'const PENDING_RECOVERY_INTERVAL_MS = 10_000;', 'sync-engine.ts');
  assertIncludes(syncEngine, "scheduleNext(state.pendingCount > 0 || state.syncingCount > 0 ? PENDING_RECOVERY_INTERVAL_MS : AUTO_SYNC_INTERVAL_MS);", 'sync-engine.ts');
  assertIncludes(syncEngine, "if (state.pendingCount > 0 || state.syncingCount > 0) {", 'sync-engine.ts');
  assertIncludes(syncEngine, "void runSync('timer');", 'sync-engine.ts');
  assert(!serviceWorker.includes('skipWaiting'), 'sw.js should not call skipWaiting');
  assert(!serviceWorker.includes('window.location.reload'), 'sw.js should not trigger reloads');
  assert(!serviceWorker.includes('indexedDB.deleteDatabase'), 'sw.js must not touch IndexedDB');
  assert(!serviceWorker.includes("caches.delete(cacheName))\n      );\n      await self.clients.claim();\n    })(),\n  );\n});\n\nself.addEventListener('fetch'"), 'sw.js should not clear unrelated caches');
  assertIncludes(checklist, 'FIELD_READY = NO', 'POS_OFFLINE_FIELD_TEST_CHECKLIST.md');
  assertIncludes(checklist, 'NON TESTE', 'POS_OFFLINE_FIELD_TEST_CHECKLIST.md');

  const manualRequired = [
    'installation PWA reelle',
    'coupure reseau reelle',
    'reboot Windows',
    'imprimante physique',
    'mode standalone reel',
  ];

  console.log(JSON.stringify({
    OFFLINE_7_ROUTING_NAVIGATION: 'PASS',
    OFFLINE_7_SELLER_MESSAGES: 'PASS',
    OFFLINE_7_TICKET_FORMATTING: 'PASS',
    OFFLINE_7_WORKSTATION_SETUP_UX: 'PASS',
    OFFLINE_7_AUTOSYNC_RECOVERY_GUARDS: 'PASS',
    OFFLINE_7_TICKET_RENDER_GUARDS: 'PASS',
    OFFLINE_7_MANUAL_TESTS: manualRequired.map((name) => ({ name, status: 'MANUAL_REQUIRED' })),
    FIELD_READY: 'NO',
  }, null, 2));
}

main().catch((error) => {
  console.error(`validate-offline-7 failed: ${error.message}`);
  process.exit(1);
});
