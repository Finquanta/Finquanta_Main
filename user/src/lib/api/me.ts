import { apiFetch } from './client';

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  /** The wider profile. `phone` is the personal number, distinct from the business one. */
  profile?: { phone?: string; [key: string]: unknown };
}

export async function getMe(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>('/v1/me');
}

export async function updateName(data: { firstName?: string; lastName?: string }): Promise<{ firstName: string; lastName: string }> {
  return apiFetch<{ firstName: string; lastName: string }>('/v1/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Permanently deletes the account and, via cascade, the entire business it
 * owns (invoices, ledger, everything). Requires the current password.
 * Irreversible — there is no undo.
 */
export interface DeletionBlocker {
  id: string;
  name: string;
  /** Everyone in it apart from the departing owner. */
  otherMembers: number;
}

/**
 * Workspaces this account owns that OTHER PEOPLE are in.
 *
 * Deleting an account cascades the businesses it owns and every ledger beneath
 * them, so a sole owner closing their account would take their colleagues'
 * books with it. Each of these needs a successor nominated first; the server
 * refuses the deletion otherwise.
 */
export async function getDeletionBlockers(): Promise<DeletionBlocker[]> {
  return apiFetch<DeletionBlocker[]>('/v1/me/deletion-blockers');
}

/**
 * Permanently deletes the account and, via cascade, any business it owns ALONE
 * (invoices, ledger, everything). Requires the current password. Irreversible.
 *
 * `successors` maps a business id to the member inheriting it, and is required
 * for every shared workspace this account owns.
 */
export async function deleteAccount(
  password: string,
  successors: Record<string, string> = {}
): Promise<void> {
  await apiFetch<{ success: boolean }>('/v1/me', {
    method: 'DELETE',
    body: JSON.stringify({ password, successors }),
  });
}

/**
 * Derive a stable, human-friendly Finquanta account ID from the user's UUID.
 * e.g. "3f9a2c..." -> "FQ-3F9A2C"
 */
export function finquantaAccountId(userId: string): string {
  const hex = (userId || '').replace(/[^a-fA-F0-9]/g, '').slice(0, 6).toUpperCase();
  return `FQ-${hex || '000000'}`;
}

/**
 * The signed-in user's own phone number.
 *
 * Distinct from the BUSINESS phone (`/v1/me/business`, `businessPhone`): one is
 * how to reach a person, the other how to reach a company, and a sole trader
 * having the same digits in both does not make them the same field. The admin
 * panel shows them on different tabs for the same reason.
 *
 * Stored on `user_profiles.phone`, which has existed all along — nothing had
 * ever asked for it, so every row was empty.
 */
export async function getMyPhone(): Promise<string> {
  // /v1/me already returns the whole profile, so this needs no endpoint of its
  // own — and the sidebar is loading /v1/me anyway.
  const me = await getMe();
  return (me.profile?.phone as string) ?? '';
}

export async function saveMyPhone(phone: string): Promise<void> {
  await saveMyProfile({ phone });
}

/**
 * Patch the signed-in user's profile.
 *
 * Every field on the personal settings section maps to a real column that has
 * existed all along — `job_title`, `company_email`, `linkedin`,
 * `date_of_incorporation`, `country`, `phone`. The page simply never read or
 * wrote any of them, so anything typed there was discarded on navigation.
 */
export interface MyProfilePatch {
  phone?: string;
  jobTitle?: string;
  companyEmail?: string;
  linkedin?: string;
  dateOfIncorporation?: string;
  country?: string;
}

export async function saveMyProfile(patch: MyProfilePatch): Promise<void> {
  await apiFetch('/v1/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
