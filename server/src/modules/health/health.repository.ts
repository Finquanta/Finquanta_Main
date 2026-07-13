import { Database } from '../../infrastructure/database';
import { FinancialSnapshot } from './health.types';

/**
 * Everything the Financial Health Score reads comes from the ledger — the same
 * single source of truth the dashboard uses (Section 8). Nothing here queries
 * financial_transactions directly.
 */
export class HealthRepository {
  constructor(private database: Database) {}

  /** Days since the business recorded its first entry. 0 if it never has. */
  async daysOfData(businessId: string): Promise<number> {
    const result = await this.database.query(
      `SELECT MIN(date)::date AS first FROM journal_entries WHERE business_id = $1::uuid`,
      [businessId]
    );
    const first = result.rows[0]?.first;
    if (!first) return 0;
    const days = Math.floor((Date.now() - new Date(first).getTime()) / 86_400_000);
    return Math.max(0, days);
  }

  /**
   * Balances as at `asOf`, plus revenue/expense/cash flows over the
   * `periodDays` ending there.
   *
   * Balances are cumulative (everything up to that date); flows are windowed.
   * That's the distinction between a balance sheet and an income statement, and
   * the ratios need both.
   *
   * Operating cash flow deliberately excludes any entry that touches a loan
   * account: money borrowed is not money earned, and repaying a loan is not an
   * operating cost. Without that exclusion a business could take out a loan and
   * appear to have strong cash generation.
   */
  async snapshot(businessId: string, asOf: string, periodDays: number): Promise<FinancialSnapshot> {
    const result = await this.database.query(
      `WITH
       -- Cumulative account balances up to the cut-off, in each account's
       -- natural direction (assets/expenses are debit-normal).
       balances AS (
         SELECT a.code,
                SUM(l.debit - l.credit) AS debit_balance,
                SUM(l.credit - l.debit) AS credit_balance
         FROM journal_entries e
         JOIN journal_lines l ON l.entry_id = e.id
         JOIN accounts a ON a.id = l.account_id
         WHERE e.business_id = $1::uuid AND e.date <= $2::date
         GROUP BY a.code
       ),
       -- Revenue and expenses earned/incurred inside the window.
       flows AS (
         SELECT
           COALESCE(SUM(CASE WHEN a.type = 'revenue' THEN l.credit - l.debit ELSE 0 END), 0) AS revenue,
           COALESCE(SUM(CASE WHEN a.type = 'expense' THEN l.debit - l.credit ELSE 0 END), 0) AS expenses
         FROM journal_entries e
         JOIN journal_lines l ON l.entry_id = e.id
         JOIN accounts a ON a.id = l.account_id
         WHERE e.business_id = $1::uuid
           AND e.date <= $2::date
           AND e.date > ($2::date - ($3::int || ' days')::interval)
       ),
       -- Cash moved by operations only: skip any entry involving a loan.
       ocf AS (
         SELECT COALESCE(SUM(l.debit - l.credit), 0) AS operating_cash_flow
         FROM journal_entries e
         JOIN journal_lines l ON l.entry_id = e.id
         JOIN accounts a ON a.id = l.account_id
         WHERE e.business_id = $1::uuid
           AND e.date <= $2::date
           AND e.date > ($2::date - ($3::int || ' days')::interval)
           AND a.code = 'CASH'
           AND NOT EXISTS (
             SELECT 1 FROM journal_lines fl
             JOIN accounts fa ON fa.id = fl.account_id
             WHERE fl.entry_id = e.id
               AND fa.code IN ('LOAN_PAYABLE', 'LOAN_RECEIVABLE')
           )
       )
       SELECT
         COALESCE((SELECT debit_balance  FROM balances WHERE code = 'CASH'), 0)             AS cash,
         COALESCE((SELECT debit_balance  FROM balances WHERE code = 'AR'), 0)               AS receivables,
         COALESCE((SELECT debit_balance  FROM balances WHERE code = 'LOAN_RECEIVABLE'), 0)  AS loan_receivable,
         COALESCE((SELECT credit_balance FROM balances WHERE code = 'AP'), 0)               AS payables,
         COALESCE((SELECT credit_balance FROM balances WHERE code = 'LOAN_PAYABLE'), 0)     AS loan_payable,
         (SELECT revenue FROM flows)              AS revenue,
         (SELECT expenses FROM flows)             AS expenses,
         (SELECT operating_cash_flow FROM ocf)    AS operating_cash_flow`,
      [businessId, asOf, periodDays]
    );

    const r = result.rows[0] ?? {};
    const num = (v: any) => Math.round((Number.parseFloat(v ?? '0') || 0) * 100) / 100;

    return {
      cash: num(r.cash),
      receivables: num(r.receivables),
      loanReceivable: num(r.loan_receivable),
      payables: num(r.payables),
      loanPayable: num(r.loan_payable),
      revenue: num(r.revenue),
      expenses: num(r.expenses),
      operatingCashFlow: num(r.operating_cash_flow),
    };
  }
}
