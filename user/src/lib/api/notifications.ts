import { apiFetch } from './client';

export type Audience = 'all' | 'verified' | 'unverified';

export interface InboxItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface SentNotification {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  createdAt: string;
  /** When it goes out. Null means it went immediately. */
  scheduledFor: string | null;
  /** False while a scheduled notification is still waiting to be delivered. */
  delivered: boolean;
  authorName?: string;
  /** How many users it is addressed to (projected, if still queued). */
  recipients?: number;
  readCount?: number;
}

/* User inbox */
export const getNotifications = () => apiFetch<InboxItem[]>('/v1/notifications');
export const markNotificationRead = (id: string) =>
  apiFetch<void>(`/v1/notifications/${id}/read`, { method: 'POST' });
export const markAllNotificationsRead = () =>
  apiFetch<void>('/v1/notifications/read-all', { method: 'POST' });

/* Admin */
export const getSentNotifications = () => apiFetch<SentNotification[]>('/v1/admin/notifications');
export const sendNotification = (
  data: { title: string; body: string; audience: Audience; scheduledFor?: string | null }
) =>
  apiFetch<SentNotification>('/v1/admin/notifications', {
    method: 'POST',
    body: JSON.stringify(data),
  });
export const deleteNotification = (id: string) =>
  apiFetch<{ id: string }>(`/v1/admin/notifications/${id}`, { method: 'DELETE' });
