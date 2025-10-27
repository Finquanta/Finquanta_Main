import Fastify, { FastifyInstance } from 'fastify';

export async function buildMinimalTestServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: false
  });

  // Add simple test route - NO HOOKS, NO PLUGINS
  server.get('/test', async (request, reply) => {
    return { message: 'Test route works' };
  });

  return server;
}