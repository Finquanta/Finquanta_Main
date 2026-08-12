import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { CouncilRepository } from './council.repository';
import { COUNCIL_MEMBERS, CouncilQuotaError, CouncilService } from './council.service';

/**
 * Finna Council (spec 07).
 *
 * The Council NEVER runs automatically — §5 makes that the first cost rule.
 * Every session here is convened by an explicit user action, and the quota is
 * checked before a row is written or a token is spent.
 */
export async function councilRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new CouncilRepository(options.database);
  const service = new CouncilService(options.database);
  const pre = [authenticate, withBusiness(options.database)];

  /** The roster and today's remaining quota — drives the UI before convening. */
  fastify.get('/v1/council/overview', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const quota = await service.checkQuota(request.businessId!);
      return reply.send({
        success: true,
        data: {
          members: COUNCIL_MEMBERS.map((m) => ({ key: m.key, name: m.name })),
          quota,
          sessions: await repo.listForBusiness(request.businessId!),
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load the Council.' });
    }
  }) as any);

  /**
   * Convene. This is the only route that spends money, and the only one the
   * user can trigger — there is no scheduled or background path to it.
   */
  fastify.post('/v1/council/sessions', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as { question?: unknown }) || {};
      const question = typeof body.question === 'string' ? body.question.trim() : '';
      if (question.length < 10) {
        return reply.status(400).send({
          success: false,
          error: 'Give the Council a real question — at least a sentence.',
        });
      }

      // Checked BEFORE anything is created or spent.
      const quota = await service.checkQuota(request.businessId!);
      if (!quota.allowed) {
        return reply.status(429).send({
          success: false,
          error:
            quota.scope === 'global'
              ? "The Council has reached today's limit across the whole platform. It resets tomorrow."
              : `You've used all ${quota.limit} Council sessions for today. They reset tomorrow.`,
          data: { quota },
        });
      }

      const session = await service.convene(
        request.businessId!,
        request.user?.id ?? null,
        question
      );
      return reply.status(201).send({ success: true, data: session });
    } catch (error) {
      // Lost the race for the last slot. Nothing was spent, so this is a 429
      // like any other quota refusal — not an upstream failure.
      if (error instanceof CouncilQuotaError) {
        return reply.status(429).send({
          success: false,
          error: error.message,
          data: { quota: await service.checkQuota(request.businessId!) },
        });
      }
      request.log.error(error);
      const message =
        error instanceof Error && error.message ? error.message : 'The Council could not finish.';
      return reply.status(502).send({ success: false, error: message });
    }
  }) as any);

  /**
   * Record how a decision actually turned out (spec §7). The user's judgement,
   * never the model's — nothing here calls the AI.
   */
  fastify.patch('/v1/council/sessions/:id/outcome', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as { outcome?: unknown; note?: unknown }) || {};
      if (!CouncilRepository.OUTCOMES.includes(body.outcome as any)) {
        return reply.status(400).send({
          success: false,
          error: `outcome must be one of: ${CouncilRepository.OUTCOMES.join(', ')}`,
        });
      }
      const updated = await repo.recordOutcome(
        request.businessId!,
        id,
        body.outcome as any,
        typeof body.note === 'string' ? body.note : null
      );
      if (!updated) return reply.status(404).send({ success: false, error: 'Session not found.' });
      return reply.send({ success: true, data: updated });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not record that outcome.' });
    }
  }) as any);

  /** Re-reading a past decision costs nothing — no AI call (spec §5). */
  fastify.get('/v1/council/sessions/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const session = await repo.get(request.businessId!, id);
      if (!session) return reply.status(404).send({ success: false, error: 'Session not found.' });
      return reply.send({ success: true, data: session });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load that session.' });
    }
  }) as any);
}
