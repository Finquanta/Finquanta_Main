import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { isNudgeKey, NUDGE_KEYS, NudgesService } from './nudges.service';

/**
 * Proactive Finna (Council spec §9/10).
 *
 * Nothing here calls the AI. `GET /v1/nudges` is deterministic and safe to poll
 * on page load; the cost only starts if the user acts on what it returns.
 */
export async function nudgesRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const service = new NudgesService(options.database);
  const pre = [authenticate, withBusiness(options.database)];

  fastify.get('/v1/nudges', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({
        success: true,
        data: { nudge: await service.next(request.businessId!, request.user!.id) },
      });
    } catch (error) {
      request.log.error(error);
      // A nudge is a nicety — never surface its failure to the user.
      return reply.send({ success: true, data: { nudge: null } });
    }
  }) as any);

  fastify.post('/v1/nudges/:key/dismiss', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { key } = request.params as { key: string };
      if (!isNudgeKey(key)) {
        return reply.status(400).send({
          success: false,
          error: `key must be one of: ${NUDGE_KEYS.join(', ')}`,
        });
      }
      await service.dismiss(request.businessId!, request.user!.id, key);
      return reply.send({ success: true, data: { ok: true } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not dismiss that.' });
    }
  }) as any);

  fastify.post('/v1/nudges/:key/engaged', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { key } = request.params as { key: string };
      if (!isNudgeKey(key)) {
        return reply.status(400).send({
          success: false,
          error: `key must be one of: ${NUDGE_KEYS.join(', ')}`,
        });
      }
      await service.engaged(request.businessId!, request.user!.id, key);
      return reply.send({ success: true, data: { ok: true } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not record that.' });
    }
  }) as any);

  /** The global off switch (§10.3), respected everywhere. */
  fastify.get('/v1/nudges/settings', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({
        success: true,
        data: { enabled: await service.isEnabled(request.businessId!, request.user!.id) },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load that setting.' });
    }
  }) as any);

  fastify.patch('/v1/nudges/settings', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as { enabled?: unknown }) || {};
      if (typeof body.enabled !== 'boolean') {
        return reply.status(400).send({ success: false, error: 'enabled must be true or false.' });
      }
      await service.setEnabled(request.businessId!, request.user!.id, body.enabled);
      return reply.send({ success: true, data: { enabled: body.enabled } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not save that setting.' });
    }
  }) as any);
}
