import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { HealthResponse, ApiResponse } from '@/types';

async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  // Basic health check
  fastify.get('/', {
    schema: {
      description: 'Basic health check',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'error'] },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const response: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    return response;
  });

  // Detailed health check with system info
  fastify.get('/detailed', {
    schema: {
      description: 'Detailed health check with system information',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'error'] },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
            memory: {
              type: 'object',
              properties: {
                used: { type: 'number' },
                total: { type: 'number' },
                percentage: { type: 'number' },
              },
            },
            version: { type: 'string' },
            environment: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapTotal;
    const usedMem = memUsage.heapUsed;

    const response = {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(usedMem / 1024 / 1024 * 100) / 100, // MB
        total: Math.round(totalMem / 1024 / 1024 * 100) / 100, // MB
        percentage: Math.round((usedMem / totalMem) * 10000) / 100, // %
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    return response;
  });
}

export default healthRoutes;