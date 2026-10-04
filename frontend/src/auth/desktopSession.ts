import { clearAuthSessionStorage } from './authSession';

const DESKTOP_FRESH_LAUNCH_PARAM = 'desktopFreshLaunch';
const DESKTOP_SHELL_SESSION_KEY = 'auth.desktopShell';
const DESKTOP_FRESH_LAUNCH_SESSION_KEY = 'auth.desktopFreshLaunch';

export function initializeDesktopFreshLaunchSession() {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  if (params.get(DESKTOP_FRESH_LAUNCH_PARAM) !== '1') return;

  clearAuthSessionStorage();
  sessionStorage.setItem(DESKTOP_SHELL_SESSION_KEY, '1');
  sessionStorage.setItem(DESKTOP_FRESH_LAUNCH_SESSION_KEY, '1');
}

export function isDesktopShellSession() {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(DESKTOP_SHELL_SESSION_KEY) === '1';
}

export function isDesktopFreshLaunchSession() {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(DESKTOP_FRESH_LAUNCH_SESSION_KEY) === '1';
}

export function completeDesktopFreshLaunchLogin() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(DESKTOP_FRESH_LAUNCH_SESSION_KEY);
}
