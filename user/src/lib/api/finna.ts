import { apiFetch } from './client';

/**
 * Saved Finna chats.
 *
 * Storage only — none of these calls costs anything. Reopening an old
 * conversation reads stored JSON; the AI is only involved when you send a new
 * message through /api/chat.
 *
 * Scoped per user as well as per business: colleagues sharing a workspace don't
 * read each other's questions to Finna.
 */

export interface FinnaMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface FinnaConversation {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FinnaConversationDetail extends FinnaConversation {
  messages: FinnaMessage[];
}

export const listFinnaChats = () =>
  apiFetch<FinnaConversation[]>('/v1/finna/conversations');

export const createFinnaChat = (title: string) =>
  apiFetch<FinnaConversation>('/v1/finna/conversations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });

export const getFinnaChat = (id: string) =>
  apiFetch<FinnaConversationDetail>(`/v1/finna/conversations/${id}`);

/** Append the latest exchange so the chat survives closing the widget. */
export const appendFinnaMessages = (id: string, messages: FinnaMessage[]) =>
  apiFetch<{ ok: boolean }>(`/v1/finna/conversations/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });

export const renameFinnaChat = (id: string, title: string) =>
  apiFetch<FinnaConversation>(`/v1/finna/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });

export const deleteFinnaChat = (id: string) =>
  apiFetch<{ id: string }>(`/v1/finna/conversations/${id}`, { method: 'DELETE' });
