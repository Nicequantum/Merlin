'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConsentModal } from '@/components/ConsentModal';
import { LegalDisclaimerModal } from '@/components/LegalDisclaimerModal';
import { LoginView } from '@/components/LoginView';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useSession } from '@/hooks/useSession';

const BenzTechAuthenticatedApp = dynamic(
  () =>
    import('@/components/BenzTechAuthenticatedApp').then((m) => m.BenzTechAuthenticatedApp),
  {
    loading: () => (
      <LoadingScreen
        label="Starting Merlin"
        sublabel="Loading warranty documentation tools…"
      />
    ),
    ssr: false,
  }
);

export function BenzTechApp() {
  const { session, loading: sessionLoading, login, logout, acceptConsent, acceptLegalDisclaimer } =
    useSession();
  const [consentLoading, setConsentLoading] = useState(false);
  const [legalDisclaimerLoading, setLegalDisclaimerLoading] = useState(false);

  if (sessionLoading) {
    return <LoadingScreen label="Starting Merlin" sublabel="Verifying your session..." />;
  }

  if (!session) {
    return <LoginView onLogin={login} />;
  }

  if (!session.consentAt) {
    return (
      <ConsentModal
        loading={consentLoading}
        onAccept={async () => {
          setConsentLoading(true);
          try {
            await acceptConsent();
          } catch (error: unknown) {
            console.error('[Merlin] Consent acceptance failed', error);
            toast.error(error instanceof Error ? error.message : 'Could not save consent — try again');
          } finally {
            setConsentLoading(false);
          }
        }}
      />
    );
  }

  if (!session.legalDisclaimerAt) {
    return (
      <LegalDisclaimerModal
        loading={legalDisclaimerLoading}
        onAccept={async () => {
          setLegalDisclaimerLoading(true);
          try {
            await acceptLegalDisclaimer();
          } catch (error: unknown) {
            console.error('[Merlin] Legal disclaimer acceptance failed', error);
            toast.error(
              error instanceof Error ? error.message : 'Could not save legal acknowledgment — try again'
            );
          } finally {
            setLegalDisclaimerLoading(false);
          }
        }}
      />
    );
  }

  return <BenzTechAuthenticatedApp session={session} onLogout={logout} />;
}