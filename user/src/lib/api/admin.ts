import { apiFetch } from './client';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joinedAt: string | null;
  dateOfBirth: string | null;
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
  data: { firstName?: string; lastName?: string; role?: string; status?: string; dateOfBirth?: string | null; businessName?: string; country?: string }
): Promise<void> {
  await apiFetch(`/v1/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteAdminUser(id: string): Promise<void> {
  await apiFetch(`/v1/admin/users/${id}`, { method: 'DELETE' });
}

/** Set a user's password directly (admin-only, subject to role hierarchy). */
export async function setAdminUserPassword(id: string, password: string): Promise<void> {
  await apiFetch(`/v1/admin/users/${id}/password`, { method: 'PATCH', body: JSON.stringify({ password }) });
}

export interface AdminUsage {
  configured: boolean;
  monthToDateUsd?: number;
  currency?: string;
  since?: string;
  until?: string;
  error?: string;
}

/** Anthropic month-to-date spend (needs ANTHROPIC_ADMIN_KEY on the backend). */
export async function getAdminUsage(): Promise<AdminUsage> {
  return apiFetch<AdminUsage>('/v1/admin/usage');
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetId: string | null;
  targetEmail: string | null;
  details: unknown;
  createdAt: string | null;
}

/** Append-only audit trail of admin actions (admin only). */
export async function getAuditLogs(): Promise<AuditLog[]> {
  return apiFetch<AuditLog[]>('/v1/admin/audit');
}
