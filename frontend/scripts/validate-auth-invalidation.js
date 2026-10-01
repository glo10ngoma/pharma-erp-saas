const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const AUTH_SESSION_PATH = path.join(REPO_ROOT, 'frontend', 'src', 'auth', 'authSession.ts');
const API_ERROR_PATH = path.join(REPO_ROOT, 'frontend', 'src', 'services', 'apiError.ts');

function loadTsModule(filePath, moduleStubs = {}, globals = {}) {
  const source = fs.readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  }).outputText;

  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    require(specifier) {
      if (Object.prototype.hasOwnProperty.call(moduleStubs, specifier)) return moduleStubs[specifier];
      throw new Error(`Stub missing for ${specifier} while loading ${filePath}`);
    },
    __filename: filePath,
    __dirname: path.dirname(filePath),
    console,
    ...globals,
  };
  vm.runInNewContext(output, context, { filename: filePath });
  return module.exports;
}

function createStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
    has: (key) => data.has(key),
  };
}

function createAxiosError(status, code) {
  return {
    isAxiosError: true,
    response: status ? {
      status,
      data: code ? { message: code } : {},
    } : undefined,
  };
}

const localStorage = createStorage();
const sessionStorage = createStorage();
let redirectCount = 0;
let eventCount = 0;
const window = {
  location: {
    pathname: '/dashboard',
    assign(pathname) {
      redirectCount += 1;
      this.pathname = pathname;
    },
  },
  dispatchEvent(event) {
    eventCount += 1;
    this.lastEvent = event;
  },
};

class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

const axiosStub = {
  isAxiosError: (error) => Boolean(error?.isAxiosError),
};

const authSession = loadTsModule(AUTH_SESSION_PATH, { axios: axiosStub }, {
  localStorage,
  sessionStorage,
  window,
  CustomEvent,
});
const apiError = loadTsModule(API_ERROR_PATH);

localStorage.setItem('accessToken', 'valid-token');
localStorage.setItem('currentUser', '{"id":"u1"}');
localStorage.setItem('permissions', '["sales.read"]');
localStorage.setItem('offline.pos.snapshot', '{"articles":1}');
localStorage.setItem('offline.pos.drafts', '[{"id":"draft-1"}]');
localStorage.setItem('offline.stock.cache', '{"articleId":"a1"}');

assert.strictEqual(authSession.isAuthTokenError(createAxiosError(200, null)), false);
assert.strictEqual(localStorage.getItem('accessToken'), 'valid-token');
assert.strictEqual(redirectCount, 0);

assert.strictEqual(authSession.isAuthTokenError(createAxiosError(401, 'AUTH_TOKEN_INVALID')), true);
assert.strictEqual(authSession.invalidateAuthSession(), true);
assert.strictEqual(localStorage.getItem('accessToken'), null);
assert.strictEqual(localStorage.getItem('currentUser'), null);
assert.strictEqual(localStorage.getItem('permissions'), null);
assert.strictEqual(localStorage.getItem('offline.pos.snapshot'), '{"articles":1}');
assert.strictEqual(localStorage.getItem('offline.pos.drafts'), '[{"id":"draft-1"}]');
assert.strictEqual(localStorage.getItem('offline.stock.cache'), '{"articleId":"a1"}');
assert.strictEqual(window.location.pathname, '/login');
assert.strictEqual(redirectCount, 1);
assert.strictEqual(eventCount, 1);
assert.strictEqual(authSession.getSessionExpiredMessage(), authSession.AUTH_SESSION_EXPIRED_MESSAGE);
assert.strictEqual(
  apiError.apiErrorMessage(createAxiosError(401, 'AUTH_TOKEN_INVALID')),
  authSession.AUTH_SESSION_EXPIRED_MESSAGE,
);

for (let index = 0; index < 10; index += 1) {
  assert.strictEqual(authSession.isAuthTokenError(createAxiosError(401, 'AUTH_TOKEN_INVALID')), true);
  assert.strictEqual(authSession.invalidateAuthSession(), false);
}
assert.strictEqual(redirectCount, 1);
assert.strictEqual(eventCount, 1);

authSession.resetAuthInvalidation();
window.location.pathname = '/profile';
localStorage.setItem('accessToken', 'expired-token');
assert.strictEqual(authSession.isAuthTokenError(createAxiosError(401, 'AUTH_TOKEN_REQUIRED')), true);
assert.strictEqual(authSession.invalidateAuthSession(), true);
assert.strictEqual(window.location.pathname, '/login');
assert.strictEqual(redirectCount, 2);
assert.strictEqual(eventCount, 2);

assert.strictEqual(authSession.isAuthTokenError(createAxiosError(403, 'PERMISSION_DENIED')), false);
assert.strictEqual(authSession.isAuthTokenError(createAxiosError(500, 'INTERNAL_SERVER_ERROR')), false);
assert.strictEqual(authSession.isAuthTokenError({ isAxiosError: true }), false);

authSession.resetAuthInvalidation();
localStorage.setItem('accessToken', 'new-token');
localStorage.setItem('currentUser', '{"id":"u2"}');
localStorage.setItem('permissions', '["articles.read"]');
assert.strictEqual(localStorage.getItem('accessToken'), 'new-token');
assert.strictEqual(authSession.getSessionExpiredMessage(), null);
assert.strictEqual(authSession.isAuthTokenError(createAxiosError(200, null)), false);

console.log('AUTH_INVALIDATION_REGRESSION=PASS');
console.log('VALID_TOKEN_TEST=PASS');
console.log('INVALID_TOKEN_TEST=PASS');
console.log('CONCURRENT_401_TEST=PASS');
console.log('AUTH_ME_401_TEST=PASS');
console.log('RELOGIN_TEST=PASS');
console.log('403_TEST=PASS');
console.log('500_TEST=PASS');
console.log('OFFLINE_NETWORK_TEST=PASS');
console.log('OFFLINE_DATA_PRESERVED=PASS');
