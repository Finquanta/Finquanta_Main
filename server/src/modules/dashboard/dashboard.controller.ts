import { FastifyReply } from 'fastify';
import { normalizeDateRange } from '../shared/date-range';
import { AuthenticatedRequest } from '../shared/authenticate';
import { DashboardService } from './dashboard.service';

export class DashboardController {
  constructor(private service: DashboardService) {}

  async getOverview(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const range = normalizeDateRange(request.query as { startDate?: string; endDate?: string });
      const data = await this.service.getOverview(request.user!.id, range.startDate, range.endDate);
      return reply.send({ success: true, data });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }
}
