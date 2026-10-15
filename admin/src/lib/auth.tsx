'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'staff';
  permissions: string[];
};

type AuthState = {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
  can: (module: string) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * No localStorage for the token (httpOnly cookie now) or the user object —
 * the session lives server-side; this always re-derives `user` from
 * /api/admin/auth/me on mount, which middleware.ts has already gated (no
 * page renders at all without a valid cookie, except /login).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api<AdminUser>('/api/admin/auth/me')
      .then((res) => {
        if (res.success && res.data) setUser(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      async login(email, password) {
        const res = await api<{ user: AdminUser }>('/api/admin/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        if (!res.success || !res.data) return res.message || 'Login failed';
        setUser(res.data.user);
        return null;
      },
      logout() {
        setUser(null);
        void api('/api/admin/auth/logout', { method: 'POST' });
      },
      can(module) {
        if (!user) return false;
        if (user.role === 'super_admin') return true;
        return user.permissions.includes('*') || user.permissions.includes(module);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
