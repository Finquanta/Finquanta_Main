import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { UserRepository } from '../users/user.repository';

/**
 * Site-wide settings an admin can flip without a redeploy.
 *
 * Right now that's just the maintenance banner. It used to be a hardcoded
 * `const ENABLED = true`, which meant taking the notice down required a code
 * change and a deploy — exactly the wrong shape for something you want to turn
 * on the moment something breaks.
 */

const ADMIN_ROLES = ['admin', 'super_admin', 'owner'];

const DEFAULT_MESSAGE =
  "🚧 Finquanta is under active maintenance. The site is still fully usable in the meantime — your data is safe.";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Which wording applies.
 *
 * Manual first, always. An emergency banner and a planned-maintenance banner
 * are different announcements with different words, and the urgent one wins
 * whenever both could apply.
 */
function effectiveMessage(row: any): string {
  if (row?.maintenance_enabled) return row?.maintenance_message || DEFAULT_MESSAGE;
  return row?.maintenance_scheduled_message || row?.maintenance_message || DEFAULT_MESSAGE;
}

function requireAdmin(database: Database) {
  const users = new UserRepository(database);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authed = request as AuthenticatedRequest;
    const id = authed.user?.id;
    if (!id) return reply.status(401).send({ success: false, error: 'Authentication required' });
    const user = await users.findById(id);
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return reply.status(403).send({ success: false, error: 'Admin access required' });
    }
    authed.user!.role = user.role;
  };
}

export async function siteRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const { database } = options;

  await database.query(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
      maintenance_enabled BOOLEAN NOT NULL DEFAULT false,
      maintenance_message TEXT,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_by UUID REFERENCES users(id) ON DELETE SET NULL
    );

    -- A scheduled window, so maintenance can be announced before it starts.
    -- Nullable: the manual switch above still works on its own.
    ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS maintenance_starts_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS maintenance_ends_at   TIMESTAMP WITH TIME ZONE;
    -- Its own wording. A banner you put up because something is ON FIRE says
    -- something different from one announcing Sunday's planned work, and the
    -- two must be editable without overwriting each other.
    ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS maintenance_scheduled_message TEXT;
  `);
  // Exactly one row, ever — the CHECK(id) on a BOOLEAN primary key makes a second
  // row impossible, so there's no "which settings row is the real one?" question.
  await database.query(
    `INSERT INTO site_settings (id, maintenance_enabled) VALUES (true, false) ON CONFLICT DO NOTHING`
  );

  /** Public: the banner has to be readable by logged-out visitors. */
  fastify.get('/v1/site/maintenance', (async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      /**
       * `active` and `upcoming` are computed in SQL, not in Node.
       *
       * The database owns the clock — the same reason the QR handoff checks its
       * expiry in a WHERE clause. A server whose time has drifted must not be
       * able to decide the site is under maintenance when it is not, and a
       * scheduled window has to start on time without anything running to
       * flip it. There is no cron here: the query IS the scheduler, exactly as
       * the announcements table already does it.
       */
      const result = await database.query(
        `SELECT maintenance_enabled,
                maintenance_message,
                maintenance_scheduled_message,
                maintenance_starts_at,
                maintenance_ends_at,
                (
                  maintenance_enabled
                  OR (maintenance_starts_at IS NOT NULL
                      AND maintenance_starts_at <= NOW()
                      AND (maintenance_ends_at IS NULL OR NOW() < maintenance_ends_at))
                ) AS active,
                (maintenance_starts_at IS NOT NULL AND maintenance_starts_at > NOW()) AS upcoming
           FROM site_settings WHERE id = true`
      );
      const row = result.rows[0];
      return reply.send({
        success: true,
        data: {
          // Kept as `enabled` rather than renamed to `active`: every existing
          // caller reads that name, and a rename buys nothing.
          enabled: !!row?.active,
          /** The switch itself, as opposed to whether a window is running. */
          manual: !!row?.maintenance_enabled,
          /**
           * The wording that applies RIGHT NOW.
           *
           * The manual switch wins: if somebody flipped it because the site is
           * broken this minute, that message is the urgent one and must not be
           * replaced by the calmer text written for a planned window.
           */
          message: effectiveMessage(row),
          /** Both, unresolved, so the admin form can edit each independently. */
          manualMessage: row?.maintenance_message || DEFAULT_MESSAGE,
          scheduledMessage: row?.maintenance_scheduled_message || '',
          startsAt: row?.maintenance_starts_at ?? null,
          endsAt: row?.maintenance_ends_at ?? null,
          /** Scheduled, but not yet begun — this is the advance notice. */
          upcoming: !!row?.upcoming,
        },
      });
    } catch (error) {
      // If this call fails the banner simply doesn't show. A broken settings
      // lookup must never take the marketing site down with it.
      return reply.send({
        success: true,
        data: {
          enabled: false, manual: false, message: DEFAULT_MESSAGE,
          manualMessage: DEFAULT_MESSAGE, scheduledMessage: '',
          startsAt: null, endsAt: null, upcoming: false,
        },
      });
    }
  }) as any);

  /** Admin: turn the banner on or off, and set what it says. */
  fastify.put('/v1/admin/site/maintenance', {
    preHandler: [authenticate, requireAdmin(database)],
  }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as {
        enabled?: boolean; message?: string; scheduledMessage?: string;
        startsAt?: string | null; endsAt?: string | null;
      }) || {};
      const enabled = !!body.enabled;
      const message = (body.message ?? '').trim() || null;
      // Tri-state like the dates: undefined leaves it, '' clears it.
      const scheduledSet = body.scheduledMessage !== undefined;
      const scheduledMessage = (body.scheduledMessage ?? '').trim() || null;

      /**
       * A blank string clears the date; `undefined` leaves it alone. Those are
       * different intentions and the admin form sends both, so they cannot be
       * collapsed into one falsy check.
       */
      const parseWhen = (v: string | null | undefined): { set: boolean; value: string | null } => {
        if (v === undefined) return { set: false, value: null };
        const trimmed = (v ?? '').trim();
        if (!trimmed) return { set: true, value: null };
        const when = new Date(trimmed);
        if (Number.isNaN(when.getTime())) throw new Error('That is not a valid date and time.');
        return { set: true, value: when.toISOString() };
      };

      let starts: { set: boolean; value: string | null };
      let ends: { set: boolean; value: string | null };
      try {
        starts = parseWhen(body.startsAt);
        ends = parseWhen(body.endsAt);
      } catch (e) {
        return reply.status(400).send({
          success: false,
          error: e instanceof Error ? e.message : 'Invalid date.',
        });
      }

      // A window that ends before it starts is always a mistake, and one that
      // silently never fires is worse than being told now.
      if (starts.value && ends.value && new Date(ends.value) <= new Date(starts.value)) {
        return reply.status(400).send({
          success: false,
          error: 'Maintenance must end after it starts.',
        });
      }

      const result = await database.query(
        `UPDATE site_settings
         SET maintenance_enabled = $1,
             maintenance_message = COALESCE($2, maintenance_message),
             maintenance_scheduled_message =
               CASE WHEN $8 THEN $9::text ELSE maintenance_scheduled_message END,
             maintenance_starts_at = CASE WHEN $4 THEN $5::timestamptz ELSE maintenance_starts_at END,
             maintenance_ends_at   = CASE WHEN $6 THEN $7::timestamptz ELSE maintenance_ends_at   END,
             updated_at = NOW(),
             updated_by = $3::uuid
         WHERE id = true
         RETURNING maintenance_enabled,
                   maintenance_message,
                   maintenance_scheduled_message,
                   maintenance_starts_at,
                   maintenance_ends_at,
                   (
                     maintenance_enabled
                     OR (maintenance_starts_at IS NOT NULL
                         AND maintenance_starts_at <= NOW()
                         AND (maintenance_ends_at IS NULL OR NOW() < maintenance_ends_at))
                   ) AS active,
                   (maintenance_starts_at IS NOT NULL AND maintenance_starts_at > NOW()) AS upcoming`,
        [
          enabled, message, request.user!.id,
          starts.set, starts.value, ends.set, ends.value,
          scheduledSet, scheduledMessage,
        ]
      );

      const row = result.rows[0];
      return reply.send({
        success: true,
        data: {
          enabled: !!row?.active,
          /** The switch itself, as opposed to whether a window is running. */
          manual: !!row?.maintenance_enabled,
          message: row?.maintenance_message || DEFAULT_MESSAGE,
          startsAt: row?.maintenance_starts_at ?? null,
          endsAt: row?.maintenance_ends_at ?? null,
          upcoming: !!row?.upcoming,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not update the maintenance banner.' });
    }
  }) as any);
}
