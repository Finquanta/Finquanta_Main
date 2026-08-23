import { Database } from '../../infrastructure/database';
import { Entitlements, EntitlementsService } from './entitlements.service';
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

/**
 * One member's spend this period.
 *
 * `userId` null means the spend outlived whoever made it — they left the
 * workspace or closed their account. Their usage still counts toward the
 * workspace total, so it has to be shown rather than dropped.
 */
export interface MemberUsageRow {
  userId: string | null;
  email: string | null;
  name: string | null;
  role: string | null;
  finnaMessages: number;
  councilSessions: number;
}

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

    /**
     * WHO spent it — a separate table, deliberately.
     *
     * The obvious alternative is adding `user_id` to `billing_usage`'s primary
     * key, and it is the wrong move: the quota check reads exactly one row per
     * (business, metric, period), and widening the key turns that into a SUM
     * over one row per member on the hot path of every Finna message. It also
     * changes what the existing rows MEAN mid-flight.
     *
     * Kept apart, `billing_usage` stays the single authority on whether someone
     * is allowed to send a message, and this table is attribution only. A bug
     * in here can make the breakdown wrong; it cannot wrongly refuse a customer.
     *
     * `user_id` is ON DELETE SET NULL rather than CASCADE: when somebody leaves
     * or their account is closed, the spend still happened and the workspace's
     * totals must not silently shrink. It shows as "Removed member" instead.
     */
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS billing_usage_by_user (
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        metric VARCHAR(40) NOT NULL,
        period VARCHAR(7) NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    /**
     * A partial unique index, not a primary key, because `user_id` is nullable
     * and NULLs do not compare equal — several "removed member" rows would
     * otherwise accumulate for the same metric and period. The second index
     * covers exactly that case so the ON CONFLICT below has something to hit.
     */
    await this.database.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_by_user_key
        ON billing_usage_by_user (business_id, user_id, metric, period)
        WHERE user_id IS NOT NULL
    `);
    await this.database.query(
      `CREATE INDEX IF NOT EXISTS idx_usage_by_user_lookup
         ON billing_usage_by_user (business_id, period)`
    );
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
  async check(businessId: string, metric: UsageMetric, resolved?: Entitlements): Promise<UsageCheck> {
    // `resolved` lets a caller that has ALREADY worked out the plan hand it in
    // instead of paying for it again. `entitlements.for()` is not cheap — it
    // upserts the subscription row, runs the apply-a-due-downgrade UPDATE, then
    // counts seats — so re-deriving it per metric turned the dashboard's two
    // meters into ten round trips.
    const e = resolved ?? await this.entitlements.for(businessId);
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
  async record(
    businessId: string,
    metric: UsageMetric,
    amount = 1,
    userId?: string | null
  ): Promise<number> {
    const period = currentPeriod();
    const r = await this.database.query(
      `INSERT INTO billing_usage (business_id, metric, period, used, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (business_id, metric, period)
       DO UPDATE SET used = billing_usage.used + EXCLUDED.used, updated_at = NOW()
       RETURNING used`,
      [businessId, metric, period, amount]
    );

    /**
     * Attribution, and it must never cost the customer their message.
     *
     * The line above is the one that counts against the allowance and has
     * already succeeded. This one only records WHO, so it is wrapped: a failure
     * here would otherwise turn a successful, already-charged Finna reply into
     * a 500 for the sake of a breakdown row. Logged rather than swallowed
     * silently, so a persistently broken attribution is still discoverable.
     */
    if (userId) {
      try {
        await this.database.query(
          `INSERT INTO billing_usage_by_user (business_id, user_id, metric, period, used, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (business_id, user_id, metric, period) WHERE user_id IS NOT NULL
           DO UPDATE SET used = billing_usage_by_user.used + EXCLUDED.used, updated_at = NOW()`,
          [businessId, userId, metric, period, amount]
        );
      } catch (error) {
        console.error('Could not attribute usage to a member:', error);
      }
    }

    return Number(r.rows[0]?.used) || 0;
  }

  /**
   * Who used what, this period — the Finna overview's per-member breakdown.
   *
   * Members with no usage are included with zeroes, because "nobody on the team
   * has touched Finna" is a real and useful answer that an inner join would
   * render as an empty table. Viewers are included too: they cannot use Finna,
   * so a non-zero row against one is worth being able to see.
   *
   * Somebody who has since left still appears, under their recorded spend, as
   * an unnamed row — the money was spent and the total has to reconcile.
   */
  async byUser(businessId: string, period = currentPeriod()): Promise<MemberUsageRow[]> {
    const r = await this.database.query(
      `SELECT COALESCE(u.id::text, 'removed') AS key,
              u.id AS user_id,
              u.email,
              NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), '') AS name,
              m.role,
              COALESCE(SUM(bu.used) FILTER (WHERE bu.metric = 'finna_messages'), 0)::int AS finna,
              COALESCE(SUM(bu.used) FILTER (WHERE bu.metric = 'council_sessions'), 0)::int AS council
         FROM business_members m
         JOIN users u ON u.id = m.user_id
         LEFT JOIN billing_usage_by_user bu
                ON bu.business_id = m.business_id
               AND bu.user_id = m.user_id
               AND bu.period = $2
        WHERE m.business_id = $1
        GROUP BY u.id, u.email, u.first_name, u.last_name, m.role

        UNION ALL

        -- Spend whose member row is gone: they left, or the account was closed.
        SELECT 'removed', NULL, NULL, NULL, NULL,
               COALESCE(SUM(bu.used) FILTER (WHERE bu.metric = 'finna_messages'), 0)::int,
               COALESCE(SUM(bu.used) FILTER (WHERE bu.metric = 'council_sessions'), 0)::int
          FROM billing_usage_by_user bu
         WHERE bu.business_id = $1 AND bu.period = $2
           AND (bu.user_id IS NULL
                OR NOT EXISTS (SELECT 1 FROM business_members m2
                                WHERE m2.business_id = bu.business_id AND m2.user_id = bu.user_id))
        HAVING COALESCE(SUM(bu.used), 0) > 0`,
      [businessId, period]
    );

    return (r.rows ?? []).map((row: any) => ({
      userId: row.user_id ?? null,
      email: row.email ?? null,
      name: row.name ?? null,
      role: row.role ?? null,
      finnaMessages: Number(row.finna) || 0,
      councilSessions: Number(row.council) || 0,
    }));
  }

  /**
   * Every metric at once, for the dashboard meters.
   *
   * The plan is resolved ONCE and shared across the metrics, and the per-metric
   * counters are read in parallel. Each `check()` used to resolve entitlements
   * for itself, sequentially, so two meters cost ten round trips to Neon — on
   * `/v1/billing/me`, which the dashboard reads on nearly every page. The
   * answer is identical for every metric in the same request; it was simply
   * being recomputed per metric.
   *
   * `resolved` is passed straight through, so a caller that already has the
   * entitlements pays nothing for them here either.
   */
  async summary(businessId: string, resolved?: Entitlements): Promise<Record<UsageMetric, UsageCheck>> {
    const metrics: UsageMetric[] = ['finna_messages', 'council_sessions'];
    const e = resolved ?? await this.entitlements.for(businessId);
    const entries = await Promise.all(
      metrics.map(async (m) => [m, await this.check(businessId, m, e)] as const)
    );
    return Object.fromEntries(entries) as Record<UsageMetric, UsageCheck>;
  }
}
