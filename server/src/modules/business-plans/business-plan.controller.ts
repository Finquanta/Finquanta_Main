import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../shared/authenticate';
import { BusinessPlanService } from './business-plan.service';

export class BusinessPlanController {
  constructor(private service: BusinessPlanService) {}

  async list(request: AuthenticatedRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.list(request.user!.id) });
  }

  async stats(request: AuthenticatedRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.getStats(request.user!.id) });
  }

  async templates(_request: AuthenticatedRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: this.service.getTemplates() });
  }

  async marketData(_request: AuthenticatedRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: this.service.getMarketData() });
  }

  async duplicate(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      return reply.status(201).send({ success: true, data: await this.service.duplicate(request.user!.id, id) });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ success: false, error: error.message });
      }
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }
}
