import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { RemindersRepository } from './reminders.repository';

export async function reminderRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repository = new RemindersRepository(options.database);
  const pre = [authenticate, withBusiness(options.database)];

  fastify.get('/v1/reminders', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const data = await repository.list(request.businessId!);
      return reply.send({ success: true, data });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  fastify.post('/v1/reminders', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { text?: string; remindAt?: string | null };
      const text = (body.text ?? '').trim();
      if (!text) return reply.status(400).send({ success: false, error: 'Reminder text is required' });
      const data = await repository.create(request.businessId!, request.user!.id, { text, remindAt: body.remindAt ?? null });
      return reply.status(201).send({ success: true, data });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  fastify.patch('/v1/reminders/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { text?: string; remindAt?: string | null; done?: boolean };
      if (body.text !== undefined && !body.text.trim()) {
        return reply.status(400).send({ success: false, error: 'Reminder text cannot be empty' });
      }
      const updated = await repository.update(request.businessId!, id, {
        text: body.text?.trim(),
        remindAt: body.remindAt,
        done: body.done
      });
      if (!updated) return reply.status(404).send({ success: false, error: 'Reminder not found' });
      return reply.send({ success: true, data: updated });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  fastify.delete('/v1/reminders/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const deleted = await repository.delete(request.businessId!, id);
      if (!deleted) return reply.status(404).send({ success: false, error: 'Reminder not found' });
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);
}
