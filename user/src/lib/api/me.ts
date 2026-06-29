import { apiFetch } from './client';

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  emailVerified: boolean;
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
 * Derive a stable, human-friendly Finquanta account ID from the user's UUID.
 * e.g. "3f9a2c..." -> "FQ-3F9A2C"
 */
export function finquantaAccountId(userId: string): string {
  const hex = (userId || '').replace(/[^a-fA-F0-9]/g, '').slice(0, 6).toUpperCase();
  return `FQ-${hex || '000000'}`;
}
