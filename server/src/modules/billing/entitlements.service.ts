import { Database } from '../../infrastructure/database';
import { BillingRepository, Subscription } from './billing.repository';
import { effectivePlan } from './effective-plan';
import { Plan, PlanFeatures, PlanKey, PLANS, TRIAL_PLAN } from './plans';

/**
 * Entitlements — spec 08 §3.
 *
 * The single question the rest of the server asks: "may this workspace do this
 * thing, and how much of it is left?" Every feature check goes through here so
 * that moving a feature between tiers is one edit in plans.ts, and so that
 * gating cannot drift apart across modules.
 *
 * Server-side only, deliberately. Spec 08: "Every feature checks entitlements
 * server-side. Client-side gating alone is not enforcement." The dashboard also
 * reads this to grey things out, but that is presentation — the refusal happens
 * here.
 */

export interface Entitlements {
  /** The plan actually being billed (or 'freemium' when nothing is). */
  plan: PlanKey;
  /** The plan whose features are in force right now — see `reason`. */
  effectivePlan: PlanKey;
  /** Why effectivePlan differs from plan, when it does. */
  reason: 'plan' | 'trial' | 'grandfathered';
  features: PlanFeatures;
  limits: Plan['limits'];
  status: Subscription['status'];
  trialEndsAt: string | null;
  grandfatheredUntil: string | null;
  /** Days left on whatever is granting access above the paid plan. */
  daysRemaining: number | null;
  seats: number;
  /**
   * The row this was resolved from.
   *
   * Handed back because `for()` has already paid for it. `/v1/billing/me` is
   * read on nearly every page and used to call `billing.get()` again straight
   * afterwards for the Stripe ids and the pending downgrade — and `get()` is
   * not a plain read: it issues the apply-a-due-downgrade UPDATE before its
   * SELECT. So the hottest endpoint on the platform ran that write twice per
   * request, for the same row, to learn the same thing.
   */
  subscription: Subscription;
}

/**
 * Whole days left, rounding a PART day up — "1 day left" should hold for the
 * whole of the final day, not vanish at breakfast.
 *
 * The minute of tolerance is not cosmetic. An end date is written from the
 * DATABASE clock (`NOW() + interval`), and every read happens afterwards, so
 * the remainder is always a hair OVER a whole number of days — 7 days and one
 * second. Ceiling that hair produced an extra whole day: a 7-day trial that
 * reported 8 days left the moment it started, and 15 for a fortnight. Anything
 * within a minute of a whole day is that whole number.
 */
const MINUTE = 60_000;
const daysUntil = (iso: string | null): number | null => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.max(0, Math.ceil((ms - MINUTE) / 86_400_000));
};

export class EntitlementsService {
  private readonly billing: BillingRepository;

  constructor(private readonly database: Database) {
    this.billing = new BillingRepository(database);
  }

  /**
   * Resolve what a workspace may currently do.
   *
   * Precedence matters and is deliberate: the highest access wins. Someone
   * grandfathered who then buys Business must not be quietly downgraded when
   * their window ends, and someone on a trial who is also grandfathered should
   * not lose access the day the trial finishes. Taking the best of the three is
   * the only ordering that never removes something a user can currently see.
   */
  async for(businessId: string): Promise<Entitlements> {
    const sub = await this.billing.ensureFor(businessId);
    const seats = await this.seatCount(businessId);

    // Resolved by the shared rule, so the answer here and the answer the
    // dashboard and admin panel display cannot drift apart.
    const best = effectivePlan(
      {
        plan: sub.plan,
        status: sub.status,
        trialEndsAt: sub.trialEndsAt,
        grandfatheredUntil: sub.grandfatheredUntil,
      },
      TRIAL_PLAN
    );
    const plan = PLANS[best.key];

    return {
      plan: sub.plan,
      effectivePlan: best.key,
      reason: best.reason,
      features: plan.features,
      limits: plan.limits,
      status: sub.status,
      trialEndsAt: sub.trialEndsAt,
      grandfatheredUntil: sub.grandfatheredUntil,
      daysRemaining:
        best.reason === 'trial' ? daysUntil(sub.trialEndsAt)
          : best.reason === 'grandfathered' ? daysUntil(sub.grandfatheredUntil)
            : null,
      seats,
      subscription: sub,
    };
  }

  /** Does this workspace have a given feature? */
  async can(businessId: string, feature: keyof PlanFeatures): Promise<boolean> {
    const e = await this.for(businessId);
    return e.features[feature] === true;
  }

  /**
   * Billable seats. Per-seat pricing (spec 08 §1), so this is the quantity sent
   * to Stripe and shown as the total on the pricing surfaces.
   *
   * VIEWERS ARE NOT BILLED. A Viewer can only look at the books — no writing,
   * no invoicing, no Finna, no Council — so charging a full seat for read-only
   * access would make sharing figures with an accountant or an investor cost
   * the same as adding a colleague who actually uses the product. The owner
   * always counts: they get an `Owner` row on create.
   *
   * Deliberately NOT the same number as the member count. The admin panel still
   * shows total members, because "who is in here" and "who are we charging for"
   * are different questions.
   */
  async seatCount(businessId: string): Promise<number> {
    const r = await this.database.query(
      `SELECT COUNT(*)::int AS n FROM business_members
        WHERE business_id = $1 AND role <> 'Viewer'`,
      [businessId]
    );
    // Never zero: a business with only viewers still has an owner, and a Stripe
    // quantity of 0 is rejected outright.
    return Math.max(1, Number(r.rows[0]?.n) || 0);
  }

  /**
   * What the platform would bill today if every assigned plan were live.
   *
   * PROJECTED, not real. Nothing is charging anyone yet, so this is
   * "price x seats, summed" — useful for seeing the shape of revenue as plans
   * get assigned, and explicitly not the MRR figure to quote once Stripe is
   * running, which must come from actual subscriptions.
   *
   * Trials and grandfathered access contribute ZERO. They are not revenue, and
   * counting them would flatter the number precisely when it is least true.
   */
  async projectedMrr(): Promise<{ monthly: number; byPlan: Record<string, number> }> {
    const r = await this.database.query(`
      SELECT s.plan,
             -- Same rule as seatCount: viewers are not billed, so they must
             -- not inflate projected revenue either.
             SUM(GREATEST(1, (SELECT COUNT(*) FROM business_members m
                               WHERE m.business_id = b.id AND m.role <> 'Viewer')))::int AS seats
      FROM businesses b
      JOIN business_subscriptions s ON s.business_id = b.id
      WHERE s.status = 'active'
      GROUP BY s.plan
    `);

    const byPlan: Record<string, number> = {};
    let monthly = 0;
    for (const row of r.rows) {
      const plan = PLANS[row.plan as PlanKey];
      if (!plan || plan.contactSales) continue; // Corporate is negotiated, not computed
      const amount = plan.monthly * (Number(row.seats) || 0);
      byPlan[row.plan] = Math.round(amount * 100) / 100;
      monthly += amount;
    }
    return { monthly: Math.round(monthly * 100) / 100, byPlan };
  }
}
