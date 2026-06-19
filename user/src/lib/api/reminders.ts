import { apiFetch } from './client';

export interface Reminder {
  id: string;
  text: string;
  remindAt: string | null;
  done: boolean;
}

export async function getReminders(): Promise<Reminder[]> {
  return apiFetch<Reminder[]>('/v1/reminders');
}

export async function createReminder(data: { text: string; remindAt?: string | null }): Promise<Reminder> {
  return apiFetch<Reminder>('/v1/reminders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateReminder(id: string, data: { text?: string; remindAt?: string | null; done?: boolean }): Promise<Reminder> {
  return apiFetch<Reminder>(`/v1/reminders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteReminder(id: string): Promise<void> {
  await apiFetch(`/v1/reminders/${id}`, { method: 'DELETE' });
}
