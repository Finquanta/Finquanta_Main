import { Database } from '../../infrastructure/database';

/**
 * payable    — money the business BORROWED. A liability. Payments split into
 *              principal (Loan Payable ↓) and Interest Expense ↑.
 * receivable — money the business LENT OUT. An asset (the mirror opposite).
 *              Repayments split into principal (Loan Receivable ↓) and
 *              Interest Income ↑.
 */
export type LoanType = 'payable' | 'receivable';

export interface Loan {
  id: string;
  name: string;
  type: LoanType;
  principal: number;
  annualRate: number;      // e.g. 7.5 = 7.5% per year
  remainingBalance: number;
  startDate: string | null;
  createdAt: string | null;
  /** Business Group this loan belongs to (its interest is attributed here). */
  groupId: string | null;
}

export interface LoanPayment {
  id: string;
  loanId: string;
  date: string | null;
  amount: number;     // total cash moved
  interest: number;   // interest portion
  principal: number;  // principal portion
  balanceAfter: number;
  entryId: string | null;
}

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const day = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : null);

/**
 * Split one payment into interest and principal.
 *
 *   interest  = remaining_balance × (annual_rate / 100) / 12   (one month's interest)
 *   principal = payment − interest
 *
 * Guards that keep the books sane:
 *  - If the payment doesn't even cover the interest, all of it is interest and
 *    principal is 0 (the balance doesn't go up — unpaid interest isn't capitalised).
 *  - Principal is capped at the remaining balance, so a final payment can't
 *    overshoot into a negative balance.
 */
export function splitPayment(payment: number, remainingBalance: number, annualRate: number) {
  const pay = money(payment);
  const balance = money(remainingBalance);
  const monthlyInterest = money(balance * ((Number(annualRate) || 0) / 100) / 12);

  const interest = money(Math.min(monthlyInterest, pay));
  let principal = money(pay - interest);
  if (principal > balance) principal = balance;

  return { interest, principal, balanceAfter: money(balance - principal) };
}

export class LoansRepository {
  constructor(private database: Database) {}

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS loans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        type VARCHAR(20) NOT NULL,
        principal NUMERIC(14,2) NOT NULL DEFAULT 0,
        annual_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
        remaining_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
        start_date DATE DEFAULT CURRENT_DATE,
        entry_id UUID,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS loan_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        amount NUMERIC(14,2) NOT NULL,
        interest NUMERIC(14,2) NOT NULL DEFAULT 0,
        principal NUMERIC(14,2) NOT NULL DEFAULT 0,
        balance_after NUMERIC(14,2) NOT NULL DEFAULT 0,
        entry_id UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    // Business Group a loan is assigned to; its interest expense/income is
    // attributed here in the groups report.
    await this.database.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS group_id UUID`);
    // Backfill: link each loan's "received/issued" journal entry back to the
    // loan, so the ledger row can be traced to (and managed from) the loan.
    // Newer loans set this at creation; this catches ones made before that.
    await this.database.query(
      `UPDATE journal_entries je SET source_id = l.id
       FROM loans l WHERE je.id = l.entry_id AND je.source_id IS NULL`
    );
    await this.database.query(`CREATE INDEX IF NOT EXISTS idx_loans_business ON loans(business_id, type)`);
    await this.database.query(`CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments(loan_id, date DESC)`);
  }

  async create(businessId: string, createdBy: string, data: {
    name: string; type: LoanType; principal: number; annualRate: number; startDate?: string | null; entryId?: string | null; groupId?: string | null;
  }): Promise<Loan> {
    const result = await this.database.query(
      `INSERT INTO loans (business_id, name, type, principal, annual_rate, remaining_balance, start_date, entry_id, created_by, group_id)
       VALUES ($1,$2,$3,$4,$5,$4, COALESCE($6::date, CURRENT_DATE), $7, $8, $9::uuid)
       RETURNING *`,
      [businessId, data.name.trim(), data.type, money(data.principal), Number(data.annualRate) || 0,
       data.startDate ?? null, data.entryId ?? null, createdBy, data.groupId ?? null]
    );
    return this.map(result.rows[0]);
  }

  /** Move a loan into a group (or out, when groupId is null). */
  async setGroup(businessId: string, id: string, groupId: string | null): Promise<boolean> {
    const r = await this.database.query(
      `UPDATE loans SET group_id = $3::uuid WHERE business_id = $1::uuid AND id = $2::uuid`,
      [businessId, id, groupId]
    );
    return (r.rowCount ?? 0) > 0;
  }

  /**
   * Reverse a single loan payment, identified by its ledger entry: delete the
   * payment entry (lines cascade) and the payment row, then recompute the loan's
   * remaining balance from whatever payments are left (order-independent).
   */
  async deletePaymentByEntry(businessId: string, entryId: string): Promise<boolean> {
    return this.database.transaction(async (client) => {
      const found = await client.query(
        `SELECT lp.id AS payment_id, lp.loan_id
         FROM loan_payments lp JOIN loans l ON l.id = lp.loan_id
         WHERE l.business_id = $1::uuid AND lp.entry_id = $2::uuid`,
        [businessId, entryId]
      );
      if (!found.rows[0]) return false;
      const { payment_id, loan_id } = found.rows[0];
      await client.query(`DELETE FROM journal_entries WHERE business_id = $1::uuid AND id = $2::uuid`, [businessId, entryId]);
      await client.query(`DELETE FROM loan_payments WHERE id = $1::uuid`, [payment_id]);
      await client.query(
        `UPDATE loans SET remaining_balance = principal - COALESCE(
           (SELECT SUM(principal) FROM loan_payments WHERE loan_id = $1::uuid), 0)
         WHERE id = $1::uuid`,
        [loan_id]
      );
      return true;
    });
  }

  /** Point a loan's "received/issued" ledger entry back at the loan. */
  async linkReceivedEntry(entryId: string, loanId: string): Promise<void> {
    await this.database.query(`UPDATE journal_entries SET source_id = $2::uuid WHERE id = $1::uuid`, [entryId, loanId]);
  }

  /**
   * Delete a loan and everything it posted: the received/issued entry, every
   * payment entry, and the payment rows (which cascade with the loan). Atomic,
   * so a loan never half-vanishes leaving orphaned ledger entries.
   */
  async deleteWithLedger(businessId: string, id: string): Promise<boolean> {
    return this.database.transaction(async (client) => {
      const loan = await client.query(`SELECT entry_id FROM loans WHERE business_id = $1::uuid AND id = $2::uuid`, [businessId, id]);
      if (!loan.rows[0]) return false;
      const pays = await client.query(`SELECT entry_id FROM loan_payments WHERE loan_id = $1::uuid`, [id]);
      const entryIds = [loan.rows[0].entry_id, ...pays.rows.map((r: any) => r.entry_id)].filter(Boolean);
      if (entryIds.length) {
        // journal_lines cascade with their entry.
        await client.query(`DELETE FROM journal_entries WHERE business_id = $1::uuid AND id = ANY($2::uuid[])`, [businessId, entryIds]);
      }
      // loan_payments cascade via their FK to loans.
      await client.query(`DELETE FROM loans WHERE business_id = $1::uuid AND id = $2::uuid`, [businessId, id]);
      return true;
    });
  }

  async list(businessId: string, type?: LoanType): Promise<Loan[]> {
    const result = await this.database.query(
      `SELECT * FROM loans WHERE business_id = $1 ${type ? 'AND type = $2' : ''} ORDER BY created_at DESC`,
      type ? [businessId, type] : [businessId]
    );
    return result.rows.map((r: any) => this.map(r));
  }

  async getById(businessId: string, id: string): Promise<Loan | null> {
    const result = await this.database.query(
      'SELECT * FROM loans WHERE business_id = $1 AND id = $2',
      [businessId, id]
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  /** Record a payment and move the remaining balance. Atomic. */
  async addPayment(loanId: string, p: {
    date?: string | null; amount: number; interest: number; principal: number; balanceAfter: number; entryId: string;
  }): Promise<LoanPayment> {
    return this.database.transaction(async (client) => {
      const res = await client.query(
        `INSERT INTO loan_payments (loan_id, date, amount, interest, principal, balance_after, entry_id)
         VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, $7)
         RETURNING *`,
        [loanId, p.date ?? null, money(p.amount), money(p.interest), money(p.principal), money(p.balanceAfter), p.entryId]
      );
      await client.query('UPDATE loans SET remaining_balance = $2 WHERE id = $1', [loanId, money(p.balanceAfter)]);
      const r = res.rows[0];
      return {
        id: r.id,
        loanId: r.loan_id,
        date: day(r.date),
        amount: Number.parseFloat(r.amount),
        interest: Number.parseFloat(r.interest),
        principal: Number.parseFloat(r.principal),
        balanceAfter: Number.parseFloat(r.balance_after),
        entryId: r.entry_id ?? null,
      };
    });
  }

  async listPayments(loanId: string): Promise<LoanPayment[]> {
    const result = await this.database.query(
      `SELECT * FROM loan_payments WHERE loan_id = $1 ORDER BY date DESC, created_at DESC`,
      [loanId]
    );
    return result.rows.map((r: any) => ({
      id: r.id,
      loanId: r.loan_id,
      date: day(r.date),
      amount: Number.parseFloat(r.amount),
      interest: Number.parseFloat(r.interest),
      principal: Number.parseFloat(r.principal),
      balanceAfter: Number.parseFloat(r.balance_after),
      entryId: r.entry_id ?? null,
    }));
  }

  private map(r: any): Loan {
    return {
      id: r.id,
      name: r.name,
      type: r.type as LoanType,
      principal: Number.parseFloat(r.principal ?? '0'),
      annualRate: Number.parseFloat(r.annual_rate ?? '0'),
      remainingBalance: Number.parseFloat(r.remaining_balance ?? '0'),
      startDate: day(r.start_date),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      groupId: r.group_id ?? null,
    };
  }
}
