import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { BillingRepository } from './billing.repository';
import { EntitlementsService } from './entitlements.service';
import { isPlanKey, PLAN_KEYS, PlanKey, SELF_SERVE_PLANS } from './plans';
import {
  changeSubscriptionPrice, createCheckoutSession, createPortalSession, getSubscription,
  isConfigured, isLiveSubscription, isTestMode, StripeNotConfigured,
} from './stripe.client';

/**
 * Buying and managing a subscription — spec 08 §3, "Billing infrastructure".
 *
 * The rule that shapes this file: **the client says WHICH PLAN, the server
 * decides what it costs.** The old /payment page took the amount from the query
 * string (`?plan=entrepreneur&price=49.99`), which anyone could edit. Here a
 * request carries a plan key and an interval; the price id comes from env and
 * the quantity from the member count. Nothing about money is accepted from a
 * browser.
 */

type Interval = 'monthly' | 'yearly';

/**
 * Plan + interval -> the Stripe price id, from env.
 *
 * Env rather than hardcoded because test and live prices are different objects
 * with different ids. Going live is changing values on Render, not editing code.
 */
function priceIdFor(plan: PlanKey, interval: Interval): string | null {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;
  return process.env[key] || null;
}

/** Plan ordering, for telling an upgrade from a downgrade. */
const rank = (plan: PlanKey): number => PLAN_KEYS.indexOf(plan);

export async function stripeRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const billing = new BillingRepository(options.database);
  const entitlements = new EntitlementsService(options.database);
  const pre = [authenticate, withBusiness(options.database)];

  /**
   * Whether billing is switched on, so the UI can hide buy buttons entirely —
   * and whether it is pointed at TEST data.
   *
   * `testMode` is surfaced because the site can be live while the keys are not.
   * In that window a test card completes checkout, the webhook grants the plan
   * and everything looks exactly like a real sale. Somebody has to be told, or
   * the first real evidence is an empty Stripe balance.
   */
  fastify.get('/v1/billing/status', { preHandler: pre }, (async (_request: AuthenticatedRequest, reply: FastifyReply) => {
    return reply.send({ success: true, data: { configured: isConfigured(), testMode: isTestMode() } });
  }) as any);

  /**
   * Start checkout. Returns a Stripe-hosted URL for the browser to visit — no
   * card details ever reach us, which is what keeps Finquanta out of PCI scope.
   */
  fastify.post('/v1/billing/checkout', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    // Declared out here so the error handler can name which plan and which
    // price id failed — the two things needed to diagnose a misconfiguration.
    let attempted: { plan?: string; interval?: string; priceId?: string | null } = {};
    try {
      const businessId = request.businessId!;
      const body = (request.body as { plan?: string; interval?: string }) || {};
      const interval: Interval = body.interval === 'yearly' ? 'yearly' : 'monthly';
      attempted = { plan: body.plan, interval };

      if (!isPlanKey(body.plan) || !SELF_SERVE_PLANS.includes(body.plan) || body.plan === 'freemium') {
        // Freemium needs no checkout and Corporate is a conversation, not a
        // button — spec 08 prices it by negotiation.
        return reply.status(400).send({
          success: false,
          error: 'That plan cannot be bought online. Contact us about Corporate.',
        });
      }

      const priceId = priceIdFor(body.plan, interval);
      attempted.priceId = priceId;
      if (!priceId) {
        return reply.status(503).send({
          success: false,
          error: 'That plan is not available for purchase yet.',
        });
      }

      // Seats = members. Read server-side; a client-supplied quantity would let
      // someone buy one seat for a team of ten.
      const seats = await entitlements.seatCount(businessId);
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const sub = await billing.get(businessId);

      /**
       * ALREADY SUBSCRIBED? CHANGE THE SUBSCRIPTION. DO NOT SELL A SECOND ONE.
       *
       * This is the whole reason the handler branches. Checkout creates a NEW
       * subscription every time it runs — so an Entrepreneur customer pressing
       * "Business" here used to end up paying for both, with no sign anything
       * was wrong until the second charge appeared on their statement.
       *
       * The decision is made from STRIPE's copy, not ours: our row can lag a
       * webhook, and the failure we are guarding against is precisely the one
       * where we bill twice for believing the wrong thing. If Stripe cannot be
       * reached, we do NOT fall through to checkout — an unknown state is the
       * exact case where a second subscription gets created.
       */
      const existing = sub?.stripeSubscriptionId
        ? await getSubscription(sub.stripeSubscriptionId)
        : null;

      if (isLiveSubscription(existing)) {
        const currentPlan: PlanKey = sub!.plan;
        const alreadyOnPrice = existing?.items?.data?.[0]?.price?.id === priceId;
        if (alreadyOnPrice) {
          /**
           * Stripe already has them on this price. Either they really are on
           * this plan — or OUR row is stale and disagrees.
           *
           * The second case used to be a dead end: the record said Entrepreneur,
           * the customer clicked Business, and the server refused with "that is
           * already your current plan" — an answer that contradicted the screen
           * they were looking at and left them stuck with no way forward.
           *
           * Stripe is the authority on what is being billed, so a disagreement
           * is repaired here rather than reported. Safe to do without waiting
           * for a payment: the charge already happened, which is why Stripe is
           * on this price at all.
           */
          if (currentPlan !== body.plan) {
            await billing.setPlan(businessId, body.plan);
            return reply.send({
              success: true,
              data: { changed: true, plan: body.plan, interval, pending: false },
            });
          }
          return reply.status(400).send({
            success: false,
            error: 'That is already your current plan.',
          });
        }

        const upgrade = rank(body.plan) > rank(currentPlan);
        await changeSubscriptionPrice({
          subscriptionId: sub!.stripeSubscriptionId!,
          priceId,
          quantity: seats,
          // Upgrades bill the difference now; downgrades credit it forward.
          invoiceNow: upgrade,
        });

        if (upgrade) {
          /**
           * Upgrades are NOT written here. Access follows the money:
           * `invoice.paid` grants it once the charge clears. Granting now would
           * hand out a plan on a SEPA or ACH debit that has not settled.
           */
          return reply.send({
            success: true,
            data: { changed: true, plan: body.plan, interval, pending: true },
          });
        }

        /**
         * A downgrade is SCHEDULED for the end of the period they have paid for.
         *
         * Nothing changes today — not the features, not the money. Taking the
         * higher plan away mid-month reads as a fault however carefully the
         * refund is explained, and refunding a period they are still using is
         * an odd trade for both sides.
         */
        const periodEnd = existing?.current_period_end
          ?? existing?.items?.data?.[0]?.current_period_end;
        const effectiveAt = periodEnd
          ? new Date(Number(periodEnd) * 1000).toISOString()
          // No date from Stripe (should not happen on a live subscription):
          // fall back to a month out rather than applying it immediately.
          : new Date(Date.now() + 30 * 86_400_000).toISOString();

        await billing.schedulePlanChange(businessId, body.plan, effectiveAt);

        return reply.send({
          success: true,
          data: {
            changed: true, plan: body.plan, interval, pending: false,
            scheduledFor: effectiveAt,
          },
        });
      }

      const session = await createCheckoutSession({
        priceId,
        quantity: seats,
        businessId,
        // Reuse the customer if this business has bought before — see the
        // comment on createCheckoutSession for what a duplicate costs.
        customerId: sub?.stripeCustomerId ?? null,
        customerEmail: request.user?.email ?? null,
        successUrl: `${appUrl}/payment-success`,
        cancelUrl: `${appUrl}/pricing`,
      });

      return reply.send({ success: true, data: { url: session.url } });
    } catch (error) {
      if (error instanceof StripeNotConfigured) {
        return reply.status(503).send({ success: false, error: error.message });
      }

      /**
       * A price from the WRONG STRIPE MODE, named as such.
       *
       * Test and live are separate object spaces: a live price id is invisible
       * to a test key and vice versa. It is an easy mistake — the ids look
       * identical, and the only place they are distinguished is the dashboard
       * you copied them from — and the failure it causes is a generic "could
       * not start checkout" that says nothing about the cause. The likeliest
       * moment for it is go-live, when the key changes on Render and one of the
       * four price variables is left behind.
       *
       * Stripe says exactly what is wrong in its own message; this just refuses
       * to bury it. 503, not 502: nothing is broken upstream, we are
       * misconfigured.
       */
      const message = error instanceof Error ? error.message : '';
      if (message.includes('a similar object exists in')) {
        request.log.error(
          attempted,
          'Stripe price id belongs to the other mode (test vs live) — check STRIPE_PRICE_* against STRIPE_SECRET_KEY'
        );
        return reply.status(503).send({
          success: false,
          error: 'Billing is misconfigured: that plan is set up in a different Stripe mode. Contact support.',
        });
      }

      request.log.error(error);
      return reply.status(502).send({ success: false, error: 'Could not start checkout.' });
    }
  }) as any);

  /**
   * Stripe's own portal: payment method, invoices, cancellation. Spec 08 says
   * use theirs rather than building it, and this is the whole integration.
   */
  fastify.post('/v1/billing/portal', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const businessId = request.businessId!;
      const sub = await billing.get(businessId);
      if (!sub?.stripeCustomerId) {
        // Nothing has ever been bought, so Stripe has no customer to manage.
        return reply.status(400).send({
          success: false,
          error: 'There is no subscription to manage yet.',
        });
      }
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const session = await createPortalSession({
        customerId: sub.stripeCustomerId,
        returnUrl: `${appUrl}/settings`,
      });
      return reply.send({ success: true, data: { url: session.url } });
    } catch (error) {
      if (error instanceof StripeNotConfigured) {
        return reply.status(503).send({ success: false, error: error.message });
      }
      request.log.error(error);
      return reply.status(502).send({ success: false, error: 'Could not open the billing portal.' });
    }
  }) as any);
}
