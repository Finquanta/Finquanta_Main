import { apiFetch } from './client';

/**
 * The signed-in user's own plan state (spec 08 §3).
 *
 * `plan` is what they pay for; `effectivePlan` is what they can currently use.
 * Those differ during a trial or a grandfather window, and `reason` says which.
 * The UI should show the plan name but gate on `features`.
 */

export interface PlanFeatures {
  brainGraph: boolean;
  brainBacklinks: boolean;
  brainAutoAI: boolean;
  council: boolean;
  forecasting: boolean;
  multipleBusinesses: boolean;
  portfolio: boolean;
}

export interface PlanOption {
  key: string;
  name: string;
  monthly: number;
  annual: number;
  contactSales: boolean;
  selfServe: boolean;
  features: PlanFeatures;
}

export interface MyBilling {
  plan: string;
  planName: string;
  effectivePlan: string;
  effectivePlanName: string;
  reason: 'plan' | 'trial' | 'grandfathered';
  features: PlanFeatures;
  limits: {
    finnaMessagesPerMonth: number | null;
    councilSessionsPerMonth: number | null;
    groups: number | null;
    importsPerMonth: number | null;
    businesses: number | null;
  };
  status: string;
  seats: number;
  trialEndsAt: string | null;
  grandfatheredUntil: string | null;
  /**
   * When a scheduled cancellation takes effect. The subscription is fully
   * usable until then, which is why this is a notice rather than a downgrade.
   */
  cancelAt: string | null;
  /**
   * What to call the current plan: what is being PAID FOR when anything is,
   * otherwise the window granting access. Same rule as the business switcher
   * and the admin panel, so the three cannot disagree.
   */
  badgeLabel: string;
  /** A downgrade already chosen, taking effect at `pendingPlanAt`. */
  pendingPlan: string | null;
  pendingPlanName: string | null;
  pendingPlanAt: string | null;
  /** When the current paid period ends — the renewal date, when not cancelling. */
  currentPeriodEnd: string | null;
  /** Days left on a trial or grandfather window; null when neither applies. */
  daysRemaining: number | null;
  trialAvailable: boolean;
  /**
   * Plan allowance consumed this month, per metric. Separate from the daily
   * cost caps in ai-usage: this is what the customer bought, not what protects
   * the AI spend. A limit of null means unlimited.
   */
  usage?: Record<'finna_messages' | 'council_sessions', {
    allowed: boolean;
    used: number;
    limit: number | null;
    remaining: number | null;
    period: string;
  }>;
  plans: PlanOption[];
}

export async function getMyBilling(): Promise<MyBilling> {
  return apiFetch<MyBilling>('/v1/billing/me');
}

/** Once per workspace. Length depends on whether the email is verified. */
export async function startMyTrial(): Promise<{ trialEndsAt: string | null; days: number; verified: boolean }> {
  return apiFetch('/v1/billing/trial', { method: 'POST' });
}

/**
 * Start checkout. Returns a Stripe-hosted URL to send the browser to.
 *
 * Sends only the plan key and interval — the server looks up the price and
 * reads the seat count itself. A price that arrives from a browser is never
 * trusted, which is the hole the old /payment?price=49.99 link left open.
 */
/**
 * Two outcomes, decided by the SERVER, not here.
 *
 * A first purchase returns a Stripe Checkout `url` to redirect to. A customer
 * who already subscribes gets `changed: true` instead — their existing
 * subscription was moved onto the new price, because running Checkout again
 * would have sold them a second subscription alongside the first and charged
 * for both. The client must never make that call itself: getting it wrong
 * costs the customer real money, so the decision lives where it can be made
 * from Stripe's own state.
 *
 * `pending` marks an upgrade, where the new plan appears once the payment
 * clears rather than instantly.
 */
export interface CheckoutOutcome {
  url?: string;
  changed?: boolean;
  plan?: string;
  interval?: 'monthly' | 'yearly';
  pending?: boolean;
}

export async function startCheckout(
  plan: string,
  interval: 'monthly' | 'yearly'
): Promise<CheckoutOutcome> {
  return apiFetch('/v1/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan, interval }),
  });
}

/** Open Stripe's hosted portal: payment method, invoices, cancellation. */
export async function openBillingPortal(): Promise<{ url: string }> {
  return apiFetch('/v1/billing/portal', { method: 'POST' });
}

/** Whether billing is switched on at all, so buy buttons can stay hidden. */
export async function getBillingStatus(): Promise<{ configured: boolean; testMode: boolean }> {
  return apiFetch('/v1/billing/status');
}

/**
 * Cancel at the end of the paid period, or call that cancellation off.
 *
 * `resume: true` undoes a pending cancellation. Nothing is lost either way —
 * the plan runs to the date already paid for, and the books are never touched.
 */
export async function setPlanCancellation(
  resume = false
): Promise<{ cancelled: boolean; endsAt: number | string | null }> {
  return apiFetch('/v1/billing/cancel', {
    method: 'POST',
    body: JSON.stringify({ resume }),
  });
}
