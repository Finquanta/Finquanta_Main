import { Database } from '../../infrastructure/database';

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  revokedAt: string | null;
  expiresAt: string;
}

/**
 * Server-side record of every issued refresh token (by hash, never the raw
 * value), so a refresh can be rotated (old one revoked, new one issued) and a
 * logout can actually invalidate a session — a stateless JWT alone can't be
 * revoked before its own expiry.
 */
export class RefreshTokenRepository {
  constructor(private database: Database) {}

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        revoked_at TIMESTAMP WITH TIME ZONE,
        replaced_by UUID
      );
    `);
    await this.database.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)`);
    await this.database.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`);
  }

  async store(userId: string, tokenHash: string, expiresAt: Date): Promise<string> {
    const r = await this.database.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING id`,
      [userId, tokenHash, expiresAt]
    );
    return r.rows[0].id;
  }

  /** Null means this hash was never stored — a token issued before this table existed. */
  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const r = await this.database.query(
      `SELECT id, user_id, revoked_at, expires_at FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    const row = r.rows[0];
    return row ? { id: row.id, userId: row.user_id, revokedAt: row.revoked_at, expiresAt: row.expires_at } : null;
  }

  async revoke(id: string, replacedBy?: string): Promise<void> {
    await this.database.query(
      `UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = COALESCE($2::uuid, replaced_by) WHERE id = $1`,
      [id, replacedBy ?? null]
    );
  }

  async revokeByHash(tokenHash: string): Promise<void> {
    await this.database.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash]
    );
  }
}
