import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { LifecycleRepository, PREFERENCE_KEYS, PreferenceKey, REMINDER_TYPES, ReminderType } from './lifecycle.repository';
import { LifecycleService } from './lifecycle.service';
import { checkCronSecret } from '../shared/cron-auth';
import { appUrl } from '../../infrastructure/email-template';

interface Options { database: Database }

/**
 * Scheduling, click tracking, unsubscribe and preferences for the lifecycle
 * reminders.
 *
 * The run endpoint is driven by a Render Cron Job rather than a timer inside the
 * server. An in-process `setInterval` fires once per running instance, dies with
 * every restart and deploy, and double-sends the moment the service scales past
 * one — none of which is visible until somebody receives the same nag twice.
 */
export async function lifecycleRoutes(fastify: FastifyInstance, options: Options): Promise<void> {
  const repo = new LifecycleRepository(options.database);
  const service = new LifecycleService(options.database);

  /**
   * The scheduled run.
   *
   * Guarded by a shared secret rather than by a user session: the caller is a
   * cron job, which has no account. Compared with `timingSafeEqual` so the
   * comparison cannot be attacked a byte at a time, and refused outright when
   * `CRON_SECRET` is unset — an unset secret must never mean "no auth needed",
   * which is how an internal endpoint becomes a public one.
   */
  fastify.post('/v1/internal/lifecycle/run', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!checkCronSecret(request, reply)) return reply;

    const body = (request.body as { dryRun?: unknown }) || {};
    const result = await service.run({ dryRun: body.dryRun === true });
    request.log.info({ lifecycle: result }, 'lifecycle run');
    return reply.send({ success: true, data: result });
  });

  /**
   * A click on a reminder's button. Records it, stops that reminder, and then
   * sends the person where they were going.
   *
   * A redirect rather than an API call because it is reached from an email
   * client, and it must work for somebody who is not signed in — the token
   * identifies them, not a session.
   */
  fastify.get('/v1/r/:type', async (request: FastifyRequest, reply: FastifyReply) => {
    const { type } = request.params as { type: string };
    const { t, next } = (request.query as { t?: string; next?: string }) || {};
    const user = t ? await repo.userForUnsubscribeToken(t) : null;

    if (user && (REMINDER_TYPES as readonly string[]).includes(type)) {
      // Never let a tracking failure eat the redirect: they clicked to go
      // somewhere, and arriving is more important than the bookkeeping.
      try { await repo.recordClick(user.id, type as ReminderType); } catch { /* ignore */ }
    }
    // Only ever a path on our own site — an open redirect here would let anyone
    // send a phishing link that genuinely originates from a Finquanta domain.
    const path = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
    return reply.redirect(`${appUrl()}${path}`);
  });

  /**
   * One-click unsubscribe, working logged out. Required by CAN-SPAM and by
   * Gmail's bulk-sender rules, and the reason the token exists at all.
   */
  fastify.post('/v1/unsubscribe', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as { token?: string; type?: string; all?: boolean }) || {};
    const user = body.token ? await repo.userForUnsubscribeToken(body.token) : null;
    if (!user) return reply.status(404).send({ success: false, error: 'That link is not valid.' });

    // "All" means all the reminder EMAILS. It deliberately does not reach the
    // in-app notification switches: somebody unsubscribing from mail has not
    // asked to change what the product shows them once they are inside it.
    const types = body.all || !body.type
      ? [...REMINDER_TYPES]
      : (REMINDER_TYPES as readonly string[]).includes(body.type) ? [body.type as ReminderType] : [];
    if (types.length === 0) return reply.status(400).send({ success: false, error: 'Unknown reminder type.' });

    for (const t of types) await repo.setPreference(user.id, t, false);
    return reply.send({ success: true, data: { email: user.email, types } });
  });

  /**
   * Turn one back on, from the same link.
   *
   * The page could only switch things off, so a misclick was permanent for
   * anyone not signed in. Deliberately one type at a time and never "all":
   * re-enabling in bulk from an emailed link is the shape of thing that should
   * not be possible by replaying a URL.
   */
  fastify.post('/v1/unsubscribe/resume', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as { token?: string; type?: string }) || {};
    const user = body.token ? await repo.userForUnsubscribeToken(body.token) : null;
    if (!user) return reply.status(404).send({ success: false, error: 'That link is not valid.' });
    if (!body.type || !(REMINDER_TYPES as readonly string[]).includes(body.type)) {
      return reply.status(400).send({ success: false, error: 'Unknown reminder type.' });
    }
    await repo.setPreference(user.id, body.type as ReminderType, true);
    return reply.send({ success: true, data: { email: user.email, type: body.type } });
  });

  /** What an unsubscribe link is for, so the page can name it before acting. */
  fastify.get('/v1/unsubscribe', async (request: FastifyRequest, reply: FastifyReply) => {
    const { t } = (request.query as { t?: string }) || {};
    const user = t ? await repo.userForUnsubscribeToken(t) : null;
    if (!user) return reply.status(404).send({ success: false, error: 'That link is not valid.' });
    return reply.send({
      success: true,
      data: { email: user.email, preferences: await repo.preferences(user.id) },
    });
  });

  // ------------------------------------------------------- in-app preferences

  fastify.get('/v1/me/email-preferences', { preHandler: [authenticate] },
    (async (request: AuthenticatedRequest, reply: FastifyReply) => {
      return reply.send({ success: true, data: await repo.preferences(request.user!.id) });
    }) as any);

  fastify.patch('/v1/me/email-preferences', { preHandler: [authenticate] },
    (async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const body = (request.body as Record<string, unknown>) || {};
      for (const t of PREFERENCE_KEYS) {
        if (typeof body[t] === 'boolean') {
          await repo.setPreference(request.user!.id, t as PreferenceKey, body[t] as boolean);
        }
      }
      return reply.send({ success: true, data: await repo.preferences(request.user!.id) });
    }) as any);
}
