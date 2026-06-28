import { serverApiUrl } from './client';

/** Confirm an email address using the token from the verification link. */
export async function verifyEmail(token: string): Promise<void> {
  const res = await fetch(serverApiUrl('/v1/auth/verify-email'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error || json?.message || 'Could not verify email');
  }
}

/** Ask for a fresh verification email. Always resolves (never reveals accounts). */
export async function resendVerification(email: string): Promise<void> {
  await fetch(serverApiUrl('/v1/auth/resend-verification'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}
