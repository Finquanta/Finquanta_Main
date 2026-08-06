/**
 * Demo mirror of lib/api/loans.ts. The principal/interest split is computed with
 * the same formula the server uses (see previewSplit), so a demo loan amortises
 * exactly like a real one.
 */
import { DemoLoan, DemoLoanPayment, DemoLoanType } from '../types';
import { load, save, recordInteraction, assertUnderCap, appendOp, newOpId, postEntry, removeEntriesFor } from '../store';
import { WORKFLOWS, loanIssued, loanRepaymentReceived } from '../ledger';
import { todayLocal } from '../dates';
import { DemoError } from '../errors';

export type LoanType = DemoLoanType;
export type Loan = DemoLoan;
export type LoanPayment = DemoLoanPayment;

const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Preview the split before saving, so the user sees principal vs interest as
 * they type. Mirrors the server's splitPayment() exactly.
 */
export function previewSplit(payment: number, remainingBalance: number, annualRate: number) {
  const pay = round(payment);
  const balance = round(remainingBalance);
  const monthlyInterest = round((balance * ((Number(annualRate) || 0) / 100)) / 12);
  const interest = round(Math.min(monthlyInterest, pay));
  let principal = round(pay - interest);
  if (principal > balance) principal = balance;
  return { interest, principal, balanceAfter: round(balance - principal) };
}

export async function listLoans(type?: LoanType): Promise<Loan[]> {
  const loans = load().loans;
  return type ? loans.filter((l) => l.type === type) : loans;
}

export async function listLoanPayments(loanId: string): Promise<LoanPayment[]> {
  return load().loanPayments.filter((p) => p.loanId === loanId);
}

export async function createLoan(data: {
  name: string; type: LoanType; amount: number; annualRate: number; date?: string; groupId?: string | null;
}): Promise<Loan> {
  if (!data.name?.trim()) throw new DemoError('eLoanName', 'Give the loan a name.');
  const amount = round(data.amount);
  if (!(amount > 0)) throw new DemoError('eAmountPos', 'Amount must be greater than zero.');

  const state = load();
  assertUnderCap(state);

  const date = data.date || todayLocal();
  const loan: DemoLoan = {
    id: crypto.randomUUID(),
    name: data.name.trim(),
    type: data.type,
    principal: amount,
    annualRate: Number(data.annualRate) || 0,
    remainingBalance: amount,
    startDate: date,
    createdAt: new Date().toISOString(),
  };
  state.loans.push(loan);

  // Borrowing brings cash in against a payable; lending sends cash out against
  // a receivable. Both post the moment the loan is recorded.
  postEntry(state, {
    date,
    description: data.type === 'payable' ? `Loan received — ${loan.name}` : `Loan issued — ${loan.name}`,
    sourceType: 'loan',
    sourceId: loan.id,
    workflowType: data.type === 'payable' ? 'loan_received' : null,
    groupId: data.groupId ?? null,
    lines: data.type === 'payable' ? WORKFLOWS.loan_received({ amount }).lines : loanIssued(amount),
  });

  appendOp(state, { opId: newOpId(), kind: 'create', entity: 'loan', entityId: loan.id, at: Date.now() });
  recordInteraction(state);
  save(state);
  return loan;
}

/** Delete a loan and every ledger entry + payment it created. */
export async function deleteLoan(loanId: string): Promise<void> {
  const state = load();
  const payments = state.loanPayments.filter((p) => p.loanId === loanId);
  for (const p of payments) removeEntriesFor(state, p.id);
  removeEntriesFor(state, loanId);
  state.loanPayments = state.loanPayments.filter((p) => p.loanId !== loanId);
  state.loans = state.loans.filter((l) => l.id !== loanId);
  state.createdOrder = state.createdOrder.filter(
    (op) => !(op.kind === 'create' && op.entity === 'loan' && op.entityId === loanId)
  );
  recordInteraction(state);
  save(state);
}

/** Reverse a single loan payment, identified by its ledger entry id. */
export async function deleteLoanPayment(entryId: string): Promise<void> {
  const state = load();
  const payment = state.loanPayments.find((p) => p.entryId === entryId);
  if (!payment) throw new DemoError('ePayNF', 'Payment not found');

  const loan = state.loans.find((l) => l.id === payment.loanId);
  // Reversing gives the principal back to the outstanding balance.
  if (loan) loan.remainingBalance = round(loan.remainingBalance + payment.principal);

  removeEntriesFor(state, payment.id);
  state.loanPayments = state.loanPayments.filter((p) => p.id !== payment.id);
  state.createdOrder = state.createdOrder.filter(
    (op) => !(op.kind === 'loanPayment' && op.paymentId === payment.id)
  );
  recordInteraction(state);
  save(state);
}

export async function recordLoanPayment(
  loanId: string,
  data: { amount: number; date?: string }
): Promise<{ payment: LoanPayment; loan: Loan }> {
  const state = load();
  assertUnderCap(state);

  const loan = state.loans.find((l) => l.id === loanId);
  if (!loan) throw new DemoError('eLoanNF', 'Loan not found');
  const amount = round(data.amount);
  if (!(amount > 0)) throw new DemoError('ePayPos', 'Payment must be greater than zero.');
  if (loan.remainingBalance <= 0) throw new DemoError('eLoanPaid', 'This loan is already paid off.');

  const split = previewSplit(amount, loan.remainingBalance, loan.annualRate);
  const date = data.date || todayLocal();

  const payment: DemoLoanPayment = {
    id: crypto.randomUUID(),
    loanId,
    date,
    amount,
    interest: split.interest,
    principal: split.principal,
    balanceAfter: split.balanceAfter,
    entryId: '',
  };

  const entry = postEntry(state, {
    date,
    description: loan.type === 'payable' ? `Loan payment — ${loan.name}` : `Loan repayment received — ${loan.name}`,
    sourceType: 'loanPayment',
    sourceId: payment.id,
    workflowType: loan.type === 'payable' ? 'loan_payment' : null,
    // A payment inherits the group its loan was booked under.
    groupId: state.ledger.entries.find((e) => e.sourceId === loanId)?.groupId ?? null,
    lines: loan.type === 'payable'
      ? WORKFLOWS.loan_payment({ amount: split.principal, interest: split.interest }).lines
      : loanRepaymentReceived(split.principal, split.interest),
  });
  payment.entryId = entry.id;

  loan.remainingBalance = split.balanceAfter;
  state.loanPayments.push(payment);
  appendOp(state, { opId: newOpId(), kind: 'loanPayment', paymentId: payment.id, at: Date.now() });
  recordInteraction(state);
  save(state);
  return { payment, loan };
}
