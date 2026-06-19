import { FastifyInstance } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate } from '../shared/authenticate';
import { DashboardController } from './dashboard.controller';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

export async function dashboardRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const controller = new DashboardController(new DashboardService(new DashboardRepository(options.database)));
  fastify.get('/v1/dashboard/overview', { preHandler: [authenticate] }, controller.getOverview.bind(controller) as any);
  fastify.get('/v1/dashboard/revenue', { preHandler: [authenticate] }, controller.getRevenue.bind(controller) as any);
  fastify.post('/v1/dashboard/goals', { preHandler: [authenticate] }, controller.createGoal.bind(controller) as any);
  fastify.patch('/v1/dashboard/goals/:id', { preHandler: [authenticate] }, controller.updateGoal.bind(controller) as any);
  fastify.delete('/v1/dashboard/goals/:id', { preHandler: [authenticate] }, controller.deleteGoal.bind(controller) as any);
}
