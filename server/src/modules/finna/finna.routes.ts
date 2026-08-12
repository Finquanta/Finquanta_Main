import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { FinnaRepository } from './finna.repository';

/**
 * Saved Finna chat conversations.
 *
 * Pure storage — nothing here calls the AI. The widget owns the conversation
 * while it is live and posts each completed exchange back, the same shape the
 * guided advisor uses.
 */
export async function finnaRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new FinnaRepository(options.database);
  const pre = [authenticate, withBusiness(options.database)];

  fastify.get('/v1/finna/conversations', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({
        success: true,
        data: await repo.list(request.businessId!, request.user!.id),
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load your chats.' });
    }
  }) as any);

  fastify.post('/v1/finna/conversations', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as { title?: unknown }) || {};
      const title = typeof body.title === 'string' ? body.title : '';
      return reply.status(201).send({
        success: true,
        data: await repo.create(request.businessId!, request.user!.id, title),
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not start that chat.' });
    }
  }) as any);

  fastify.get('/v1/finna/conversations/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const found = await repo.get(request.businessId!, request.user!.id, id);
      if (!found) return reply.status(404).send({ success: false, error: 'Chat not found.' });
      return reply.send({ success: true, data: found });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load that chat.' });
    }
  }) as any);

  fastify.post('/v1/finna/conversations/:id/messages', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as { messages?: unknown }) || {};
      if (!Array.isArray(body.messages)) {
        return reply.status(400).send({ success: false, error: 'messages must be an array.' });
      }
      const saved = await repo.append(request.businessId!, request.user!.id, id, body.messages as any);
      if (!saved) return reply.status(404).send({ success: false, error: 'Chat not found.' });
      return reply.send({ success: true, data: { ok: true } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not save that message.' });
    }
  }) as any);

  fastify.patch('/v1/finna/conversations/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as { title?: unknown }) || {};
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return reply.status(400).send({ success: false, error: 'A name is required.' });
      }
      const updated = await repo.rename(request.businessId!, request.user!.id, id, body.title);
      if (!updated) return reply.status(404).send({ success: false, error: 'Chat not found.' });
      return reply.send({ success: true, data: updated });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not rename that chat.' });
    }
  }) as any);

  fastify.delete('/v1/finna/conversations/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const gone = await repo.remove(request.businessId!, request.user!.id, id);
      if (!gone) return reply.status(404).send({ success: false, error: 'Chat not found.' });
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not delete that chat.' });
    }
  }) as any);
}
