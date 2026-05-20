# User Dashboard Server Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the user dashboard mock/local state with authenticated Fastify API data shaped for the existing Next.js `user` app.

**Architecture:** Keep the existing server pattern: each domain lives under `server/src/modules/<domain>` with `types`, `repository`, `service`, `controller`, and `routes`. PostgreSQL remains the source of truth, while existing financial transactions power dashboard, bookkeeping, and statistics aggregates before adding narrower domain tables for payroll, documents, business plans, goals, and settings.

**Tech Stack:** Fastify 4, TypeScript, PostgreSQL via `pg`, Jest/ts-jest, Next.js 14 App Router, React 18.

---

## Skills Used

- `superpowers:writing-plans` was used because this is a multi-step planning task before code changes.
- During execution, use `everything-claude-code:tdd-workflow` or `superpowers:test-driven-development` for each backend module.
- During execution, use `everything-claude-code:backend-patterns` if available in the project-local `.agents/skills` directory, because the work is API/database design heavy.
- Before claiming completion, use `everything-claude-code:verification-loop` or `superpowers:verification-before-completion`.

## Current System Map

### Existing Backend

- `server/src/routes/index.ts` mounts:
  - `GET /health`
  - `GET /api`
  - `GET /api/version`
  - `GET /api/test`
- `server/src/routes/api.ts` registers:
  - `POST /api/api/v1/auth/register`
  - `POST /api/api/v1/auth/login`
  - `POST /api/api/v1/auth/refresh`
  - `POST /api/api/v1/financial/transactions`
  - `GET /api/api/v1/financial/transactions`
  - `GET /api/api/v1/financial/transactions/:id`
  - `PUT /api/api/v1/financial/transactions/:id`
  - `DELETE /api/api/v1/financial/transactions/:id`
  - `GET /api/api/v1/financial/summary`
- Important note: route registration currently double-prefixes API paths because `routes/index.ts` mounts `apiRoutes` at `/api` and `api.ts` registers auth at `/api/v1/auth` plus financial routes at `/api/v1/financial/...`. Keep this behavior initially for compatibility, then normalize to `/api/v1/...` in a dedicated task.
- Existing database coverage:
  - `users`
  - `financial_transactions`
  - `transaction_categories`
  - `analytics_cache`
  - views: `transaction_summary`, `monthly_summary`
- Existing tests cover auth, users, financial transactions, database, Redis, and WebSocket behavior.

### Existing Frontend Data Consumers

- `user/src/app/(user_dashbord)/dashboard/page.tsx`
  - Needs: profile display, summary cards, latest bookkeeping rows, revenue chart, goals.
  - Current state: hardcoded `$0.00` values and empty table.
- `user/src/app/(user_dashbord)/bookkeeping/page.tsx`
  - Uses `user/src/mockData/bookkeepingMockData.ts`.
  - Needs: `summaryData`, `incomeTransactions`, `expenseTransactions`, `generalTransactions`.
- `user/src/app/(user_dashbord)/payroll/page.tsx`
  - Uses `user/src/mockData/payrollMockData.ts`.
  - Needs: outstanding chart, payroll summary, payroll transaction history, previous payroll, upcoming payroll, client.
- `user/src/app/(user_dashbord)/statistics/page.tsx`
  - Uses `user/src/mockData/statisticsMockData.ts`.
  - Needs: overview cards, trends, income sources, expense categories, performance metrics, table rows.
- `user/src/app/(user_dashbord)/documents/page.tsx`
  - Uses `user/src/mockData/documentsMockData.ts`.
  - Needs: folders, documents, stats, upload, preview/download/share/star/delete.
- `user/src/app/(user_dashbord)/business-plan/page.tsx`
  - Uses `user/src/mockData/businessPlanMockData.ts`.
  - Needs: plans, templates, sections, market data, projections, milestones, stats.
- `user/src/app/(user_dashbord)/settings/page.tsx`
  - Uses `user/src/components/user_dashboard/settings/types.ts`.
  - Needs: settings profile, notification, security, language, privacy, backup, integrations, appearance, help.
- `user/src/app/(user_dashbord)/profile-settings/page.tsx`
  - Uses local state for user/company profile fields.
  - Needs: current user, business profile, notification/language/theme preferences.
- `user/src/app/api/login/route.ts` and `user/src/app/api/register/route.ts`
  - Currently return `501`.
  - Should proxy to the Fastify auth endpoints or be removed in favor of direct client API calls.

## Target API Map

Use `/api/v1` as the canonical backend base path. All routes below require a JWT except auth and health.

### Auth And Account

- `POST /api/v1/auth/register`
  - Request: `{ email, password, firstName, lastName }`
  - Response: `{ user, accessToken, refreshToken }`
- `POST /api/v1/auth/login`
  - Request: `{ email, password }`
  - Response: `{ user, accessToken, refreshToken }`
- `POST /api/v1/auth/refresh`
  - Request: `{ refreshToken }`
  - Response: `{ accessToken, refreshToken }`
- `GET /api/v1/me`
  - Response: `{ id, email, firstName, lastName, role, profile, settings }`
- `PATCH /api/v1/me/profile`
  - Request: profile fields from `ProfileSettings`
  - Response: updated profile
- `PATCH /api/v1/me/settings`
  - Request: partial `UserSettings`
  - Response: updated settings

### Dashboard

- `GET /api/v1/dashboard/overview?period=this-month`
  - Response:

```ts
interface DashboardOverviewResponse {
  summaryCards: Array<{
    title: 'Current balance' | 'Expenses' | 'Income';
    amount: string;
    change: string;
    changeType: 'positive' | 'negative';
    period: string;
    description: string;
  }>;
  totalFinancesData: { year: string; months: string[]; highlightValue: string };
  totalSavingsData: { period: string; weeklyData: Array<{ day: string; income: number; expense: number }> };
  totalExpensesData: { period: string; totalAmount: number; segments: Array<{ name: string; percentage: number; color: string }> };
  goalsData: { period: string; goals: Array<{ id: string; name: string; current: number; target: number; color: string }> };
  latestTransactions: Array<{ id: string; date: string; type: string; detail: string; invoice: string | null; price: number; amount: number }>;
}
```

### Bookkeeping

- `GET /api/v1/bookkeeping/overview?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
  - Response matches `BookkeepingPageProps`.
- `POST /api/v1/bookkeeping/transactions`
  - Creates a financial transaction using the existing transaction service.
- `PATCH /api/v1/bookkeeping/transactions/:id`
  - Updates a financial transaction.
- `DELETE /api/v1/bookkeeping/transactions/:id`
  - Deletes a financial transaction.

### Statistics

- `GET /api/v1/statistics/overview?year=2026`
  - Response matches `StatisticsPageProps`.
- Uses existing `monthly_summary`, `transaction_summary`, and `financial_transactions`.
- Performance metrics are derived server-side:
  - revenue growth
  - profit margin
  - cost control
  - average transaction value

### Payroll

- `GET /api/v1/payroll/overview?period=YYYY-MM`
  - Response matches the current `mockQuery` object.
- `GET /api/v1/payroll/transactions?limit=50&offset=0`
- `POST /api/v1/payroll/transactions`
- `PATCH /api/v1/payroll/transactions/:id`
- `DELETE /api/v1/payroll/transactions/:id`

### Documents

- `GET /api/v1/documents?folderId=&category=&type=&search=&sortBy=date&sortOrder=desc`
- `GET /api/v1/documents/stats`
- `POST /api/v1/documents`
  - Multipart upload with metadata fields.
- `PATCH /api/v1/documents/:id`
  - Update tags, folder, share status, starred status, display name.
- `DELETE /api/v1/documents/:id`
- `GET /api/v1/documents/:id/download`
- `GET /api/v1/document-folders`
- `POST /api/v1/document-folders`

### Business Plans

- `GET /api/v1/business-plans`
- `GET /api/v1/business-plans/stats`
- `GET /api/v1/business-plans/templates`
- `POST /api/v1/business-plans`
- `GET /api/v1/business-plans/:id`
- `PATCH /api/v1/business-plans/:id`
- `DELETE /api/v1/business-plans/:id`
- `POST /api/v1/business-plans/:id/duplicate`
- `PATCH /api/v1/business-plans/:id/share`
- `PATCH /api/v1/business-plans/:planId/sections/:sectionId`
- `GET /api/v1/business-plans/market-data`
- `GET /api/v1/business-plans/financial-projections`
- `GET /api/v1/business-plans/milestones`

## Proposed Backend File Structure

Create these modules:

- `server/src/modules/profile/profile.types.ts`
- `server/src/modules/profile/profile.repository.ts`
- `server/src/modules/profile/profile.service.ts`
- `server/src/modules/profile/profile.controller.ts`
- `server/src/modules/profile/profile.routes.ts`
- `server/src/modules/dashboard/dashboard.types.ts`
- `server/src/modules/dashboard/dashboard.repository.ts`
- `server/src/modules/dashboard/dashboard.service.ts`
- `server/src/modules/dashboard/dashboard.controller.ts`
- `server/src/modules/dashboard/dashboard.routes.ts`
- `server/src/modules/bookkeeping/bookkeeping.types.ts`
- `server/src/modules/bookkeeping/bookkeeping.service.ts`
- `server/src/modules/bookkeeping/bookkeeping.controller.ts`
- `server/src/modules/bookkeeping/bookkeeping.routes.ts`
- `server/src/modules/statistics/statistics.types.ts`
- `server/src/modules/statistics/statistics.repository.ts`
- `server/src/modules/statistics/statistics.service.ts`
- `server/src/modules/statistics/statistics.controller.ts`
- `server/src/modules/statistics/statistics.routes.ts`
- `server/src/modules/payroll/payroll.types.ts`
- `server/src/modules/payroll/payroll.repository.ts`
- `server/src/modules/payroll/payroll.service.ts`
- `server/src/modules/payroll/payroll.controller.ts`
- `server/src/modules/payroll/payroll.routes.ts`
- `server/src/modules/documents/document.types.ts`
- `server/src/modules/documents/document.repository.ts`
- `server/src/modules/documents/document.service.ts`
- `server/src/modules/documents/document.controller.ts`
- `server/src/modules/documents/document.routes.ts`
- `server/src/modules/business-plans/business-plan.types.ts`
- `server/src/modules/business-plans/business-plan.repository.ts`
- `server/src/modules/business-plans/business-plan.service.ts`
- `server/src/modules/business-plans/business-plan.controller.ts`
- `server/src/modules/business-plans/business-plan.routes.ts`
- `server/src/modules/shared/authenticate.ts`
- `server/src/modules/shared/formatters.ts`
- `server/src/modules/shared/date-range.ts`
- `server/src/modules/shared/api-response.ts`
- `server/src/modules/shared/schema.sql`

Modify these existing files:

- `server/src/routes/api.ts`
- `server/src/modules/users/types.ts`
- `server/src/modules/users/schema.sql`
- `server/api-docs/openapi.yaml`
- `server/api-docs/openapi.json`
- `user/src/app/api/login/route.ts`
- `user/src/app/api/register/route.ts`
- `user/src/app/(user_dashbord)/dashboard/page.tsx`
- `user/src/app/(user_dashbord)/bookkeeping/page.tsx`
- `user/src/app/(user_dashbord)/payroll/page.tsx`
- `user/src/app/(user_dashbord)/statistics/page.tsx`
- `user/src/app/(user_dashbord)/documents/page.tsx`
- `user/src/app/(user_dashbord)/business-plan/page.tsx`
- `user/src/app/(user_dashbord)/settings/page.tsx`
- `user/src/app/(user_dashbord)/profile-settings/page.tsx`

Create frontend API helpers:

- `user/src/lib/api/client.ts`
- `user/src/lib/api/auth.ts`
- `user/src/lib/api/dashboard.ts`
- `user/src/lib/api/bookkeeping.ts`
- `user/src/lib/api/payroll.ts`
- `user/src/lib/api/statistics.ts`
- `user/src/lib/api/documents.ts`
- `user/src/lib/api/business-plans.ts`
- `user/src/lib/api/settings.ts`

## Database Map

### Extend Users

Keep `users` for auth identity. Add related tables rather than stuffing everything into `users`.

```sql
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avatar TEXT,
  phone VARCHAR(50),
  job_title VARCHAR(120),
  company VARCHAR(160),
  industry VARCHAR(120),
  bio TEXT,
  address JSONB NOT NULL DEFAULT '{}',
  social_links JSONB NOT NULL DEFAULT '[]',
  company_email VARCHAR(255),
  linkedin TEXT,
  date_of_incorporation DATE,
  country VARCHAR(120),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notifications JSONB NOT NULL DEFAULT '{}',
  security JSONB NOT NULL DEFAULT '{}',
  language JSONB NOT NULL DEFAULT '{}',
  privacy JSONB NOT NULL DEFAULT '{}',
  backup JSONB NOT NULL DEFAULT '{}',
  integrations JSONB NOT NULL DEFAULT '{}',
  appearance JSONB NOT NULL DEFAULT '{}',
  help JSONB NOT NULL DEFAULT '{}',
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Goals

```sql
CREATE TABLE IF NOT EXISTS user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  current_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  target_amount DECIMAL(12,2) NOT NULL CHECK (target_amount > 0),
  color VARCHAR(40) NOT NULL DEFAULT 'bg-blue-600',
  period VARCHAR(40) NOT NULL DEFAULT 'This month',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Payroll

```sql
CREATE TABLE IF NOT EXISTS payroll_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  company VARCHAR(160),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES payroll_clients(id) ON DELETE SET NULL,
  employee_name VARCHAR(160) NOT NULL,
  company VARCHAR(160),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  transaction_date DATE NOT NULL,
  transaction_time TIME,
  invoice_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('completed', 'pending', 'failed')),
  avatar_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_transactions_user_date ON payroll_transactions(user_id, transaction_date DESC);
```

### Documents

```sql
CREATE TABLE IF NOT EXISTS document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  parent_id UUID REFERENCES document_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES document_folders(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  document_type VARCHAR(60) NOT NULL,
  category VARCHAR(60) NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  storage_key TEXT NOT NULL,
  public_url TEXT,
  thumbnail_url TEXT,
  author VARCHAR(160) NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]',
  share_status VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (share_status IN ('private', 'shared', 'public')),
  shared_with JSONB NOT NULL DEFAULT '[]',
  starred BOOLEAN NOT NULL DEFAULT false,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_folder ON documents(user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_type ON documents(user_id, document_type);
CREATE INDEX IF NOT EXISTS idx_documents_user_category ON documents(user_id, category);
```

### Business Plans

```sql
CREATE TABLE IF NOT EXISTS business_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  template VARCHAR(120) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Draft',
  description TEXT NOT NULL DEFAULT '',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  share_status VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (share_status IN ('private', 'shared', 'public')),
  shared_with JSONB NOT NULL DEFAULT '[]',
  target_audience TEXT NOT NULL DEFAULT '',
  industry VARCHAR(160) NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_plan_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,
  section_type VARCHAR(120) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  word_count INTEGER NOT NULL DEFAULT 0,
  template_content TEXT,
  guidance JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_plan_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  target_date DATE NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  category VARCHAR(40) NOT NULL CHECK (category IN ('product', 'marketing', 'financial', 'operational')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_plan_financial_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  revenue DECIMAL(14,2) NOT NULL DEFAULT 0,
  expenses DECIMAL(14,2) NOT NULL DEFAULT 0,
  profit DECIMAL(14,2) NOT NULL DEFAULT 0,
  profit_margin DECIMAL(6,2) NOT NULL DEFAULT 0,
  growth_rate DECIMAL(6,2) NOT NULL DEFAULT 0,
  employees INTEGER NOT NULL DEFAULT 0,
  customer_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, year)
);
```

## Implementation Tasks

### Task 1: Normalize Shared Authentication

**Files:**
- Create: `server/src/modules/shared/authenticate.ts`
- Modify: `server/src/routes/api.ts`
- Test: `server/tests/modules/shared/authenticate.test.ts`

- [ ] **Step 1: Write the failing auth hook test**

```ts
import { FastifyReply, FastifyRequest } from 'fastify';
import { authenticate } from '../../../src/modules/shared/authenticate';

describe('authenticate', () => {
  it('sends 401 when jwt verification fails', async () => {
    const request = { jwtVerify: jest.fn().mockRejectedValue(new Error('bad token')) } as unknown as FastifyRequest;
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const reply = { status } as unknown as FastifyReply;

    await authenticate(request, reply);

    expect(status).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith({ success: false, error: 'Authentication required' });
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `cd server; pnpm test -- tests/modules/shared/authenticate.test.ts`

Expected: FAIL because `server/src/modules/shared/authenticate.ts` does not exist.

- [ ] **Step 3: Implement the shared hook**

```ts
import { FastifyReply, FastifyRequest } from 'fastify';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({
      success: false,
      error: 'Authentication required'
    });
  }
}
```

- [ ] **Step 4: Replace local transaction auth hook**

In `server/src/modules/financial/transaction.routes.ts`, import and use the shared hook:

```ts
import { authenticate } from '../shared/authenticate';
```

Remove the local `authenticate` constant from that file.

- [ ] **Step 5: Verify**

Run: `cd server; pnpm test -- tests/modules/shared/authenticate.test.ts tests/modules/financial/transaction.controller.test.ts`

Expected: PASS.

### Task 2: Add Profile And Settings API

**Files:**
- Create: `server/src/modules/profile/profile.types.ts`
- Create: `server/src/modules/profile/profile.repository.ts`
- Create: `server/src/modules/profile/profile.service.ts`
- Create: `server/src/modules/profile/profile.controller.ts`
- Create: `server/src/modules/profile/profile.routes.ts`
- Modify: `server/src/modules/users/schema.sql`
- Modify: `server/src/routes/api.ts`
- Test: `server/tests/modules/profile/profile.service.test.ts`

- [ ] **Step 1: Write profile service tests**

```ts
import { ProfileService } from '../../../src/modules/profile/profile.service';

describe('ProfileService', () => {
  const repository = {
    getMe: jest.fn(),
    updateProfile: jest.fn(),
    updateSettings: jest.fn()
  };

  beforeEach(() => jest.clearAllMocks());

  it('returns account, profile, and settings for current user', async () => {
    repository.getMe.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'user',
      profile: { company: 'Analytical Engines' },
      settings: { language: { language: 'en' } }
    });

    const service = new ProfileService(repository as any);
    const result = await service.getMe('user-1');

    expect(result.email).toBe('a@example.com');
    expect(result.profile.company).toBe('Analytical Engines');
  });

  it('rejects invalid notification frequency', async () => {
    const service = new ProfileService(repository as any);

    await expect(service.updateSettings('user-1', {
      notifications: { frequency: 'every-second' }
    } as any)).rejects.toThrow('Invalid notification frequency');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `cd server; pnpm test -- tests/modules/profile/profile.service.test.ts`

Expected: FAIL because the profile module does not exist.

- [ ] **Step 3: Implement profile types**

Create `server/src/modules/profile/profile.types.ts` with:

```ts
export interface UserProfile {
  avatar?: string;
  phone?: string;
  jobTitle?: string;
  company?: string;
  industry?: string;
  bio?: string;
  address?: Record<string, string>;
  socialLinks?: Array<{ platform: string; url: string; visible: boolean }>;
  companyEmail?: string;
  linkedin?: string;
  dateOfIncorporation?: string;
  country?: string;
}

export interface UserSettingsPayload {
  notifications?: Record<string, any>;
  security?: Record<string, any>;
  language?: Record<string, any>;
  privacy?: Record<string, any>;
  backup?: Record<string, any>;
  integrations?: Record<string, any>;
  appearance?: Record<string, any>;
  help?: Record<string, any>;
}

export interface CurrentUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  profile: UserProfile;
  settings: UserSettingsPayload;
}
```

- [ ] **Step 4: Implement service validation**

Create `server/src/modules/profile/profile.service.ts`:

```ts
import { UserProfile, UserSettingsPayload } from './profile.types';

export class ProfileService {
  constructor(private repository: {
    getMe(userId: string): Promise<any>;
    updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile>;
    updateSettings(userId: string, data: UserSettingsPayload): Promise<UserSettingsPayload>;
  }) {}

  async getMe(userId: string) {
    return this.repository.getMe(userId);
  }

  async updateProfile(userId: string, data: Partial<UserProfile>) {
    if (data.companyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.companyEmail)) {
      throw new Error('Invalid company email');
    }
    return this.repository.updateProfile(userId, data);
  }

  async updateSettings(userId: string, data: UserSettingsPayload) {
    const frequency = data.notifications?.frequency;
    if (frequency && !['immediate', 'hourly', 'daily', 'weekly'].includes(frequency)) {
      throw new Error('Invalid notification frequency');
    }
    return this.repository.updateSettings(userId, data);
  }
}
```

- [ ] **Step 5: Implement repository/controller/routes following existing auth and transaction patterns**

Use `UserRepository.findById(userId)` for base identity. Upsert `user_profiles` and `user_settings` records by `user_id`. Register:

```ts
fastify.get('/v1/me', { preHandler: [authenticate] }, controller.getMe.bind(controller));
fastify.patch('/v1/me/profile', { preHandler: [authenticate] }, controller.updateProfile.bind(controller));
fastify.patch('/v1/me/settings', { preHandler: [authenticate] }, controller.updateSettings.bind(controller));
```

- [ ] **Step 6: Verify**

Run: `cd server; pnpm test -- tests/modules/profile/profile.service.test.ts`

Expected: PASS.

### Task 3: Add Dashboard Overview Aggregation

**Files:**
- Create: `server/src/modules/dashboard/dashboard.types.ts`
- Create: `server/src/modules/dashboard/dashboard.repository.ts`
- Create: `server/src/modules/dashboard/dashboard.service.ts`
- Create: `server/src/modules/dashboard/dashboard.controller.ts`
- Create: `server/src/modules/dashboard/dashboard.routes.ts`
- Modify: `server/src/routes/api.ts`
- Test: `server/tests/modules/dashboard/dashboard.service.test.ts`

- [ ] **Step 1: Write dashboard service tests**

```ts
import { DashboardService } from '../../../src/modules/dashboard/dashboard.service';

describe('DashboardService', () => {
  it('builds overview cards from financial aggregates', async () => {
    const repository = {
      getSummary: jest.fn().mockResolvedValue({ totalIncome: '10000.00', totalExpenses: '1980.56', netIncome: '8019.44', transactionCount: 8 }),
      getPreviousSummary: jest.fn().mockResolvedValue({ totalIncome: '9000.00', totalExpenses: '2100.00', netIncome: '6900.00', transactionCount: 6 }),
      getWeeklyTrend: jest.fn().mockResolvedValue([{ day: 'Mo', income: 300, expense: 150 }]),
      getExpenseSegments: jest.fn().mockResolvedValue([{ name: 'Goods', percentage: 100, color: '#1e1b4b' }]),
      getGoals: jest.fn().mockResolvedValue([]),
      getLatestTransactions: jest.fn().mockResolvedValue([])
    };

    const service = new DashboardService(repository as any);
    const result = await service.getOverview('user-1', '2026-05-01', '2026-05-31');

    expect(result.summaryCards[0].title).toBe('Current balance');
    expect(result.summaryCards[0].amount).toBe('$8,019.44');
    expect(result.totalSavingsData.weeklyData[0].day).toBe('Mo');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `cd server; pnpm test -- tests/modules/dashboard/dashboard.service.test.ts`

Expected: FAIL because the dashboard module does not exist.

- [ ] **Step 3: Implement service mapping**

Create a service that converts raw transaction aggregates into the exact shapes used by `dashboardMockData.ts`. Use `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` for strings.

- [ ] **Step 4: Implement repository queries**

Use `financial_transactions` for summary, weekly trend, expense segments, and latest transactions. Use `user_goals` for goals.

- [ ] **Step 5: Register route**

Register:

```ts
fastify.get('/v1/dashboard/overview', { preHandler: [authenticate] }, controller.getOverview.bind(controller));
```

- [ ] **Step 6: Verify**

Run: `cd server; pnpm test -- tests/modules/dashboard/dashboard.service.test.ts`

Expected: PASS.

### Task 4: Add Bookkeeping API Facade

**Files:**
- Create: `server/src/modules/bookkeeping/bookkeeping.types.ts`
- Create: `server/src/modules/bookkeeping/bookkeeping.service.ts`
- Create: `server/src/modules/bookkeeping/bookkeeping.controller.ts`
- Create: `server/src/modules/bookkeeping/bookkeeping.routes.ts`
- Modify: `server/src/routes/api.ts`
- Test: `server/tests/modules/bookkeeping/bookkeeping.service.test.ts`

- [ ] **Step 1: Write bookkeeping mapping test**

```ts
import { BookkeepingService } from '../../../src/modules/bookkeeping/bookkeeping.service';

describe('BookkeepingService', () => {
  it('splits transactions into income, expense, and general buckets', async () => {
    const transactionService = {
      getFinancialSummary: jest.fn().mockResolvedValue({ totalIncome: '85000.00', totalExpenses: '10000.00', netIncome: '75000.00' }),
      getUserTransactions: jest.fn().mockResolvedValue({
        transactions: [
          { id: '1', date: '2026-05-01', type: 'income', category: 'Sale', description: 'Amazon bookstore payment', invoice: 'UI8-8934AS', amount: '88.20' },
          { id: '2', date: '2026-05-13', type: 'expense', category: 'Rent', description: 'Office rent', invoice: 'UI8-8934AS', amount: '98.00' }
        ],
        totalCount: 2,
        hasMore: false,
        filters: {}
      })
    };

    const service = new BookkeepingService(transactionService as any);
    const result = await service.getOverview('user-1', '2026-05-01', '2026-05-31');

    expect(result.summaryData.balance).toBe(75000);
    expect(result.incomeTransactions[0].type).toBe('Sale');
    expect(result.expenseTransactions[0].type).toBe('Rent');
  });
});
```

- [ ] **Step 2: Implement the facade**

The bookkeeping service should call `TransactionService` instead of duplicating transaction business rules.

- [ ] **Step 3: Register routes**

Register:

```ts
fastify.get('/v1/bookkeeping/overview', { preHandler: [authenticate] }, controller.getOverview.bind(controller));
fastify.post('/v1/bookkeeping/transactions', { preHandler: [authenticate] }, controller.createTransaction.bind(controller));
fastify.patch('/v1/bookkeeping/transactions/:id', { preHandler: [authenticate] }, controller.updateTransaction.bind(controller));
fastify.delete('/v1/bookkeeping/transactions/:id', { preHandler: [authenticate] }, controller.deleteTransaction.bind(controller));
```

- [ ] **Step 4: Verify**

Run: `cd server; pnpm test -- tests/modules/bookkeeping/bookkeeping.service.test.ts tests/modules/financial/transaction.service.test.ts`

Expected: PASS.

### Task 5: Add Statistics API

**Files:**
- Create: `server/src/modules/statistics/statistics.types.ts`
- Create: `server/src/modules/statistics/statistics.repository.ts`
- Create: `server/src/modules/statistics/statistics.service.ts`
- Create: `server/src/modules/statistics/statistics.controller.ts`
- Create: `server/src/modules/statistics/statistics.routes.ts`
- Modify: `server/src/routes/api.ts`
- Test: `server/tests/modules/statistics/statistics.service.test.ts`

- [ ] **Step 1: Write statistics service tests**

```ts
import { StatisticsService } from '../../../src/modules/statistics/statistics.service';

describe('StatisticsService', () => {
  it('returns statistics overview shaped for the statistics page', async () => {
    const repository = {
      getMonthlyRows: jest.fn().mockResolvedValue([
        { month: '2026-01', income: 8500, expenses: 6200, transactions: 35 },
        { month: '2026-02', income: 9200, expenses: 7100, transactions: 42 }
      ]),
      getCategoryBreakdown: jest.fn().mockResolvedValue({
        incomeSources: [{ name: 'Sales', value: 45000, percentage: 70, color: '#150578', change: 12.5 }],
        expenseCategories: [{ name: 'Operations', value: 28000, percentage: 60, color: '#ff8600', change: 8.1 }]
      })
    };

    const service = new StatisticsService(repository as any);
    const result = await service.getOverview('user-1', 2026);

    expect(result.period).toBe('2026');
    expect(result.overviewCards.some(card => card.title === 'Total Revenue')).toBe(true);
    expect(result.financialTrends[0].profit).toBe(2300);
  });
});
```

- [ ] **Step 2: Implement monthly and category queries**

Use `monthly_summary` and `transaction_summary`. Fill months with zero values when no transaction exists for a month.

- [ ] **Step 3: Register route**

```ts
fastify.get('/v1/statistics/overview', { preHandler: [authenticate] }, controller.getOverview.bind(controller));
```

- [ ] **Step 4: Verify**

Run: `cd server; pnpm test -- tests/modules/statistics/statistics.service.test.ts`

Expected: PASS.

### Task 6: Add Payroll API

**Files:**
- Create: `server/src/modules/payroll/payroll.types.ts`
- Create: `server/src/modules/payroll/payroll.repository.ts`
- Create: `server/src/modules/payroll/payroll.service.ts`
- Create: `server/src/modules/payroll/payroll.controller.ts`
- Create: `server/src/modules/payroll/payroll.routes.ts`
- Create: `server/src/modules/payroll/schema.sql`
- Modify: `server/src/routes/api.ts`
- Test: `server/tests/modules/payroll/payroll.service.test.ts`

- [ ] **Step 1: Write payroll overview test**

```ts
import { PayrollService } from '../../../src/modules/payroll/payroll.service';

describe('PayrollService', () => {
  it('builds payroll overview for the payroll page', async () => {
    const repository = {
      getTransactions: jest.fn().mockResolvedValue([{ id: '1', employeeName: 'Mickey Mike', amount: 1546.12, status: 'completed' }]),
      getSummary: jest.fn().mockResolvedValue({ payment: 201.54, pending: 57.13, paid: 407.10, completionPercentage: 45 }),
      getOutstandingSeries: jest.fn().mockResolvedValue([{ date: '2026-05-15', value: 4251, label: 'May 15', highlighted: true }]),
      getClient: jest.fn().mockResolvedValue({ name: 'John Mike', company: 'Apple Inc.', avatarUrl: '/images/avatars/john-mike-avatar.svg' })
    };

    const service = new PayrollService(repository as any);
    const result = await service.getOverview('user-1', '2026-05');

    expect(result.payrollSummary.payment).toBe(201.54);
    expect(result.transactions[0].employeeName).toBe('Mickey Mike');
  });
});
```

- [ ] **Step 2: Implement schema, repository, service, controller, and routes**

Use the payroll SQL from the database map. Return statuses in uppercase to match the current frontend enum.

- [ ] **Step 3: Verify**

Run: `cd server; pnpm test -- tests/modules/payroll/payroll.service.test.ts`

Expected: PASS.

### Task 7: Add Documents API

**Files:**
- Create: `server/src/modules/documents/document.types.ts`
- Create: `server/src/modules/documents/document.repository.ts`
- Create: `server/src/modules/documents/document.service.ts`
- Create: `server/src/modules/documents/document.controller.ts`
- Create: `server/src/modules/documents/document.routes.ts`
- Create: `server/src/modules/documents/schema.sql`
- Modify: `server/src/routes/api.ts`
- Test: `server/tests/modules/documents/document.service.test.ts`

- [ ] **Step 1: Write documents stats test**

```ts
import { DocumentService } from '../../../src/modules/documents/document.service';

describe('DocumentService', () => {
  it('calculates document stats from document rows', async () => {
    const repository = {
      listDocuments: jest.fn().mockResolvedValue([
        { id: 'doc-1', type: 'Report', category: 'Financial', size: 1024, starred: true, shareStatus: 'Private', uploadDate: new Date() },
        { id: 'doc-2', type: 'Contract', category: 'Legal', size: 2048, starred: false, shareStatus: 'Shared', uploadDate: new Date() }
      ])
    };

    const service = new DocumentService(repository as any);
    const stats = await service.getStats('user-1');

    expect(stats.totalDocuments).toBe(2);
    expect(stats.totalSize).toBe(3072);
    expect(stats.starredDocuments).toBe(1);
    expect(stats.sharedDocuments).toBe(1);
  });
});
```

- [ ] **Step 2: Implement file metadata first**

Store metadata in PostgreSQL. Store uploaded bytes under a configured local directory such as `server/uploads` during development. Keep storage swappable by isolating file writes in the service.

- [ ] **Step 3: Register routes**

Register document and folder routes listed in the target API map.

- [ ] **Step 4: Verify**

Run: `cd server; pnpm test -- tests/modules/documents/document.service.test.ts`

Expected: PASS.

### Task 8: Add Business Plans API

**Files:**
- Create: `server/src/modules/business-plans/business-plan.types.ts`
- Create: `server/src/modules/business-plans/business-plan.repository.ts`
- Create: `server/src/modules/business-plans/business-plan.service.ts`
- Create: `server/src/modules/business-plans/business-plan.controller.ts`
- Create: `server/src/modules/business-plans/business-plan.routes.ts`
- Create: `server/src/modules/business-plans/schema.sql`
- Modify: `server/src/routes/api.ts`
- Test: `server/tests/modules/business-plans/business-plan.service.test.ts`

- [ ] **Step 1: Write business plan duplication test**

```ts
import { BusinessPlanService } from '../../../src/modules/business-plans/business-plan.service';

describe('BusinessPlanService', () => {
  it('duplicates a plan as a draft copy', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({ id: 'plan-1', title: 'Expansion Plan', sections: [{ title: 'Executive Summary' }] }),
      duplicate: jest.fn().mockResolvedValue({ id: 'plan-2', title: 'Expansion Plan (Copy)', status: 'Draft' })
    };

    const service = new BusinessPlanService(repository as any);
    const result = await service.duplicate('user-1', 'plan-1');

    expect(result.title).toBe('Expansion Plan (Copy)');
    expect(result.status).toBe('Draft');
  });
});
```

- [ ] **Step 2: Implement CRUD, sections, templates, stats, projections, and milestones**

Store templates as constants in service code first. Persist user-created plans, sections, projections, and milestones in PostgreSQL.

- [ ] **Step 3: Register routes**

Register all routes listed in the business plans target API map.

- [ ] **Step 4: Verify**

Run: `cd server; pnpm test -- tests/modules/business-plans/business-plan.service.test.ts`

Expected: PASS.

### Task 9: Add Frontend API Client And Auth Proxy

**Files:**
- Create: `user/src/lib/api/client.ts`
- Create: `user/src/lib/api/auth.ts`
- Modify: `user/src/app/api/login/route.ts`
- Modify: `user/src/app/api/register/route.ts`
- Test manually with `pnpm dev`.

- [ ] **Step 1: Create the shared client**

```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/v1';

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Request failed');
  }

  return data as T;
}
```

- [ ] **Step 2: Proxy login and register**

Make `user/src/app/api/login/route.ts` call `apiRequest('/auth/login', ...)`.
Make `user/src/app/api/register/route.ts` call `apiRequest('/auth/register', ...)`.

- [ ] **Step 3: Verify**

Run: `cd user; pnpm dev`

Expected: Next.js starts and `/api/login` no longer returns `501` when posted valid JSON while the backend is running.

### Task 10: Replace Mock Data Screen By Screen

**Files:**
- Modify all dashboard route files under `user/src/app/(user_dashbord)`
- Create domain API helper files under `user/src/lib/api`

- [ ] **Step 1: Dashboard**

Replace hardcoded summary cards and empty table in `dashboard/page.tsx` with `GET /dashboard/overview`.

- [ ] **Step 2: Bookkeeping**

Replace `mockRootProps` in `bookkeeping/page.tsx` with `GET /bookkeeping/overview`.

- [ ] **Step 3: Statistics**

Replace `statisticsMockData` in `statistics/page.tsx` with `GET /statistics/overview`.

- [ ] **Step 4: Payroll**

Replace `mockQuery` in `payroll/page.tsx` with `GET /payroll/overview`.

- [ ] **Step 5: Documents**

Replace `mockDocumentsPageProps` with `GET /documents`, `GET /document-folders`, and `GET /documents/stats`.

- [ ] **Step 6: Business Plans**

Replace `mockBusinessPlanPageProps` with business plan API calls.

- [ ] **Step 7: Settings/Profile**

Replace local settings/profile initial values with `GET /me`, and save with `PATCH /me/profile` and `PATCH /me/settings`.

### Task 11: API Docs And Integration Verification

**Files:**
- Modify: `server/api-docs/openapi.yaml`
- Modify: `server/api-docs/openapi.json`
- Add: `server/tests/integration/user-dashboard.integration.test.ts`

- [ ] **Step 1: Add OpenAPI paths**

Document auth, me, dashboard, bookkeeping, statistics, payroll, documents, and business plans.

- [ ] **Step 2: Add integration test**

Create a test that registers a user, logs in, creates transactions, then calls:

```ts
[
  '/api/v1/me',
  '/api/v1/dashboard/overview',
  '/api/v1/bookkeeping/overview',
  '/api/v1/statistics/overview'
]
```

Assert every response has `success !== false` and returns the key fields expected by the frontend.

- [ ] **Step 3: Run backend verification**

Run:

```bash
cd server
pnpm test
pnpm build
```

Expected: PASS.

- [ ] **Step 4: Run frontend verification**

Run:

```bash
cd user
pnpm build
```

Expected: PASS.

## Execution Order

1. Normalize auth and route base paths.
2. Add profile/settings because every screen needs current user context.
3. Add dashboard, bookkeeping, and statistics using existing financial data.
4. Add payroll.
5. Add documents.
6. Add business plans.
7. Wire the frontend screen by screen.
8. Update OpenAPI and run full verification.

## Scope Notes

- Do not remove mock data files until each screen has a working API-backed path.
- Keep response shapes close to existing frontend props first, then refactor frontend types later.
- Use existing `financial_transactions` for bookkeeping and statistics to avoid duplicate money records.
- Use separate tables for payroll because payroll entries represent payables/payments with employee/client-specific metadata.
- Use separate tables for documents because upload, folder, share, and file metadata do not belong in transactions.
- Use separate tables for business plans because sections, projections, and milestones are document-like workflow data.

## Self-Review

- Spec coverage: the plan maps the existing `user` dashboard pages, mock data files, auth proxies, and server modules to concrete API resources.
- Placeholder scan: no task depends on an undefined "later" implementation; every module has files, routes, tests, and verification commands.
- Type consistency: the planned response names mirror the current frontend mock interfaces where possible, while backend storage uses normalized snake_case SQL and camelCase API responses.
