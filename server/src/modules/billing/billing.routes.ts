import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { BillingRepository } from './billing.repository';
import { EntitlementsService } from './entitlements.service';
import { planBadgeFor } from './effective-plan';
import { UsageService } from './usage.service';
import {
  PLANS, PLAN_KEYS, SELF_SERVE_PLANS, TRIAL_DAYS_UNVERIFIED, TRIAL_DAYS_VERIFIED,
} from './plans';

/**
 * What the signed-in user can see about their own plan — spec 08 §3,
 * "Dashboard changes".
 *
 * Read-only apart from starting a trial. Nothing here can change what someone
 * pays: buying is Stripe's job and does not exist yet, and a plan change is an
 * admin action. That keeps the one write on this surface something a user
 * cannot get wrong.
 */
export async function billingRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const billing = new BillingRepository(options.database);
  const entitlements = new EntitlementsService(options.database);
  const usage = new UsageService(options.database);
  const pre = [authenticate, withBusiness(options.database)];

  /**
   * Everything the dashboard needs to render the plan chip, the usage meters
   * and the locked-feature badges, in one request — it is read on nearly every
   * page, so splitting it would mean several round trips per navigation.
   */
  fastify.get('/v1/billing/me', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const businessId = request.businessId!;
      const e = await entitlements.for(businessId);
      // The row `for()` already resolved, rather than a second `billing.get()`
      // — which would re-run the apply-a-due-downgrade UPDATE as well as the
      // SELECT, twice per request, on the endpoint every page load hits.
      const sub = e.subscription;
      // Same resolution again — the meters compare usage against the very plan
      // just worked out above, so handing it in keeps the whole endpoint to one.
      const meters = await usage.summary(businessId, e);

      /**
       * Whether the "start your free trial" prompt should appear at all.
       *
       * Three conditions, and they are the same three the POST enforces — the
       * prompt must not offer something the write will refuse. Once per
       * workspace, once per PERSON (a second workspace does not come with a
       * second trial), and only to the owner, since only the owner can spend it.
       *
       * Ordered cheapest-first so the two extra queries are skipped entirely
       * for everyone whose workspace has already started a trial — which, after
       * onboarding starts one automatically, is nearly every request. `&&`
       * short-circuits, so a workspace already trialing costs neither.
       */
      const trialAvailable =
        !sub?.trialStartedAt
        && !(await billing.hasUsedTrial(request.user!.id))
        && (await billing.isOwnedBy(businessId, request.user!.id));

      /**
       * Whether to show the "your trial has ended — pick a plan" dialog.
       *
       * A lapsed trial is only distinguishable from a running one by DATE:
       * nothing ever moves `status` off 'trialing' when one expires. So the
       * test is a past end date on a workspace still marked trialing, which
       * has not been prompted yet.
       *
       * Excluded deliberately:
       *  - anyone on a paid plan (they already chose; `plan` is the paid one)
       *  - anyone inside a live grandfather window, who has lost nothing yet
       *    and would be asked to buy something they still have for free
       *  - anyone already stamped, so this asks once and never nags
       *
       * Only the owner is asked, for the same reason only the owner can start a
       * trial: a member cannot buy a plan for somebody else's workspace, so
       * prompting them would be a dead end.
       */
      const grandfatherLive = !!sub?.grandfatheredUntil && new Date(sub.grandfatheredUntil) > new Date();
      const trialEnded =
        sub?.status === 'trialing'
        && !!sub?.trialEndsAt
        && new Date(sub.trialEndsAt) <= new Date()
        && e.plan === 'freemium'
        && !grandfatherLive
        && !sub?.trialPromptAt
        && (await billing.isOwnedBy(businessId, request.user!.id));

      return reply.send({
        success: true,
        data: {
          plan: e.plan,
          planName: PLANS[e.plan].name,
          effectivePlan: e.effectivePlan,
          effectivePlanName: PLANS[e.effectivePlan].name,
          reason: e.reason,
          features: e.features,
          limits: e.limits,
          status: e.status,
          seats: e.seats,
          trialEndsAt: e.trialEndsAt,
          grandfatheredUntil: e.grandfatheredUntil,
          daysRemaining: e.daysRemaining,
          trialAvailable,
          /** Show the end-of-trial plan picker once. */
          trialEnded,
          /**
           * When the subscription stops, if a cancellation is scheduled.
           *
           * Stored and synced since Stripe landed, and read by NOTHING until
           * now — so somebody who cancelled in Stripe's portal saw no trace of
           * it here and simply lost access one morning. The subscription stays
           * fully usable until this date; that is what makes it worth showing
           * rather than treating a cancellation as an immediate downgrade.
           */
          cancelAt: sub?.cancelAt ?? null,
          currentPeriodEnd: sub?.currentPeriodEnd ?? null,
          /**
           * A downgrade that has been chosen but not yet taken effect.
           *
           * The customer keeps their current plan until this date — they paid
           * for the period — so the page has to say so, or the change looks
           * like it did not register.
           */
          /**
           * Whether a real Stripe subscription exists.
           *
           * NOT the same as `status === 'active'`, which is also true of a plan
           * an admin granted by hand — there is no subscription behind those,
           * so offering "Cancel plan" would show a button that can only fail.
           */
          hasStripeSubscription: !!sub?.stripeSubscriptionId,
          pendingPlan: sub?.pendingPlan ?? null,
          pendingPlanName: sub?.pendingPlan ? PLANS[sub.pendingPlan].name : null,
          pendingPlanAt: sub?.pendingPlanAt ?? null,
          /**
           * What to CALL their plan, by the same rule the switcher and the
           * admin panel use: the plan being paid for when there is one, and the
           * window only when there is not.
           *
           * Without this the billing page contradicted itself — the header read
           * "Business" (the plan early access grants) while the plan list below
           * marked Entrepreneur as current (the plan being billed). Both were
           * reading a different field, and both were on screen at once.
           */
          badgeLabel: planBadgeFor({
            plan: e.plan,
            status: e.status,
            trialEndsAt: e.trialEndsAt,
            grandfatheredUntil: e.grandfatheredUntil,
          }).label,
          // Spec 08: meters are shown BEFORE someone hits a wall, not after.
          usage: meters,
          // The catalogue, so the upgrade prompts can name a price without a
          // second request or a hardcoded number in the client.
          plans: PLAN_KEYS.map((k) => ({
            key: k,
            name: PLANS[k].name,
            monthly: PLANS[k].monthly,
            annual: PLANS[k].annual,
            contactSales: PLANS[k].contactSales,
            selfServe: SELF_SERVE_PLANS.includes(k),
            features: PLANS[k].features,
          })),
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load your plan.' });
    }
  }) as any);

  /**
   * Claim one Finna message against this month's plan allowance.
   *
   * Called by the Next.js /api/chat route BEFORE it spends an Anthropic call,
   * exactly like /v1/ai/usage/check — and it has to live server-side for the
   * same reason every other entitlement does: the caller is a browser, and a
   * limit the browser enforces is a limit that does not exist.
   *
   * CHECKS AND CHARGES IN ONE CALL. Two round trips to Render sit directly in
   * front of a chat reply, and separating them buys nothing here: the model
   * call that follows almost never fails, and the honest failure mode of
   * charging for a rare error is one message, once a month, in the customer's
   * favour to complain about.
   *
   * A refused caller is NOT charged. Unlike the daily cost cap, retrying past
   * this gains nothing — the month's counter is already at the ceiling, so
   * there is no loop to close by charging failures, and inflating `used` past
   * the limit would only make the meter read like a fault.
   */
  fastify.post('/v1/billing/usage/finna', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const businessId = request.businessId!;
      const check = await usage.check(businessId, 'finna_messages');
      if (!check.allowed) {
        return reply.send({ success: true, data: { ...check, planName: PLANS[(await entitlements.for(businessId)).effectivePlan].name } });
      }
      const used = await usage.record(businessId, 'finna_messages', 1, request.user!.id);
      return reply.send({
        success: true,
        data: { ...check, used, remaining: check.limit === null ? null : Math.max(0, check.limit - used) },
      });
    } catch (error) {
      request.log.error(error);
      /**
       * FAILS OPEN. If metering is broken, Finna still answers.
       *
       * The cost of being wrong each way is not symmetrical: allowing a few
       * uncounted messages costs cents and is bounded anyway by the daily
       * platform cap, while refusing them makes the product look broken to
       * someone who is paying. The daily cap is the guard that must fail
       * closed; this one governs an allowance, not a bill.
       */
      return reply.send({ success: true, data: { allowed: true, used: 0, limit: null, remaining: null, period: '' } });
    }
  }) as any);

  /**
   * Who in this workspace has used what, this period.
   *
   * Workspace-scoped via `withBusiness`, so a member only ever sees the
   * breakdown for a workspace they belong to. Deliberately readable by any
   * member rather than owners only: the point is for a team to see where their
   * shared allowance is going, and hiding that from the people spending it is
   * how a shared quota turns into a surprise.
   */
  fastify.get('/v1/billing/usage/members', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await usage.byUser(request.businessId!) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load member usage.' });
    }
  }) as any);

  /**
   * Start this workspace's trial. Self-serve half of what the user asked for —
   * an admin can also start one from the admin panel.
   *
   * Length follows email verification (spec 08 §4.1): 7 days unverified, 14
   * verified. Verifying later tops it up by 7 through the verification flow,
   * so an unverified user is never worse off for starting early.
   */
  /**
   * Dismiss the end-of-trial plan prompt.
   *
   * Called whether they picked a plan or chose to stay on Freemium — both are
   * an answer, and neither should be asked twice. Staying free is a real choice
   * here, so dismissing is not treated as "ask again later".
   *
   * Idempotent, and says whether this call was the one that claimed the stamp.
   * A dashboard can mount twice (a remount, two tabs), and the guard lives in
   * the WHERE clause so the second caller cannot also think it was first.
   */
  fastify.post('/v1/billing/trial-prompt/seen', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const claimed = await billing.markTrialPromptShown(request.businessId!);
      return reply.send({ success: true, data: { claimed } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not save that.' });
    }
  }) as any);

  fastify.post('/v1/billing/trial', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const businessId = request.businessId!;

      /**
       * ONLY THE OWNER MAY SPEND THE TRIAL.
       *
       * `withBusiness` resolves whatever workspace the caller is a member of —
       * any role, Viewer included — and the client sends that from
       * `localStorage.activeBusinessId`. So the workspace this lands on is not
       * necessarily one the caller owns, and since onboarding now starts the
       * trial automatically, an invitee whose active workspace is the person
       * who invited them would silently spend their one lifetime trial on
       * somebody else's books. They cannot get it back: the claim is per
       * account, and the verification bonus only ever tops up a trial on a
       * workspace they OWN, so the +7 days would find nothing either.
       *
       * 400 rather than 403 — the client reads 401/403 as a dead session and
       * signs people out, and this is a refusal, not an expired login.
       */
      if (!(await billing.isOwnedBy(businessId, request.user!.id))) {
        return reply.status(400).send({
          success: false,
          error: 'Only the owner of this workspace can start its free trial.',
        });
      }

      const existing = await billing.get(businessId);
      if (existing?.trialStartedAt) {
        return reply.status(400).send({
          success: false,
          error: 'This workspace has already used its free trial.',
        });
      }
      /**
       * Checked against the PERSON, not the workspace.
       *
       * Creating workspaces is free and unlimited, so a per-workspace trial is
       * one anybody can have repeatedly just by making another workspace.
       */
      if (await billing.hasUsedTrial(request.user!.id)) {
        return reply.status(400).send({
          success: false,
          error: 'You have already used your free trial. It is one per account.',
        });
      }

      const v = await options.database.query(
        'SELECT email_verified FROM users WHERE id = $1',
        [request.user!.id]
      );
      const days = v.rows[0]?.email_verified ? TRIAL_DAYS_VERIFIED : TRIAL_DAYS_UNVERIFIED;

      const sub = await billing.startTrial(businessId, days, { userId: request.user!.id });

      /**
       * Say so if nothing actually started.
       *
       * `startTrial` returns the subscription either way — it declines quietly
       * when the per-person claim has already been spent, because its usual
       * caller is onboarding, where that is expected rather than an error. The
       * checks above catch the ordinary cases, but a second request arriving
       * while the first is in flight gets past them and loses the claim race.
       * Reporting `days: 14` for a trial that was not granted would leave the
       * page counting down a fortnight the account does not have.
       */
      if (!sub.trialEndsAt) {
        return reply.status(400).send({
          success: false,
          error: 'You have already used your free trial. It is one per account.',
        });
      }

      return reply.send({
        success: true,
        data: { trialEndsAt: sub.trialEndsAt, days, verified: !!v.rows[0]?.email_verified },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not start your trial.' });
    }
  }) as any);
}
