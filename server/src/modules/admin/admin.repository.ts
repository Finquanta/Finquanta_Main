import { Database } from '../../infrastructure/database';

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string | null;
  company: string;
  country: string;
  industry: string;
  incorporation: string;
}

export class AdminRepository {
  constructor(private database: Database) {}

  /**
   * Promote the given emails to admin at boot (from the ADMIN_EMAILS env var).
   * Idempotent; never demotes existing admins/super_admins.
   */
  async ensureAdmins(emails: string[]): Promise<void> {
    const cleaned = emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (cleaned.length === 0) return;
    await this.database.query(
      `UPDATE users SET role = 'admin', updated_at = NOW()
       WHERE lower(email) = ANY($1::text[]) AND role NOT IN ('admin', 'super_admin')`,
      [cleaned]
    );
  }

  /** All users with their business profile info, newest first. Admin-only. */
  async listUsers(): Promise<AdminUserRow[]> {
    const result = await this.database.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.created_at,
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
      joinedAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      company: r.business_name ?? '',
      country: r.country ?? '',
      industry: r.industry ?? '',
      incorporation: r.incorporation_location ?? '',
    }));
  }
}
