import axios from 'axios';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { authService, AccessibleOrganization, AccessibleSite, AuthUser } from '../services/auth.service';
import { calculateAuthorizationState, getStableDeviceId } from '../modules/offline/offline-bootstrap';
import { readOfflineSnapshot } from '../modules/offline/offline-storage';
import {
  AUTH_SESSION_INVALIDATED_EVENT,
  clearAuthSessionStorage,
  resetAuthInvalidation,
} from './authSession';

const EXPLICIT_LOGOUT_KEY = 'auth.explicitLogout';

type OfflineRestoreCandidate = {
  allowed: boolean;
  reason:
    | 'AUTHORIZED'
    | 'EXPLICIT_LOGOUT'
    | 'MISSING_SNAPSHOT'
    | 'UNAUTHORIZED'
    | 'WORKSTATION_REVOKED'
    | 'DEVICE_MISMATCH'
    | 'USER_MISMATCH';
  user: AuthUser | null;
  expiresAt: string | null;
};

type AuthContextValue = {
  accessToken: string | null;
  currentUser: AuthUser | null;
  permissions: string[];
  availableOrganizations: AccessibleOrganization[];
  availableSites: AccessibleSite[];
  activeOrganization: AccessibleOrganization | null;
  activeSite: AccessibleSite | null;
  loading: boolean;
  offlineAuthenticated: boolean;
  offlineSessionExpiresAt: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  refreshUser: () => Promise<AuthUser | null>;
  refreshContext: () => Promise<void>;
  switchOrganization: (tenantId: string) => Promise<AuthUser>;
  switchSite: (siteId: string) => Promise<AuthUser>;
  inspectOfflineRestore: () => Promise<OfflineRestoreCandidate>;
  restoreOfflineSession: () => Promise<AuthUser | null>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => readStoredUser());
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('accessToken')));
  const [availableOrganizations, setAvailableOrganizations] = useState<AccessibleOrganization[]>(() => readStoredArray('availableOrganizations'));
  const [availableSites, setAvailableSites] = useState<AccessibleSite[]>(() => readStoredArray('availableSites'));
  const [offlineAuthenticated, setOfflineAuthenticated] = useState(false);
  const [offlineSessionExpiresAt, setOfflineSessionExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light';
  }, []);

  useEffect(() => {
    function handleSessionInvalidated() {
      setAccessToken(null);
      setCurrentUser(null);
      setAvailableOrganizations([]);
      setAvailableSites([]);
      setOfflineAuthenticated(false);
      setOfflineSessionExpiresAt(null);
      setLoading(false);
    }

    window.addEventListener(AUTH_SESSION_INVALIDATED_EVENT, handleSessionInvalidated);
    return () => window.removeEventListener(AUTH_SESSION_INVALIDATED_EVENT, handleSessionInvalidated);
  }, []);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    let active = true;
    let previewFallbackTimer: number | null = null;

    if (shouldBypassProfileLoadingForLocalOfflinePreview() && readStoredUser()) {
      previewFallbackTimer = window.setTimeout(() => {
        if (!active) return;
        setLoading(false);
      }, 1200);
    }

    refreshUser().finally(() => {
      if (previewFallbackTimer) {
        window.clearTimeout(previewFallbackTimer);
      }
      if (active) {
        setLoading(false);
      }
    });

    return () => {
      active = false;
      if (previewFallbackTimer) {
        window.clearTimeout(previewFallbackTimer);
      }
    };
  }, [accessToken]);

  async function login(email: string, password: string) {
    try {
      const response = await authService.login(email, password);
      const token = response.data.accessToken;
      localStorage.setItem('accessToken', token);
      resetAuthInvalidation();
      setAccessToken(token);
      clearExplicitLogoutFlag();
      setOfflineAuthenticated(false);
      setOfflineSessionExpiresAt(null);

      const me = await authService.me();
      storeUser(me.data);
      setCurrentUser(me.data);
      await loadContext(me.data);
      return me.data;
    } catch (error) {
      clearAuthSessionStorage();
      setAccessToken(null);
      setCurrentUser(null);
      setAvailableOrganizations([]);
      setAvailableSites([]);
      throw error;
    }
  }

  async function refreshUser() {
    try {
      const response = await authService.me();
      storeUser(response.data);
      setCurrentUser(response.data);
      await loadContext(response.data);
      setOfflineAuthenticated(false);
      setOfflineSessionExpiresAt(null);
      return response.data;
    } catch (error) {
      if (isNetworkError(error)) {
        const restoredUser = await restoreOfflineSession();
        if (restoredUser) {
          return restoredUser;
        }
      }
      clearAuthSessionStorage();
      setAccessToken(null);
      setCurrentUser(null);
      setAvailableOrganizations([]);
      setAvailableSites([]);
      setOfflineAuthenticated(false);
      setOfflineSessionExpiresAt(null);
      return null;
    }
  }

  async function inspectOfflineRestore(): Promise<OfflineRestoreCandidate> {
    if (hasExplicitLogoutFlag()) {
      return { allowed: false, reason: 'EXPLICIT_LOGOUT', user: null, expiresAt: null };
    }

    try {
      const snapshot = await readOfflineSnapshot();
      if (!snapshot.auth || !snapshot.workstation) {
        return { allowed: false, reason: 'MISSING_SNAPSHOT', user: null, expiresAt: null };
      }

      if (snapshot.workstation.status === 'REVOKED') {
        return {
          allowed: false,
          reason: 'WORKSTATION_REVOKED',
          user: null,
          expiresAt: snapshot.auth.offlineAuthorizationExpiresAt ?? null,
        };
      }

      const currentDeviceId = getStableDeviceId();
      if (!snapshot.workstation.deviceId || snapshot.workstation.deviceId !== currentDeviceId) {
        return {
          allowed: false,
          reason: 'DEVICE_MISMATCH',
          user: null,
          expiresAt: snapshot.auth.offlineAuthorizationExpiresAt ?? null,
        };
      }

      const authorizationState = calculateAuthorizationState(snapshot.auth, snapshot.workstation, currentDeviceId);
      if (authorizationState === 'REVOKED') {
        return {
          allowed: false,
          reason: 'WORKSTATION_REVOKED',
          user: null,
          expiresAt: snapshot.auth.offlineAuthorizationExpiresAt ?? null,
        };
      }
      if (authorizationState !== 'AUTHORIZED') {
        return {
          allowed: false,
          reason: 'UNAUTHORIZED',
          user: null,
          expiresAt: snapshot.auth.offlineAuthorizationExpiresAt ?? null,
        };
      }

      const storedUser = readStoredUser();
      if (storedUser?.id && storedUser.id !== snapshot.auth.userId) {
        return {
          allowed: false,
          reason: 'USER_MISMATCH',
          user: null,
          expiresAt: snapshot.auth.offlineAuthorizationExpiresAt ?? null,
        };
      }

      return {
        allowed: true,
        reason: 'AUTHORIZED',
        user: buildOfflineUser(snapshot.auth, storedUser),
        expiresAt: snapshot.auth.offlineAuthorizationExpiresAt ?? null,
      };
    } catch {
      return { allowed: false, reason: 'MISSING_SNAPSHOT', user: null, expiresAt: null };
    }
  }

  async function restoreOfflineSession() {
    const candidate = await inspectOfflineRestore();
    if (!candidate.allowed || !candidate.user) {
      return null;
    }

    storeUser(candidate.user);
    setCurrentUser(candidate.user);
    setOfflineAuthenticated(true);
    setOfflineSessionExpiresAt(candidate.expiresAt);
    return candidate.user;
  }

  function logout() {
    localStorage.setItem(EXPLICIT_LOGOUT_KEY, '1');
    clearAuthSessionStorage();
    setAccessToken(null);
    setCurrentUser(null);
    setAvailableOrganizations([]);
    setAvailableSites([]);
    setOfflineAuthenticated(false);
    setOfflineSessionExpiresAt(null);
  }

  async function refreshContext() {
    if (!localStorage.getItem('accessToken')) return;
    await loadContext(currentUser);
  }

  async function switchOrganization(tenantId: string) {
    const response = await authService.switchOrganization(tenantId);
    applyAuthenticatedSession(response.data.accessToken, response.data.user);
    setAvailableSites(response.data.sites);
    storeArray('availableSites', response.data.sites);
    await loadOrganizations();
    return response.data.user;
  }

  async function switchSite(siteId: string) {
    const response = await authService.switchSite(siteId);
    applyAuthenticatedSession(response.data.accessToken, response.data.user);
    setAvailableSites(response.data.sites);
    storeArray('availableSites', response.data.sites);
    await loadOrganizations();
    return response.data.user;
  }

  function applyAuthenticatedSession(token: string, user: AuthUser) {
    localStorage.setItem('accessToken', token);
    resetAuthInvalidation();
    setAccessToken(token);
    storeUser(user);
    setCurrentUser(user);
  }

  async function loadOrganizations() {
    const organizations = (await authService.organizations()).data;
    setAvailableOrganizations(organizations);
    storeArray('availableOrganizations', organizations);
    return organizations;
  }

  async function loadContext(user: AuthUser | null) {
    const organizations = await loadOrganizations();
    const tenantId = user?.tenantId ?? user?.activeTenantId ?? organizations[0]?.id;
    if (!tenantId) {
      setAvailableSites([]);
      storeArray('availableSites', []);
      return;
    }
    const sites = (await authService.sites(tenantId)).data;
    setAvailableSites(sites);
    storeArray('availableSites', sites);
  }

  const value = useMemo<AuthContextValue>(() => ({
    accessToken,
    currentUser,
    permissions: currentUser?.permissions ?? [],
    availableOrganizations,
    availableSites,
    activeOrganization: availableOrganizations.find((organization) => organization.id === currentUser?.tenantId) ?? null,
    activeSite: availableSites.find((site) => site.id === currentUser?.siteId) ?? null,
    loading,
    offlineAuthenticated,
    offlineSessionExpiresAt,
    login,
    refreshUser,
    refreshContext,
    switchOrganization,
    switchSite,
    inspectOfflineRestore,
    restoreOfflineSession,
    logout,
  }), [accessToken, currentUser, availableOrganizations, availableSites, loading, offlineAuthenticated, offlineSessionExpiresAt]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

function readStoredUser() {
  const raw = localStorage.getItem('currentUser');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function storeUser(user: AuthUser) {
  localStorage.setItem('currentUser', JSON.stringify(user));
  localStorage.setItem('permissions', JSON.stringify(user.permissions ?? []));
}

function storeArray(key: string, value: unknown[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readStoredArray<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildOfflineUser(
  authSnapshot: Awaited<ReturnType<typeof readOfflineSnapshot>>['auth'],
  storedUser: AuthUser | null,
): AuthUser {
  if (!authSnapshot) {
    throw new Error('OFFLINE_AUTH_SNAPSHOT_MISSING');
  }

  return {
    id: authSnapshot.userId,
    tenantId: authSnapshot.tenantId,
    siteId: authSnapshot.siteId ?? undefined,
    fullName: authSnapshot.displayName,
    email: storedUser?.email,
    role: authSnapshot.role,
    permissions: authSnapshot.permissions ?? [],
  };
}

function hasExplicitLogoutFlag() {
  return localStorage.getItem(EXPLICIT_LOGOUT_KEY) === '1';
}

function clearExplicitLogoutFlag() {
  localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
}

function isNetworkError(error: unknown) {
  if (!navigator.onLine) return true;
  if (!axios.isAxiosError(error)) return false;
  return !error.response;
}

function shouldBypassProfileLoadingForLocalOfflinePreview() {
  if (typeof window === 'undefined') return false;
  const isOfflineRoute = window.location.pathname.startsWith('/offline/');
  const isLocalPreviewOrigin = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
    && ['4173', '5173'].includes(window.location.port);
  return isOfflineRoute && isLocalPreviewOrigin;
}
