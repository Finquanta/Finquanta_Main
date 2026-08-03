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