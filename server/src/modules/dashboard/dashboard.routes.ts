import { FastifyInstance } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { DashboardController } from './dashboard.controller';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

export async function dashboardRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const controller = new DashboardController(new DashboardService(new DashboardRepository(options.database)));
  const pre = [authenticate, withBusiness(options.database)];
  fastify.get('/v1/dashboard/overview', { preHandler: pre }, controller.getOverview.bind(controller) as any);
  fastify.get('/v1/dashboard/revenue', { preHandler: pre }, controller.getRevenue.bind(controller) as any);
  fastify.post('/v1/dashboard/goals', { preHandler: pre }, controller.createGoal.bind(controller) as any);
  fastify.patch('/v1/dashboard/goals/:id', { preHandler: pre }, controller.updateGoal.bind(controller) as any);
  fastify.delete('/v1/dashboard/goals/:id', { preHandler: pre }, controller.deleteGoal.bind(controller) as any);
}
