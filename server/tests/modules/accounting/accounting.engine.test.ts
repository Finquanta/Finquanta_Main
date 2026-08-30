import {
  WORKFLOWS, WORKFLOW_META, WORKFLOW_TYPES, buildWorkflow, workflowsFor, workflowsInGroup,
  isWorkflowType, WorkflowType,
} from '../../../src/modules/accounting/accounting.engine';

/**
 * The double-entry engine.
 *
 * This is the heart of the product and it had no tests at all: 1,071 lines of
 * accounting module, zero test files importing it. It is also the easiest thing
 * here to test — pure, deterministic, no database, no mocks, no clock.
 *
 * The one rule that matters more than any other is that every entry balances.
 * That is asserted for every workflow rather than for a chosen few, so adding a
 * workflow without balancing it fails here instead of in someone's books.
 */

const sum = (lines: { debit: number; credit: number }[], side: 'debit' | 'credit') =>
  Math.round(lines.reduce((s, l) => s + l[side], 0) * 100) / 100;

describe('accounting engine', () => {
  describe('every workflow balances', () => {
    // Interest only matters to loan_payment, but passing it everywhere proves
    // the others ignore it rather than quietly folding it in.
    const inputs = [
      { amount: 100 },
      { amount: 100, interest: 15 },
      { amount: 0.01 },
      { amount: 1234.56 },
      { amount: 999999.99 },
      { amount: 33.33, interest: 66.67 },
    ];

    it.each(WORKFLOW_TYPES)('%s', (type) => {
      for (const input of inputs) {
        const { lines } = buildWorkflow(type, input);
        expect(lines.length).toBeGreaterThanOrEqual(2);
        expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
      }
    });
  });

  describe('rounding', () => {
    it('rounds the amount to the cent', () => {
      const { lines } = buildWorkflow('cash_revenue', { amount: 10.005 });
      expect(sum(lines, 'debit')).toBe(10.01);
      expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    });

    it('still balances when a sub-cent amount rounds', () => {
      const { lines } = buildWorkflow('cash_expense', { amount: 0.014 });
      expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    });

    it('keeps principal and interest separate on a loan payment', () => {
      const { lines } = buildWorkflow('loan_payment', { amount: 100, interest: 15 });
      const cash = lines.find((l) => l.code === 'CASH');
      const principal = lines.find((l) => l.code === 'LOAN_PAYABLE');
      const interest = lines.find((l) => l.code === 'INTEREST_EXPENSE');
      // Cash moves by the FULL payment; the split only decides the other side.
      expect(cash?.credit).toBe(115);
      expect(principal?.debit).toBe(100);
      expect(interest?.debit).toBe(15);
    });

    it('omits the interest line when there is no interest', () => {
      const { lines } = buildWorkflow('loan_payment', { amount: 100, interest: 0 });
      expect(lines.some((l) => l.code === 'INTEREST_EXPENSE')).toBe(false);
      // A zero-value line would be rejected downstream by normalizeEntryLines.
      expect(lines.every((l) => l.debit > 0 || l.credit > 0)).toBe(true);
    });
  });

  describe('rejects invalid input', () => {
    it.each([0, -1, -0.01, NaN, Infinity])('amount %p', (amount) => {
      expect(() => buildWorkflow('cash_revenue', { amount })).toThrow(/greater than zero/i);
    });

    it('a negative interest', () => {
      expect(() => buildWorkflow('loan_payment', { amount: 100, interest: -1 }))
        .toThrow(/interest cannot be negative/i);
    });

    it('an amount that rounds away to nothing', () => {
      expect(() => buildWorkflow('cash_revenue', { amount: 0.004 })).toThrow(/greater than zero/i);
    });
  });

  describe('account mapping', () => {
    // Locks the direction of each workflow. A silent swap of debit and credit
    // still balances, so balance alone cannot catch it — this can.
    const expected: Record<WorkflowType, { debit: string[]; credit: string[] }> = {
      cash_revenue: { debit: ['CASH'], credit: ['REVENUE'] },
      credit_revenue: { debit: ['AR'], credit: ['REVENUE'] },
      receive_ar_payment: { debit: ['CASH'], credit: ['AR'] },
      cash_expense: { debit: ['EXPENSE'], credit: ['CASH'] },
      credit_expense: { debit: ['EXPENSE'], credit: ['AP'] },
      pay_ap: { debit: ['AP'], credit: ['CASH'] },
      loan_received: { debit: ['CASH'], credit: ['LOAN_PAYABLE'] },
      loan_payment: { debit: ['LOAN_PAYABLE', 'INTEREST_EXPENSE'], credit: ['CASH'] },
    };

    it.each(WORKFLOW_TYPES)('%s posts to the right accounts', (type) => {
      const { lines } = buildWorkflow(type, { amount: 100, interest: 15 });
      const debited = lines.filter((l) => l.debit > 0).map((l) => l.code).sort();
      const credited = lines.filter((l) => l.credit > 0).map((l) => l.code).sort();
      expect(debited).toEqual([...expected[type].debit].sort());
      expect(credited).toEqual([...expected[type].credit].sort());
    });

    it('never puts a debit and a credit on the same line', () => {
      for (const type of WORKFLOW_TYPES) {
        for (const line of buildWorkflow(type, { amount: 100, interest: 15 }).lines) {
          expect(line.debit > 0 && line.credit > 0).toBe(false);
        }
      }
    });
  });

  describe('descriptions', () => {
    it('uses the caller’s description when given', () => {
      expect(buildWorkflow('cash_revenue', { amount: 1, description: 'Consulting' }).description)
        .toBe('Consulting');
    });

    it('falls back to a sensible default', () => {
      for (const type of WORKFLOW_TYPES) {
        expect(buildWorkflow(type, { amount: 1 }).description.trim()).not.toBe('');
      }
    });
  });

  describe('workflow metadata stays in step with the workflows', () => {
    it('every workflow has metadata', () => {
      for (const type of WORKFLOW_TYPES) expect(WORKFLOW_META[type]).toBeDefined();
    });

    it('WORKFLOW_TYPES matches WORKFLOWS', () => {
      expect([...WORKFLOW_TYPES].sort()).toEqual(Object.keys(WORKFLOWS).sort());
    });

    it('every workflow belongs to exactly one basis group', () => {
      const groups = ['cash', 'accrual', 'debt'] as const;
      for (const type of WORKFLOW_TYPES) {
        const hits = groups.filter((g) => workflowsInGroup(g).includes(type));
        expect(hits).toHaveLength(1);
      }
    });

    it('every workflow is offered by at least one module', () => {
      for (const type of WORKFLOW_TYPES) {
        const modules = (['bookkeeping', 'accounting'] as const).filter((m) => workflowsFor(m).includes(type));
        expect(modules.length).toBeGreaterThan(0);
      }
    });
  });

  describe('isWorkflowType', () => {
    it('accepts every real type', () => {
      for (const type of WORKFLOW_TYPES) expect(isWorkflowType(type)).toBe(true);
    });

    it.each([undefined, null, '', 'nonsense', 42, {}])('rejects %p', (value) => {
      expect(isWorkflowType(value)).toBe(false);
    });
  });
});
