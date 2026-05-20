import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../shared/authenticate';
import { PayrollService } from './payroll.service';

export class PayrollController {
  constructor(private service: PayrollService) {}

  async getOverview(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const query = request.query as { period?: string };
      const period = query.period ?? new Date().toISOString().slice(0, 7);
      return reply.send({ success: true, data: await this.service.getOverview(request.user!.id, period) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }
}
