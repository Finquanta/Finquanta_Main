import { FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { AuthenticatedRequest } from './authenticate';
import { BusinessesRepository } from '../businesses/businesses.repository';

/**
 * Resolves the active business for the request and attaches it as
 * `request.businessId`. Reads the `x-business-id` header (validating the user is
 * a member), otherwise falls back to the user's default business. Use as a
 * preHandler AFTER `authenticate`.
 */
export function withBusiness(database: Database) {
  const repo = new BusinessesRepository(database);

  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const req = request as AuthenticatedRequest;
    const userId = req.user?.id;
    if (!userId) return; // authenticate already handled the 401

    const header = request.headers['x-business-id'];
    const requested = Array.isArray(header) ? header[0] : header;

    let businessId: string | null = null;
    if (requested) {
      const role = await repo.getRole(requested, userId);
      if (role) businessId = requested;
    }
    if (!businessId) {
      businessId = await repo.getDefaultBusinessId(userId);
    }

    // Still nothing: this account predates default-business-on-registration, or
    // its creation failed. Every request it makes would 409 forever, which is an
    // unusable account rather than a meaningful error, so heal it here instead
    // of reporting it. Registration is the normal path — this is the net.
    if (!businessId) {
      try {
        await repo.create(userId, 'My Business');
      } catch (error) {
        request.log?.error({ err: error, userId }, 'failed to create default business');
      }
      // Re-read instead of trusting the row we just inserted. A dashboard load
      // fires several authenticated requests at once, and `businesses` has no
      // UNIQUE(owner_id) to stop each of them taking this branch and creating
      // its own workspace. Trusting our own insert would have each in-flight
      // request writing into a *different* businessId, and once the requests
      // settle only the earliest is ever read back — silently stranding whatever
      // the losers wrote. getDefaultBusinessId orders by created_at, so every
      // racer converges on the same one.
      businessId = await repo.getDefaultBusinessId(userId);
    }

    if (!businessId) {
      reply.status(409).send({ success: false, error: 'No business found for this user' });
      return;
    }
    req.businessId = businessId;
  };
}
