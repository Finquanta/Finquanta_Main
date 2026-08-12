import Fastify, { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import * as Sentry from '@sentry/node';
import { config, assertConfig } from '@/config/config';
import routes from '@/routes';

const server: FastifyInstance = Fastify({
  logger: {
    level: config.LOG_LEVEL,
    transport: config.isDevelopment ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
  /**
   * Render (and Vercel proxying) sit in front of us; trust X-Forwarded-For so
   * rate limiting and logging key on the real client IP, not the proxy's.
   *
   * Left as `true` ON PURPOSE, despite `true` meaning "believe the leftmost
   * X-Forwarded-For entry" — which a caller can write themselves.
   *
   * Switching to a hop count would change `request.ip`, and auth.controller
   * hands that value to Cloudflare Turnstile as `remoteip` on every login and
   * signup. verifyTurnstile fails CLOSED, so if the hop count is wrong for
   * Render's actual chain the failure is "nobody can sign in", not "a counter
   * is off". That is not a change to make without reading real production
   * logs first.
   *
   * The one place the spoofable value actually mattered — the anonymous Finna
   * spend cap — now derives its key independently. See ai-usage.routes.ts.
   */
  trustProxy: true,
  // apiRoutes runs ~20 sequential ensureSchema() migrations against Neon at
  // boot; a cold serverless compute can push that past Fastify's 10s default,
  // aborting an otherwise-healthy boot. Give it real headroom.
  pluginTimeout: 30000,
});

// Enable CORS
server.register(fastifyCors, {
  origin: config.CORS_ORIGIN.split(',').map(s => s.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Business-Id'],
});

server.register(fastifyJwt, {
  secret: process.env.JWT_ACCESS_SECRET || 'access-secret-key-for-development-only'
});

// Global rate limit per client IP. Generous enough for a dashboard that fans out
// several API calls per page; auth endpoints tighten this to a few per minute via
// their own route config (see auth.routes.ts). In-memory store — fine for a
// single instance; swap in Redis if the backend is ever horizontally scaled.
server.register(fastifyRateLimit, {
  global: true,
  max: 300,
  timeWindow: '1 minute',
  // The plugin THROWS whatever this returns (see @fastify/rate-limit's
  // onRequestAbortHandler), so it must be a real Error carrying .statusCode —
  // a plain object has no statusCode/message and falls through the global
  // error handler as a bare 500.
  errorResponseBuilder: (_req, context) => {
    const err = new Error(`Too many requests — slow down and try again in ${Math.ceil(context.ttl / 1000)}s.`);
    (err as Error & { statusCode: number }).statusCode = context.statusCode;
    return err;
  },
});

// Receipt uploads (PDF/images) — cap at 10MB
server.register(fastifyMultipart, {
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

// Security response headers on every reply. A tight, explicit set for a JSON
// API (rather than helmet, whose defaults target HTML apps). HSTS is production
// only — it's meaningless (and undesirable) over plain-HTTP localhost.
server.addHook('onSend', async (_request, reply, payload) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'no-referrer');
  reply.header('X-DNS-Prefetch-Control', 'off');
  reply.header('Cross-Origin-Opener-Policy', 'same-origin');
  reply.header('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), browsing-topics=()');
  if (config.isProduction) {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  reply.removeHeader('X-Powered-By');
  return payload;
});

// Central error handler. Server-side we log the full error; the client gets a
// safe message. 5xx never leaks internals (stack traces, DB errors) in
// production. Client errors (4xx: validation, rate-limit, auth) relay their
// message, which is caller-safe by construction.
server.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
  const statusCode = error.statusCode ?? 500;
  request.log.error({ err: error, reqId: request.id }, error.message);
  if (statusCode >= 500) {
    // Only genuine server faults go to Sentry — 4xx (validation, rate-limit,
    // bad auth) are expected traffic, not bugs worth alerting on.
    Sentry.captureException(error);
    return reply.status(500).send({
      success: false,
      error: config.isProduction ? 'Internal server error' : error.message,
    });
  }
  return reply.status(statusCode).send({ success: false, error: error.message });
});

// Register routes
server.register(routes);

// Start server
const start = async (): Promise<void> => {
  try {
    // Refuse to boot in production with missing/weak secrets.
    assertConfig();

    const port = Number(config.PORT) || 3000;
    const host = config.HOST || '0.0.0.0';

    await server.listen({ port, host });
    server.log.info(`🚀 Server listening on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  server.log.info('📴 Received SIGINT, shutting down gracefully...');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  server.log.info('📴 Received SIGTERM, shutting down gracefully...');
  await server.close();
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  server.log.error({ promise, reason }, 'Unhandled Rejection');
  Sentry.captureException(reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  server.log.error({ error }, 'Uncaught Exception');
  Sentry.captureException(error);
  process.exit(1);
});

export { server, start };
