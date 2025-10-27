import Fastify, { FastifyInstance } from 'fastify';
import { MockDatabase } from '../../tests/mocks/database.mock';
import { authRoutes } from '../modules/auth/auth.routes';

export async function buildTestServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: false // Disable logging for tests
  });

  // Add a simple test route first
  server.get('/test', async (request, reply) => {
    return { message: 'Test route works' };
  });

  // Don't create database or register auth routes yet to isolate the issue
  // Create mock database for tests
  // const database = new MockDatabase();
  // await database.connect();

  // Register auth routes for testing with mock database
  // await server.register(authRoutes, {
  //   prefix: '/api/v1/auth',
  //   database
  // });

  return server;
}