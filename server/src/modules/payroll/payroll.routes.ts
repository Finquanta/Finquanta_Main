import { FastifyInstance } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate } from '../shared/authenticate';
import { PayrollController } from './payroll.controller';
import { PayrollRepository } from './payroll.repository';
import { PayrollService } from './payroll.service';

export async function payrollRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const controller = new PayrollController(new PayrollService(new PayrollRepository(options.database)));
  fastify.get('/v1/payroll/overview', { preHandler: [authenticate] }, controller.getOverview.bind(controller) as any);
}
