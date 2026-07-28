import { serverApiUrl } from './client';

export type VerifyStatus = 'verified' | 'already';
export type VerifyErrorReason = 'invalid' | 'expired';

export class VerifyError extends Error {
  constructor(public reason: VerifyErrorReason, message: string) {
    super(message);
    this.name = 'VerifyError';
  }
}

/**
 * Confirm an email address using the token from the verification link.
 * Resolves to 'verified' (just confirmed) or 'already' (a prior hit — the user,
 * a refresh, or an email link-scanner — already confirmed it). Both are success.
 * Throws VerifyError with a reason ('expired' | 'invalid') on failure.
 */
export async function verifyEmail(token: string): Promise<VerifyStatus> {
  const res = await fetch(serverApiUrl('/v1/auth/verify-email'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason: VerifyErrorReason = json?.reason === 'expired' ? 'expired' : 'invalid';
    throw new VerifyError(reason, json?.error || json?.message || 'Could not verify email');
  }
  return json?.status === 'already' ? 'already' : 'verified';
}

export type ResendStatus = 'sent' | 'already_verified';

/**
 * Ask for a fresh verification email. Always resolves (never reveals accounts),
 * except that an already-verified account is reported back so the UI can tell
 * the user to simply log in.
 */
export async function resendVerification(email: string): Promise<ResendStatus> {
  const res = await fetch(serverApiUrl('/v1/auth/resend-verification'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const json = await res.json().catch(() => ({}));
  return json?.status === 'already_verified' ? 'already_verified' : 'sent';
}
