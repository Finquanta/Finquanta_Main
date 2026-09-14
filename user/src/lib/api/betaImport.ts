import { apiFetch, serverApiUrl } from './client';

/**
 * Beta workspaces: a workspace cloned into beta.finquanta.ai, and "Open in
 * beta" to go there without signing up. See server/src/modules/beta-import.
 */

export type BetaCopyStatus = 'none' | 'copying' | 'done' | 'failed';

export interface WorkspaceBeta {
  enabled: boolean;
  copyStatus: BetaCopyStatus;
  copiedAt: string | null;
  copyError: string | null;
  /** False until the beta site is connected on the server. */
  configured: boolean;
  /** Set when the call started a copy, or tried to. */
  copy?: { started: boolean; reason?: string } | null;
}

export async function getWorkspaceBeta(businessId: string): Promise<WorkspaceBeta> {
  return apiFetch<WorkspaceBeta>(`/v1/businesses/${businessId}/beta`);
}

/**
 * Owner only. `enabled: true` starts a copy; `memberUserIds` is exactly who may
 * test it (they get the "beta tester" badge).
 */
export async function setWorkspaceBeta(
  businessId: string,
  change: { enabled?: boolean; memberUserIds?: string[] }
): Promise<WorkspaceBeta> {
  return apiFetch<WorkspaceBeta>(`/v1/businesses/${businessId}/beta`, {
    method: 'PATCH',
    body: JSON.stringify(change),
  });
}

/** Owner only. Copies the real books again, replacing the beta copy. */
export async function refreshWorkspaceBeta(businessId: string): Promise<WorkspaceBeta> {
  return apiFetch<WorkspaceBeta>(`/v1/businesses/${businessId}/beta/refresh`, { method: 'POST' });
}

/** On the real site: go to beta, signed in, optionally straight into a workspace. */
export async function openInBeta(businessId?: string): Promise<void> {
  const { url } = await apiFetch<{ url: string }>('/v1/beta-export/login-codes', {
    method: 'POST',
    body: JSON.stringify({ businessId }),
  });
  window.location.href = url;
}

export interface BetaSignIn {
  user: { id: string; email: string; firstName?: string; lastName?: string; role?: string };
  accessToken: string;
  refreshToken: string;
}

/** On beta: exchange the one-time link for a session. No token exists yet, so a plain fetch. */
export async function signInToBeta(code: string): Promise<BetaSignIn> {
  const res = await fetch(serverApiUrl('/v1/beta-sso'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Could not sign you in to beta.');
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as BetaSignIn;
}
