import { FastifyReply } from 'fastify';
import { normalizeDateRange } from '../shared/date-range';
import { AuthenticatedRequest } from '../shared/authenticate';
import { DashboardService } from './dashboard.service';

export class DashboardController {
  constructor(private service: DashboardService) {}

  async getOverview(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const range = normalizeDateRange(request.query as { startDate?: string; endDate?: string });
      const data = await this.service.getOverview(request.businessId!, range.startDate, range.endDate);
      return reply.send({ success: true, data });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }

  async getRevenue(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { range, metric } = request.query as { range?: string; metric?: string };
      const data = await this.service.getRevenue(request.businessId!, range as any, metric as any);
      return reply.send({ success: true, data });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }

  async createGoal(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const data = await this.service.createGoal(request.businessId!, request.user!.id, request.body as any);
      return reply.status(201).send({ success: true, data });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  async updateGoal(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const data = await this.service.updateGoal(request.businessId!, id, request.body as any);
      return reply.send({ success: true, data });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  async deleteGoal(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      await this.service.deleteGoal(request.businessId!, id);
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  private handleError(error: unknown, reply: FastifyReply) {
    if (error instanceof Error && error.message.includes('not found')) {
      return reply.status(404).send({ success: false, error: error.message });
    }
    if (error instanceof Error && error.message.includes('Invalid')) {
      return reply.status(400).send({ success: false, error: error.message });
    }
    return reply.status(500).send({ success: false, error: 'Internal server error' });
  }
}
