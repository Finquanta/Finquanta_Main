import { Database } from '../../infrastructure/database';
import { User, CreateUserData, UpdateUserData, UserRole } from './types';
import { UserModel } from './user.model';

export class UserRepository {
  constructor(private database: Database) {}

  /** Add the columns used for password resets and signup compliance. Idempotent. */
  async ensureSchema(): Promise<void> {
    await this.database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash TEXT`);
    await this.database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ`);
    // Date of birth (16+ age gate) and timestamps recording acceptance of each
    // required legal agreement at registration.
    await this.database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE`);
    await this.database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ`);
    await this.database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_privacy_at TIMESTAMPTZ`);
    await this.database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_risk_at TIMESTAMPTZ`);
    // Email verification (confirm-your-email at signup).
    await this.database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false`);
    await this.database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT`);
    await this.database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ`);
    // Two-factor auth (TOTP). The secret has to be usable to compute a live
    // code, so — unlike passwords — it's stored as-is rather than hashed;
    // backup codes ARE effectively one-time passwords, so those are hashed.
    // totp_secret holds a PENDING secret during enrollment until totp_enabled
    // flips true on a successful verify.
    await this.database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT`);
    await this.database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false`);
    await this.database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[]`);
  }

  /** Start (or restart) enrollment: stash the new secret, not yet enabled. */
  async setPendingTotpSecret(userId: string, secret: string): Promise<void> {
    await this.database.query(
      `UPDATE users SET totp_secret = $2, totp_enabled = false, totp_backup_codes = NULL, updated_at = NOW() WHERE id = $1`,
      [userId, secret]
    );
  }

  /** The stored secret + enrollment state, for verifying an enrollment or a login challenge. */
  async getTotp(userId: string): Promise<{ secret: string | null; enabled: boolean; backupCodeHashes: string[] } | null> {
    const r = await this.database.query(
      `SELECT totp_secret, totp_enabled, totp_backup_codes FROM users WHERE id = $1`,
      [userId]
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      secret: row.totp_secret ?? null,
      enabled: !!row.totp_enabled,
      backupCodeHashes: row.totp_backup_codes ?? [],
    };
  }

  /** Complete enrollment: mark enabled and store the (hashed) backup codes. */
  async enableTotp(userId: string, backupCodeHashes: string[]): Promise<void> {
    await this.database.query(
      `UPDATE users SET totp_enabled = true, totp_backup_codes = $2, updated_at = NOW() WHERE id = $1`,
      [userId, backupCodeHashes]
    );
  }

  /** Turn 2FA off entirely — clears the secret and any remaining backup codes. */
  async disableTotp(userId: string): Promise<void> {
    await this.database.query(
      `UPDATE users SET totp_enabled = false, totp_secret = NULL, totp_backup_codes = NULL, updated_at = NOW() WHERE id = $1`,
      [userId]
    );
  }

  /** Burn one backup code (single-use) after it's been matched by the caller. */
  async consumeBackupCode(userId: string, codeHash: string): Promise<void> {
    await this.database.query(
      `UPDATE users SET totp_backup_codes = array_remove(totp_backup_codes, $2), updated_at = NOW() WHERE id = $1`,
      [userId, codeHash]
    );
  }

  /** Store a hashed, expiring email-verification token for a user. */
  async setVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.database.query(
      `UPDATE users SET email_verification_token_hash = $2, email_verification_expires_at = $3, updated_at = NOW() WHERE id = $1`,
      [userId, tokenHash, expiresAt]
    );
  }

  /**
   * Find a user by verification token hash, reporting whether they're already
   * verified and whether the token has expired — but WITHOUT filtering either
   * out. Verification must be idempotent: email link-scanners (Outlook Safe
   * Links, Gmail, corporate filters) pre-fetch the link and can trip the confirm
   * before the human clicks. If we cleared or hid the token on first use, the
   * real click would then fail as "expired". Keeping the row lets a repeat hit
   * resolve to "already verified" instead.
   */
  async findByVerificationTokenHash(
    tokenHash: string
  ): Promise<{ id: string; email: string; verified: boolean; expired: boolean } | null> {
    const result = await this.database.query(
      `SELECT id, email, email_verified,
              (email_verification_expires_at IS NULL OR email_verification_expires_at <= NOW()) AS expired
       FROM users
       WHERE email_verification_token_hash = $1`,
      [tokenHash]
    );
    const r = result.rows[0];
    return r ? { id: r.id, email: r.email, verified: !!r.email_verified, expired: !!r.expired } : null;
  }

  /**
   * Mark a user's email as verified. The token is intentionally NOT cleared so a
   * second hit on the same link (a scanner then the human, a refresh, a back
   * button) still resolves to the user and returns "already verified" rather
   * than a confusing "expired". The token simply lapses on its own expiry.
   */
  async markEmailVerified(userId: string): Promise<void> {
    await this.database.query(
      `UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1`,
      [userId]
    );
  }

  /** Lightweight lookup used by the resend-verification flow. */
  async findForVerification(
    email: string
  ): Promise<{ id: string; email: string; verified: boolean; tokenExpiresAt: Date | null } | null> {
    const result = await this.database.query(
      `SELECT id, email, email_verified, email_verification_expires_at FROM users WHERE email = $1`,
      [email]
    );
    const r = result.rows[0];
    return r
      ? {
          id: r.id,
          email: r.email,
          verified: !!r.email_verified,
          tokenExpiresAt: r.email_verification_expires_at ? new Date(r.email_verification_expires_at) : null,
        }
      : null;
  }

  /** Store a hashed, expiring password-reset token for a user. */
  async setResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.database.query(
      `UPDATE users SET reset_token_hash = $2, reset_token_expires_at = $3, updated_at = NOW() WHERE id = $1`,
      [userId, tokenHash, expiresAt]
    );
  }

  /** Find a user by a still-valid reset token hash (returns null if expired/used). */
  async findByValidResetTokenHash(tokenHash: string): Promise<{ id: string; email: string } | null> {
    const result = await this.database.query(
      `SELECT id, email FROM users
       WHERE reset_token_hash = $1 AND reset_token_expires_at IS NOT NULL AND reset_token_expires_at > NOW()`,
      [tokenHash]
    );
    const r = result.rows[0];
    return r ? { id: r.id, email: r.email } : null;
  }

  /** Set a new password hash and clear any outstanding reset token (single-use). */
  async setPassword(userId: string, passwordHash: string): Promise<void> {
    await this.database.query(
      `UPDATE users SET password_hash = $2, reset_token_hash = NULL, reset_token_expires_at = NULL, updated_at = NOW() WHERE id = $1`,
      [userId, passwordHash]
    );
  }

  async create(userData: CreateUserData): Promise<User> {
    const query = `
      INSERT INTO users (id, email, password_hash, first_name, last_name, role,
        date_of_birth, accepted_terms_at, accepted_privacy_at, accepted_risk_at, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING id, email, password_hash, first_name, last_name, role, status, created_at, updated_at
    `;

    const now = new Date();
    const result = await this.database.query(query, [
      userData.email,
      userData.passwordHash,
      userData.firstName,
      userData.lastName,
      userData.role,
      userData.dateOfBirth ?? null,
      userData.acceptedTerms ? now : null,
      userData.acceptedPrivacy ? now : null,
      userData.acceptedRisk ? now : null
    ]);

    const user = this.mapRowToUser(result.rows[0]);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, email, password_hash, first_name, last_name, role, status, created_at, updated_at
      FROM users
      WHERE email = $1
    `;

    const result = await this.database.query(query, [email]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  async findById(id: string): Promise<User | null> {
    const query = `
      SELECT id, email, password_hash, first_name, last_name, role, status, created_at, updated_at
      FROM users
      WHERE id = $1
    `;

    const result = await this.database.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  async update(id: string, updateData: UpdateUserData): Promise<User | null> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    if (updateData.firstName !== undefined) {
      setClause.push(`first_name = $${paramIndex++}`);
      values.push(updateData.firstName);
    }

    if (updateData.lastName !== undefined) {
      setClause.push(`last_name = $${paramIndex++}`);
      values.push(updateData.lastName);
    }

    if (updateData.role !== undefined) {
      setClause.push(`role = $${paramIndex++}`);
      values.push(updateData.role);
    }

    if (updateData.status !== undefined) {
      setClause.push(`status = $${paramIndex++}`);
      values.push(updateData.status);
    }

    if (setClause.length === 0) {
      // No updates to make
      return this.findById(id);
    }

    setClause.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE users
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, password_hash, first_name, last_name, role, status, created_at, updated_at
    `;

    const result = await this.database.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = $1';
    const result = await this.database.query(query, [id]);
    return result.rowCount > 0;
  }

  private mapRowToUser(row: any): User {
    return new UserModel({
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role as UserRole,
      status: row.status ?? 'active',
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }).toJSON();
  }
}