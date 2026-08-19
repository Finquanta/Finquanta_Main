import { FastifyInstance, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { PasswordManager } from '../auth/password';
import { BusinessesRepository, BUSINESS_ROLES, BusinessRole } from './businesses.repository';
import { syncSeats } from '../billing/seats';
import { EntitlementsService } from '../billing/entitlements.service';
import { transferOwnership } from '../shared/transfer-ownership';
import { sendEmail } from '../../infrastructure/email';
import { inviteEmailHtml } from './invite-email';

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
      const { name, country } = request.body as { name?: string; country?: string };
      if (!name || !name.trim()) return reply.status(400).send({ success: false, error: 'Business name is required' });
      return reply.status(201).send({
        success: true,
        data: await repo.create(request.user!.id, name.trim(), country ?? null),
      });
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
      const body = request.body as { role?: string; password?: string; expiry?: string; email?: string };
      const role = await repo.getRole(id, request.user!.id);
      if (!canManage(role)) return reply.status(403).send({ success: false, error: 'Only an owner or admin can invite members' });

      const inviteRole: BusinessRole = isValidRole(body.role) && body.role !== 'Owner' ? body.role : 'Viewer';
      const token = uuidv4().replace(/-/g, '');
      const passwordHash = body.password && body.password.trim() ? await passwords.hash(body.password.trim()) : null;
      // 'once' => single-use link (no time limit); otherwise it expires in 7 days.
      const singleUse = body.expiry === 'once';
      const expiresAt = singleUse ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await repo.createInvite(id, inviteRole, token, passwordHash, request.user!.id, expiresAt, singleUse);

      /**
       * Optionally deliver it. The link is still returned either way.
       *
       * Copy-and-paste remains the primary path and is NOT replaced: it is the
       * only one that works when you do not know somebody's address yet, or
       * when you want to hand it over in a channel you already trust.
       *
       * Sending is best-effort and never fails the request. The invite already
       * exists by this point — reporting failure would suggest it does not, and
       * the caller would create a second one.
       */
      let emailed = false;
      const target = typeof body.email === 'string' ? body.email.trim() : '';
      if (target) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) {
          return reply.status(400).send({ success: false, error: 'That email address does not look right.' });
        }
        /**
         * Rate limited, unlike link creation.
         *
         * Generating a link is harmless — it goes nowhere until someone shares
         * it. This endpoint makes OUR server send mail to an address of the
         * caller's choosing, which is a spam vector wearing a feature's
         * clothing, so it is capped per inviter per day.
         */
        const quota = await repo.countInviteEmailsToday(request.user!.id);
        if (quota >= 20) {
          return reply.status(429).send({
            success: false,
            error: 'You have sent a lot of invites today. The link below still works — share it directly.',
            data: { token, role: inviteRole },
          });
        }

        const business = await repo.getBusinessById(id);
        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        const link = `${appUrl}/join/${token}`;
        // The token carries only id/email, so the display name is looked up.
        const inviter = await repo.inviterName(request.user!.id);

        try {
          await sendEmail({
            to: target,
            subject: `${inviter} invited you to ${business?.name ?? 'a business'} on Finquanta`,
            html: inviteEmailHtml({
              inviter,
              businessName: business?.name ?? 'their business',
              role: inviteRole,
              link,
              requiresPassword: !!passwordHash,
              expiresAt,
              singleUse,
            }),
          });
          emailed = true;
          await repo.markInviteEmailed(token, target);
        } catch (error) {
          // Logged, not surfaced: the invite exists and the link works.
          request.log.error({ error }, 'Could not send an invite email');
        }
      }

      return reply.status(201).send({
        success: true,
        data: { token, role: inviteRole, requiresPassword: !!passwordHash, expiresAt, singleUse, emailed },
      });
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
          expired: (invite.expiresAt ? new Date(invite.expiresAt).getTime() < Date.now() : false) || (invite.singleUse && !!invite.acceptedAt),
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
      if (invite.singleUse && invite.acceptedAt) {
        return reply.status(400).send({ success: false, error: 'This invite link has already been used' });
      }
      if (invite.requiresPassword) {
        const ok = invite.passwordHash && password ? await passwords.verify(password, invite.passwordHash) : false;
        if (!ok) return reply.status(401).send({ success: false, error: 'Incorrect invite password' });
      }
      await repo.addMember(invite.businessId, request.user!.id, invite.role);
      await repo.markInviteAccepted(invite.id);
      // The workspace just grew, so what Stripe bills should grow with it.
      // Deliberately awaited but incapable of throwing: joining must succeed
      // whatever billing does.
      await syncSeats(options.database, invite.businessId, request.log);
      return reply.send({ success: true, data: { businessId: invite.businessId, businessName: invite.businessName, role: invite.role } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  /**
   * Change a member's role — which is also how a PAID SEAT is granted or taken
   * back.
   *
   * Seats are not a separate object. A member in a working role occupies a
   * billable seat; a Viewer does not. So "give this person a seat" and "make
   * this person an Admin" are the same act, and modelling them separately would
   * mean two switches that can disagree — someone holding a seat they cannot
   * use, or working in a role nobody is paying for.
   *
   * Owner is excluded in BOTH directions. Promoting to Owner is a transfer (it
   * would otherwise be a way to take a business from its owner), and the owner
   * cannot be demoted to a Viewer, which would leave the workspace with nobody
   * who can invite, transfer or delete it.
   *
   * The bill follows immediately: `syncSeats` re-points the Stripe quantity, so
   * granting a seat costs from today and releasing one credits back. Prorated
   * to the next invoice rather than charged on the spot.
   */
  fastify.patch('/v1/businesses/:id/members/:userId/role', { preHandler: [authenticate] }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id, userId } = request.params as { id: string; userId: string };
      const { role } = (request.body as { role?: string }) || {};
      if (!isValidRole(role)) {
        return reply.status(400).send({ success: false, error: 'Unknown role' });
      }
      if (role === 'Owner') {
        return reply.status(400).send({
          success: false,
          error: 'Use Transfer ownership to make somebody the owner.',
        });
      }

      const myRole = await repo.getRole(id, request.user!.id);
      if (!canManage(myRole)) {
        return reply.status(403).send({ success: false, error: 'Only an owner or admin can change roles' });
      }

      const targetRole = await repo.getRole(id, userId);
      if (!targetRole) return reply.status(404).send({ success: false, error: 'That person is not a member' });
      if (targetRole === 'Owner') {
        return reply.status(400).send({
          success: false,
          error: 'The owner always holds a seat. Transfer ownership first.',
        });
      }

      await repo.addMember(id, userId, role); // upserts the role for an existing member
      await syncSeats(options.database, id, request.log);

      const seats = await new EntitlementsService(options.database).seatCount(id);
      return reply.send({ success: true, data: { userId, role, seats } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  /**
   * Hand the business to another member.
   *
   * OWNER ONLY. An Admin can do nearly everything else here, but promoting
   * themselves to Owner would make "Admin" and "Owner" the same role with an
   * extra click in between.
   */
  fastify.post('/v1/businesses/:id/transfer', { preHandler: [authenticate] }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { userId } = (request.body as { userId?: string }) || {};
      if (!userId) return reply.status(400).send({ success: false, error: 'Choose who to transfer ownership to' });

      const myRole = await repo.getRole(id, request.user!.id);
      if (myRole !== 'Owner') {
        return reply.status(403).send({ success: false, error: 'Only the owner can transfer ownership' });
      }
      if (userId === request.user!.id) {
        return reply.status(400).send({ success: false, error: 'You already own this business' });
      }

      await transferOwnership(options.database, id, userId);
      return reply.send({ success: true, data: { businessId: id, ownerId: userId } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      // A caller naming somebody who is not in the workspace is a bad request,
      // not a server fault.
      if (msg.includes('not a member')) return reply.status(400).send({ success: false, error: msg });
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  /**
   * Leave a business you are a member of.
   *
   * THE OWNER CANNOT LEAVE. Not a limitation — an ownerless workspace has
   * nobody who can invite, transfer, or delete it, and `businesses.owner_id` is
   * NOT NULL besides. They are told to transfer first, which is the step they
   * were going to have to take anyway.
   */
  fastify.post('/v1/businesses/:id/leave', { preHandler: [authenticate] }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const myRole = await repo.getRole(id, request.user!.id);
      if (!myRole) return reply.status(404).send({ success: false, error: 'You are not a member of this business' });

      if (myRole === 'Owner') {
        /**
         * An owner with colleagues still has to hand over first — walking out
         * would leave people inside a workspace nobody can administer.
         *
         * An owner who is ALONE is a different case. There is nobody to hand it
         * to, and refusing would trap them in a workspace forever. So they
         * leave, the workspace stays (its books are not collateral for pressing
         * a button), and it becomes ownerless — visible in the admin panel,
         * where an owner can be assigned again if this was a mistake.
         */
        const members = await repo.memberCount(id);
        if (members > 1) {
          return reply.status(409).send({
            success: false,
            error: 'Transfer ownership to someone else before leaving.',
          });
        }
        await repo.abandon(id, request.user!.id);
        await syncSeats(options.database, id, request.log);
        return reply.send({ success: true, data: { businessId: id, ownerless: true } });
      }

      await repo.removeMember(id, request.user!.id);
      // One fewer seat to bill, the same as being removed by an admin.
      await syncSeats(options.database, id, request.log);
      return reply.send({ success: true, data: { businessId: id } });
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
      // And shrink it again on the way out — a team should stop paying for
      // somebody the moment they are removed, not at the next renewal.
      await syncSeats(options.database, id, request.log);
      return reply.send({ success: true, data: { userId } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);
}
