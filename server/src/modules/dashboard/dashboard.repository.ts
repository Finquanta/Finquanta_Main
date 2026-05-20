import { Database } from '../../infrastructure/database';
import { getPreviousMonthRange } from '../shared/date-range';
import { ExpenseSegment, LatestTransaction, WeeklyData } from './dashboard.types';

const segmentColors = ['#1e1b4b', '#0f766e', '#f97316', '#06b6d4', '#778da9'];

export class DashboardRepository {
  constructor(private database: Database) {}

  async getSummary(userId: string, startDate: string, endDate: string) {
    const query = `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
        COUNT(*) as transaction_count
      FROM financial_transactions
      WHERE user_id = $1 AND date >= $2 AND date <= $3 AND status = 'completed'
    `;
    const result = await this.database.query(query, [userId, startDate, endDate]);
    return this.mapSummary(result.rows[0], startDate, endDate);
  }

  async getPreviousSummary(userId: string, startDate: string) {
    const previous = getPreviousMonthRange(startDate);
    return this.getSummary(userId, previous.startDate, previous.endDate);
  }

  async getWeeklyTrend(userId: string, startDate: string, endDate: string): Promise<WeeklyData[]> {
    const query = `
      SELECT EXTRACT(DOW FROM date)::INT as day_index,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
      FROM financial_transactions
      WHERE user_id = $1 AND date >= $2 AND date <= $3 AND status = 'completed'
      GROUP BY EXTRACT(DOW FROM date)
    `;
    const result = await this.database.query(query, [userId, startDate, endDate]);
    const labels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const rows = new Map<number, any>(result.rows.map((row: any) => [Number(row.day_index), row]));

    return [1, 2, 3, 4, 5, 6, 0].map(dayIndex => ({
      day: labels[dayIndex] ?? '',
      income: Number.parseFloat(rows.get(dayIndex)?.income ?? '0'),
      expense: Number.parseFloat(rows.get(dayIndex)?.expense ?? '0')
    }));
  }

  async getExpenseSegments(userId: string, startDate: string, endDate: string): Promise<ExpenseSegment[]> {
    const query = `
      SELECT category, SUM(amount) as total_amount
      FROM financial_transactions
      WHERE user_id = $1 AND type = 'expense' AND date >= $2 AND date <= $3 AND status = 'completed'
      GROUP BY category
      ORDER BY total_amount DESC
      LIMIT 5
    `;
    const result = await this.database.query(query, [userId, startDate, endDate]);
    const total = result.rows.reduce((sum: number, row: any) => sum + Number.parseFloat(row.total_amount), 0);

    return result.rows.map((row: any, index: number) => ({
      name: row.category,
      percentage: total === 0 ? 0 : Number(((Number.parseFloat(row.total_amount) / total) * 100).toFixed(1)),
      color: segmentColors[index] ?? '#778da9'
    }));
  }

  async getGoals(userId: string) {
    const result = await this.database.query(
      'SELECT id, name, current_amount, target_amount, color FROM user_goals WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      current: Number.parseFloat(row.current_amount),
      target: Number.parseFloat(row.target_amount),
      color: row.color
    }));
  }

  async getLatestTransactions(userId: string, limit = 5): Promise<LatestTransaction[]> {
    const result = await this.database.query(
      `SELECT id, date, type, category, description, invoice, amount
       FROM financial_transactions
       WHERE user_id = $1
       ORDER BY date DESC, created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      date: String(row.date).slice(0, 10),
      type: row.category,
      detail: row.description ?? row.category,
      invoice: row.invoice ?? null,
      price: Number.parseFloat(row.amount),
      amount: row.type === 'expense' ? -Number.parseFloat(row.amount) : Number.parseFloat(row.amount)
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
