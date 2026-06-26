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
- Role bootstrap (comma-separated emails, auto-promoted on boot). UI name → internal key:
  - `OWNER_EMAILS` → **Owner** (`owner`) — full control, assigns all roles.
  - `ADMIN_EMAILS` → **Admin** (`super_admin`) — manages Moderators & Users. (`SUPER_ADMIN_EMAILS` is a legacy alias for this.)
  - `MODERATOR_EMAILS` → **Moderator** (`admin`) — manages Users.
- (Promotion is **upgrade-only** — it never demotes a higher role. Owners assign all other roles in-app. Promotion runs at backend **startup**, so changing these vars requires a redeploy/restart, and the affected user must log out and back in.)
- Password reset (Resend) — used by `POST /v1/auth/forgot-password` + `/reset-password`:
  - `RESEND_API_KEY` — Resend API key (required to actually send mail; without it, the request still succeeds silently).
  - `RESET_EMAIL_FROM` — verified sender, e.g. `Finquanta <no-reply@yourdomain.com>` (defaults to Resend's shared `onboarding@resend.dev`, which only delivers to the Resend account owner until you verify a domain).
  - `APP_URL` — frontend base URL used to build the reset link (defaults to the first `CORS_ORIGIN`). The emailed link is `${APP_URL}/reset-password?token=…`.
- `ANTHROPIC_ADMIN_KEY` (optional) — an Anthropic **Admin API key** (`sk-ant-admin…`, created in the Anthropic Console; different from the inference key). Powers the admin panel's **API Usage** page (`GET /v1/admin/usage` → month-to-date spend via Anthropic's cost report). Without it the page explains how to set it.
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

- **Roles (rank):** `owner` (3) > `super_admin` (2) > `admin` (1) > `user` (0). The JWT has no role — it's always looked up from the DB. Displayed as: owner / super admin / admin / user.
- **Permission model** (`canRestrict`/`canDelete`/`canEdit`/`canChangeRole` in `admin.routes.ts`, mirrored on the frontend):
  - **owner** — restrict, delete, edit, and assign roles on **all** accounts; the **only** role that can assign roles.
  - **super_admin** — restrict + delete **admins and users** (rank ≤ 1); cannot touch super_admins/owners; no edit, no role changes.
  - **admin** — restrict **regular users only**; nothing else.
  - Nobody can act on their **own** account via the panel (prevents lockout).
- **Restrict = `users.status`** (`active` | `suspended`). Suspended accounts are **blocked at login** (`auth.service.login`). Column added idempotently by `AdminRepository.ensureSchema()`.
- **Backend** (`server/src/modules/admin/`):
  - `AdminRepository`: `listUsers()` (users + `business_profiles`), `getById()`, `updateUser()`, `deleteUser()`, `ensureSchema()`, `ensureAdmins(emails)`, `ensureSuperAdmins(emails)`.
  - `admin.routes.ts` — `requireAdmin` guard (DB role check). Endpoints: `GET /v1/admin/users`, `GET /v1/admin/me` (caller id+role), `PATCH /v1/admin/users/:id` (name / role[owner-only] / status), `DELETE /v1/admin/users/:id`. Registered in `api.ts`.
- **Frontend** (`user/src/app/(admin)/`):
  - `admin-login` — real login via `/api/login`, then checks `user.role` is admin/super_admin (rejects everyone else). Stores tokens so `apiFetch` is authenticated.
  - `admin-users` — fetches live users (replaced the `MOCK_USERS`), shows role/status, and per-row **Edit** (inline name), **role dropdown** (owner only), **Restrict/Unrestrict**, **Delete** — each gated by `canManage(callerRole, targetRole)`. Search, light/dark, logout. Non-admins are redirected to `/admin-login`.
  - API helper: `user/src/lib/api/admin.ts` (`listAdminUsers`, `checkAdmin`, `updateAdminUser`, `deleteAdminUser`).
- **How to grant a role via env (bootstrap):**
  1. They sign up normally (creates the user row).
  2. Add their email to **`OWNER_EMAILS`** (Owner), **`ADMIN_EMAILS`** (Admin), or **`MODERATOR_EMAILS`** (Moderator) in Render env, then redeploy/restart so the boot bootstrap promotes them, and have them log out/in. *After that, the Owner can assign roles in-app via the role dropdown — no env edit needed.*
  3. Log in at **`/admin-login`** with normal credentials → admin panel.

### Removed global UI (2026-06-21)
`SocialSidebar` (incl. its scroll-to-top button) and the Finna `ChatbotWidget` were removed from `app/layout.tsx`, and the duplicate `SocialSidebar` from the home page. **The component files still exist** (`components/SocialSidebar.tsx`, `components/ChatbotWidget.tsx`) — re-add the imports/renders to bring them back.

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
