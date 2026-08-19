import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { AccountingRepository } from '../accounting/accounting.repository';
import { ProfileRepository } from '../profile/profile.repository';
import { HealthRepository } from './health.repository';
import { computeHealthScore, computeRunway, PERIOD_DAYS } from './health.service';
import { HealthContext } from './health.types';
import { BrainInsightsService } from '../brain/brain.insights';

/**
 * Section 11 — Financial Health Score.
 *
 * GET /v1/health-score → the score, the four ratios, trends and explanations.
 */
export async function healthRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const { database } = options;
  const repo = new HealthRepository(database);
  const ledger = new AccountingRepository(database);
  const profiles = new ProfileRepository(database);
  const insights = new BrainInsightsService(database);
  const pre = [authenticate, withBusiness(database)];

  fastify.get('/v1/health-score', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const businessId = request.businessId!;

      // Same guarantee the dashboard makes: the ledger is up to date before we
      // read from it, so a score is never computed on stale books.
      await ledger.resyncBookkeeping(businessId);

      const today = new Date();
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);

      const [daysOfData, snapshot, previous, business] = await Promise.all([
        repo.daysOfData(businessId),
        repo.snapshot(businessId, iso(today), PERIOD_DAYS),
        // The same picture a month ago — this is what the trend arrows compare to.
        repo.snapshot(businessId, iso(monthAgo), PERIOD_DAYS),
        // Per workspace: the score's context (industry, maturity, debt, goal)
        // must describe the business being scored, not the account's first one.
        profiles.getBusiness(businessId),
      ]);

      // Only meaningful once there's history to compare against.
      const comparable = daysOfData >= 30 ? previous : null;

      const context: HealthContext = {
        maturityStage: business.maturityStage,
        industry: business.industry,
        niche: business.niche,
        hasDebt: business.hasDebt,
        primaryGoal: business.primaryGoal,
      };

      const health = computeHealthScore(snapshot, comparable, daysOfData, context);

      /**
       * Record any threshold the business has crossed since the last reading
       * (spec 06 §5.1). This is the only moment a crossing is observable —
       * nothing else recomputes the score — so it hooks here rather than
       * running on a timer that would repeat the same work.
       *
       * Not awaited, and it swallows its own errors: the caller asked for a
       * health score, and an insight node failing to write must not turn that
       * into a 500. Writing is idempotent, so the dashboard being refreshed
       * repeatedly produces one node per actual crossing, not one per request.
       */
      void insights.record(businessId, health);

      return reply.send({ success: true, data: health });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not compute your health score.' });
    }
  }) as any);

  /**
   * GET /v1/health-score/runway → burn rate and months of cash left.
   *
   * Its own route rather than a field on the score because Finna asks for it
   * on its own, and the score is a heavier computation (two snapshots and a
   * profile read) than a runway question needs.
   */
  fastify.get('/v1/health-score/runway', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const businessId = request.businessId!;
      await ledger.resyncBookkeeping(businessId);

      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const [daysOfData, snapshot, balances] = await Promise.all([
        repo.daysOfData(businessId),
        repo.snapshot(businessId, iso(new Date()), PERIOD_DAYS),
        ledger.getBalances(businessId),
      ]);

      const cash = balances.find((b: any) => b.code === 'CASH')?.balance ?? snapshot.cash;

      return reply.send({
        success: true,
        data: computeRunway(snapshot, Number(cash) || 0, daysOfData, PERIOD_DAYS),
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not work out your runway.' });
    }
  }) as any);
}
