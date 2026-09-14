# Domain split: app. / admin. / beta.finquanta.ai

**Status:** the split is **live** (merge 9704bc0, 2026-09-13): finquanta.ai,
app. and admin. are served as below. `beta.finquanta.ai` is being built on
branch `feat/beta-site`; nothing answers there yet.

## Why

`finquanta.ai` serves the marketing site, the product and the admin panel from
one address, so `finquanta.ai/admin-users` resolves for anyone who types it.
There is also nowhere to try a change before customers get it: in late August
three bugs were found only after reaching production (every document scan
failing, every forwarded attachment dropped, money lent out recorded as money
owed).

Ship this on its own, not bundled with feature work, so a problem can be traced
to the split.

## Addresses

| Address | Serves |
|---|---|
| `finquanta.ai` (+ `www.`) | Marketing: `/home`, `/pricing`, `/pricing-comparison`, `/blog` |
| `app.finquanta.ai` | The product: every `(user_dashbord)` page, `/login`, `/signup`, `/onboarding`, `/verify-email`, `/reset-password`, `/join`, `/capture`, `/payment`, `/payment-success`, `/demo` |
| `admin.finquanta.ai` | Every `/admin-*` page, nothing else |
| `beta.finquanta.ai` | Every route, unsplit. Separate deployment with its own database |
| `in.finquanta.ai` | Inbound mail only. Unchanged |

Served on every address: `/terms`, `/privacy`, `/ai-risk-disclosure`,
`/unsubscribe`, `/api/*`, and all static files.

## Decisions

- **Beta has its own database and backend.** Nothing done there can touch real
  books, charge a card or email a customer.
- **Everyone is logged out once.** Login tokens live in browser storage, which
  is per address. Announce it with the admin notification tool before cutover.
  Auth stays in browser storage: a shared `.finquanta.ai` cookie would also be
  shared with beta.
- **Beta serves every route unsplit**, so marketing, product and admin changes
  can all be tried on one address.

## How it works

`user/src/proxy.ts` (Next 16's name for middleware) runs before every page and
applies the table in `user/src/lib/hosts.ts`:

- a product path on `finquanta.ai` → 307 redirect to `app.`, same path and query
- a marketing path on `app.` → 307 redirect to `finquanta.ai`
- an admin path anywhere except `admin.` → 404
- anything except an admin path on `admin.` → 404
- `app.finquanta.ai/` → `/dashboard`; `admin.finquanta.ai/` → `/admin-overview`
- beta, Vercel preview URLs and unknown hosts → untouched

**Off unless `DOMAIN_SPLIT=on`.** Turning it on before `app.` resolves would
redirect every customer to an address that does not exist.

**307, not 308.** Browsers cache permanent redirects, which would break a
rollback. Switch to 308 once settled.

`lib/hosts.test.ts` fails if a new route folder is added without deciding which
address serves it.

### Traps this design avoids

- **Referrals.** Links are `/signup?ref=CODE`, read from the URL on arrival.
  Redirects keep the query string, so links already shared keep crediting.
- **Demo conversion.** The demo stashes its data in browser storage for the
  account created at signup. Demo and signup are both on `app.` so the import
  can find it.
- **Admin sign-in.** `admin-overview` sent logged-out admins to the customer
  `/login`, which is a 404 on `admin.`. Fixed to `/admin-login`.
- **Admin Panel link.** The dashboard sidebars linked to `/admin-users`, a 404
  on `app.`. They now use `hrefFor('admin', …)`, which points at `admin.` only
  when you are on `app.`; everywhere else it stays relative. Logging in on
  `app.` does not log you in on `admin.` — each address keeps its own login.
- **Beta badge.** A "Beta" chip under the logo (both dashboard sidebars, the
  admin sidebar, the marketing navbar) shows only on `beta.`.

## Cutover order (production)

Order matters. Each step is safe on its own until step 6.

1. **Merge and deploy** `feat/domain-split` with `DOMAIN_SPLIT` unset. No change.
2. **DNS** (Namecheap): CNAME `app` and `admin` → `cname.vercel-dns.com`.
3. **Vercel:** add `app.finquanta.ai` and `admin.finquanta.ai` to the project.
   Wait until both load over HTTPS. They serve everything, unsplit, for now.
4. **Render (production API):**
   - `CORS_ORIGIN`: add `https://app.finquanta.ai,https://admin.finquanta.ai`.
     Keep `https://finquanta.ai` (marketing pages still call the API).
   - `APP_URL`: `https://app.finquanta.ai`. Not before step 3, or reset,
     verify and invite emails link to a dead address.
5. **Announce the logout** with the admin notification tool.
6. **Vercel:** set `DOMAIN_SPLIT=on` for Production, then redeploy.
7. **Verify** (below).

**Rollback:** remove `DOMAIN_SPLIT` in Vercel and redeploy. Nothing is cached.

## Beta

A separate deployment: frontend from the `beta` git branch on the same Vercel
project, backend as its own Render service, its own database.

### It starts empty

Not a copy of production. Beta has to run with `NODE_ENV=production`, which
switches off every development-only safety net in the server, and a copy of
production would bring real customers' emails, Stripe subscription ids and
inbound addresses with it. An empty database has nothing real to damage; the
server creates the schema on first boot. Owners can later choose to bring a
workspace in ("Import my real books", separate spec).

### Safety checks in code

- **`assertBetaConfig`** (`server/src/config/config.ts`), with `BETA_SITE=true`:
  refuses to start with a live Stripe key, with `DATABASE_URL` naming
  production's database (`PRODUCTION_DB_HOST` required), or with `CRON_SECRET`
  or `RESEND_INBOUND_SIGNING_SECRET` set. Also refuses an `APP_URL` on a beta
  address without `BETA_SITE=true`.
- **Email**: on beta, delivery only to addresses that belong to a beta account.

### Render

`render.yaml` at the repo root declares the beta service only; production stays
configured in the dashboard, so syncing the Blueprint cannot touch it.

| Var | Beta |
|---|---|
| `NODE_ENV`, `BETA_SITE` | `production`, `true` |
| `APP_URL`, `CORS_ORIGIN` | `https://beta.finquanta.ai` |
| `DATABASE_URL` | the empty beta database |
| `PRODUCTION_DB_HOST` | production's database host |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | generated by Render |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, 6 × `STRIPE_PRICE_*` | Stripe **test mode** |
| `RESEND_API_KEY`, `RESET_EMAIL_FROM` | same as production |
| `PRODUCTION_API_URL` | the production API address |
| `ANTHROPIC_API_KEY`, `TURNSTILE_SECRET_KEY`, `OWNER_EMAILS`, `ADMIN_EMAILS` | same as production |
| `CRON_SECRET`, `RESEND_INBOUND_SIGNING_SECRET`, `INBOUND_EMAIL_DOMAIN`, `STORAGE_DRIVER`/`S3_*`, `SENTRY_DSN` | **unset** |

The GitHub cron workflows stay as they are: scheduled runs fire only from
`main` and call production.

### Steps outside the code

1. **GitHub:** branch `beta` from `main`.
2. **Neon:** a new, empty database; copy its connection string.
3. **Render:** New → Blueprint from the repo; fill in the values it asks for.
4. **Stripe (test mode):** webhook to the beta API's
   `/api/v1/billing/webhook`; its secret into Render.
5. **Namecheap:** CNAME `beta` → the value Vercel shows.
6. **Vercel:** add `beta.finquanta.ai` on the `beta` branch; set
   `NEXT_PUBLIC_API_URL` to the beta API for that branch only; redeploy.
7. **Cloudflare Turnstile:** add `beta.finquanta.ai` to the widget's hostnames.

Flow afterwards: work → `beta` → test on `beta.finquanta.ai` → merge to `main`.

## Verification

Production:

1. `finquanta.ai/dashboard` → `app.finquanta.ai/dashboard`.
2. `finquanta.ai/signup?ref=TEST` → `app.finquanta.ai/signup?ref=TEST`.
3. `finquanta.ai/admin-users` → 404; `admin.finquanta.ai/admin-users` loads.
4. Log in on `app.`, log out, confirm you land on `app.finquanta.ai/login`.
5. Request a password reset; the email link opens on `app.`.
6. Run the demo through to signup; the demo data appears in the new account.
7. Marketing pages, blog, terms and unsubscribe still load on `finquanta.ai`.

Beta:

1. Sign up a throwaway account on beta; confirm it does **not** exist in
   production. If it does, the database is not separate.
2. Confirm no lifecycle email is sent from beta.
3. Forward a receipt to a beta inbox; confirm it lands in beta only.

Locally, browsers resolve `*.localhost`, so with `DOMAIN_SPLIT=on` in
`user/.env.local` you can use `http://localhost:3000`,
`http://app.localhost:3000` and `http://admin.localhost:3000`.

## Out of scope

- Moving auth to a cookie.
- Any change to `in.finquanta.ai`.
- Bank connections (spec 09), which follows.
