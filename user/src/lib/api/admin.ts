import { apiFetch } from './client';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
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

/** Confirm the current token belongs to an admin. Throws on 401/403. */
export async function checkAdmin(): Promise<{ id: string; email: string; role: string }> {
  return apiFetch('/v1/admin/me');
}
