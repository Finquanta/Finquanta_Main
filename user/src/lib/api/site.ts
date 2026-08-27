import { apiFetch, serverApiUrl } from './client';

export interface Maintenance {
  /** Live RIGHT NOW — either switched on by hand or inside a scheduled window. */
  enabled: boolean;
  /** The switch itself. Differs from `enabled` while a window is running. */
  manual: boolean;
  /** The wording that applies right now — manual wins over scheduled. */
  message: string;
  /** Both, unresolved, so the admin form can edit each on its own. */
  manualMessage: string;
  scheduledMessage: string;
  /** Start of a scheduled window, if one is set. */
  startsAt: string | null;
  endsAt: string | null;
  /** Scheduled but not yet begun. This is what the advance notice reads. */
  upcoming: boolean;
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

/**
 * The same answer, shared between everything that displays it.
 *
 * Two components now ask this on every page load — the banner across the top
 * and the "Under Maintenance" chip in the sidebar — and they must not each open
 * their own request for a value that is identical and changes about twice a
 * year. The in-flight promise is shared, so a second caller during the first
 * call gets the first call rather than a second one.
 *
 * Short TTL rather than forever: an admin who flips the switch should see it
 * take effect without telling everyone to reload. A rejected lookup is NOT
 * cached — a blip must not turn into a minute of "no banner".
 *
 * `getMaintenance()` stays uncached, because the admin panel reads it right
 * after writing it and a stale answer there would look like a failed save.
 */
const SHARED_TTL_MS = 60_000;
let shared: { at: number; value: Promise<Maintenance> } | null = null;

export function getMaintenanceShared(): Promise<Maintenance> {
  const now = Date.now();
  if (shared && now - shared.at < SHARED_TTL_MS) return shared.value;

  const value = getMaintenance();
  shared = { at: now, value };
  value.catch(() => {
    // Only clear if this is still the cached attempt; a newer one may have
    // already replaced it.
    if (shared?.value === value) shared = null;
  });
  return value;
}

/**
 * Admin only.
 *
 * `startsAt`/`endsAt` are tri-state: omit to leave unchanged, empty string to
 * clear, an ISO string to set. The form needs all three.
 */
export const setMaintenance = (data: {
  enabled: boolean;
  /** The MANUAL banner's wording. */
  message: string;
  /** The scheduled window's own wording. Tri-state like the dates. */
  scheduledMessage?: string;
  startsAt?: string | null;
  endsAt?: string | null;
}) =>
  apiFetch<Maintenance>('/v1/admin/site/maintenance', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
