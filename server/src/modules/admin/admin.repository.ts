import { Database } from '../../infrastructure/database';
import { deleteUserAccount, ensureAccountDeletionsSchema } from '../shared/delete-user-account';
import { deleteBusinessCascade } from '../shared/delete-business';
import { plansForBusinesses } from './admin.plan';

/**
 * A user, and only a user. Business name / country deliberately do NOT live
 * here any more: `business_profiles` is one row per BUSINESS since the
 * 2026-08-10 migration, so joining it into a user list fanned every
 * multi-workspace owner out into several rows. That data has its own tab now —
 * see `AdminBusinessRow`.
 */
export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  /** Personal phone, from user_profiles. Empty until somebody supplies one. */
  phone: string;
  role: string;
  status: string;
  joinedAt: string | null;
  dateOfBirth: string | null;
  emailVerified: boolean;
}

export interface AdminBusinessRow {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerless: boolean;
  previousOwnerEmail: string;
  /** Seats — billing is per seat, and every member occupies one. */
  memberCount: number;
  /** Display name of the plan being paid for. */
  plan: string;
  planKey: string;
  /** What the workspace can USE — differs from `plan` during a trial or window. */
  effectivePlan: string;
  effectivePlanKey: string;
  badgeLabel: string;
  badgeTone: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  grandfatheredUntil: string | null;
  /** True while a trial or grandfather window grants more than they pay for. */
  onFreeWindow: boolean;
  country: string;
  industry: string;
  /** The business's own phone, from business_profiles. */
  businessPhone: string;
  status: string;
  createdAt: string | null;
}

export interface AdminTargetUser {
  id: string;
  email: string;
  role: string;
  status: string;
}

export interface AuditLogRow {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetId: string | null;
  targetEmail: string | null;
  details: any;
  createdAt: string | null;
}

/**
 * One closed account. Everything here is a COPY taken before the delete, not a
 * reference — the user row it describes no longer exists.
 */
export interface AccountDeletionRow {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  /** 'self' = they closed it. 'admin' = we removed it. */
  source: 'self' | 'admin' | string;
  actorId: string | null;
  actorEmail: string | null;
  workspacesDestroyed: number;
  createdAt: string | null;
}

export class AdminRepository {
  constructor(private database: Database) {}

  /**
   * Add the `status` column to users (for restrict/suspend) and make sure the
   * role CHECK constraint allows all four roles. Idempotent.
   *
   * The original `users_role_check` predates the owner/super_admin roles and
   * rejects them, which made the boot promotion to `owner` throw. We drop and
   * recreate it with the full role set so promotions can succeed.
   */
  async ensureSchema(): Promise<void> {
    // The record of closed accounts. Defined next to the teardown it is written
    // by, so the table and the INSERT cannot drift apart.
    await ensureAccountDeletionsSchema(this.database);

    await this.database.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'`
    );
    await this.database.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
    await this.database.query(
      `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'super_admin', 'owner'))`
    );

    // Append-only audit trail of admin actions. There is intentionally no delete
    // path for these rows — the table records who did what, to whom, and when.
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id UUID,
        actor_email VARCHAR(320),
        action VARCHAR(255) NOT NULL,
        target_id UUID,
        target_email VARCHAR(320),
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await this.database.query(`CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC)`);
  }

  /**
   * Record an admin action. Best-effort: never throws into the request path.
   *
   * Every caller logs *after* the action has already committed — the user is
   * deleted, the password is changed. Letting a failed INSERT escape would send
   * the route's catch-all 500 back for an operation that actually succeeded,
   * telling the admin their delete failed when the account is already gone. A
   * missing audit row is bad; reporting a completed deletion as an error is
   * worse, so the write is swallowed and logged for the server operator.
   */
  async addAuditLog(entry: {
    actorId?: string | null; actorEmail?: string | null; action: string;
    targetId?: string | null; targetEmail?: string | null; details?: any;
  }): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO admin_audit_logs (actor_id, actor_email, action, target_id, target_email, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          entry.actorId ?? null,
          entry.actorEmail ?? null,
          entry.action,
          entry.targetId ?? null,
          entry.targetEmail ?? null,
          entry.details != null ? JSON.stringify(entry.details) : null,
        ]
      );
    } catch (error) {
      // Loud in the server logs: this is the audit trail failing to record a
      // privileged action, which someone should notice even though the request
      // itself is allowed to succeed.
      console.error(
        `ADMIN AUDIT LOG ERROR: failed to record "${entry.action}" by ${entry.actorEmail ?? 'unknown'} on ${entry.targetEmail ?? 'unknown'}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /** Most recent audit entries, newest first. */
  async listAuditLogs(limit = 250): Promise<AuditLogRow[]> {
    const result = await this.database.query(
      `SELECT id, actor_id, actor_email, action, target_id, target_email, details, created_at
       FROM admin_audit_logs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows.map((r: any) => ({
      id: r.id,
      actorId: r.actor_id,
      actorEmail: r.actor_email,
      action: r.action,
      targetId: r.target_id,
      targetEmail: r.target_email,
      details: r.details,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    }));
  }

  /**
   * Promote emails to a role at boot, upgrade-only (never downgrades a higher
   * role). Role rank: user < admin < super_admin < owner. Returns the number of
   * user rows actually upgraded. Tolerates surrounding quotes/whitespace in the
   * configured values (a common env-var mistake) and matches case-insensitively.
   */
  async ensureRole(role: 'admin' | 'super_admin' | 'owner', emails: string[]): Promise<number> {
    const cleaned = emails
      .map((e) => e.trim().replace(/^["']+|["']+$/g, '').trim().toLowerCase())
      .filter(Boolean);
    if (cleaned.length === 0) return 0;
    const rank: Record<string, number> = { user: 0, admin: 1, super_admin: 2, owner: 3 };
    const result = await this.database.query(
      `UPDATE users SET role = $2, updated_at = NOW()
       WHERE lower(email) = ANY($1::text[])
         AND (CASE role WHEN 'owner' THEN 3 WHEN 'super_admin' THEN 2 WHEN 'admin' THEN 1 ELSE 0 END) < $3`,
      [cleaned, role, rank[role]]
    );
    return result.rowCount ?? 0;
  }

  /**
   * All users, newest first. Admin-only. ONE ROW PER USER.
   *
   * This used to `LEFT JOIN business_profiles ON bp.user_id = u.id` to show a
   * company and country column. That join is why the list showed 29 rows for 26
   * users and repeated a four-workspace owner four times: `business_profiles`
   * is one row per BUSINESS since the 2026-08-10 migration, and still carries
   * `user_id`, so it multiplies rather than decorates.
   *
   * There is no join to narrow now — business data moved to `listBusinesses`,
   * where one row per business is the point rather than a bug.
   */
  async listUsers(): Promise<AdminUserRow[]> {
    const result = await this.database.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status, u.created_at,
             u.date_of_birth, u.email_verified, p.phone
      FROM users u
      /**
       * Safe to join on user_id, unlike business_profiles.
       *
       * user_profiles has a UNIQUE index on user_id, so this is one row per
       * user. business_profiles lost that constraint and multiplies rows —
       * which is exactly how this list once turned 26 users into 29. Check
       * pg_indexes before adding any similar join.
       */
      LEFT JOIN user_profiles p ON p.user_id = u.id
      ORDER BY u.created_at DESC NULLS LAST
    `);
    return result.rows.map((r: any) => ({
      id: r.id,
      name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.email,
      email: r.email,
      phone: r.phone ?? '',
      role: r.role,
      status: r.status ?? 'active',
      joinedAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      dateOfBirth: r.date_of_birth ? new Date(r.date_of_birth).toISOString().slice(0, 10) : null,
      emailVerified: !!r.email_verified,
    }));
  }

  /**
   * Every workspace, newest first, one row each.
   *
   * The profile join here is `bp.business_id = b.id` — the per-business key.
   * Joining `business_profiles` on `user_id` is exactly the mistake that broke
   * the user list; on a business list it would silently duplicate every
   * workspace belonging to a multi-workspace owner.
   *
   * `member_count` is a plain COUNT because the owner gets an `Owner` row in
   * `business_members` both on create and via the backfill — no +1 needed.
   */
  async listBusinesses(): Promise<AdminBusinessRow[]> {
    const result = await this.database.query(`
      SELECT b.id, b.name, b.created_at, b.status,
             u.email AS owner_email, u.first_name, u.last_name,
             prev.email AS previous_owner_email,
             bp.country, bp.industry, bp.business_phone,
             (SELECT COUNT(*) FROM business_members m WHERE m.business_id = b.id) AS member_count
      FROM businesses b
      /**
       * LEFT JOIN, not JOIN. A workspace can now be ownerless — the last member
       * leaving drops ownership rather than the data — and an inner join would
       * silently hide exactly the workspaces that most need an admin's
       * attention.
       */
      LEFT JOIN users u ON u.id = b.owner_id
      LEFT JOIN users prev ON prev.id = b.previous_owner_id
      LEFT JOIN business_profiles bp ON bp.business_id = b.id
      ORDER BY b.created_at DESC NULLS LAST
    `);
    // One batched lookup rather than a query per row.
    const plans = await plansForBusinesses(this.database, result.rows.map((r: any) => r.id));

    return result.rows.map((r: any) => ({
      id: r.id,
      name: r.name ?? '',
      ownerName: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.owner_email || '',
      ownerEmail: r.owner_email ?? '',
      /** True when nobody owns this workspace — it is waiting to be reassigned. */
      ownerless: !r.owner_email,
      /** Whose it was, so an accidental departure can be undone knowingly. */
      previousOwnerEmail: r.previous_owner_email ?? '',
      memberCount: Number(r.member_count) || 0,
      plan: plans[r.id]?.planName ?? 'Freemium',
      planKey: plans[r.id]?.planKey ?? 'freemium',
      effectivePlan: plans[r.id]?.effectivePlanName ?? 'Freemium',
      effectivePlanKey: plans[r.id]?.effectivePlanKey ?? 'freemium',
      badgeLabel: plans[r.id]?.badgeLabel ?? 'Freemium',
      badgeTone: plans[r.id]?.badgeTone ?? 'freemium',
      subscriptionStatus: plans[r.id]?.status ?? 'none',
      trialEndsAt: plans[r.id]?.trialEndsAt ?? null,
      grandfatheredUntil: plans[r.id]?.grandfatheredUntil ?? null,
      onFreeWindow: plans[r.id]?.onFreeWindow ?? false,
      country: r.country ?? '',
      industry: r.industry ?? '',
      businessPhone: r.business_phone ?? '',
      status: r.status ?? 'active',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    }));
  }

  /** Name and country for one workspace. Country lives on its profile row. */
  async updateBusiness(
    id: string,
    data: { name?: string; country?: string }
  ): Promise<void> {
    if (data.name !== undefined) {
      await this.database.query(
        `UPDATE businesses SET name = $2, updated_at = NOW() WHERE id = $1`,
        [id, data.name]
      );
    }
    if (data.country !== undefined) {
      // Keyed on business_id, the column the migration made unique. A profile
      // row can legitimately not exist yet for a workspace whose owner never
      // finished onboarding, so this is an upsert rather than a bare UPDATE.
      await this.database.query(
        `INSERT INTO business_profiles (user_id, business_id, country)
         SELECT b.owner_id, b.id, $2 FROM businesses b WHERE b.id = $1
         ON CONFLICT (business_id) WHERE business_id IS NOT NULL
         DO UPDATE SET country = EXCLUDED.country, updated_at = NOW()`,
        [id, data.country]
      );
    }
  }

  /** Restrict or reactivate a workspace. Enforced in `withBusiness`. */
  async setBusinessStatus(id: string, status: 'active' | 'suspended'): Promise<void> {
    await this.database.query(
      `UPDATE businesses SET status = $2, updated_at = NOW() WHERE id = $1`,
      [id, status]
    );
  }

  /**
   * One workspace plus its owner's ROLE — the routes gate business actions on
   * the owner's role, so returning it here keeps that a single query instead of
   * a lookup-by-email round trip.
   */
  async getBusinessById(id: string): Promise<{
    id: string; name: string; ownerId: string; ownerEmail: string; ownerRole: string; status: string;
  } | null> {
    const result = await this.database.query(
      /**
       * LEFT JOIN, because a workspace can be OWNERLESS.
       *
       * With an inner join this returned nothing for exactly those workspaces —
       * so "Assign owner", the one action that exists for them, failed with
       * "Business not found". Same shape of bug as the admin list had.
       */
      `SELECT b.id, b.name, b.status, b.owner_id, u.email AS owner_email, u.role AS owner_role
       FROM businesses b LEFT JOIN users u ON u.id = b.owner_id WHERE b.id = $1`,
      [id]
    );
    const r = result.rows[0];
    return r
      ? {
          id: r.id,
          name: r.name,
          // Empty rather than null for an ownerless workspace: callers put these
          // straight into audit entries and confirmation text.
          ownerId: r.owner_id ?? '',
          ownerEmail: r.owner_email ?? '',
          ownerRole: r.owner_role ?? 'user',
          status: r.status ?? 'active',
        }
      : null;
  }

  /** Irreversible. Ordering lives in the shared cascade, not here. */
  async deleteBusiness(id: string): Promise<boolean> {
    return deleteBusinessCascade(this.database, id);
  }

  async getById(id: string): Promise<AdminTargetUser | null> {
    const result = await this.database.query('SELECT id, email, role, status FROM users WHERE id = $1', [id]);
    const r = result.rows[0];
    return r ? { id: r.id, email: r.email, role: r.role, status: r.status ?? 'active' } : null;
  }

  /**
   * Apply admin edits. `users` columns (name / role / status / date_of_birth)
   * and `business_profiles` columns (business name / country) are written in the
   * same call. Returns nothing; caller re-lists.
   */
  async updateUser(
    id: string,
    data: { firstName?: string; lastName?: string; role?: string; status?: string; dateOfBirth?: string | null; emailVerified?: boolean }
  ): Promise<void> {
    const set: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (data.firstName !== undefined) { set.push(`first_name = $${i++}`); values.push(data.firstName); }
    if (data.lastName !== undefined) { set.push(`last_name = $${i++}`); values.push(data.lastName); }
    if (data.role !== undefined) { set.push(`role = $${i++}`); values.push(data.role); }
    if (data.status !== undefined) { set.push(`status = $${i++}`); values.push(data.status); }
    if (data.dateOfBirth !== undefined) { set.push(`date_of_birth = $${i++}`); values.push(data.dateOfBirth || null); }
    if (data.emailVerified !== undefined) { set.push(`email_verified = $${i++}`); values.push(data.emailVerified); }
    if (set.length > 0) {
      set.push(`updated_at = NOW()`);
      values.push(id);
      await this.database.query(`UPDATE users SET ${set.join(', ')} WHERE id = $${i}`, values);
    }

    /*
     * Business name / country are NOT edited here any more — they belong to a
     * workspace, not a person, and `updateBusiness` owns them.
     *
     * What used to be here was `INSERT ... ON CONFLICT (user_id) DO UPDATE`.
     * The 2026-08-10 migration left `user_id` with a plain non-unique index and
     * moved the unique index onto `business_id`; Postgres can only infer a
     * conflict target from a unique index, so that statement raised 42P10 and
     * admin edits to business name or country had been failing outright. It
     * could not be repaired in place either, because for an owner with several
     * workspaces there was no answer to "which one does this write to".
     */
  }

  /** Look an account up by email. Case-insensitive — nobody types it back exactly. */
  async findByEmail(email: string): Promise<{ id: string; email: string } | null> {
    const r = await this.database.query(
      'SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)', [email]
    );
    return r.rows[0] ? { id: r.rows[0].id, email: r.rows[0].email } : null;
  }

  /**
   * Give an ownerless workspace an owner.
   *
   * Both records that carry ownership move together, same as a user-initiated
   * transfer: `businesses.owner_id` and an `Owner` row in `business_members`.
   * The membership is upserted because the person may already be inside the
   * workspace in another role.
   *
   * Deliberately restricted to workspaces with NO owner. Reassigning one that
   * has an owner would be taking a business off somebody from the admin panel,
   * which is a different and much graver action than recovering an abandoned
   * one — and not what this exists for.
   */
  async assignOwner(businessId: string, userId: string): Promise<'assigned' | 'has_owner' | 'not_found'> {
    const current = await this.database.query(
      'SELECT owner_id FROM businesses WHERE id = $1', [businessId]
    );
    if (current.rowCount === 0) return 'not_found';
    if (current.rows[0].owner_id) return 'has_owner';

    await this.database.transaction(async (client) => {
      await client.query(
        `UPDATE businesses SET owner_id = $2, previous_owner_id = NULL, updated_at = NOW()
          WHERE id = $1`,
        [businessId, userId]
      );
      await client.query(
        `INSERT INTO business_members (business_id, user_id, role) VALUES ($1, $2, 'Owner')
         ON CONFLICT (business_id, user_id) DO UPDATE SET role = 'Owner'`,
        [businessId, userId]
      );
    });
    return 'assigned';
  }

  /**
   * Everything the Overview tab shows, in one request.
   *
   * Aggregated in SQL rather than by loading the tables and counting in
   * JavaScript: these are counts over every user and workspace on the platform,
   * and shipping all of that to a browser to produce eight numbers would get
   * slower every week.
   *
   * One query per section rather than one giant one — they are independent, a
   * join between them would multiply rows, and separately they stay readable.
   */
  async overviewStats(range?: { from?: string | null; to?: string | null }): Promise<{
    period: { from: string | null; to: string | null };
    users: { total: number; verified: number; suspended: number; newThisMonth: number; newInPeriod: number; admins: number };
    businesses: { total: number; suspended: number; multiMember: number; withProfile: number; avgMembers: number; newInPeriod: number };
    countries: { country: string; businesses: number }[];
    seats: { billable: number; viewersFree: number };
    churn: {
      active: number; pastDue: number; cancelling: number; canceled: number;
      trialing: number; trialsStarted: number; trialsConverted: number;
      churnRate: number; startedInPeriod: number; cancelledInPeriod: number;
    };
  }> {
    /**
     * The period bounds. Null on either side means open-ended.
     *
     * Only counts with a real date are scoped by it — signups, workspaces
     * created, trials started, cancellations. Everything else on this page is a
     * SNAPSHOT of how things stand today: MRR, plan mix, seat counts, how many
     * subscriptions are active. Quietly filtering a snapshot by a date range
     * would produce a number that looks precise and means nothing, so those are
     * left alone and the page says which is which.
     */
    const from = range?.from || null;
    const to = range?.to || null;
    // `to` is inclusive of the whole day: a range ending today should contain
    // things that happened this afternoon.
    const inPeriod = (column: string) =>
      `(($1::date IS NULL OR ${column} >= $1::date) AND ($2::date IS NULL OR ${column} < $2::date + 1))`;
    const bounds = [from, to];
    const [users, businesses, countries, seats, churn] = await Promise.all([
      this.database.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE email_verified)::int AS verified,
               COUNT(*) FILTER (WHERE status = 'suspended')::int AS suspended,
               COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW()))::int AS new_this_month,
               COUNT(*) FILTER (WHERE ${inPeriod('created_at')})::int AS new_in_period,
               COUNT(*) FILTER (WHERE role <> 'user')::int AS admins
          FROM users
      `, bounds),
      this.database.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE b.status = 'suspended')::int AS suspended,
               COUNT(*) FILTER (WHERE (SELECT COUNT(*) FROM business_members m WHERE m.business_id = b.id) > 1)::int AS multi_member,
               COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM business_profiles p WHERE p.business_id = b.id))::int AS with_profile,
               COALESCE(AVG((SELECT COUNT(*) FROM business_members m WHERE m.business_id = b.id)), 0)::numeric(10,2) AS avg_members,
               COUNT(*) FILTER (WHERE ${inPeriod('b.created_at')})::int AS new_in_period
          FROM businesses b
      `, bounds),
      this.database.query(`
        SELECT COALESCE(NULLIF(TRIM(p.country), ''), 'Unknown') AS country,
               COUNT(*)::int AS businesses
          FROM businesses b
          LEFT JOIN business_profiles p ON p.business_id = b.id
         GROUP BY 1
         ORDER BY businesses DESC, country ASC
      `),
      this.database.query(`
        SELECT COALESCE(SUM(CASE WHEN role <> 'Viewer' THEN 1 ELSE 0 END), 0)::int AS billable,
               COALESCE(SUM(CASE WHEN role = 'Viewer' THEN 1 ELSE 0 END), 0)::int AS viewers
          FROM business_members
      `),
      /**
       * Churn, from what the subscription table actually knows.
       *
       * `cancelling` is the one worth watching: a subscription still active but
       * with an end date set. Those are customers who have already decided to
       * leave and are simply running out their period — the only window in
       * which anything can still be done about it.
       *
       * `trialsConverted` counts workspaces that started a trial and now pay
       * for something. Trials that lapsed back to freemium are the difference.
       */
      this.database.query(`
        SELECT COUNT(*) FILTER (WHERE status = 'active')::int AS active,
               COUNT(*) FILTER (WHERE status = 'past_due')::int AS past_due,
               COUNT(*) FILTER (WHERE cancel_at IS NOT NULL AND cancel_at > NOW())::int AS cancelling,
               COUNT(*) FILTER (WHERE status = 'canceled')::int AS canceled,
               COUNT(*) FILTER (WHERE status = 'trialing' AND trial_ends_at > NOW())::int AS trialing,
               COUNT(*) FILTER (WHERE trial_started_at IS NOT NULL)::int AS trials_started,
               COUNT(*) FILTER (WHERE trial_started_at IS NOT NULL AND plan <> 'freemium')::int AS trials_converted,
               COUNT(*) FILTER (WHERE trial_started_at IS NOT NULL AND ${inPeriod('trial_started_at')})::int AS started_in_period,
               -- No cancelled_at column exists, so updated_at on a cancelled
               -- row is the closest honest proxy: the last thing that happened
               -- to it was the cancellation.
               COUNT(*) FILTER (WHERE status = 'canceled' AND ${inPeriod('updated_at')})::int AS cancelled_in_period
          FROM business_subscriptions
      `, bounds),
    ]);

    const u = users.rows[0] ?? {};
    const b = businesses.rows[0] ?? {};
    const s = seats.rows[0] ?? {};
    return {
      period: { from, to },
      users: {
        total: Number(u.total) || 0,
        newInPeriod: Number(u.new_in_period) || 0,
        verified: Number(u.verified) || 0,
        suspended: Number(u.suspended) || 0,
        newThisMonth: Number(u.new_this_month) || 0,
        admins: Number(u.admins) || 0,
      },
      businesses: {
        total: Number(b.total) || 0,
        suspended: Number(b.suspended) || 0,
        multiMember: Number(b.multi_member) || 0,
        withProfile: Number(b.with_profile) || 0,
        avgMembers: Number(b.avg_members) || 0,
        newInPeriod: Number(b.new_in_period) || 0,
      },
      countries: countries.rows.map((r: any) => ({
        country: r.country,
        businesses: Number(r.businesses) || 0,
      })),
      seats: {
        billable: Number(s.billable) || 0,
        viewersFree: Number(s.viewers) || 0,
      },
      churn: (() => {
        const c = churn.rows[0] ?? {};
        const active = Number(c.active) || 0;
        const canceled = Number(c.canceled) || 0;
        const ever = active + canceled;
        return {
          active,
          pastDue: Number(c.past_due) || 0,
          cancelling: Number(c.cancelling) || 0,
          canceled,
          trialing: Number(c.trialing) || 0,
          trialsStarted: Number(c.trials_started) || 0,
          trialsConverted: Number(c.trials_converted) || 0,
          // Share of everyone who ever subscribed who has since cancelled.
          // Zero subscribers means zero, not a division by nothing.
          churnRate: ever > 0 ? Math.round((canceled / ever) * 1000) / 10 : 0,
          startedInPeriod: Number(c.started_in_period) || 0,
          cancelledInPeriod: Number(c.cancelled_in_period) || 0,
        };
      })(),
    };
  }

  /**
   * Permanently deletes a user, their business and its whole financial history.
   *
   * Goes through the same teardown as the user's own delete-account: a bare
   * `DELETE FROM users` here trips the ON DELETE RESTRICT on
   * `journal_lines.account_id` and surfaces in the admin panel as "Internal
   * server error" for anyone who has actually posted a transaction. See
   * `deleteUserAccount`.
   */
  async deleteUser(id: string, actor?: { actorId: string; actorEmail: string }): Promise<void> {
    // Recorded as an ADMIN deletion so the deletions list can tell "we removed
    // this account" apart from "they closed it themselves" — the two need very
    // different answers when somebody asks later what happened.
    await deleteUserAccount(this.database, id, {
      source: 'admin',
      actorId: actor?.actorId ?? null,
      actorEmail: actor?.actorEmail ?? null,
    });
  }

  /**
   * Accounts that no longer exist, most recent first.
   *
   * Read from `account_deletions` rather than the audit log: the audit log only
   * ever recorded ADMIN deletions, so anyone who closed their own account was
   * invisible here — which is most of them.
   */
  async listAccountDeletions(limit = 250): Promise<AccountDeletionRow[]> {
    const r = await this.database.query(
      `SELECT id, user_id, email, name, source, actor_id, actor_email,
              workspaces_destroyed, created_at
         FROM account_deletions ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return (r.rows ?? []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,
      name: row.name,
      source: row.source,
      actorId: row.actor_id,
      actorEmail: row.actor_email,
      workspacesDestroyed: Number(row.workspaces_destroyed) || 0,
      createdAt: row.created_at,
    }));
  }
}
