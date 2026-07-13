import { apiFetch, serverApiUrl } from './client';

export interface Maintenance {
  enabled: boolean;
  message: string;
}

/**
 * Public — no auth. Logged-out visitors on the marketing site must see the
 * banner too, so this deliberately doesn't go through the authed apiFetch.
 */
export async function getMaintenance(): Promise<Maintenance> {
  const res = await fetch(serverApiUrl('/v1/site/maintenance'));
  if (!res.ok) throw new Error('Could not read site settings');
  const json = await res.json();
  return (json?.data ?? json) as Maintenance;
}

/** Admin only. */
export const setMaintenance = (data: Maintenance) =>
  apiFetch<Maintenance>('/v1/admin/site/maintenance', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
