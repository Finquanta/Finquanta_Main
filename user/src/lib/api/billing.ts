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
  /**
   * Whether a real Stripe subscription exists. Not the same as `status ===
   * 'active'`, which is also true of a plan an admin granted by hand.
   */
  hasStripeSubscription: boolean;
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
   * The trial has lapsed and this workspace has not been asked what it wants to
   * do about it yet. True at most once per workspace — the server stamps the
   * row, so it is not a client-side "have I shown this" flag that a cleared
   * browser would forget.
   */
  trialEnded: boolean;
  /**
   * A trial has just started and nobody has been told. One-shot: a trial
   * begins once, so a second telling would say something already known.
   */
  trialStarted: boolean;
  /**
   * Free access was granted, extended or shortened since this workspace was
   * last told. Shown to every member — it changes what the workspace can do,
   * not just what the owner pays.
   */
  accessChanged: boolean;
  /** When the current free-access window ends. */
  accessUntil: string | null;
  /**
   * Plan allowance consumed this month, per metric. Separate from the daily
   * cost caps in ai-usage: this is what the customer bought, not what protects
   * the AI spend. A limit of null means unlimited.
   */
  usage?: Record<'finna_messages' | 'council_sessions' | 'document_scans', {
    allowed: boolean;
    used: number;
    limit: number | null;
    remaining: number | null;
    period: string;
  }>;
  plans: PlanOption[];
}

/**
 * One member's share of this workspace's allowance, this period.
 *
 * `userId` null means the spend outlived the person — they left or closed
 * their account. It still counts toward the workspace total, so it is shown
 * rather than dropped, otherwise the rows would not add up to the meter.
 */
export interface MemberUsage {
  userId: string | null;
  email: string | null;
  name: string | null;
  role: string | null;
  finnaMessages: number;
  councilSessions: number;
  /** Documents photographed or uploaded. The server has always returned this;
   * it was simply not read until the scan meter needed it. */
  documentScans: number;
}

/** Who in this workspace has used what. Workspace-scoped by the active header. */
export async function getMemberUsage(): Promise<MemberUsage[]> {
  return apiFetch<MemberUsage[]>('/v1/billing/usage/members');
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

/**
 * Put the end-of-trial prompt away for good.
 *
 * Called for every outcome — bought a plan, chose to stay free, or closed the
 * dialog. All three are an answer, and none of them should be asked twice.
 */
export async function dismissTrialPrompt(which: 'start' | 'end' = 'end'): Promise<{ claimed: boolean }> {
  return apiFetch('/v1/billing/trial-prompt/seen', {
    method: 'POST',
    body: JSON.stringify({ which }),
  });
}

/** Acknowledge the free-access notice so it is not shown again. */
export async function dismissAccessNotice(): Promise<{ acknowledged: boolean }> {
  return apiFetch('/v1/billing/access-notice/seen', { method: 'POST' });
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
