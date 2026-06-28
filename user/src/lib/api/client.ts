const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export function serverApiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Global "pulling data…" indicator. Render's free tier sleeps, so the first
 * request after idle can take 20-50s (see fetchWithRetry). We surface that as a
 * small badge — but only once a request has been slow for SLOW_AFTER_MS, so
 * normal fast requests never flash it. Components subscribe via subscribeLoading.
 */
type LoadingListener = (active: boolean) => void;
const loadingListeners = new Set<LoadingListener>();
let inFlight = 0;
let slowActive = false;
let slowTimer: ReturnType<typeof setTimeout> | null = null;
const SLOW_AFTER_MS = 1500;

function emitLoading() {
  for (const cb of loadingListeners) cb(slowActive);
}

/** Subscribe to the slow-request flag. Returns an unsubscribe function. */
export function subscribeLoading(cb: LoadingListener): () => void {
  loadingListeners.add(cb);
  cb(slowActive);
  return () => { loadingListeners.delete(cb); };
}

function beginRequest() {
  inFlight += 1;
  if (inFlight === 1 && slowTimer === null) {
    slowTimer = setTimeout(() => { slowActive = true; emitLoading(); }, SLOW_AFTER_MS);
  }
}

function endRequest() {
  inFlight = Math.max(0, inFlight - 1);
  if (inFlight === 0) {
    if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
    if (slowActive) { slowActive = false; emitLoading(); }
  }
}

/**
 * The backend runs on Render's free tier, which sleeps after ~15 min idle and
 * takes 20-50s to wake. While it's waking, fetch() rejects with a network-level
 * TypeError ("Failed to fetch"). Retry those a few times with backoff so a cold
 * start surfaces as a short delay instead of an error. Only network failures are
 * retried — real HTTP responses (4xx/5xx) are returned to the caller as-is.
 */
export async function fetchWithRetry(url: string, init?: RequestInit, attempts = 4): Promise<Response> {
  beginRequest();
  try {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fetch(url, init);
      } catch (err) {
        lastErr = err; // network error (server waking / offline) — wait then retry
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      }
    }
    throw lastErr;
  } finally {
    endRequest();
  }
}

/**
 * Attempt to refresh the JWT access token using the stored refresh token.
 * Returns true if the refresh succeeded, false otherwise.
 */
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken =
    typeof window !== 'undefined'
      ? localStorage.getItem('refreshToken')
      : null;

  if (!refreshToken) return false;

  try {
    const res = await fetch(serverApiUrl('/v1/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build an Error from a failed response, preferring the backend's own error
 * message ({ error } or { message }) over the bare status code.
 */
async function errorFromResponse(res: Response): Promise<Error> {
  try {
    const body = await res.json();
    // Prefer a specific message; Fastify's `error` is often just "Bad Request".
    const message = body?.message || body?.error;
    if (message) return new Error(message);
  } catch {
    /* response had no/invalid JSON body */
  }
  return new Error(`API error: ${res.status} ${res.statusText}`);
}

/**
 * Backend success responses are wrapped as { success: true, data: <payload> }.
 * Frontend callers expect the payload directly, so unwrap the envelope when
 * present while tolerating already-unwrapped responses.
 */
function unwrapEnvelope<T>(json: unknown): T {
  if (
    json !== null &&
    typeof json === 'object' &&
    'success' in json &&
    'data' in json
  ) {
    return (json as { data: T }).data;
  }
  return json as T;
}

/**
 * Clear stored auth tokens and redirect to login page.
 */
function clearAuthAndRedirect(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

/**
 * Authenticated fetch wrapper.
 * Reads the JWT access token from localStorage and attaches it as
 * an Authorization header. On 401, attempts a silent token refresh
 * and retries the request once before giving up.
 */
export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('accessToken')
      : null;

  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> | undefined),
  };

  // Only declare a JSON content-type when we actually send a body. Sending
  // Content-Type: application/json on a bodyless request (e.g. DELETE) makes
  // the server try to parse an empty body and reject it with 400 Bad Request.
  if (options?.body !== undefined && headers['Content-Type'] === undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Scope data requests to the active business (workspace).
  const businessId = typeof window !== 'undefined' ? localStorage.getItem('activeBusinessId') : null;
  if (businessId && headers['X-Business-Id'] === undefined) {
    headers['X-Business-Id'] = businessId;
  }

  const res = await fetchWithRetry(serverApiUrl(path), {
    ...options,
    headers,
  });

  // Token expired — attempt a silent refresh and retry once
  if (res.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry with the new token
      const newToken = localStorage.getItem('accessToken');
      headers['Authorization'] = `Bearer ${newToken}`;

      const retryRes = await fetchWithRetry(serverApiUrl(path), {
        ...options,
        headers,
      });

      if (retryRes.ok) {
        return unwrapEnvelope<T>(await retryRes.json());
      }

      // If retry still fails with 401, force re-login
      if (retryRes.status === 401) {
        clearAuthAndRedirect();
        throw new Error('Session expired. Please log in again.');
      }

      throw await errorFromResponse(retryRes);
    }

    // Refresh failed — force re-login
    clearAuthAndRedirect();
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    throw await errorFromResponse(res);
  }

  return unwrapEnvelope<T>(await res.json());
}
