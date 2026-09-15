import crypto from 'crypto';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { createStorageDriver } from '../../infrastructure/object-storage';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { AccountingRepository } from '../accounting/accounting.repository';
import { AdminRepository } from '../admin/admin.repository';
import { UserRepository } from '../users/user.repository';
import { UserRole } from '../users/types';
import { AuthService } from '../auth/auth.service';
import { COPY_PLAN, specFor } from './copy-plan';
import { Queryable, ScopeIds, exportPage, fileKeyBelongs, writeWorkspaceCopy } from './beta-import.engine';
import { ProductionIdentity, findOrCreateBetaUser } from './beta-members';
import {
  betaState,
  createLoginCode,
  hashCode,
  setBetaEnabled,
  setBetaTesters,
  startBetaCopy,
} from './beta-sync';

/**
 * Beta workspaces: a workspace on the real site cloned into beta.finquanta.ai.
 *
 * Production side
 *   - owners (workspace settings) and admins turn beta on, tick testers and
 *     refresh the copy; each start asks beta to pull (beta-sync.ts)
 *   - redeem / rows / object serve that copy, gated by a one-time code
 *   - login codes back "Open in beta"
 *
 * Beta side
 *   - /v1/beta-sync/pull runs a copy; only production can call it
 *     (BETA_SYNC_SECRET)
 *   - /v1/beta-sso signs someone in on the real site's word — beta never holds
 *     a password
 *
 * One module serves both; BETA_SITE decides which half answers.
 */

const SESSION_MINUTES = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF_ROLES: string[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER];

const onBeta = () => process.env.BETA_SITE === 'true';
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const newSecret = () => crypto.randomBytes(32).toString('base64url');
const notFound = (reply: FastifyReply) => reply.status(404).send({ success: false, error: 'Not found' });
const productionBase = () => process.env.PRODUCTION_API_URL?.trim().replace(/\/+$/, '') || '';

export async function ensureBetaImportSchema(database: Database): Promise<void> {
  // Production: export codes, and the session each one turned into.
  await database.query(`
    CREATE TABLE IF NOT EXISTS beta_export_codes (
      code_hash TEXT PRIMARY KEY,
      business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      member_ids UUID[] NOT NULL DEFAULT '{}',
      expires_at TIMESTAMPTZ NOT NULL,
      redeemed_at TIMESTAMPTZ,
      session_hash TEXT UNIQUE,
      session_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Production: "Open in beta" links.
  await database.query(`
    CREATE TABLE IF NOT EXISTS beta_login_codes (
      code_hash TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Beta: which workspaces are copies, and when.
  await database.query(`
    CREATE TABLE IF NOT EXISTS beta_imports (
      business_id UUID PRIMARY KEY,
      imported_by UUID REFERENCES users(id) ON DELETE SET NULL,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Beta: ticked members not yet signed in. No foreign key on purpose — a
  // refresh deletes and re-creates the business, and these must survive it.
  await database.query(`
    CREATE TABLE IF NOT EXISTS beta_member_invites (
      business_id UUID NOT NULL,
      email TEXT NOT NULL,
      role VARCHAR(40) NOT NULL,
      PRIMARY KEY (business_id, email)
    )
  `);
}

class ProductionError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Call the real site's API. Retries network failures: Render's free tier sleeps. */
async function callProduction<T>(base: string, path: string, body: unknown): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)));
      continue;
    }
    const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
    if (!res.ok) throw new ProductionError(res.status, json.error || `The real site answered ${res.status}.`);
    return (json.data ?? json) as T;
  }
  throw new ProductionError(502, 'Could not reach the real site. Try again in a minute.');
}

interface RedeemData {
  session: string;
  businessId: string;
  businessName: string;
  plan: string | null;
  owner: ProductionIdentity;
  members: { email: string; role: string }[];
}

/** Beta: was this call made by production? Compared as hashes, in constant time. */
function fromProduction(request: FastifyRequest): boolean {
  const secret = process.env.BETA_SYNC_SECRET ?? '';
  if (secret.length < 32) return false;
  const header = String(request.headers.authorization ?? '');
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  return crypto.timingSafeEqual(Buffer.from(hashCode(given)), Buffer.from(hashCode(secret)));
}

/** Beta: pull one workspace from production and write it. */
async function pullWorkspace(database: Database, base: string, code: string, log: FastifyRequest['log']) {
  const meta = await callProduction<RedeemData>(base, '/v1/beta-export/redeem', { code });
  const businessId = meta.businessId;
  // The owner's beta account, created on first copy. They never sign up.
  const owner = await findOrCreateBetaUser(database, meta.owner);

  const existing = await database.query('SELECT 1 FROM businesses WHERE id = $1', [businessId]);
  const refreshing = existing.rows.length > 0;

  // Everything is fetched before the database is touched, so a dropped
  // connection part-way leaves the books on beta as they were.
  const data = new Map<string, Record<string, unknown>[]>();
  for (const spec of COPY_PLAN) {
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; ; ) {
      const page = await callProduction<{ rows: Record<string, unknown>[]; done: boolean }>(
        base, '/v1/beta-export/rows', { session: meta.session, table: spec.table, offset }
      );
      rows.push(...page.rows);
      offset += page.rows.length;
      if (page.done || page.rows.length === 0) break;
    }
    data.set(spec.table, rows);
  }
  if (!data.get('businesses')?.length) {
    throw new ProductionError(410, 'That workspace no longer exists on the real site.');
  }

  const { counts, fileKeys } = await database.transaction(async (client) => {
    const tx = client as unknown as Queryable;
    // A copy is not a change anyone made to these books; keep it out of their history.
    await tx.query(`SELECT set_config('app.history_off', 'on', true)`);
    const copy = await writeWorkspaceCopy(tx, data, businessId, owner.id, refreshing);

    await tx.query(
      `INSERT INTO beta_imports (business_id, imported_by, imported_at) VALUES ($1, $2, NOW())
       ON CONFLICT (business_id) DO UPDATE SET imported_by = EXCLUDED.imported_by, imported_at = NOW()`,
      [businessId, owner.id]
    );
    await tx.query('DELETE FROM beta_member_invites WHERE business_id = $1', [businessId]);
    for (const member of meta.members) {
      await tx.query(
        `INSERT INTO beta_member_invites (business_id, email, role) VALUES ($1, lower($2), $3)
         ON CONFLICT (business_id, email) DO UPDATE SET role = EXCLUDED.role`,
        [businessId, member.email, member.role]
      );
    }
    return copy;
  });

  // Testers who have opened beta before join now; the rest when they first do.
  await database.query(
    `INSERT INTO business_members (business_id, user_id, role)
     SELECT i.business_id, u.id, i.role FROM beta_member_invites i
       JOIN users u ON lower(u.email) = i.email
      WHERE i.business_id = $1
     ON CONFLICT (business_id, user_id) DO NOTHING`,
    [businessId]
  );

  // Same plan as the real workspace, so plan gates behave the same. No Stripe
  // ids: beta must never think a real subscription is its own.
  if (meta.plan) {
    try {
      await database.query(
        `INSERT INTO business_subscriptions (business_id, plan) VALUES ($1, $2)
         ON CONFLICT (business_id) DO UPDATE SET plan = EXCLUDED.plan`,
        [businessId, meta.plan]
      );
    } catch (error) {
      log.warn({ error, businessId }, 'beta copy: could not set the plan');
    }
  }

  // Files after the rows: one that fails to copy never undoes the books.
  const storage = createStorageDriver(database);
  let filesCopied = 0;
  let filesFailed = 0;
  for (const key of fileKeys) {
    try {
      const object = await callProduction<{ mime: string; data: string }>(
        base, '/v1/beta-export/object', { session: meta.session, key }
      );
      await storage.put(key, Buffer.from(object.data, 'base64'), object.mime);
      filesCopied++;
    } catch {
      filesFailed++;
    }
  }

  // Rebuild the bookkeeping entries the copy left out.
  try {
    await new AccountingRepository(database).resyncBookkeeping(businessId);
  } catch (error) {
    log.warn({ error, businessId }, 'beta copy: bookkeeping resync failed; it runs again on next load');
  }

  log.info({ businessId, refreshing, counts, filesCopied, filesFailed }, 'beta copy written');
  return {
    businessId,
    businessName: meta.businessName,
    refreshed: refreshing,
    counts,
    filesCopied,
    filesFailed,
    membersInvited: meta.members.length,
  };
}

export async function betaImportRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const { database } = options;
  // Degrades like the other optional modules: a failure here disables beta
  // workspaces, and must not take the whole API down with it.
  try {
    await ensureBetaImportSchema(database);
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure beta import schema');
  }
  const users = new UserRepository(database);
  const admins = new AdminRepository(database);
  const auth = new AuthService(database);

  const roleIn = async (businessId: string, userId: string): Promise<string | null> => {
    const result = await database.query(
      'SELECT role FROM business_members WHERE business_id = $1 AND user_id = $2',
      [businessId, userId]
    );
    return result.rows[0]?.role ?? null;
  };

  const requireStaff = async (request: FastifyRequest, reply: FastifyReply) => {
    const authed = request as AuthenticatedRequest;
    const user = authed.user?.id ? await users.findById(authed.user.id) : null;
    if (!user || !STAFF_ROLES.includes(user.role)) {
      return reply.status(403).send({ success: false, error: 'Admin access required' });
    }
    authed.user!.role = user.role;
  };

  const sessionIds = async (session: unknown): Promise<ScopeIds | null> => {
    if (typeof session !== 'string' || !session) return null;
    const result = await database.query(
      `SELECT business_id, owner_id FROM beta_export_codes
        WHERE session_hash = $1 AND session_expires_at > NOW()`,
      [hashCode(session)]
    );
    const row = result.rows[0];
    return row ? { business: String(row.business_id), owner: String(row.owner_id) } : null;
  };

  // ---- Production: owners ---------------------------------------------------

  // 422 rather than 403 throughout: the client treats 403 as a dead session.
  const OWNER_ONLY = 'Only the workspace owner can change this.';

  fastify.get('/v1/businesses/:id/beta', { preHandler: [authenticate] }, (async (
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) => {
    if (onBeta()) return notFound(reply);
    const { id } = request.params as { id: string };
    if (!isUuid(id) || !(await roleIn(id, request.user!.id))) return notFound(reply);
    return reply.send({ success: true, data: await betaState(database, id) });
  }) as any);

  fastify.patch('/v1/businesses/:id/beta', { preHandler: [authenticate] }, (async (
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) => {
    if (onBeta()) return notFound(reply);
    const { id } = request.params as { id: string };
    if (!isUuid(id)) return notFound(reply);
    if ((await roleIn(id, request.user!.id)) !== 'Owner') {
      return reply.status(422).send({ success: false, error: OWNER_ONLY });
    }

    const body = (request.body ?? {}) as { enabled?: unknown; memberUserIds?: unknown };
    if (Array.isArray(body.memberUserIds)) {
      await setBetaTesters(database, id, body.memberUserIds.filter(isUuid));
    }
    let copy = null;
    if (typeof body.enabled === 'boolean') {
      await setBetaEnabled(database, id, body.enabled, request.user!.id);
      if (body.enabled) copy = await startBetaCopy(database, id, request.log);
    }
    return reply.send({ success: true, data: { ...(await betaState(database, id)), copy } });
  }) as any);

  fastify.post('/v1/businesses/:id/beta/refresh', { preHandler: [authenticate] }, (async (
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) => {
    if (onBeta()) return notFound(reply);
    const { id } = request.params as { id: string };
    if (!isUuid(id)) return notFound(reply);
    if ((await roleIn(id, request.user!.id)) !== 'Owner') {
      return reply.status(422).send({ success: false, error: OWNER_ONLY });
    }
    const copy = await startBetaCopy(database, id, request.log);
    return reply.send({ success: true, data: { ...(await betaState(database, id)), copy } });
  }) as any);

  // ---- Production: admin panel ----------------------------------------------

  fastify.patch('/v1/admin/businesses/:id/beta', { preHandler: [authenticate, requireStaff] }, (async (
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) => {
    if (onBeta()) return notFound(reply);
    const { id } = request.params as { id: string };
    const { enabled } = (request.body ?? {}) as { enabled?: unknown };
    if (typeof enabled !== 'boolean') return reply.status(400).send({ success: false, error: 'enabled must be true or false.' });
    const target = await admins.getBusinessById(id);
    if (!target) return reply.status(404).send({ success: false, error: 'Business not found' });

    await setBetaEnabled(database, id, enabled, request.user!.id);
    const copy = enabled ? await startBetaCopy(database, id, request.log) : null;
    await admins.addAuditLog({
      actorId: request.user!.id,
      actorEmail: request.user!.email,
      action: enabled
        ? `Made workspace "${target.name}" a beta workspace`
        : `Removed workspace "${target.name}" from beta`,
      targetId: id,
      targetEmail: target.ownerEmail,
    });
    return reply.send({ success: true, data: { ...(await betaState(database, id)), copy } });
  }) as any);

  fastify.post('/v1/admin/businesses/:id/beta/refresh', { preHandler: [authenticate, requireStaff] }, (async (
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) => {
    if (onBeta()) return notFound(reply);
    const { id } = request.params as { id: string };
    const target = await admins.getBusinessById(id);
    if (!target) return reply.status(404).send({ success: false, error: 'Business not found' });
    const copy = await startBetaCopy(database, id, request.log);
    if (copy.started) {
      await admins.addAuditLog({
        actorId: request.user!.id,
        actorEmail: request.user!.email,
        action: `Refreshed the beta copy of workspace "${target.name}"`,
        targetId: id,
        targetEmail: target.ownerEmail,
      });
    }
    return reply.send({ success: true, data: { ...(await betaState(database, id)), copy } });
  }) as any);

  // ---- Production: Open in beta ---------------------------------------------

  fastify.post(
    '/v1/beta-export/login-codes',
    { preHandler: [authenticate], config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    (async (request: AuthenticatedRequest, reply: FastifyReply) => {
      if (onBeta()) return notFound(reply);
      const { businessId } = (request.body ?? {}) as { businessId?: unknown };
      const result = await createLoginCode(database, request.user!.id, isUuid(businessId) ? businessId : null);
      if ('error' in result) {
        return result.error === 'not_configured'
          ? reply.status(503).send({ success: false, error: 'The beta site is not set up yet.' })
          : reply.status(422).send({ success: false, error: 'Beta is open to the owner and testers of a beta workspace.' });
      }
      return reply.send({ success: true, data: result });
    }) as any
  );

  fastify.post(
    '/v1/beta-export/login/redeem',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (onBeta()) return notFound(reply);
      const { code } = (request.body ?? {}) as { code?: unknown };
      const expired = 'This link has expired or was already used. Open beta again from the real site.';
      if (typeof code !== 'string' || !code) return reply.status(410).send({ success: false, error: expired });

      const used = await database.query(
        `UPDATE beta_login_codes SET used_at = NOW()
          WHERE code_hash = $1 AND used_at IS NULL AND expires_at > NOW()
        RETURNING user_id`,
        [hashCode(code)]
      );
      const userId = used.rows[0]?.user_id;
      const user = userId ? await users.findById(String(userId)) : null;
      if (!user || user.status === 'suspended') return reply.status(410).send({ success: false, error: expired });

      const identity: ProductionIdentity = {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      };
      return reply.send({ success: true, data: identity });
    }
  );

  // ---- Production: serving a copy -------------------------------------------

  fastify.post(
    '/v1/beta-export/redeem',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (onBeta()) return notFound(reply);
      const { code } = (request.body ?? {}) as { code?: unknown };
      if (typeof code !== 'string' || !code) return reply.status(400).send({ success: false, error: 'Missing code.' });

      const session = newSecret();
      // One statement: two redeems racing cannot both win.
      const redeemed = await database.query(
        `UPDATE beta_export_codes
            SET redeemed_at = NOW(), session_hash = $2,
                session_expires_at = NOW() + make_interval(mins => $3)
          WHERE code_hash = $1 AND redeemed_at IS NULL AND expires_at > NOW()
        RETURNING business_id, owner_id, member_ids`,
        [hashCode(code), hashCode(session), SESSION_MINUTES]
      );
      const row = redeemed.rows[0];
      const expired = 'This copy request has expired or was already used.';
      if (!row) return reply.status(410).send({ success: false, error: expired });

      const owner = await database.query(
        `SELECT b.name, m.role, u.email, u.first_name, u.last_name, u.role AS user_role
           FROM businesses b
           JOIN business_members m ON m.business_id = b.id AND m.user_id = $2
           JOIN users u ON u.id = $2
          WHERE b.id = $1`,
        [row.business_id, row.owner_id]
      );
      const ownerRow = owner.rows[0];
      if (ownerRow?.role !== 'Owner') return reply.status(410).send({ success: false, error: expired });

      let plan: string | null = null;
      try {
        const sub = await database.query('SELECT plan FROM business_subscriptions WHERE business_id = $1', [row.business_id]);
        plan = sub.rows[0]?.plan ?? null;
      } catch {
        /* no billing table: the copy starts on the default plan */
      }

      const members = await database.query(
        `SELECT u.email, m.role FROM business_members m
           JOIN users u ON u.id = m.user_id
          WHERE m.business_id = $1 AND m.user_id = ANY($2::uuid[]) AND m.role <> 'Owner'`,
        [row.business_id, row.member_ids ?? []]
      );

      const data: RedeemData = {
        session,
        businessId: String(row.business_id),
        businessName: String(ownerRow.name ?? ''),
        plan,
        owner: {
          email: String(ownerRow.email),
          firstName: ownerRow.first_name ?? '',
          lastName: ownerRow.last_name ?? '',
          role: ownerRow.user_role ?? null,
        },
        members: members.rows.map((m: any) => ({ email: String(m.email), role: String(m.role) })),
      };
      request.log.info({ businessId: data.businessId }, 'beta export code redeemed');
      return reply.send({ success: true, data });
    }
  );

  fastify.post(
    '/v1/beta-export/rows',
    { config: { rateLimit: { max: 3000, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (onBeta()) return notFound(reply);
      const body = (request.body ?? {}) as { session?: unknown; table?: unknown; offset?: unknown };
      const ids = await sessionIds(body.session);
      if (!ids) return reply.status(410).send({ success: false, error: 'The copy session has expired.' });
      const spec = typeof body.table === 'string' ? specFor(body.table) : undefined;
      if (!spec) return reply.status(400).send({ success: false, error: 'Unknown table.' });
      return reply.send({ success: true, data: await exportPage(database, spec, ids, Number(body.offset) || 0) });
    }
  );

  fastify.post(
    '/v1/beta-export/object',
    { config: { rateLimit: { max: 3000, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (onBeta()) return notFound(reply);
      const body = (request.body ?? {}) as { session?: unknown; key?: unknown };
      const ids = await sessionIds(body.session);
      if (!ids) return reply.status(410).send({ success: false, error: 'The copy session has expired.' });
      const key = typeof body.key === 'string' ? body.key : '';
      // Only files the exported rows point at — never an arbitrary key.
      if (!key || !(await fileKeyBelongs(database, ids, key))) return notFound(reply);
      try {
        const object = await createStorageDriver(database).get(key);
        return reply.send({ success: true, data: { mime: object.mime, data: object.body.toString('base64') } });
      } catch {
        return notFound(reply);
      }
    }
  );

  // ---- Beta -----------------------------------------------------------------

  fastify.post(
    '/v1/beta-sync/pull',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Indistinguishable from a missing route unless it is really production.
      if (!onBeta() || !fromProduction(request)) return notFound(reply);
      const base = productionBase();
      if (!base) return reply.status(503).send({ success: false, error: 'PRODUCTION_API_URL is not set on beta.' });
      const { code } = (request.body ?? {}) as { code?: unknown };
      if (typeof code !== 'string' || !code) return reply.status(400).send({ success: false, error: 'Missing code.' });

      try {
        return reply.send({ success: true, data: await pullWorkspace(database, base, code, request.log) });
      } catch (error) {
        if (error instanceof ProductionError) {
          return reply.status(error.status === 410 ? 410 : 502).send({ success: false, error: error.message });
        }
        request.log.error(error);
        return reply.status(500).send({ success: false, error: 'The copy failed part-way. The books on beta were not changed.' });
      }
    }
  );

  fastify.post(
    '/v1/beta-sso',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!onBeta()) return notFound(reply);
      const base = productionBase();
      if (!base) return reply.status(503).send({ success: false, error: 'Beta is not connected to the real site yet.' });
      const { code } = (request.body ?? {}) as { code?: unknown };
      if (typeof code !== 'string' || !code) return reply.status(400).send({ success: false, error: 'Missing code.' });

      try {
        const identity = await callProduction<ProductionIdentity>(base, '/v1/beta-export/login/redeem', { code });
        if (!identity?.email) return reply.status(410).send({ success: false, error: 'This link is not valid.' });
        return reply.send({ success: true, data: await auth.signInFromProduction(identity) });
      } catch (error) {
        if (error instanceof ProductionError) {
          return reply.status(error.status === 410 ? 410 : 502).send({ success: false, error: error.message });
        }
        request.log.error(error);
        const message = error instanceof Error && error.message.includes('suspended')
          ? error.message
          : 'Could not sign you in to beta. Open it again from the real site.';
        return reply.status(500).send({ success: false, error: message });
      }
    }
  );
}
