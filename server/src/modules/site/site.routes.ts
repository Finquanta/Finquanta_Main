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
  `);
  // Exactly one row, ever — the CHECK(id) on a BOOLEAN primary key makes a second
  // row impossible, so there's no "which settings row is the real one?" question.
  await database.query(
    `INSERT INTO site_settings (id, maintenance_enabled) VALUES (true, false) ON CONFLICT DO NOTHING`
  );

  /** Public: the banner has to be readable by logged-out visitors. */
  fastify.get('/v1/site/maintenance', (async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await database.query(
        'SELECT maintenance_enabled, maintenance_message FROM site_settings WHERE id = true'
      );
      const row = result.rows[0];
      return reply.send({
        success: true,
        data: {
          enabled: !!row?.maintenance_enabled,
          message: row?.maintenance_message || DEFAULT_MESSAGE,
        },
      });
    } catch (error) {
      // If this call fails the banner simply doesn't show. A broken settings
      // lookup must never take the marketing site down with it.
      return reply.send({ success: true, data: { enabled: false, message: DEFAULT_MESSAGE } });
    }
  }) as any);

  /** Admin: turn the banner on or off, and set what it says. */
  fastify.put('/v1/admin/site/maintenance', {
    preHandler: [authenticate, requireAdmin(database)],
  }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as { enabled?: boolean; message?: string }) || {};
      const enabled = !!body.enabled;
      const message = (body.message ?? '').trim() || null;

      const result = await database.query(
        `UPDATE site_settings
         SET maintenance_enabled = $1,
             maintenance_message = COALESCE($2, maintenance_message),
             updated_at = NOW(),
             updated_by = $3::uuid
         WHERE id = true
         RETURNING maintenance_enabled, maintenance_message`,
        [enabled, message, request.user!.id]
      );

      const row = result.rows[0];
      return reply.send({
        success: true,
        data: {
          enabled: !!row?.maintenance_enabled,
          message: row?.maintenance_message || DEFAULT_MESSAGE,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not update the maintenance banner.' });
    }
  }) as any);
}
