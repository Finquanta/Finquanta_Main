import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ApiInfoResponse, ApiResponse } from '@/types';
import { authRoutes } from '../modules/auth/auth.routes';
import { Database } from '../infrastructure/database';

async function apiRoutes(fastify: FastifyInstance): Promise<void> {
  // API information
  fastify.get('/', {
    schema: {
      description: 'Get API information',
      tags: ['api'],
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            version: { type: 'string' },
            status: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const response: ApiInfoResponse = {
      message: 'Fiscal AI API Server',
      version: '1.0.0',
      status: 'running',
    };

    return response;
  });

  // API version
  fastify.get('/version', {
    schema: {
      description: 'Get API version information',
      tags: ['api'],
      response: {
        200: {
          type: 'object',
          properties: {
            version: { type: 'string' },
            buildDate: { type: 'string' },
            environment: { type: 'string' },
            nodeVersion: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const response = {
      version: '1.0.0',
      buildDate: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
    };

    return response;
  });

  // Test route for development
  fastify.get('/test', {
    schema: {
      description: 'Test endpoint for development',
      tags: ['api', 'test'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            timestamp: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                headers: { type: 'object' },
                query: { type: 'object' },
                params: { type: 'object' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const response: ApiResponse = {
      success: true,
      message: 'Test endpoint working correctly',
      timestamp: new Date().toISOString(),
      data: {
        headers: request.headers,
        query: request.query,
        params: request.params,
      },
    };

    return response;
  });

  // Register authentication routes
  const database = new Database();
  await fastify.register(authRoutes, {
    prefix: '/v1/auth',
    database
  });
}

export default apiRoutes;