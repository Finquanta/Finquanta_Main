import { FastifyInstance, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { PasswordManager } from '../auth/password';
import { BusinessesRepository, BUSINESS_ROLES, BusinessRole } from './businesses.repository';

const isValidRole = (r: unknown): r is BusinessRole => BUSINESS_ROLES.includes(r as BusinessRole);
const canManage = (role: string | null) => role === 'Owner' || role === 'Admin';

export async function businessRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new BusinessesRepository(options.database);
  const passwords = new PasswordManager();

  // List businesses the current user belongs to
  fastify.get('/v1/businesses', { preHandler: [authenticate] }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await repo.listForUser(request.user!.id) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Create a new business (creator becomes Owner)
  fastify.post('/v1/businesses', { preHandler: [authenticate] }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { name } = request.body as { name?: string };
      if (!name || !name.trim()) return reply.status(400).send({ success: false, error: 'Business name is required' });
      return reply.status(201).send({ success: true, data: await repo.create(request.user!.id, name.trim()) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Rename a business (Owner/Admin)
  fastify.patch('/v1/businesses/:id', { preHandler: [authenticate] }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { name } = request.body as { name?: string };
      if (!name || !name.trim()) return reply.status(400).send({ success: false, error: 'Business name is required' });
      const role = await repo.getRole(id, request.user!.id);
      if (!canManage(role)) return reply.status(403).send({ success: false, error: 'Only an owner or admin can rename this business' });
      const updated = await repo.rename(id, name.trim());
      if (!updated) return reply.status(404).send({ success: false, error: 'Business not found' });
      return reply.send({ success: true, data: { ...updated, role } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // List members of a business (members only)
  fastify.get('/v1/businesses/:id/members', { preHandler: [authenticate] }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const role = await repo.getRole(id, request.user!.id);
      if (!role) return reply.status(403).send({ success: false, error: 'Not a member of this business' });
      return reply.send({ success: true, data: await repo.listMembers(id) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Create an invite link (Owner/Admin), optionally password-protected
  fastify.post('/v1/businesses/:id/invites', { preHandler: [authenticate] }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { role?: string; password?: string };
      const role = await repo.getRole(id, request.user!.id);
      if (!canManage(role)) return reply.status(403).send({ success: false, error: 'Only an owner or admin can invite members' });

      const inviteRole: BusinessRole = isValidRole(body.role) && body.role !== 'Owner' ? body.role : 'Viewer';
      const token = uuidv4().replace(/-/g, '');
      const passwordHash = body.password && body.password.trim() ? await passwords.hash(body.password.trim()) : null;
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days

      await repo.createInvite(id, inviteRole, token, passwordHash, request.user!.id, expiresAt);
      return reply.status(201).send({ success: true, data: { token, role: inviteRole, requiresPassword: !!passwordHash, expiresAt } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Public invite info (so an invitee can see what they're joining before logging in)
  fastify.get('/v1/businesses/invites/:token', (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { token } = request.params as { token: string };
      const invite = await repo.getInvite(token);
      if (!invite) return reply.status(404).send({ success: false, error: 'Invite not found' });
      return reply.send({
        success: true,
        data: {
          businessName: invite.businessName,
          role: invite.role,
          requiresPassword: invite.requiresPassword,
          expired: invite.expiresAt ? new Date(invite.expiresAt).getTime() < Date.now() : false,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Accept an invite (authenticated; password required if the invite has one)
  fastify.post('/v1/businesses/invites/:token/accept', { preHandler: [authenticate] }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { token } = request.params as { token: string };
      const { password } = request.body as { password?: string };
      const invite = await repo.getInvite(token);
      if (!invite) return reply.status(404).send({ success: false, error: 'Invite not found' });
      if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
        return reply.status(400).send({ success: false, error: 'This invite has expired' });
      }
      if (invite.requiresPassword) {
        const ok = invite.passwordHash && password ? await passwords.verify(password, invite.passwordHash) : false;
        if (!ok) return reply.status(401).send({ success: false, error: 'Incorrect invite password' });
      }
      await repo.addMember(invite.businessId, request.user!.id, invite.role);
      await repo.markInviteAccepted(invite.id);
      return reply.send({ success: true, data: { businessId: invite.businessId, businessName: invite.businessName, role: invite.role } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Remove a member (Owner/Admin; cannot remove the owner)
  fastify.delete('/v1/businesses/:id/members/:userId', { preHandler: [authenticate] }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id, userId } = request.params as { id: string; userId: string };
      const myRole = await repo.getRole(id, request.user!.id);
      if (!canManage(myRole)) return reply.status(403).send({ success: false, error: 'Only an owner or admin can remove members' });
      const targetRole = await repo.getRole(id, userId);
      if (targetRole === 'Owner') return reply.status(400).send({ success: false, error: 'The owner cannot be removed' });
      await repo.removeMember(id, userId);
      return reply.send({ success: true, data: { userId } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);
}
