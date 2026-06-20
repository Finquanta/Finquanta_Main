import { Database } from '../../infrastructure/database';

export const BUSINESS_ROLES = ['Owner', 'Admin', 'Accountant', 'Bookkeeper', 'Manager', 'Viewer', 'Other'] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export interface Business {
  id: string;
  name: string;
  ownerId: string;
  role: BusinessRole;
}

export interface BusinessMember {
  userId: string;
  name: string;
  email: string;
  role: BusinessRole;
}

export interface BusinessInvite {
  id: string;
  businessId: string;
  businessName: string;
  role: BusinessRole;
  requiresPassword: boolean;
  passwordHash: string | null;
  acceptedAt: string | null;
  expiresAt: string | null;
}

export class BusinessesRepository {
  constructor(private database: Database) {}

  /** Idempotently create tables and backfill a default business per user. */
  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS businesses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS business_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(40) NOT NULL DEFAULT 'Viewer',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (business_id, user_id)
      );
    `);
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS business_invites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        role VARCHAR(40) NOT NULL DEFAULT 'Viewer',
        token VARCHAR(64) NOT NULL UNIQUE,
        password_hash VARCHAR(255),
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        expires_at TIMESTAMP WITH TIME ZONE,
        accepted_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Backfill: every user gets a default business (named from onboarding) + Owner membership.
    await this.database.query(`
      INSERT INTO businesses (owner_id, name)
      SELECT u.id, COALESCE(NULLIF(bp.business_name, ''), 'My Business')
      FROM users u
      LEFT JOIN business_profiles bp ON bp.user_id = u.id
      WHERE NOT EXISTS (SELECT 1 FROM businesses b WHERE b.owner_id = u.id)
    `);
    await this.database.query(`
      INSERT INTO business_members (business_id, user_id, role)
      SELECT b.id, b.owner_id, 'Owner'
      FROM businesses b
      WHERE NOT EXISTS (
        SELECT 1 FROM business_members m WHERE m.business_id = b.id AND m.user_id = b.owner_id
      )
    `);
  }

  async listForUser(userId: string): Promise<Business[]> {
    const result = await this.database.query(
      `SELECT b.id, b.name, b.owner_id, m.role
       FROM business_members m
       JOIN businesses b ON b.id = m.business_id
       WHERE m.user_id = $1
       ORDER BY b.created_at ASC`,
      [userId]
    );
    return result.rows.map((r: any) => ({ id: r.id, name: r.name, ownerId: r.owner_id, role: r.role }));
  }

  async create(userId: string, name: string): Promise<Business> {
    const biz = await this.database.query(
      'INSERT INTO businesses (owner_id, name, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id, name, owner_id',
      [userId, name]
    );
    const row = biz.rows[0];
    await this.database.query(
      `INSERT INTO business_members (business_id, user_id, role) VALUES ($1, $2, 'Owner')
       ON CONFLICT (business_id, user_id) DO NOTHING`,
      [row.id, userId]
    );
    return { id: row.id, name: row.name, ownerId: row.owner_id, role: 'Owner' };
  }

  async getRole(businessId: string, userId: string): Promise<BusinessRole | null> {
    const result = await this.database.query(
      'SELECT role FROM business_members WHERE business_id = $1 AND user_id = $2',
      [businessId, userId]
    );
    return result.rows[0]?.role ?? null;
  }

  async listMembers(businessId: string): Promise<BusinessMember[]> {
    const result = await this.database.query(
      `SELECT m.user_id, m.role, u.first_name, u.last_name, u.email
       FROM business_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.business_id = $1
       ORDER BY m.created_at ASC`,
      [businessId]
    );
    return result.rows.map((r: any) => ({
      userId: r.user_id,
      name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.email,
      email: r.email,
      role: r.role,
    }));
  }

  async createInvite(businessId: string, role: BusinessRole, token: string, passwordHash: string | null, createdBy: string, expiresAt: string | null): Promise<void> {
    await this.database.query(
      `INSERT INTO business_invites (business_id, role, token, password_hash, created_by, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [businessId, role, token, passwordHash, createdBy, expiresAt]
    );
  }

  async getInvite(token: string): Promise<BusinessInvite | null> {
    const result = await this.database.query(
      `SELECT i.id, i.business_id, i.role, i.password_hash, i.accepted_at, i.expires_at, b.name AS business_name
       FROM business_invites i JOIN businesses b ON b.id = i.business_id
       WHERE i.token = $1`,
      [token]
    );
    const r = result.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      businessId: r.business_id,
      businessName: r.business_name,
      role: r.role,
      requiresPassword: !!r.password_hash,
      passwordHash: r.password_hash ?? null,
      acceptedAt: r.accepted_at ? new Date(r.accepted_at).toISOString() : null,
      expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    };
  }

  async markInviteAccepted(inviteId: string): Promise<void> {
    await this.database.query('UPDATE business_invites SET accepted_at = NOW() WHERE id = $1', [inviteId]);
  }

  async addMember(businessId: string, userId: string, role: BusinessRole): Promise<void> {
    await this.database.query(
      `INSERT INTO business_members (business_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (business_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [businessId, userId, role]
    );
  }

  async removeMember(businessId: string, userId: string): Promise<void> {
    await this.database.query(
      'DELETE FROM business_members WHERE business_id = $1 AND user_id = $2',
      [businessId, userId]
    );
  }
}
