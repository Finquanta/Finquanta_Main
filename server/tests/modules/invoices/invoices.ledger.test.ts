import {
  InvoiceLedgerState, buildCancellationEntry, buildPaymentEntry, buildReceivableEntry, invoiceLabel,
} from '../../../src/modules/invoices/invoices.ledger';
import { normalizeEntryLines } from '../../../src/modules/accounting/accounting.repository';

/**
 * The invoice lifecycle on the books: raised, settled, and taken back off.
 *
 * Voiding is the part that matters. A paid invoice and a merely sent one need
 * DIFFERENT reversals, because they left different things on the books, and
 * getting it backwards does not fail loudly — it silently invents money. Undo
 * the receivable on a paid invoice and you leave the cash sitting there while
 * putting back a debt nobody owes; undo cash on an unpaid one and you remove
 * money that never arrived.
 *
 * None of this was covered. It lived inline in the route handlers, so testing
 * it meant standing up a server; it is pure functions now.
 */

const invoice = (over: Partial<InvoiceLedgerState> = {}): InvoiceLedgerState => ({
  number: 'INV-001',
  total: 500,
  customerName: 'Acme Ltd',
  arEntryId: null,
  paymentEntryId: null,
  ...over,
});

const sideOf = (lines: { code: string; debit: number; credit: number }[], side: 'debit' | 'credit') =>
  lines.filter((l) => l[side] > 0).map((l) => `${l.code}:${l[side]}`).sort();

describe('what an invoice puts on the books', () => {
  describe('the receivable (marked sent)', () => {
    it('raises AR and revenue', () => {
      const { lines } = buildReceivableEntry(invoice());
      expect(sideOf(lines, 'debit')).toEqual(['AR:500']);
      expect(sideOf(lines, 'credit')).toEqual(['REVENUE:500']);
    });

    it('is described by invoice and customer', () => {
      expect(buildReceivableEntry(invoice()).description).toBe('Invoice INV-001 — Acme Ltd');
    });

    it('omits the dash when there is no customer', () => {
      expect(buildReceivableEntry(invoice({ customerName: null })).description).toBe('Invoice INV-001');
    });
  });

  describe('the payment (marked paid)', () => {
    it('moves cash in and clears the receivable', () => {
      const { lines } = buildPaymentEntry(invoice());
      expect(sideOf(lines, 'debit')).toEqual(['CASH:500']);
      expect(sideOf(lines, 'credit')).toEqual(['AR:500']);
    });

    it('keeps the customer name cased as written', () => {
      expect(buildPaymentEntry(invoice()).description).toBe('Payment for invoice INV-001 — Acme Ltd');
    });
  });
});

describe('what a void takes back off', () => {
  describe('a draft', () => {
    it('reverses nothing, because nothing was ever posted', () => {
      expect(buildCancellationEntry(invoice())).toBeNull();
    });
  });

  describe('sent but unpaid', () => {
    const sent = invoice({ arEntryId: 'entry-ar' });

    it('undoes revenue and the receivable — NOT cash', () => {
      const reversal = buildCancellationEntry(sent)!;
      expect(sideOf(reversal.lines, 'debit')).toEqual(['REVENUE:500']);
      expect(sideOf(reversal.lines, 'credit')).toEqual(['AR:500']);
      // The money never arrived, so cash must not move.
      expect(reversal.lines.some((l) => l.code === 'CASH')).toBe(false);
    });

    it('says it was cancelled', () => {
      expect(buildCancellationEntry(sent)!.description).toBe('Cancelled invoice INV-001');
    });
  });

  describe('paid', () => {
    const paid = invoice({ arEntryId: 'entry-ar', paymentEntryId: 'entry-pay' });

    it('undoes revenue and cash — NOT the receivable', () => {
      const reversal = buildCancellationEntry(paid)!;
      expect(sideOf(reversal.lines, 'debit')).toEqual(['REVENUE:500']);
      expect(sideOf(reversal.lines, 'credit')).toEqual(['CASH:500']);
      // AR already netted to zero when the payment was booked. Touching it here
      // would put back a debt that no longer exists.
      expect(reversal.lines.some((l) => l.code === 'AR')).toBe(false);
    });

    it('says it was voided', () => {
      expect(buildCancellationEntry(paid)!.description).toBe('Voided paid invoice INV-001');
    });

    it('reverses cash even if the AR link was never recorded', () => {
      // Decided by what is on the books, not by the status string: a payment
      // entry means cash moved, whatever else is or is not linked.
      const odd = invoice({ arEntryId: null, paymentEntryId: 'entry-pay' });
      expect(sideOf(buildCancellationEntry(odd)!.lines, 'credit')).toEqual(['CASH:500']);
    });
  });

  describe('the two reversals are genuinely different', () => {
    it('paid and sent do not produce the same entry', () => {
      const sent = buildCancellationEntry(invoice({ arEntryId: 'a' }))!;
      const paid = buildCancellationEntry(invoice({ arEntryId: 'a', paymentEntryId: 'p' }))!;
      expect(sideOf(sent.lines, 'credit')).not.toEqual(sideOf(paid.lines, 'credit'));
    });
  });
});

describe('every entry an invoice can post is accepted by the ledger', () => {
  // The guard in accounting.repository is the real judge — if it would refuse
  // any of these, the flow breaks in production rather than here.
  const totals = [0.01, 1, 99.99, 500, 1234.56, 999999.99];

  it.each(totals)('total %p', (total) => {
    const draft = invoice({ total });
    expect(() => normalizeEntryLines(buildReceivableEntry(draft).lines)).not.toThrow();
    expect(() => normalizeEntryLines(buildPaymentEntry(draft).lines)).not.toThrow();

    for (const state of [{ arEntryId: 'a' }, { arEntryId: 'a', paymentEntryId: 'p' }]) {
      const reversal = buildCancellationEntry(invoice({ total, ...state }));
      expect(reversal).not.toBeNull();
      expect(() => normalizeEntryLines(reversal!.lines)).not.toThrow();
    }
  });

  it('a reversal exactly offsets what was posted', () => {
    // Post the receivable, then cancel it: revenue nets to zero.
    const sent = invoice({ arEntryId: 'a' });
    const posted = buildReceivableEntry(sent).lines;
    const reversed = buildCancellationEntry(sent)!.lines;

    const net = (code: string) =>
      [...posted, ...reversed]
        .filter((l) => l.code === code)
        .reduce((sum, l) => sum + l.debit - l.credit, 0);

    expect(net('REVENUE')).toBe(0);
    expect(net('AR')).toBe(0);
  });
});

describe('invoiceLabel', () => {
  it('includes the customer when there is one', () => {
    expect(invoiceLabel(invoice())).toBe('Invoice INV-001 — Acme Ltd');
  });

  it.each([null, undefined, ''])('omits it when the customer is %p', (customerName) => {
    expect(invoiceLabel(invoice({ customerName }))).toBe('Invoice INV-001');
  });
});
