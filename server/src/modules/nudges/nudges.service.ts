import { Database } from '../../infrastructure/database';
import { AccountingRepository } from '../accounting/accounting.repository';
import { HealthRepository } from '../health/health.repository';
import { computeRunway, PERIOD_DAYS } from '../health/health.service';
import { CouncilRepository } from '../council/council.repository';

/**
 * Proactive Finna (Council spec §9/10).
 *
 * THE COST RULE, which shapes everything here: offering help is free; the
 * conversation is not.
 *
 * Every trigger below is deterministic code reading state the platform already
 * has — no AI call. The message shown is pre-written copy chosen by trigger
 * type, never generated. An API call happens only if the user engages. That is
 * why this can run on every dashboard load without costing anything; a
 * "personalised" nudge would mean a model call every time a condition is met,
 * for messages most people dismiss.
 *
 * The server returns a message KEY, not a sentence, so the client renders it in
 * the reader's language — same reason health.service returns `insightParts`.
 */

export const NUDGE_KEYS = [
  'runway_low',
  'decision_review_due',
  'health_dropped',
  'no_decisions_yet',
] as const;
export type NudgeKey = (typeof NUDGE_KEYS)[number];

/**
 * The dismiss/engaged routes take the key straight off the URL. Without this
 * guard any authenticated caller can write unbounded junk rows into
 * `nudge_state`, and anything over VARCHAR(40) 500s on the insert.
 */
export const isNudgeKey = (v: unknown): v is NudgeKey =>
  NUDGE_KEYS.includes(v as NudgeKey);

export interface Nudge {
  key: NudgeKey;
  /** i18n key for the pre-written copy. */
  messageKey: string;
  /** Numbers the sentence interpolates, unformatted. */
  params?: Record<string, number | string>;
  /** What engaging does: open the Council, or open a past decision. */
  action: 'convene' | 'review';
  /** Set for 'review' — the session to open. */
  sessionId?: string;
}

/** Runway below this many months is worth saying something about. */
const RUNWAY_ALERT_MONTHS = 3;
/** A health score falling by more than this is a sharp move. */
const HEALTH_DROP_POINTS = 10;
/**
 * Dismissing retires a trigger permanently, on the first press.
 *
 * There are now two separate refusals in the UI: "Not now" leaves the offer
 * outstanding so it keeps coming back until it's acted on, and "Dismiss" means
 * gone. With that split, asking twice before believing "Dismiss" would be
 * ignoring what the user just said.
 */
const RETIRE_AFTER_DISMISSALS = 1;
/**
 * At most one prompt per this many hours, across all triggers (§10.3).
 *
 * Env-overridable so it can be set to 0 while testing — otherwise seeing the
 * second nudge means waiting most of a day. The cap is a courtesy to the user,
 * not a spend control (showing an offer is free), so relaxing it locally is
 * safe.
 */
const MIN_HOURS_BETWEEN = (() => {
  const raw = Number.parseFloat(process.env.NUDGE_MIN_HOURS ?? '');
  return Number.isFinite(raw) && raw >= 0 ? raw : 20;
})();

export class NudgesService {
  private readonly ledger: AccountingRepository;
  private readonly health: HealthRepository;
  private readonly council: CouncilRepository;

  constructor(private readonly database: Database) {
    this.ledger = new AccountingRepository(database);
    this.health = new HealthRepository(database);
    this.council = new CouncilRepository(database);
  }

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS nudge_state (
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        nudge_key VARCHAR(40) NOT NULL,
        dismissed_count INTEGER NOT NULL DEFAULT 0,
        shown_count INTEGER NOT NULL DEFAULT 0,
        engaged_count INTEGER NOT NULL DEFAULT 0,
        last_shown_at TIMESTAMP WITH TIME ZONE,
        last_dismissed_at TIMESTAMP WITH TIME ZONE,
        PRIMARY KEY (business_id, user_id, nudge_key)
      );
    `);
    // The global off switch (§10.3), per user per business.
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS nudge_settings (
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        PRIMARY KEY (business_id, user_id)
      );
    `);
  }

  async isEnabled(businessId: string, userId: string): Promise<boolean> {
    const r = await this.database.query(
      `SELECT enabled FROM nudge_settings WHERE business_id = $1 AND user_id = $2`,
      [businessId, userId]
    );
    // Default ON — a user who has never touched the setting should get help.
    return r.rows[0] ? r.rows[0].enabled === true : true;
  }

  async setEnabled(businessId: string, userId: string, enabled: boolean): Promise<void> {
    await this.database.query(
      `INSERT INTO nudge_settings (business_id, user_id, enabled) VALUES ($1, $2, $3)
       ON CONFLICT (business_id, user_id) DO UPDATE SET enabled = EXCLUDED.enabled`,
      [businessId, userId, enabled]
    );
  }

  /**
   * At most one nudge, or null. Checks the cheap gates (off switch, frequency
   * cap, retirement) BEFORE touching the ledger, so the common case — nothing
   * to say — costs almost nothing.
   */
  async next(businessId: string, userId: string): Promise<Nudge | null> {
    if (!(await this.isEnabled(businessId, userId))) return null;

    const state = await this.stateFor(businessId, userId);

    const retired = (key: NudgeKey) =>
      (state[key]?.dismissed_count ?? 0) >= RETIRE_AFTER_DISMISSALS;

    const lastShown = Object.values(state)
      .map((s) => (s.last_shown_at ? new Date(s.last_shown_at).getTime() : 0))
      .reduce((a, b) => Math.max(a, b), 0);
    const inQuietPeriod =
      lastShown > 0 && Date.now() - lastShown < MIN_HOURS_BETWEEN * 3600_000;

    /**
     * Bail before touching the ledger when nothing could be returned anyway.
     *
     * This endpoint is polled on every dashboard load, and the trigger checks
     * below are not cheap — `runwayLow` alone costs a snapshot, a balances read
     * and a history count. The quiet period only suppresses NEW offers, so it
     * can only short-circuit when every live trigger would be a new one; an
     * offer the user has already seen and said "Not now" to is still
     * outstanding and has to be re-evaluated.
     */
    const hasOutstanding = NUDGE_KEYS.some(
      (k) => !retired(k) && (state[k]?.shown_count ?? 0) > 0
    );
    if (inQuietPeriod && !hasOutstanding) return null;

    // Ordered by urgency: money running out beats everything else.
    const candidates: (() => Promise<Nudge | null>)[] = [
      () => (retired('runway_low') ? null : this.runwayLow(businessId)),
      () => (retired('decision_review_due') ? null : this.reviewDue(businessId)),
      () => (retired('health_dropped') ? null : this.healthDropped(businessId)),
      () => (retired('no_decisions_yet') ? null : this.noDecisionsYet(businessId)),
    ].map((f) => async () => f());

    let top: Nudge | null = null;
    for (const check of candidates) {
      top = await check();
      if (top) break;
    }
    if (!top) return null;

    /**
     * The quiet period applies only to raising something NEW.
     *
     * An offer the user has already seen and answered "Not now" to is still
     * outstanding — they asked for it to keep coming back until they act on
     * it, so suppressing it for 20 hours would be the opposite of what the
     * button promises. "Dismiss" is how an offer goes away, and that's handled
     * by `retired` above.
     */
    const alreadyShown = (state[top.key]?.shown_count ?? 0) > 0;
    if (!alreadyShown && inQuietPeriod) return null;

    await this.markShown(businessId, userId, top.key);
    return top;
  }

  private async stateFor(businessId: string, userId: string): Promise<Record<string, any>> {
    const r = await this.database.query(
      `SELECT * FROM nudge_state WHERE business_id = $1 AND user_id = $2`,
      [businessId, userId]
    );
    const out: Record<string, any> = {};
    for (const row of r.rows) out[row.nudge_key] = row;
    return out;
  }

  /** Cash running out. The one worth interrupting for. */
  private async runwayLow(businessId: string): Promise<Nudge | null> {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const [daysOfData, snapshot, balances] = await Promise.all([
      this.health.daysOfData(businessId),
      this.health.snapshot(businessId, iso(new Date()), PERIOD_DAYS),
      this.ledger.getBalances(businessId),
    ]);
    const cash = Number(balances.find((b: any) => b.code === 'CASH')?.balance ?? snapshot.cash) || 0;
    const r = computeRunway(snapshot, cash, daysOfData, PERIOD_DAYS);

    if (r.status !== 'burning' || r.runwayMonths === null) return null;
    if (r.runwayMonths > RUNWAY_ALERT_MONTHS) return null;

    /**
     * Three phrasings, because one interpolated number cannot be said correctly
     * in ten languages.
     *
     * `runwayMonths` is a 2dp float, so the raw value produced "about 0 months
     * of cash left" for anything under half a month — true, but not a sentence
     * anyone would ship — and rounding alone would go on to produce "about 1
     * months". Splitting at the two boundaries where the wording actually
     * changes means the interpolated key ONLY ever receives 2 or 3, so its
     * plural is correct in every locale without a plural-rules library.
     */
    if (r.runwayMonths < 1) {
      return { key: 'runway_low', messageKey: 'nudgeRunwayLowSoon', action: 'convene' };
    }
    const whole = Math.round(r.runwayMonths);
    if (whole < 2) {
      return { key: 'runway_low', messageKey: 'nudgeRunwayLowMonth', action: 'convene' };
    }
    return {
      key: 'runway_low',
      messageKey: 'nudgeRunwayLow',
      params: { months: whole },
      action: 'convene',
    };
  }

  /** A decision old enough to judge, that nobody has judged. */
  private async reviewDue(businessId: string): Promise<Nudge | null> {
    const [due] = await this.council.dueForReview(businessId, 1);
    if (!due) return null;
    return {
      key: 'decision_review_due',
      messageKey: 'nudgeReviewDue',
      params: { question: due.question.slice(0, 80) },
      action: 'review',
      sessionId: due.id,
    };
  }

  /** The score moved sharply down — spec §10.2's "component moves sharply". */
  private async healthDropped(businessId: string): Promise<Nudge | null> {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [daysOfData, now, before] = await Promise.all([
      this.health.daysOfData(businessId),
      this.health.snapshot(businessId, iso(today), PERIOD_DAYS),
      this.health.snapshot(businessId, iso(monthAgo), PERIOD_DAYS),
    ]);
    if (daysOfData < 60) return null; // needs both windows to be real

    // Compare operating cash flow directly rather than re-scoring: the score
    // needs a profile read and this is a threshold check, not a report.
    const drop = before.operatingCashFlow - now.operatingCashFlow;
    if (drop <= 0 || before.operatingCashFlow <= 0) return null;
    const pct = (drop / Math.abs(before.operatingCashFlow)) * 100;
    if (pct < HEALTH_DROP_POINTS) return null;

    return {
      key: 'health_dropped',
      messageKey: 'nudgeCashFlowDropped',
      params: { percent: Math.round(pct) },
      action: 'convene',
    };
  }

  /** Nothing urgent — just that the Council exists and the books are ready. */
  private async noDecisionsYet(businessId: string): Promise<Nudge | null> {
    const [any] = await this.council.recentDecisions(businessId, 1);
    if (any) return null;
    const daysOfData = await this.health.daysOfData(businessId);
    // Only once there's enough history for the Council to say anything useful.
    if (daysOfData < 30) return null;
    return { key: 'no_decisions_yet', messageKey: 'nudgeTryCouncil', action: 'convene' };
  }

  private async markShown(businessId: string, userId: string, key: NudgeKey): Promise<void> {
    await this.database.query(
      `INSERT INTO nudge_state (business_id, user_id, nudge_key, shown_count, last_shown_at)
            VALUES ($1, $2, $3, 1, NOW())
       ON CONFLICT (business_id, user_id, nudge_key)
       DO UPDATE SET shown_count = nudge_state.shown_count + 1, last_shown_at = NOW()`,
      [businessId, userId, key]
    );
  }

  async dismiss(businessId: string, userId: string, key: NudgeKey): Promise<void> {
    await this.database.query(
      `INSERT INTO nudge_state (business_id, user_id, nudge_key, dismissed_count, last_dismissed_at)
            VALUES ($1, $2, $3, 1, NOW())
       ON CONFLICT (business_id, user_id, nudge_key)
       DO UPDATE SET dismissed_count = nudge_state.dismissed_count + 1, last_dismissed_at = NOW()`,
      [businessId, userId, key]
    );
  }

  /** Logged so useless triggers can be found and removed (§10.3). */
  async engaged(businessId: string, userId: string, key: NudgeKey): Promise<void> {
    await this.database.query(
      `INSERT INTO nudge_state (business_id, user_id, nudge_key, engaged_count)
            VALUES ($1, $2, $3, 1)
       ON CONFLICT (business_id, user_id, nudge_key)
       DO UPDATE SET engaged_count = nudge_state.engaged_count + 1`,
      [businessId, userId, key]
    );
  }
}
