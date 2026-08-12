import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { AiUsageRepository } from './ai-usage.repository';

/**
 * Env-overridable so the caps can be raised the moment there's budget for it,
 * without a code change and a redeploy. An unset or unparseable value falls
 * back to the constant below.
 */
const envLimit = (name: string, fallback: number): number => {
  const raw = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
};

/** Signed-in dashboard usage (Finna, with tools). */
const AUTHED_DAILY_LIMIT = envLimit('AI_AUTHED_DAILY_LIMIT', 50);
/** Anonymous landing-page chat, per IP — tight; it's pure cost with no tools. */
const ANON_DAILY_LIMIT = envLimit('AI_ANON_DAILY_LIMIT', 20);
/**
 * Hard stop across the whole platform, per day.
 *
 * The per-caller limits above cap any ONE user; they do nothing to bound the
 * total, which grows with every workspace. This is the number that actually
 * protects the prepaid balance: one message costs roughly 1.5c once tool
 * rounds are counted, so 300 caps a runaway day near $5 rather than the
 * balance. RAISE IT once there's budget — it is deliberately low for now.
 */
const GLOBAL_DAILY_LIMIT = envLimit('AI_GLOBAL_DAILY_LIMIT', 300);
const GLOBAL_KEY = 'global';

/**
 * A second, tighter ceiling covering anonymous callers only.
 *
 * Signed-in users are the product; anonymous ones are strangers with a public
 * endpoint. Without a separate budget they draw on the same 300, so a burst of
 * untrusted traffic could exhaust the day before the people paying for the
 * product get to use it. This carves out a bounded slice for them instead.
 */
const ANON_GLOBAL_DAILY_LIMIT = envLimit('AI_ANON_GLOBAL_DAILY_LIMIT', 100);
const ANON_GLOBAL_KEY = 'global:anon';

/**
 * The address Render actually observed, for keying the anonymous cap.
 *
 * Proxies APPEND to X-Forwarded-For, so the rightmost entry is the one our own
 * proxy wrote and everything left of it is caller-supplied. `request.ip` reads
 * the LEFTMOST entry (the app sets `trustProxy: true`), which a caller can
 * invent — letting one machine mint a fresh 20-request counter per request just
 * by rotating a header, and walk straight through the anonymous cap.
 *
 * Read locally rather than by changing `trustProxy` app-wide: that setting also
 * feeds the `remoteip` sent to Cloudflare Turnstile on every login, and
 * verifyTurnstile fails closed. Getting it wrong there locks people out of
 * their accounts. This cap does not justify that risk, so the narrow fix stays
 * narrow. If the hop count is ever confirmed against production logs, this
 * helper is the thing to delete.
 *
 * Falls back to `request.ip` when the header is absent (direct connection, or
 * local development).
 */
function observedAddress(request: FastifyRequest): string {
  const header = request.headers['x-forwarded-for'];
  const raw = Array.isArray(header) ? header.join(',') : header ?? '';
  const hops = raw.split(',').map((h) => h.trim()).filter(Boolean);
  return hops[hops.length - 1] ?? request.ip;
}

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
    let anonymous = false;
    try {
      await (request as FastifyRequest & { jwtVerify: () => Promise<unknown> }).jwtVerify();
      const user = (request as FastifyRequest & { user?: { userId?: string; id?: string } }).user;
      const userId = user?.userId || user?.id;
      if (!userId) throw new Error('token carried no user id');
      key = `user:${userId}`;
      limit = AUTHED_DAILY_LIMIT;
    } catch {
      key = `ip:${observedAddress(request)}`;
      limit = ANON_DAILY_LIMIT;
      anonymous = true;
    }

    /**
     * Read the shared ceilings BEFORE charging the caller anything.
     *
     * A caller refused because the PLATFORM is capped did nothing wrong, and
     * nothing was spent at Anthropic on their behalf. Charging their personal
     * counter anyway means a platform-wide cap quietly eats everyone's daily
     * allowance while they retry — the client tells them to try again later,
     * and each attempt costs them one of their own 50.
     *
     * Counters are compared post-increment, so "already spent" is `>= limit`:
     * one more would land above it.
     */
    const globalBefore = await repo.peek(GLOBAL_KEY);
    const anonBefore = anonymous ? await repo.peek(ANON_GLOBAL_KEY) : 0;
    if (
      globalBefore >= GLOBAL_DAILY_LIMIT ||
      (anonymous && anonBefore >= ANON_GLOBAL_DAILY_LIMIT)
    ) {
      return reply.send({
        success: true,
        data: {
          allowed: false,
          scope: 'global',
          count: await repo.peek(key),
          limit,
          globalCount: globalBefore,
          globalLimit: GLOBAL_DAILY_LIMIT,
        },
      });
    }

    // The PER-CALLER counter advances on every check that gets this far,
    // including denied ones: letting a caller refused by its OWN cap retry for
    // free would make that cap trivially bypassable.
    const count = await repo.incrementAndGet(key);
    const overOwn = count > limit;

    /**
     * The ANONYMOUS pool is charged before the platform one, and this ordering
     * is the whole defence.
     *
     * `ip:` keys derive from X-Forwarded-For. Even with trustProxy pinned to a
     * hop count, treat the per-IP counter as the weakest of the three: it is
     * the only one an attacker can reset at will by moving address. The
     * anonymous pool cannot be dodged that way — it is ONE shared counter for
     * all signed-out traffic, so rotating addresses does nothing to it.
     *
     * Charging it first means signed-out traffic is stopped by its own 100
     * before it can put a single request on the platform's 300. Worst case,
     * strangers spend their slice and signed-in users still have 200 left.
     */
    let anonGlobalCount = 0;
    let overAnonGlobal = false;
    if (anonymous) {
      anonGlobalCount = overOwn
        ? await repo.peek(ANON_GLOBAL_KEY)
        : await repo.incrementAndGet(ANON_GLOBAL_KEY);
      overAnonGlobal = anonGlobalCount > ANON_GLOBAL_DAILY_LIMIT;
    }

    // The PLATFORM counter is charged last, and only for a request that cleared
    // every cheaper ceiling. A caller already refused by its own cap or by the
    // anonymous pool is still MEASURED against this one, never charged to it —
    // otherwise rejected requests alone could exhaust the day for everyone.
    const chargeGlobal = !overOwn && !overAnonGlobal;
    const globalCount = chargeGlobal
      ? await repo.incrementAndGet(GLOBAL_KEY)
      : await repo.peek(GLOBAL_KEY);
    const overGlobal = globalCount > GLOBAL_DAILY_LIMIT;

    return reply.send({
      success: true,
      data: {
        allowed: !overOwn && !overGlobal && !overAnonGlobal,
        // Which ceiling stopped it, so the client can say something true —
        // "you've hit your limit" is wrong when it was the platform's. The
        // anonymous ceiling reports as 'global' too: a stranger should not be
        // told how the platform's budget is carved up.
        scope: overGlobal || overAnonGlobal ? 'global' : overOwn ? 'caller' : null,
        count,
        limit,
        globalCount,
        globalLimit: GLOBAL_DAILY_LIMIT,
      },
    });
  }) as any);
}
