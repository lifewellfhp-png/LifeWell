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

export type LoginResult = { error: string | null; mfaRequired?: boolean; mfaToken?: string };

type AuthState = {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  /** Step 2 of login when the account has MFA enabled — exactly one of code/recoveryCode. */
  verifyMfa: (mfaToken: string, code?: string, recoveryCode?: string) => Promise<string | null>;
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
        const res = await api<{ user: AdminUser; mfaRequired?: boolean; mfaToken?: string }>(
          '/api/admin/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          }
        );
        if (!res.success || !res.data) return { error: res.message || 'Login failed' };
        if (res.data.mfaRequired && res.data.mfaToken) {
          return { error: null, mfaRequired: true, mfaToken: res.data.mfaToken };
        }
        setUser(res.data.user);
        return { error: null };
      },
      async verifyMfa(mfaToken, code, recoveryCode) {
        const res = await api<{ user: AdminUser }>('/api/admin/auth/mfa-verify', {
          method: 'POST',
          body: JSON.stringify({ mfa_token: mfaToken, code, recovery_code: recoveryCode }),
        });
        if (!res.success || !res.data) return res.message || 'Verification failed';
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
