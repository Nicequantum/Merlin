import * as Sentry from '@sentry/nextjs';
import { replayIntegration } from '@sentry/browser';
import { getSentryDsn } from '@/lib/sentryInit';

const dsn = getSentryDsn();
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [replayIntegration()],
    debug: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;