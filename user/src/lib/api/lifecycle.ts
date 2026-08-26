import { apiFetch, serverApiUrl } from './client';

/**
 * The four scheduled reminders, and the per-type opt-out for each.
 *
 * Kept in step with `REMINDER_TYPES` on the server — the unsubscribe endpoint
 * rejects anything it does not recognise, so a typo here is a broken link in an
 * email rather than a silent no-op.
 */
export const REMINDER_TYPES = [
  'email_verification',
  'phone_recovery',
  'upgrade_nudge',
  'workspace_reengagement',
] as const;

export type ReminderType = (typeof REMINDER_TYPES)[number];

/**
 * The other switches on Settings -> Notifications.
 *
 * These three rendered before this and saved nowhere — held in React state by
 * `profile-settings/page.tsx` and dropped on unmount, so every one of them reset
 * itself the moment you left the page. They now persist in the same per-user
 * store as the reminder emails.
 */
export const NOTIFICATION_KEYS = [
  'news_updates',
  'in_app_reminders',
  'push_notifications',
] as const;

export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];
export type PreferenceKey = ReminderType | NotificationKey;
export type EmailPreferences = Record<PreferenceKey, boolean>;

/**
 * Labels for the three in-app switches.
 *
 * Two of them say plainly that nothing uses them yet. A switch that claims to
 * control something it does not is worse than no switch: it is a promise the
 * product quietly breaks.
 */
export const NOTIFICATION_LABELS: Record<NotificationKey, { title: string; description: string }> = {
  news_updates: {
    title: 'News and Updates',
    description: 'Occasional product news. Not sending yet — your choice is saved for when it does.',
  },
  in_app_reminders: {
    title: 'Reminders',
    description: 'Reminders you set yourself, shown in the dashboard.',
  },
  push_notifications: {
    title: 'Push Notifications',
    description: 'Browser notifications. Not built yet — your choice is saved for when it is.',
  },
};

/** Plain-English labels, shown in settings and on the unsubscribe page. */
export const REMINDER_LABELS: Record<ReminderType, { title: string; description: string }> = {
  email_verification: {
    title: 'Confirm your email address',
    description: 'A reminder while your address is unconfirmed. Needed to help you back into your account.',
  },
  phone_recovery: {
    title: 'Add a recovery phone number',
    description: 'A reminder while there is no phone number on file for account recovery.',
  },
  upgrade_nudge: {
    title: 'Plan suggestions',
    description: 'Occasional notes about plans when you are close to the limits of the free one.',
  },
  workspace_reengagement: {
    title: 'Workspace reminders',
    description: 'A nudge if nobody has opened your workspace for a couple of months.',
  },
};

// ------------------------------------------------------------- signed-in side

export async function getEmailPreferences(): Promise<EmailPreferences> {
  return apiFetch<EmailPreferences>('/v1/me/email-preferences');
}

export async function saveEmailPreferences(patch: Partial<EmailPreferences>): Promise<EmailPreferences> {
  return apiFetch<EmailPreferences>('/v1/me/email-preferences', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

// ------------------------------------------------------------ logged-out side

export interface UnsubscribeInfo {
  email: string;
  preferences: EmailPreferences;
}

/**
 * Raw `fetch` rather than `apiFetch`, on purpose.
 *
 * Someone clicking unsubscribe in an email is very often not signed in — that is
 * the whole point of a one-click unsubscribe, and it is what CAN-SPAM and
 * Gmail's bulk-sender rules require. `apiFetch` attaches a session and treats a
 * 401 as a dead one, which would bounce them to the login page instead of
 * honouring the request.
 */
export async function getUnsubscribeInfo(token: string): Promise<UnsubscribeInfo> {
  const res = await fetch(serverApiUrl(`/v1/unsubscribe?t=${encodeURIComponent(token)}`));
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'That link is not valid.');
  return json.data as UnsubscribeInfo;
}

export async function unsubscribe(
  token: string,
  opts: { type?: ReminderType; all?: boolean }
): Promise<void> {
  const res = await fetch(serverApiUrl('/v1/unsubscribe'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...opts }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Could not update that.');
}

/**
 * Turn a reminder back ON from the unsubscribe page, without signing in.
 *
 * The page could only ever switch things off, which makes a misclick permanent
 * for anyone who cannot remember their password — and "I turned it off by
 * accident" is a support ticket, not a preference. Same token, same page.
 */
export async function resubscribe(token: string, type: ReminderType): Promise<void> {
  const res = await fetch(serverApiUrl('/v1/unsubscribe/resume'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, type }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Could not update that.');
}
