import { Database } from '../../infrastructure/database';

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joinedAt: string | null;
  company: string;
  country: string;
  industry: string;
  incorporation: string;
}

export interface AdminTargetUser {
  id: string;
  email: string;
  role: string;
  status: string;
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

  /** All users with their business profile info, newest first. Admin-only. */
  async listUsers(): Promise<AdminUserRow[]> {
    const result = await this.database.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status, u.created_at,
             bp.business_name, bp.country, bp.industry, bp.incorporation_location
      FROM users u
      LEFT JOIN business_profiles bp ON bp.user_id = u.id
      ORDER BY u.created_at DESC NULLS LAST
    `);
    return result.rows.map((r: any) => ({
      id: r.id,
      name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.email,
      email: r.email,
      role: r.role,
      status: r.status ?? 'active',
      joinedAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      company: r.business_name ?? '',
      country: r.country ?? '',
      industry: r.industry ?? '',
      incorporation: r.incorporation_location ?? '',
    }));
  }

  async getById(id: string): Promise<AdminTargetUser | null> {
    const result = await this.database.query('SELECT id, email, role, status FROM users WHERE id = $1', [id]);
    const r = result.rows[0];
    return r ? { id: r.id, email: r.email, role: r.role, status: r.status ?? 'active' } : null;
  }

  /** Apply admin edits (name / role / status). Returns nothing; caller re-lists. */
  async updateUser(id: string, data: { firstName?: string; lastName?: string; role?: string; status?: string }): Promise<void> {
    const set: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (data.firstName !== undefined) { set.push(`first_name = $${i++}`); values.push(data.firstName); }
    if (data.lastName !== undefined) { set.push(`last_name = $${i++}`); values.push(data.lastName); }
    if (data.role !== undefined) { set.push(`role = $${i++}`); values.push(data.role); }
    if (data.status !== undefined) { set.push(`status = $${i++}`); values.push(data.status); }
    if (set.length === 0) return;
    set.push(`updated_at = NOW()`);
    values.push(id);
    await this.database.query(`UPDATE users SET ${set.join(', ')} WHERE id = $${i}`, values);
  }

  async deleteUser(id: string): Promise<void> {
    await this.database.query('DELETE FROM users WHERE id = $1', [id]);
  }
}
