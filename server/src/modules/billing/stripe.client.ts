import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Stripe over plain `fetch`, deliberately without the SDK.
 *
 * The same call this codebase already made for Anthropic in brain.enrich.ts:
 * the server carries very few dependencies, and adding one risks the Render
 * build (see the typescript-in-dependencies trap). It matters more than usual
 * here, because `server/` has BOTH a package-lock.json and a pnpm-lock.yaml
 * which have already drifted months apart — installing a package updates one
 * and not the other, and Render installs from the one that would be missing it.
 *
 * The surface we need is four calls and a signature check. That is a poor trade
 * for a dependency that could silently break a deploy.
 *
 * NOTHING HERE RUNS WITHOUT KEYS. Every call checks `isConfigured()` first and
 * fails with a clear message, so the server starts and behaves exactly as it
 * does today until STRIPE_SECRET_KEY exists.
 */

const API = 'https://api.stripe.com/v1';

export const stripeSecret = (): string => process.env.STRIPE_SECRET_KEY || '';
export const isConfigured = (): boolean => stripeSecret().startsWith('sk_');

/** True while pointing at Stripe test data — surfaced so the UI can say so. */
export const isTestMode = (): boolean => stripeSecret().startsWith('sk_test_');

export class StripeNotConfigured extends Error {
  constructor() {
    super('Billing is not configured yet.');
    this.name = 'StripeNotConfigured';
  }
}

/**
 * Stripe takes form-encoded bodies, including for nested structures, which it
 * expresses as `a[b][c]`. Arrays are indexed: `items[0][price]`.
 */
function formEncode(obj: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? prefix + '[' + k + ']' : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        const idx = key + '[' + i + ']';
        if (item !== null && typeof item === 'object') {
          parts.push(formEncode(item as Record<string, unknown>, idx));
        } else {
          parts.push(encodeURIComponent(idx) + '=' + encodeURIComponent(String(item)));
        }
      });
    } else if (typeof v === 'object') {
      parts.push(formEncode(v as Record<string, unknown>, key));
    } else {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
    }
  }
  return parts.filter(Boolean).join('&');
}

async function call<T>(
  path: string,
  body?: Record<string, unknown>,
  method?: 'GET' | 'POST' | 'DELETE'
): Promise<T> {
  if (!isConfigured()) throw new StripeNotConfigured();

  const res = await fetch(API + path, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: {
      Authorization: 'Bearer ' + stripeSecret(),
      'Content-Type': 'application/x-www-form-urlencoded',
      // Pinned so Stripe changing their default cannot alter the shape of what
      // we parse without us choosing it.
      'Stripe-Version': '2024-06-20',
    },
    ...(body ? { body: formEncode(body) } : {}),
  });

  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    // Stripe puts a human-readable reason in error.message; surfacing it beats
    // a bare status when something is misconfigured.
    throw new Error(json?.error?.message || 'Stripe request failed (' + res.status + ')');
  }
  return json as T;
}

export interface CheckoutSession { id: string; url: string }

/**
 * A hosted Checkout session. Returns a URL the browser is redirected to — no
 * card details ever reach Finquanta, which is what keeps us out of PCI scope.
 *
 * `quantity` is the seat count: billing is per seat and Stripe multiplies the
 * unit price by it.
 */
export async function createCheckoutSession(input: {
  priceId: string;
  quantity: number;
  businessId: string;
  customerId?: string | null;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSession> {
  return call<CheckoutSession>('/checkout/sessions', {
    mode: 'subscription',
    line_items: [{ price: input.priceId, quantity: Math.max(1, input.quantity) }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    /**
     * An EXISTING customer is reused, and only a first-time buyer is identified
     * by email.
     *
     * `customer_email` makes Stripe mint a brand-new customer every time. For
     * someone who has bought before — cancelled and come back, say — that means
     * a second customer object holding the same person's card and invoices,
     * while our stored `stripe_customer_id` gets overwritten and their history
     * is orphaned under an id nothing points at any more.
     *
     * Stripe rejects both fields together, so this is an either/or.
     */
    ...(input.customerId
      ? { customer: input.customerId }
      : input.customerEmail
        ? { customer_email: input.customerEmail }
        : {}),
    // Which business is paying. Carried on the session AND copied onto the
    // subscription, because the webhook that grants the plan reads the
    // subscription, not the session.
    metadata: { business_id: input.businessId },
    subscription_data: { metadata: { business_id: input.businessId } },
  });
}

export interface PortalSession { id: string; url: string }

/** Stripe-hosted portal: payment method, invoices, cancellation. */
export async function createPortalSession(input: {
  customerId: string;
  returnUrl: string;
}): Promise<PortalSession> {
  return call<PortalSession>('/billing_portal/sessions', {
    customer: input.customerId,
    return_url: input.returnUrl,
  });
}

export async function getSubscription(id: string): Promise<any> {
  return call<any>('/subscriptions/' + encodeURIComponent(id));
}

/** Stripe statuses in which a subscription is still a live billing relationship. */
const LIVE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid'];
export const isLiveSubscription = (sub: any): boolean =>
  !!sub && LIVE_STATUSES.includes(sub.status);

/**
 * The one line we bill on.
 *
 * Every Finquanta subscription is a single price times a seat count, so there
 * is exactly one item — but Stripe models items as a list, and both updates
 * below have to address that item by ID rather than by position.
 */
function primaryItem(sub: any): { id: string; priceId: string | null; quantity: number } | null {
  const item = sub?.items?.data?.[0];
  if (!item?.id) return null;
  return {
    id: item.id,
    priceId: item.price?.id ?? null,
    quantity: Number(item.quantity) || 1,
  };
}

/**
 * Move an existing subscription onto a different price — the plan change.
 *
 * THIS IS WHY IT EXISTS: starting a second Checkout session for a customer who
 * already subscribes does not replace anything. Stripe creates a SECOND live
 * subscription alongside the first and charges for both, and the customer has
 * to notice the double charge themselves. Switching the price on the
 * subscription they already have is the only way a plan change is a change.
 *
 * `invoiceNow` decides how the money is handled, and the two cases are not
 * symmetrical:
 *  - upgrading -> invoice immediately. The customer pays the difference now and
 *    `invoice.paid` grants the new plan through the usual route.
 *  - downgrading -> `proration_behavior: 'none'`. NO money moves at all: no
 *    charge, no credit. They have already paid for this period and they keep
 *    what they paid for until it ends; the cheaper price simply applies from
 *    the next invoice. The matching half is on our side, where the plan change
 *    is scheduled rather than applied, so the features do not disappear
 *    mid-month for something already bought.
 */
export async function changeSubscriptionPrice(input: {
  subscriptionId: string;
  priceId: string;
  quantity: number;
  invoiceNow: boolean;
}): Promise<any> {
  const sub = await getSubscription(input.subscriptionId);
  const item = primaryItem(sub);
  if (!item) throw new Error('That subscription has no billable item to change.');

  return call<any>('/subscriptions/' + encodeURIComponent(input.subscriptionId), {
    items: [{ id: item.id, price: input.priceId, quantity: Math.max(1, input.quantity) }],
    proration_behavior: input.invoiceNow ? 'always_invoice' : 'none',
    // Someone changing plan is staying, so retract any pending cancellation.
    cancel_at_period_end: false,
  });
}

/**
 * Re-point the seat quantity at the real member count.
 *
 * Billing is per seat, but the quantity was only ever set once — at checkout.
 * A team that grows from one to five afterwards keeps paying for one, which is
 * the bug this closes.
 *
 * Prorations are held for the next invoice rather than billed immediately: a
 * charge landing every time somebody accepts an invite would be both alarming
 * and, for a few dollars, mostly bank fees.
 *
 * Returns `changed: false` without calling Stripe when the count already
 * matches, so this is safe to call on every membership change.
 */
export async function syncSubscriptionQuantity(input: {
  subscriptionId: string;
  quantity: number;
}): Promise<{ changed: boolean; from: number; to: number }> {
  const quantity = Math.max(1, input.quantity);
  const sub = await getSubscription(input.subscriptionId);
  if (!isLiveSubscription(sub)) return { changed: false, from: 0, to: quantity };

  const item = primaryItem(sub);
  if (!item) return { changed: false, from: 0, to: quantity };
  if (item.quantity === quantity) return { changed: false, from: item.quantity, to: quantity };

  await call<any>('/subscriptions/' + encodeURIComponent(input.subscriptionId), {
    items: [{ id: item.id, quantity }],
    proration_behavior: 'create_prorations',
  });
  return { changed: true, from: item.quantity, to: quantity };
}

/**
 * Schedule a cancellation for the end of the paid period — or call one off.
 *
 * Not the same as `cancelSubscription`, and the difference matters. This is
 * somebody choosing to stop: they have paid for the days in front of them and
 * keep the product until those run out, which is the same rule downgrades
 * follow. `cancelSubscription` is for when the thing being paid for has ceased
 * to exist, where there is nothing left to keep.
 *
 * Reversible on purpose. People change their minds, and having to buy the plan
 * again to undo a cancellation you have not yet been charged for is a poor
 * answer.
 */
export async function setCancelAtPeriodEnd(id: string, cancel: boolean): Promise<any> {
  return call<any>('/subscriptions/' + encodeURIComponent(id), {
    cancel_at_period_end: cancel,
  });
}

/**
 * Cancel a subscription immediately.
 *
 * Used when the thing being paid for stops existing — an account closed, a
 * workspace deleted. Without this, Stripe carries on charging a card every
 * month for a product the customer can no longer open, which is the kind of
 * billing they dispute rather than email about.
 *
 * Immediate rather than at-period-end, deliberately. A scheduled cancellation
 * assumes someone is still using it until then; here there is nothing left to
 * use. No refund is issued — that is a judgement call for a human, and quietly
 * refunding is as surprising as quietly not.
 */
export async function cancelSubscription(id: string): Promise<void> {
  await call<any>('/subscriptions/' + encodeURIComponent(id), undefined, 'DELETE');
}

/**
 * Verify a webhook actually came from Stripe.
 *
 * THE MOST SECURITY-CRITICAL FUNCTION IN THE BILLING CODE. The endpoint is
 * public and it grants plans. Without verification, anyone who found the URL
 * could POST `invoice.paid` and hand themselves Corporate.
 *
 * Stripe's scheme: the header carries a timestamp and one or more v1
 * signatures. The signed payload is `<timestamp>.<rawBody>`, HMAC-SHA256 with
 * the endpoint secret.
 *
 * Three things this gets right deliberately:
 *  - compares with `timingSafeEqual`, never `===`, so the comparison cannot be
 *    used as an oracle to recover the signature byte by byte;
 *  - enforces a timestamp tolerance, so a genuine old request cannot be
 *    captured and replayed later;
 *  - verifies against the RAW body. Parsing to JSON and re-stringifying changes
 *    bytes (key order, spacing) and every signature would fail.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  toleranceSeconds = 300,
  now = Math.floor(Date.now() / 1000)
): { ok: true } | { ok: false; reason: string } {
  if (!secret) return { ok: false, reason: 'no_secret_configured' };
  if (!signatureHeader) return { ok: false, reason: 'missing_signature' };

  let timestamp = '';
  const signatures: string[] = [];
  for (const part of signatureHeader.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === 't') timestamp = v;
    if (k === 'v1') signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return { ok: false, reason: 'malformed_signature' };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'malformed_signature' };
  if (Math.abs(now - ts) > toleranceSeconds) {
    return { ok: false, reason: 'timestamp_out_of_tolerance' };
  }

  const expected = createHmac('sha256', secret)
    .update(timestamp + '.' + rawBody, 'utf8')
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');

  // Stripe may send several signatures during a secret rotation; any match is
  // valid. Length is compared first because timingSafeEqual throws on mismatch.
  const matched = signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, 'utf8');
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });

  return matched ? { ok: true } : { ok: false, reason: 'signature_mismatch' };
}
