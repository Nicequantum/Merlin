'use client';

console.log('[Merlin] BenzTechApp module evaluated');

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { LoginView } from '@/components/LoginView';
import {
  acceptConsentSession,
  acceptLegalDisclaimerSession,
  fetchCurrentSession,
  loginWithCredentials,
  logoutSession,
} from '@/lib/loginSession';
import { cacheLegalDisclaimerLocally } from '@/lib/legalDisclaimer';
import type { TechnicianSession } from '@/types';

const ConsentModal = dynamic(
  () => import('@/components/ConsentModal').then((m) => m.ConsentModal),
  { ssr: false }
);

const LegalDisclaimerModal = dynamic(
  () => import('@/components/LegalDisclaimerModal').then((m) => m.LegalDisclaimerModal),
  { ssr: false }
);

const BenzTechAuthenticatedApp = dynamic(
  () =>
    import('@/components/BenzTechAuthenticatedApp').then((m) => m.BenzTechAuthenticatedApp),
  { ssr: false }
);

export function BenzTechApp() {
  console.log('[Merlin] BenzTechApp render start');

  const [session, setSession] = useState<TechnicianSession | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);
  const [legalDisclaimerLoading, setLegalDisclaimerLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    console.log('[Merlin] BenzTechApp session check starting');

    fetchCurrentSession()
      .then((existing) => {
        if (cancelled) return;
        console.log('[Merlin] BenzTechApp session check result', existing ? 'authenticated' : 'none');
        if (existing) setSession(existing);
      })
      .catch((error: unknown) => {
        console.error('[Merlin] BenzTechApp session check failed', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (d7Number: string, password: string) => {
    console.log('[Merlin] BenzTechApp login attempt');
    const nextSession = await loginWithCredentials(d7Number, password);
    setSession(nextSession);
    return nextSession;
  }, []);

  const logout = useCallback(async () => {
    await logoutSession();
    setSession(null);
  }, []);

  if (!session) {
    console.log('[Merlin] BenzTechApp → rendering LoginView (no session)');
    return <LoginView onLogin={login} />;
  }

  if (!session.consentAt) {
    console.log('[Merlin] BenzTechApp → rendering ConsentModal');
    return (
      <ConsentModal
        loading={consentLoading}
        onAccept={async () => {
          setConsentLoading(true);
          try {
            const consentAt = await acceptConsentSession();
            setSession((prev) => (prev ? { ...prev, consentAt } : prev));
          } catch (error: unknown) {
            console.error('[Merlin] Consent acceptance failed', error);
          } finally {
            setConsentLoading(false);
          }
        }}
      />
    );
  }

  if (!session.legalDisclaimerAt) {
    console.log('[Merlin] BenzTechApp → rendering LegalDisclaimerModal');
    return (
      <LegalDisclaimerModal
        loading={legalDisclaimerLoading}
        onAccept={async () => {
          setLegalDisclaimerLoading(true);
          try {
            const legalDisclaimerAt = await acceptLegalDisclaimerSession();
            setSession((prev) => {
              if (!prev) return prev;
              cacheLegalDisclaimerLocally(prev.technicianId);
              return { ...prev, legalDisclaimerAt };
            });
          } catch (error: unknown) {
            console.error('[Merlin] Legal disclaimer acceptance failed', error);
          } finally {
            setLegalDisclaimerLoading(false);
          }
        }}
      />
    );
  }

  console.log('[Merlin] BenzTechApp → rendering BenzTechAuthenticatedApp');
  return <BenzTechAuthenticatedApp session={session} onLogout={logout} />;
}