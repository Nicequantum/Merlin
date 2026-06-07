'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { TechnicianSession } from '@/types';

export function useSession() {
  const [session, setSession] = useState<TechnicianSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { session: s } = await api.me();
      setSession(s);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { session: s } = await api.login(email, password);
    setSession(s);
    return s;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setSession(null);
  }, []);

  const acceptConsent = useCallback(async () => {
    const { consentAt } = await api.acceptConsent();
    setSession((prev) => (prev ? { ...prev, consentAt } : prev));
  }, []);

  return { session, loading, login, logout, acceptConsent, refresh };
}