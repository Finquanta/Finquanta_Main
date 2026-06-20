import { Database } from '../../infrastructure/database';
import { CategoryData } from './statistics.types';

const incomeColors = ['#150578', '#63d51d', '#ff8600', '#06b6d4', '#778da9'];
const expenseColors = ['#150578', '#ff8600', '#63d51d', '#f97316', '#06b6d4'];

export class StatisticsRepository {
  constructor(private database: Database) {}

  async getMonthlyRows(businessId: string, year: number) {
    const result = await this.database.query(
      `SELECT TO_CHAR(date, 'YYYY-MM') as month,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
        COUNT(*) as transactions
       FROM financial_transactions
       WHERE business_id = $1 AND EXTRACT(YEAR FROM date) = $2 AND status = 'completed'
       GROUP BY TO_CHAR(date, 'YYYY-MM')
       ORDER BY month ASC`,
      [businessId, year]
    );

    return result.rows.map((row: any) => ({
      month: row.month,
      income: Number.parseFloat(row.income ?? '0'),
      expenses: Number.parseFloat(row.expenses ?? '0'),
      transactions: Number.parseInt(row.transactions ?? '0', 10)
    }));
  }

  async getCategoryBreakdown(businessId: string, year: number): Promise<{ incomeSources: CategoryData[]; expenseCategories: CategoryData[] }> {
    const result = await this.database.query(
      `SELECT type, category, SUM(amount) as amount
       FROM financial_transactions
       WHERE business_id = $1
         AND EXTRACT(YEAR FROM date) = $2
         AND status = 'completed'
       GROUP BY type, category
       ORDER BY amount DESC`,
      [businessId, year]
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
