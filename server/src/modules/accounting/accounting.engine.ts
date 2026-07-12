import { JournalLineInput } from './accounting.types';

/**
 * The accounting engine: maps a plain business event to a balanced set of
 * journal lines. This is PURE, DETERMINISTIC CODE — no AI calls, ever (the AI
 * budget is reserved for user-initiated Finna chat).
 *
 * To add a workflow later, add a key to WorkflowType and a builder to WORKFLOWS.
 * Nothing else needs to change.
 */

export type WorkflowType =
  | 'cash_revenue'        // revenue received immediately
  | 'credit_revenue'      // revenue billed now, paid later
  | 'receive_ar_payment'  // customer pays an outstanding invoice
  | 'cash_expense'        // expense paid immediately
  | 'credit_expense'      // expense incurred now, paid later
  | 'pay_ap'              // paying off a bill
  | 'loan_received'       // loan money lands in the bank
  | 'loan_payment';       // repaying a loan (principal + interest)

export interface WorkflowInput {
  /** Principal / main amount. Must be > 0. */
  amount: number;
  /** Interest portion — only used by loan_payment. */
  interest?: number;
  /** Optional human description; a sensible default is used otherwise. */
  description?: string;
}

export interface WorkflowResult {
  description: string;
  lines: JournalLineInput[];
}

type Builder = (input: WorkflowInput) => WorkflowResult;

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const d = (code: JournalLineInput['code'], amount: number): JournalLineInput => ({ code, debit: money(amount), credit: 0 });
const c = (code: JournalLineInput['code'], amount: number): JournalLineInput => ({ code, debit: 0, credit: money(amount) });

export const WORKFLOWS: Record<WorkflowType, Builder> = {
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
    const lines: JournalLineInput[] = [d('LOAN_PAYABLE', principal)];
    if (interestAmt > 0) lines.push(d('INTEREST_EXPENSE', interestAmt));
    lines.push(c('CASH', total));
    return { description: description || 'Loan payment', lines };
  },
};

/**
 * Which module an event belongs to, and whether cash actually moves.
 *
 * CASH BASIS (bookkeeping) — the simple module. Only events where money really
 * moved: cash in (cash flow) and cash out (expenses). No accounting knowledge
 * required to use it.
 *
 * ACCRUAL BASIS (accounting) — the added layer. Records obligations whether or
 * not cash moved: receivables, payables and loans. `credit_revenue` and
 * `credit_expense` move NO cash at all — that's precisely what makes them
 * accrual-only. The settlement events (receive_ar_payment, pay_ap) and loan
 * events do move cash, so they show up in cash flow too.
 *
 * Cash-basis reporting is therefore derivable with no extra column: it's simply
 * the entries that touch the CASH account. Accrual reporting is every entry.
 */
export interface WorkflowMeta {
  label: string;
  /** Plain-English explanation of what the entry actually does. */
  description: string;
  module: 'bookkeeping' | 'accounting';
  basis: 'cash' | 'accrual';
  /** Grouping in the UI. Loans live under "Debt". */
  group: 'cash' | 'accrual' | 'debt';
  affectsCash: boolean;
}

export const WORKFLOW_META: Record<WorkflowType, WorkflowMeta> = {
  // Cash basis — the simple bookkeeping module.
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

  // Accrual basis — money owed to you / money you owe.
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
    label: 'Customer paid me',
    description: 'Business Cash increases, Accounts Receivable decreases. (Revenue was already recorded when the receivable was raised — booking it again would double-count it.)',
    module: 'accounting', basis: 'accrual', group: 'accrual', affectsCash: true,
  },
  pay_ap: {
    label: 'I paid a bill',
    description: 'Business Cash decreases, Accounts Payable decreases. (The expense was already recorded when the bill was raised.)',
    module: 'accounting', basis: 'accrual', group: 'accrual', affectsCash: true,
  },

  // Debt. These are recorded through the Loans module so each payment can split
  // principal vs interest off the loan's rate and remaining balance.
  loan_received: {
    label: 'Loan received',
    description: 'Loan Payable increases, Business Cash increases.',
    module: 'accounting', basis: 'accrual', group: 'debt', affectsCash: true,
  },
  loan_payment: {
    label: 'Loan payment made',
    description: 'Loan Payable decreases by the principal, Interest Expense increases by the interest, and Business Cash decreases by the full payment.',
    module: 'accounting', basis: 'accrual', group: 'debt', affectsCash: true,
  },
};

export const WORKFLOW_TYPES = Object.keys(WORKFLOWS) as WorkflowType[];

export const workflowsFor = (module: 'bookkeeping' | 'accounting'): WorkflowType[] =>
  WORKFLOW_TYPES.filter((t) => WORKFLOW_META[t].module === module);

export const workflowsInGroup = (group: 'cash' | 'accrual' | 'debt'): WorkflowType[] =>
  WORKFLOW_TYPES.filter((t) => WORKFLOW_META[t].group === group);

export const isWorkflowType = (v: unknown): v is WorkflowType =>
  typeof v === 'string' && (WORKFLOW_TYPES as string[]).includes(v);

/** Build the journal lines for an event. Throws on invalid input. */
export function buildWorkflow(type: WorkflowType, input: WorkflowInput): WorkflowResult {
  const amount = money(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }
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
