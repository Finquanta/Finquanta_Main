/**
 * Shape of everything a Try-It Demo session holds. Lives entirely in
 * sessionStorage under DEMO_STORAGE_KEY (see store.ts) — never sent to the
 * backend until a real signup migrates it (see migrate.ts).
 */

export interface DemoCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  notes: string | null;
  createdAt: string;
}

export interface DemoTransaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string; // YYYY-MM-DD
  description?: string;
  invoice?: string;
  createdAt: string;
}

export interface DemoInvoiceItem {
  id?: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export type DemoInvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';

export interface DemoInvoice {
  id: string;
  number: string;
  status: DemoInvoiceStatus;
  customerId: string | null;
  issueDate: string | null;
  dueDate: string | null;
  message: string | null;
  details: string | null;
  paymentTerms: string | null;
  notes: string | null;
  taxRate: number;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  sentAt: string | null;
  paidAt: string | null;
  items: DemoInvoiceItem[];
  /** Business Group this invoice — and everything it posts — belongs to. */
  groupId: string | null;
  createdAt: string;
}

export type DemoAccountCode =
  | 'CASH' | 'AR' | 'AP' | 'LOAN_PAYABLE' | 'LOAN_RECEIVABLE'
  | 'REVENUE' | 'EXPENSE' | 'INTEREST_EXPENSE' | 'INTEREST_INCOME' | 'EQUITY';

export interface DemoJournalLine {
  code: DemoAccountCode;
  debit: number;
  credit: number;
}

/**
 * What produced an entry. Mirrors the real ledger's sourceType — it decides
 * whether a row is editable in the Bookkeeping list (only `bookkeeping` and
 * `manual` entries are; invoice/loan rows are owned by their source document).
 */
export type DemoEntrySource = 'bookkeeping' | 'manual' | 'invoice' | 'loan' | 'loanPayment';

export interface DemoJournalEntry {
  id: string;
  date: string;
  description: string;
  sourceType: DemoEntrySource;
  /** The transaction / invoice / loan id this entry was posted for. */
  sourceId: string | null;
  /** The workflow that built it — lets an accrual row re-open in its own mode. */
  workflowType: DemoWorkflowType | null;
  /** Business Group (cost/profit centre) this entry is attributed to, if any. */
  groupId: string | null;
  lines: DemoJournalLine[];
  createdAt: string;
}

export const DEMO_GROUP_TYPES = ['department', 'project', 'campaign', 'location', 'product', 'other'] as const;
export type DemoGroupType = (typeof DEMO_GROUP_TYPES)[number];

export interface DemoGroup {
  id: string;
  name: string;
  description: string | null;
  type: DemoGroupType;
  color: string;
  status: 'active' | 'archived';
  createdAt: string;
}

export type DemoWorkflowType =
  | 'cash_revenue' | 'credit_revenue' | 'receive_ar_payment'
  | 'cash_expense' | 'credit_expense' | 'pay_ap'
  | 'loan_received' | 'loan_payment';

/**
 * payable    — money you BORROWED. Payments split into principal (Loan Payable ↓)
 *              and Interest Expense ↑.
 * receivable — money you LENT OUT. Repayments split into principal (Loan
 *              Receivable ↓) and Interest Income ↑.
 */
export type DemoLoanType = 'payable' | 'receivable';

export interface DemoLoan {
  id: string;
  name: string;
  type: DemoLoanType;
  principal: number;
  annualRate: number;
  remainingBalance: number;
  startDate: string | null;
  createdAt: string;
}

export interface DemoLoanPayment {
  id: string;
  loanId: string;
  date: string;
  amount: number;
  interest: number;
  principal: number;
  balanceAfter: number;
  /** The ledger entry this payment posted, so it can be reversed. */
  entryId: string;
}

/**
 * `invoicePreviewed` is the demo's conversion moment: the visitor has built an
 * invoice and is looking at the rendered document. Everything past that point —
 * sending it, marking it paid — needs a real account.
 */
export type DemoTriggerReason = 'idle' | 'sessionCeiling' | 'interactionCount' | 'finnaCap' | 'invoicePreviewed';

/**
 * The ordered log of everything the visitor created. This is what a real signup
 * replays against the live API (see migrate.ts) — order matters because an
 * invoice can reference a customer created earlier in the session.
 */
export type DemoOp =
  | { opId: string; kind: 'create'; entity: 'customer' | 'transaction' | 'invoice' | 'loan' | 'group'; entityId: string; at: number }
  | { opId: string; kind: 'accrual'; entryId: string; at: number }
  | { opId: string; kind: 'loanPayment'; paymentId: string; at: number }
  // No longer produced — the demo gates at the invoice preview, so nothing gets
  // sent or paid in a session. Kept so a stash written before that change still
  // replays correctly.
  | { opId: string; kind: 'statusChange'; entity: 'invoice'; entityId: string; toStatus: 'sent' | 'paid'; at: number };

export interface DemoChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DemoState {
  version: 2;
  meta: {
    demoId: string;
    startedAt: number;
    lastInteractionAt: number;
    interactionCount: number;
    dismissedTriggers: Partial<Record<DemoTriggerReason, number>>;
    /**
     * Next invoice number to hand out. A counter rather than `invoices.length`,
     * which isn't monotonic across deletes and hands out duplicate numbers.
     */
    invoiceSeq: number;
    /**
     * When the visitor first sat and looked at a finished invoice. That's the
     * demo's conversion moment — the document looks real, and everything past it
     * (sending, recording payment) needs an account. Null until it happens.
     */
    invoicePreviewedAt: number | null;
  };
  business: { name: string };
  customers: DemoCustomer[];
  transactions: DemoTransaction[];
  invoices: DemoInvoice[];
  groups: DemoGroup[];
  loans: DemoLoan[];
  loanPayments: DemoLoanPayment[];
  ledger: { entries: DemoJournalEntry[] };
  finna: { messagesUsed: number; messages: DemoChatMessage[] };
  createdOrder: DemoOp[];
}
