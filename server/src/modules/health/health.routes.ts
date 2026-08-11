import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { AccountingRepository } from '../accounting/accounting.repository';
import { ProfileRepository } from '../profile/profile.repository';
import { HealthRepository } from './health.repository';
import { computeHealthScore, PERIOD_DAYS } from './health.service';
import { HealthContext } from './health.types';

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

      return reply.send({
        success: true,
        data: computeHealthScore(snapshot, comparable, daysOfData, context),
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not compute your health score.' });
    }
  }) as any);
}
