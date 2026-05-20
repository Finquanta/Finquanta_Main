import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../shared/authenticate';
import { DocumentService } from './document.service';

export class DocumentController {
  constructor(private service: DocumentService) {}

  async listDocuments(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      return reply.send({ success: true, data: await this.service.listDocuments(request.user!.id, request.query as Record<string, any>) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }

  async getStats(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      return reply.send({ success: true, data: await this.service.getStats(request.user!.id) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }
}
