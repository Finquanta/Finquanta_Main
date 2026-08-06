import { DemoJournalLine, DemoWorkflowType, DemoAccountCode } from './types';

/**
 * Copied from server/src/modules/accounting/accounting.engine.ts — all eight
 * workflows, verbatim. That engine is pure and dependency-free, so this is a
 * straight copy rather than a reinterpretation: the demo's books balance by the
 * exact same rules a real account's do.
 */

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const d = (code: DemoAccountCode, amount: number): DemoJournalLine => ({ code, debit: money(amount), credit: 0 });
const c = (code: DemoAccountCode, amount: number): DemoJournalLine => ({ code, debit: 0, credit: money(amount) });

export interface WorkflowInput {
  amount: number;
  /** Interest portion — only used by the loan payment workflows. */
  interest?: number;
  description?: string;
}

export interface WorkflowResult {
  description: string;
  lines: DemoJournalLine[];
}

type Builder = (input: WorkflowInput) => WorkflowResult;

export const WORKFLOWS: Record<DemoWorkflowType, Builder> = {
  // Increase Revenue, Increase Business Cash
  cash_revenue: ({ amount, description }) => ({
    description: description || 'Cash revenue received',
    lines: [d('CASH', amount), c('REVENUE', amount)],
  }),

  // Increase Revenue, Increase Accounts Receivable
  credit_revenue: ({ amount, description }) => ({
    description: description || 'Revenue billed (payment due)',
    lines: [d('AR', amount), c('REVENUE', amount)],
  }),

  // Increase Business Cash, Decrease Accounts Receivable
  receive_ar_payment: ({ amount, description }) => ({
    description: description || 'Payment received from customer',
    lines: [d('CASH', amount), c('AR', amount)],
  }),

  // Increase Expenses, Decrease Business Cash
  cash_expense: ({ amount, description }) => ({
    description: description || 'Expense paid',
    lines: [d('EXPENSE', amount), c('CASH', amount)],
  }),

  // Increase Expenses, Increase Accounts Payable
  credit_expense: ({ amount, description }) => ({
    description: description || 'Expense incurred (payment due)',
    lines: [d('EXPENSE', amount), c('AP', amount)],
  }),

  // Decrease Business Cash, Decrease Accounts Payable
  pay_ap: ({ amount, description }) => ({
    description: description || 'Bill paid',
    lines: [d('AP', amount), c('CASH', amount)],
  }),

  // Increase Business Cash, Increase Loan Payable
  loan_received: ({ amount, description }) => ({
    description: description || 'Loan received',
    lines: [d('CASH', amount), c('LOAN_PAYABLE', amount)],
  }),

  // Decrease Business Cash, Decrease Loan Payable, Increase Interest Expense
  loan_payment: ({ amount, interest = 0, description }) => {
    const principal = money(amount);
    const interestAmt = money(interest);
    const total = money(principal + interestAmt);
    const lines: DemoJournalLine[] = [d('LOAN_PAYABLE', principal)];
    if (interestAmt > 0) lines.push(d('INTEREST_EXPENSE', interestAmt));
    lines.push(c('CASH', total));
    return { description: description || 'Loan payment', lines };
  },
};

/**
 * The receivable side of a loan — the mirror opposite of loan_received /
 * loan_payment. The real app routes these through the Loans module rather than
 * the workflow engine, so they're built here the same way it does.
 */
export function loanIssued(amount: number): DemoJournalLine[] {
  return [d('LOAN_RECEIVABLE', amount), c('CASH', amount)];
}

export function loanRepaymentReceived(principal: number, interest: number): DemoJournalLine[] {
  const total = money(principal + interest);
  const lines: DemoJournalLine[] = [d('CASH', total), c('LOAN_RECEIVABLE', principal)];
  if (money(interest) > 0) lines.push(c('INTEREST_INCOME', interest));
  return lines;
}

export interface WorkflowMeta {
  label: string;
  description: string;
  module: 'bookkeeping' | 'accounting';
  basis: 'cash' | 'accrual';
  group: 'cash' | 'accrual' | 'debt';
  affectsCash: boolean;
}

export const WORKFLOW_META: Record<DemoWorkflowType, WorkflowMeta> = {
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

export const WORKFLOW_TYPES = Object.keys(WORKFLOWS) as DemoWorkflowType[];

export const workflowsInGroup = (group: 'cash' | 'accrual' | 'debt'): DemoWorkflowType[] =>
  WORKFLOW_TYPES.filter((t) => WORKFLOW_META[t].group === group);

/** Build the journal lines for an event. Throws on invalid input. */
export function buildWorkflow(type: DemoWorkflowType, input: WorkflowInput): WorkflowResult {
  const amount = money(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero');
  const interest = money(input.interest ?? 0);
  if (interest < 0) throw new Error('Interest cannot be negative');

  const result = WORKFLOWS[type]({ ...input, amount, interest });

  // Safety net: the ledger must always balance.
  const debits = result.lines.reduce((s, l) => s + l.debit, 0);
  const credits = result.lines.reduce((s, l) => s + l.credit, 0);
  if (money(debits) !== money(credits)) {
    throw new Error(`Workflow "${type}" produced an unbalanced entry (${debits} vs ${credits})`);
  }
  return result;
}

/** Kept for the invoice module, which posts these two directly. */
export const creditRevenue = (amount: number) => WORKFLOWS.credit_revenue({ amount }).lines;
export const receiveArPayment = (amount: number) => WORKFLOWS.receive_ar_payment({ amount }).lines;
