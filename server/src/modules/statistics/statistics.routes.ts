import { FastifyInstance } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { StatisticsController } from './statistics.controller';
import { StatisticsRepository } from './statistics.repository';
import { StatisticsService } from './statistics.service';

export async function statisticsRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const controller = new StatisticsController(new StatisticsService(new StatisticsRepository(options.database)));
  fastify.get('/v1/statistics/overview', { preHandler: [authenticate, withBusiness(options.database)] }, controller.getOverview.bind(controller) as any);
}
