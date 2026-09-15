import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { requireBetaFeature } from '../beta/feature-flags';
import { AccountingRepository } from '../accounting/accounting.repository';
import {
  BackPoint,
  HistoryError,
  Queryable,
  groupsAfter,
  listHistory,
  undoAfter,
  undoGroup,
} from './history.service';

/**
 * Books history for the active workspace: see every change, undo one, or go
 * back to a change or a date. Behind the `books_history` beta feature.
 *
 * Anyone in the workspace can see the history; only Owners and Admins can undo.
 */

const CAN_UNDO = new Set(['Owner', 'Admin']);
const TXID = /^\d+$/;

export async function historyRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const { database } = options;
  const pre = [authenticate, withBusiness(database), requireBetaFeature(database, 'books_history')];

  const roleOf = async (businessId: string, userId: string): Promise<string | null> => {
    const result = await database.query(
      'SELECT role FROM business_members WHERE business_id = $1 AND user_id = $2',
      [businessId, userId]
    );
    return result.rows[0]?.role ?? null;
  };

  const pointFrom = (source: { txid?: unknown; date?: unknown }): BackPoint | null => {
    if (typeof source.txid === 'string' && TXID.test(source.txid)) return { txid: source.txid };
    if (typeof source.date === 'string' && source.date.trim()) return { date: source.date.trim() };
    return null;
  };

  const fail = (request: FastifyRequest, reply: FastifyReply, error: unknown) => {
    if (error instanceof HistoryError) {
      return reply.status(error.status).send({ success: false, error: error.message, reason: error.reason });
    }
    request.log.error(error);
    return reply.status(500).send({ success: false, error: 'Internal server error' });
  };

  // Automatic bookkeeping entries follow the transactions; bring them back in line.
  const resync = (request: FastifyRequest, businessId: string) =>
    new AccountingRepository(database).resyncBookkeeping(businessId).catch((error) => {
      request.log.warn({ error, businessId }, 'history: bookkeeping resync after undo failed; it runs again on next load');
    });

  const ONLY_MANAGERS = 'Only the workspace owner or an admin can undo changes.';

  fastify.get('/v1/history', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { cursor } = (request.query ?? {}) as { cursor?: string };
      const businessId = request.businessId!;
      const [page, role] = await Promise.all([
        listHistory(database, businessId, { cursor }),
        roleOf(businessId, request.user!.id),
      ]);
      return reply.send({ success: true, data: { ...page, canUndo: CAN_UNDO.has(role ?? '') } });
    } catch (error) {
      return fail(request as FastifyRequest, reply, error);
    }
  }) as any);

  fastify.get('/v1/history/preview', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const point = pointFrom((request.query ?? {}) as { txid?: unknown; date?: unknown });
      if (!point) return reply.status(400).send({ success: false, error: 'Choose a change or a date.' });
      return reply.send({ success: true, data: { groups: await groupsAfter(database, request.businessId!, point) } });
    } catch (error) {
      return fail(request as FastifyRequest, reply, error);
    }
  }) as any);

  fastify.post('/v1/history/:txid/undo', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { txid } = request.params as { txid: string };
      if (!TXID.test(txid)) return reply.status(404).send({ success: false, error: 'Not found' });
      const businessId = request.businessId!;
      // 422 rather than 403: the client treats 403 as a dead session.
      if (!CAN_UNDO.has((await roleOf(businessId, request.user!.id)) ?? '')) {
        return reply.status(422).send({ success: false, error: ONLY_MANAGERS });
      }
      await database.transaction((client) =>
        undoGroup(client as unknown as Queryable, businessId, txid, request.user!.id, true)
      );
      await resync(request as FastifyRequest, businessId);
      return reply.send({ success: true, data: { undone: 1 } });
    } catch (error) {
      return fail(request as FastifyRequest, reply, error);
    }
  }) as any);

  fastify.post('/v1/history/undo-after', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const point = pointFrom((request.body ?? {}) as { txid?: unknown; date?: unknown });
      if (!point) return reply.status(400).send({ success: false, error: 'Choose a change or a date.' });
      const businessId = request.businessId!;
      if (!CAN_UNDO.has((await roleOf(businessId, request.user!.id)) ?? '')) {
        return reply.status(422).send({ success: false, error: ONLY_MANAGERS });
      }
      // All or nothing: one change that cannot be undone leaves the books as they were.
      const undone = await database.transaction((client) =>
        undoAfter(client as unknown as Queryable, businessId, point, request.user!.id)
      );
      await resync(request as FastifyRequest, businessId);
      return reply.send({ success: true, data: { undone } });
    } catch (error) {
      return fail(request as FastifyRequest, reply, error);
    }
  }) as any);
}
