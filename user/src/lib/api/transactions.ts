import { apiFetch, serverApiUrl } from './client';

export type Recurrence = 'once' | 'monthly' | 'yearly';

export interface TransactionInput {
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string; // YYYY-MM-DD
  description?: string;
  invoice?: string;
  recurrence?: Recurrence;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: string;
  date: string;
  description?: string;
  invoice?: string;
}

// The backend stores recurrence inside the transaction's metadata JSONB.
function toPayload(data: Partial<TransactionInput>) {
  const { recurrence, ...rest } = data;
  return recurrence ? { ...rest, metadata: { recurrence } } : rest;
}

export async function createTransaction(data: TransactionInput): Promise<Transaction> {
  return apiFetch<Transaction>('/v1/financial/transactions', {
    method: 'POST',
    body: JSON.stringify(toPayload(data)),
  });
}

export async function updateTransaction(id: string, data: Partial<TransactionInput>): Promise<Transaction> {
  return apiFetch<Transaction>(`/v1/financial/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(toPayload(data)),
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  await apiFetch(`/v1/financial/transactions/${id}`, { method: 'DELETE' });
}

/** Upload a receipt (PDF/image) for a transaction. */
export async function uploadReceipt(transactionId: string, file: File): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(serverApiUrl(`/v1/financial/transactions/${transactionId}/receipt`), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const body = await res.json();
      message = body?.message || body?.error || message;
    } catch { /* no body */ }
    throw new Error(message);
  }
}

/**
 * Fetch a receipt with auth and return a blob URL (so it can be opened in a new
 * tab — a plain link wouldn't send the Authorization header).
 */
export async function getReceiptObjectUrl(transactionId: string): Promise<string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const res = await fetch(serverApiUrl(`/v1/financial/transactions/${transactionId}/receipt`), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error('Could not load receipt');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
