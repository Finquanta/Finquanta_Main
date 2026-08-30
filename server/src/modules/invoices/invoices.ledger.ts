import { buildWorkflow } from '../accounting/accounting.engine';
import { JournalLineInput } from '../accounting/accounting.types';

/**
 * What an invoice puts on the books, and what it takes back off.
 *
 * These were three inline blocks in `invoices.routes.ts`, wrapped in database
 * calls and HTTP handling, which is why the most consequential decision in the
 * module — how a void reverses a PAID invoice versus a merely SENT one — could
 * not be tested without standing up a server. They are pure functions now: an
 * invoice's state in, journal lines out.
 *
 * The reversal rules, which are the part worth getting right:
 *
 *   Draft   nothing was ever posted, so there is nothing to reverse.
 *   Sent    a receivable was raised (AR up, Revenue up). Undo exactly that:
 *           Revenue down (debit), Accounts Receivable down (credit).
 *   Paid    the receivable was raised AND settled, so AR already nets to zero.
 *           What is still on the books is Revenue up and Cash up, so that is
 *           what comes off: Revenue down (debit), Cash down (credit).
 *
 * Reversing the wrong pair is the failure that matters: undoing AR on a paid
 * invoice would leave the cash in place and put the receivable back, silently
 * inventing money that was never owed.
 */

/** The parts of an invoice the ledger cares about. */
export interface InvoiceLedgerState {
  number: string;
  total: number;
  customerName?: string | null;
  /** Set once the receivable has been booked. */
  arEntryId?: string | null;
  /** Set once the payment has been booked. */
  paymentEntryId?: string | null;
}

export interface LedgerEntryDraft {
  description: string;
  lines: JournalLineInput[];
}

/** "Invoice INV-001 — Acme Ltd", or just the number when there is no customer. */
export const invoiceLabel = (invoice: InvoiceLedgerState) =>
  `Invoice ${invoice.number}${invoice.customerName ? ` — ${invoice.customerName}` : ''}`;

/** Revenue billed now, to be paid later: AR up, Revenue up. */
export function buildReceivableEntry(invoice: InvoiceLedgerState): LedgerEntryDraft {
  return buildWorkflow('credit_revenue', {
    amount: invoice.total,
    description: invoiceLabel(invoice),
  });
}

/** The customer pays: Cash up, AR down. */
export function buildPaymentEntry(invoice: InvoiceLedgerState): LedgerEntryDraft {
  // Spelled out rather than lower-casing `invoiceLabel`, which would also
  // lower-case the customer's name.
  const who = invoice.customerName ? ` — ${invoice.customerName}` : '';
  return buildWorkflow('receive_ar_payment', {
    amount: invoice.total,
    description: `Payment for invoice ${invoice.number}${who}`,
  });
}

/**
 * The entry a cancel/void has to post, or `null` when the invoice never reached
 * the books and there is nothing to undo.
 *
 * Which pair gets reversed is decided by what was actually posted — the
 * presence of `paymentEntryId` and `arEntryId` — rather than by the invoice's
 * status string, so an invoice whose status and ledger disagree still reverses
 * whatever is really on the books.
 */
export function buildCancellationEntry(invoice: InvoiceLedgerState): LedgerEntryDraft | null {
  if (invoice.paymentEntryId) {
    return {
      description: `Voided paid invoice ${invoice.number}`,
      lines: [
        { code: 'REVENUE', debit: invoice.total, credit: 0 },
        { code: 'CASH', debit: 0, credit: invoice.total },
      ],
    };
  }

  if (invoice.arEntryId) {
    return {
      description: `Cancelled invoice ${invoice.number}`,
      lines: [
        { code: 'REVENUE', debit: invoice.total, credit: 0 },
        { code: 'AR', debit: 0, credit: invoice.total },
      ],
    };
  }

  return null;
}
