# Fix Plan — API Disconnects between `main/user` and `main/server`

**Based on:** `docs/api-disconnect-report.md`  
**Goal:** Bridge all critical and warning-level disconnects so the frontend can communicate with the backend with proper authentication.

---

## Task 1 — Fix Auth Route Paths ✅

**Files:** `main/user/src/app/api/login/route.ts`, `main/user/src/app/api/register/route.ts`  
**Issue:** Both Next.js proxy routes call `serverApiUrl('/auth/login')` and `serverApiUrl('/auth/register')` but the server expects `/v1/auth/login` and `/v1/auth/register`.

### Micro-tasks

- [x] 1.1 Open `main/user/src/app/api/login/route.ts`
  - [x] 1.1.1 Locate line `const response = await fetch(serverApiUrl('/auth/login'), ...)`
  - [x] 1.1.2 Change `'/auth/login'` → `'/v1/auth/login'`
- [x] 1.2 Open `main/user/src/app/api/register/route.ts`
  - [x] 1.2.1 Locate line `const response = await fetch(serverApiUrl('/auth/register'), ...)`
  - [x] 1.2.2 Change `'/auth/register'` → `'/v1/auth/register'`
- [x] 1.3 Verify — start the server, hit the login endpoint, confirm 200 instead of 404

---

## Task 2 — Add JWT Auth Token Support to API Client ✅

**File:** `main/user/src/lib/api/client.ts`  
**Issue:** `serverApiUrl()` builds URLs but the fetch calls have no Authorization headers. The access token is stored in localStorage after login but never used.

### Micro-tasks

- [x] 2.1 Refactor `client.ts` — add an `apiFetch<T>()` wrapper function
  - [x] 2.1.1 Read `accessToken` from `localStorage.getItem('accessToken')`
  - [x] 2.1.2 Build headers with `'Content-Type': 'application/json'` and optional `Authorization: Bearer <token>`
  - [x] 2.1.3 Merge caller-supplied options/headers
  - [x] 2.1.4 Call `fetch(serverApiUrl(path), headersMergedOptions)`
  - [x] 2.1.5 Check `!res.ok` → throw with status
  - [x] 2.1.6 Return `res.json()` typed as `T`
  - [x] 2.1.7 Keep `serverApiUrl()` exported for backwards compatibility
- [x] 2.2 Verify `client.ts` exports both `serverApiUrl` and `apiFetch`

---

## Task 3 — Update All API Client Files to Use `apiFetch` ✅

**Files:** 6 API client modules under `main/user/src/lib/api/`  
**Issue:** All 6 files use raw `fetch(serverApiUrl(...))` without auth headers. Swapped to the new `apiFetch` wrapper.

### Micro-tasks

- [x] 3.1 **bookkeeping.ts** — `getBookkeepingOverview`: `apiFetch<BookkeepingOverview>('/v1/bookkeeping/overview')`
- [x] 3.2 **dashboard.ts** — `getDashboardOverview`: `apiFetch<DashboardOverviewResponse>('/v1/dashboard/overview')`
- [x] 3.3 **business-plans.ts** — 3 functions: `apiFetch<any[]|any>('/v1/business-plans/...')`
- [x] 3.4 **documents.ts** — 2 functions: `apiFetch<any[]|any>('/v1/documents/...')`
- [x] 3.5 **payroll.ts** — `getPayrollOverview`: `apiFetch<any>('/v1/payroll/overview')`
- [x] 3.6 **statistics.ts** — `getStatisticsOverview`: `apiFetch<any>('/v1/statistics/overview')`
- [x] 3.7 Build check — `npx next build` passes with zero errors

---

## Task 4 — Verify Login Response Shape ✅

**Files:** `main/server/src/modules/auth/auth.controller.ts`, `main/user/src/app/(auth)/login/components/auth-form.tsx`, `main/user/src/app/(auth)/signup/components/auth-form.tsx`  
**Issue:** The frontend expected `{ access: "...", refresh: "..." }` but the server sends `{ accessToken: "...", refreshToken: "..." }`.

### Micro-tasks

- [x] 4.1 Read server auth controller — login response is `{ user: { id, email, firstName, lastName, role }, accessToken, refreshToken }`
- [x] 4.2 Read login auth-form.tsx — expected `data.access` / `data.refresh` and `data.user.name` / `data.user.username`
- [x] 4.3 Fix mismatch — updated both login and signup forms to use `accessToken`, `refreshToken`, `firstName`/`lastName`
- [x] 4.4 Build check — `npx next build` passes with zero errors

---

## Task 5 — Handle Token Expiry and Refresh ✅

**File:** `main/user/src/lib/api/client.ts`  
**Issue:** JWT tokens expire. The `apiFetch` wrapper now handles 401 responses by attempting a silent token refresh before failing.

### Micro-tasks

- [x] 5.1 Added `refreshAccessToken()` helper function
  - [x] Reads `refreshToken` from localStorage
  - [x] Calls `POST /api/v1/auth/refresh` with `{ refreshToken }`
  - [x] On success, stores new `accessToken` and `refreshToken`
- [x] 5.2 Added `clearAuthAndRedirect()` helper — clears tokens, redirects to `/login`
- [x] 5.3 Updated `apiFetch` to intercept 401 responses
  - [x] If 401 + token exists → attempt refresh
  - [x] If refresh succeeds → retry original request once with new token
  - [x] If retry also 401 → clear auth + redirect
  - [x] If refresh fails → clear auth + redirect
- [x] 5.4 Build check — `npx next build` passes with zero errors

---

## Task 6 — (Optional) Clean Up Login/Register Proxy Routes

**Skipped** — proxy routes work correctly after the path fix. Signup form needs a separate deeper fix (Task 8 in the disconnect report).

---

## Task 7 — Document Remaining Backend-Only Endpoints ✅

**File:** `main/docs/api-disconnect-report.md` (updated)

### Micro-tasks

- [x] 7.1 Confirmed financial transactions endpoints have no frontend consumer
- [x] 7.2 Updated report with resolution status for all fixed items
- [x] 7.3 Added backlog section for remaining items (signup form, financial endpoints)
