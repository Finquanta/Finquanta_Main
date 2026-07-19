import { apiFetch } from './client';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type AccountCode =
  | 'CASH' | 'AR' | 'AP' | 'LOAN_PAYABLE' | 'LOAN_RECEIVABLE'
  | 'REVENUE' | 'EXPENSE' | 'INTEREST_EXPENSE' | 'INTEREST_INCOME' | 'EQUITY';

export type WorkflowType =
  | 'cash_revenue' | 'credit_revenue' | 'receive_ar_payment'
  | 'cash_expense' | 'credit_expense' | 'pay_ap'
  | 'loan_received' | 'loan_payment';

export type AccountingBasis = 'cash' | 'accrual';

export interface WorkflowMeta {
  label: string;
  /** Plain-English explanation of what the entry actually does. */
  description: string;
  /** bookkeeping = simple cash basis; accounting = accrual (AR/AP/debt). */
  module: 'bookkeeping' | 'accounting';
  basis: AccountingBasis;
  /** Grouping in the UI. Loans live under "Debt". */
  group: 'cash' | 'accrual' | 'debt';
  affectsCash: boolean;
}

/**
 * CASH BASIS records only money that actually moved. ACCRUAL adds obligations:
 * receivables, payables. DEBT covers loans (handled by the Loans module so each
 * payment can split principal vs interest).
 */
export const WORKFLOW_META: Record<WorkflowType, WorkflowMeta> = {
  cash_revenue: {
    label: 'Money received (cash flow)',
    description: 'Cash comes in and revenue increases.',
    module: 'bookkeeping', basis: 'cash', group: 'cash', affectsCash: true,
  },
  cash_expense: {
    label: 'Money paid out (expense)',
    description: 'Cash goes out and expenses increase.',
    module: 'bookkeeping', basis: 'cash', group: 'cash', affectsCash: true,
  },
  credit_revenue: {
    label: 'Accounts Receivable',
    description: 'Customer pays on credit and revenue increases. Once the customer pays, business cash increases and Accounts Receivable decreases.',
    module: 'accounting', basis: 'accrual', group: 'accrual', affectsCash: false,
  },
  credit_expense: {
    label: 'Accounts Payable',
    description: 'Business buys on credit and expenses increase. Once the business pays the bill, cash decreases and Accounts Payable decreases.',
    module: 'accounting', basis: 'accrual', group: 'accrual', affectsCash: false,
  },
  receive_ar_payment: {
    label: 'Increase Revenue (Increase Business Cash)',
    description: 'Your customer paid what they owed. Business Cash increases and Accounts Receivable decreases by the same amount.',
    module: 'accounting', basis: 'accrual', group: 'accrual', affectsCash: true,
  },
  pay_ap: {
    label: 'Increase Expense (Decrease Business Cash)',
    description: 'You paid a bill you owed. Business Cash decreases and Accounts Payable decreases by the same amount.',
    module: 'accounting', basis: 'accrual', group: 'accrual', affectsCash: true,
  },
  loan_received: {
    label: 'Loan Payable Increase (Business Cash Increase)',
    description: 'You borrowed money. The loan you owe goes up, and your business cash goes up by the same amount.',
    module: 'accounting', basis: 'accrual', group: 'debt', affectsCash: true,
  },
  loan_payment: {
    label: 'Loan Payable Decrease (Business Cash Decrease)',
    description: 'You made a payment on a loan you owe. Cash goes down by the full payment; the loan balance drops by the principal portion, and the interest portion is recorded as Interest Expense.',
    module: 'accounting', basis: 'accrual', group: 'debt', affectsCash: true,
  },
};

export const workflowsFor = (module: 'bookkeeping' | 'accounting'): WorkflowType[] =>
  (Object.keys(WORKFLOW_META) as WorkflowType[]).filter((t) => WORKFLOW_META[t].module === module);

export const workflowsInGroup = (group: 'cash' | 'accrual' | 'debt'): WorkflowType[] =>
  (Object.keys(WORKFLOW_META) as WorkflowType[]).filter((t) => WORKFLOW_META[t].group === group);

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

export interface JournalEntry {
  id: string;
  date: string | null;
  description: string;
  sourceType: string;
  sourceId: string | null;
  createdAt: string | null;
  lines: JournalLine[];
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
  /** The free-text note typed on the entry, shown under its name. */
  note: string | null;
  hasReceipt: boolean;
  recurrence: string | null;
  /** Foreign currency the entry was made in (null when USD). */
  currency: string | null;
  /** The amount in that currency, before it was converted to the USD above. */
  originalAmount: number | null;
  lines: JournalLine[];
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
  return apiFetch<LedgerTransaction[]>(`/v1/accounting/transactions?basis=${basis}&limit=${limit}`);
}

export async function getAccounts(): Promise<AccountBalance[]> {
  return apiFetch<AccountBalance[]>('/v1/accounting/accounts');
}

/**
 * The ledger. `basis: 'cash'` returns only entries where money actually moved
 * (what the simple bookkeeping view reports); 'accrual' returns everything,
 * including receivables/payables that moved no cash.
 */
export async function getEntries(limit = 100, basis: AccountingBasis = 'accrual'): Promise<JournalEntry[]> {
  return apiFetch<JournalEntry[]>(`/v1/accounting/entries?limit=${limit}&basis=${basis}`);
}

/** Record a business event; the engine builds the balanced accounting entry. */
export async function runWorkflow(data: {
  type: WorkflowType;
  amount: number;
  interest?: number;
  description?: string;
  date?: string;
}): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/v1/accounting/workflows', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
