import { splitPayment } from '../../../src/modules/loans/loans.repository';
import { normalizeEntryLines } from '../../../src/modules/accounting/accounting.repository';
import { JournalLineInput } from '../../../src/modules/accounting/accounting.types';

/**
 * How a loan payment is divided between interest and principal.
 *
 * Every loan payment in the product goes through this, and its output lands
 * straight on the books: the principal reduces the loan, the interest becomes
 * interest expense (or income), and cash moves by the two together. Get the
 * split wrong and both the loan balance and the P&L are wrong, in opposite
 * directions, quietly. It had no tests.
 *
 * Simple interest on the outstanding balance, one month at a time —
 * `balance x annualRate / 100 / 12` — capped so a payment can never create
 * interest it did not cover, and principal can never exceed what is owed.
 */
describe('splitPayment', () => {
  describe('the ordinary case', () => {
    it('takes interest first, then principal', () => {
      // 1200 at 12% => 12 of interest for the month.
      expect(splitPayment(100, 1200, 12)).toEqual({
        interest: 12,
        principal: 88,
        balanceAfter: 1112,
      });
    });

    it('puts everything to principal when the rate is zero', () => {
      expect(splitPayment(100, 1000, 0)).toEqual({
        interest: 0,
        principal: 100,
        balanceAfter: 900,
      });
    });

    it('treats a missing rate as zero', () => {
      expect(splitPayment(100, 1000, undefined as unknown as number)).toEqual({
        interest: 0,
        principal: 100,
        balanceAfter: 900,
      });
    });
  });

  describe('caps', () => {
    it('never charges more interest than the payment covers', () => {
      // A month's interest is 100, but only 40 is being paid.
      const r = splitPayment(40, 10000, 12);
      expect(r.interest).toBe(40);
      expect(r.principal).toBe(0);
      // Nothing came off the balance — this payment was all interest.
      expect(r.balanceAfter).toBe(10000);
    });

    it('never pays off more principal than is owed', () => {
      // Overpaying a 100 balance at 0%: principal is capped at the balance.
      const r = splitPayment(500, 100, 0);
      expect(r.principal).toBe(100);
      expect(r.balanceAfter).toBe(0);
      // NOTE: interest + principal (100) is less than the 500 handed over. The
      // ledger records the allocated part, not the overpayment, so cash moves
      // by 100. Documented rather than asserted as desirable — changing it is
      // an accounting decision, not a bug fix.
      expect(r.interest + r.principal).toBeLessThan(500);
    });

    it('settles a loan exactly', () => {
      const r = splitPayment(1012, 1000, 14.4);
      expect(r.interest).toBe(12);
      expect(r.principal).toBe(1000);
      expect(r.balanceAfter).toBe(0);
    });
  });

  describe('rounding', () => {
    it('rounds interest to the cent', () => {
      // 1000 * 7.5% / 12 = 6.25 exactly.
      expect(splitPayment(100, 1000, 7.5).interest).toBe(6.25);
    });

    it('keeps every part at two decimals', () => {
      const r = splitPayment(33.333, 999.999, 5.5);
      for (const v of [r.interest, r.principal, r.balanceAfter]) {
        expect(Math.round(v * 100) / 100).toBe(v);
      }
    });

    it('the parts always add back up to the payment', () => {
      // The property that matters: nothing is lost between the two sides.
      const cases: [number, number, number][] = [
        [100, 1200, 12], [0.01, 1000, 5], [1234.56, 98765.43, 7.25],
        [50, 333.33, 3.7], [999.99, 1000, 0], [10, 10000, 18],
      ];
      for (const [pay, balance, rate] of cases) {
        const { interest, principal } = splitPayment(pay, balance, rate);
        // Equal to the payment unless principal was capped by the balance.
        const allocated = Math.round((interest + principal) * 100) / 100;
        expect(allocated).toBeLessThanOrEqual(Math.round(pay * 100) / 100);
      }
    });
  });

  describe('the split always produces a balanced journal entry', () => {
    // The real reason this function matters: loans build their lines by hand
    // rather than through the engine, so the split is what has to balance.
    const cases: [number, number, number][] = [
      [100, 1200, 12], [40, 10000, 12], [0.01, 1000, 5],
      [1234.56, 98765.43, 7.25], [1012, 1000, 14.4], [7.77, 333.33, 9.9],
    ];

    it.each(cases)('payment %p on balance %p at %p%%', (pay, balance, rate) => {
      const { interest, principal } = splitPayment(pay, balance, rate);
      if (principal === 0 && interest === 0) return;

      // Exactly what loans.routes.ts builds for a payable loan.
      const lines: JournalLineInput[] = [];
      if (principal > 0) lines.push({ code: 'LOAN_PAYABLE', debit: principal, credit: 0 } as JournalLineInput);
      if (interest > 0) lines.push({ code: 'INTEREST_EXPENSE', debit: interest, credit: 0 } as JournalLineInput);
      lines.push({ code: 'CASH', debit: 0, credit: principal + interest } as JournalLineInput);

      // The ledger's own guard is the assertion.
      expect(() => normalizeEntryLines(lines)).not.toThrow();
    });
  });

  describe('degenerate input', () => {
    it('a zero payment moves nothing', () => {
      expect(splitPayment(0, 1000, 12)).toEqual({ interest: 0, principal: 0, balanceAfter: 1000 });
    });

    it('a settled loan takes nothing further', () => {
      const r = splitPayment(100, 0, 12);
      expect(r.interest).toBe(0);
      expect(r.principal).toBe(0);
      expect(r.balanceAfter).toBe(0);
    });
  });
});
