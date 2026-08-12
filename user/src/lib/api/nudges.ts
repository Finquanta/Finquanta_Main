import { apiFetch } from './client';

/**
 * Proactive Finna (Council spec §9/10).
 *
 * Every call here is free. `getNudge` runs deterministic checks server-side and
 * returns a message KEY plus numbers — never generated text — so it's safe to
 * ask for on page load. Cost only begins if the user acts on the offer.
 */

export type NudgeAction = 'convene' | 'review';

export interface Nudge {
  key: string;
  /** i18n key for the pre-written copy. */
  messageKey: string;
  params?: Record<string, number | string>;
  action: NudgeAction;
  /** Set when action is 'review' — the decision to look back at. */
  sessionId?: string;
}

export const getNudge = () => apiFetch<{ nudge: Nudge | null }>('/v1/nudges');

/** Dismissed twice and the trigger retires for good. */
export const dismissNudge = (key: string) =>
  apiFetch<{ ok: boolean }>(`/v1/nudges/${key}/dismiss`, { method: 'POST' });

/** Logged so triggers nobody acts on can be found and removed. */
export const engageNudge = (key: string) =>
  apiFetch<{ ok: boolean }>(`/v1/nudges/${key}/engaged`, { method: 'POST' });

export const getNudgeSettings = () =>
  apiFetch<{ enabled: boolean }>('/v1/nudges/settings');

export const setNudgesEnabled = (enabled: boolean) =>
  apiFetch<{ enabled: boolean }>('/v1/nudges/settings', {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
