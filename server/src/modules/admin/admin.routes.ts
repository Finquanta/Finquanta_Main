import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { UserRepository } from '../users/user.repository';
import { UserRole } from '../users/types';
import { AdminRepository } from './admin.repository';
import { PasswordManager } from '../auth/password';

const VALID_ROLES = ['user', 'admin', 'super_admin', 'owner'];

// Mirrors auth.service password rules. Returns an error message, or null if OK.
function passwordError(pw: string): string | null {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters long';
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(pw)) return 'Password must contain a lowercase letter, an uppercase letter, and a number';
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(pw)) return 'Password must contain at least one special character';
  return null;
}
const ADMIN_ROLES = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER];
const RANK: Record<string, number> = { user: 0, admin: 1, super_admin: 2, owner: 3 };
const rank = (r: string) => RANK[r] ?? 0;

/**
 * Guard that allows only admin / super_admin / owner. The JWT carries no role,
 * so we look the user up by id and check their DB role. Run after `authenticate`.
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
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return reply.status(403).send({ success: false, error: 'Admin access required' });
    }
    authed.user!.role = user.role;
  };
}

// Capability matrix (caller role acting on a target role). Internal keys map to
// UI names: user=User, admin=Moderator, super_admin=Admin, owner=Owner.
// - owner (Owner): restrict/delete/editName/assignRole on everyone.
// - super_admin (Admin): manage Moderators & Users (rank <= 1) — editName,
//   restrict, delete, and promote/demote between User and Moderator only.
// - admin (Moderator): editName + restrict regular Users only.
const canRestrict = (caller: string | undefined, target: string) =>
  caller === 'owner' || (caller === 'super_admin' && rank(target) <= 1) || (caller === 'admin' && target === 'user');
const canDelete = (caller: string | undefined, target: string) =>
  caller === 'owner' || (caller === 'super_admin' && rank(target) <= 1);
const canEditName = (caller: string | undefined, target: string) =>
  caller === 'owner' || (caller === 'super_admin' && rank(target) <= 1) || (caller === 'admin' && target === 'user');
const canAssignRole = (caller: string | undefined, targetRole: string, newRole: string) =>
  caller === 'owner' || (caller === 'super_admin' && rank(targetRole) <= 1 && rank(newRole) <= 1);

export async function adminRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new AdminRepository(options.database);
  const users = new UserRepository(options.database);
  const passwords = new PasswordManager();
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
      const isSelf = id === request.user!.id;

      // You can edit your own name, but you can't change your own role or
      // status here — that's how you'd accidentally lock yourself out.
      if (isSelf && (body.role !== undefined || body.status !== undefined)) {
        return reply.status(400).send({ success: false, error: 'You cannot change your own role or status.' });
      }
      const target = await repo.getById(id);
      if (!target) return reply.status(404).send({ success: false, error: 'User not found' });

      // Each requested change is checked against its own capability.
      if (body.role !== undefined) {
        if (!VALID_ROLES.includes(body.role)) {
          return reply.status(400).send({ success: false, error: 'Invalid role.' });
        }
        if (!canAssignRole(callerRole, target.role, body.role)) {
          return reply.status(403).send({ success: false, error: 'You do not have permission to assign this role.' });
        }
      }
      if ((body.firstName !== undefined || body.lastName !== undefined) && !isSelf && !canEditName(callerRole, target.role)) {
        return reply.status(403).send({ success: false, error: 'You do not have permission to edit this account.' });
      }
      if (body.status !== undefined) {
        if (!['active', 'suspended'].includes(body.status)) {
          return reply.status(400).send({ success: false, error: 'Invalid status.' });
        }
        if (!canRestrict(callerRole, target.role)) {
          return reply.status(403).send({ success: false, error: 'You do not have permission to restrict this account.' });
        }
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
      if (!canDelete(request.user!.role, target.role)) {
        return reply.status(403).send({ success: false, error: 'You do not have permission to delete this account.' });
      }
      await repo.deleteUser(id);
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Set a user's password directly. Same hierarchy as editing a profile
  // (owner -> anyone; super_admin -> moderators & users; admin -> users; plus
  // self). Lets an owner help a locked-out user when email reset isn't usable.
  fastify.patch('/v1/admin/users/:id/password', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { password } = (request.body as { password?: string }) || {};
      const err = passwordError(password || '');
      if (err) return reply.status(400).send({ success: false, error: err });
      const target = await repo.getById(id);
      if (!target) return reply.status(404).send({ success: false, error: 'User not found' });
      const isSelf = id === request.user!.id;
      if (!isSelf && !canEditName(request.user!.role, target.role)) {
        return reply.status(403).send({ success: false, error: "You do not have permission to set this account's password." });
      }
      const hash = await passwords.hash(password!);
      await users.setPassword(id, hash);
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Anthropic month-to-date spend, so the team knows when to renew credits.
  // Requires ANTHROPIC_ADMIN_KEY (an org Admin API key, sk-ant-admin...) — a
  // different key from the inference ANTHROPIC_API_KEY. Without it, reports
  // { configured: false } so the UI can explain what to set.
  fastify.get('/v1/admin/usage', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const key = process.env.ANTHROPIC_ADMIN_KEY;
      if (!key) return reply.send({ success: true, data: { configured: false } });

      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const base = { starting_at: monthStart.toISOString(), ending_at: now.toISOString(), bucket_width: '1d' };
      let page: string | undefined;
      let totalCents = 0;
      let currency = 'USD';
      let guard = 0;

      do {
        const params = new URLSearchParams({ ...base, ...(page ? { page } : {}) });
        const res = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?${params.toString()}`, {
          headers: { 'anthropic-version': '2023-06-01', 'x-api-key': key },
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          request.log.error({ status: res.status, body }, 'Anthropic cost report failed');
          return reply.send({ success: true, data: { configured: true, error: `Anthropic API ${res.status}` } });
        }
        const json: any = await res.json();
        for (const bucket of json?.data ?? []) {
          for (const r of bucket?.results ?? []) {
            const amt = parseFloat(r?.amount);
            if (!Number.isNaN(amt)) totalCents += amt;
            if (r?.currency) currency = r.currency;
          }
        }
        page = json?.has_more ? json?.next_page : undefined;
      } while (page && guard++ < 50);

      return reply.send({
        success: true,
        data: {
          configured: true,
          monthToDateUsd: totalCents / 100,
          currency,
          since: monthStart.toISOString(),
          until: now.toISOString(),
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);
}
