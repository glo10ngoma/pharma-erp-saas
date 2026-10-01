import axios from 'axios';

export const AUTH_SESSION_EXPIRED_MESSAGE = 'Votre session a expiré. Veuillez vous reconnecter.';
export const AUTH_SESSION_EXPIRED_STORAGE_KEY = 'auth.sessionExpiredMessage';
export const AUTH_SESSION_INVALIDATED_EVENT = 'pharmaerp:auth-session-invalidated';

const AUTH_CODES = new Set(['AUTH_TOKEN_INVALID', 'AUTH_TOKEN_REQUIRED']);

let authInvalidationInProgress = false;

export function isAuthTokenError(error: unknown) {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  const data = error.response?.data as { message?: unknown; error?: unknown } | undefined;
  const code = typeof data?.message === 'string'
    ? data.message
    : typeof data?.error === 'string'
      ? data.error
      : null;
  return status === 401 && Boolean(code && AUTH_CODES.has(code));
}

export function clearAuthSessionStorage() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('permissions');
}

export function resetAuthInvalidation() {
  authInvalidationInProgress = false;
  sessionStorage.removeItem(AUTH_SESSION_EXPIRED_STORAGE_KEY);
}

export function getSessionExpiredMessage() {
  return sessionStorage.getItem(AUTH_SESSION_EXPIRED_STORAGE_KEY);
}

export function consumeSessionExpiredMessage() {
  const message = getSessionExpiredMessage();
  sessionStorage.removeItem(AUTH_SESSION_EXPIRED_STORAGE_KEY);
  return message;
}

export function invalidateAuthSession() {
  if (authInvalidationInProgress) return false;
  authInvalidationInProgress = true;

  clearAuthSessionStorage();
  sessionStorage.setItem(AUTH_SESSION_EXPIRED_STORAGE_KEY, AUTH_SESSION_EXPIRED_MESSAGE);
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_INVALIDATED_EVENT, {
    detail: { message: AUTH_SESSION_EXPIRED_MESSAGE },
  }));

  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }

  return true;
}
