/**
 * The invite an invitee opened before they had an account.
 *
 * Opening /join/<token> signed out is the normal case — someone is sent a link
 * and has never used Finquanta. They have to authenticate before they can be
 * added to anything, and that redirect used to lose the invite entirely: the
 * token was written to localStorage and then never read by anything, while
 * login pushed unconditionally to /dashboard. The invitee landed in their own
 * empty workspace with no way back unless they still had the link. Every
 * workspace in the database has exactly one member, which is what that looks
 * like from the outside.
 *
 * This module is the missing half: one place that stores the token, and one
 * place that decides where to go after authenticating.
 */

const KEY = 'pendingInvite';
const AT_KEY = 'pendingInviteAt';

/**
 * How long a remembered invite stays worth honouring.
 *
 * Without an expiry the token would sit in localStorage forever, and someone
 * who opened an invite once and ignored it would be redirected to it on every
 * future login. A day is comfortably longer than "sign up, then come back",
 * and short enough that a forgotten invite stops following them around.
 */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function setPendingInvite(token: string): void {
  if (typeof window === 'undefined' || !token) return;
  localStorage.setItem(KEY, token);
  localStorage.setItem(AT_KEY, String(Date.now()));
}

export function clearPendingInvite(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
  localStorage.removeItem(AT_KEY);
}

/** The remembered token, or null if there is none or it has gone stale. */
export function peekPendingInvite(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(KEY);
  if (!token) return null;

  const at = Number(localStorage.getItem(AT_KEY) ?? '');
  // A token written before this key existed has no timestamp. Treat it as
  // fresh rather than dropping it — the invite is still the reason they are
  // here — but stamp it now so it can age out normally from here on.
  if (!Number.isFinite(at) || at <= 0) {
    localStorage.setItem(AT_KEY, String(Date.now()));
    return token;
  }
  if (Date.now() - at > MAX_AGE_MS) {
    clearPendingInvite();
    return null;
  }
  return token;
}

/**
 * Where to send someone once they are authenticated: back to the invite that
 * brought them here, or on to wherever they were going anyway.
 */
export function postAuthDestination(fallback = '/dashboard'): string {
  const token = peekPendingInvite();
  return token ? `/join/${token}` : fallback;
}
