import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { RecurringRepository } from './recurring.repository';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Recurring entries that have come round again.
 *
 * TWO endpoints, and there is deliberately no third for "yes".
 *
 * Confirming an occurrence creates an ordinary transaction through the ordinary
 * transaction endpoint — the same call manual entry and document review both
 * use. A dedicated "confirm recurring" route would be a second way to write to
 * the ledger, and a second way for the books to disagree with themselves. Once
 * that transaction exists the series head moves forward and the item stops
 * being due on its own, with nothing to keep in step.
 */
export async function recurringRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new RecurringRepository(options.database);
  const pre = [authenticate, withBusiness(options.database)];

  await repo.ensureSchema();

  /**
   * What is outstanding. Safe to call on every dashboard load: it is two
   * indexed reads and some date arithmetic, and it never costs anything.
   */
  fastify.get('/v1/recurring/due', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      // UTC, so the answer does not change with the reader's timezone. A
      // subscription is not due at a different moment in Lisbon than in Lagos.
      const today = new Date().toISOString().slice(0, 10);
      return reply.send({ success: true, data: await repo.listDue(request.businessId!, today) });
    } catch (error) {
      request.log.error(error);
      // A prompt is a nicety. Failing to produce one must not break the page.
      return reply.send({ success: true, data: [] });
    }
  }) as any);

  /** "No, that did not happen." Recorded so the same question does not return. */
  fastify.post('/v1/recurring/skip', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { seriesKey, dueDate } = (request.body ?? {}) as {
        seriesKey?: string; dueDate?: string;
      };
      if (!seriesKey || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate ?? '')) {
        return reply.status(400).send({
          success: false,
          error: 'seriesKey and a YYYY-MM-DD dueDate are required.',
        });
      }
      await repo.skip(request.businessId!, seriesKey, dueDate!, request.user!.id);
      return reply.send({ success: true, data: { skipped: true } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not record that.' });
    }
  }) as any);
}
