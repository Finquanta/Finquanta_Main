import { Database } from '../../infrastructure/database';
import { sendEmail } from '../../infrastructure/email';
import { appUrl, renderEmail, EmailSection } from '../../infrastructure/email-template';
import { effectivePlanFromRow } from '../billing/effective-plan';
import { LifecycleRepository, ReminderType, REMINDER_TYPES } from './lifecycle.repository';

/**
 * Works out who is due which reminder, then sends one digest per person.
 *
 * Every `due` query shares three conditions, and all three matter:
 *   - the reminder has not been STOPPED (clicked once, per spec §3)
 *   - the customer has not opted out of that specific type
 *   - enough time has passed since the last send
 *
 * The cadence check lives in SQL rather than in a schedule assumption. Running
 * the job twice in one day must send nothing twice, and a cron that fires late,
 * early or twice is a normal thing for a cron to do.
 */

export interface DueReminder {
  userId: string;
  email: string;
  firstName: string;
  type: ReminderType;
  /** Only for the workspace-scoped reminders. */
  businessId?: string;
  businessName?: string;
}

export interface RunResult {
  dryRun: boolean;
  sent: number;
  recipients: { email: string; types: ReminderType[] }[];
  byType: Record<string, number>;
}

/** Shared with every query: not stopped, not opted out, cadence elapsed. */
const GATE = `
  AND NOT COALESCE(r.stopped, false)
  AND COALESCE(p.enabled, true)
`;

export class LifecycleService {
  private readonly repo: LifecycleRepository;

  constructor(private readonly database: Database) {
    this.repo = new LifecycleRepository(database);
  }

  // ---------------------------------------------------------------- due lists

  /** Unverified for a week, then every fortnight. */
  private async dueVerification(): Promise<DueReminder[]> {
    const r = await this.database.query(`
      SELECT u.id, u.email, u.first_name
        FROM users u
        LEFT JOIN lifecycle_reminders r ON r.user_id = u.id AND r.reminder_type = 'email_verification'
        LEFT JOIN email_preferences  p ON p.user_id = u.id AND p.reminder_type = 'email_verification'
       WHERE NOT u.email_verified
         ${GATE}
         AND CASE WHEN r.last_sent_at IS NULL
                  THEN u.created_at <= NOW() - interval '7 days'
                  ELSE r.last_sent_at <= NOW() - interval '14 days'
             END`);
    return r.rows.map((x: any) => ({
      userId: x.id, email: x.email, firstName: x.first_name || '', type: 'email_verification' as const,
    }));
  }

  /** No recovery phone on file. Same cadence as verification. */
  private async duePhone(): Promise<DueReminder[]> {
    const r = await this.database.query(`
      SELECT u.id, u.email, u.first_name
        FROM users u
        LEFT JOIN lifecycle_reminders r ON r.user_id = u.id AND r.reminder_type = 'phone_recovery'
        LEFT JOIN email_preferences  p ON p.user_id = u.id AND p.reminder_type = 'phone_recovery'
       WHERE NOT EXISTS (
               SELECT 1 FROM user_profiles up
                WHERE up.user_id = u.id AND COALESCE(up.phone, '') <> ''
             )
         ${GATE}
         AND CASE WHEN r.last_sent_at IS NULL
                  THEN u.created_at <= NOW() - interval '7 days'
                  ELSE r.last_sent_at <= NOW() - interval '14 days'
             END`);
    return r.rows.map((x: any) => ({
      userId: x.id, email: x.email, firstName: x.first_name || '', type: 'phone_recovery' as const,
    }));
  }

  /**
   * On Freemium with nothing covering them. Monthly, owners and admins only.
   *
   * The free-window test is NOT written into the SQL. `effectivePlanFromRow` is
   * already the single source of truth for what a workspace can actually use —
   * the switcher, the admin panel and the entitlements service all defer to it —
   * and a fourth copy of the rule in a WHERE clause is a fourth thing to keep in
   * step. It matters here more than anywhere: 30 of 31 production workspaces are
   * grandfathered with Business features free until Feb 2027, so a trigger of
   * "plan = freemium" alone would ask almost every customer to buy something
   * they already have.
   *
   * Viewers are excluded for the same reason they are not billed as seats: they
   * cannot act on it.
   */
  private async dueUpgrade(): Promise<DueReminder[]> {
    const r = await this.database.query(`
      SELECT u.id, u.email, u.first_name, b.id AS business_id, b.name AS business_name,
             s.plan, s.status, s.trial_ends_at, s.grandfathered_until
        FROM businesses b
        JOIN business_members m ON m.business_id = b.id AND m.role IN ('Owner', 'Admin')
        JOIN users u ON u.id = m.user_id
        -- LEFT, not inner. Subscription rows are created lazily by ensureFor,
        -- the first time a workspace touches a billing endpoint, so a workspace
        -- that has never opened the billing page has NO row at all. An inner
        -- join silently excluded exactly the newest customers -- the ones most
        -- worth asking -- and did it invisibly, because a missing row and a
        -- freemium row mean the same thing.
        LEFT JOIN business_subscriptions s ON s.business_id = b.id
        LEFT JOIN lifecycle_reminders r ON r.user_id = u.id AND r.reminder_type = 'upgrade_nudge'
        LEFT JOIN email_preferences  p ON p.user_id = u.id AND p.reminder_type = 'upgrade_nudge'
       WHERE COALESCE(s.plan, 'freemium') = 'freemium'
         ${GATE}
         -- A fortnight's grace before the FIRST one. Every other reminder has
         -- a grace period and this one had none, so somebody who signed up on
         -- Monday was asked to buy something on Tuesday -- before they had
         -- entered a single transaction, and while the personalised line this
         -- email is built around ("you have used 48 of 50 messages") had no
         -- usage to point at. Longer than the week the account-health
         -- reminders wait, because this one is asking for money.
         AND CASE WHEN r.last_sent_at IS NULL
                  THEN u.created_at <= NOW() - interval '14 days'
                  ELSE r.last_sent_at <= NOW() - interval '30 days'
             END`);

    return r.rows
      // `effectivePlanFromRow` already defaults a missing plan to freemium and
      // a missing status to 'none', so a workspace with no subscription row
      // resolves to "freemium, with nothing covering it" — which is correct.
      .filter((x: any) => !effectivePlanFromRow(x).onFreeWindow)
      .map((x: any) => ({
        userId: x.id, email: x.email, firstName: x.first_name || '',
        type: 'upgrade_nudge' as const,
        businessId: x.business_id, businessName: x.business_name,
      }));
  }

  /**
   * Nobody at all has touched the workspace in two months.
   *
   * EVERY member has to be quiet (spec §8) — one active colleague resets it for
   * the whole workspace, which is why this compares the MAX across members
   * rather than each member's own clock.
   *
   * A workspace where nobody has a `last_active_at` yet produces NULL, and
   * `NULL <= ...` is not true, so it does not match. That is the behaviour we
   * want rather than an accident: until the activity column has been collecting
   * for a while, "no recorded activity" means "we were not looking", not "they
   * left".
   */
  private async dueReengagement(): Promise<DueReminder[]> {
    const r = await this.database.query(`
      SELECT u.id, u.email, u.first_name, b.id AS business_id, b.name AS business_name
        FROM businesses b
        JOIN business_members m ON m.business_id = b.id
        JOIN users u ON u.id = m.user_id
        LEFT JOIN lifecycle_reminders r ON r.user_id = u.id AND r.reminder_type = 'workspace_reengagement'
        LEFT JOIN email_preferences  p ON p.user_id = u.id AND p.reminder_type = 'workspace_reengagement'
       WHERE (
               SELECT MAX(u2.last_active_at)
                 FROM business_members m2
                 JOIN users u2 ON u2.id = m2.user_id
                WHERE m2.business_id = b.id
             ) <= NOW() - interval '60 days'
         ${GATE}
         AND (r.last_sent_at IS NULL OR r.last_sent_at <= NOW() - interval '60 days')`);
    return r.rows.map((x: any) => ({
      userId: x.id, email: x.email, firstName: x.first_name || '',
      type: 'workspace_reengagement' as const,
      businessId: x.business_id, businessName: x.business_name,
    }));
  }

  async collectDue(): Promise<DueReminder[]> {
    const [a, b, c, d] = await Promise.all([
      this.dueVerification(), this.duePhone(), this.dueUpgrade(), this.dueReengagement(),
    ]);
    return [...a, ...b, ...c, ...d];
  }

  // ------------------------------------------------------------------ content

  /** The copy for one reminder, as a section of a possibly larger email. */
  private section(d: DueReminder, token: string): EmailSection {
    const base = appUrl();
    // Every CTA carries the type, so a click can be recorded against the right
    // reminder and stop that one rather than all of them.
    const track = (path: string) =>
      `${base}/r/${d.type}?t=${token}&next=${encodeURIComponent(path)}`;

    switch (d.type) {
      case 'email_verification':
        return {
          heading: 'Your email address is not confirmed yet',
          paragraphs: [
            'Confirming your address is what lets us help you back into your account if you ever lose access, and it is the only way we can reach you about anything important.',
            'If a free trial is still running on your workspace, confirming also adds 7 days to it.',
          ],
          cta: { label: 'Confirm my email', url: track('/profile-settings') },
        };
      case 'phone_recovery':
        return {
          heading: 'Add a recovery phone number',
          paragraphs: [
            'A phone number on file is what we use to help verify it is really you if your account is ever compromised.',
            'It is only used for account recovery — not for text alerts, and not for anything to do with signing in.',
          ],
          cta: { label: 'Add a phone number', url: track('/profile-settings') },
        };
      case 'upgrade_nudge':
        return {
          heading: `Getting more out of ${d.businessName || 'your workspace'}`,
          paragraphs: [
            'You are on the free plan, which includes 50 Finna messages a month and 3 business groups.',
            'Paid plans lift those limits and unlock the Council, cash-flow forecasting and the full Company Brain. Plans start at $19.99 a month per seat.',
          ],
          cta: { label: 'See the plans', url: track('/workspace-settings?tab=billing') },
        };
      case 'workspace_reengagement':
        return {
          heading: `${d.businessName || 'Your workspace'} is still here`,
          paragraphs: [
            'It has been a couple of months since anyone opened this workspace. Everything is exactly as you left it — your books, your invoices and your history are all still there.',
            'If you have moved on, you can unsubscribe below and we will stop reminding you.',
          ],
          cta: { label: 'Pick up where you left off', url: track('/dashboard') },
        };
    }
  }

  private subjectFor(types: ReminderType[], name: string): string {
    if (types.length > 1) return `${name ? name + ', a' : 'A'} couple of things on your Finquanta account`;
    switch (types[0]) {
      case 'email_verification': return 'Please confirm your Finquanta email address';
      case 'phone_recovery': return 'Add a recovery phone number to your Finquanta account';
      case 'upgrade_nudge': return 'Getting more out of Finquanta';
      case 'workspace_reengagement': return 'Your Finquanta workspace is still here';
      default: return 'Your Finquanta account';
    }
  }

  // ---------------------------------------------------------------------- run

  /**
   * One digest per person, never one email per reminder.
   *
   * A new signup is routinely unverified AND has no phone AND is on the free
   * plan, so sending per reminder would mean three separate nags in the same
   * hour — the fastest way to be marked as spam by the very people we most want
   * to keep (spec §5).
   */
  async run({ dryRun = false }: { dryRun?: boolean } = {}): Promise<RunResult> {
    /**
     * Outside production, a real send is refused unless explicitly unlocked.
     *
     * This is not belt-and-braces. `server/.env` points a developer's machine at
     * a Neon BRANCH of production, which is a copy of the real users table —
     * real customers, real addresses. `RESEND_API_KEY` is set there too. So a
     * single mistaken run from localhost mails live customers a batch of
     * reminders, from the same domain that carries password resets, with no way
     * to recall any of it.
     *
     * A dry run is always allowed: it is the safe thing and should never need
     * unlocking. Set LIFECYCLE_ALLOW_SEND=1 to send for real from a dev machine,
     * and mean it.
     */
    if (!dryRun && process.env.NODE_ENV !== 'production' && process.env.LIFECYCLE_ALLOW_SEND !== '1') {
      throw new Error(
        'Refusing to send lifecycle emails outside production. The dev database holds real ' +
        'customer addresses. Use a dry run, or set LIFECYCLE_ALLOW_SEND=1 if you really mean it.'
      );
    }

    const due = await this.collectDue();

    const byUser = new Map<string, DueReminder[]>();
    for (const d of due) {
      const list = byUser.get(d.userId) ?? [];
      // One of each type per person, even when they own several workspaces.
      if (!list.some((x) => x.type === d.type)) list.push(d);
      byUser.set(d.userId, list);
    }

    const byType: Record<string, number> = {};
    const recipients: RunResult['recipients'] = [];
    let sent = 0;

    for (const [userId, items] of byUser) {
      const first = items[0];
      if (!first) continue;
      const types = items.map((i) => i.type);
      recipients.push({ email: first.email, types });
      for (const t of types) byType[t] = (byType[t] ?? 0) + 1;
      if (dryRun) continue;

      const token = await this.repo.unsubscribeToken(userId);
      const subject = this.subjectFor(types, first.firstName);
      const html = renderEmail({
        title: items.length > 1 ? 'A couple of things on your account' : subject,
        sections: items.map((i) => this.section(i, token)),
        unsubscribeUrl: `${appUrl()}/unsubscribe?t=${token}`,
      });

      try {
        await sendEmail({ to: first.email, subject, html });
        // Recorded only on a successful send. A Resend outage must not burn the
        // cadence and leave somebody silently skipped for a fortnight.
        for (const t of types) await this.repo.recordSent(userId, t);
        sent += 1;
      } catch {
        // One bad address must not abandon the rest of the run.
      }
    }

    return { dryRun, sent, recipients, byType };
  }

  /**
   * Send one reminder to one person now, from the admin panel.
   *
   * Ignores the cadence — that is the point of a manual send — but still honours
   * an opt-out. Continuing to mail somebody who has unsubscribed is the one
   * thing here that is not merely rude but against CAN-SPAM, and "an admin
   * pressed a button" is not an exemption.
   */
  async sendOne(
    userId: string,
    type: ReminderType,
    /**
     * Who pressed the button. Outside production a send is allowed only when
     * the admin is mailing THEMSELVES — which is the only way to actually read
     * one of these emails before it reaches a customer.
     */
    actor?: { id?: string; email?: string }
  ): Promise<{ sent: boolean; reason?: string }> {
    if (!(REMINDER_TYPES as readonly string[]).includes(type)) {
      return { sent: false, reason: 'Unknown reminder type.' };
    }

    /**
     * The dev database is a BRANCH of production: real people, real addresses.
     * So a send from a developer's machine is refused — unless it is going to
     * the person who pressed the button, which can only ever reach themselves.
     *
     * That exception is what makes the feature testable at all. Without it the
     * only way to see the email was to deploy and mail a customer.
     */
    const toSelf = !!actor?.id && actor.id === userId;
    if (process.env.NODE_ENV !== 'production'
        && process.env.LIFECYCLE_ALLOW_SEND !== '1'
        && !toSelf) {
      return {
        sent: false,
        reason: 'Outside production you can only send this to yourself — the dev database holds '
          + 'real customer addresses. Find your own account in this list and send it there.',
      };
    }
    const prefs = await this.repo.preferences(userId);
    if (!prefs[type]) {
      return { sent: false, reason: 'This person has unsubscribed from that reminder.' };
    }

    const r = await this.database.query(
      `SELECT u.id, u.email, u.first_name,
              (SELECT b.name FROM businesses b WHERE b.owner_id = u.id ORDER BY b.created_at LIMIT 1) AS business_name
         FROM users u WHERE u.id = $1`, [userId]
    );
    const row = r.rows[0];
    if (!row) return { sent: false, reason: 'No such user.' };

    const token = await this.repo.unsubscribeToken(userId);
    const item: DueReminder = {
      userId, email: row.email, firstName: row.first_name || '', type,
      businessName: row.business_name || undefined,
    };
    const html = renderEmail({
      title: this.subjectFor([type], item.firstName),
      sections: [this.section(item, token)],
      unsubscribeUrl: `${appUrl()}/unsubscribe?t=${token}`,
    });
    await sendEmail({ to: row.email, subject: this.subjectFor([type], item.firstName), html });
    await this.repo.recordSent(userId, type);
    return { sent: true };
  }
}
