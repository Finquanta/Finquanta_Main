import Fastify, { FastifyInstance } from 'fastify';
import { MockDatabase } from '../../tests/mocks/database.mock';
import { authRoutes } from '../modules/auth/auth.routes';

export async function buildTestServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: false // Disable logging for tests
  });

  // Add schema compiler to handle validation
  server.setValidatorCompiler(({ schema }) => {
    return (data: any) => {
      // Basic validation for testing - type cast for accessing schema properties
      const schemaObj = schema as any;

      if (schemaObj.type === 'object' && schemaObj.required) {
        for (const field of schemaObj.required) {
          if (!data[field]) {
            throw new Error(`Missing required field: ${field}`);
          }
        }
      }

      if (schemaObj.properties) {
        for (const [field, rules] of Object.entries(schemaObj.properties)) {
          const ruleObj = rules as any;
          if (data[field] !== undefined) {
            if (ruleObj.type === 'string' && typeof data[field] !== 'string') {
              throw new Error(`${field} must be a string`);
            }
            if (ruleObj.minLength && data[field].length < ruleObj.minLength) {
              throw new Error(`${field} must be at least ${ruleObj.minLength} characters`);
            }
            if (ruleObj.format === 'email') {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(data[field])) {
                throw new Error(`${field} must be a valid email`);
              }
            }
          }
        }
      }

      return data;
    };
  });

  // Create mock database for tests
  const database = new MockDatabase();
  await database.connect();

  // Register auth routes for testing with mock database
  await server.register(authRoutes, {
    prefix: '/api/v1/auth',
    database
  });

  return server;
}