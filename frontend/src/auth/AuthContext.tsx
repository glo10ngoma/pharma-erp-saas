import axios from 'axios';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { authService, AuthUser } from '../services/auth.service';
import { calculateAuthorizationState, getStableDeviceId } from '../modules/offline/offline-bootstrap';
import { readOfflineSnapshot } from '../modules/offline/offline-storage';

const EXPLICIT_LOGOUT_KEY = 'auth.explicitLogout';

type OfflineRestoreCandidate = {
  allowed: boolean;
  reason:
    | 'VALID'
    | 'EXPLICIT_LOGOUT'
    | 'MISSING_SNAPSHOT'
    | 'AUTH_EXPIRED'
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
  loading: boolean;
  offlineAuthenticated: boolean;
  offlineSessionExpiresAt: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  refreshUser: () => Promise<AuthUser | null>;
  inspectOfflineRestore: () => Promise<OfflineRestoreCandidate>;
  restoreOfflineSession: () => Promise<AuthUser | null>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => readStoredUser());
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('accessToken')));
  const [offlineAuthenticated, setOfflineAuthenticated] = useState(false);
  const [offlineSessionExpiresAt, setOfflineSessionExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light';
  }, []);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    refreshUser().finally(() => setLoading(false));
  }, [accessToken]);

  async function login(email: string, password: string) {
    try {
      const response = await authService.login(email, password);
      const token = response.data.accessToken;
      localStorage.setItem('accessToken', token);
      setAccessToken(token);
      clearExplicitLogoutFlag();
      setOfflineAuthenticated(false);
      setOfflineSessionExpiresAt(null);

      const me = await authService.me();
      storeUser(me.data);
      setCurrentUser(me.data);
      return me.data;
    } catch (error) {
      clearAuthStorage();
      setAccessToken(null);
      setCurrentUser(null);
      throw error;
    }
  }

  async function refreshUser() {
    try {
      const response = await authService.me();
      storeUser(response.data);
      setCurrentUser(response.data);
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
      clearAuthStorage();
      setAccessToken(null);
      setCurrentUser(null);
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

      if (calculateAuthorizationState(snapshot.auth) === 'EXPIRED') {
        return {
          allowed: false,
          reason: 'AUTH_EXPIRED',
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
        reason: 'VALID',
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
    clearAuthStorage();
    setAccessToken(null);
    setCurrentUser(null);
    setOfflineAuthenticated(false);
    setOfflineSessionExpiresAt(null);
  }

  const value = useMemo<AuthContextValue>(() => ({
    accessToken,
    currentUser,
    permissions: currentUser?.permissions ?? [],
    loading,
    offlineAuthenticated,
    offlineSessionExpiresAt,
    login,
    refreshUser,
    inspectOfflineRestore,
    restoreOfflineSession,
    logout,
  }), [accessToken, currentUser, loading, offlineAuthenticated, offlineSessionExpiresAt]);

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

function clearAuthStorage() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('permissions');
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
