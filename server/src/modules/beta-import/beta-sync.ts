import crypto from 'crypto';
import { Database } from '../../infrastructure/database';

/**
 * Production side of beta workspaces: turning beta on, who may test, starting a
 * copy, and the one-time links behind "Open in beta".
 *
 * A copy is started by production and run by beta. Production mints a one-time
 * export code and calls beta's `/v1/beta-sync/pull` with BETA_SYNC_SECRET; beta
 * redeems the code and pulls the workspace through the export endpoints. The
 * call is made in the background and its outcome written to `businesses`, so
 * the owner and the admin panel can see how the latest copy went without
 * asking beta.
 */

const CODE_MINUTES = 10;
const LOGIN_MINUTES = 2;
/** A copy still "copying" after this long is treated as dead and may be restarted. */
const COPY_STALE_MINUTES = 30;

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const newSecret = () => crypto.randomBytes(32).toString('base64url');

type Log = { info: (...args: any[]) => void; warn: (...args: any[]) => void };

export type CopyStatus = 'none' | 'copying' | 'done' | 'failed';

export interface BetaState {
  enabled: boolean;
  copyStatus: CopyStatus;
  copiedAt: string | null;
  copyError: string | null;
  /** False until the beta site's addresses and shared secret are set. */
  configured: boolean;
}

export const betaConfigured = (): boolean =>
  Boolean(
    process.env.BETA_SITE_URL?.trim() &&
      process.env.BETA_API_URL?.trim() &&
      (process.env.BETA_SYNC_SECRET ?? '').length >= 32
  );

export async function betaState(database: Database, businessId: string): Promise<BetaState> {
  const result = await database.query(
    'SELECT beta_enabled, beta_copy_status, beta_copied_at, beta_copy_error FROM businesses WHERE id = $1',
    [businessId]
  );
  const row = result.rows[0] ?? {};
  return {
    enabled: row.beta_enabled === true,
    copyStatus: (row.beta_copy_status as CopyStatus) ?? 'none',
    copiedAt: row.beta_copied_at ? new Date(row.beta_copied_at).toISOString() : null,
    copyError: row.beta_copy_error ?? null,
    configured: betaConfigured(),
  };
}

/** Turning beta off keeps the copy on beta; turning it on again refreshes it. */
export async function setBetaEnabled(
  database: Database,
  businessId: string,
  enabled: boolean,
  actorId: string
): Promise<void> {
  await database.query(
    'UPDATE businesses SET beta_enabled = $2, beta_updated_at = NOW(), beta_updated_by = $3 WHERE id = $1',
    [businessId, enabled, actorId]
  );
}

/** Exactly the ticked members become testers; everyone else stops being one. */
export async function setBetaTesters(database: Database, businessId: string, memberIds: string[]): Promise<void> {
  await database.query(
    `UPDATE business_members SET beta_tester = (user_id = ANY($2::uuid[]))
      WHERE business_id = $1 AND role <> 'Owner'`,
    [businessId, memberIds]
  );
}

async function createExportCode(
  database: Database,
  businessId: string,
  ownerId: string,
  memberIds: string[]
): Promise<string> {
  const code = newSecret();
  await database.query(
    `INSERT INTO beta_export_codes (code_hash, business_id, owner_id, member_ids, expires_at)
     VALUES ($1, $2, $3, $4::uuid[], NOW() + make_interval(mins => $5))`,
    [sha256(code), businessId, ownerId, memberIds, CODE_MINUTES]
  );
  return code;
}

export type CopyStart =
  | { started: true }
  | { started: false; reason: 'not_configured' | 'not_beta' | 'ownerless' | 'busy' };

/**
 * Start copying a beta workspace into beta. Returns at once; the copy runs in
 * the background.
 *
 * Claiming the 'copying' status is one conditional UPDATE, so two clicks — or
 * the owner and an admin at the same moment — cannot start two copies.
 */
export async function startBetaCopy(database: Database, businessId: string, log: Log): Promise<CopyStart> {
  if (!betaConfigured()) return { started: false, reason: 'not_configured' };

  const claimed = await database.query(
    `UPDATE businesses
        SET beta_copy_status = 'copying', beta_copy_started_at = NOW(), beta_copy_error = NULL
      WHERE id = $1 AND beta_enabled AND owner_id IS NOT NULL
        AND NOT (beta_copy_status = 'copying'
                 AND beta_copy_started_at > NOW() - make_interval(mins => $2))
    RETURNING owner_id`,
    [businessId, COPY_STALE_MINUTES]
  );
  if (!claimed.rows.length) {
    const current = await database.query('SELECT beta_enabled, owner_id FROM businesses WHERE id = $1', [businessId]);
    const row = current.rows[0];
    if (!row?.beta_enabled) return { started: false, reason: 'not_beta' };
    if (!row.owner_id) return { started: false, reason: 'ownerless' };
    return { started: false, reason: 'busy' };
  }

  try {
    const ownerId = String(claimed.rows[0].owner_id);
    const testers = await database.query(
      `SELECT user_id FROM business_members WHERE business_id = $1 AND beta_tester AND role <> 'Owner'`,
      [businessId]
    );
    const code = await createExportCode(database, businessId, ownerId, testers.rows.map((m: any) => String(m.user_id)));
    void runCopy(database, businessId, code, log);
    return { started: true };
  } catch (error) {
    await markFailed(database, businessId, error);
    throw error;
  }
}

async function runCopy(database: Database, businessId: string, code: string, log: Log): Promise<void> {
  const base = (process.env.BETA_API_URL ?? '').trim().replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/v1/beta-sync/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.BETA_SYNC_SECRET}`,
      },
      body: JSON.stringify({ code }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; data?: unknown };
    if (!res.ok) throw new Error(json.error || `The beta site answered ${res.status}.`);
    await database.query(
      `UPDATE businesses SET beta_copy_status = 'done', beta_copied_at = NOW(), beta_copy_error = NULL WHERE id = $1`,
      [businessId]
    );
    log.info({ businessId, result: json.data }, 'beta copy done');
  } catch (error) {
    await markFailed(database, businessId, error);
    log.warn({ businessId, error }, 'beta copy failed');
  }
}

async function markFailed(database: Database, businessId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await database
    .query(`UPDATE businesses SET beta_copy_status = 'failed', beta_copy_error = $2 WHERE id = $1`, [
      businessId,
      message.slice(0, 500),
    ])
    .catch(() => undefined);
}

/**
 * A one-time link that signs this person in on beta ("Open in beta").
 *
 * Only for people with something to open there: the owner or a ticked tester
 * of a beta workspace, or staff. Expires in two minutes — it is followed
 * straight away, never stored.
 */
export async function createLoginCode(
  database: Database,
  userId: string,
  businessId: string | null
): Promise<{ url: string } | { error: 'not_configured' | 'not_allowed' }> {
  const site = process.env.BETA_SITE_URL?.trim().replace(/\/+$/, '');
  if (!site || !betaConfigured()) return { error: 'not_configured' };

  const allowed = await database.query(
    `SELECT 1 FROM users u WHERE u.id = $1 AND u.role IN ('admin', 'super_admin', 'owner')
     UNION ALL
     SELECT 1 FROM business_members m JOIN businesses b ON b.id = m.business_id
      WHERE m.user_id = $1 AND b.beta_enabled AND (m.role = 'Owner' OR m.beta_tester)
     LIMIT 1`,
    [userId]
  );
  if (!allowed.rows.length) return { error: 'not_allowed' };

  const code = newSecret();
  await database.query(
    `INSERT INTO beta_login_codes (code_hash, user_id, expires_at)
     VALUES ($1, $2, NOW() + make_interval(mins => $3))`,
    [sha256(code), userId, LOGIN_MINUTES]
  );
  const query = new URLSearchParams({ code });
  if (businessId) query.set('workspace', businessId);
  return { url: `${site}/sso?${query.toString()}` };
}

export const hashCode = sha256;
