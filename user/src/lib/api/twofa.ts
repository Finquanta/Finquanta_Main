import { apiFetch, serverApiUrl } from './client';

/**
 * Second step of login for a 2FA-enabled account. Deliberately a plain fetch,
 * not apiFetch — there's no real session yet at this point, so we don't want
 * a stale/foreign token from localStorage attached, or apiFetch's 401-refresh
 * logic (which doesn't apply here) kicking in.
 */
export async function verifyTwoFactorLogin(challengeToken: string, code: string) {
  const res = await fetch(serverApiUrl('/v1/auth/2fa/verify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeToken, code }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Could not verify your code.');
  return json as {
    user: { id: string; email: string; firstName: string; lastName: string; role: string };
    accessToken: string;
    refreshToken: string;
  };
}

/** Start (or restart) enrollment: a QR to scan and the secret to type in by hand. */
export const setupTwoFactor = () =>
  apiFetch<{ secret: string; qrDataUrl: string }>('/v1/auth/2fa/setup', { method: 'POST' });

/** Complete enrollment with a code from the authenticator app. Returns backup codes ONCE. */
export const confirmTwoFactor = (code: string) =>
  apiFetch<{ backupCodes: string[] }>('/v1/auth/2fa/confirm', { method: 'POST', body: JSON.stringify({ code }) });

/** Turn 2FA off. Requires the current password again. */
export const disableTwoFactor = (password: string) =>
  apiFetch<void>('/v1/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password }) });
