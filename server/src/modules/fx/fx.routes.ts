import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { FxRepository, SUPPORTED_CURRENCIES } from './fx.repository';

/**
 * GET /v1/fx/rate?from=EUR&to=USD&date=YYYY-MM-DD
 *
 * Used by the bookkeeping entry form to convert a foreign amount to USD as the
 * user types. Authenticated so it can't be used as an open FX proxy, but it
 * reads no business data.
 */
export async function fxRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new FxRepository(options.database);

  fastify.get('/v1/fx/rate', { preHandler: [authenticate] }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const q = request.query as { from?: string; to?: string; date?: string };
      const from = (q.from ?? 'USD').toUpperCase();
      const to = (q.to ?? 'USD').toUpperCase();
      const date = q.date ?? new Date().toISOString().slice(0, 10);

      if (!SUPPORTED_CURRENCIES.includes(from as any) || !SUPPORTED_CURRENCIES.includes(to as any)) {
        return reply.status(400).send({
          success: false,
          error: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`,
        });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return reply.status(400).send({ success: false, error: 'date must be YYYY-MM-DD' });
      }

      const { rate, effectiveDate } = await repo.getRate(from, to, date);
      return reply.send({ success: true, data: { from, to, date, effectiveDate, rate } });
    } catch (error) {
      request.log.error(error);
      // A rate lookup failing shouldn't read as a server fault to the user.
      return reply.status(502).send({
        success: false,
        error: error instanceof Error ? error.message : 'Could not fetch the exchange rate.',
      });
    }
  }) as any);
}
