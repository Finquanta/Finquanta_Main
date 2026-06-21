import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { UserRepository } from '../users/user.repository';
import { UserRole } from '../users/types';
import { AdminRepository } from './admin.repository';

const VALID_ROLES = ['user', 'admin', 'super_admin'];

/**
 * Guard that allows only admin / super_admin users. The JWT carries no role, so
 * we look the user up by id and check their DB role. Run after `authenticate`.
 */
function requireAdmin(database: Database) {
  const users = new UserRepository(database);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authed = request as AuthenticatedRequest;
    const id = authed.user?.id;
    if (!id) {
      return reply.status(401).send({ success: false, error: 'Authentication required' });
    }
    const user = await users.findById(id);
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN)) {
      return reply.status(403).send({ success: false, error: 'Admin access required' });
    }
    authed.user!.role = user.role;
  };
}

/**
 * Who can manage whom:
 * - super_admin (owner): can manage admins and users, but NOT other super_admins.
 * - admin: can manage regular users only.
 */
function canManage(callerRole: string | undefined, targetRole: string): boolean {
  if (callerRole === 'super_admin') return targetRole !== 'super_admin';
  if (callerRole === 'admin') return targetRole === 'user';
  return false;
}

export async function adminRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new AdminRepository(options.database);
  const pre = [authenticate, requireAdmin(options.database)];

  // List all users (admin only)
  fastify.get('/v1/admin/users', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await repo.listUsers() });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Who am I (used by the admin UI to decide what actions to show)
  fastify.get('/v1/admin/me', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    return reply.send({ success: true, data: { id: request.user!.id, email: request.user!.email, role: request.user!.role } });
  }) as any);

  // Edit a user: name, role (super_admin only), status (restrict/suspend)
  fastify.patch('/v1/admin/users/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { firstName?: string; lastName?: string; role?: string; status?: string };
      const callerRole = request.user!.role;

      if (id === request.user!.id) {
        return reply.status(400).send({ success: false, error: 'You cannot modify your own admin account here.' });
      }
      const target = await repo.getById(id);
      if (!target) return reply.status(404).send({ success: false, error: 'User not found' });
      if (!canManage(callerRole, target.role)) {
        return reply.status(403).send({ success: false, error: 'You do not have permission to manage this account.' });
      }

      // Role changes are super_admin (owner) only.
      if (body.role !== undefined) {
        if (callerRole !== 'super_admin') {
          return reply.status(403).send({ success: false, error: 'Only the owner can change roles.' });
        }
        if (!VALID_ROLES.includes(body.role)) {
          return reply.status(400).send({ success: false, error: 'Invalid role.' });
        }
      }
      if (body.status !== undefined && !['active', 'suspended'].includes(body.status)) {
        return reply.status(400).send({ success: false, error: 'Invalid status.' });
      }

      await repo.updateUser(id, {
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
        status: body.status,
      });
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Delete a user
  fastify.delete('/v1/admin/users/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      if (id === request.user!.id) {
        return reply.status(400).send({ success: false, error: 'You cannot delete your own account.' });
      }
      const target = await repo.getById(id);
      if (!target) return reply.status(404).send({ success: false, error: 'User not found' });
      if (!canManage(request.user!.role, target.role)) {
        return reply.status(403).send({ success: false, error: 'You do not have permission to delete this account.' });
      }
      await repo.deleteUser(id);
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);
}
