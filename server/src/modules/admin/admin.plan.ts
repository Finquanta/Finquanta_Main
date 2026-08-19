import { Database } from '../../infrastructure/database';
import { effectivePlanFromRow, planBadgeFromRow, PlanTone } from '../billing/effective-plan';
import { PLANS, PlanKey } from '../billing/plans';

/**
 * Subscription state per workspace, for the admin Businesses tab.
 *
 * This used to return the string 'Freemium' for everyone, standing in for spec
 * 08. Spec 08 now exists, so it reads `business_subscriptions`.
 *
 * Returns STRUCTURED state rather than a formatted label: the admin panel needs
 * to sort by plan, show a trial's end date and offer different actions
 * depending on status, none of which it can do with a display string.
 *
 * Batched deliberately — the tab renders every workspace at once, so a per-row
 * lookup would be one query per business.
 */

/**
 * BOTH answers, deliberately.
 *
 * `planKey`/`planName` are what the workspace is BILLED — the number that
 * matters for revenue, and what the admin plan picker acts on. `effectivePlan*`
 * is what it can currently USE, which is what every other surface shows. An
 * admin needs both to answer "why does this account have Council when it pays
 * us nothing?" without guessing.
 */
export interface BusinessPlanInfo {
  planKey: PlanKey;
  planName: string;
  effectivePlanKey: PlanKey;
  effectivePlanName: string;
  /** What the badge says, and how it is tinted. Shared with the switcher. */
  badgeLabel: string;
  badgeTone: PlanTone;
  status: string;
  trialEndsAt: string | null;
  grandfatheredUntil: string | null;
  /** True while a trial or grandfather window is granting more than they pay for. */
  onFreeWindow: boolean;
}

const FREE: BusinessPlanInfo = {
  planKey: 'freemium',
  planName: PLANS.freemium.name,
  effectivePlanKey: 'freemium',
  effectivePlanName: PLANS.freemium.name,
  badgeLabel: PLANS.freemium.name,
  badgeTone: 'freemium',
  status: 'none',
  trialEndsAt: null,
  grandfatheredUntil: null,
  onFreeWindow: false,
};

const iso = (v: any): string | null => (v ? new Date(v).toISOString() : null);

export async function plansForBusinesses(
  database: Database,
  businessIds: string[]
): Promise<Record<string, BusinessPlanInfo>> {
  const out: Record<string, BusinessPlanInfo> = {};
  if (businessIds.length === 0) return out;

  // A workspace with no row has never been touched by billing — free, no window.
  for (const id of businessIds) out[id] = { ...FREE };

  const r = await database.query(
    `SELECT business_id, plan, status, trial_ends_at, grandfathered_until
       FROM business_subscriptions WHERE business_id = ANY($1::uuid[])`,
    [businessIds]
  );

  for (const row of r.rows) {
    const plan = PLANS[row.plan as PlanKey] ?? PLANS.freemium;
    // Same helper the switcher and the entitlements service use, so the admin
    // panel cannot report a different plan from the one the customer sees.
    const effective = effectivePlanFromRow(row);
    const badge = planBadgeFromRow(row);
    out[row.business_id] = {
      planKey: plan.key,
      planName: plan.name,
      effectivePlanKey: effective.key,
      effectivePlanName: effective.name,
      badgeLabel: badge.label,
      badgeTone: badge.tone,
      status: row.status,
      trialEndsAt: iso(row.trial_ends_at),
      grandfatheredUntil: iso(row.grandfathered_until),
      onFreeWindow: effective.onFreeWindow,
    };
  }
  return out;
}
