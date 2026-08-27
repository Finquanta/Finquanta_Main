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
import { RefreshTokenRepository } from '../modules/auth/refresh-token.repository';
import { blogRoutes } from '../modules/blog/blog.routes';
import { BlogRepository } from '../modules/blog/blog.repository';
import { newsletterRoutes } from '../modules/newsletter/newsletter.routes';
import { NewsletterRepository } from '../modules/newsletter/newsletter.repository';
import { accountingRoutes } from '../modules/accounting/accounting.routes';
import { AccountingRepository } from '../modules/accounting/accounting.repository';
import { customerRoutes } from '../modules/customers/customers.routes';
import { CustomersRepository } from '../modules/customers/customers.repository';
import { invoiceRoutes } from '../modules/invoices/invoices.routes';
import { InvoicesRepository } from '../modules/invoices/invoices.repository';
import { loanRoutes } from '../modules/loans/loans.routes';
import { LoansRepository } from '../modules/loans/loans.repository';
import { activityRoutes } from '../modules/activity/activity.routes';
import { healthRoutes } from '../modules/health/health.routes';
import { referralsRoutes } from '../modules/referrals/referrals.routes';
import { ReferralsRepository } from '../modules/referrals/referrals.repository';
import { notificationsRoutes } from '../modules/notifications/notifications.routes';
import { NotificationsRepository } from '../modules/notifications/notifications.repository';
import { siteRoutes } from '../modules/site/site.routes';
import { fxRoutes } from '../modules/fx/fx.routes';
import { FxRepository } from '../modules/fx/fx.repository';
import { groupsRoutes } from '../modules/groups/groups.routes';
import { captureRoutes } from '../modules/capture/capture.routes';
import { inboundRoutes } from '../modules/inbound/inbound.routes';
import { inboundWebhookRoutes } from '../modules/inbound/inbound.webhook';
import { GroupsRepository } from '../modules/groups/groups.repository';
import { brainRoutes } from '../modules/brain/brain.routes';
import { BrainRepository } from '../modules/brain/brain.repository';
import { BrainAdvisorService } from '../modules/brain/brain.advisor';
import { BrainInsightsService } from '../modules/brain/brain.insights';
import { BillingRepository } from '../modules/billing/billing.repository';
import { billingRoutes } from '../modules/billing/billing.routes';
import { stripeRoutes } from '../modules/billing/stripe.routes';
import { stripeWebhookRoutes } from '../modules/billing/webhook.routes';
import { UsageService } from '../modules/billing/usage.service';
import { SubscriptionExpenseService } from '../modules/billing/subscription-expense';
import { councilRoutes } from '../modules/council/council.routes';
import { CouncilRepository } from '../modules/council/council.repository';
import { finnaRoutes } from '../modules/finna/finna.routes';
import { FinnaRepository } from '../modules/finna/finna.repository';
import { nudgesRoutes } from '../modules/nudges/nudges.routes';
import { NudgesService } from '../modules/nudges/nudges.service';
import { ActivityRepository } from '../modules/activity/activity.repository';
import { aiUsageRoutes } from '../modules/ai-usage/ai-usage.routes';
import { lifecycleRoutes } from '../modules/lifecycle/lifecycle.routes';
import { LifecycleRepository } from '../modules/lifecycle/lifecycle.repository';
import { AiUsageRepository } from '../modules/ai-usage/ai-usage.repository';

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

  // Refresh-token rotation/revocation table.
  try {
    await new RefreshTokenRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure refresh_tokens schema');
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

  // Ledger tables (accounts / journal_entries / journal_lines). Must come after
  // businesses, since accounts are scoped to a business. Per-business chart of
  // accounts is seeded lazily the first time a ledger is touched.
  // Deliberately NOT swallowed, unlike the migrations above. Those degrade —
  // a missing optional column disables one feature. This one is load-bearing:
  // syncBookkeeping's ON CONFLICT requires the unique index this creates, so
  // booting without it serves an app whose every ledger-backed route 500s.
  // Refusing to start is the diagnosable failure; the alternative is not.
  await new AccountingRepository(database).ensureSchema();
  await fastify.register(accountingRoutes, { database });

  // Customers (invoices are raised against these).
  try {
    await new CustomersRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure customers schema');
  }
  await fastify.register(customerRoutes, { database });

  // Invoices — depend on customers (billed to) and the ledger (AR automation).
  try {
    await new InvoicesRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure invoices schema');
  }
  await fastify.register(invoiceRoutes, { database });

  // Debt — loans payable (borrowed) and receivable (lent out), with
  // principal/interest splitting on every payment.
  try {
    await new LoansRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure loans schema');
  }
  await fastify.register(loanRoutes, { database });

  // Financial activity timeline — the complete history of what happened.
  try {
    await new ActivityRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure activity schema');
  }
  await fastify.register(activityRoutes, { database });

  // Financial Health Score — reads the ledger, no schema of its own.
  await fastify.register(healthRoutes, { database });

  // Referral program (Section 13).
  try {
    await new ReferralsRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure referrals schema');
  }
  await fastify.register(referralsRoutes, { database });

  // Admin-authored notifications, delivered to users' inboxes.
  try {
    await new NotificationsRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure notifications schema');
  }
  await fastify.register(notificationsRoutes, { database });

  // Site-wide settings (the maintenance banner) — admin-toggleable, no redeploy.
  await fastify.register(siteRoutes, { database });

  // Foreign-exchange rates for multi-currency entries. Books stay in USD.
  try {
    await new FxRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure fx schema');
  }
  await fastify.register(fxRoutes, { database });

  // Business Groups (cost & profit centers). Organizational metadata only —
  // never touches the ledger.
  try {
    await new GroupsRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure groups schema');
  }
  await fastify.register(groupsRoutes, { database });
  // Document Capture — photograph or upload a bill and read it into the books.
  await fastify.register(captureRoutes, { database });

  /**
   * Inbound email — forward a bill to a private address and have it read.
   *
   * Registered AFTER capture, and that ordering is load-bearing: its
   * ensureSchema adds a column to `document_captures`, which capture creates.
   *
   * The webhook is a SEPARATE registration because it replaces the JSON body
   * parser with a raw-string one to verify a signature over the exact bytes
   * sent. Fastify scopes that to the plugin instance, so isolating it here
   * keeps every other route parsing JSON normally — same reason the Stripe
   * webhook is registered on its own below.
   */
  await fastify.register(inboundRoutes, { database });
  await fastify.register(inboundWebhookRoutes, { database });

  // Company Brain — the business's knowledge graph: categories, notes and the
  // connections between them, plus read-only pins onto live financial data.
  /**
   * Subscriptions and entitlements (spec 08). Registered BEFORE the brain and
   * council modules, because their routes gate on it — and its ensureSchema
   * carries the one-time grandfather backfill, which has to have run before any
   * gate can answer correctly for an existing workspace.
   */
  try {
    await new BillingRepository(database).ensureSchema();
    await new UsageService(database).ensureSchema();
    await new SubscriptionExpenseService(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure billing schema');
  }
  await fastify.register(billingRoutes, { database });
  await fastify.register(stripeRoutes, { database });
  // Registered separately because it replaces the JSON body parser with a raw
  // string one. Fastify scopes that to the plugin instance, so isolating it
  // here keeps every other route parsing JSON normally.
  await fastify.register(stripeWebhookRoutes, { database });

  // Registered after groups and accounting because its pins read from both.
  try {
    await new BrainRepository(database).ensureSchema();
    await new BrainAdvisorService(database).ensureSchema();
    await new BrainInsightsService(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure brain schema');
  }
  await fastify.register(brainRoutes, { database });

  // Finna Council — writes Decision nodes into the Brain, so it registers after
  // it. Never runs on its own; every session is convened by the user.
  try {
    await new CouncilRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure council schema');
  }
  await fastify.register(councilRoutes, { database });

  // Saved Finna chats. Storage only — no AI call lives here.
  try {
    await new FinnaRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure finna schema');
  }
  await fastify.register(finnaRoutes, { database });

  // Proactive Finna (Council spec §9/10). Deterministic triggers only — showing
  // an offer costs nothing; only engaging with it spends anything.
  try {
    await new NudgesService(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure nudges schema');
  }
  await fastify.register(nudgesRoutes, { database });

  // AI (Finna/Claude) daily usage caps, so a single user or anonymous IP can't
  // run up unbounded Anthropic spend.
  try {
    await new AiUsageRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure ai_usage schema');
  }
  await fastify.register(aiUsageRoutes, { database });

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

  // Lifecycle reminders: the scheduled job endpoint, click tracking,
  // unsubscribe and per-type preferences.
  try {
    await new LifecycleRepository(database).ensureSchema();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to ensure lifecycle schema');
  }
  await fastify.register(lifecycleRoutes, { database });

  /**
   * Record that somebody is alive, for the re-engagement reminder.
   *
   * An `onResponse` hook, so it runs AFTER the reply has been sent and adds
   * nothing to the latency of any request. `request.user` is populated by then
   * for anything that authenticated, and absent for anything that did not,
   * which is exactly the filter needed.
   *
   * Fire-and-forget on purpose: this is the least important write in the
   * system, and it must never turn a working request into a failed one. The
   * repository throttles to one write per user per hour, so this does not add a
   * database round trip to every call.
   */
  const lifecycleRepo = new LifecycleRepository(database);
  fastify.addHook('onResponse', async (request) => {
    const user = (request as { user?: { id?: string } }).user;
    if (!user?.id) return;
    void lifecycleRepo.touchActivity(user.id).catch(() => { /* never surface */ });
  });
}

export default apiRoutes;
