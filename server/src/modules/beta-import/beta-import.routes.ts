import crypto from 'crypto';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { createStorageDriver } from '../../infrastructure/object-storage';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { AccountingRepository } from '../accounting/accounting.repository';
import { COPY_PLAN, specFor } from './copy-plan';
import { Queryable, ScopeIds, exportPage, fileKeyBelongs, writeWorkspaceCopy } from './beta-import.engine';

/**
 * "Import my real books": an owner copies a workspace from the real site into
 * beta.finquanta.ai. One way only.
 *
 *   1. On app.finquanta.ai the owner picks the workspace and the members who may
 *      test it → POST /v1/beta-export/codes → a one-time code in a link to beta.
 *   2. Beta's server redeems the code with production → a 30-minute session.
 *   3. Beta pulls the rows page by page, then the files, and writes the copy.
 *
 * Beta holds no key to production: the only credential is a code the owner
 * created seconds earlier, stored hashed, single-use, expiring in 10 minutes.
 *
 * The same module serves both sides; BETA_SITE decides which half answers.
 */

const CODE_MINUTES = 10;
const SESSION_MINUTES = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const onBeta = () => process.env.BETA_SITE === 'true';
const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const newSecret = () => crypto.randomBytes(32).toString('base64url');
const notFound = (reply: FastifyReply) => reply.status(404).send({ success: false, error: 'Not found' });

export async function ensureBetaImportSchema(database: Database): Promise<void> {
  // Production: codes an owner created, and the session each one turned into.
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
  // Beta: which workspaces are copies, and who may refresh them.
  await database.query(`
    CREATE TABLE IF NOT EXISTS beta_imports (
      business_id UUID PRIMARY KEY,
      imported_by UUID REFERENCES users(id) ON DELETE SET NULL,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Beta: ticked members waiting to sign up. No foreign key on purpose — a
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
  members: { email: string; role: string }[];
}

export async function betaImportRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const { database } = options;
  await ensureBetaImportSchema(database);

  const sessionIds = async (session: unknown): Promise<ScopeIds | null> => {
    if (typeof session !== 'string' || !session) return null;
    const result = await database.query(
      `SELECT business_id, owner_id FROM beta_export_codes
        WHERE session_hash = $1 AND session_expires_at > NOW()`,
      [sha256(session)]
    );
    const row = result.rows[0];
    return row ? { business: String(row.business_id), owner: String(row.owner_id) } : null;
  };

  // ---- Production side ------------------------------------------------------

  fastify.post(
    '/v1/beta-export/codes',
    { preHandler: [authenticate], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    (async (request: AuthenticatedRequest, reply: FastifyReply) => {
      if (onBeta()) return notFound(reply);
      const betaUrl = process.env.BETA_SITE_URL?.trim().replace(/\/+$/, '');
      if (!betaUrl) {
        return reply.status(503).send({ success: false, error: 'The beta site is not set up yet.' });
      }

      const body = (request.body ?? {}) as { businessId?: unknown; memberUserIds?: unknown };
      const businessId = typeof body.businessId === 'string' ? body.businessId : '';
      if (!UUID.test(businessId)) return reply.status(400).send({ success: false, error: 'Choose a workspace.' });

      const userId = request.user!.id;
      const role = await database.query(
        'SELECT role FROM business_members WHERE business_id = $1 AND user_id = $2',
        [businessId, userId]
      );
      // 422 rather than 403: the client treats 403 as a dead session.
      if (role.rows[0]?.role !== 'Owner') {
        return reply.status(422).send({ success: false, error: 'Only the workspace owner can copy it to beta.' });
      }

      const memberIds = Array.isArray(body.memberUserIds)
        ? body.memberUserIds.filter((id): id is string => typeof id === 'string' && UUID.test(id))
        : [];

      // The "Beta tester" badge on the real workspace is exactly the ticked set.
      await database.query(
        `UPDATE business_members SET beta_tester = (user_id = ANY($2::uuid[]))
          WHERE business_id = $1 AND role <> 'Owner'`,
        [businessId, memberIds]
      );

      const code = newSecret();
      await database.query(
        `INSERT INTO beta_export_codes (code_hash, business_id, owner_id, member_ids, expires_at)
         VALUES ($1, $2, $3, $4::uuid[], NOW() + make_interval(mins => $5))`,
        [sha256(code), businessId, userId, memberIds, CODE_MINUTES]
      );
      request.log.info({ businessId, userId, members: memberIds.length }, 'beta export code created');

      return reply.send({
        success: true,
        data: { url: `${betaUrl}/import?code=${encodeURIComponent(code)}`, expiresInMinutes: CODE_MINUTES },
      });
    }) as any
  );

  fastify.post(
    '/v1/beta-export/redeem',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
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
        [sha256(code), sha256(session), SESSION_MINUTES]
      );
      const row = redeemed.rows[0];
      const expired = 'This link has expired or was already used. Start again from "Import my real books".';
      if (!row) return reply.status(410).send({ success: false, error: expired });

      const owner = await database.query(
        `SELECT b.name, m.role FROM businesses b
           JOIN business_members m ON m.business_id = b.id AND m.user_id = $2
          WHERE b.id = $1`,
        [row.business_id, row.owner_id]
      );
      if (owner.rows[0]?.role !== 'Owner') return reply.status(410).send({ success: false, error: expired });

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
        businessName: String(owner.rows[0].name ?? ''),
        plan,
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

  // ---- Beta side ------------------------------------------------------------

  fastify.post(
    '/v1/beta-import',
    { preHandler: [authenticate], config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    (async (request: AuthenticatedRequest, reply: FastifyReply) => {
      if (!onBeta()) return notFound(reply);
      const base = process.env.PRODUCTION_API_URL?.trim().replace(/\/+$/, '');
      if (!base) {
        return reply.status(503).send({ success: false, error: 'Importing is not set up on this beta site yet.' });
      }
      const { code } = (request.body ?? {}) as { code?: unknown };
      if (typeof code !== 'string' || !code) return reply.status(400).send({ success: false, error: 'Missing code.' });
      const importerId = request.user!.id;

      try {
        const meta = await callProduction<RedeemData>(base, '/v1/beta-export/redeem', { code });
        const businessId = meta.businessId;

        const existing = await database.query('SELECT 1 FROM businesses WHERE id = $1', [businessId]);
        const previous = await database.query('SELECT imported_by FROM beta_imports WHERE business_id = $1', [businessId]);
        const refreshing = existing.rows.length > 0;
        if (refreshing && previous.rows[0]?.imported_by !== importerId) {
          return reply.status(409).send({ success: false, error: 'This workspace was copied to beta by someone else.' });
        }

        // Everything is fetched before the database is touched, so a dropped
        // connection part-way changes nothing on beta.
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
          return reply.status(410).send({ success: false, error: 'That workspace no longer exists on the real site.' });
        }

        const { counts, fileKeys } = await database.transaction(async (client) => {
          const tx = client as unknown as Queryable;
          const copy = await writeWorkspaceCopy(tx, data, businessId, importerId, refreshing);

          await tx.query(
            `INSERT INTO beta_imports (business_id, imported_by, imported_at) VALUES ($1, $2, NOW())
             ON CONFLICT (business_id) DO UPDATE SET imported_by = EXCLUDED.imported_by, imported_at = NOW()`,
            [businessId, importerId]
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

        // Ticked members who already have a beta account join now; the rest on signup.
        await database.query(
          `INSERT INTO business_members (business_id, user_id, role)
           SELECT i.business_id, u.id, i.role FROM beta_member_invites i
             JOIN users u ON lower(u.email) = i.email
            WHERE i.business_id = $1
           ON CONFLICT (business_id, user_id) DO NOTHING`,
          [businessId]
        );

        // Same plan as the real workspace, so plan gates behave the same. No
        // Stripe ids: beta must never think a real subscription is its own.
        if (meta.plan) {
          try {
            await database.query(
              `INSERT INTO business_subscriptions (business_id, plan) VALUES ($1, $2)
               ON CONFLICT (business_id) DO UPDATE SET plan = EXCLUDED.plan`,
              [businessId, meta.plan]
            );
          } catch (error) {
            request.log.warn({ error, businessId }, 'beta import: could not set the plan');
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
          request.log.warn({ error, businessId }, 'beta import: bookkeeping resync failed; it runs again on next load');
        }

        request.log.info({ businessId, importerId, refreshing, counts, filesCopied, filesFailed }, 'beta import done');
        return reply.send({
          success: true,
          data: {
            businessId,
            businessName: meta.businessName,
            refreshed: refreshing,
            counts,
            filesCopied,
            filesFailed,
            membersInvited: meta.members.length,
          },
        });
      } catch (error) {
        if (error instanceof ProductionError) {
          return reply.status(error.status === 410 ? 410 : 502).send({ success: false, error: error.message });
        }
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: 'The copy failed part-way. Nothing was changed on beta — try again.',
        });
      }
    }) as any
  );
}
