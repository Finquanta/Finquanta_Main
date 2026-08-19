import { Database } from '../../infrastructure/database';
import { EntitlementsService } from './entitlements.service';
import { PlanLimits } from './plans';

/**
 * Plan quota metering — spec 08 §3, "usage metering and dashboard usage meters".
 *
 * Counts what a business has consumed in the current billing period and
 * compares it against what its plan allows.
 *
 * ---------------------------------------------------------------------------
 * THIS IS NOT THE SPEND CAP. Two different things run side by side:
 *
 *   - `ai_usage` counts DAILY, platform-wide, and protects a small prepaid
 *     Anthropic balance from a runaway. It applies no matter what anyone paid.
 *   - This counts MONTHLY, per business, and enforces what a customer bought.
 *
 * A request has to satisfy both. Collapsing them would mean either a paying
 * customer being cut off by a cost guard, or a cost guard that a plan can buy
 * its way past.
 * ---------------------------------------------------------------------------
 *
 * THE ANTI-EXPLOIT RULE, which is the whole reason this is period-keyed:
 * consumption is recorded against the PERIOD, never against the plan. Upgrading
 * mid-cycle raises the ceiling; it does not refill the bucket. So buying
 * Business on day 28, burning the larger allowance and dropping back to
 * Entrepreneur gains nothing — the counter for that month is already spent, and
 * downgrading simply lowers the ceiling back down over the same count.
 */

export type UsageMetric = 'finna_messages' | 'council_sessions';

/** Which plan limit governs which metric. */
const LIMIT_FOR: Record<UsageMetric, keyof PlanLimits> = {
  finna_messages: 'finnaMessagesPerMonth',
  council_sessions: 'councilSessionsPerMonth',
};

export interface UsageCheck {
  allowed: boolean;
  used: number;
  /** null means unlimited. */
  limit: number | null;
  remaining: number | null;
  period: string;
}

/**
 * Calendar month, UTC.
 *
 * Deliberately not the Stripe billing anniversary, even though that is what a
 * customer is technically buying. Everyone's month starting on the 1st is
 * predictable, explainable in a sentence, and does not silently change when a
 * subscription is created or moved. If that ever needs to follow Stripe's
 * `current_period_start`, this is the only function that changes.
 */
export function currentPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export class UsageService {
  private readonly entitlements: EntitlementsService;

  constructor(private readonly database: Database) {
    this.entitlements = new EntitlementsService(database);
  }

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS billing_usage (
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        metric VARCHAR(40) NOT NULL,
        period VARCHAR(7) NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (business_id, metric, period)
      );
    `);
  }

  /** How much of this metric the business has used this period. */
  async used(businessId: string, metric: UsageMetric): Promise<number> {
    const r = await this.database.query(
      'SELECT used FROM billing_usage WHERE business_id = $1 AND metric = $2 AND period = $3',
      [businessId, metric, currentPeriod()]
    );
    return Number(r.rows[0]?.used) || 0;
  }

  /**
   * May this business use one more? Does NOT consume — call `record` after the
   * work succeeds, so a failed request doesn't cost the customer an allowance.
   */
  async check(businessId: string, metric: UsageMetric): Promise<UsageCheck> {
    const e = await this.entitlements.for(businessId);
    const limit = e.limits[LIMIT_FOR[metric]];
    const used = await this.used(businessId, metric);

    return {
      allowed: limit === null || used < limit,
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      period: currentPeriod(),
    };
  }

  /** Consume one. Returns the new total. */
  async record(businessId: string, metric: UsageMetric, amount = 1): Promise<number> {
    const r = await this.database.query(
      `INSERT INTO billing_usage (business_id, metric, period, used, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (business_id, metric, period)
       DO UPDATE SET used = billing_usage.used + EXCLUDED.used, updated_at = NOW()
       RETURNING used`,
      [businessId, metric, currentPeriod(), amount]
    );
    return Number(r.rows[0]?.used) || 0;
  }

  /** Every metric at once, for the dashboard meters. */
  async summary(businessId: string): Promise<Record<UsageMetric, UsageCheck>> {
    const metrics: UsageMetric[] = ['finna_messages', 'council_sessions'];
    const out = {} as Record<UsageMetric, UsageCheck>;
    for (const m of metrics) out[m] = await this.check(businessId, m);
    return out;
  }
}
