import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import { config } from '@/config/config';
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
});

// Enable CORS
server.register(fastifyCors, {
  origin: config.CORS_ORIGIN.split(',').map(s => s.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

server.register(fastifyJwt, {
  secret: process.env.JWT_ACCESS_SECRET || 'access-secret-key-for-development-only'
});

// Receipt uploads (PDF/images) — cap at 5MB
server.register(fastifyMultipart, {
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
});

// Register routes
server.register(routes);

// Start server
const start = async (): Promise<void> => {
  try {
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
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  server.log.error({ error }, 'Uncaught Exception');
  process.exit(1);
});

export { server, start };
