import Fastify, { FastifyInstance } from 'fastify';
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