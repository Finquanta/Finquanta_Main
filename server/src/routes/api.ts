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
  // owner (super_admin). Accounts in ADMIN_EMAILS / SUPER_ADMIN_EMAILS are the
  // owners; they assign the "admin" role to other accounts in-app. Finally mount
  // the admin-only routes.
  try {
    const adminRepo = new AdminRepository(database);
    await adminRepo.ensureSchema();
    // Roles are upgrade-only. SUPER_ADMIN_EMAILS -> super_admin; ADMIN_EMAILS /
    // OWNER_EMAILS -> owner (top role; owners assign admin/super_admin in-app).
    await adminRepo.ensureRole('super_admin', (process.env.SUPER_ADMIN_EMAILS || '').split(','));
    await adminRepo.ensureRole('owner', [
      ...(process.env.OWNER_EMAILS || '').split(','),
      ...(process.env.ADMIN_EMAILS || '').split(','),
    ]);
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure admin users');
  }
  await fastify.register(adminRoutes, { database });
}

export default apiRoutes;
