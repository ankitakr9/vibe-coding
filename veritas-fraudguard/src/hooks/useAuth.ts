import { useCallback, useEffect, useState } from 'react';
import type { AuthUser, UserRole } from '../shared/types';

const TOKEN_STORAGE_KEY = 'veritas_fraudguard_jwt';

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const clearSession = useCallback(() => {
    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;
    if (!token) {
      setUser(null);
      setAuthLoading(false);
      return;
    }

    setAuthLoading(true);
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Session invalid');
        return (await res.json()) as { user: AuthUser };
      })
      .then((data) => {
        if (active) {
          setUser(data.user);
          setAuthLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          clearSession();
          setAuthLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token, clearSession]);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as { user?: AuthUser; token?: string; error?: string };
    if (!res.ok || !data.token || !data.user) {
      throw new Error(data.error ?? 'Sign-in failed');
    }
    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    } catch {
      // ignore
    }
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(
    async (input: {
      fullName: string;
      email: string;
      password: string;
      role: UserRole;
    }): Promise<AuthUser> => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as { user?: AuthUser; token?: string; error?: string };
      if (!res.ok || !data.token || !data.user) {
        throw new Error(data.error ?? 'Registration failed');
      }
      try {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      } catch {
        // ignore
      }
      setToken(data.token);
      setUser(data.user);
      return data.user;
    },
    []
  );

  return {
    token,
    user,
    authLoading,
    login,
    register,
    logout: clearSession,
  };
}
