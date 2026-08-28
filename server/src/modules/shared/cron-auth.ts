import crypto from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';

/**
 * The shared secret that stands in for a session on scheduled endpoints.
 *
 * A cron job has no account, so these routes cannot use `authenticate`. Two
 * rules make that safe, and both have been got wrong in real systems:
 *
 *  - An UNSET secret refuses everything. Treating "no secret configured" as
 *    "no authentication required" is how an internal endpoint silently becomes
 *    a public one the moment an environment variable is missed.
 *  - The comparison is constant-time, so the secret cannot be recovered a byte
 *    at a time by timing the response. `timingSafeEqual` throws on a length
 *    mismatch rather than returning false, hence the length check first — the
 *    length is not the secret.
 */
export function checkCronSecret(
  request: FastifyRequest,
  reply: FastifyReply
): boolean {
  const expected = process.env.CRON_SECRET || '';
  if (!expected) {
    reply.status(503).send({ success: false, error: 'CRON_SECRET is not configured.' });
    return false;
  }

  const given = (request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const ok = given.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));

  if (!ok) {
    reply.status(401).send({ success: false, error: 'Unauthorized' });
    return false;
  }
  return true;
}
