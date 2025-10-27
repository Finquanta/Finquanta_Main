import { FastifyInstance } from 'fastify';
import healthRoutes from './health';
import apiRoutes from './api';

export default async function routes(fastify: FastifyInstance): Promise<void> {
  // Register health check routes
  await fastify.register(healthRoutes, { prefix: '/health' });

  // Register API routes
  await fastify.register(apiRoutes, { prefix: '/api' });
}

export { healthRoutes, apiRoutes };