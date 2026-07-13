import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { UserRepository } from '../users/user.repository';
import { AUDIENCES, Audience, NotificationsRepository } from './notifications.repository';

const ADMIN_ROLES = ['admin', 'super_admin', 'owner'];

function requireAdmin(database: Database) {
  const users = new UserRepository(database);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authed = request as AuthenticatedRequest;
    const id = authed.user?.id;
    if (!id) return reply.status(401).send({ success: false, error: 'Authentication required' });
    const user = await users.findById(id);
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return reply.status(403).send({ success: false, error: 'Admin access required' });
    }
    authed.user!.role = user.role;
  };
}

export async function notificationsRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new NotificationsRepository(options.database);
  const adminOnly = [authenticate, requireAdmin(options.database)];

  /* ---------------- User inbox ---------------- */

  fastify.get('/v1/notifications', { preHandler: [authenticate] }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await repo.inbox(request.user!.id) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load your notifications.' });
    }
  }) as any);

  fastify.post('/v1/notifications/:id/read', { preHandler: [authenticate] }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await repo.markRead(request.user!.id, id);
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not update that notification.' });
    }
  }) as any);

  fastify.post('/v1/notifications/read-all', { preHandler: [authenticate] }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      await repo.markAllRead(request.user!.id);
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not update your notifications.' });
    }
  }) as any);

  /* ---------------- Admin ---------------- */

  fastify.get('/v1/admin/notifications', { preHandler: adminOnly }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await repo.listSent() });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load notifications.' });
    }
  }) as any);

  /** Push a notification to users' inboxes, now or at a scheduled time. */
  fastify.post('/v1/admin/notifications', { preHandler: adminOnly }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as {
        title?: string; body?: string; audience?: string; scheduledFor?: string | null;
      }) || {};
      const title = (body.title ?? '').trim();
      const text = (body.body ?? '').trim();

      if (!title) return reply.status(400).send({ success: false, error: 'A title is required.' });
      if (!text) return reply.status(400).send({ success: false, error: 'A message is required.' });
      if (title.length > 160) {
        return reply.status(400).send({ success: false, error: 'Keep the title under 160 characters.' });
      }

      const audience = (body.audience ?? 'all') as Audience;
      if (!AUDIENCES.includes(audience)) {
        return reply.status(400).send({ success: false, error: `Audience must be one of: ${AUDIENCES.join(', ')}` });
      }

      // A schedule in the past would just fire instantly, which is almost never
      // what someone meant to do — so say so rather than silently sending it.
      let scheduledFor: string | null = null;
      if (body.scheduledFor) {
        const when = new Date(body.scheduledFor);
        if (Number.isNaN(when.getTime())) {
          return reply.status(400).send({ success: false, error: 'That scheduled time is not a valid date.' });
        }
        if (when.getTime() < Date.now() - 60_000) {
          return reply.status(400).send({ success: false, error: 'That time is in the past. Pick a future time, or send it now.' });
        }
        scheduledFor = when.toISOString();
      }

      const sent = await repo.create(request.user!.id, { title, body: text, audience, scheduledFor });
      return reply.status(201).send({ success: true, data: sent });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not send that notification.' });
    }
  }) as any);

  /**
   * Delete a notification. If it's still queued this cancels it before anyone
   * sees it; if it already went out, it disappears from every inbox.
   */
  fastify.delete('/v1/admin/notifications/:id', { preHandler: adminOnly }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ok = await repo.remove(id);
      if (!ok) return reply.status(404).send({ success: false, error: 'Notification not found' });
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not delete that notification.' });
    }
  }) as any);
}
