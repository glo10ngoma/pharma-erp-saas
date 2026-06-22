import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { authService, AuthUser } from '../services/auth.service';

type AuthContextValue = {
  accessToken: string | null;
  currentUser: AuthUser | null;
  permissions: string[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => readStoredUser());
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('accessToken')));

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

      const me = await authService.me();
      storeUser(me.data);
      setCurrentUser(me.data);
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
      return response.data;
    } catch {
      clearAuthStorage();
      setAccessToken(null);
      setCurrentUser(null);
      return null;
    }
  }

  function logout() {
    clearAuthStorage();
    setAccessToken(null);
    setCurrentUser(null);
  }

  const value = useMemo<AuthContextValue>(() => ({
    accessToken,
    currentUser,
    permissions: currentUser?.permissions ?? [],
    loading,
    login,
    refreshUser,
    logout,
  }), [accessToken, currentUser, loading]);

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
