import { Database } from '../../infrastructure/database';

/**
 * Section 13 — the referral program.
 *
 * A referral passes through three stages, and only counts when it clears all
 * three:
 *
 *   1. signed up  — they made an account with someone's code
 *   2. verified   — they confirmed their email address
 *   3. activated  — they actually USED the product (recorded a transaction,
 *                   or sent an invoice)
 *
 * Stage 3 is the point. Signup alone is trivially farmed with throwaway
 * addresses, and email verification only proves the address exists. Requiring
 * real financial activity means a fake referral costs more effort than it's
 * worth, and it also means a "successful referral" is a real user rather than a
 * row in a table.
 *
 * No rewards are paid out yet — this tracks. What a qualified referral earns can
 * be decided later without changing any of this.
 */

export interface ReferralStats {
  code: string;
  signedUp: number;
  verified: number;
  /** Cleared all three stages — the number that actually counts. */
  qualified: number;
}

export interface ReferredUser {
  /** Masked for privacy: the referrer doesn't need their full address. */
  email: string;
  name: string;
  signedUpAt: string | null;
  verifiedAt: string | null;
  activatedAt: string | null;
  /** 'signed_up' | 'verified' | 'qualified' */
  stage: string;
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  email: string;
  code: string;
  signedUp: number;
  verified: number;
  qualified: number;
}

/** Unambiguous alphabet: no 0/O, no 1/I/L — these get read aloud and retyped. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(length = 7): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export class ReferralsRepository {
  constructor(private database: Database) {}

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        code VARCHAR(16) NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        -- One referral per person, ever. The UNIQUE constraint is what stops a
        -- user being claimed twice.
        referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        code VARCHAR(16) NOT NULL,
        signed_up_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        verified_at TIMESTAMP WITH TIME ZONE,
        activated_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await this.database.query(
      `CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id)`
    );
  }

  /** The user's own code, minted on first use and stable thereafter. */
  async getOrCreateCode(userId: string): Promise<string> {
    const existing = await this.database.query(
      'SELECT code FROM referral_codes WHERE user_id = $1::uuid',
      [userId]
    );
    if (existing.rows[0]) return existing.rows[0].code;

    // Retry on the (vanishingly unlikely) collision rather than trusting luck.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const result = await this.database.query(
        `INSERT INTO referral_codes (user_id, code) VALUES ($1::uuid, $2)
         ON CONFLICT DO NOTHING RETURNING code`,
        [userId, code]
      );
      if (result.rows[0]) return result.rows[0].code;

      // Lost the race on user_id (another request minted one) — take theirs.
      const mine = await this.database.query(
        'SELECT code FROM referral_codes WHERE user_id = $1::uuid',
        [userId]
      );
      if (mine.rows[0]) return mine.rows[0].code;
    }
    throw new Error('Could not generate a referral code');
  }

  /**
   * Record that `newUserId` signed up with `code`.
   *
   * Never throws: a bad or missing code must not stop someone creating an
   * account. Self-referral is rejected outright.
   */
  async attribute(code: string | undefined, newUserId: string): Promise<void> {
    if (!code || !code.trim()) return;

    const owner = await this.database.query(
      'SELECT user_id FROM referral_codes WHERE code = $1',
      [code.trim().toUpperCase()]
    );
    const referrerId = owner.rows[0]?.user_id;
    if (!referrerId) return;              // code doesn't exist
    if (referrerId === newUserId) return; // can't refer yourself

    await this.database.query(
      `INSERT INTO referrals (referrer_user_id, referred_user_id, code)
       VALUES ($1::uuid, $2::uuid, $3)
       ON CONFLICT (referred_user_id) DO NOTHING`,
      [referrerId, newUserId, code.trim().toUpperCase()]
    );
  }

  /**
   * Advance referrals through stages 2 and 3.
   *
   * Derived from the truth rather than pushed by hooks: a referral is verified
   * if the user's email is verified, and activated if their business has any
   * real financial activity. That means it's self-healing — it can't drift out
   * of step, and it works for referrals made before this ran.
   *
   * Idempotent and cheap, so it runs whenever anyone looks at referral numbers.
   */
  async syncStages(): Promise<void> {
    await this.database.query(
      `UPDATE referrals r SET verified_at = NOW()
       FROM users u
       WHERE u.id = r.referred_user_id
         AND r.verified_at IS NULL
         AND u.email_verified = true`
    );

    // "Used the platform" = money actually recorded, or an invoice raised.
    await this.database.query(
      `UPDATE referrals r SET activated_at = NOW()
       WHERE r.activated_at IS NULL
         AND EXISTS (
           SELECT 1 FROM business_members m
           WHERE m.user_id = r.referred_user_id
             AND (
               EXISTS (SELECT 1 FROM journal_entries e WHERE e.business_id = m.business_id)
               OR EXISTS (SELECT 1 FROM invoices i WHERE i.business_id = m.business_id AND i.deleted_at IS NULL)
             )
         )`
    );
  }

  async statsFor(userId: string): Promise<ReferralStats> {
    const code = await this.getOrCreateCode(userId);
    const result = await this.database.query(
      `SELECT
         COUNT(*)::int AS signed_up,
         COUNT(verified_at)::int AS verified,
         COUNT(CASE WHEN verified_at IS NOT NULL AND activated_at IS NOT NULL THEN 1 END)::int AS qualified
       FROM referrals WHERE referrer_user_id = $1::uuid`,
      [userId]
    );
    const r = result.rows[0] ?? {};
    return {
      code,
      signedUp: r.signed_up ?? 0,
      verified: r.verified ?? 0,
      qualified: r.qualified ?? 0,
    };
  }

  async listFor(userId: string): Promise<ReferredUser[]> {
    const result = await this.database.query(
      `SELECT u.email, u.first_name, u.last_name,
              r.signed_up_at, r.verified_at, r.activated_at
       FROM referrals r
       JOIN users u ON u.id = r.referred_user_id
       WHERE r.referrer_user_id = $1::uuid
       ORDER BY r.signed_up_at DESC`,
      [userId]
    );

    return (result.rows as any[]).map((row) => ({
      email: maskEmail(row.email),
      name: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'New user',
      signedUpAt: row.signed_up_at ?? null,
      verifiedAt: row.verified_at ?? null,
      activatedAt: row.activated_at ?? null,
      stage:
        row.verified_at && row.activated_at ? 'qualified' : row.verified_at ? 'verified' : 'signed_up',
    }));
  }

  /** Admin view: who is actually bringing people in. */
  async leaderboard(limit = 100): Promise<LeaderboardRow[]> {
    const result = await this.database.query(
      `SELECT
         r.referrer_user_id AS user_id,
         u.first_name, u.last_name, u.email,
         COALESCE(c.code, '') AS code,
         COUNT(*)::int AS signed_up,
         COUNT(r.verified_at)::int AS verified,
         COUNT(CASE WHEN r.verified_at IS NOT NULL AND r.activated_at IS NOT NULL THEN 1 END)::int AS qualified
       FROM referrals r
       JOIN users u ON u.id = r.referrer_user_id
       LEFT JOIN referral_codes c ON c.user_id = r.referrer_user_id
       GROUP BY r.referrer_user_id, u.first_name, u.last_name, u.email, c.code
       ORDER BY qualified DESC, signed_up DESC
       LIMIT $1`,
      [limit]
    );

    return (result.rows as any[]).map((row) => ({
      userId: row.user_id,
      name: [row.first_name, row.last_name].filter(Boolean).join(' ') || '—',
      email: row.email,
      code: row.code,
      signedUp: row.signed_up,
      verified: row.verified,
      qualified: row.qualified,
    }));
  }

  /** Admin totals across the whole platform. */
  async totals(): Promise<{ signedUp: number; verified: number; qualified: number; referrers: number }> {
    const result = await this.database.query(
      `SELECT
         COUNT(*)::int AS signed_up,
         COUNT(verified_at)::int AS verified,
         COUNT(CASE WHEN verified_at IS NOT NULL AND activated_at IS NOT NULL THEN 1 END)::int AS qualified,
         COUNT(DISTINCT referrer_user_id)::int AS referrers
       FROM referrals`
    );
    const r = result.rows[0] ?? {};
    return {
      signedUp: r.signed_up ?? 0,
      verified: r.verified ?? 0,
      qualified: r.qualified ?? 0,
      referrers: r.referrers ?? 0,
    };
  }
}

/** j***@gmail.com — enough to recognise someone you invited, not their address. */
function maskEmail(email: string): string {
  const [local, domain] = String(email).split('@');
  if (!domain || !local) return '***';
  const head = local.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(2, local.length - 1))}@${domain}`;
}
