import crypto from 'crypto';
import { Database } from '../../infrastructure/database';

/**
 * State for the scheduled lifecycle reminders: what has been sent to whom, when,
 * and what each person has opted out of.
 *
 * Two tables rather than one. `lifecycle_reminders` is a log the job writes;
 * `email_preferences` is a choice the customer makes. Folding an opt-out into
 * the send log would mean an unsubscribe could be erased by the next send, and
 * would leave nowhere to record a preference for a reminder never sent.
 */

export const REMINDER_TYPES = [
  'email_verification',
  'phone_recovery',
  'upgrade_nudge',
  'workspace_reengagement',
] as const;

export type ReminderType = (typeof REMINDER_TYPES)[number];

/**
 * The other switches on Settings -> Notifications.
 *
 * They lived in React state and were dropped on unmount, so every one of them
 * reset itself the moment you left the page. They are stored here rather than in
 * a table of their own: `email_preferences` is already a per-user key/boolean
 * store, and a second one would be the same shape with a different name.
 *
 * Two of these do not drive any behaviour YET — there is no product-news mailing
 * and no browser-push system to switch off. They are recorded so the choice
 * survives, and so those features start with an answer rather than assuming one.
 */
export const NOTIFICATION_KEYS = [
  'news_updates',
  'in_app_reminders',
  'push_notifications',
] as const;

export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];

/** Everything switchable on a per-user basis. */
export const PREFERENCE_KEYS = [...REMINDER_TYPES, ...NOTIFICATION_KEYS] as const;
export type PreferenceKey = ReminderType | NotificationKey;

export interface ReminderState {
  userId: string;
  reminderType: ReminderType;
  lastSentAt: string | null;
  sendCount: number;
  clickedAt: string | null;
  completedAt: string | null;
  stopped: boolean;
}

export class LifecycleRepository {
  constructor(private readonly database: Database) {}

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS lifecycle_reminders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reminder_type VARCHAR(32) NOT NULL,
        last_sent_at TIMESTAMPTZ,
        send_count INT NOT NULL DEFAULT 0,
        -- Clicked and completed are recorded SEPARATELY even though only
        -- clicked_at stops a reminder today. They are not the same event:
        -- somebody can open the verification reminder, get distracted and
        -- never verify -- and under the stop-on-click rule the reminder stops
        -- anyway. Without both columns there is no way to find out afterwards
        -- how often that happens.
        clicked_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        stopped BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, reminder_type)
      );
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS email_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reminder_type VARCHAR(32) NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, reminder_type)
      );
    `);

    /**
     * The unsubscribe token, on `users` rather than per preference row.
     *
     * One-click unsubscribe has to work LOGGED OUT — that is the whole point of
     * it, and both CAN-SPAM and Gmail's bulk-sender rules require it. A token
     * per user, carried in the link, is what makes that possible without
     * turning the unsubscribe URL into something that can opt out a stranger by
     * guessing an id.
     *
     * Not expiring: an unsubscribe link in a year-old email must still work.
     */
    await this.database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT`);
    await this.database.query(
      `CREATE INDEX IF NOT EXISTS idx_lifecycle_reminders_user ON lifecycle_reminders(user_id)`
    );

    await this.backfillExistingAccounts();
  }

  /**
   * Treat every account that exists when this ships as "already reminded today",
   * so cadences start from the deploy rather than from signup.
   *
   * Without it the first scheduled run mails the entire back catalogue at once:
   * as of writing that is 18 verification reminders, 27 phone reminders and a
   * batch of upgrade nudges, all to people who signed up months ago and have
   * never had anything but transactional mail from us. A spike of spam
   * complaints on a cold list damages the sending domain's reputation — and the
   * domain that would suffer is the one carrying password resets and email
   * verification, so the blast radius is much wider than the reminders.
   *
   * `ON CONFLICT DO NOTHING` makes it idempotent AND makes it self-limiting:
   * accounts created after this point have no row, so they are picked up by the
   * normal cadence instead.
   */
  private async backfillExistingAccounts(): Promise<void> {
    const marker = await this.database.query(
      `SELECT 1 FROM lifecycle_reminders LIMIT 1`
    );
    if ((marker.rowCount ?? 0) > 0) return; // already seeded

    await this.database.query('BEGIN');
    try {
      for (const type of REMINDER_TYPES) {
        await this.database.query(
          `INSERT INTO lifecycle_reminders (user_id, reminder_type, last_sent_at, send_count)
           SELECT id, $1, NOW(), 0 FROM users
           ON CONFLICT (user_id, reminder_type) DO NOTHING`,
          [type]
        );
      }
      await this.database.query('COMMIT');
    } catch (e) {
      await this.database.query('ROLLBACK');
      throw e;
    }
  }

  /** The unsubscribe token for a user, minted on first use. */
  async unsubscribeToken(userId: string): Promise<string> {
    const existing = await this.database.query(
      `SELECT unsubscribe_token FROM users WHERE id = $1`, [userId]
    );
    const current = existing.rows[0]?.unsubscribe_token;
    if (current) return current;

    const token = crypto.randomBytes(24).toString('hex');
    // Guarded so two concurrent sends cannot mint two tokens and leave the
    // first one dead in an email already delivered.
    const claimed = await this.database.query(
      `UPDATE users SET unsubscribe_token = $2
        WHERE id = $1 AND unsubscribe_token IS NULL
        RETURNING unsubscribe_token`,
      [userId, token]
    );
    if ((claimed.rowCount ?? 0) > 0) return token;

    const again = await this.database.query(
      `SELECT unsubscribe_token FROM users WHERE id = $1`, [userId]
    );
    return again.rows[0]?.unsubscribe_token ?? token;
  }

  /** Record that a reminder went out, bumping the count and the clock. */
  async recordSent(userId: string, type: ReminderType): Promise<void> {
    await this.database.query(
      `INSERT INTO lifecycle_reminders (user_id, reminder_type, last_sent_at, send_count)
       VALUES ($1, $2, NOW(), 1)
       ON CONFLICT (user_id, reminder_type)
       DO UPDATE SET last_sent_at = NOW(), send_count = lifecycle_reminders.send_count + 1`,
      [userId, type]
    );
  }

  /** A reminder was clicked: per spec §3 that stops it. */
  async recordClick(userId: string, type: ReminderType): Promise<void> {
    await this.database.query(
      `INSERT INTO lifecycle_reminders (user_id, reminder_type, clicked_at, stopped)
       VALUES ($1, $2, NOW(), true)
       ON CONFLICT (user_id, reminder_type)
       DO UPDATE SET clicked_at = COALESCE(lifecycle_reminders.clicked_at, NOW()), stopped = true`,
      [userId, type]
    );
  }

  /**
   * The task the reminder was asking for actually happened.
   *
   * Recorded but not acted on in v1 — it is the other half of the click/complete
   * distinction above, and the only way to learn whether the reminders are
   * working rather than merely being opened.
   */
  async recordCompleted(userId: string, type: ReminderType): Promise<void> {
    await this.database.query(
      `INSERT INTO lifecycle_reminders (user_id, reminder_type, completed_at, stopped)
       VALUES ($1, $2, NOW(), true)
       ON CONFLICT (user_id, reminder_type)
       DO UPDATE SET completed_at = COALESCE(lifecycle_reminders.completed_at, NOW()), stopped = true`,
      [userId, type]
    );
  }

  /**
   * Every preference for a user, defaulting to ON where no row exists.
   *
   * On rather than off, because these are opt-OUTs: a customer who has never
   * touched the page has not asked for silence, and defaulting to off would
   * quietly suppress the account-health reminders for everybody.
   */
  async preferences(userId: string): Promise<Record<PreferenceKey, boolean>> {
    const r = await this.database.query(
      `SELECT reminder_type, enabled FROM email_preferences WHERE user_id = $1`, [userId]
    );
    const out = Object.fromEntries(PREFERENCE_KEYS.map((t) => [t, true])) as Record<PreferenceKey, boolean>;
    for (const row of r.rows) {
      if ((PREFERENCE_KEYS as readonly string[]).includes(row.reminder_type)) {
        out[row.reminder_type as PreferenceKey] = row.enabled;
      }
    }
    return out;
  }

  async setPreference(userId: string, type: PreferenceKey, enabled: boolean): Promise<void> {
    await this.database.query(
      `INSERT INTO email_preferences (user_id, reminder_type, enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, reminder_type)
       DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`,
      [userId, type, enabled]
    );
  }

  /** Resolve an unsubscribe token to a user. Null when it matches nobody. */
  async userForUnsubscribeToken(token: string): Promise<{ id: string; email: string } | null> {
    if (!token) return null;
    const r = await this.database.query(
      `SELECT id, email FROM users WHERE unsubscribe_token = $1`, [token]
    );
    return r.rows[0] ? { id: r.rows[0].id, email: r.rows[0].email } : null;
  }

  /**
   * Touch a user's activity clock, at most once an hour.
   *
   * The condition is in the WHERE rather than checked first, so this is one
   * statement that usually matches no rows — the cheapest possible form of "do
   * nothing", and safe under concurrency.
   */
  async touchActivity(userId: string): Promise<void> {
    await this.database.query(
      `UPDATE users SET last_active_at = NOW()
        WHERE id = $1
          AND (last_active_at IS NULL OR last_active_at < NOW() - interval '1 hour')`,
      [userId]
    );
  }
}
