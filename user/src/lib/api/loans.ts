import { apiFetch } from './client';

/**
 * payable    — money you BORROWED (a liability). Payments split into principal
 *              (Loan Payable ↓) and Interest Expense ↑.
 * receivable — money you LENT OUT (an asset — the mirror opposite). Repayments
 *              split into principal (Loan Receivable ↓) and Interest Income ↑.
 */
export type LoanType = 'payable' | 'receivable';

export interface Loan {
  id: string;
  name: string;
  type: LoanType;
  principal: number;
  annualRate: number;
  remainingBalance: number;
  startDate: string | null;
  createdAt: string | null;
}

export interface LoanPayment {
  id: string;
  loanId: string;
  date: string | null;
  amount: number;
  interest: number;
  principal: number;
  balanceAfter: number;
  entryId: string | null;
}

export const listLoans = (type?: LoanType) =>
  apiFetch<Loan[]>(`/v1/loans${type ? `?type=${type}` : ''}`);

export const listLoanPayments = (loanId: string) =>
  apiFetch<LoanPayment[]>(`/v1/loans/${loanId}/payments`);

export const createLoan = (data: {
  name: string; type: LoanType; amount: number; annualRate: number; date?: string;
}) => apiFetch<Loan>('/v1/loans', { method: 'POST', body: JSON.stringify(data) });

/** The principal/interest split is computed server-side from the loan's rate + balance. */
export const recordLoanPayment = (loanId: string, data: { amount: number; date?: string }) =>
  apiFetch<{ payment: LoanPayment; loan: Loan }>(`/v1/loans/${loanId}/payments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

/**
 * Preview the split before saving, so the user sees principal vs interest as
 * they type. Mirrors the server's splitPayment() exactly.
 */
export function previewSplit(payment: number, remainingBalance: number, annualRate: number) {
  const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
  const pay = round(payment);
  const balance = round(remainingBalance);
  const monthlyInterest = round((balance * ((Number(annualRate) || 0) / 100)) / 12);
  const interest = round(Math.min(monthlyInterest, pay));
  let principal = round(pay - interest);
  if (principal > balance) principal = balance;
  return { interest, principal, balanceAfter: round(balance - principal) };
}
