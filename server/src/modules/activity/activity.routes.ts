import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { AccountingRepository } from '../accounting/accounting.repository';
import { ActivityRepository } from './activity.repository';

export async function activityRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new ActivityRepository(options.database);
  const ledger = new AccountingRepository(options.database);
  const pre = [authenticate, withBusiness(options.database)];

  /**
   * The business's financial activity history.
   *
   * The ledger is the source of truth, so we bring bookkeeping into the ledger
   * and then the ledger onto the timeline before reading — that way the history
   * is complete even for events that predate this feature.
   */
  fastify.get('/v1/activity', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { limit } = request.query as { limit?: string };
      const n = Math.min(Math.max(Number.parseInt(limit ?? '100', 10) || 100, 1), 500);

      await ledger.resyncBookkeeping(request.businessId!);
      await repo.syncFromLedger(request.businessId!);

      return reply.send({ success: true, data: await repo.list(request.businessId!, n) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);
}
