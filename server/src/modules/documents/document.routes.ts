import { FastifyInstance } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate } from '../shared/authenticate';
import { DocumentController } from './document.controller';
import { DocumentRepository } from './document.repository';
import { DocumentService } from './document.service';

export async function documentRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const controller = new DocumentController(new DocumentService(new DocumentRepository(options.database)));
  fastify.get('/v1/documents', { preHandler: [authenticate] }, controller.listDocuments.bind(controller) as any);
  fastify.get('/v1/documents/stats', { preHandler: [authenticate] }, controller.getStats.bind(controller) as any);
}
