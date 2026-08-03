// Sentry must init before anything else is required, so its instrumentation
// can hook into modules (http, pg, ...) as they're first loaded.
import * as Sentry from '@sentry/node';

Sentry.init({
  // Unset (local dev without a DSN) makes the SDK a safe no-op — nothing is
  // sent, nothing throws.
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,
});

import { start } from './server';

// Start the server
start().catch((error) => {
  Sentry.captureException(error);
  console.error('Failed to start server:', error);
  process.exit(1);
});
