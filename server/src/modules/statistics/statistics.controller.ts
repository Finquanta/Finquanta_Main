import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../shared/authenticate';
import { StatisticsService } from './statistics.service';

export class StatisticsController {
  constructor(private service: StatisticsService) {}

  async getOverview(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const query = request.query as { year?: string };
      const year = query.year ? Number.parseInt(query.year, 10) : new Date().getUTCFullYear();
      const data = await this.service.getOverview(request.user!.id, year);
      return reply.send({ success: true, data });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }
}
