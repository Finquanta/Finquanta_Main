import { Database } from '../../infrastructure/database';
import { deleteUserAccount } from '../shared/delete-user-account';
import { deleteBusinessCascade } from '../shared/delete-business';
import { planForBusiness } from './admin.plan';

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
  memberCount: number;
  plan: string;
  country: string;
  industry: string;
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
      SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status, u.created_at, u.date_of_birth, u.email_verified
      FROM users u
      ORDER BY u.created_at DESC NULLS LAST
    `);
    return result.rows.map((r: any) => ({
      id: r.id,
      name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.email,
      email: r.email,
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
             bp.country, bp.industry,
             (SELECT COUNT(*) FROM business_members m WHERE m.business_id = b.id) AS member_count
      FROM businesses b
      JOIN users u ON u.id = b.owner_id
      LEFT JOIN business_profiles bp ON bp.business_id = b.id
      ORDER BY b.created_at DESC NULLS LAST
    `);
    return result.rows.map((r: any) => ({
      id: r.id,
      name: r.name ?? '',
      ownerName: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.owner_email,
      ownerEmail: r.owner_email,
      memberCount: Number(r.member_count) || 0,
      // Not a column — see admin.plan.ts. Spec 08 makes this real.
      plan: planForBusiness(r.id),
      country: r.country ?? '',
      industry: r.industry ?? '',
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
      `SELECT b.id, b.name, b.status, b.owner_id, u.email AS owner_email, u.role AS owner_role
       FROM businesses b JOIN users u ON u.id = b.owner_id WHERE b.id = $1`,
      [id]
    );
    const r = result.rows[0];
    return r
      ? {
          id: r.id,
          name: r.name,
          ownerId: r.owner_id,
          ownerEmail: r.owner_email,
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

  /**
   * Permanently deletes a user, their business and its whole financial history.
   *
   * Goes through the same teardown as the user's own delete-account: a bare
   * `DELETE FROM users` here trips the ON DELETE RESTRICT on
   * `journal_lines.account_id` and surfaces in the admin panel as "Internal
   * server error" for anyone who has actually posted a transaction. See
   * `deleteUserAccount`.
   */
  async deleteUser(id: string): Promise<void> {
    await deleteUserAccount(this.database, id);
  }
}
