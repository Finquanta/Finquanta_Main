import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { UserRepository } from '../users/user.repository';
import { UserRole } from '../users/types';
import { AdminRepository } from '../admin/admin.repository';
import {
  BETA_FEATURES,
  FEATURE_STAGES,
  FeatureStage,
  ensureFeatureFlagsSchema,
  isFeatureKey,
  listFeatures,
  setFeatureStage,
  visibleFeatures,
} from './feature-flags';

const STAFF_ROLES: string[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER];
const STAGE_LABEL: Record<FeatureStage, string> = { off: 'Off', beta: 'Beta', all: 'Everyone' };

export async function betaFeaturesRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const { database } = options;
  try {
    await ensureFeatureFlagsSchema(database);
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure beta features schema');
  }

  const users = new UserRepository(database);
  const admins = new AdminRepository(database);

  const requireStaff = async (request: FastifyRequest, reply: FastifyReply) => {
    const authed = request as AuthenticatedRequest;
    const user = authed.user?.id ? await users.findById(authed.user.id) : null;
    if (!user || !STAFF_ROLES.includes(user.role)) {
      return reply.status(403).send({ success: false, error: 'Admin access required' });
    }
    authed.user!.role = user.role;
  };

  // Which beta features the active workspace can use.
  fastify.get('/v1/beta/me', { preHandler: [authenticate, withBusiness(database)] }, (async (
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) => {
    try {
      return reply.send({ success: true, data: { features: await visibleFeatures(database, request.businessId!) } });
    } catch (error) {
      request.log.error(error);
      // No features rather than a broken page: a lookup must not take navigation down.
      return reply.send({ success: true, data: { features: [] } });
    }
  }) as any);

  fastify.get('/v1/admin/beta/features', { preHandler: [authenticate, requireStaff] }, (async (
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) => {
    try {
      return reply.send({ success: true, data: await listFeatures(database) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  fastify.put('/v1/admin/beta/features/:key', { preHandler: [authenticate, requireStaff] }, (async (
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) => {
    try {
      const { key } = request.params as { key: string };
      const { stage } = (request.body ?? {}) as { stage?: unknown };
      if (!isFeatureKey(key)) return reply.status(404).send({ success: false, error: 'Unknown feature' });
      if (typeof stage !== 'string' || !FEATURE_STAGES.includes(stage as FeatureStage)) {
        return reply.status(400).send({ success: false, error: 'Stage must be off, beta or all.' });
      }
      await setFeatureStage(database, key, stage as FeatureStage, request.user!.id);
      const feature = BETA_FEATURES.find((f) => f.key === key)!;
      await admins.addAuditLog({
        actorId: request.user!.id,
        actorEmail: request.user!.email,
        action: `Set beta feature "${feature.name}" to ${STAGE_LABEL[stage as FeatureStage]}`,
        details: { key, stage },
      });
      return reply.send({ success: true, data: await listFeatures(database) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);
}
