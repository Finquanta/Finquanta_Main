import { serverApiUrl } from './api/client';
import { useAppState } from '@/hooks/context/useAppState';

/**
 * Auth/session helpers.
 *
 * Logging out has to clear BOTH places a session lives:
 *   1. The bare tokens (`accessToken`/`refreshToken`/`user`) that `apiFetch`
 *      reads and that the homepage checks to decide "already logged in?".
 *   2. The Zustand persist store ("Finquanta-ai-app-state"), which mirrors the
 *      same tokens + `isAuthenticated`. If this is left behind, stale auth state
 *      bounces the user straight back into the dashboard.
 */

const ZUSTAND_PERSIST_KEY = 'Finquanta-ai-app-state';

/** Remove every trace of the signed-in session from the browser. */
export function clearSession(): void {
  if (typeof window === 'undefined') return;
  // Sign the in-memory store out FIRST. Removing the persist key alone isn't
  // enough: the store still holds the token, and any update to it before the
  // page unloads (a toast, a loading flag) writes the whole session straight
  // back to localStorage. After this, a late write can only persist logged-out.
  useAppState.setState({ isAuthenticated: false, accessToken: null, refreshToken: null, user: null });
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('activeBusinessId');
  localStorage.removeItem(ZUSTAND_PERSIST_KEY);
}

/**
 * Clear the session and hard-navigate to `destination`. A full page load (not a
 * client-side router push) guarantees the in-memory store re-initialises empty,
 * so nothing can re-persist the token after we've cleared it.
 *
 * `replace`, not `href`: the page being left was reached while signed in, so
 * keeping it in history would let the Back button walk straight back into it.
 */
export function logoutAndRedirect(destination = '/login'): void {
  if (typeof window !== 'undefined') {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      // Best-effort, fire-and-forget: revoke it server-side so a stolen refresh
      // token can't outlive this logout. `keepalive` lets the request finish
      // even as the page navigates away right after.
      fetch(serverApiUrl('/v1/auth/logout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        keepalive: true,
      }).catch(() => {});
    }
  }
  clearSession();
  if (typeof window !== 'undefined') window.location.replace(destination);
}
