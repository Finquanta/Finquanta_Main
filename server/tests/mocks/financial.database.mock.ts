import { MockDatabase } from './database.mock';
import { TransactionType, TransactionStatus, TransactionRow } from '../../src/modules/financial/transaction.types';

export class FinancialMockDatabase extends MockDatabase {
  private transactions: TransactionRow[] = [];
  private categories: any[] = [];
  private analyticsCache: any[] = [];
  private nextTransactionId = 1;
  private nextCategoryId = 1;
  private nextCacheId = 1;

  constructor() {
    super();
    this.initializeDefaultCategories();
  }

  override async query(text: string, params?: any[]): Promise<any> {
    // Handle financial transaction queries
    if (text.includes('financial_transactions')) {
      return this.handleTransactionQuery(text, params);
    }

    if (text.includes('transaction_categories')) {
      return this.handleCategoryQuery(text, params);
    }

    if (text.includes('analytics_cache')) {
      return this.handleAnalyticsCacheQuery(text, params);
    }

    if (text.includes('information_schema')) {
      return this.handleInformationSchemaQuery(text, params);
    }

    if (text.includes('pg_indexes')) {
      return this.handleIndexesQuery(text, params);
    }

    if (text.includes('INSERT INTO transaction_categories') && params) {
      const newCategory = {
        id: `cat-${this.nextCategoryId++}`,
        name: params[0],
        type: params[1],
        icon: params[2],
        color: params[3],
        is_default: params[4],
        created_at: new Date().toISOString()
      };
      this.categories.push(newCategory);
      return { rows: [newCategory], rowCount: 1 };
    }

    // Default to parent implementation for user queries
    return super.query(text, params);
  }

  private handleTransactionQuery(text: string, params?: any[]): any {
    // Handle INSERT
    if (text.includes('INSERT INTO financial_transactions') && params) {
      const newTransaction: TransactionRow = {
        id: `txn-${this.nextTransactionId++}`,
        user_id: params[0],
        type: params[1] as TransactionType,
        category: params[2],
        subcategory: params[3],
        amount: params[4],
        description: params[5],
        date: params[6],
        invoice: params[7],
        status: params[8] as TransactionStatus,
        metadata: params[9] || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.transactions.push(newTransaction);
      return { rows: [this.mapTransactionToRow(newTransaction)], rowCount: 1 };
    }

    // Handle UPDATE
    if (text.includes('UPDATE financial_transactions') && params) {
      const idIndex = text.split('$').length - 2;
      const userIdIndex = text.split('$').length - 1;
      const id = params[idIndex - 1];
      const userId = params[userIdIndex - 1];

      const transactionIndex = this.transactions.findIndex(
        t => t.id === id && t.user_id === userId
      );

      if (transactionIndex === -1) {
        return { rows: [], rowCount: 0 };
      }

      const transaction = this.transactions[transactionIndex]!;

      // Parse UPDATE SET clauses
      if (text.includes('type =')) {
        const typeIndex = 1;
        transaction.type = params[typeIndex];
      }
      if (text.includes('category =')) {
        const categoryIndex = text.includes('type =') ? 2 : 1;
        transaction.category = params[categoryIndex];
      }
      if (text.includes('amount =')) {
        let amountIndex = 1;
        for (let i = 1; i < params.length - 2; i++) {
          if (text.includes(`$${i}`) && text.includes('amount')) {
            amountIndex = i;
            break;
          }
        }
        transaction.amount = params[amountIndex];
      }

      transaction.updated_at = new Date().toISOString();

      return { rows: [this.mapTransactionToRow(transaction)], rowCount: 1 };
    }

    // Handle DELETE
    if (text.includes('DELETE FROM financial_transactions') && params) {
      const [id, userId] = params;
      const initialLength = this.transactions.length;
      this.transactions = this.transactions.filter(
        t => !(t.id === id && t.user_id === userId)
      );
      return { rows: [], rowCount: initialLength - this.transactions.length };
    }

    // Handle COUNT query
    if (text.includes('COUNT(*)') && text.includes('financial_transactions')) {
      let filteredTransactions = [...this.transactions];

      // Apply user filter
      if (params && params.length > 0) {
        filteredTransactions = filteredTransactions.filter(t => t.user_id === params[0]);
      }

      // Apply additional filters based on query
      if (text.includes('type =') && params) {
        const typeIndex = params.findIndex(p => p === 'income' || p === 'expense');
        if (typeIndex !== -1) {
          filteredTransactions = filteredTransactions.filter(t => t.type === params[typeIndex]);
        }
      }

      if (text.includes('date >=') && params) {
        const dateIndex = params.findIndex(p => p && p.match(/^\d{4}-\d{2}-\d{2}$/));
        if (dateIndex !== -1) {
          filteredTransactions = filteredTransactions.filter(t => t.date >= params[dateIndex]);
        }
      }

      if (text.includes('date <=') && params) {
        const dateIndex = params.findIndex(p => p && p.match(/^\d{4}-\d{2}-\d{2}$/), params.findIndex(p => p && p.match(/^\d{4}-\d{2}-\d{2}$/)) + 1);
        if (dateIndex !== -1) {
          filteredTransactions = filteredTransactions.filter(t => t.date <= params[dateIndex]);
        }
      }

      return { rows: [{ count: filteredTransactions.length.toString() }], rowCount: 1 };
    }

    // Handle SUM query for summary
    if (text.includes('SUM(CASE WHEN type =') && text.includes('financial_transactions')) {
      let filteredTransactions = [...this.transactions];

      // Apply user filter
      if (params && params.length > 0) {
        filteredTransactions = filteredTransactions.filter(t => t.user_id === params[0]);
      }

      // Apply date filters
      if (params && params.length >= 3) {
        const startDate = params[1];
        const endDate = params[2];
        filteredTransactions = filteredTransactions.filter(t =>
          t.date >= startDate && t.date <= endDate && t.status === 'completed'
        );
      }

      const totalIncome = filteredTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      const totalExpenses = filteredTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      return {
        rows: [{
          total_income: totalIncome.toString(),
          total_expenses: totalExpenses.toString(),
          transaction_count: filteredTransactions.length.toString()
        }],
        rowCount: 1
      };
    }

    // Handle SELECT with complex WHERE clauses
    if (text.includes('SELECT') && text.includes('financial_transactions')) {
      let filteredTransactions = [...this.transactions];

      // Apply filters based on WHERE clauses
      if (text.includes('WHERE user_id =') && params) {
        filteredTransactions = filteredTransactions.filter(t => t.user_id === params[0]);
      }

      if (text.includes('AND id =') && params) {
        const idIndex = params.findIndex(p => p && p.startsWith('txn-'));
        if (idIndex !== -1) {
          filteredTransactions = filteredTransactions.filter(t => t.id === params[idIndex]);
        }
      }

      if (text.includes('type =') && params) {
        const typeIndex = params.findIndex(p => p === 'income' || p === 'expense');
        if (typeIndex !== -1) {
          filteredTransactions = filteredTransactions.filter(t => t.type === params[typeIndex]);
        }
      }

      if (text.includes('category =') && params) {
        const categoryIndex = params.findIndex(p => p && typeof p === 'string' && !p.match(/^\d{4}-\d{2}-\d{2}$/) && p !== 'income' && p !== 'expense');
        if (categoryIndex !== -1) {
          filteredTransactions = filteredTransactions.filter(t => t.category === params[categoryIndex]);
        }
      }

      if (text.includes('date >=') && params) {
        const dateIndex = params.findIndex(p => p && p.match(/^\d{4}-\d{2}-\d{2}$/));
        if (dateIndex !== -1) {
          filteredTransactions = filteredTransactions.filter(t => t.date >= params[dateIndex]);
        }
      }

      if (text.includes('date <=') && params) {
        const dateIndex = params.findIndex(p => p && p.match(/^\d{4}-\d{2}-\d{2}$/), params.findIndex(p => p && p.match(/^\d{4}-\d{2}-\d{2}$/)) + 1);
        if (dateIndex !== -1) {
          filteredTransactions = filteredTransactions.filter(t => t.date <= params[dateIndex]);
        }
      }

      // Apply sorting
      if (text.includes('ORDER BY date DESC')) {
        filteredTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }

      // Apply pagination
      if (text.includes('LIMIT') && params) {
        const limitIndex = text.split('$').length - 1;
        const limit = params[limitIndex - 1];
        const offsetIndex = limitIndex - 1;
        const offset = params[offsetIndex - 1] || 0;

        filteredTransactions = filteredTransactions.slice(offset, offset + limit);
      }

      return { rows: filteredTransactions.map(t => this.mapTransactionToRow(t)), rowCount: filteredTransactions.length };
    }

    return { rows: [], rowCount: 0 };
  }

  private handleCategoryQuery(text: string, params?: any[]): any {
    if (text.includes('SELECT') && text.includes('transaction_categories')) {
      let filteredCategories = [...this.categories];

      if (text.includes('WHERE name =') && text.includes('AND type =') && params) {
        filteredCategories = filteredCategories.filter(c => c.name === params[0] && c.type === params[1]);
      }

      return { rows: filteredCategories, rowCount: filteredCategories.length };
    }

    return { rows: [], rowCount: 0 };
  }

  private handleAnalyticsCacheQuery(text: string, params?: any[]): any {
    if (text.includes('INSERT INTO analytics_cache') && params) {
      const newCache = {
        id: `cache-${this.nextCacheId++}`,
        user_id: params[0],
        report_type: params[1],
        period_start: params[2],
        period_end: params[3],
        data: params[4],
        created_at: new Date().toISOString(),
        expires_at: params[5]
      };
      this.analyticsCache.push(newCache);
      return { rows: [newCache], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }

  private handleInformationSchemaQuery(text: string, params?: any[]): any {
    if (text.includes('WHERE table_name =') && text.includes('financial_transactions')) {
      return {
        rows: [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'gen_random_uuid()' },
          { column_name: 'user_id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
          { column_name: 'type', data_type: 'character varying', is_nullable: 'NO', column_default: null },
          { column_name: 'category', data_type: 'character varying', is_nullable: 'NO', column_default: null },
          { column_name: 'subcategory', data_type: 'character varying', is_nullable: 'YES', column_default: null },
          { column_name: 'amount', data_type: 'numeric', is_nullable: 'NO', column_default: null },
          { column_name: 'description', data_type: 'text', is_nullable: 'YES', column_default: null },
          { column_name: 'date', data_type: 'date', is_nullable: 'NO', column_default: null },
          { column_name: 'invoice', data_type: 'character varying', is_nullable: 'YES', column_default: null },
          { column_name: 'status', data_type: 'character varying', is_nullable: 'NO', column_default: "'completed'::character varying" },
          { column_name: 'metadata', data_type: 'jsonb', is_nullable: 'YES', column_default: "'{}'::jsonb" },
          { column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: 'NO', column_default: 'CURRENT_TIMESTAMP' },
          { column_name: 'updated_at', data_type: 'timestamp without time zone', is_nullable: 'NO', column_default: 'CURRENT_TIMESTAMP' }
        ]
      };
    }

    if (text.includes('WHERE table_name =') && text.includes('transaction_categories')) {
      return {
        rows: [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'gen_random_uuid()' },
          { column_name: 'name', data_type: 'character varying', is_nullable: 'NO', column_default: null },
          { column_name: 'type', data_type: 'character varying', is_nullable: 'NO', column_default: null },
          { column_name: 'icon', data_type: 'character varying', is_nullable: 'YES', column_default: null },
          { column_name: 'color', data_type: 'character varying', is_nullable: 'YES', column_default: null },
          { column_name: 'is_default', data_type: 'boolean', is_nullable: 'NO', column_default: 'false' },
          { column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: 'NO', column_default: 'CURRENT_TIMESTAMP' }
        ]
      };
    }

    if (text.includes('WHERE table_name =') && text.includes('analytics_cache')) {
      return {
        rows: [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'gen_random_uuid()' },
          { column_name: 'user_id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
          { column_name: 'report_type', data_type: 'character varying', is_nullable: 'NO', column_default: null },
          { column_name: 'period_start', data_type: 'date', is_nullable: 'NO', column_default: null },
          { column_name: 'period_end', data_type: 'date', is_nullable: 'NO', column_default: null },
          { column_name: 'data', data_type: 'jsonb', is_nullable: 'NO', column_default: null },
          { column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: 'NO', column_default: 'CURRENT_TIMESTAMP' },
          { column_name: 'expires_at', data_type: 'timestamp without time zone', is_nullable: 'YES', column_default: null }
        ]
      };
    }

    // Handle constraints query
    if (text.includes('table_constraints') && text.includes('financial_transactions')) {
      return {
        rows: [
          { constraint_name: 'financial_transactions_pkey', constraint_type: 'PRIMARY KEY', column_name: 'id', check_clause: null },
          { constraint_name: 'financial_transactions_user_id_fkey', constraint_type: 'FOREIGN KEY', column_name: 'user_id', check_clause: null },
          { constraint_name: 'financial_transactions_type_check', constraint_type: 'CHECK', column_name: 'type', check_clause: "CHECK ((type = ANY (ARRAY['income'::character varying, 'expense'::character varying])))" },
          { constraint_name: 'financial_transactions_amount_check', constraint_type: 'CHECK', column_name: 'amount', check_clause: '(amount > (0)::numeric)' }
        ]
      };
    }

    if (text.includes('table_constraints') && text.includes('transaction_categories')) {
      return {
        rows: [
          { constraint_name: 'transaction_categories_pkey', constraint_type: 'PRIMARY KEY', column_name: 'id', check_clause: null },
          { constraint_name: 'transaction_categories_name_type_key', constraint_type: 'UNIQUE', column_name: 'name', check_clause: null }
        ]
      };
    }

    if (text.includes('table_constraints') && text.includes('analytics_cache')) {
      return {
        rows: [
          { constraint_name: 'analytics_cache_pkey', constraint_type: 'PRIMARY KEY', column_name: 'id', check_clause: null },
          { constraint_name: 'analytics_cache_user_id_report_type_period_start_period_end_key', constraint_type: 'UNIQUE', column_name: 'user_id', check_clause: null }
        ]
      };
    }

    return { rows: [], rowCount: 0 };
  }

  private handleIndexesQuery(text: string, params?: any[]): any {
    if (text.includes('financial_transactions')) {
      return {
        rows: [
          { indexname: 'idx_transactions_user_date', indexdef: 'CREATE INDEX idx_transactions_user_date ON financial_transactions(user_id, date DESC)' },
          { indexname: 'idx_transactions_user_type', indexdef: 'CREATE INDEX idx_transactions_user_type ON financial_transactions(user_id, type)' },
          { indexname: 'idx_transactions_invoice', indexdef: 'CREATE INDEX idx_transactions_invoice ON financial_transactions(invoice)' }
        ]
      };
    }

    return { rows: [], rowCount: 0 };
  }

  private mapTransactionToRow(transaction: TransactionRow): any {
    return {
      id: transaction.id,
      user_id: transaction.user_id,
      type: transaction.type,
      category: transaction.category,
      subcategory: transaction.subcategory,
      amount: transaction.amount,
      description: transaction.description,
      date: transaction.date,
      invoice: transaction.invoice,
      status: transaction.status,
      metadata: transaction.metadata,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at
    };
  }

  private initializeDefaultCategories(): void {
    this.categories = [
      { id: 'cat-1', name: 'Salary', type: 'income', icon: 'briefcase', color: '#10B981', is_default: true, created_at: new Date().toISOString() },
      { id: 'cat-2', name: 'Food & Dining', type: 'expense', icon: 'utensils', color: '#EF4444', is_default: true, created_at: new Date().toISOString() },
      { id: 'cat-3', name: 'Transportation', type: 'expense', icon: 'car', color: '#F97316', is_default: true, created_at: new Date().toISOString() }
    ];
  }

  // Helper methods for testing
  addTransaction(transaction: Partial<TransactionRow>): void {
    const fullTransaction: TransactionRow = {
      id: `txn-${this.nextTransactionId++}`,
      user_id: transaction.user_id || 'user-1',
      type: transaction.type || TransactionType.EXPENSE,
      category: transaction.category || 'Test Category',
      subcategory: transaction.subcategory,
      amount: transaction.amount || '100.00',
      description: transaction.description,
      date: transaction.date || '2024-01-01',
      invoice: transaction.invoice,
      status: transaction.status || TransactionStatus.COMPLETED,
      metadata: transaction.metadata || {},
      created_at: transaction.created_at || new Date().toISOString(),
      updated_at: transaction.updated_at || new Date().toISOString()
    };
    this.transactions.push(fullTransaction);
  }

  getTransactions(): TransactionRow[] {
    return [...this.transactions];
  }

  clearTransactions(): void {
    this.transactions = [];
    this.nextTransactionId = 1;
  }

  clearAll(): void {
    this.clearTransactions();
    this.categories = [];
    this.analyticsCache = [];
    this.nextTransactionId = 1;
    this.nextCategoryId = 1;
    this.nextCacheId = 1;
    this.initializeDefaultCategories();
    super.clearUsers();
  }
}