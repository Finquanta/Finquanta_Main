import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { UserRepository } from '../users/user.repository';
import { ReferralsRepository } from './referrals.repository';

/** Same roles the rest of the admin panel uses. */
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

export async function referralsRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new ReferralsRepository(options.database);

  /**
   * The signed-in user's referral code, link and progress.
   *
   * Stages are synced on read: they're derived from whether the referred user
   * verified their email and actually used the product, so they can't drift and
   * they work retroactively.
   */
  fastify.get('/v1/referrals/me', { preHandler: [authenticate] }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      await repo.syncStages();
      const userId = request.user!.id;
      const [stats, referred] = await Promise.all([repo.statsFor(userId), repo.listFor(userId)]);
      return reply.send({ success: true, data: { ...stats, referred } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load your referrals.' });
    }
  }) as any);

  /** Admin: platform-wide totals and who's actually bringing people in. */
  fastify.get('/v1/admin/referrals', {
    preHandler: [authenticate, requireAdmin(options.database)],
  }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      await repo.syncStages();
      const [totals, leaderboard] = await Promise.all([repo.totals(), repo.leaderboard(100)]);
      return reply.send({ success: true, data: { totals, leaderboard } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load referrals.' });
    }
  }) as any);
}
