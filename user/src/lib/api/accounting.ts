import { apiFetch } from './client';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type AccountCode =
  | 'CASH' | 'AR' | 'AP' | 'LOAN_PAYABLE' | 'LOAN_RECEIVABLE'
  | 'REVENUE' | 'EXPENSE' | 'INTEREST_EXPENSE' | 'EQUITY';

export type WorkflowType =
  | 'cash_revenue' | 'credit_revenue' | 'receive_ar_payment'
  | 'cash_expense' | 'credit_expense' | 'pay_ap'
  | 'loan_received' | 'loan_payment';

export type AccountingBasis = 'cash' | 'accrual';

export interface WorkflowMeta {
  label: string;
  /** bookkeeping = simple cash basis; accounting = accrual (AR/AP/loans). */
  module: 'bookkeeping' | 'accounting';
  basis: AccountingBasis;
  affectsCash: boolean;
}

/**
 * CASH BASIS (bookkeeping) records only money that actually moved — cash in and
 * cash out. ACCRUAL (accounting) adds obligations: receivables, payables, loans.
 */
export const WORKFLOW_META: Record<WorkflowType, WorkflowMeta> = {
  cash_revenue:       { label: 'Money received (cash flow)', module: 'bookkeeping', basis: 'cash',    affectsCash: true },
  cash_expense:       { label: 'Money paid out (expense)',   module: 'bookkeeping', basis: 'cash',    affectsCash: true },
  credit_revenue:     { label: 'Revenue billed (paid later)', module: 'accounting', basis: 'accrual', affectsCash: false },
  credit_expense:     { label: 'Expense billed (pay later)',  module: 'accounting', basis: 'accrual', affectsCash: false },
  receive_ar_payment: { label: 'Customer paid me',            module: 'accounting', basis: 'accrual', affectsCash: true },
  pay_ap:             { label: 'I paid a bill',               module: 'accounting', basis: 'accrual', affectsCash: true },
  loan_received:      { label: 'Loan received',               module: 'accounting', basis: 'accrual', affectsCash: true },
  loan_payment:       { label: 'Loan payment made',           module: 'accounting', basis: 'accrual', affectsCash: true },
};

export const workflowsFor = (module: 'bookkeeping' | 'accounting'): WorkflowType[] =>
  (Object.keys(WORKFLOW_META) as WorkflowType[]).filter((t) => WORKFLOW_META[t].module === module);

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
