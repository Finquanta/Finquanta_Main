# API Disconnect Report — `main/user` ↔ `main/server`

**Generated:** 2026-06-04  
**Scope:** `C:\Users\iamsolomonchika\Documents\001_workspace\Finquanta_Main.git\main\user` ↔ `main\server`

---

## Server URL Architecture

```
Base: http://localhost:3001
Prefix: /api

/api                           → GET  (info)
/api/version                   → GET  (version)
/api/test                      → GET  (test)

/api/health/                   → GET  (basic health)
/api/health/detailed           → GET  (detailed health)

/api/v1/auth/login             → POST (authenticate)
/api/v1/auth/register          → POST (register)
/api/v1/auth/refresh           → POST (refresh token)

/api/v1/bookkeeping/overview            → GET    (authenticated)
/api/v1/bookkeeping/transactions        → POST   (authenticated)
/api/v1/bookkeeping/transactions/:id    → PATCH  (authenticated)
/api/v1/bookkeeping/transactions/:id    → DELETE (authenticated)

/api/v1/business-plans                  → GET  (authenticated)
/api/v1/business-plans/stats            → GET  (authenticated)
/api/v1/business-plans/templates        → GET  (authenticated)
/api/v1/business-plans/market-data      → GET  (authenticated)
/api/v1/business-plans/:id/duplicate    → POST (authenticated)

/api/v1/dashboard/overview              → GET  (authenticated)

/api/v1/documents                       → GET  (authenticated)
/api/v1/documents/stats                 → GET  (authenticated)

/api/v1/financial/transactions          → GET  (authenticated)
/api/v1/financial/transactions          → POST (authenticated)
/api/v1/financial/transactions/:id      → GET  (authenticated)
/api/v1/financial/transactions/:id      → PUT  (authenticated)
/api/v1/financial/transactions/:id      → DELETE (authenticated)
/api/v1/financial/summary               → GET  (authenticated)

/api/v1/payroll/overview                → GET  (authenticated)

/api/v1/me                              → GET    (authenticated)
/api/v1/me/profile                      → PATCH  (authenticated)
/api/v1/me/settings                     → PATCH  (authenticated)

/api/v1/statistics/overview             → GET  (authenticated)
```

---

## 🔴 Critical Disconnects

> **Status update (2026-06-04):** All critical disconnects below have been resolved. See `docs/api-disconnect-fix-plan.md` and `docs/api-disconnect-fix-log.md` for the fix record.

### ~~1. Auth Route Path Mismatch — Login~~ ✅ RESOLVED

| Aspect | Detail |
|---|---|
| **File** | `main/user/src/app/api/login/route.ts` |
| **Fix** | Changed `'/auth/login'` → `'/v1/auth/login'` |
| **Status** | ✅ Fixed — auth path now matches server endpoint |

### ~~2. Auth Route Path Mismatch — Register~~ ✅ RESOLVED

| Aspect | Detail |
|---|---|
| **File** | `main/user/src/app/api/register/route.ts` |
| **Fix** | Changed `'/auth/register'` → `'/v1/auth/register'` |
| **Status** | ✅ Fixed — auth path now matches server endpoint |

### ~~3. Missing JWT Authentication Headers on All Data API Calls~~ ✅ RESOLVED

All backend data endpoints (dashboard, bookkeeping, business-plans, documents, payroll, statistics, profile) require JWT authentication via the `authenticate` preHandler middleware:

```typescript
// server/src/modules/shared/authenticate.ts
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ success: false, error: 'Authentication required' });
  }
}
```

However, **none of the 6 frontend API client files include Authorization headers**.

| API Client File | Functions | Missing Auth |
|---|---|---|
| `main/user/src/lib/api/bookkeeping.ts` | `getBookkeepingOverview` | ❌ |
| `main/user/src/lib/api/dashboard.ts` | `getDashboardOverview` | ❌ |
| `main/user/src/lib/api/business-plans.ts` | `listBusinessPlans`, `getBusinessPlanStats`, `getBusinessPlanMarketData` | ❌ |
| `main/user/src/lib/api/documents.ts` | `listDocuments`, `getDocumentStats` | ❌ |
| `main/user/src/lib/api/payroll.ts` | `getPayrollOverview` | ❌ |
| `main/user/src/lib/api/statistics.ts` | `getStatisticsOverview` | ❌ |

There is also **no shared HTTP client or interceptor** that automatically attaches tokens. Each file calls `fetch(serverApiUrl(...))` directly with no additional headers.

**Token storage exists but is not connected to API calls:**

```typescript
// From SimpleAppProvider.tsx — tokens are stored in localStorage
localStorage.getItem('accessToken')  // ← Available but never used in API calls
localStorage.getItem('refreshToken')
```

**Impact:** All data API calls from the frontend will return **401 Unauthorized**. Only the login and register Next.js proxy routes work (but even those 404 due to the path mismatch above).

**Status:** ✅ RESOLVED. All API clients now use `apiFetch<T>()` which reads the access token from localStorage and attaches `Authorization: Bearer <token>`. See `docs/api-disconnect-fix-plan.md` (Tasks 2 & 3) for details.

**Fix applied:**

1. Added `apiFetch<T>()` to `src/lib/api/client.ts` — reads `accessToken` from localStorage, attaches Authorization header, handles JSON content type.
2. Updated all 6 API client modules to use `apiFetch` instead of raw `fetch(serverApiUrl(...))`.

**Implementation:**
```typescript
// src/lib/api/client.ts
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(serverApiUrl(path), { ...options, headers });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}
```

---

## 🟡 Warnings

### 4. Financial Transactions Endpoints — No Frontend Consumer

The server exposes a full CRUD API for financial transactions, but no frontend page or API client references these endpoints:

| Server Endpoint | Frontend Consumer |
|---|---|
| `GET /api/v1/financial/transactions` | ❌ None |
| `POST /api/v1/financial/transactions` | ❌ None |
| `GET /api/v1/financial/transactions/:id` | ❌ None |
| `PUT /api/v1/financial/transactions/:id` | ❌ None |
| `DELETE /api/v1/financial/transactions/:id` | ❌ None |
| `GET /api/v1/financial/summary` | ❌ None |

**Likely cause:** Backend-first development. These endpoints were built ahead of the corresponding frontend pages.

**Recommendation:** No action needed now, but flag for the next sprint.

---

### ~~5. Login Response Shape — Mismatch~~ ✅ RESOLVED

| Aspect | Detail |
|---|---|
| **Issue** | Frontend expected `data.access` / `data.refresh` but server sends `data.accessToken` / `data.refreshToken` |
| **Files** | `main/user/src/app/(auth)/login/components/auth-form.tsx`, `main/user/src/app/(auth)/signup/components/auth-form.tsx` |
| **Fix** | Changed field references to match server shape + constructed `name` from `firstName`/`lastName` |
| **Status** | ✅ Fixed — login and signup forms now parse the server response correctly |

### ~~6. All Live Pages Currently Use Mock Data~~ ⚠️ INTENTIONAL

The frontend pages initialize with mock data and only attempt API calls in `useEffect` with graceful `.catch(() => undefined)` fallbacks. This is a development pattern, not a bug.

### 7. Token Auto-Refresh on Expiry ✅ ADDED

| Aspect | Detail |
|---|---|
| **Feature** | Silent token refresh on 401 responses |
| **File** | `main/user/src/lib/api/client.ts` |
| **Behavior** | On 401, reads `refreshToken` from localStorage, calls `POST /api/v1/auth/refresh`, stores new tokens, retries original request once. If refresh fails, clears tokens and redirects to `/login`. |
| **Status** | ✅ Implemented in `apiFetch<T>()` |

### 8. Signup Form Does Not Call Register Endpoint ⚠️ PRE-EXISTING BUG

| Aspect | Detail |
|---|---|
| **File** | `main/user/src/app/(auth)/signup/components/auth-form.tsx` |
| **Issue** | The signup form's `handleSubmit` calls `fetch("/api/login")` instead of calling the register endpoint first, then auto-login. It has no firstName/lastName fields. It behaves identically to the login form. |
| **Status** | ⚠️ Pre-existing — not introduced by the merge. Needs a separate fix to connect it to `POST /api/v1/auth/register`.

The frontend pages initialize with mock data and only attempt API calls in `useEffect` with graceful `.catch(() => undefined)` fallbacks. This means:

- The build succeeds regardless of server availability
- The UI renders with mock data even when APIs fail
- API disconnects are invisible to the user but no live data flows

```typescript
// Pattern used across all dashboard pages:
const [data, setData] = useState(mockData);       // ← Mock data first
useEffect(() => {
  getRealData().then(setData).catch(() => undefined);  // ← Live data attempt
}, []);
```

This is intentional for development but means broken APIs won't be obvious without checking the browser console's 401 errors.

---

## Files Referenced

| File | Path (relative to repo root) |
|---|---|
| Login proxy route | `main/user/src/app/api/login/route.ts` |
| Register proxy route | `main/user/src/app/api/register/route.ts` |
| API client base | `main/user/src/lib/api/client.ts` |
| Bookkeeping API | `main/user/src/lib/api/bookkeeping.ts` |
| Dashboard API | `main/user/src/lib/api/dashboard.ts` |
| Business plans API | `main/user/src/lib/api/business-plans.ts` |
| Documents API | `main/user/src/lib/api/documents.ts` |
| Payroll API | `main/user/src/lib/api/payroll.ts` |
| Statistics API | `main/user/src/lib/api/statistics.ts` |
| Server auth middleware | `main/server/src/modules/shared/authenticate.ts` |
| Server API routes | `main/server/src/routes/api.ts` |
| Server route index | `main/server/src/routes/index.ts` |
| Auth form (login) | `main/user/src/app/(auth)/login/components/auth-form.tsx` |
| Auth form (signup) | `main/user/src/app/(auth)/signup/components/auth-form.tsx` |
| Auth controller server | `main/server/src/modules/auth/auth.routes.ts` |
| App context provider | `main/user/src/hooks/context/SimpleAppProvider.tsx` |

---

## Resolution Summary

| Priority | Issue | Status |
|---|---|---|
| 🔴 P0 | Fix login path: `'/auth/login'` → `'/v1/auth/login'` | ✅ Done |
| 🔴 P0 | Fix register path: `'/auth/register'` → `'/v1/auth/register'` | ✅ Done |
| 🔴 P0 | Add auth token to `client.ts` and update all API clients | ✅ Done |
| 🔴 P0 | Token auto-refresh on expiry | ✅ Done |
| 🟡 P1 | Fix login response shape (`access` → `accessToken`, etc.) | ✅ Done |
| 🟡 P2 | Connect signup form to register endpoint | ⏳ Backlog |
