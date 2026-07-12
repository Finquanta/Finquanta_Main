import { apiFetch } from './client';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type AccountCode =
  | 'CASH' | 'AR' | 'AP' | 'LOAN_PAYABLE' | 'LOAN_RECEIVABLE'
  | 'REVENUE' | 'EXPENSE' | 'INTEREST_EXPENSE' | 'EQUITY';

export type WorkflowType =
  | 'cash_revenue' | 'credit_revenue' | 'receive_ar_payment'
  | 'cash_expense' | 'credit_expense' | 'pay_ap'
  | 'loan_received' | 'loan_payment';

/** Plain-English labels for the workflows (what the user actually picks). */
export const WORKFLOW_LABELS: Record<WorkflowType, string> = {
  cash_revenue: 'Revenue received now',
  credit_revenue: 'Revenue billed (paid later)',
  receive_ar_payment: 'Customer paid me',
  cash_expense: 'Expense paid now',
  credit_expense: 'Expense billed (pay later)',
  pay_ap: 'I paid a bill',
  loan_received: 'Loan received',
  loan_payment: 'Loan payment made',
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

export async function getEntries(limit = 100): Promise<JournalEntry[]> {
  return apiFetch<JournalEntry[]>(`/v1/accounting/entries?limit=${limit}`);
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
