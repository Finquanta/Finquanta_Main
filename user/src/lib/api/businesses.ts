import { apiFetch, serverApiUrl } from './client';

export const BUSINESS_ROLES = ['Owner', 'Admin', 'Accountant', 'Bookkeeper', 'Manager', 'Viewer', 'Other'] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export interface Business {
  id: string;
  name: string;
  ownerId: string;
  role: BusinessRole;
  /**
   * What to call this business's plan: the plan being PAID FOR when there is
   * one, otherwise the window granting access ('Trial', 'Grandfathered').
   * Resolved server-side so the switcher and admin panel cannot disagree.
   * Optional, so an older payload simply shows no badge.
   */
  plan?: string;
  /** Colour key for that label — see lib/planColors. */
  planTone?: string;
}

export interface BusinessMember {
  userId: string;
  name: string;
  email: string;
  role: BusinessRole;
}

export interface InviteInfo {
  businessName: string;
  role: BusinessRole;
  requiresPassword: boolean;
  expired: boolean;
}

export async function listBusinesses(): Promise<Business[]> {
  return apiFetch<Business[]>('/v1/businesses');
}

/**
 * Create a workspace, optionally recording which country the business is in.
 *
 * Country is per WORKSPACE, not per person: somebody can run a company in the
 * US and another in Canada, and those are different businesses with different
 * books and different rules. It is editable afterwards in Settings → Business
 * profile.
 */
export async function createBusiness(name: string, country?: string): Promise<Business> {
  return apiFetch<Business>('/v1/businesses', {
    method: 'POST',
    body: JSON.stringify({ name, country: country || undefined }),
  });
}

export async function renameBusiness(businessId: string, name: string): Promise<Business> {
  return apiFetch<Business>(`/v1/businesses/${businessId}`, { method: 'PATCH', body: JSON.stringify({ name }) });
}

/**
 * Change a member's role — which is the same act as granting or taking back a
 * PAID SEAT. A working role occupies a billable seat; a Viewer is free.
 *
 * Returns the workspace's new billable seat count, so the caller can show what
 * the change did without a second request.
 */
export async function changeMemberRole(
  businessId: string,
  userId: string,
  role: BusinessRole
): Promise<{ userId: string; role: BusinessRole; seats: number }> {
  return apiFetch(`/v1/businesses/${businessId}/members/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

/**
 * Hand this business to another member. Owner only, enforced server-side.
 *
 * The outgoing owner stays on as an Admin — transferring is not leaving, and
 * someone handing over to a colleague usually still works there.
 */
export async function transferOwnership(businessId: string, userId: string): Promise<void> {
  await apiFetch(`/v1/businesses/${businessId}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

/** Leave a business. The owner must transfer first — the server refuses with a 409. */
export async function leaveBusiness(businessId: string): Promise<void> {
  await apiFetch(`/v1/businesses/${businessId}/leave`, { method: 'POST' });
}

export async function getMembers(businessId: string): Promise<BusinessMember[]> {
  return apiFetch<BusinessMember[]>(`/v1/businesses/${businessId}/members`);
}

/**
 * Create an invite, and optionally email it.
 *
 * `email` is additive, never a replacement: the token comes back either way, so
 * the copy-and-paste path keeps working. It is the only one available when you
 * do not know somebody's address, or want to send the link somewhere you
 * already trust.
 *
 * `emailed` reports whether the message actually went — an address being typed
 * is not proof of delivery, and the server treats sending as best-effort so a
 * mail failure cannot destroy an invite that already exists.
 */
export async function createInvite(
  businessId: string,
  role: BusinessRole,
  password?: string,
  expiry: 'once' | '7d' = '7d',
  email?: string
): Promise<{
  token: string; role: BusinessRole; requiresPassword: boolean;
  expiresAt: string | null; singleUse: boolean; emailed?: boolean;
}> {
  return apiFetch(`/v1/businesses/${businessId}/invites`, {
    method: 'POST',
    body: JSON.stringify({ role, password: password || undefined, expiry, email: email || undefined }),
  });
}

export async function removeMember(businessId: string, userId: string): Promise<void> {
  await apiFetch(`/v1/businesses/${businessId}/members/${userId}`, { method: 'DELETE' });
}

// Public — no auth needed so an invitee can preview before logging in.
export async function getInviteInfo(token: string): Promise<InviteInfo> {
  const res = await fetch(serverApiUrl(`/v1/businesses/invites/${token}`));
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || json?.message || 'Invite not found');
  return json && typeof json === 'object' && 'data' in json ? json.data : json;
}

export async function acceptInvite(token: string, password?: string): Promise<{ businessId: string; businessName: string; role: BusinessRole }> {
  return apiFetch(`/v1/businesses/invites/${token}/accept`, {
    method: 'POST',
    body: JSON.stringify({ password: password || undefined }),
  });
}
