import { FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { AuthenticatedRequest } from '../shared/authenticate';
import { EntitlementsService } from './entitlements.service';
import { PlanFeatures, PlanKey, PLAN_KEYS, PLANS } from './plans';

/**
 * Route-level entitlement gate — spec 08 §3, "every feature checks entitlements
 * server-side".
 *
 * Use AFTER `authenticate` and `withBusiness`, since it needs a resolved
 * business to ask about.
 *
 * Replies **402 Payment Required**, not 403. That is not pedantry: the client
 * already treats 401/403 as "your session died" and bounces to the login page
 * (see `bounceToLogin` in the admin pages), so gating with 403 would log people
 * out for opening a feature they simply have not bought. 402 says exactly what
 * is wrong and nothing else in the codebase mistakes it for anything.
 *
 * The body names the cheapest plan that includes the feature, so the client can
 * offer a real upgrade path rather than a dead end — spec 08 asks for the lock
 * to be explained once, not for the feature to vanish.
 */
export function requireFeature(database: Database, feature: keyof PlanFeatures) {
  const entitlements = new EntitlementsService(database);

  // Typed as FastifyRequest and cast inside: typing the parameter as
  // AuthenticatedRequest does not satisfy Fastify's preHandler signature.
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const req = request as AuthenticatedRequest;
    const businessId = req.businessId;
    if (!businessId) return; // withBusiness already answered

    const allowed = await entitlements.can(businessId, feature);
    if (allowed) return;

    reply.status(402).send({
      success: false,
      error: `Your plan does not include this. ${upgradeHint(feature)}`,
      data: { feature, requiredPlan: cheapestPlanWith(feature) },
    });
  };
}

/** The least expensive plan that turns `feature` on. */
export function cheapestPlanWith(feature: keyof PlanFeatures): PlanKey | null {
  for (const key of PLAN_KEYS) {
    if (PLANS[key].features[feature]) return key;
  }
  return null;
}

function upgradeHint(feature: keyof PlanFeatures): string {
  const key = cheapestPlanWith(feature);
  return key ? `Available on ${PLANS[key].name} and above.` : 'Contact us about access.';
}
