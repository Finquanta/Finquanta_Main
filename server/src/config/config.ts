import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  PORT: process.env.PORT || '3001',
  HOST: process.env.HOST || '0.0.0.0',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Database (if needed later)
  DATABASE_URL: process.env.DATABASE_URL,

  // JWT (if needed later)
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',

  // API Keys
  API_KEY: process.env.API_KEY,
};

/**
 * Fail fast at boot. In production we refuse to start without the real secrets:
 * a missing JWT secret would otherwise silently fall back to a hardcoded dev
 * value (see auth/jwt.ts, server.ts), making access/refresh tokens forgeable.
 * Called from server.ts before listen(). No-op outside production.
 */
export function assertConfig(): void {
  assertBetaConfig();
  if (config.NODE_ENV !== 'production') return;

  const required: Record<string, string | undefined> = {
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  };
  const problems = Object.entries(required)
    .filter(([, v]) => !v || !v.trim())
    .map(([k]) => `${k} is not set`);

  // Never let the known dev-only fallback secrets reach production.
  for (const k of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    if (process.env[k]?.includes('development-only')) {
      problems.push(`${k} is using the insecure development default`);
    }
  }

  if (problems.length) {
    throw new Error(
      `Refusing to start in production — fix these environment variables:\n  - ${problems.join('\n  - ')}`
    );
  }
}

/**
 * The beta API (beta.finquanta.ai) runs with NODE_ENV=production — it needs the
 * SSL and the checks above — and that switches off every development-only safety
 * net: the dev database guard, the lifecycle send gate. These stand in for them.
 *
 * Refuses to start rather than warn. A beta API with a live Stripe key can
 * charge real cards; one pointed at production's database is not a test site.
 *
 * Also refuses the reverse mistake: an API serving a beta address without
 * BETA_SITE=true would skip every check here.
 */
export function assertBetaConfig(env: NodeJS.ProcessEnv = process.env): void {
  const appHost = hostOf(env.APP_URL);

  if (env.BETA_SITE !== 'true') {
    if (appHost?.startsWith('beta.')) {
      throw new Error(
        'Refusing to start: APP_URL is a beta address but BETA_SITE is not "true", so the beta safety checks would not run.'
      );
    }
    return;
  }

  const problems: string[] = [];

  const stripeKey = env.STRIPE_SECRET_KEY?.trim();
  if (stripeKey && !stripeKey.startsWith('sk_test_')) {
    problems.push('STRIPE_SECRET_KEY must be a test-mode key (sk_test_...)');
  }

  // Neon gives one database two hostnames, with and without `-pooler`.
  const prodHost = normaliseDbHost(env.PRODUCTION_DB_HOST);
  const dbHost = normaliseDbHost(hostOf(env.DATABASE_URL));
  if (!prodHost) {
    problems.push('PRODUCTION_DB_HOST is not set — without it nothing stops DATABASE_URL naming the production database');
  } else if (dbHost === prodHost) {
    problems.push('DATABASE_URL points at the production database');
  }

  // Beta runs no scheduled jobs and receives no mail; either secret set means a
  // production value was copied across.
  for (const key of ['CRON_SECRET', 'RESEND_INBOUND_SIGNING_SECRET'] as const) {
    if (env[key]?.trim()) problems.push(`${key} must not be set on beta`);
  }

  if (appHost && !appHost.startsWith('beta.') && appHost !== 'localhost') {
    problems.push(`APP_URL is ${appHost}, which is not a beta address`);
  }

  if (problems.length) {
    throw new Error(
      `Refusing to start as beta — fix these environment variables:\n  - ${problems.join('\n  - ')}`
    );
  }
}

function hostOf(url: string | undefined): string | undefined {
  if (!url?.trim()) return undefined;
  try {
    return new URL(url.trim()).hostname.toLowerCase() || undefined;
  } catch {
    return undefined;
  }
}

function normaliseDbHost(host: string | undefined): string | undefined {
  const h = host?.trim().toLowerCase();
  return h ? h.replace('-pooler.', '.') : undefined;
}