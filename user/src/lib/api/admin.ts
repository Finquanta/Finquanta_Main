import { apiFetch } from './client';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joinedAt: string | null;
  company: string;
  country: string;
  industry: string;
  incorporation: string;
}

/** List all users (admin only — 403 if the caller isn't an admin). */
export async function listAdminUsers(): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>('/v1/admin/users');
}

/** Confirm the current token belongs to an admin and get the caller's role. */
export async function checkAdmin(): Promise<{ id: string; email: string; role: string }> {
  return apiFetch('/v1/admin/me');
}

/** Edit a user: name, role (owner only), and/or status ('active' | 'suspended'). */
export async function updateAdminUser(
  id: string,
  data: { firstName?: string; lastName?: string; role?: string; status?: string }
): Promise<void> {
  await apiFetch(`/v1/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteAdminUser(id: string): Promise<void> {
  await apiFetch(`/v1/admin/users/${id}`, { method: 'DELETE' });
}
