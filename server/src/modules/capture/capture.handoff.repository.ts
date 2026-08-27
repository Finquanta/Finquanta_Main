import crypto from 'crypto';
import { Database } from '../../infrastructure/database';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * QR handoff sessions — "photograph this with your phone, from your desktop".
 *
 * THE TOKEN IN THE QR CODE IS A CREDENTIAL. The phone that scans it is not
 * logged in, so the token alone is what proves the upload may go into this
 * workspace. Everything here exists to keep that narrow:
 *
 *   - It is stored HASHED. The raw token exists in the QR code and in the URL
 *     on the phone, and nowhere else. A leaked database gives an attacker no
 *     usable session, only the fact that one existed.
 *   - It EXPIRES in minutes, not days. A QR code on a screen is visible to
 *     anyone standing behind you, and the window where that matters should be
 *     over before they get back to their desk.
 *   - It is SINGLE USE for upload. One scan, one document. A token that keeps
 *     working is a token worth stealing.
 *   - It grants exactly one verb. There is no read path on this credential:
 *     you can put a document in, and you cannot get anything out. What was
 *     extracted comes back to the DESKTOP, over its own authenticated session.
 */

export type HandoffStatus = 'waiting' | 'uploaded' | 'consumed';

/** Long enough to pick up a phone and scan, short enough that a shoulder-surfed
 * QR code is dead before it is useful. */
export const HANDOFF_TTL_MINUTES = 5;

export interface HandoffSession {
  id: string;
  businessId: string;
  userId: string;
  captureId: string | null;
  status: HandoffStatus;
  expiresAt: string;
}

/** The token never goes to the database in the clear — only this does. */
const hash = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

export class HandoffRepository {
  constructor(private readonly database: Database) {}

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS capture_handoff_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token_hash TEXT NOT NULL UNIQUE,
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        capture_id UUID REFERENCES document_captures(id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'waiting',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      );

      -- The desktop polls by id, and the phone looks up by token hash.
      CREATE INDEX IF NOT EXISTS idx_handoff_expires ON capture_handoff_sessions (expires_at);
    `);
  }

  /**
   * Open a session. Returns the RAW token exactly once — it is never readable
   * again, here or anywhere else.
   */
  async create(businessId: string, userId: string): Promise<{ session: HandoffSession; token: string }> {
    // 32 bytes, url-safe. Guessing one inside a ten-minute window is not a
    // thing that happens.
    const token = crypto.randomBytes(32).toString('base64url');

    const r = await this.database.query(
      `INSERT INTO capture_handoff_sessions (token_hash, business_id, user_id, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval)
       RETURNING *`,
      [hash(token), businessId, userId, String(HANDOFF_TTL_MINUTES)]
    );

    return { session: this.toSession(r.rows[0]), token };
  }

  /**
   * Look a session up by the token the phone presented.
   *
   * Expiry is enforced in the WHERE clause rather than compared in JS after the
   * fact — the database owns the clock, and a server whose time has drifted
   * must not be able to accept a dead token.
   */
  async findByToken(token: string): Promise<HandoffSession | null> {
    const r = await this.database.query(
      `SELECT * FROM capture_handoff_sessions
        WHERE token_hash = $1 AND expires_at > NOW()`,
      [hash(token)]
    );
    return r.rows.length ? this.toSession(r.rows[0]) : null;
  }

  /** The desktop's own poll. Scoped to the session's owner, not just its id. */
  async findForOwner(id: string, businessId: string, userId: string): Promise<HandoffSession | null> {
    const r = await this.database.query(
      `SELECT * FROM capture_handoff_sessions
        WHERE id = $1 AND business_id = $2 AND user_id = $3`,
      [id, businessId, userId]
    );
    return r.rows.length ? this.toSession(r.rows[0]) : null;
  }

  /**
   * Attach the phone's upload and close the session to further uploads.
   *
   * Conditional on the session still being `waiting`, so two phones racing the
   * same token cannot both attach — the second update matches no rows and the
   * caller is told the token is spent. This is the single-use guarantee, and it
   * lives in the database rather than in a check-then-write in the route.
   */
  async attachCapture(id: string, captureId: string): Promise<boolean> {
    const r = await this.database.query(
      `UPDATE capture_handoff_sessions
          SET capture_id = $2, status = 'uploaded'
        WHERE id = $1 AND status = 'waiting' AND expires_at > NOW()`,
      [id, captureId]
    );
    return (r.rowCount ?? 0) > 0;
  }

  /** The desktop has picked the capture up; nothing more will come of this. */
  async markConsumed(id: string): Promise<void> {
    await this.database.query(
      `UPDATE capture_handoff_sessions SET status = 'consumed' WHERE id = $1`,
      [id]
    );
  }

  /** Cancelled from the desktop, or the dialog was closed. Kills the token now
   * rather than leaving a live credential on a screen someone walked away from. */
  async expireNow(id: string, businessId: string, userId: string): Promise<void> {
    await this.database.query(
      `UPDATE capture_handoff_sessions SET expires_at = NOW()
        WHERE id = $1 AND business_id = $2 AND user_id = $3`,
      [id, businessId, userId]
    );
  }

  /**
   * Housekeeping. Rows are worthless once expired and the table would otherwise
   * grow forever; an hour's grace keeps a just-expired session around long
   * enough to tell the user it expired rather than that it never existed.
   */
  async purgeExpired(): Promise<void> {
    await this.database.query(
      `DELETE FROM capture_handoff_sessions WHERE expires_at < NOW() - INTERVAL '1 hour'`
    );
  }

  private toSession(row: any): HandoffSession {
    return {
      id: row.id,
      businessId: row.business_id,
      userId: row.user_id,
      captureId: row.capture_id,
      status: row.status as HandoffStatus,
      expiresAt: row.expires_at,
    };
  }
}
