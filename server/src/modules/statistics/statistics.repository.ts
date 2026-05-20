import { Database } from '../../infrastructure/database';
import { CategoryData } from './statistics.types';

const incomeColors = ['#150578', '#63d51d', '#ff8600', '#06b6d4', '#778da9'];
const expenseColors = ['#150578', '#ff8600', '#63d51d', '#f97316', '#06b6d4'];

export class StatisticsRepository {
  constructor(private database: Database) {}

  async getMonthlyRows(userId: string, year: number) {
    const result = await this.database.query(
      `SELECT TO_CHAR(month, 'YYYY-MM') as month,
        total_income as income,
        total_expenses as expenses,
        transaction_count as transactions
       FROM monthly_summary
       WHERE user_id = $1 AND EXTRACT(YEAR FROM month) = $2
       ORDER BY month ASC`,
      [userId, year]
    );

    return result.rows.map((row: any) => ({
      month: row.month,
      income: Number.parseFloat(row.income ?? '0'),
      expenses: Number.parseFloat(row.expenses ?? '0'),
      transactions: Number.parseInt(row.transactions ?? '0', 10)
    }));
  }

  async getCategoryBreakdown(userId: string, year: number): Promise<{ incomeSources: CategoryData[]; expenseCategories: CategoryData[] }> {
    const result = await this.database.query(
      `SELECT type, category, SUM(total_amount) as amount
       FROM transaction_summary
       WHERE user_id = $1
         AND EXTRACT(YEAR FROM latest_date) = $2
       GROUP BY type, category
       ORDER BY amount DESC`,
      [userId, year]
    );

    const incomeRows = result.rows.filter((row: any) => row.type === 'income');
    const expenseRows = result.rows.filter((row: any) => row.type === 'expense');

    return {
      incomeSources: this.mapCategoryRows(incomeRows, incomeColors),
      expenseCategories: this.mapCategoryRows(expenseRows, expenseColors)
    };
  }

  private mapCategoryRows(rows: any[], colors: string[]): CategoryData[] {
    const total = rows.reduce((sum, row) => sum + Number.parseFloat(row.amount), 0);
    return rows.map((row, index) => ({
      name: row.category,
      value: Number.parseFloat(row.amount),
      percentage: total === 0 ? 0 : Number(((Number.parseFloat(row.amount) / total) * 100).toFixed(1)),
      color: colors[index] ?? '#778da9',
      change: 0
    }));
  }
}
