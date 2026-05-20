import { Database } from '../../infrastructure/database';
import { PayrollTransaction } from './payroll.types';

export class PayrollRepository {
  constructor(private database: Database) {}

  async getTransactions(userId: string, period: string): Promise<PayrollTransaction[]> {
    const result = await this.database.query(
      `SELECT id, employee_name, company, amount, transaction_date, transaction_time, invoice_date, status, avatar_url
       FROM payroll_transactions
       WHERE user_id = $1 AND TO_CHAR(transaction_date, 'YYYY-MM') = $2
       ORDER BY transaction_date DESC`,
      [userId, period]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      employeeName: row.employee_name,
      company: row.company ?? undefined,
      date: row.transaction_date ? String(row.transaction_date) : undefined,
      time: row.transaction_time ? String(row.transaction_time) : undefined,
      amount: Number.parseFloat(row.amount),
      invoiceDate: row.invoice_date ? String(row.invoice_date) : undefined,
      status: String(row.status).toUpperCase(),
      avatarUrl: row.avatar_url ?? undefined
    }));
  }

  async getSummary(userId: string, period: string) {
    const result = await this.database.query(
      `SELECT
        COALESCE(SUM(amount), 0) as payment,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as paid,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count
       FROM payroll_transactions
       WHERE user_id = $1 AND TO_CHAR(transaction_date, 'YYYY-MM') = $2`,
      [userId, period]
    );
    const row = result.rows[0];
    const totalCount = Number.parseInt(row.total_count ?? '0', 10);
    const completedCount = Number.parseInt(row.completed_count ?? '0', 10);
    return {
      payment: Number.parseFloat(row.payment ?? '0'),
      pending: Number.parseFloat(row.pending ?? '0'),
      paid: Number.parseFloat(row.paid ?? '0'),
      completionPercentage: totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100)
    };
  }

  async getOutstandingSeries(userId: string, period: string) {
    const result = await this.database.query(
      `SELECT transaction_date, SUM(amount) as value
       FROM payroll_transactions
       WHERE user_id = $1 AND TO_CHAR(transaction_date, 'YYYY-MM') = $2 AND status != 'completed'
       GROUP BY transaction_date
       ORDER BY transaction_date ASC`,
      [userId, period]
    );

    return result.rows.map((row: any, index: number) => ({
      date: String(row.transaction_date),
      value: Number.parseFloat(row.value),
      label: new Date(row.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      highlighted: index === result.rows.length - 1
    }));
  }

  async getClient(userId: string) {
    const result = await this.database.query(
      'SELECT name, company, avatar_url FROM payroll_clients WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      name: result.rows[0].name,
      company: result.rows[0].company ?? undefined,
      avatarUrl: result.rows[0].avatar_url ?? undefined
    };
  }
}
