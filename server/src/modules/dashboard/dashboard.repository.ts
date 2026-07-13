import { Database } from '../../infrastructure/database';
import { getPreviousMonthRange } from '../shared/date-range';
import { AccountingRepository } from '../accounting/accounting.repository';
import { CreateGoalData, ExpenseSegment, LatestTransaction, RevenueMetric, RevenuePoint, RevenueRange, UpdateGoalData, WeeklyData } from './dashboard.types';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const segmentColors = ['#1e1b4b', '#0f766e', '#f97316', '#06b6d4', '#778da9'];

export class DashboardRepository {
  private ledger: AccountingRepository;

  constructor(private database: Database) {
    this.ledger = new AccountingRepository(database);
  }

  /**
   * Bring the ledger up to date with bookkeeping before reading from it. This
   * backfills any transaction that predates the ledger and re-posts anything
   * that was edited, so the dashboard can safely treat the ledger as the single
   * source of truth. Idempotent and cheap once caught up.
   */
  private async syncLedger(businessId: string): Promise<void> {
    await this.ledger.resyncBookkeeping(businessId);
  }

  /**
   * The headline numbers, now derived from the LEDGER rather than from
   * bookkeeping alone — so an invoice you've marked Sent (Accounts Receivable)
   * and a loan actually show up on the dashboard.
   */
  async getSummary(businessId: string, startDate: string, endDate: string) {
    await this.syncLedger(businessId);
    const s = await this.ledger.getLedgerSummary(businessId, startDate, endDate, 'accrual');
    return {
      totalIncome: s.totalIncome,
      totalExpenses: s.totalExpenses,
      netIncome: s.netIncome,
      transactionCount: s.transactionCount,
      startDate,
      endDate,
    };
  }

  async getPreviousSummary(businessId: string, startDate: string) {
    const previous = getPreviousMonthRange(startDate);
    const s = await this.ledger.getLedgerSummary(businessId, previous.startDate, previous.endDate, 'accrual');
    return {
      totalIncome: s.totalIncome,
      totalExpenses: s.totalExpenses,
      netIncome: s.netIncome,
      transactionCount: s.transactionCount,
      startDate: previous.startDate,
      endDate: previous.endDate,
    };
  }

  async getWeeklyTrend(businessId: string, startDate: string, endDate: string): Promise<WeeklyData[]> {
    const query = `
      SELECT EXTRACT(DOW FROM date)::INT as day_index,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
      FROM financial_transactions
      WHERE business_id = $1 AND date >= $2 AND date <= $3 AND status = 'completed'
      GROUP BY EXTRACT(DOW FROM date)
    `;
    const result = await this.database.query(query, [businessId, startDate, endDate]);
    const labels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const rows = new Map<number, any>(result.rows.map((row: any) => [Number(row.day_index), row]));

    return [1, 2, 3, 4, 5, 6, 0].map(dayIndex => ({
      day: labels[dayIndex] ?? '',
      income: Number.parseFloat(rows.get(dayIndex)?.income ?? '0'),
      expense: Number.parseFloat(rows.get(dayIndex)?.expense ?? '0')
    }));
  }

  async getExpenseSegments(businessId: string, startDate: string, endDate: string): Promise<ExpenseSegment[]> {
    const query = `
      SELECT category, SUM(amount) as total_amount
      FROM financial_transactions
      WHERE business_id = $1 AND type = 'expense' AND date >= $2 AND date <= $3 AND status = 'completed'
      GROUP BY category
      ORDER BY total_amount DESC
      LIMIT 5
    `;
    const result = await this.database.query(query, [businessId, startDate, endDate]);
    const total = result.rows.reduce((sum: number, row: any) => sum + Number.parseFloat(row.total_amount), 0);

    return result.rows.map((row: any, index: number) => ({
      name: row.category,
      percentage: total === 0 ? 0 : Number(((Number.parseFloat(row.total_amount) / total) * 100).toFixed(1)),
      color: segmentColors[index] ?? '#778da9'
    }));
  }

  async getRevenueSeries(businessId: string, range: RevenueRange, metric: RevenueMetric = 'revenue'): Promise<RevenuePoint[]> {
    // Read from the LEDGER, so invoices and loans appear on the chart too — not
    // just bookkeeping. Sync first so nothing predating the ledger is missing.
    await this.syncLedger(businessId);

    // Each metric reads a different part of the books:
    //   revenue  -> the Revenue accounts   (credit − debit)
    //   expense  -> the Expense accounts   (debit − credit)
    //   cashflow -> the Business Cash account (debit − credit) = money actually
    //               in/out. An unpaid invoice moves no cash, so it stays out of
    //               cashflow while still counting as revenue.
    const sumExpr =
      metric === 'expense'
        ? `COALESCE(SUM(CASE WHEN a.type = 'expense' THEN l.debit - l.credit ELSE 0 END), 0)`
        : metric === 'cashflow'
          ? `COALESCE(SUM(CASE WHEN a.code = 'CASH' THEN l.debit - l.credit ELSE 0 END), 0)`
          : `COALESCE(SUM(CASE WHEN a.type = 'revenue' THEN l.credit - l.debit ELSE 0 END), 0)`;

    const LEDGER_FROM = `
      FROM journal_entries e
      JOIN journal_lines l ON l.entry_id = e.id
      JOIN accounts a ON a.id = l.account_id`;

    if (range === 'day') {
      const result = await this.database.query(
        `SELECT e.date::date as bucket, ${sumExpr} as v
         ${LEDGER_FROM}
         WHERE e.business_id = $1::uuid
           AND e.date >= (CURRENT_DATE - INTERVAL '29 days') AND e.date <= CURRENT_DATE
         GROUP BY e.date::date`,
        [businessId]
      );
      const map = new Map<string, number>(
        result.rows.map((r: any) => [new Date(r.bucket).toISOString().slice(0, 10), Number.parseFloat(r.v)])
      );
      const points: RevenuePoint[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setUTCHours(0, 0, 0, 0);
        d.setUTCDate(d.getUTCDate() - i);
        const iso = d.toISOString().slice(0, 10);
        points.push({
          label: `${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCDate()}`,
          full: `${MONTH_FULL[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`,
          value: map.get(iso) ?? 0
        });
      }
      return points;
    }

    if (range === 'month') {
      const result = await this.database.query(
        `SELECT EXTRACT(MONTH FROM e.date)::int as bucket, ${sumExpr} as v
         ${LEDGER_FROM}
         WHERE e.business_id = $1::uuid
           AND EXTRACT(YEAR FROM e.date) = EXTRACT(YEAR FROM CURRENT_DATE)
         GROUP BY bucket`,
        [businessId]
      );
      const map = new Map<number, number>(result.rows.map((r: any) => [Number(r.bucket), Number.parseFloat(r.v)]));
      const year = new Date().getUTCFullYear();
      return MONTH_LABELS.map((label, idx) => ({
        label,
        full: `${MONTH_FULL[idx]} ${year}`,
        value: map.get(idx + 1) ?? 0
      }));
    }

    // range === 'year' — last 5 years
    const result = await this.database.query(
      `SELECT EXTRACT(YEAR FROM e.date)::int as bucket, ${sumExpr} as v
       ${LEDGER_FROM}
       WHERE e.business_id = $1::uuid
         AND e.date >= (CURRENT_DATE - INTERVAL '4 years')
       GROUP BY bucket`,
      [businessId]
    );
    const map = new Map<number, number>(result.rows.map((r: any) => [Number(r.bucket), Number.parseFloat(r.v)]));
    const currentYear = new Date().getUTCFullYear();
    const points: RevenuePoint[] = [];
    for (let y = currentYear - 4; y <= currentYear; y++) {
      points.push({ label: String(y), full: String(y), value: map.get(y) ?? 0 });
    }
    return points;
  }

  async getGoals(businessId: string) {
    const result = await this.database.query(
      'SELECT id, name, current_amount, target_amount, color, updated_at FROM user_goals WHERE business_id = $1 ORDER BY created_at DESC',
      [businessId]
    );

    return result.rows.map((row: any) => this.mapGoal(row));
  }

  async createGoal(businessId: string, userId: string, data: CreateGoalData) {
    const result = await this.database.query(
      `INSERT INTO user_goals (business_id, user_id, name, current_amount, target_amount, color, period, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id, name, current_amount, target_amount, color, updated_at`,
      [
        businessId,
        userId,
        data.name,
        data.current ?? 0,
        data.target,
        data.color ?? 'bg-blue-600',
        data.period ?? 'This month'
      ]
    );

    return this.mapGoal(result.rows[0]);
  }

  async updateGoal(businessId: string, id: string, data: UpdateGoalData) {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) { setClause.push(`name = $${paramIndex++}`); values.push(data.name); }
    if (data.current !== undefined) { setClause.push(`current_amount = $${paramIndex++}`); values.push(data.current); }
    if (data.target !== undefined) { setClause.push(`target_amount = $${paramIndex++}`); values.push(data.target); }
    if (data.color !== undefined) { setClause.push(`color = $${paramIndex++}`); values.push(data.color); }
    if (data.period !== undefined) { setClause.push(`period = $${paramIndex++}`); values.push(data.period); }

    if (setClause.length === 0) {
      const existing = await this.database.query(
        'SELECT id, name, current_amount, target_amount, color, updated_at FROM user_goals WHERE id = $1 AND business_id = $2',
        [id, businessId]
      );
      return existing.rows[0] ? this.mapGoal(existing.rows[0]) : null;
    }

    setClause.push('updated_at = NOW()');
    values.push(id, businessId);

    const result = await this.database.query(
      `UPDATE user_goals SET ${setClause.join(', ')}
       WHERE id = $${paramIndex++} AND business_id = $${paramIndex++}
       RETURNING id, name, current_amount, target_amount, color, updated_at`,
      values
    );

    return result.rows[0] ? this.mapGoal(result.rows[0]) : null;
  }

  async deleteGoal(businessId: string, id: string): Promise<boolean> {
    const result = await this.database.query(
      'DELETE FROM user_goals WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapGoal(row: any) {
    return {
      id: row.id,
      name: row.name,
      current: Number.parseFloat(row.current_amount),
      target: Number.parseFloat(row.target_amount),
      color: row.color,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    };
  }

  async getLatestTransactions(businessId: string, limit = 5): Promise<LatestTransaction[]> {
    const result = await this.database.query(
      `SELECT t.id, t.date, t.type, t.category, t.description, t.invoice, t.amount, t.metadata,
              EXISTS (SELECT 1 FROM transaction_receipts r WHERE r.transaction_id = t.id) AS has_receipt
       FROM financial_transactions t
       WHERE t.business_id = $1
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT $2`,
      [businessId, limit]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      // row.date may be a Date object (pg) or a string; normalise to YYYY-MM-DD
      date: new Date(row.date).toISOString().slice(0, 10),
      type: row.type === 'expense' ? 'Expense' : 'Cashflow',
      name: row.category,
      detail: row.description ?? '',
      invoice: row.invoice ?? null,
      price: Number.parseFloat(row.amount),
      amount: row.type === 'expense' ? -Number.parseFloat(row.amount) : Number.parseFloat(row.amount),
      recurrence: row.metadata?.recurrence ?? 'once',
      hasReceipt: row.has_receipt === true
    }));
  }

  private mapSummary(row: any, startDate: string, endDate: string) {
    const totalIncome = Number.parseFloat(row.total_income ?? '0').toFixed(2);
    const totalExpenses = Number.parseFloat(row.total_expenses ?? '0').toFixed(2);
    const netIncome = (Number.parseFloat(totalIncome) - Number.parseFloat(totalExpenses)).toFixed(2);
    return {
      totalIncome,
      totalExpenses,
      netIncome,
      transactionCount: Number.parseInt(row.transaction_count ?? '0', 10),
      periodStart: startDate,
      periodEnd: endDate
    };
  }
}
