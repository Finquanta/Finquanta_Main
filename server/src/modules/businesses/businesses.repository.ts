import { Database } from '../../infrastructure/database';
import { planBadgeFromRow, PlanTone } from '../billing/effective-plan';

export const BUSINESS_ROLES = ['Owner', 'Admin', 'Accountant', 'Bookkeeper', 'Manager', 'Viewer', 'Other'] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

/**
 * Placeholder name for the workspace every new account gets — what someone
 * sees if they skip past naming their business during onboarding.
 *
 * Defined here, not in auth.service, because auth.service imports THIS file:
 * declaring it there and importing it back would be a cycle, and a cycle in
 * const exports resolves to `undefined` at module-init time depending on which
 * side loads first. auth.service re-exports both names so existing importers
 * are unaffected.
 */
export const DEFAULT_BUSINESS_NAME = 'My Finances';

/**
 * Every name that means "nobody has named this workspace yet".
 *
 * A LIST rather than just the constant above because the default was once
 * 'My Business' and existing workspaces still carry it. ProfileService renames
 * a workspace when onboarding finally supplies a real name, but only if the
 * label still looks untouched — so comparing against the current default alone
 * would strand every older account on its old name permanently.
 *
 * Only ever append to this. Removing a name orphans the accounts holding it.
 */
export const PLACEHOLDER_BUSINESS_NAMES: readonly string[] = [
  DEFAULT_BUSINESS_NAME,
  'My Business',
];

export interface Business {
  id: string;
  name: string;
  ownerId: string;
  role: BusinessRole;
  /**
   * What to call this business's plan — the plan being paid for when there is
   * one, otherwise the window granting access ('Trial', 'Grandfathered').
   */
  plan?: string;
  /** Colour key for that label, so every surface tints it the same. */
  planTone?: PlanTone;
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
  singleUse: boolean;
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
        single_use BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    // For pre-existing invite tables (CREATE TABLE IF NOT EXISTS won't add it).
    await this.database.query(`ALTER TABLE business_invites ADD COLUMN IF NOT EXISTS single_use BOOLEAN NOT NULL DEFAULT false`);
    /**
     * Who an invite was emailed to, if anyone. Null for a copy-link invite.
     *
     * Doubles as the rate-limit counter: counting rows here per inviter per day
     * needs no extra table, and it keeps the record of "we sent mail to this
     * address" next to the invite it was about.
     */
    await this.database.query(`ALTER TABLE business_invites ADD COLUMN IF NOT EXISTS email_sent_to VARCHAR(255)`);

    /**
     * Workspace-level restriction, set from the admin panel. Mirrors
     * `users.status` — 'active' | 'suspended' — and is enforced in
     * `withBusiness`, so one guard covers every business-scoped route.
     *
     * Additive because `CREATE TABLE IF NOT EXISTS` above is a no-op on the
     * existing table. Defaulting to 'active' means every current workspace
     * keeps working the moment this ships.
     */
    await this.database.query(
      `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'`
    );

    /**
     * A workspace may be OWNERLESS.
     *
     * The last person in a workspace can now walk out of it. The workspace and
     * its books survive them — deleting a company's ledger because one person
     * pressed Leave would be a catastrophic reading of that button — so
     * ownership is dropped rather than the data.
     *
     * `owner_id` therefore has to accept NULL, which it did not before. Note
     * the side effect and why it is wanted: `owner_id` cascades on user delete,
     * so an owned workspace dies with its owner's account. A NULL one is
     * attached to nobody and survives, which is exactly right for something
     * waiting to be reassigned.
     */
    await this.database.query(`ALTER TABLE businesses ALTER COLUMN owner_id DROP NOT NULL`);
    /**
     * Who it belonged to, kept so the admin panel can say whose it was.
     *
     * ON DELETE SET NULL rather than CASCADE: if that person later closes their
     * account, the workspace should lose the attribution, not be destroyed.
     */
    await this.database.query(
      `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS previous_owner_id UUID REFERENCES users(id) ON DELETE SET NULL`
    );

    // Backfill: every user gets a default business (named from onboarding) + Owner membership.
    await this.database.query(
      `INSERT INTO businesses (owner_id, name)
       SELECT u.id, COALESCE(NULLIF(bp.business_name, ''), $1)
       FROM users u
       LEFT JOIN business_profiles bp ON bp.user_id = u.id
       WHERE NOT EXISTS (SELECT 1 FROM businesses b WHERE b.owner_id = u.id)`,
      [DEFAULT_BUSINESS_NAME]
    );
    await this.database.query(`
      INSERT INTO business_members (business_id, user_id, role)
      SELECT b.id, b.owner_id, 'Owner'
      FROM businesses b
      WHERE NOT EXISTS (
        SELECT 1 FROM business_members m WHERE m.business_id = b.id AND m.user_id = b.owner_id
      )
    `);
  }

  /** The user's default (earliest) business — used when no active business is specified. */
  async getDefaultBusinessId(userId: string): Promise<string | null> {
    const result = await this.database.query(
      `SELECT b.id FROM business_members m JOIN businesses b ON b.id = m.business_id
       WHERE m.user_id = $1 ORDER BY b.created_at ASC LIMIT 1`,
      [userId]
    );
    return result.rows[0]?.id ?? null;
  }

  /**
   * Add business_id to the data tables and backfill from each row's owner's
   * default business. Idempotent — safe on every boot. Run after the default
   * businesses have been created.
   */
  async ensureDataScoping(): Promise<void> {
    const tables = ['financial_transactions', 'user_goals', 'reminders'];
    for (const table of tables) {
      await this.database.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS business_id UUID`);
      // Backfill: assign existing rows to the owning user's earliest business.
      await this.database.query(`
        UPDATE ${table} t SET business_id = (
          SELECT b.id FROM businesses b WHERE b.owner_id = t.user_id ORDER BY b.created_at ASC LIMIT 1
        ) WHERE t.business_id IS NULL
      `);
      await this.database.query(`CREATE INDEX IF NOT EXISTS idx_${table}_business ON ${table}(business_id)`);
    }
  }

  /**
   * Every business this user belongs to, with the plan each one is EFFECTIVELY
   * on — what it can currently use, not what it is billed.
   *
   * The label is what they PAY for when they pay for anything, and the window
   * ('Trial', 'Grandfathered') only when they do not. Showing the granted plan
   * instead meant a workspace billed Entrepreneur read as "Business", which is
   * true of its features and wrong about its identity.
   *
   * Resolved by the shared rule in billing/effective-plan, never re-derived
   * here — a second copy is how this label came to disagree with the admin
   * panel in the first place.
   *
   * Joined here rather than fetched per row: the switcher renders every
   * business at once, so a lookup each would be one query per line.
   */
  async listForUser(userId: string): Promise<Business[]> {
    const result = await this.database.query(
      `SELECT b.id, b.name, b.owner_id, m.role,
              s.plan, s.status, s.trial_ends_at, s.grandfathered_until
       FROM business_members m
       JOIN businesses b ON b.id = m.business_id
       LEFT JOIN business_subscriptions s ON s.business_id = b.id
       WHERE m.user_id = $1
       ORDER BY b.created_at ASC`,
      [userId]
    );
    return result.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      ownerId: r.owner_id,
      role: r.role,
      plan: planBadgeFromRow(r).label,
      planTone: planBadgeFromRow(r).tone,
    }));
  }

  /**
   * Create a workspace, optionally recording which country the business is in.
   *
   * Country is per WORKSPACE, on its own `business_profiles` row — not per
   * person. Somebody can run a company in the US and another in Canada, and
   * they are different businesses with different books, different tax years and
   * different rules. Asking at creation is the only moment the answer is
   * obvious; afterwards it has to be hunted for in settings.
   */
  async create(userId: string, name: string, country?: string | null): Promise<Business> {
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

    if (country && country.trim()) {
      /**
       * Keyed on business_id, which is the per-workspace key. Writing this on
       * user_id — the column that table still carries — is the fanout bug that
       * once turned 26 users into 29 rows in the admin panel.
       */
      await this.database.query(
        /**
         * The `WHERE business_id IS NOT NULL` is required, not decorative.
         *
         * The unique index on business_id is PARTIAL, and Postgres will not
         * infer a partial index unless the predicate is repeated here — it
         * raises 42P10 instead, the same error that once made admin edits fail
         * silently. `user_id` is carried because the column is NOT NULL; it is
         * not what identifies the row.
         */
        `INSERT INTO business_profiles (business_id, user_id, country)
              VALUES ($1, $2, $3)
         ON CONFLICT (business_id) WHERE business_id IS NOT NULL
         DO UPDATE SET country = EXCLUDED.country`,
        [row.id, userId, country.trim()]
      );
    }

    return { id: row.id, name: row.name, ownerId: row.owner_id, role: 'Owner' };
  }

  async rename(businessId: string, name: string): Promise<Business | null> {
    const result = await this.database.query(
      'UPDATE businesses SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, owner_id',
      [name, businessId]
    );
    const r = result.rows[0];
    return r ? { id: r.id, name: r.name, ownerId: r.owner_id, role: 'Owner' } : null;
  }

  async getRole(businessId: string, userId: string): Promise<BusinessRole | null> {
    const result = await this.database.query(
      'SELECT role FROM business_members WHERE business_id = $1 AND user_id = $2',
      [businessId, userId]
    );
    return result.rows[0]?.role ?? null;
  }

  /**
   * Has an admin restricted this workspace? Read by `withBusiness` on every
   * business-scoped request.
   *
   * A missing row reads as NOT suspended: the caller has already resolved this
   * id, so absence here means a race, and refusing every route on a lookup miss
   * would lock people out of a working workspace. The row not existing is not
   * evidence of restriction.
   */
  async isSuspended(businessId: string): Promise<boolean> {
    const result = await this.database.query(
      'SELECT status FROM businesses WHERE id = $1',
      [businessId]
    );
    return result.rows[0]?.status === 'suspended';
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

  async createInvite(businessId: string, role: BusinessRole, token: string, passwordHash: string | null, createdBy: string, expiresAt: string | null, singleUse: boolean): Promise<void> {
    await this.database.query(
      `INSERT INTO business_invites (business_id, role, token, password_hash, created_by, expires_at, single_use, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [businessId, role, token, passwordHash, createdBy, expiresAt, singleUse]
    );
  }

  async getInvite(token: string): Promise<BusinessInvite | null> {
    const result = await this.database.query(
      `SELECT i.id, i.business_id, i.role, i.password_hash, i.accepted_at, i.expires_at, i.single_use, b.name AS business_name
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
      singleUse: !!r.single_use,
    };
  }

  async markInviteAccepted(inviteId: string): Promise<void> {
    await this.database.query('UPDATE business_invites SET accepted_at = NOW() WHERE id = $1', [inviteId]);
  }

  /** A business by id, for anything that needs its name. */
  async getBusinessById(id: string): Promise<{ id: string; name: string } | null> {
    const r = await this.database.query('SELECT id, name FROM businesses WHERE id = $1', [id]);
    return r.rows[0] ? { id: r.rows[0].id, name: r.rows[0].name ?? '' } : null;
  }

  /** Display name for whoever is inviting, falling back to their email. */
  async inviterName(userId: string): Promise<string> {
    const r = await this.database.query(
      'SELECT first_name, last_name, email FROM users WHERE id = $1', [userId]
    );
    const u = r.rows[0];
    if (!u) return 'Someone';
    return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email;
  }

  /**
   * How many invite EMAILS this person has had us send today.
   *
   * Creating a link is unlimited: it goes nowhere until it is shared. Sending
   * mail from our domain to an address the caller chooses is a different thing
   * entirely, so it is capped.
   */
  async countInviteEmailsToday(userId: string): Promise<number> {
    const r = await this.database.query(
      `SELECT COUNT(*)::int AS n FROM business_invites
        WHERE created_by = $1 AND email_sent_to IS NOT NULL
          AND created_at >= date_trunc('day', NOW())`,
      [userId]
    );
    return Number(r.rows[0]?.n) || 0;
  }

  /** Record that an invite was emailed, and to whom. */
  async markInviteEmailed(token: string, email: string): Promise<void> {
    await this.database.query(
      'UPDATE business_invites SET email_sent_to = $2 WHERE token = $1', [token, email]
    );
  }

  /** How many people are in a workspace. */
  async memberCount(businessId: string): Promise<number> {
    const r = await this.database.query(
      'SELECT COUNT(*)::int AS n FROM business_members WHERE business_id = $1',
      [businessId]
    );
    return Number(r.rows[0]?.n) || 0;
  }

  /**
   * The last person leaves: keep the workspace, drop the ownership.
   *
   * Both halves in one transaction — a workspace that had its membership
   * removed but kept an owner (or the reverse) is a state nothing else in the
   * app knows how to read.
   */
  async abandon(businessId: string, userId: string): Promise<void> {
    await this.database.transaction(async (client) => {
      await client.query(
        `UPDATE businesses
            SET previous_owner_id = COALESCE(owner_id, previous_owner_id),
                owner_id = NULL,
                updated_at = NOW()
          WHERE id = $1`,
        [businessId]
      );
      await client.query(
        'DELETE FROM business_members WHERE business_id = $1 AND user_id = $2',
        [businessId, userId]
      );
    });
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
