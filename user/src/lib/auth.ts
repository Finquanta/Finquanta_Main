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
 */
export function logoutAndRedirect(destination = '/login'): void {
  clearSession();
  if (typeof window !== 'undefined') window.location.href = destination;
}
