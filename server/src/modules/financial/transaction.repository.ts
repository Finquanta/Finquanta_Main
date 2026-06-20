import { Database } from '../../infrastructure/database';
import {
  Transaction,
  TransactionRow,
  CreateTransactionData,
  UpdateTransactionData,
  TransactionFilters,
  TransactionListResponse,
  FinancialSummary,
  TransactionType,
  TransactionStatus
} from './transaction.types';

export class TransactionRepository {
  constructor(private database: Database) {}

  async create(businessId: string, userId: string, data: CreateTransactionData): Promise<Transaction> {
    const query = `
      INSERT INTO financial_transactions (
        business_id, user_id, type, category, subcategory, amount, description, date,
        invoice, status, metadata, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
      )
      RETURNING *
    `;

    const result = await this.database.query(query, [
      businessId,
      userId,
      data.type,
      data.category,
      data.subcategory || null,
      data.amount.toString(),
      data.description || null,
      data.date,
      data.invoice || null,
      TransactionStatus.COMPLETED,
      data.metadata || {}
    ]);

    return this.mapRowToTransaction(result.rows[0]);
  }

  async findById(id: string, businessId: string): Promise<Transaction | null> {
    const query = `
      SELECT * FROM financial_transactions
      WHERE id = $1 AND business_id = $2
    `;

    const result = await this.database.query(query, [id, businessId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTransaction(result.rows[0]);
  }

  async getUserTransactions(
    businessId: string,
    filters: TransactionFilters = {}
  ): Promise<TransactionListResponse> {
    let whereClauses = ['business_id = $1'];
    let queryParams: any[] = [businessId];
    let paramIndex = 2;

    // Add filters
    if (filters.type) {
      whereClauses.push(`type = $${paramIndex++}`);
      queryParams.push(filters.type);
    }

    if (filters.category) {
      whereClauses.push(`category = $${paramIndex++}`);
      queryParams.push(filters.category);
    }

    if (filters.subcategory) {
      whereClauses.push(`subcategory = $${paramIndex++}`);
      queryParams.push(filters.subcategory);
    }

    if (filters.startDate) {
      whereClauses.push(`date >= $${paramIndex++}`);
      queryParams.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClauses.push(`date <= $${paramIndex++}`);
      queryParams.push(filters.endDate);
    }

    if (filters.status) {
      whereClauses.push(`status = $${paramIndex++}`);
      queryParams.push(filters.status);
    }

    if (filters.invoice) {
      whereClauses.push(`invoice = $${paramIndex++}`);
      queryParams.push(filters.invoice);
    }

    // Build the query
    const whereClause = whereClauses.join(' AND ');

    // Default sorting
    const sortBy = filters.sortBy || 'date';
    const sortOrder = filters.sortOrder || 'desc';
    const orderClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM financial_transactions WHERE ${whereClause}`;
    const countResult = await this.database.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Add pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const dataQuery = `
      SELECT * FROM financial_transactions
      WHERE ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    queryParams.push(limit, offset);

    const dataResult = await this.database.query(dataQuery, queryParams);
    const transactions = dataResult.rows.map((row: any) => this.mapRowToTransaction(row));

    return {
      transactions,
      totalCount,
      hasMore: offset + transactions.length < totalCount,
      filters
    };
  }

  async update(id: string, businessId: string, data: UpdateTransactionData): Promise<Transaction | null> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    if (data.type !== undefined) {
      setClause.push(`type = $${paramIndex++}`);
      values.push(data.type);
    }

    if (data.category !== undefined) {
      setClause.push(`category = $${paramIndex++}`);
      values.push(data.category);
    }

    if (data.subcategory !== undefined) {
      setClause.push(`subcategory = $${paramIndex++}`);
      values.push(data.subcategory);
    }

    if (data.amount !== undefined) {
      setClause.push(`amount = $${paramIndex++}`);
      values.push(data.amount.toString());
    }

    if (data.description !== undefined) {
      setClause.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }

    if (data.date !== undefined) {
      setClause.push(`date = $${paramIndex++}`);
      values.push(data.date);
    }

    if (data.invoice !== undefined) {
      setClause.push(`invoice = $${paramIndex++}`);
      values.push(data.invoice);
    }

    if (data.status !== undefined) {
      setClause.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (data.metadata !== undefined) {
      setClause.push(`metadata = $${paramIndex++}`);
      values.push(data.metadata);
    }

    if (setClause.length === 0) {
      // No updates to make
      return this.findById(id, businessId);
    }

    setClause.push(`updated_at = NOW()`);
    values.push(id, businessId);

    const query = `
      UPDATE financial_transactions
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex++} AND business_id = $${paramIndex++}
      RETURNING *
    `;

    const result = await this.database.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTransaction(result.rows[0]);
  }

  async delete(id: string, businessId: string): Promise<boolean> {
    const query = 'DELETE FROM financial_transactions WHERE id = $1 AND business_id = $2';
    const result = await this.database.query(query, [id, businessId]);
    return result.rowCount > 0;
  }

  async calculateSummary(
    businessId: string,
    dateRange: { startDate: string; endDate: string }
  ): Promise<FinancialSummary> {
    const query = `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
        COUNT(*) as transaction_count
      FROM financial_transactions
      WHERE business_id = $1
        AND date >= $2
        AND date <= $3
        AND status = 'completed'
    `;

    const result = await this.database.query(query, [
      businessId,
      dateRange.startDate,
      dateRange.endDate
    ]);

    const row = result.rows[0];
    const totalIncome = parseFloat(row.total_income).toFixed(2);
    const totalExpenses = parseFloat(row.total_expenses).toFixed(2);
    const netIncome = (parseFloat(totalIncome) - parseFloat(totalExpenses)).toFixed(2);

    return {
      totalIncome,
      totalExpenses,
      netIncome,
      transactionCount: parseInt(row.transaction_count),
      periodStart: dateRange.startDate,
      periodEnd: dateRange.endDate
    };
  }

  async getCategoryBreakdown(
    businessId: string,
    type: TransactionType,
    dateRange: { startDate: string; endDate: string }
  ): Promise<any[]> {
    const query = `
      SELECT
        category,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count
      FROM financial_transactions
      WHERE business_id = $1
        AND type = $2
        AND date >= $3
        AND date <= $4
        AND status = 'completed'
      GROUP BY category
      ORDER BY total_amount DESC
    `;

    const result = await this.database.query(query, [
      businessId,
      type,
      dateRange.startDate,
      dateRange.endDate
    ]);

    return result.rows.map((row: any) => ({
      category: row.category,
      amount: parseFloat(row.total_amount).toFixed(2),
      count: parseInt(row.transaction_count)
    }));
  }

  private mapRowToTransaction(row: TransactionRow): Transaction {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      category: row.category,
      subcategory: row.subcategory || undefined,
      amount: parseFloat(row.amount).toFixed(2),
      description: row.description || undefined,
      date: row.date,
      invoice: row.invoice || undefined,
      status: row.status,
      metadata: row.metadata || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}