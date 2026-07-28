import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { GROUP_TYPES, GroupType, GroupsRepository } from './groups.repository';

/**
 * Business Groups (cost & profit centers). All routes are scoped to the active
 * business via withBusiness, so a user only ever sees their own groups.
 */
export async function groupsRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new GroupsRepository(options.database);
  const pre = [authenticate, withBusiness(options.database)];

  const validType = (t: unknown): t is GroupType => GROUP_TYPES.includes(t as GroupType);

  fastify.get('/v1/groups', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { includeArchived } = request.query as { includeArchived?: string };
      return reply.send({ success: true, data: await repo.list(request.businessId!, includeArchived === 'true') });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load your groups.' });
    }
  }) as any);

  /** Net contribution per group over a period, plus an Unassigned bucket. */
  fastify.get('/v1/groups/report', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const q = request.query as { start?: string; end?: string };
      const end = q.end ?? new Date().toISOString().slice(0, 10);
      // Default to the year so a project's whole run shows by default.
      const start = q.start ?? `${new Date().getFullYear()}-01-01`;
      return reply.send({ success: true, data: await repo.getGroupReport(request.businessId!, start, end) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load the group report.' });
    }
  }) as any);

  /** What's inside a group. Use id 'unassigned' for the Unassigned bucket. */
  fastify.get('/v1/groups/:id/items', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const groupId = id === 'unassigned' ? null : id;
      return reply.send({ success: true, data: await repo.getItems(request.businessId!, groupId) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load that group.' });
    }
  }) as any);

  /** Move a bookkeeping entry or invoice into a group (or out with groupId null). */
  fastify.post('/v1/groups/assign', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as { kind?: string; id?: string; groupId?: string | null }) || {};
      if (body.kind !== 'bookkeeping' && body.kind !== 'invoice') {
        return reply.status(400).send({ success: false, error: "kind must be 'bookkeeping' or 'invoice'" });
      }
      if (!body.id) return reply.status(400).send({ success: false, error: 'id is required' });
      const ok = await repo.assign(request.businessId!, body.kind, body.id, body.groupId ?? null);
      if (!ok) return reply.status(404).send({ success: false, error: 'Item not found' });
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not move that item.' });
    }
  }) as any);

  fastify.delete('/v1/groups/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ok = await repo.remove(request.businessId!, id);
      if (!ok) return reply.status(404).send({ success: false, error: 'Group not found' });
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not delete that group.' });
    }
  }) as any);

  fastify.post('/v1/groups', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as { name?: string; description?: string; type?: string; color?: string }) || {};
      const name = (body.name ?? '').trim();
      if (!name) return reply.status(400).send({ success: false, error: 'A group name is required.' });
      if (body.type && !validType(body.type)) {
        return reply.status(400).send({ success: false, error: `type must be one of: ${GROUP_TYPES.join(', ')}` });
      }
      const group = await repo.create(request.businessId!, {
        name, description: body.description, type: body.type as GroupType | undefined, color: body.color,
      });
      return reply.status(201).send({ success: true, data: group });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not create that group.' });
    }
  }) as any);

  fastify.patch('/v1/groups/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as { name?: string; description?: string; type?: string; color?: string; status?: string }) || {};
      if (body.type && !validType(body.type)) {
        return reply.status(400).send({ success: false, error: `type must be one of: ${GROUP_TYPES.join(', ')}` });
      }
      if (body.status && body.status !== 'active' && body.status !== 'archived') {
        return reply.status(400).send({ success: false, error: 'status must be active or archived' });
      }
      const updated = await repo.update(request.businessId!, id, {
        name: body.name, description: body.description, type: body.type as GroupType | undefined,
        color: body.color, status: body.status as 'active' | 'archived' | undefined,
      });
      if (!updated) return reply.status(404).send({ success: false, error: 'Group not found' });
      return reply.send({ success: true, data: updated });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not update that group.' });
    }
  }) as any);
}
