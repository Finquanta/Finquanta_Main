import { PlanKey, PLANS, PLAN_KEYS } from './plans';

/**
 * ONE definition of "which plan is this workspace actually on".
 *
 * There are two honest answers to that question and they are often different:
 * what a workspace is BILLED, and what it can currently USE. A trial or an
 * early-access window grants the second without changing the first.
 *
 * This exists because that rule was written out three times — in the
 * entitlements service, in the business switcher's query, and in the admin
 * panel — and the copies promptly disagreed on screen: the workspace switcher
 * said "Business" beside a workspace the admin panel called "Freemium". Both
 * were reporting something true and neither said which, so it read as a bug.
 *
 * Everything that displays or enforces a plan resolves it HERE.
 */

export interface PlanWindow {
  /** The plan being billed. */
  plan: PlanKey;
  status: string;
  trialEndsAt: string | Date | null;
  grandfatheredUntil: string | Date | null;
}

export interface EffectivePlan {
  key: PlanKey;
  name: string;
  /** Why the effective plan differs from the billed one, when it does. */
  reason: 'plan' | 'trial' | 'grandfathered';
  /** True while a trial or early-access window is granting more than is paid for. */
  onFreeWindow: boolean;
}

const inFuture = (v: string | Date | null): boolean =>
  !!v && new Date(v).getTime() > Date.now();

/** Plan ordering. PLAN_KEYS is declared cheapest-first, which is the ranking. */
export const planRank = (plan: PlanKey): number => PLAN_KEYS.indexOf(plan);

/**
 * The HIGHEST access wins, across billed plan, live trial and early-access
 * window.
 *
 * Taking the best of the three is the only ordering that never removes
 * something a user can already see: someone grandfathered who then buys
 * Business must not be downgraded the day their window ends, and a trial
 * finishing must not take away what a grandfather window still grants.
 */
export function effectivePlan(w: PlanWindow, trialPlan: PlanKey = 'business'): EffectivePlan {
  const candidates: { key: PlanKey; reason: EffectivePlan['reason'] }[] = [
    { key: w.plan, reason: 'plan' },
  ];

  const trialing = w.status === 'trialing' && inFuture(w.trialEndsAt);
  if (trialing) candidates.push({ key: trialPlan, reason: 'trial' });
  if (inFuture(w.grandfatheredUntil)) candidates.push({ key: trialPlan, reason: 'grandfathered' });

  const best = candidates.reduce((a, b) => (planRank(b.key) > planRank(a.key) ? b : a));
  return {
    key: best.key,
    name: (PLANS[best.key] ?? PLANS.freemium).name,
    reason: best.reason,
    onFreeWindow: best.reason !== 'plan',
  };
}

/** Same rule, straight off a `business_subscriptions` row. */
export function effectivePlanFromRow(row: any, trialPlan: PlanKey = 'business'): EffectivePlan {
  return effectivePlan(
    {
      plan: (row?.plan as PlanKey) ?? 'freemium',
      status: row?.status ?? 'none',
      trialEndsAt: row?.trial_ends_at ?? null,
      grandfatheredUntil: row?.grandfathered_until ?? null,
    },
    trialPlan
  );
}

/** The six things a plan badge can be. Doubles as the colour key on the client. */
export type PlanTone =
  | 'freemium' | 'starter' | 'entrepreneur' | 'business' | 'corporate'
  | 'grandfathered' | 'trial';

export interface PlanBadge {
  label: string;
  tone: PlanTone;
}

/**
 * What to CALL a workspace's plan, wherever one is shown.
 *
 * The rule, and it is the one that was wrong before: **if they are paying for
 * something, say what they are paying for.** A workspace billed Entrepreneur
 * that is also inside the early-access window was being labelled "Business",
 * because the window grants Business features — technically true and useless.
 * Nobody thinks of themselves as being on the plan they were given; they think
 * of the one on their invoice.
 *
 * Only when NOTHING is billed does the window become the identity, because then
 * it is the only answer there is: Trial, Grandfathered, or plain Freemium.
 *
 * Used by the business switcher and by the admin panel, so the two cannot
 * disagree about what a workspace is on — which is exactly how this surfaced.
 */
export function planBadgeFor(w: PlanWindow): PlanBadge {
  if (w.plan !== 'freemium') {
    return { label: (PLANS[w.plan] ?? PLANS.freemium).name, tone: w.plan as PlanTone };
  }
  const effective = effectivePlan(w);
  if (effective.reason === 'trial') return { label: 'Trial', tone: 'trial' };
  if (effective.reason === 'grandfathered') return { label: 'Grandfathered', tone: 'grandfathered' };
  return { label: PLANS.freemium.name, tone: 'freemium' };
}

/** Same thing, straight off a `business_subscriptions` row. */
export function planBadgeFromRow(row: any): PlanBadge {
  return planBadgeFor({
    plan: (row?.plan as PlanKey) ?? 'freemium',
    status: row?.status ?? 'none',
    trialEndsAt: row?.trial_ends_at ?? null,
    grandfatheredUntil: row?.grandfathered_until ?? null,
  });
}
