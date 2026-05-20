import { FastifyInstance } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate } from '../shared/authenticate';
import { BusinessPlanController } from './business-plan.controller';
import { BusinessPlanRepository } from './business-plan.repository';
import { BusinessPlanService } from './business-plan.service';

export async function businessPlanRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const controller = new BusinessPlanController(new BusinessPlanService(new BusinessPlanRepository(options.database)));
  fastify.get('/v1/business-plans', { preHandler: [authenticate] }, controller.list.bind(controller) as any);
  fastify.get('/v1/business-plans/stats', { preHandler: [authenticate] }, controller.stats.bind(controller) as any);
  fastify.get('/v1/business-plans/templates', { preHandler: [authenticate] }, controller.templates.bind(controller) as any);
  fastify.get('/v1/business-plans/market-data', { preHandler: [authenticate] }, controller.marketData.bind(controller) as any);
  fastify.post('/v1/business-plans/:id/duplicate', { preHandler: [authenticate] }, controller.duplicate.bind(controller) as any);
}
