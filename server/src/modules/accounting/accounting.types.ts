/**
 * Double-entry accounting types.
 *
 * Bookkeeping stays simple for the user; this ledger runs underneath it. Every
 * financial event produces a balanced journal entry (total debits = total
 * credits) built by a workflow in accounting.engine.ts — pure deterministic
 * code, never an AI call.
 */

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

/** Stable identifiers for the seeded chart of accounts. */
export type AccountCode =
  | 'CASH'
  | 'AR'
  | 'AP'
  | 'LOAN_PAYABLE'
  | 'LOAN_RECEIVABLE'
  | 'REVENUE'
  | 'EXPENSE'
  | 'INTEREST_EXPENSE'
  | 'INTEREST_INCOME'
  | 'EQUITY';

export interface AccountDef {
  code: AccountCode;
  name: string;
  type: AccountType;
}

/** Seeded for every business the first time its ledger is touched. */
export const CHART_OF_ACCOUNTS: AccountDef[] = [
  { code: 'CASH', name: 'Business Cash', type: 'asset' },
  { code: 'AR', name: 'Accounts Receivable', type: 'asset' },
  { code: 'LOAN_RECEIVABLE', name: 'Loan Receivable', type: 'asset' },
  { code: 'AP', name: 'Accounts Payable', type: 'liability' },
  { code: 'LOAN_PAYABLE', name: 'Loan Payable', type: 'liability' },
  { code: 'EQUITY', name: "Owner's Equity", type: 'equity' },
  { code: 'REVENUE', name: 'Revenue', type: 'revenue' },
  { code: 'INTEREST_INCOME', name: 'Interest Income', type: 'revenue' },
  { code: 'EXPENSE', name: 'Expenses', type: 'expense' },
  { code: 'INTEREST_EXPENSE', name: 'Interest Expense', type: 'expense' },
];

/**
 * Normal balance side. Assets/expenses increase with debits; liabilities,
 * equity and revenue increase with credits. Used to sign account balances.
 */
export const DEBIT_NORMAL: AccountType[] = ['asset', 'expense'];

export interface AccountBalance {
  id: string;
  code: AccountCode;
  name: string;
  type: AccountType;
  /** Signed by the account's normal balance (a positive figure = normal). */
  balance: number;
}

export interface JournalLineInput {
  code: AccountCode;
  debit: number;
  credit: number;
}

export interface CreateEntryInput {
  businessId: string;
  description: string;
  /** Where this entry came from: 'manual' | 'bookkeeping' | 'invoice' | 'loan' | … */
  sourceType: string;
  sourceId?: string | null;
  createdBy?: string | null;
  date?: string | null; // 'YYYY-MM-DD'; defaults to today
  lines: JournalLineInput[];
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
