import { Database } from '../../infrastructure/database';
import { runOnce } from '../../infrastructure/migrations';
import { GRANDFATHER_MONTHS, PlanKey } from './plans';

/**
 * Subscription state per workspace — spec 08 §3.
 *
 * A table of its own rather than columns on `businesses`, for two reasons.
 * Billing is a separate concern with its own lifecycle, and when Stripe lands
 * its ids and dates belong beside the plan rather than scattered across the
 * core table. The Stripe columns exist here already, unused and null, so
 * adopting billing is a write path rather than another migration.
 */

export type SubscriptionStatus =
  | 'none'        // never started anything — the state every account begins in
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled';

export interface Subscription {
  businessId: string;
  plan: PlanKey;
  /**
   * A downgrade that has been paid for but not yet taken effect.
   *
   * Downgrades are scheduled rather than applied: the customer has already paid
   * for the current period, so they keep what they bought until it ends, and no
   * money is credited back. `pendingPlan` is what they drop to, `pendingPlanAt`
   * is when.
   */
  pendingPlan: PlanKey | null;
  pendingPlanAt: string | null;
  status: SubscriptionStatus;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  /** Existing accounts keep their old access until this passes. */
  grandfatheredUntil: string | null;
  /**
   * When the end-of-trial plan prompt was shown. Null means never, which is
   * what makes it a once-only prompt rather than one on every page load.
   */
  trialPromptAt: string | null;
  /** When the "your trial has started" note was shown. Once, ever. */
  trialStartPromptAt: string | null;
  /** The free-access end date the workspace has already been told about. */
  accessNoticeUntil: string | null;
  /** Null throughout phase A. Stripe owns these once billing exists. */
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  updatedAt: string | null;
}

const iso = (v: any): string | null => (v ? new Date(v).toISOString() : null);

export class BillingRepository {
  constructor(private readonly database: Database) {}

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS business_subscriptions (
        business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
        plan VARCHAR(24) NOT NULL DEFAULT 'freemium',
        status VARCHAR(24) NOT NULL DEFAULT 'none',
        trial_started_at TIMESTAMP WITH TIME ZONE,
        trial_ends_at TIMESTAMP WITH TIME ZONE,
        grandfathered_until TIMESTAMP WITH TIME ZONE,
        stripe_customer_id VARCHAR(64),
        stripe_subscription_id VARCHAR(64),
        current_period_end TIMESTAMP WITH TIME ZONE,
        cancel_at TIMESTAMP WITH TIME ZONE,
        pending_plan VARCHAR(24),
        pending_plan_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    /**
     * The trial belongs to the PERSON, not the workspace.
     *
     * It used to be recorded only on `business_subscriptions`, and creating a
     * workspace is free and unlimited — so anyone could have a fresh 14-day
     * Business trial as often as they liked by making another one, or by
     * deleting one and remaking it. Stamping the user is what closes that.
     *
     * `trial_bonus_at` records the +7 days awarded for verifying an email, so
     * verifying twice cannot be worth fourteen.
     */
    await this.database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMP WITH TIME ZONE`);
    await this.database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_bonus_at TIMESTAMP WITH TIME ZONE`);

    /**
     * Backfill: anyone whose workspace already carries a started trial has used
     * theirs. Without this, every existing account would be handed a second one
     * the moment this ships.
     *
     * Recorded in the migration ledger — this repairs history exactly once, and
     * re-running it every boot would scan `users` against every subscription
     * forever to keep discovering there is nothing left to do.
     */
    await runOnce(this.database, 'billing:backfill-trial-used-at', async (client) => {
      await client.query(`
        UPDATE users u SET trial_used_at = s.trial_started_at
          FROM business_subscriptions s
          JOIN businesses b ON b.id = s.business_id
         WHERE b.owner_id = u.id
           AND s.trial_started_at IS NOT NULL
           AND u.trial_used_at IS NULL
      `);
    });

    // A scheduled downgrade, for subscription tables that predate it.
    await this.database.query(`ALTER TABLE business_subscriptions ADD COLUMN IF NOT EXISTS pending_plan VARCHAR(24)`);
    await this.database.query(`ALTER TABLE business_subscriptions ADD COLUMN IF NOT EXISTS pending_plan_at TIMESTAMP WITH TIME ZONE`);

    /**
     * When the "your trial has ended, pick a plan" prompt was shown.
     *
     * Recorded so it appears ONCE. Nothing moves `status` off 'trialing' when a
     * trial lapses, so a lapsed trial is indistinguishable from a running one
     * except by date — which means without a stamp the prompt would reappear on
     * every single dashboard load, forever.
     */
    await this.database.query(`ALTER TABLE business_subscriptions ADD COLUMN IF NOT EXISTS trial_prompt_at TIMESTAMP WITH TIME ZONE`);

    /**
     * When the "your trial has started" note was shown. Separate from
     * `trial_prompt_at` because the two prompts have different lifetimes: a
     * trial starts exactly once, so that one is genuinely one-shot, while the
     * end-of-trial ask comes back every fortnight until they decide.
     */
    await this.database.query(`ALTER TABLE business_subscriptions ADD COLUMN IF NOT EXISTS trial_start_prompt_at TIMESTAMP WITH TIME ZONE`);

    /**
     * The free-access end date the workspace has already been TOLD about.
     *
     * Compared against `grandfathered_until` to decide whether there is news:
     * they differ exactly when an admin has moved the window since the last
     * time anybody said so. Storing the date rather than a boolean is what
     * makes a SECOND change notify again — a flag would announce the first
     * grant and stay silent on every extension after it.
     */
    await this.database.query(`ALTER TABLE business_subscriptions ADD COLUMN IF NOT EXISTS access_notice_until TIMESTAMP WITH TIME ZONE`);

    /**
     * Grandfathering — every workspace that exists RIGHT NOW keeps the paid
     * features it already has for GRANDFATHER_MONTHS.
     *
     * `WHERE NOT EXISTS` makes this a one-time backfill rather than a rolling
     * gift: it seeds a row for workspaces created before billing shipped, and
     * from then on those workspaces have rows, so a later boot cannot re-grant
     * or extend anything. Workspaces created after this runs get their row from
     * `ensureFor` with no grandfather date, which is correct — they never had
     * the features free, so there is nothing to preserve.
     */
    await runOnce(this.database, 'billing:seed-grandfather-window', async (client) => {
      await client.query(
        `INSERT INTO business_subscriptions (business_id, plan, status, grandfathered_until)
         SELECT b.id, 'freemium', 'none', NOW() + ($1 || ' months')::interval
         FROM businesses b
         WHERE NOT EXISTS (
           SELECT 1 FROM business_subscriptions s WHERE s.business_id = b.id
         )`,
        [String(GRANDFATHER_MONTHS)]
      );
    });
  }

  /** Every workspace has a row; this creates the missing one on first touch. */
  async ensureFor(businessId: string): Promise<Subscription> {
    await this.database.query(
      `INSERT INTO business_subscriptions (business_id) VALUES ($1)
       ON CONFLICT (business_id) DO NOTHING`,
      [businessId]
    );
    const s = await this.get(businessId);
    if (!s) throw new Error('Could not create a subscription row');
    return s;
  }

  /**
   * Read a subscription, applying any downgrade whose date has arrived.
   *
   * Done on READ rather than by a scheduled job, because there is no scheduler
   * and adding one to run a single UPDATE would be a lot of moving parts to
   * maintain. Every path that cares about the plan comes through here, so a
   * due change lands the first time anybody looks — including the customer
   * themselves, which is the moment it matters.
   *
   * The write is conditional on the date still being due, so two concurrent
   * reads cannot apply it twice.
   */
  async get(businessId: string): Promise<Subscription | null> {
    await this.database.query(
      `UPDATE business_subscriptions
          SET plan = pending_plan,
              -- A scheduled downgrade to freemium must not end a trial that
              -- is still running. The status column carries BOTH the
              -- subscription state and the trial state, so 'none' over a live
              -- trial silently removes the remaining access, not just a label.
              status = CASE
                         WHEN pending_plan <> 'freemium' THEN 'active'
                         WHEN trial_ends_at > NOW() THEN 'trialing'
                         ELSE 'none'
                       END,
              pending_plan = NULL,
              pending_plan_at = NULL,
              updated_at = NOW()
        WHERE business_id = $1
          AND pending_plan IS NOT NULL
          AND pending_plan_at IS NOT NULL
          AND pending_plan_at <= NOW()`,
      [businessId]
    );

    const r = await this.database.query(
      'SELECT * FROM business_subscriptions WHERE business_id = $1',
      [businessId]
    );
    return r.rows[0] ? this.map(r.rows[0]) : null;
  }

  /**
   * Schedule a downgrade for the end of the period they have already paid for.
   *
   * They keep the higher plan until then and no money is credited — the
   * alternative (drop the features now, refund the difference) means somebody
   * loses access mid-month for something they paid for, which reads as a fault
   * however carefully the credit is explained.
   *
   * Setting a pending plan again simply replaces the previous one: changing
   * your mind twice before the date should not queue two changes.
   */
  async schedulePlanChange(businessId: string, plan: PlanKey, effectiveAt: string): Promise<void> {
    await this.ensureFor(businessId);
    await this.database.query(
      `UPDATE business_subscriptions
          SET pending_plan = $2, pending_plan_at = $3, updated_at = NOW()
        WHERE business_id = $1`,
      [businessId, plan, effectiveAt]
    );
  }

  /** Drop a scheduled downgrade — used when they upgrade again before it lands. */
  async clearPendingPlan(businessId: string): Promise<void> {
    await this.database.query(
      `UPDATE business_subscriptions
          SET pending_plan = NULL, pending_plan_at = NULL, updated_at = NOW()
        WHERE business_id = $1`,
      [businessId]
    );
  }

  /**
   * Grant a plan. Used by the `invoice.paid` webhook and by the admin override.
   *
   * The status is decided HERE, in TypeScript, rather than by a `CASE` inside
   * the SQL — and that is a fix, not a style choice. The CASE compared the same
   * `$2` that is assigned to a `varchar` column against a bare string literal,
   * so Postgres deduced `character varying` from one use and `text` from the
   * other and refused the whole statement:
   *
   *   42P08: inconsistent types deduced for parameter $2
   *          text versus character varying
   *
   * Which meant every paid invoice threw, the webhook returned 500, and the
   * customer was charged and granted nothing. It never surfaced in testing
   * because this is the one line that only runs when money actually arrives.
   */
  async setPlan(businessId: string, plan: PlanKey): Promise<void> {
    await this.ensureFor(businessId);
    // A plan set by hand or by a paid invoice is active; not a trial, not unpaid.
    const status: SubscriptionStatus = plan === 'freemium' ? 'none' : 'active';
    await this.database.query(
      `UPDATE business_subscriptions
          SET plan = $2, status = $3,
              -- A plan granted outright supersedes anything scheduled: an
              -- upgrade after a pending downgrade must not be undone later by
              -- a change the customer already reversed.
              pending_plan = NULL, pending_plan_at = NULL,
              updated_at = NOW()
        WHERE business_id = $1`,
      [businessId, plan, status]
    );

    /**
     * Dropping to freemium must not end a trial that still has days left.
     *
     * `status` is a single column describing two different things — whether a
     * subscription is being paid for, AND whether a trial is running. Writing
     * 'none' over a live trial therefore revokes the customer's remaining
     * access, not just the label: `effectivePlan` only counts a trial when
     * `status = 'trialing'`. It is invisible from the row, because
     * `trial_ends_at` is left in place and still reads as a running trial.
     *
     * Reached by the admin plan picker, `customer.subscription.deleted`, and a
     * portal downgrade — none of which mean "this trial is over".
     *
     * A separate guarded statement rather than a CASE in the UPDATE above:
     * reusing $2 in a comparison is exactly what raised 42P08 here before (see
     * the note on this method), and this statement reuses nothing.
     */
    if (plan === 'freemium') {
      await this.database.query(
        `UPDATE business_subscriptions
            SET status = 'trialing', updated_at = NOW()
          WHERE business_id = $1
            AND status = 'none'
            AND trial_ends_at > NOW()`,
        [businessId]
      );
    }
  }

  /**
   * Begin a trial. `days` comes from the caller because the length depends on
   * email verification, which is a user fact rather than a billing one.
   *
   * Refuses to restart a trial that has already been used — otherwise anyone
   * could press the button repeatedly for unlimited free access.
   */
  async startTrial(
    businessId: string,
    days: number,
    options: { userId?: string | null; force?: boolean } = {}
  ): Promise<Subscription> {
    await this.ensureFor(businessId);

    /**
     * ONE TRIAL PER PERSON, not per workspace.
     *
     * Workspaces are free and unlimited to create, so a per-workspace trial is
     * a per-person trial you can have as many times as you can be bothered to
     * click. The claim is made against the user row and only succeeds once —
     * `WHERE trial_used_at IS NULL` makes that true even if two requests arrive
     * together, rather than relying on a read-then-write.
     *
     * `force` exists for the admin panel: granting somebody a second trial is a
     * legitimate thing to do deliberately, and it is audited there.
     */
    if (options.userId && !options.force) {
      const claim = await this.database.query(
        `UPDATE users SET trial_used_at = NOW()
          WHERE id = $1 AND trial_used_at IS NULL
          RETURNING id`,
        [options.userId]
      );
      if (claim.rowCount === 0) {
        // Already used one. Return what they have rather than throwing: the
        // caller is usually onboarding, where this is expected, not an error.
        const existing = await this.get(businessId);
        if (!existing) throw new Error('Subscription row vanished');
        return existing;
      }
    } else if (options.userId) {
      await this.database.query(
        `UPDATE users SET trial_used_at = COALESCE(trial_used_at, NOW()) WHERE id = $1`,
        [options.userId]
      );
    }

    await this.database.query(
      `UPDATE business_subscriptions
          SET status = 'trialing',
              trial_started_at = NOW(),
              trial_ends_at = NOW() + ($2 || ' days')::interval,
              updated_at = NOW()
        WHERE business_id = $1 AND trial_started_at IS NULL`,
      [businessId, String(days)]
    );
    const s = await this.get(businessId);
    if (!s) throw new Error('Subscription row vanished');
    return s;
  }

  /** Has this person already used their one trial? */
  async hasUsedTrial(userId: string): Promise<boolean> {
    const r = await this.database.query('SELECT trial_used_at FROM users WHERE id = $1', [userId]);
    return !!r.rows[0]?.trial_used_at;
  }

  /**
   * Does this person OWN the workspace, as opposed to merely being in it?
   *
   * `withBusiness` resolves any workspace the caller is a member of, at any
   * role — so "the active workspace" is not the same question as "a workspace
   * that is theirs to spend a trial on". Owner-only, deliberately: the trial is
   * claimed once per account and the verification bonus only ever tops up a
   * trial on a workspace the person owns, so letting a member start one
   * anywhere else spends something they can never get back.
   *
   * Note `owner_id` is nullable — a workspace can outlive its owner — and a
   * NULL owner matches nobody, which is the right answer here.
   */
  async isOwnedBy(businessId: string, userId: string): Promise<boolean> {
    const r = await this.database.query(
      'SELECT 1 AS ok FROM businesses WHERE id = $1 AND owner_id = $2',
      [businessId, userId]
    );
    return (r.rowCount ?? 0) > 0;
  }

  /**
   * The +7 days for verifying an email, awarded once.
   *
   * Applied to whatever trial is currently running on a workspace they own.
   * Someone who starts a trial unverified gets 7 days; verifying later tops it
   * up to the 14 a verified signup would have had, so starting early never
   * costs them anything.
   *
   * The claim on `trial_bonus_at` is the guard — verifying an address twice, or
   * two verification links arriving at once, cannot award it twice.
   *
   * ONLY TOPS UP A TRIAL THAT IS STILL RUNNING. `status` is never moved off
   * 'trialing' when a trial lapses — nothing sweeps the table, and
   * `effectivePlan` decides a trial is over by comparing `trial_ends_at` to now
   * rather than by reading the status. So 'trialing' on its own also describes
   * every trial that has ever expired, and extending from
   * `GREATEST(trial_ends_at, NOW())` restarts a dead one from TODAY: a full
   * week of Business, handed to anyone whose trial ended months ago, the first
   * time they confirm an address. The boot-time backfill stamps `trial_used_at`
   * on exactly that population with `trial_bonus_at` still null, and
   * `resendVerification` is public, so it was reachable on demand.
   *
   * `trial_ends_at > NOW()` is therefore the real condition. The claim carries
   * it too, so a bonus is not burnt on somebody it cannot be paid to.
   */
  async awardVerificationBonus(userId: string, days: number): Promise<number> {
    const claim = await this.database.query(
      `UPDATE users u SET trial_bonus_at = NOW()
        WHERE u.id = $1
          AND u.trial_used_at IS NOT NULL
          AND u.trial_bonus_at IS NULL
          AND EXISTS (
            SELECT 1 FROM business_subscriptions s
              JOIN businesses b ON b.id = s.business_id
             WHERE b.owner_id = u.id
               AND s.status = 'trialing'
               AND s.trial_ends_at > NOW()
          )
        RETURNING u.id`,
      [userId]
    );
    if (claim.rowCount === 0) return 0;

    const extended = await this.database.query(
      `UPDATE business_subscriptions s
          SET trial_ends_at = s.trial_ends_at + ($2 || ' days')::interval,
              updated_at = NOW()
         FROM businesses b
        WHERE b.id = s.business_id
          AND b.owner_id = $1
          AND s.status = 'trialing'
          AND s.trial_ends_at > NOW()`,
      [userId, String(days)]
    );
    return extended.rowCount ?? 0;
  }

  /**
   * Record that the end-of-trial plan prompt has been shown.
   *
   * Guarded the same way the trial claim is: the condition lives in the WHERE,
   * so two dashboard loads arriving together cannot both decide they are the
   * first. Returns whether this call was the one that claimed it, which is what
   * the caller needs to know to actually show the dialog.
   */
  async markTrialPromptShown(businessId: string, which: 'start' | 'end' = 'end'): Promise<boolean> {
    /**
     * The two prompts are stamped differently ON PURPOSE.
     *
     * 'start' is one-shot — a trial begins once, and a second telling would be
     * telling somebody something they already know. The guard lives in the
     * WHERE so two tabs cannot both believe they were first.
     *
     * 'end' RE-stamps every time, because that prompt returns fortnightly until
     * they choose. The timestamp is not a "has been shown" flag there; it is
     * when the fortnight last restarted.
     */
    if (which === 'start') {
      const r = await this.database.query(
        `UPDATE business_subscriptions
            SET trial_start_prompt_at = NOW(), updated_at = NOW()
          WHERE business_id = $1 AND trial_start_prompt_at IS NULL
          RETURNING business_id`,
        [businessId]
      );
      return (r.rowCount ?? 0) > 0;
    }
    const r = await this.database.query(
      `UPDATE business_subscriptions
          SET trial_prompt_at = NOW(), updated_at = NOW()
        WHERE business_id = $1
        RETURNING business_id`,
      [businessId]
    );
    return (r.rowCount ?? 0) > 0;
  }

  /**
   * Move a trial's end date. Positive days push it out, negative days pull it
   * in. Used by the admin panel and by the verification bonus (spec 08 §4.1:
   * verifying grants more trial time).
   *
   * Measured from whichever is later — now, or the existing end. Extending a
   * lapsed trial from its old end date would hand out days already gone.
   *
   * Taking off more days than remain lands the end date in the past, which is
   * how a trial is revoked: there is no separate "cancel" to keep in step, and
   * an expired trial is a state the rest of the system already understands.
   */
  async extendTrial(businessId: string, days: number): Promise<Subscription> {
    await this.ensureFor(businessId);

    /**
     * Negative days SHORTEN a trial, and may only ever shorten one that exists.
     *
     * The statement below fabricates a trial where there is none —
     * `COALESCE(trial_ends_at, NOW())` plus the interval, with status forced to
     * 'trialing'. That is what makes it work as "extend", and it is exactly
     * wrong for "reduce": taking 5 days off a workspace that never had a trial
     * would CREATE one, already expired, and then the end-of-trial plan prompt
     * would fire at somebody who was never offered a trial in the first place.
     *
     * Checked here rather than folded into the SQL because the test would have
     * to compare $2 against a number while the same $2 is concatenated as text
     * — the 42P08 shape that has already broken this file once.
     */
    if (days < 0) {
      const current = await this.get(businessId);
      if (!current?.trialEndsAt) {
        throw new Error('There is no trial on this workspace to take days off.');
      }
    }

    await this.database.query(
      `UPDATE business_subscriptions
          SET status = 'trialing',
              trial_started_at = COALESCE(trial_started_at, NOW()),
              trial_ends_at = GREATEST(COALESCE(trial_ends_at, NOW()), NOW()) + ($2 || ' days')::interval,
              updated_at = NOW()
        WHERE business_id = $1`,
      [businessId, String(days)]
    );
    const s = await this.get(businessId);
    if (!s) throw new Error('Subscription row vanished');
    return s;
  }

  /**
   * Grant or revoke early-access. `months` of null clears it.
   *
   * Set from NOW rather than extended from the existing date: an admin typing
   * "6" means six months from today, not six on top of whatever is left. The
   * boot-time backfill is the only thing that grants this automatically, and it
   * only ever touches workspaces with no row at all — so an admin can shorten a
   * window here without a later restart quietly putting it back.
   */
  async setGrandfather(businessId: string, months: number | null): Promise<void> {
    await this.ensureFor(businessId);
    if (months === null) {
      await this.database.query(
        `UPDATE business_subscriptions
            SET grandfathered_until = NULL, updated_at = NOW()
          WHERE business_id = $1`,
        [businessId]
      );
      return;
    }
    await this.database.query(
      `UPDATE business_subscriptions
          SET grandfathered_until = NOW() + ($2 || ' months')::interval,
              updated_at = NOW()
        WHERE business_id = $1`,
      [businessId, String(months)]
    );
  }

  /**
   * Move a grandfather window by a number of days, in either direction.
   *
   * Distinct from `setGrandfather`, which sets an absolute window from today —
   * an admin typing "6" there means six months from now, not six on top of what
   * is left. This one nudges an existing date, which is what "give them another
   * fortnight" actually means.
   *
   * This is also the ONLY honest way to extend a paying customer's access from
   * the admin panel. `current_period_end` is Stripe's, not ours: we copy it from
   * webhooks, so editing it here would change nothing about when they are
   * charged and would be overwritten by the next event. Granting free time on
   * top is a thing we CAN do, and this is it.
   *
   * Measured from the later of now and the existing end, so a window that has
   * already lapsed is not extended from a date in the past.
   */
  async adjustGrandfather(businessId: string, days: number): Promise<Subscription> {
    await this.ensureFor(businessId);
    if (days < 0) {
      const current = await this.get(businessId);
      if (!current?.grandfatheredUntil) {
        throw new Error('There is no free-access window on this workspace to take days off.');
      }
    }
    await this.database.query(
      `UPDATE business_subscriptions
          SET grandfathered_until =
                GREATEST(COALESCE(grandfathered_until, NOW()), NOW()) + ($2 || ' days')::interval,
              updated_at = NOW()
        WHERE business_id = $1`,
      [businessId, String(days)]
    );
    const s = await this.get(businessId);
    if (!s) throw new Error('Subscription row vanished');
    return s;
  }

  /**
   * Mark the current free-access end date as "they have been told".
   *
   * Writes today's `grandfathered_until` into `access_notice_until` rather than
   * a value passed in, so it cannot record a date that was never shown — and so
   * a window moved again between the dialog opening and being dismissed still
   * counts as unannounced.
   */
  async acknowledgeAccessNotice(businessId: string): Promise<void> {
    await this.database.query(
      `UPDATE business_subscriptions
          SET access_notice_until = grandfathered_until, updated_at = NOW()
        WHERE business_id = $1`,
      [businessId]
    );
  }

  /** Remember which Stripe objects belong to this business. */
  async linkStripe(
    businessId: string,
    ids: { customerId?: string | null; subscriptionId?: string | null }
  ): Promise<void> {
    await this.ensureFor(businessId);
    await this.database.query(
      `UPDATE business_subscriptions
          SET stripe_customer_id = COALESCE($2, stripe_customer_id),
              stripe_subscription_id = COALESCE($3, stripe_subscription_id),
              updated_at = NOW()
        WHERE business_id = $1`,
      [businessId, ids.customerId ?? null, ids.subscriptionId ?? null]
    );
  }

  /**
   * Copy Stripe's own view of the subscription onto our row.
   *
   * Spec 08 §4.2 is explicit that the admin panel displays what Stripe reports
   * rather than calculating dates itself, so it can never drift out of step
   * with what the customer is actually charged. Stripe sends unix seconds.
   */
  async syncFromStripe(
    businessId: string,
    data: {
      status?: string | null;
      currentPeriodEnd?: number | null;
      cancelAt?: number | null;
      customerId?: string | null;
      subscriptionId?: string | null;
    }
  ): Promise<void> {
    await this.ensureFor(businessId);
    const ts = (v: number | null | undefined) =>
      v === null || v === undefined ? null : new Date(v * 1000).toISOString();

    await this.database.query(
      `UPDATE business_subscriptions
          SET status = COALESCE($2, status),
              current_period_end = COALESCE($3, current_period_end),
              -- cancel_at is intentionally NOT coalesced: Stripe sends null
              -- when a scheduled cancellation is called off, and coalescing
              -- would keep showing a cancellation date that no longer exists.
              cancel_at = $4,
              stripe_customer_id = COALESCE($5, stripe_customer_id),
              stripe_subscription_id = COALESCE($6, stripe_subscription_id),
              updated_at = NOW()
        WHERE business_id = $1`,
      [
        businessId,
        data.status ?? null,
        ts(data.currentPeriodEnd),
        ts(data.cancelAt),
        data.customerId ?? null,
        data.subscriptionId ?? null,
      ]
    );
  }

  /** Which business owns this Stripe subscription? */
  async findByStripeSubscription(subscriptionId: string): Promise<string | null> {
    const r = await this.database.query(
      'SELECT business_id FROM business_subscriptions WHERE stripe_subscription_id = $1',
      [subscriptionId]
    );
    return r.rows[0]?.business_id ?? null;
  }

  /** Which business owns this Stripe customer? */
  async findByStripeCustomer(customerId: string): Promise<string | null> {
    const r = await this.database.query(
      'SELECT business_id FROM business_subscriptions WHERE stripe_customer_id = $1',
      [customerId]
    );
    return r.rows[0]?.business_id ?? null;
  }

  /**
   * Plan distribution for the admin revenue view (spec 08 §4.3).
   *
   * `seats` counts BILLABLE seats — viewers excluded, floored at one — because
   * that is the quantity Stripe multiplies the price by. It used to be a plain
   * member count, which meant this card and the projected-MRR figure beside it
   * were quietly using two different definitions of the same word.
   */
  async planDistribution(): Promise<{ plan: string; businesses: number; seats: number }[]> {
    const r = await this.database.query(`
      SELECT COALESCE(s.plan, 'freemium') AS plan,
             COUNT(*)::int AS businesses,
             COALESCE(SUM(GREATEST(1, (SELECT COUNT(*) FROM business_members m
                                        WHERE m.business_id = b.id AND m.role <> 'Viewer'))), 0)::int AS seats
      FROM businesses b
      LEFT JOIN business_subscriptions s ON s.business_id = b.id
      GROUP BY COALESCE(s.plan, 'freemium')
      ORDER BY businesses DESC
    `);
    return r.rows.map((x: any) => ({
      plan: x.plan,
      businesses: Number(x.businesses) || 0,
      seats: Number(x.seats) || 0,
    }));
  }

  private map(row: any): Subscription {
    return {
      businessId: row.business_id,
      plan: row.plan,
      status: row.status,
      trialStartedAt: iso(row.trial_started_at),
      trialEndsAt: iso(row.trial_ends_at),
      grandfatheredUntil: iso(row.grandfathered_until),
      stripeCustomerId: row.stripe_customer_id ?? null,
      stripeSubscriptionId: row.stripe_subscription_id ?? null,
      currentPeriodEnd: iso(row.current_period_end),
      cancelAt: iso(row.cancel_at),
      pendingPlan: (row.pending_plan as PlanKey) ?? null,
      pendingPlanAt: iso(row.pending_plan_at),
      trialPromptAt: iso(row.trial_prompt_at),
      trialStartPromptAt: iso(row.trial_start_prompt_at),
      accessNoticeUntil: iso(row.access_notice_until),
      updatedAt: iso(row.updated_at),
    };
  }
}
