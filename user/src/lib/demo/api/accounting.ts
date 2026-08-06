/**
 * Demo mirror of lib/api/accounting.ts — same exported names/signatures, backed
 * by the sessionStorage ledger instead of apiFetch. Every demo entry (cash,
 * accrual, invoice, loan) lands here, so the Bookkeeping list and the account
 * balances are derived from one source of truth, exactly as they are server-side.
 */
import { DemoAccountCode, DemoJournalEntry, DemoJournalLine, DemoState, DemoWorkflowType } from '../types';
import { load, save, recordInteraction, assertUnderCap, appendOp, newOpId, postEntry } from '../store';
import { buildWorkflow, WORKFLOW_META } from '../ledger';
import { todayLocal } from '../dates';
import { DemoError } from '../errors';

export type AccountCode = DemoAccountCode;
export type WorkflowType = DemoWorkflowType;
export type AccountingBasis = 'cash' | 'accrual';
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export { WORKFLOW_META, workflowsInGroup } from '../ledger';

const ACCOUNTS: Record<AccountCode, { name: string; type: AccountType }> = {
  CASH: { name: 'Business Cash', type: 'asset' },
  AR: { name: 'Accounts Receivable', type: 'asset' },
  LOAN_RECEIVABLE: { name: 'Loan Receivable', type: 'asset' },
  AP: { name: 'Accounts Payable', type: 'liability' },
  LOAN_PAYABLE: { name: 'Loan Payable', type: 'liability' },
  EQUITY: { name: 'Owner Equity', type: 'equity' },
  REVENUE: { name: 'Revenue', type: 'revenue' },
  INTEREST_INCOME: { name: 'Interest Income', type: 'revenue' },
  EXPENSE: { name: 'Expenses', type: 'expense' },
  INTEREST_EXPENSE: { name: 'Interest Expense', type: 'expense' },
};

export interface AccountBalance {
  id: string;
  code: AccountCode;
  name: string;
  type: AccountType;
  balance: number;
}

export interface JournalLine {
  accountCode: AccountCode;
  accountName: string;
  accountType: AccountType;
  debit: number;
  credit: number;
}

/** A row in the unified Bookkeeping list — plain English, no debits/credits. */
export interface LedgerTransaction {
  id: string;
  date: string | null;
  description: string;
  sourceType: string;
  sourceId: string | null;
  /** Positive = money in / owed to you. Negative = money out / you owe. */
  signedAmount: number;
  direction: 'in' | 'out' | 'owed_to_you' | 'you_owe';
  cashMoved: boolean;
  /** Present only for entries you typed yourself — those stay editable. */
  transactionId: string | null;
  category: string | null;
  note: string | null;
  /** The workflow that produced it, so an accrual row can re-open in its mode. */
  workflowType: WorkflowType | null;
  /**
   * Business Group this row reports under, matching the real LedgerTransaction
   * so the dashboard can show the same group chip. Resolves through the same
   * rule the Groups page uses: an entry pointing at an archived or deleted group
   * reads as Unassigned rather than as a group that no longer exists.
   */
  groupId: string | null;
  lines: JournalLine[];
}

const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const touches = (entry: DemoJournalEntry, code: AccountCode) =>
  entry.lines.find((l) => l.code === code) ?? null;

function toJournalLine(l: DemoJournalLine): JournalLine {
  return {
    accountCode: l.code,
    accountName: ACCOUNTS[l.code].name,
    accountType: ACCOUNTS[l.code].type,
    debit: l.debit,
    credit: l.credit,
  };
}

/**
 * Reduce a balanced entry to the one number a non-accountant wants to see.
 * Cash entries report the cash movement; a pure accrual entry (no cash line)
 * reports the obligation it created instead.
 */
function summarize(entry: DemoJournalEntry) {
  const cash = touches(entry, 'CASH');
  if (cash) {
    const signed = round(cash.debit - cash.credit);
    const direction: LedgerTransaction['direction'] = signed >= 0 ? 'in' : 'out';
    return { signedAmount: signed, direction, cashMoved: true };
  }
  const ar = touches(entry, 'AR');
  if (ar) {
    return { signedAmount: round(ar.debit - ar.credit), direction: 'owed_to_you' as const, cashMoved: false };
  }
  const ap = touches(entry, 'AP');
  if (ap) {
    return { signedAmount: round(ap.debit - ap.credit), direction: 'you_owe' as const, cashMoved: false };
  }
  return { signedAmount: 0, direction: 'in' as const, cashMoved: false };
}

function toLedgerTransaction(entry: DemoJournalEntry, state: DemoState): LedgerTransaction {
  const { signedAmount, direction, cashMoved } = summarize(entry);
  // A bookkeeping entry keeps its own name/note; everything else describes itself.
  const tx = entry.sourceType === 'bookkeeping'
    ? state.transactions.find((t) => t.id === entry.sourceId) ?? null
    : null;

  return {
    id: entry.id,
    date: entry.date,
    description: entry.description,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    signedAmount,
    direction,
    cashMoved,
    transactionId: tx?.id ?? null,
    category: tx?.category ?? null,
    note: tx?.description ?? null,
    workflowType: entry.workflowType,
    groupId: activeGroupId(state, entry.groupId),
    lines: entry.lines.map(toJournalLine),
  };
}

/**
 * A group id only if that group still exists and is active. Mirrors
 * `effectiveGroupId` in api/groups.ts — the Groups page, the group report and
 * this list all have to agree, or a row shows a chip for a group the Groups
 * page no longer lists.
 */
function activeGroupId(state: DemoState, groupId: string | null): string | null {
  if (!groupId) return null;
  return state.groups.some((g) => g.id === groupId && g.status === 'active') ? groupId : null;
}

/**
 * Every transaction, from the ledger.
 *  'cash'    — money that actually moved (your entries + invoice/loan payments)
 *  'accrual' — the above, plus what's owed
 */
export async function listLedgerTransactions(
  basis: AccountingBasis = 'cash',
  limit = 100
): Promise<LedgerTransaction[]> {
  const state = load();
  const rows = state.ledger.entries.map((e) => toLedgerTransaction(e, state));
  const filtered = basis === 'cash' ? rows.filter((r) => r.cashMoved) : rows;
  return filtered
    .sort((a, b) => ((a.date ?? '') < (b.date ?? '') ? 1 : -1))
    .slice(0, limit);
}

export async function getAccounts(): Promise<AccountBalance[]> {
  const state = load();
  const totals = new Map<AccountCode, number>();
  for (const entry of state.ledger.entries) {
    for (const line of entry.lines) {
      const meta = ACCOUNTS[line.code];
      // Assets and expenses grow on the debit side; liabilities, equity and
      // revenue grow on the credit side.
      const natural = meta.type === 'asset' || meta.type === 'expense'
        ? line.debit - line.credit
        : line.credit - line.debit;
      totals.set(line.code, round((totals.get(line.code) ?? 0) + natural));
    }
  }
  return [...totals.entries()]
    .filter(([, balance]) => balance !== 0)
    .map(([code, balance]) => ({ id: code, code, name: ACCOUNTS[code].name, type: ACCOUNTS[code].type, balance }));
}

export async function getEntries(limit = 100): Promise<DemoJournalEntry[]> {
  return [...load().ledger.entries].reverse().slice(0, limit);
}

/** Record a business event; the engine builds the balanced accounting entry. */
export async function runWorkflow(data: {
  type: WorkflowType;
  amount: number;
  interest?: number;
  description?: string;
  date?: string;
  /** Business Group to attribute this accrual entry to. */
  groupId?: string | null;
}): Promise<{ id: string }> {
  const state = load();
  assertUnderCap(state);

  const built = buildWorkflow(data.type, {
    amount: data.amount,
    interest: data.interest,
    description: data.description,
  });
  const entry = postEntry(state, {
    date: data.date || todayLocal(),
    description: built.description,
    sourceType: 'manual',
    workflowType: data.type,
    groupId: data.groupId ?? null,
    lines: built.lines,
  });
  appendOp(state, { opId: newOpId(), kind: 'accrual', entryId: entry.id, at: Date.now() });
  recordInteraction(state);
  save(state);
  return { id: entry.id };
}

/**
 * Delete a manual (accrual) entry. Entries owned by an invoice or a loan are
 * refused here exactly as they are server-side — delete the source document
 * instead, so its books and its record stay in step.
 */
export async function deleteEntry(entryId: string): Promise<void> {
  const state = load();
  const entry = state.ledger.entries.find((e) => e.id === entryId);
  if (!entry) throw new DemoError('eEntryNF', 'Entry not found');
  if (entry.sourceType !== 'manual') {
    throw new DemoError('eEntryOwned', 'This entry belongs to an invoice, a loan or a bookkeeping entry — delete that instead.');
  }
  state.ledger.entries = state.ledger.entries.filter((e) => e.id !== entryId);
  state.createdOrder = state.createdOrder.filter((op) => !(op.kind === 'accrual' && op.entryId === entryId));
  recordInteraction(state);
  save(state);
}
