import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { UserRepository } from '../users/user.repository';
import { UserRole } from '../users/types';
import { AdminRepository } from './admin.repository';
import { PasswordManager } from '../auth/password';
import { BillingRepository } from '../billing/billing.repository';
import { EntitlementsService } from '../billing/entitlements.service';
import { ownedBusinessesNeedingSuccessor, transferOwnership } from '../shared/transfer-ownership';
import {
  isPlanKey, PLANS, PLAN_KEYS, TRIAL_DAYS_UNVERIFIED, TRIAL_DAYS_VERIFIED,
} from '../billing/plans';

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
  const billing = new BillingRepository(options.database);
  const entitlements = new EntitlementsService(options.database);
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

  // Audit log — append-only record of admin actions (admin only).
  fastify.get('/v1/admin/audit', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await repo.listAuditLogs() });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  /**
   * Closed accounts (admin only).
   *
   * Separate from /audit because the audit log only ever held ADMIN actions —
   * somebody deleting their own account from profile settings appeared nowhere,
   * and that is the majority of deletions. This reads the dedicated record
   * written inside the deletion transaction itself, so it survives the cascade
   * that removes everything else about the person.
   */
  fastify.get('/v1/admin/account-deletions', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await repo.listAccountDeletions() });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Edit a user: name, role (super_admin only), status (restrict/suspend)
  fastify.patch('/v1/admin/users/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      // businessName / country are gone from here on purpose — they describe a
      // workspace, not a person, and are edited on the Businesses tab.
      const body = request.body as { firstName?: string; lastName?: string; role?: string; status?: string; dateOfBirth?: string | null; emailVerified?: boolean };
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
      // Profile fields (name, DOB, verification) share the edit gate.
      const editsProfile = body.firstName !== undefined || body.lastName !== undefined
        || body.dateOfBirth !== undefined || body.emailVerified !== undefined;
      if (editsProfile && !isSelf && !canEditName(callerRole, target.role)) {
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
        dateOfBirth: body.dateOfBirth,
        emailVerified: body.emailVerified,
      });

      // Audit trail (non-deletable record of what changed).
      const changes: string[] = [];
      if (body.role !== undefined) changes.push(`role → ${body.role}`);
      if (body.status !== undefined) changes.push(body.status === 'suspended' ? 'suspended account' : 'reactivated account');
      if (body.emailVerified !== undefined) changes.push(body.emailVerified ? 'marked verified' : 'marked unverified');
      const profileFields: string[] = [];
      if (body.firstName !== undefined || body.lastName !== undefined) profileFields.push('name');
      if (body.dateOfBirth !== undefined) profileFields.push('DOB');
      if (profileFields.length) changes.push(`edited ${profileFields.join(', ')}`);
      await repo.addAuditLog({
        actorId: request.user!.id,
        actorEmail: request.user!.email,
        action: changes.length ? `Updated user (${changes.join('; ')})` : 'Updated user',
        targetId: id,
        targetEmail: target.email,
      });
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Delete a user
  /**
   * Shared workspaces this user owns — what deleting them would take with it,
   * and who each one could be handed to instead.
   *
   * The candidates ship WITH the list rather than through the ordinary
   * `/v1/businesses/:id/members` route, because that one requires the caller to
   * be a member of the workspace and an admin is not. Bundling them also makes
   * this one request instead of one per workspace.
   */
  /**
   * Give an ownerless workspace an owner — the undo for somebody leaving a
   * workspace they were alone in.
   */
  fastify.patch('/v1/admin/businesses/:id/owner', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as { userId?: string; email?: string }) || {};

      const target = await repo.getBusinessById(id);
      if (!target) return reply.status(404).send({ success: false, error: 'Business not found' });

      /**
       * Accepts an id or an email, and resolves the email here.
       *
       * The admin knows whose workspace it was — they have the address in front
       * of them on the row. Making the browser turn that into an id would mean
       * shipping every account on the platform to a page that only needs one.
       */
      const person = body.userId
        ? await repo.getById(body.userId)
        : body.email
          ? await repo.findByEmail(body.email.trim())
          : null;
      if (!person) {
        return reply.status(404).send({
          success: false,
          error: body.email ? `No account found with the email ${body.email.trim()}.` : 'User not found',
        });
      }

      const result = await repo.assignOwner(id, person.id);
      if (result === 'not_found') return reply.status(404).send({ success: false, error: 'Business not found' });
      if (result === 'has_owner') {
        return reply.status(409).send({
          success: false,
          error: 'That business already has an owner. Only ownerless ones can be assigned here.',
        });
      }

      await repo.addAuditLog({
        actorId: request.user!.id,
        actorEmail: request.user!.email,
        action: `Assigned ownership of "${target.name}" to ${person.email}`,
        targetId: id,
        targetEmail: person.email,
      });
      return reply.send({ success: true, data: { businessId: id, ownerId: person.id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not assign an owner.' });
    }
  }) as any);

  fastify.get('/v1/admin/users/:id/deletion-blockers', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const shared = await ownedBusinessesNeedingSuccessor(options.database, id);
      if (shared.length === 0) return reply.send({ success: true, data: [] });

      const members = await options.database.query(
        `SELECT m.business_id, m.user_id, m.role, u.email, u.first_name, u.last_name
           FROM business_members m
           JOIN users u ON u.id = m.user_id
          WHERE m.business_id = ANY($1::uuid[]) AND m.user_id <> $2
          ORDER BY u.first_name NULLS LAST`,
        [shared.map((b) => b.id), id]
      );

      const byBusiness: Record<string, { userId: string; name: string; email: string; role: string }[]> = {};
      for (const r of members.rows) {
        (byBusiness[r.business_id] ||= []).push({
          userId: r.user_id,
          name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.email,
          email: r.email,
          role: r.role,
        });
      }

      return reply.send({
        success: true,
        data: shared.map((b) => ({ ...b, candidates: byBusiness[b.id] ?? [] })),
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

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

      /**
       * SHARED WORKSPACES NEED A DECISION FIRST.
       *
       * Deleting a user cascades the businesses they own and every ledger
       * beneath them, so removing one account here can erase four other
       * people's books — from a menu item that says only "Delete". The same
       * guard already sits on the user's own delete-account; an admin having a
       * softer path to the identical damage would make the guard decorative.
       *
       * An admin gets one thing the account holder does not: the option to
       * delete the workspace deliberately. A spam or fraudulent workspace
       * should not require nominating a new owner for it. But it has to be
       * CHOSEN per workspace, never defaulted.
       */
      const body = (request.body as {
        successors?: Record<string, string>;
        deleteWorkspaces?: string[];
      }) || {};
      const successors = body.successors ?? {};
      const doomed = new Set(body.deleteWorkspaces ?? []);

      const shared = await ownedBusinessesNeedingSuccessor(options.database, id);
      const undecided = shared.filter((b) => !successors[b.id] && !doomed.has(b.id));
      if (undecided.length > 0) {
        return reply.status(409).send({
          success: false,
          error: "Decide what happens to this person's shared workspaces first.",
          data: { businesses: undecided },
        });
      }

      // Transfers run BEFORE the delete: a failure here leaves the account
      // standing and the earlier workspaces safely re-owned.
      const handedOver: string[] = [];
      for (const business of shared) {
        const successor = successors[business.id];
        if (!successor) continue;
        await transferOwnership(options.database, business.id, successor);
        handedOver.push(business.name);
      }

      await repo.deleteUser(id, { actorId: request.user!.id, actorEmail: request.user!.email });
      await repo.addAuditLog({
        actorId: request.user!.id,
        actorEmail: request.user!.email,
        // Spelled out because "Deleted user" alone hides the part that took
        // other people's records with it.
        action: [
          'Deleted user',
          handedOver.length ? `handed over ${handedOver.length} workspace(s): ${handedOver.join(', ')}` : '',
          doomed.size ? `deleted ${doomed.size} shared workspace(s) with their books` : '',
        ].filter(Boolean).join(' — '),
        targetId: id,
        targetEmail: target.email,
      });
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  /**
   * Workspaces. Business-shaped data lives here rather than on the user list,
   * where joining it duplicated every multi-workspace owner.
   *
   * These reuse the SAME capability gates as the user routes, applied to the
   * workspace OWNER's role — otherwise deleting someone's workspace would be a
   * softer path to destroying the same financial history that deleting their
   * account is carefully gated on.
   */
  fastify.get('/v1/admin/businesses', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await repo.listBusinesses() });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Edit a workspace: name and country.
  fastify.patch('/v1/admin/businesses/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as { name?: string; country?: string }) || {};
      const target = await repo.getBusinessById(id);
      if (!target) return reply.status(404).send({ success: false, error: 'Business not found' });

      if (!canEditName(request.user!.role, target.ownerRole)) {
        return reply.status(403).send({ success: false, error: 'You do not have permission to edit this business.' });
      }
      if (body.name !== undefined && !body.name.trim()) {
        return reply.status(400).send({ success: false, error: 'Business name cannot be empty.' });
      }

      await repo.updateBusiness(id, {
        name: body.name !== undefined ? body.name.trim() : undefined,
        country: body.country,
      });

      const fields: string[] = [];
      if (body.name !== undefined) fields.push('name');
      if (body.country !== undefined) fields.push('country');
      await repo.addAuditLog({
        actorId: request.user!.id,
        actorEmail: request.user!.email,
        action: `Updated workspace "${target.name}"${fields.length ? ` (edited ${fields.join(', ')})` : ''}`,
        targetId: id,
        targetEmail: target.ownerEmail,
      });
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Restrict or reactivate a workspace. Enforced in `withBusiness`.
  fastify.patch('/v1/admin/businesses/:id/status', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as { status?: string }) || {};
      if (!['active', 'suspended'].includes(body.status ?? '')) {
        return reply.status(400).send({ success: false, error: 'Invalid status.' });
      }
      const target = await repo.getBusinessById(id);
      if (!target) return reply.status(404).send({ success: false, error: 'Business not found' });

      if (!canRestrict(request.user!.role, target.ownerRole)) {
        return reply.status(403).send({ success: false, error: 'You do not have permission to restrict this business.' });
      }

      await repo.setBusinessStatus(id, body.status as 'active' | 'suspended');
      await repo.addAuditLog({
        actorId: request.user!.id,
        actorEmail: request.user!.email,
        action: `${body.status === 'suspended' ? 'Restricted' : 'Reactivated'} workspace "${target.name}"`,
        targetId: id,
        targetEmail: target.ownerEmail,
      });
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Delete a workspace and its entire financial history. Irreversible.
  fastify.delete('/v1/admin/businesses/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const target = await repo.getBusinessById(id);
      if (!target) return reply.status(404).send({ success: false, error: 'Business not found' });

      if (!canDelete(request.user!.role, target.ownerRole)) {
        return reply.status(403).send({ success: false, error: 'You do not have permission to delete this business.' });
      }

      await repo.deleteBusiness(id);
      await repo.addAuditLog({
        actorId: request.user!.id,
        actorEmail: request.user!.email,
        action: `Deleted workspace "${target.name}" and its financial history`,
        targetId: id,
        targetEmail: target.ownerEmail,
      });
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  /**
   * Subscriptions (spec 08 §4.1–4.3).
   *
   * Plan changes are unrestricted by design — free straight to Corporate if the
   * user wants, for comping design partners and accelerator contacts. Every one
   * is audited, which is the control here rather than a permission matrix.
   */
  /**
   * Everything the Overview tab needs, in one call: revenue, plan mix, users,
   * workspaces, countries.
   *
   * Bundled deliberately. The tab is a single screen of headline numbers, and
   * five requests to draw one page means five chances for a slow one to leave
   * the screen half-populated.
   */
  fastify.get('/v1/admin/overview', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      /**
       * Optional period, as plain dates. Validated by shape rather than
       * trusted: these go into a query, and a malformed value should be
       * ignored rather than reaching Postgres as a cast error.
       */
      const q = (request.query as { from?: string; to?: string }) || {};
      const asDate = (v: unknown) =>
        typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

      const [stats, distribution, mrr] = await Promise.all([
        repo.overviewStats({ from: asDate(q.from), to: asDate(q.to) }),
        billing.planDistribution(),
        entitlements.projectedMrr(),
      ]);
      return reply.send({
        success: true,
        data: {
          ...stats,
          /**
           * EVERY plan, including the ones nobody is on.
           *
           * planDistribution only returns rows that exist, so an empty tier
           * simply vanished from the page — and "no Business customers" is a
           * fact worth seeing, not an absence to be inferred from a gap.
           */
          plans: PLAN_KEYS.map((key) => {
            const row = distribution.find((d) => d.plan === key);
            return {
              plan: key,
              name: PLANS[key].name,
              businesses: row?.businesses ?? 0,
              seats: row?.seats ?? 0,
              monthly: PLANS[key].monthly,
              contactSales: PLANS[key].contactSales,
            };
          }),
          // PROJECTED, and named as such wherever it is shown: it is price x
          // seats over assigned plans, not money that has arrived.
          projectedMrr: mrr.monthly,
          projectedArr: Math.round(mrr.monthly * 12 * 100) / 100,
          byPlan: mrr.byPlan,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load the overview.' });
    }
  }) as any);

  fastify.get('/v1/admin/billing/overview', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const [distribution, mrr] = await Promise.all([
        billing.planDistribution(),
        entitlements.projectedMrr(),
      ]);
      return reply.send({
        success: true,
        data: {
          distribution,
          // PROJECTED, not real: nothing is charging anyone yet. Real MRR needs
          // Stripe, and quoting this as revenue would be quoting an intention.
          projectedMrr: mrr.monthly,
          projectedByPlan: mrr.byPlan,
          plans: PLAN_KEYS.map((k) => ({
            key: k, name: PLANS[k].name, monthly: PLANS[k].monthly,
            annual: PLANS[k].annual, contactSales: PLANS[k].contactSales,
          })),
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load billing overview.' });
    }
  }) as any);

  // Move a workspace to any plan.
  fastify.patch('/v1/admin/businesses/:id/plan', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as { plan?: string }) || {};
      if (!isPlanKey(body.plan)) {
        return reply.status(400).send({ success: false, error: 'Unknown plan.' });
      }
      const target = await repo.getBusinessById(id);
      if (!target) return reply.status(404).send({ success: false, error: 'Business not found' });

      const before = await billing.get(id);
      await billing.setPlan(id, body.plan);

      await repo.addAuditLog({
        actorId: request.user!.id,
        actorEmail: request.user!.email,
        action: `Plan for "${target.name}": ${before?.plan ?? 'freemium'} → ${body.plan}`,
        targetId: id,
        targetEmail: target.ownerEmail,
      });
      return reply.send({ success: true, data: await billing.get(id) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not change that plan.' });
    }
  }) as any);

  /**
   * Start a trial. Length follows the verification rule (spec 08 §4.1): 7 days
   * unverified, 14 verified. Read from the OWNER's account, since that is whose
   * email was or wasn't confirmed.
   */
  fastify.post('/v1/admin/businesses/:id/trial', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const target = await repo.getBusinessById(id);
      if (!target) return reply.status(404).send({ success: false, error: 'Business not found' });

      const existing = await billing.get(id);
      if (existing?.trialStartedAt) {
        return reply.status(400).send({
          success: false,
          error: 'This business has already used its trial. Extend it instead.',
        });
      }

      // Read the flag straight off `users` — the User type findById returns
      // does not carry email_verified, and widening it for one route would
      // touch every consumer of that type.
      const v = await options.database.query(
        'SELECT email_verified FROM users WHERE id = $1',
        [target.ownerId]
      );
      const days = v.rows[0]?.email_verified ? TRIAL_DAYS_VERIFIED : TRIAL_DAYS_UNVERIFIED;
      /**
       * `force` — an admin granting a second trial is a deliberate comp, not the
       * accident the per-account rule exists to stop. Audited below.
       */
      const sub = await billing.startTrial(id, days, { userId: target.ownerId || null, force: true });

      await repo.addAuditLog({
        actorId: request.user!.id,
        actorEmail: request.user!.email,
        action: `Started a ${days}-day trial for "${target.name}"`,
        targetId: id,
        targetEmail: target.ownerEmail,
      });
      return reply.send({ success: true, data: sub });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not start that trial.' });
    }
  }) as any);

  // Extend a trial by an arbitrary number of days.
  fastify.patch('/v1/admin/businesses/:id/trial', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as { days?: unknown }) || {};
      const days = Number(body.days);
      if (!Number.isFinite(days) || days <= 0 || days > 365) {
        return reply.status(400).send({ success: false, error: 'Days must be between 1 and 365.' });
      }
      const target = await repo.getBusinessById(id);
      if (!target) return reply.status(404).send({ success: false, error: 'Business not found' });

      const sub = await billing.extendTrial(id, Math.round(days));
      await repo.addAuditLog({
        actorId: request.user!.id,
        actorEmail: request.user!.email,
        action: `Extended the trial for "${target.name}" by ${Math.round(days)} days`,
        targetId: id,
        targetEmail: target.ownerEmail,
      });
      return reply.send({ success: true, data: sub });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not extend that trial.' });
    }
  }) as any);

  /**
   * Grant or revoke early access (the grandfather window).
   *
   * Separate from plan and trial because it is a different promise: not "you
   * are paying for this" and not "try it for a fortnight", but "you had this
   * before we started charging and you keep it until X".
   */
  fastify.patch('/v1/admin/businesses/:id/grandfather', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as { months?: unknown }) || {};

      // null clears it; anything else must be a sane number of months.
      let months: number | null = null;
      if (body.months !== null && body.months !== undefined) {
        const n = Number(body.months);
        if (!Number.isFinite(n) || n <= 0 || n > 120) {
          return reply.status(400).send({
            success: false, error: 'Months must be between 1 and 120, or null to remove.',
          });
        }
        months = Math.round(n);
      }

      const target = await repo.getBusinessById(id);
      if (!target) return reply.status(404).send({ success: false, error: 'Business not found' });

      await billing.setGrandfather(id, months);
      await repo.addAuditLog({
        actorId: request.user!.id,
        actorEmail: request.user!.email,
        action: months === null
          ? `Removed grandfathering from "${target.name}"`
          : `Grandfathered "${target.name}" for ${months} months`,
        targetId: id,
        targetEmail: target.ownerEmail,
      });
      return reply.send({ success: true, data: await billing.get(id) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not change grandfathering.' });
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
      await repo.addAuditLog({
        actorId: request.user!.id,
        actorEmail: request.user!.email,
        action: 'Set password',
        targetId: id,
        targetEmail: target.email,
      });
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
