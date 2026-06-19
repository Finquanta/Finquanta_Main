import { apiFetch } from './client';

export interface TransactionInput {
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string; // YYYY-MM-DD
  description?: string;
  invoice?: string;
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

export async function createTransaction(data: TransactionInput): Promise<Transaction> {
  return apiFetch<Transaction>('/v1/financial/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTransaction(id: string, data: Partial<TransactionInput>): Promise<Transaction> {
  return apiFetch<Transaction>(`/v1/financial/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  await apiFetch(`/v1/financial/transactions/${id}`, { method: 'DELETE' });
}
