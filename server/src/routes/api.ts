import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ApiInfoResponse, ApiResponse } from '@/types';
import { authRoutes } from '../modules/auth/auth.routes';
import { transactionRoutes } from '../modules/financial/transaction.routes';
import { Database } from '../infrastructure/database';
import { profileRoutes } from '../modules/profile/profile.routes';
import { dashboardRoutes } from '../modules/dashboard/dashboard.routes';
import { bookkeepingRoutes } from '../modules/bookkeeping/bookkeeping.routes';
import { statisticsRoutes } from '../modules/statistics/statistics.routes';
import { payrollRoutes } from '../modules/payroll/payroll.routes';
import { documentRoutes } from '../modules/documents/document.routes';
import { businessPlanRoutes } from '../modules/business-plans/business-plan.routes';
import { reminderRoutes } from '../modules/reminders/reminders.routes';
import { RemindersRepository } from '../modules/reminders/reminders.repository';
import { ReceiptRepository } from '../modules/financial/receipt.repository';
import { ProfileRepository } from '../modules/profile/profile.repository';
import { businessRoutes } from '../modules/businesses/businesses.routes';
import { BusinessesRepository } from '../modules/businesses/businesses.repository';
import { adminRoutes } from '../modules/admin/admin.routes';
import { AdminRepository } from '../modules/admin/admin.repository';
import { UserRepository } from '../modules/users/user.repository';
import { blogRoutes } from '../modules/blog/blog.routes';
import { BlogRepository } from '../modules/blog/blog.repository';
import { newsletterRoutes } from '../modules/newsletter/newsletter.routes';
import { NewsletterRepository } from '../modules/newsletter/newsletter.repository';

async function apiRoutes(fastify: FastifyInstance): Promise<void> {
  // API information
  fastify.get('/', {
    schema: {
      description: 'Get API information',
      tags: ['api'],
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            version: { type: 'string' },
            status: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const response: ApiInfoResponse = {
      message: 'Finquanta AI API Server',
      version: '1.0.0',
      status: 'running',
    };

    return response;
  });

  // API version
  fastify.get('/version', {
    schema: {
      description: 'Get API version information',
      tags: ['api'],
      response: {
        200: {
          type: 'object',
          properties: {
            version: { type: 'string' },
            buildDate: { type: 'string' },
            environment: { type: 'string' },
            nodeVersion: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const response = {
      version: '1.0.0',
      buildDate: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
    };

    return response;
  });

  // Test route for development
  fastify.get('/test', {
    schema: {
      description: 'Test endpoint for development',
      tags: ['api', 'test'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            timestamp: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                headers: { type: 'object' },
                query: { type: 'object' },
                params: { type: 'object' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const response: ApiResponse = {
      success: true,
      message: 'Test endpoint working correctly',
      timestamp: new Date().toISOString(),
      data: {
        headers: request.headers,
        query: request.query,
        params: request.params,
      },
    };

    return response;
  });

  // Register authentication routes
  const database = new Database();
  await fastify.register(authRoutes, {
    prefix: '/v1/auth',
    database
  });

  // Ensure the password-reset columns exist (idempotent).
  try {
    await new UserRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure users reset schema');
  }

  // Register financial transaction routes
  await fastify.register(transactionRoutes, {
    database
  });

  await fastify.register(profileRoutes, { database });
  await fastify.register(dashboardRoutes, { database });
  await fastify.register(bookkeepingRoutes, { database });
  await fastify.register(statisticsRoutes, { database });
  await fastify.register(payrollRoutes, { database });
  await fastify.register(documentRoutes, { database });
  await fastify.register(businessPlanRoutes, { database });

  // Ensure the reminders table exists (idempotent), then register its routes.
  try {
    await new RemindersRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure reminders schema');
  }
  await fastify.register(reminderRoutes, { database });

  // Ensure the blog table exists (idempotent), then register blog routes.
  try {
    await new BlogRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure blog schema');
  }
  await fastify.register(blogRoutes, { database });

  // Ensure the newsletter subscribers table exists (idempotent), then register.
  try {
    await new NewsletterRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure newsletter schema');
  }
  await fastify.register(newsletterRoutes, { database });

  // Ensure the receipts table exists (idempotent).
  try {
    await new ReceiptRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure receipts schema');
  }

  // Ensure the business onboarding table exists (idempotent).
  try {
    await new ProfileRepository(database).ensureBusinessSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure business_profiles schema');
  }

  // Ensure businesses/members/invites tables exist and every user has a default
  // business (runs after business_profiles so the backfill can read its names).
  try {
    const businessesRepo = new BusinessesRepository(database);
    await businessesRepo.ensureSchema();
    // Add business_id to data tables + backfill (after default businesses exist).
    await businessesRepo.ensureDataScoping();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure businesses schema');
  }
  await fastify.register(businessRoutes, { database });

  // Ensure the users.status column exists, then promote configured emails to
  // their role at boot, then mount the admin-only routes. Env vars map to the
  // four UI roles (internal key in parens):
  //   OWNER_EMAILS      -> Owner     (owner)       — full control, assigns roles
  //   ADMIN_EMAILS      -> Admin     (super_admin) — manages Moderators & Users
  //   MODERATOR_EMAILS  -> Moderator (admin)       — manages Users
  // SUPER_ADMIN_EMAILS is a legacy alias for ADMIN_EMAILS (-> super_admin).
  try {
    const adminRepo = new AdminRepository(database);
    await adminRepo.ensureSchema();
    const split = (v?: string) => (v || '').split(',');
    // Upgrade-only, applied lowest role first so an email listed in several
    // ends up at the highest role it qualifies for. Log how many rows each
    // role matched so a misconfigured *_EMAILS var is visible in the logs.
    const moderators = await adminRepo.ensureRole('admin', split(process.env.MODERATOR_EMAILS));
    const admins = await adminRepo.ensureRole('super_admin', [
      ...split(process.env.ADMIN_EMAILS),
      ...split(process.env.SUPER_ADMIN_EMAILS),
    ]);
    const owners = await adminRepo.ensureRole('owner', split(process.env.OWNER_EMAILS));
    if (owners || admins || moderators) {
      // Counts only (no emails) so a misconfigured *_EMAILS var is still visible.
      fastify.log.info({ owners, admins, moderators }, 'Role bootstrap: promoted users to their configured roles');
    }
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure admin users');
  }
  await fastify.register(adminRoutes, { database });
}

export default apiRoutes;
