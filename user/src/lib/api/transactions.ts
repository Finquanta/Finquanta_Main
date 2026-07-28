import { apiFetch, serverApiUrl } from './client';

export type Recurrence = 'once' | 'monthly' | 'yearly';

export interface TransactionInput {
  type: 'income' | 'expense';
  category: string;
  /** ALWAYS in USD (the base currency the books are kept in). */
  amount: number;
  date: string; // YYYY-MM-DD
  description?: string;
  invoice?: string;
  recurrence?: Recurrence;
  /** The currency the money actually moved in, if not USD. */
  currency?: string;
  /** The amount in that currency, before conversion to USD. */
  originalAmount?: number;
  /** The rate used to convert originalAmount → the USD amount above. */
  exchangeRate?: number;
  /** Business Group (cost/profit center) this entry belongs to, if any. */
  groupId?: string | null;
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

// Recurrence and currency both live in the transaction's metadata JSONB — the
// `amount` column stays pure USD so the ledger never sees a foreign figure.
function toPayload(data: Partial<TransactionInput>) {
  const { recurrence, currency, originalAmount, exchangeRate, groupId, ...rest } = data;

  const metadata: Record<string, unknown> = {};
  if (recurrence) metadata.recurrence = recurrence;
  // Only record the currency block when it's genuinely foreign.
  if (currency && currency !== 'USD') {
    metadata.currency = currency;
    if (originalAmount !== undefined) metadata.originalAmount = originalAmount;
    if (exchangeRate !== undefined) metadata.exchangeRate = exchangeRate;
  }
  // groupId is sent whenever the field is present so clearing it on an edit
  // (null) actually removes the group, rather than being silently dropped.
  if (groupId !== undefined) metadata.groupId = groupId ?? null;

  return Object.keys(metadata).length > 0 ? { ...rest, metadata } : rest;
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

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    const businessId = localStorage.getItem('activeBusinessId');
    if (token) headers.Authorization = `Bearer ${token}`;
    if (businessId) headers['X-Business-Id'] = businessId;
  }
  return headers;
}

/** Upload a receipt (PDF/image) for a transaction. */
export async function uploadReceipt(transactionId: string, file: File): Promise<void> {
  if (!transactionId) throw new Error('Cannot attach receipt: missing transaction id.');
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(serverApiUrl(`/v1/financial/transactions/${transactionId}/receipt`), {
    method: 'POST',
    headers: authHeaders(),
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
  const res = await fetch(serverApiUrl(`/v1/financial/transactions/${transactionId}/receipt`), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Could not load receipt');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
