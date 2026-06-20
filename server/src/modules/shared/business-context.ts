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

    if (!businessId) {
      reply.status(409).send({ success: false, error: 'No business found for this user' });
      return;
    }
    req.businessId = businessId;
  };
}
