import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { BillingRepository } from './billing.repository';
import { isPlanKey, PlanKey, PLAN_KEYS } from './plans';
import { verifyWebhookSignature } from './stripe.client';
import { SubscriptionExpenseService } from './subscription-expense';

/**
 * Stripe webhooks — spec 08: "Webhooks are the source of truth for
 * entitlements... never from the client-side redirect, which can be spoofed or
 * simply missed."
 *
 * PUBLIC AND UNAUTHENTICATED, because Stripe's servers call it. That makes the
 * signature check the only thing standing between this endpoint and a stranger
 * granting themselves Corporate, so it runs before anything is read or written.
 *
 * ACCESS IS GRANTED ON `invoice.paid`, NOT ON CHECKOUT COMPLETION. A card
 * authorises in seconds, but SEPA and ACH debits settle over days and can fail
 * afterwards. Treating "they finished checkout" as "they paid" would hand out
 * plans for money that never arrives.
 */

/** Reverse of the price-id lookup: which plan does this Stripe price sell? */
function planForPriceId(priceId: string | null | undefined): PlanKey | null {
  if (!priceId) return null;
  for (const plan of PLAN_KEYS) {
    for (const interval of ['MONTHLY', 'YEARLY']) {
      const env = process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${interval}`];
      if (env && env === priceId) return plan;
    }
  }
  return null;
}

/**
 * Which plan a PAID INVOICE actually bought.
 *
 * Not `lines.data[0]`, which is the bug this replaces. A plan change produces a
 * PRORATION invoice with two lines: a credit for the unused part of the old
 * plan, and a charge for the new one. Stripe does not promise an order, and the
 * credit frequently comes first — so reading the first line made an upgrade to
 * Business set the plan back to Entrepreneur, leaving our record contradicting
 * Stripe and the customer unable to switch ("that is already your current
 * plan") because the server could see what our own row could not.
 *
 * The rule that holds in both directions: consider only lines with a POSITIVE
 * amount — money charged, not credited — and take the highest-ranked plan among
 * them. Upgrading, the positive line is the new, higher plan. Downgrading, the
 * credit is for the old higher plan and the charge is for the new lower one. A
 * plain renewal has a single positive line and is unaffected.
 */
function planFromInvoice(invoice: any): PlanKey | null {
  const lines: any[] = invoice?.lines?.data ?? [];
  const priceOf = (l: any) => l?.price?.id ?? l?.pricing?.price_details?.price;

  const charged = lines
    .filter((l) => Number(l?.amount) > 0)
    .map((l) => planForPriceId(priceOf(l)))
    .filter((p): p is PlanKey => !!p);

  if (charged.length > 0) {
    return charged.reduce((a, b) => (PLAN_KEYS.indexOf(b) > PLAN_KEYS.indexOf(a) ? b : a));
  }

  // No positive line we recognise — a fully credited change, say. Fall back to
  // any line we do recognise rather than ignoring the invoice entirely.
  for (const l of lines) {
    const plan = planForPriceId(priceOf(l));
    if (plan) return plan;
  }
  return null;
}

/**
 * Exported for tests only. The rule above is the one that broke a real upgrade,
 * so it is pinned directly rather than through a whole webhook round trip.
 */
export const planFromInvoiceForTest = planFromInvoice;

export async function stripeWebhookRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const billing = new BillingRepository(options.database);
  const expenses = new SubscriptionExpenseService(options.database);

  /**
   * The raw body is required: signatures are computed over the exact bytes
   * Stripe sent. Fastify's JSON parser would hand us a parsed object, and
   * re-stringifying it changes key order and spacing, so every signature would
   * fail. Scoped to this route by `addContentTypeParser` on the encapsulated
   * instance, so no other endpoint loses JSON parsing.
   */
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req: FastifyRequest, body: string, done: (err: Error | null, result?: unknown) => void) => {
      done(null, body);
    }
  );

  fastify.post('/v1/billing/webhook', (async (request: FastifyRequest, reply: FastifyReply) => {
    const raw = typeof request.body === 'string' ? request.body : '';
    const signature = request.headers['stripe-signature'] as string | undefined;

    const verdict = verifyWebhookSignature(
      raw, signature, process.env.STRIPE_WEBHOOK_SECRET || ''
    );
    if (!verdict.ok) {
      // Deliberately terse to the caller — a detailed reason would help someone
      // probe the endpoint. The detail goes to our logs instead.
      request.log.warn({ reason: verdict.reason }, 'Rejected a Stripe webhook');
      return reply.status(400).send({ received: false });
    }

    let event: any;
    try {
      event = JSON.parse(raw);
    } catch {
      return reply.status(400).send({ received: false });
    }

    try {
      await handle(event);
    } catch (error) {
      // Return 500 so Stripe RETRIES. Swallowing the error would return 200 and
      // the event would never come back, silently losing a payment.
      request.log.error({ error, type: event?.type }, 'Webhook handler failed');
      return reply.status(500).send({ received: false });
    }

    // 200 tells Stripe to stop retrying. Sent for unhandled event types too:
    // they are not failures, we simply do not act on them.
    return reply.send({ received: true });
  }) as any);

  async function handle(event: any): Promise<void> {
    const object = event?.data?.object ?? {};

    switch (event?.type) {
      /**
       * Money actually arrived. This is the event that grants a plan.
       */
      case 'invoice.paid': {
        const businessId = await businessIdFor(object);
        if (!businessId) return;

        const plan = planFromInvoice(object);
        if (!plan) return; // a price we do not sell — nothing to grant

        await billing.setPlan(businessId, plan);
        await billing.linkStripe(businessId, {
          customerId: object?.customer ?? null,
          subscriptionId: object?.subscription ?? null,
        });

        // Book what they just paid us as an expense in their own books. Runs
        // AFTER the plan is granted and cannot throw, so a bookkeeping problem
        // can never cost someone the thing they have paid for.
        await expenses.recordFromInvoice(businessId, object);
        return;
      }

      /**
       * Renewal, plan change or cancellation scheduled. Keeps our copy of the
       * dates in step with what Stripe will actually charge — spec 08 §4.2 is
       * explicit that the admin panel must display Stripe's dates rather than
       * compute its own.
       */
      case 'customer.subscription.updated': {
        const businessId = await businessIdFor(object);
        if (!businessId) return;

        /**
         * A price change seen here is SCHEDULED, never applied on the spot.
         *
         * Both directions wait, for different reasons. An upgrade waits for
         * `invoice.paid`, because this event says the price changed, not that
         * money arrived — a SEPA or ACH debit settles over days and can fail. A
         * downgrade waits for the period end, because the customer has already
         * paid for the days in front of them and should keep what they bought.
         *
         * This also covers a plan changed in STRIPE'S OWN PORTAL rather than
         * ours: without it, they would be billed the new price while we carried
         * on serving the old plan indefinitely.
         */
        const current = await billing.get(businessId);
        const priceId = object?.items?.data?.[0]?.price?.id;
        const priced = planForPriceId(priceId);
        const isDowngrade =
          priced && current && PLAN_KEYS.indexOf(priced) < PLAN_KEYS.indexOf(current.plan);

        if (isDowngrade && priced && current.pendingPlan !== priced) {
          const periodEnd = object?.current_period_end
            ?? object?.items?.data?.[0]?.current_period_end;
          await billing.schedulePlanChange(
            businessId,
            priced,
            periodEnd
              ? new Date(Number(periodEnd) * 1000).toISOString()
              : new Date(Date.now() + 30 * 86_400_000).toISOString()
          );
        }

        await billing.syncFromStripe(businessId, {
          status: object?.status ?? null,
          currentPeriodEnd: object?.current_period_end ?? null,
          cancelAt: object?.cancel_at ?? null,
          customerId: object?.customer ?? null,
          subscriptionId: object?.id ?? null,
        });
        return;
      }

      /**
       * Subscription ended. Drops to freemium — never deletes anything. Spec 08:
       * "Never delete a customer's financial data on downgrade or cancellation."
       */
      case 'customer.subscription.deleted': {
        const businessId = await businessIdFor(object);
        if (!businessId) return;
        await billing.setPlan(businessId, 'freemium');
        await billing.syncFromStripe(businessId, {
          status: 'canceled',
          currentPeriodEnd: object?.current_period_end ?? null,
          cancelAt: object?.cancel_at ?? null,
          customerId: object?.customer ?? null,
          subscriptionId: object?.id ?? null,
        });
        return;
      }

      /**
       * Payment failed. Recorded but NOT downgraded — Stripe retries on its own
       * dunning schedule, and cutting someone off on the first failed charge
       * would punish an expired card.
       */
      case 'invoice.payment_failed': {
        const businessId = await businessIdFor(object);
        if (!businessId) return;
        await billing.syncFromStripe(businessId, { status: 'past_due' });
        return;
      }

      default:
        return; // not an event we act on
    }
  }

  /**
   * Which business does this event belong to?
   *
   * Checkout stamps `metadata.business_id` on the subscription, so that is the
   * first choice. Falling back to the stored stripe ids covers events for
   * subscriptions created outside our checkout — an admin building one by hand
   * in the Stripe dashboard, for instance.
   */
  async function businessIdFor(object: any): Promise<string | null> {
    const fromMetadata = object?.metadata?.business_id
      ?? object?.subscription_details?.metadata?.business_id
      ?? object?.lines?.data?.[0]?.metadata?.business_id;
    if (fromMetadata && isUuid(fromMetadata)) return fromMetadata;

    const subscriptionId = typeof object?.subscription === 'string'
      ? object.subscription
      : (object?.object === 'subscription' ? object?.id : null);
    if (subscriptionId) {
      const found = await billing.findByStripeSubscription(subscriptionId);
      if (found) return found;
    }
    if (typeof object?.customer === 'string') {
      return billing.findByStripeCustomer(object.customer);
    }
    return null;
  }
}

const isUuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// Referenced so the import is not flagged; the guard above is the real use.
void isPlanKey;
