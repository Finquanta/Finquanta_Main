/**
 * Sentry for the browser. Unset NEXT_PUBLIC_SENTRY_DSN (local dev) makes the
 * SDK a safe no-op.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
