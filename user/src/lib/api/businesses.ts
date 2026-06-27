import { apiFetch, serverApiUrl } from './client';

export const BUSINESS_ROLES = ['Owner', 'Admin', 'Accountant', 'Bookkeeper', 'Manager', 'Viewer', 'Other'] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export interface Business {
  id: string;
  name: string;
  ownerId: string;
  role: BusinessRole;
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

export async function createBusiness(name: string): Promise<Business> {
  return apiFetch<Business>('/v1/businesses', { method: 'POST', body: JSON.stringify({ name }) });
}

export async function renameBusiness(businessId: string, name: string): Promise<Business> {
  return apiFetch<Business>(`/v1/businesses/${businessId}`, { method: 'PATCH', body: JSON.stringify({ name }) });
}

export async function getMembers(businessId: string): Promise<BusinessMember[]> {
  return apiFetch<BusinessMember[]>(`/v1/businesses/${businessId}/members`);
}

export async function createInvite(
  businessId: string,
  role: BusinessRole,
  password?: string,
  expiry: 'once' | '7d' = '7d'
): Promise<{ token: string; role: BusinessRole; requiresPassword: boolean; expiresAt: string | null; singleUse: boolean }> {
  return apiFetch(`/v1/businesses/${businessId}/invites`, {
    method: 'POST',
    body: JSON.stringify({ role, password: password || undefined, expiry }),
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
