import { normalizeEntryLines } from '../../../src/modules/accounting/accounting.repository';
import { buildWorkflow, WORKFLOW_TYPES } from '../../../src/modules/accounting/accounting.engine';
import { JournalLineInput } from '../../../src/modules/accounting/accounting.types';

/**
 * The last thing standing between a bad entry and the ledger.
 *
 * Every write goes through here — the workflow route, manual entries, invoices
 * and loans all call `createEntry`, which calls this first. It had no tests,
 * and it had a real defect: it compared the ROUNDED SUM of the raw lines but
 * stored each line rounded separately. Two roundings that disagree whenever
 * several sub-cent lines round down, so the guard could accept an entry and
 * then write it out of balance. The first test below is that exact case.
 */

const line = (code: string, debit: number, credit: number) =>
  ({ code, debit, credit } as unknown as JournalLineInput);

const totals = (lines: JournalLineInput[]) => ({
  debits: Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100,
  credits: Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100) / 100,
});

describe('normalizeEntryLines', () => {
  describe('the regression it was written for', () => {
    it('rejects sub-cent lines that only balance before rounding', () => {
      // 0.004 + 0.004 sums to 0.008, which rounds to 0.01 and matched the
      // credit. Stored per line it was 0.00 + 0.00 against 0.01 — a full cent
      // of imbalance, written by the check meant to prevent it.
      expect(() => normalizeEntryLines([
        line('CASH', 0.004, 0),
        line('CASH', 0.004, 0),
        line('REVENUE', 0, 0.01),
      ])).toThrow(/rounds to zero/i);
    });

    it('what it returns is what balances — no second rounding', () => {
      const lines = normalizeEntryLines([
        line('LOAN_PAYABLE', 33.334, 0),
        line('INTEREST_EXPENSE', 66.666, 0),
        line('CASH', 0, 100),
      ]);
      const { debits, credits } = totals(lines);
      expect(debits).toBe(credits);
      // Rounded to the cent on the way through.
      expect(lines.map((l) => l.debit)).toEqual([33.33, 66.67, 0]);
    });
  });

  describe('accepts', () => {
    it('a simple balanced entry', () => {
      const lines = normalizeEntryLines([line('CASH', 100, 0), line('REVENUE', 0, 100)]);
      expect(totals(lines)).toEqual({ debits: 100, credits: 100 });
    });

    it('a multi-line split', () => {
      const lines = normalizeEntryLines([
        line('LOAN_PAYABLE', 100, 0),
        line('INTEREST_EXPENSE', 15, 0),
        line('CASH', 0, 115),
      ]);
      expect(totals(lines)).toEqual({ debits: 115, credits: 115 });
    });

    it('amounts that float arithmetic would otherwise mangle', () => {
      // 0.1 + 0.2 === 0.30000000000000004 in binary floating point.
      const lines = normalizeEntryLines([
        line('CASH', 0.1, 0),
        line('CASH', 0.2, 0),
        line('REVENUE', 0, 0.3),
      ]);
      expect(totals(lines)).toEqual({ debits: 0.3, credits: 0.3 });
    });

    it('large amounts', () => {
      const lines = normalizeEntryLines([
        line('CASH', 999999.99, 0),
        line('REVENUE', 0, 999999.99),
      ]);
      expect(totals(lines)).toEqual({ debits: 999999.99, credits: 999999.99 });
    });
  });

  describe('rejects', () => {
    it('no lines', () => {
      expect(() => normalizeEntryLines([])).toThrow(/at least one line/i);
      expect(() => normalizeEntryLines(undefined)).toThrow(/at least one line/i);
    });

    it('an unbalanced entry', () => {
      expect(() => normalizeEntryLines([line('CASH', 100, 0), line('REVENUE', 0, 90)]))
        .toThrow(/does not balance/i);
    });

    it('a negative amount', () => {
      // A negative debit is a credit written wrong; it used to sail through.
      expect(() => normalizeEntryLines([
        line('CASH', 150, 0),
        line('CASH', -50, 0),
        line('REVENUE', 0, 100),
      ])).toThrow(/cannot be negative/i);
    });

    it('a line carrying both a debit and a credit', () => {
      // Balances, but inflates both totals for no reason.
      expect(() => normalizeEntryLines([line('CASH', 100, 100), line('REVENUE', 100, 100)]))
        .toThrow(/debit or a credit, never both/i);
    });

    it('a line that is entirely zero', () => {
      expect(() => normalizeEntryLines([
        line('CASH', 0, 0),
        line('REVENUE', 0, 100),
        line('CASH', 100, 0),
      ])).toThrow(/rounds to zero/i);
    });

    it('an entry that moves nothing', () => {
      expect(() => normalizeEntryLines([line('CASH', 0, 0)])).toThrow(/rounds to zero/i);
    });

    it.each([NaN, Infinity, -Infinity])('a non-finite amount (%p)', (bad) => {
      expect(() => normalizeEntryLines([line('CASH', bad, 0), line('REVENUE', 0, 100)])).toThrow();
    });

    it('names the offending line', () => {
      expect(() => normalizeEntryLines([
        line('CASH', 100, 0),
        line('REVENUE', -1, 0),
      ])).toThrow(/Line 2 \(REVENUE\)/);
    });
  });

  describe('accepts everything the engine produces', () => {
    // The two halves of the ledger have to agree: anything buildWorkflow emits
    // must survive the guard, or a legitimate flow breaks in production.
    it.each(WORKFLOW_TYPES)('%s', (type) => {
      for (const input of [{ amount: 100 }, { amount: 100, interest: 15 }, { amount: 0.01 }, { amount: 1234.56 }]) {
        const { lines } = buildWorkflow(type, input);
        expect(() => normalizeEntryLines(lines)).not.toThrow();
      }
    });
  });
});
