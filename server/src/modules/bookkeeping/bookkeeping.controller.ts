import { FastifyReply } from 'fastify';
import { normalizeDateRange } from '../shared/date-range';
import { AuthenticatedRequest } from '../shared/authenticate';
import { BookkeepingService } from './bookkeeping.service';

export class BookkeepingController {
  constructor(private service: BookkeepingService) {}

  async getOverview(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const range = normalizeDateRange(request.query as { startDate?: string; endDate?: string });
      const data = await this.service.getOverview(request.businessId!, range.startDate, range.endDate);
      return reply.send({ success: true, data });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  async createTransaction(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const data = await this.service.createTransaction(request.businessId!, request.user!.id, request.body);
      return reply.status(201).send({ success: true, data });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  async updateTransaction(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const data = await this.service.updateTransaction(id, request.businessId!, request.body);
      if (!data) {
        return reply.status(404).send({ success: false, error: 'Transaction not found' });
      }
      return reply.send({ success: true, data });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  async deleteTransaction(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const deleted = await this.service.deleteTransaction(id, request.businessId!);
      if (!deleted) {
        return reply.status(404).send({ success: false, error: 'Transaction not found' });
      }
      return reply.send({ success: true, message: 'Transaction deleted successfully' });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  private handleError(error: unknown, reply: FastifyReply) {
    if (error instanceof Error && (error.message.includes('Invalid') || error.message.includes('required') || error.message.includes('must'))) {
      return reply.status(400).send({ success: false, error: error.message });
    }
    return reply.status(500).send({ success: false, error: 'Internal server error' });
  }
}
