/**
 * Demo mirror of lib/api/transactions.ts, for cash-basis bookkeeping entries.
 * No recurrence, receipts or foreign currency — those need a real account.
 *
 * Every entry also posts to the demo ledger (cash_revenue / cash_expense), the
 * same way the real bookkeeping module does, so the Bookkeeping list and the
 * account balances can both read from one place.
 */
import { DemoTransaction, DemoWorkflowType } from '../types';
import { load, save, recordInteraction, assertUnderCap, appendOp, newOpId, postEntry, removeEntriesFor } from '../store';
import { WORKFLOWS } from '../ledger';
import { DemoError } from '../errors';

export interface TransactionInput {
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string;
  description?: string;
  invoice?: string;
  /** Business Group this entry is attributed to, if any. */
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

function toTransaction(t: DemoTransaction): Transaction {
  return { ...t, amount: String(t.amount) };
}

/** The ledger entry a cash entry posts. Rebuilt on edit so the books follow. */
function entryFor(t: DemoTransaction, groupId: string | null) {
  const workflowType: DemoWorkflowType = t.type === 'income' ? 'cash_revenue' : 'cash_expense';
  const built = WORKFLOWS[workflowType]({ amount: t.amount, description: t.category });
  return {
    date: t.date,
    description: t.category,
    sourceType: 'bookkeeping' as const,
    sourceId: t.id,
    workflowType,
    groupId,
    lines: built.lines,
  };
}

export async function listTransactions(): Promise<Transaction[]> {
  return load().transactions.map(toTransaction);
}

export async function createTransaction(data: TransactionInput): Promise<Transaction> {
  if (!data.category?.trim()) throw new DemoError('eCatReq', 'Category is required.');
  if (!(Number(data.amount) > 0)) throw new DemoError('eAmountPos', 'Amount must be greater than zero.');
  if (!data.date) throw new DemoError('eDateReq', 'Date is required.');

  const state = load();
  assertUnderCap(state);

  const record: DemoTransaction = {
    id: crypto.randomUUID(),
    type: data.type,
    category: data.category.trim(),
    amount: Number(data.amount),
    date: data.date,
    description: data.description?.trim() || undefined,
    invoice: data.invoice,
    createdAt: new Date().toISOString(),
  };
  state.transactions.push(record);
  postEntry(state, entryFor(record, data.groupId ?? null));
  appendOp(state, { opId: newOpId(), kind: 'create', entity: 'transaction', entityId: record.id, at: Date.now() });
  recordInteraction(state);
  save(state);
  return toTransaction(record);
}

export async function updateTransaction(id: string, data: Partial<TransactionInput>): Promise<Transaction> {
  const state = load();
  const idx = state.transactions.findIndex((t) => t.id === id);
  if (idx === -1) throw new DemoError('eEntryNF', 'Entry not found');
  const current = state.transactions[idx];
  const updated: DemoTransaction = {
    ...current,
    ...data,
    category: (data.category ?? current.category).trim(),
    amount: data.amount !== undefined ? Number(data.amount) : current.amount,
  };
  state.transactions[idx] = updated;
  // Re-post: the old entry no longer describes what happened. The group it was
  // assigned to is carried over unless the edit names a different one.
  const previousGroupId = state.ledger.entries.find((e) => e.sourceId === id)?.groupId ?? null;
  removeEntriesFor(state, id);
  postEntry(state, entryFor(updated, data.groupId !== undefined ? data.groupId : previousGroupId));
  recordInteraction(state);
  save(state);
  return toTransaction(updated);
}

export async function deleteTransaction(id: string): Promise<void> {
  const state = load();
  state.transactions = state.transactions.filter((t) => t.id !== id);
  removeEntriesFor(state, id);
  state.createdOrder = state.createdOrder.filter(
    (op) => !(op.kind === 'create' && op.entity === 'transaction' && op.entityId === id)
  );
  recordInteraction(state);
  save(state);
}
