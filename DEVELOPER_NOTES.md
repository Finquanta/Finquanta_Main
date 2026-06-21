# Finquanta — Developer Notes

A running log of recent work so any developer can get up to speed quickly.
Last updated: 2026-06-21.

---

## 1. Architecture & deployment topology

| Part | Stack | Hosted on | Notes |
|------|-------|-----------|-------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind | **Vercel** (`finquanta-main.vercel.app`) | Root dir = `user/`. **Uses pnpm** (`user/pnpm-lock.yaml`). |
| Backend | Fastify 5, pg, JWT | **Render** (`finquanta-main-2.onrender.com`) | Free tier — **sleeps after ~15 min idle** (20–50s cold start). |
| Database | Postgres | **Neon** | Schema auto-created at boot via `CREATE TABLE IF NOT EXISTS` / `ALTER ... ADD COLUMN IF NOT EXISTS` in `server/src/routes/api.ts` (the `*.sql` files are not auto-run). |

- Everything deploys from **`main`**; a push auto-deploys both Vercel and Render.
- Frontend talks to the backend via `NEXT_PUBLIC_API_URL` (set in `user/.env.local` locally and in Vercel for prod) = the Render URL **with `/api`**. The frontend hits Render even when run locally; the local `server/.env` is not used by the deployed app.
- Backend response envelope: `{ success: true, data }`. The frontend `apiFetch` (`user/src/lib/api/client.ts`) unwraps it centrally.
- Auth: JWT access token in `localStorage.accessToken`; `apiFetch` attaches `Authorization: Bearer` + `X-Business-Id` (active workspace). **The JWT payload only has `userId` + `email` — no role**; role checks must hit the DB.

### Local typecheck gotcha (backend)
Render builds with TS 6.0.3 (`tsconfig.json` pins `ignoreDeprecations: "6.0"`); local `node_modules` has TS 5.9.x. To typecheck locally:
```bash
cd server
cat > tsconfig.check.json <<'EOF'
{ "extends": "./tsconfig.json", "compilerOptions": { "ignoreDeprecations": "5.0", "noEmit": true } }
EOF
npx tsc -p tsconfig.check.json ; rm tsconfig.check.json
```
Frontend: `cd user && npx tsc --noEmit`.

### pnpm lockfile (Vercel)
Vercel runs `pnpm install --frozen-lockfile`. **Any dependency change must regenerate `user/pnpm-lock.yaml`** or the deploy fails in ~5s:
```bash
cd user && corepack pnpm@9 install --lockfile-only
```
(`package-lock.json` / `.npmrc` are for npm and are NOT what Vercel reads.)

---

## 2. Required environment variables

**Vercel (frontend):**
- `NEXT_PUBLIC_API_URL` = `https://finquanta-main-2.onrender.com/api`
- `ANTHROPIC_API_KEY` = `sk-ant-...` (Finna chat). Add it, then **redeploy** (env vars only apply to new deploys).

**Render (backend):**
- `DATABASE_URL` (Neon), `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `CORS_ORIGIN` = comma-separated allowed origins (must include the Vercel URL; add `http://localhost:3000` for local).
- `ADMIN_EMAILS` = comma-separated emails to auto-promote to `admin` on boot (see Admin Panel below).
- `ANTHROPIC_MODEL` (optional) — overrides Finna's model.

---

## 3. Finna (AI assistant)

- Route: `user/src/app/api/chat/route.ts` (Next.js serverless, runs on Vercel).
- Uses the official `@anthropic-ai/sdk`. **Default model `claude-haiku-4-5`** (cheapest tier; override with `ANTHROPIC_MODEL`).
- The Anthropic client is constructed **lazily inside the POST handler** (after the API-key guard) — constructing it at module scope throws without a key and crashes the Vercel build.
- Finna is currently **basic / not personalized**. Planned: feed the user's `business_profiles` record (onboarding answers) into the system prompt so suggestions/decisions are tailored. Deferred until "the AI is released."

---

## 4. Multi-business (workspaces)

- Tables: `businesses`, `business_members`, `business_invites` (auto-migrated; every user gets a default business as `Owner`).
- Per-business data isolation: `financial_transactions`, `user_goals`, `reminders` have a `business_id` column (backfilled). The `withBusiness` preHandler sets `request.businessId` from the `X-Business-Id` header (validated) or the user's default business.
- Endpoints (`server/src/modules/businesses/`): list/create businesses, **rename** (`PATCH /v1/businesses/:id`, Owner/Admin), members, invites (create/accept, optional bcrypt password, 14-day expiry), remove member.
- Frontend: `WorkspaceSwitcher.tsx` (top-bar dropdown — switch / create / rename / invite) and `/join/[token]` accept page.
- Per-business roles: `Owner, Admin, Accountant, Bookkeeper, Manager, Viewer, Other` — **distinct from the site-level user role** (`user` / `admin` / `super_admin`).

---

## 5. Onboarding & profiles

- **Two distinct stores:**
  - `business_profiles` — onboarding answers (business name, type, industry, niche, entity/structure, **country**, **incorporation_location**, maturity stage, revenue range, employee count, financial goals, `onboarding_completed`). API: `GET/PUT /v1/me/business`.
  - `user_profiles` — the personal/company profile (company, industry, country, date_of_incorporation, linkedin, …). Edited in the **top section** of Profile Settings — note that section is still a **static mockup that does not save** (TODO).
- **Onboarding flow** (`user/src/app/onboarding/page.tsx`): one-question-at-a-time wizard (Airtable/Typeform style), centered, progress bar, Back/Continue, Enter-to-advance, tappable option cards.
- **Onboarding resume:** the dashboard redirects to `/onboarding` if `onboarding_completed` is false, unless the user clicked "Skip for now" this session (`sessionStorage.onboardingSkipped`). So unfinished onboarding keeps prompting on each new login.
- **Business Profile section** in Profile Settings (`profile-settings/page.tsx`) loads & saves the `business_profiles` record (fully wired, unlike the legacy top section).

---

## 6. Internationalization (i18n)

- `user/src/hooks/context/LanguageContext.tsx` — 10 languages (en, nl, de, fr, es, pt, ar, zh, ja, ru). `t(section, key)` falls back to English, then to `section.key`.
- Extra strings are merged into namespaces via objects + a `for` loop: `dashboardExtra`, `dashboardPeriods`, **`onboardingStrings`** (namespace `onboarding`), **`settingsExtra`** (merged into `settings`).
- The onboarding wizard and Business Profile section are fully translated across all 10 languages. **Not translated:** dropdown option *values* (e.g. "LLC", revenue ranges — they're stored data) and example placeholders, and of course user-typed content.
- When adding new UI text, add a key to the relevant namespace (with at least English) and use `t()` — don't hardcode strings.

---

## 7. Admin panel  ← newest

- **Backend** (`server/src/modules/admin/`):
  - `AdminRepository.listUsers()` — all users joined with their `business_profiles` (name, email, role, joined date, company, country, industry).
  - `AdminRepository.ensureAdmins(emails)` — promotes `ADMIN_EMAILS` to `role='admin'` at boot (idempotent; never demotes).
  - `admin.routes.ts` — `requireAdmin` guard looks up the DB role (JWT has none) and allows only `admin`/`super_admin`. Endpoints: `GET /v1/admin/users`, `GET /v1/admin/me`. Registered in `api.ts`.
- **Frontend** (`user/src/app/(admin)/`):
  - `admin-login` — real login via `/api/login`, then checks `user.role` is admin/super_admin (rejects everyone else). Stores tokens so `apiFetch` is authenticated.
  - `admin-users` — fetches `GET /v1/admin/users` (live data, replacing the old hardcoded `MOCK_USERS`), with search, light/dark, logout. Redirects non-admins to `/admin-login`.
  - API helper: `user/src/lib/api/admin.ts`.
- **How to make someone an admin:**
  1. They sign up normally (creates the user row).
  2. Add their email to **`ADMIN_EMAILS`** in Render env (comma-separated), and redeploy/restart so the boot bootstrap promotes them.
  3. They log in at **`/admin-login`** with their normal credentials → admin panel.
- Currently **read-only** (view users). Editing/deleting users, business list, and analytics are possible follow-ups.

---

## 8. Resilience / notable fixes

- **CORS:** backend `allowedHeaders` must include `X-Business-Id` (`server/src/server.ts`) — otherwise business-scoped requests are blocked with "Failed to fetch".
- **Render cold starts:** `fetchWithRetry` in `client.ts` retries network failures with backoff so a waking server surfaces as a short delay, not an error. `/api/login` & `/api/register` retry too and return a 503 "server is waking up" instead of falling through to the demo account. **Real fix = keep Render awake** (paid plan or an UptimeRobot ping to `/health`).

---

## 9. Known TODOs / caveats

- The **legacy top section of Profile Settings** (Role, Company Name, Company Email, LinkedIn, Date of Incorporation, Country) is a static mockup — it doesn't load or save. Wire it to `user_profiles` (`GET/PUT /v1/me` profile) to make it functional.
- `payroll`, `documents`, `business-plans` modules are still **user-scoped**, not business-scoped.
- Finna personalization (use `business_profiles` in the prompt) is deferred.
- Roadmap phases not yet built: 5 (bookkeeping expansion — skipped for now), 6 (spreadsheet import), 8 (BI dashboard), 2 (AI memory + consent), 7 (document OCR).
- Git commits intentionally omit any AI co-author trailer (per the owner's request).
