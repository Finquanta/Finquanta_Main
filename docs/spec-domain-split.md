# Domain split: app. / admin. / beta.finquanta.ai

**Status:** routing code built on branch `feat/domain-split`, switched **off**.
Nothing has changed for customers. DNS, Vercel, Render and Neon steps not started.

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

## Beta (after production is settled)

1. **Git:** create branch `beta` from `main`.
2. **Neon:** create a `beta` branch of the database.
3. **Render:** new service from the `beta` branch with its own env vars:

   | Var | Beta value |
   |---|---|
   | `DATABASE_URL` | Neon `beta` branch |
   | `LIFECYCLE_ALLOW_SEND` | off. **Highest risk:** the reminder cron emails real customers |
   | Stripe keys | test mode |
   | `RESEND_INBOUND_SIGNING_SECRET`, `INBOUND_EMAIL_DOMAIN` | separate |
   | `CRON_SECRET` | separate |
   | `CORS_ORIGIN`, `APP_URL` | `https://beta.finquanta.ai` |
   | `ANTHROPIC_API_KEY` | separate key or lower caps |

4. **DNS:** CNAME `beta` → `cname.vercel-dns.com`.
5. **Vercel:** add `beta.finquanta.ai`, assigned to the `beta` git branch; set
   `NEXT_PUBLIC_API_URL` to the beta API for that branch only.

Flow afterwards: work → `beta` → test on `beta.finquanta.ai` → merge to `main`.

**Recommended first:** a `render.yaml`. The server reads about 40 env vars, all
typed into the Render dashboard; a second service doubles that by hand.

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
