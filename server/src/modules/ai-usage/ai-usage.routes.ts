import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { AiUsageRepository } from './ai-usage.repository';

/** Signed-in dashboard usage (Finna, with tools) — generous, real product use. */
const AUTHED_DAILY_LIMIT = 200;
/** Anonymous landing-page chat, per IP — tight; it's pure cost with no tools. */
const ANON_DAILY_LIMIT = 20;

export async function aiUsageRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new AiUsageRepository(options.database);

  /**
   * Called by the Next.js /api/chat route BEFORE it spends an Anthropic call.
   * Works whether the caller is signed in or not — a valid Bearer token keys
   * the cap to the user; anything else keys it to the caller's IP. Auth is
   * intentionally optional here (not the `authenticate` preHandler, which
   * would 401): an anonymous landing-page visitor is a legitimate caller that
   * still needs to be capped, just under a tighter, IP-keyed limit.
   */
  fastify.post('/v1/ai/usage/check', (async (request: FastifyRequest, reply: FastifyReply) => {
    let key: string;
    let limit: number;
    try {
      await (request as FastifyRequest & { jwtVerify: () => Promise<unknown> }).jwtVerify();
      const user = (request as FastifyRequest & { user?: { userId?: string; id?: string } }).user;
      const userId = user?.userId || user?.id;
      if (!userId) throw new Error('token carried no user id');
      key = `user:${userId}`;
      limit = AUTHED_DAILY_LIMIT;
    } catch {
      key = `ip:${request.ip}`;
      limit = ANON_DAILY_LIMIT;
    }

    const count = await repo.incrementAndGet(key);
    return reply.send({ success: true, data: { allowed: count <= limit, count, limit } });
  }) as any);
}
