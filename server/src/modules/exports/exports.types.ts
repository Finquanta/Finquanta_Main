/**
 * Books Export — shared shapes.
 *
 * v1 exports what is actually RECORDED: the ledger and the invoice list. It
 * does not compute P&L, Balance Sheet or Cash Flow statements, because no
 * module in the product computes them — they would be a reporting engine
 * nobody has written, not a formatting job.
 */

export const EXPORT_FORMATS = ['csv', 'txt', 'xlsx', 'pdf'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/**
 * The `Invoice Type` column's eight values.
 *
 * Deliberately SIMPLER than the on-screen `typeLabel()` in BookkeepingCard,
 * which switches on `sourceType` and produces about thirteen labels ("Invoice
 * owed", "Customer paid", "Bill paid"…). The export collapses those to the
 * eight a reader outside the app can act on: which side of the books a line
 * sits on, plus the four loan movements, which are genuinely distinct because
 * loan principal is not income and repaying it is not an expense.
 */
export const INVOICE_TYPES = [
  'income',
  'expense',
  'accounts_receivable',
  'accounts_payable',
  'loan_received',
  'loan_issued',
  'loan_payment',
  'loan_repaid',
] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  income: 'Income',
  expense: 'Expense',
  accounts_receivable: 'Accounts Receivable',
  accounts_payable: 'Accounts Payable',
  loan_received: 'Loan Received',
  loan_issued: 'Loan Issued',
  loan_payment: 'Loan Payment',
  loan_repaid: 'Loan Repaid',
};

/** Only these two can appear on a cash-basis export: nothing unpaid has moved. */
export const ACCRUAL_ONLY_TYPES: InvoiceType[] = ['accounts_receivable', 'accounts_payable'];

/** Sentinel for "rows with no Business Group", alongside real group ids. */
export const UNASSIGNED_GROUP = 'unassigned';

export interface LedgerExportFilters {
  basis: 'cash' | 'accrual';
  startDate?: string;
  endDate?: string;
  /** Empty or omitted means ALL groups, not none. */
  groupIds?: string[];
  /** Empty or omitted means ALL types, not none. */
  invoiceTypes?: InvoiceType[];
}

/**
 * The block that identifies the business at the top of every export. Lines
 * whose value is null are omitted entirely — an export that prints
 * "Reg. No." with nothing after it looks broken.
 */
export interface ExportHeader {
  businessName: string;
  businessPhone: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  exportedBy: string;
  exportedAt: string;
  rangeLabel: string;
  basisLabel: string;
  /**
   * `business_profiles.logo_url`, which stores a base64 `data:` URI rather than
   * a path. PDF only — a spreadsheet is a working file, and CSV/TXT cannot
   * carry an image at all.
   */
  logoDataUri: string | null;
}

export interface LedgerRow {
  name: string;
  amount: number;
  description: string;
  invoiceType: string;
  group: string;
  date: string;
}

export const LEDGER_COLUMNS = [
  'Name',
  'Amount',
  'Description',
  'Invoice Type',
  'Group',
  'Date',
] as const;

export interface InvoiceRow {
  number: string;
  customer: string;
  status: string;
  issueDate: string;
  dueDate: string;
  total: number;
  currency: string;
}

export const INVOICE_COLUMNS = [
  'Number',
  'Customer',
  'Status',
  'Issue Date',
  'Due Date',
  'Total',
  'Currency',
] as const;

/**
 * Hard ceiling on a single export, so a runaway range cannot try to buffer an
 * unbounded read into memory.
 */
export const MAX_ROWS = 50_000;

/**
 * PDF gets its own, far lower ceiling. 50,000 rows is a reasonable spreadsheet
 * and an absurd ~1,000-page document.
 */
export const MAX_PDF_ROWS = 5_000;

/** Rows returned by the preview endpoints. */
export const PREVIEW_ROWS = 100;

/** Roughly how many ledger rows fit on one PDF page, for the page estimate. */
export const PDF_ROWS_PER_PAGE = 28;

export interface LedgerPreview {
  header: ExportHeader;
  columns: readonly string[];
  rows: LedgerRow[];
  totalRows: number;
  /** Present for the PDF format, so the modal can warn before a 900-page file. */
  estimatedPages?: number;
  truncated: boolean;
}
