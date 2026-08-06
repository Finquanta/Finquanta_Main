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
        // business_id leads the INSERT now; user_id only records who entered it.
        // Every other column shifted one place right when scoping was added.
        business_id: params[0],
        user_id: params[1],
        type: params[2] as TransactionType,
        category: params[3],
        subcategory: params[4],
        amount: params[5],
        description: params[6],
        date: params[7],
        invoice: params[8],
        status: params[9] as TransactionStatus,
        metadata: params[10] || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.transactions.push(newTransaction);
      return { rows: [this.mapTransactionToRow(newTransaction)], rowCount: 1 };
    }

    // Handle UPDATE
    if (text.includes('UPDATE financial_transactions') && params) {
      const idIndex = text.split('$').length - 2;
      const businessIdIndex = text.split('$').length - 1;
      const id = params[idIndex - 1];
      const businessId = params[businessIdIndex - 1];

      const transactionIndex = this.transactions.findIndex(
        t => t.id === id && t.business_id === businessId
      );

      if (transactionIndex === -1) {
        return { rows: [], rowCount: 0 };
      }

      const transaction = this.transactions[transactionIndex]!;

      // Parse UPDATE SET clauses by reading each column's placeholder number
      // out of the SQL. The previous version hardcoded positions (type at $1,
      // category at $1 or $2) and scanned for amount, so it only ever handled
      // three columns and mis-assigned them whenever the caller updated a
      // different combination — updating category alongside amount wrote the
      // amount into the category.
      const setValue = (column: string): any => {
        const m = text.match(new RegExp('\\b' + column + ' = \\$(\\d+)'));
        return m ? params[Number(m[1]) - 1] : undefined;
      };

      for (const column of [
        'type', 'category', 'subcategory', 'amount',
        'description', 'date', 'invoice', 'status', 'metadata',
      ]) {
        const value = setValue(column);
        if (value !== undefined) {
          (transaction as any)[column] = value;
        }
      }

      transaction.updated_at = new Date().toISOString();

      return { rows: [this.mapTransactionToRow(transaction)], rowCount: 1 };
    }

    // Handle DELETE
    if (text.includes('DELETE FROM financial_transactions') && params) {
      const [id, businessId] = params;
      const initialLength = this.transactions.length;
      this.transactions = this.transactions.filter(
        t => !(t.id === id && t.business_id === businessId)
      );
      return { rows: [], rowCount: initialLength - this.transactions.length };
    }

    // Handle COUNT query.
    //
    // Must exclude the summary query, which selects COUNT(*) *and* SUM(...) in
    // one statement. Matching on COUNT alone made this branch swallow it and
    // return { count } with no total_income, so calculateSummary parsed
    // undefined and every total came back NaN.
    if (text.includes('COUNT(*)') && text.includes('financial_transactions') && !text.includes('SUM(')) {
      let filteredTransactions = [...this.transactions];

      // Apply tenant filter (business_id = $1)
      if (params && params.length > 0) {
        filteredTransactions = filteredTransactions.filter(t => t.business_id === params[0]);
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

      // Apply tenant filter (business_id = $1)
      if (params && params.length > 0) {
        filteredTransactions = filteredTransactions.filter(t => t.business_id === params[0]);
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

      // Two shapes reach here, and they order their parameters differently:
      //   findById            -> WHERE id = $1 AND business_id = $2
      //   getUserTransactions -> WHERE business_id = $1 [AND ...]
      //
      // This used to test for `WHERE user_id =`, which no query has said since
      // transactions became business-scoped. The condition silently never
      // matched, so NO tenant filter was applied and findById happily returned
      // another business's row — the mock was asserting the opposite of the
      // isolation the real query enforces.
      if (text.includes('WHERE id = $1 AND business_id = $2') && params) {
        const [id, businessId] = params;
        filteredTransactions = filteredTransactions.filter(
          t => t.id === id && t.business_id === businessId
        );
      } else if (text.includes('business_id = $1') && params) {
        filteredTransactions = filteredTransactions.filter(t => t.business_id === params[0]);
      }

      // Read the placeholder number straight out of the SQL rather than guessing
      // which parameter belongs to which clause.
      //
      // The old heuristics searched the whole params array by shape — "a string
      // that isn't a date and isn't income/expense" for category, for instance.
      // That matched params[0], which is now the business id, so filtering by
      // category compared every row against 'business-123' and returned nothing.
      // The query already states the mapping; use it.
      const paramFor = (clause: string): any => {
        const m = text.match(new RegExp(clause.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\$(\\d+)'));
        return m ? params![Number(m[1]) - 1] : undefined;
      };

      const typeParam = paramFor('type =');
      if (typeParam !== undefined) {
        filteredTransactions = filteredTransactions.filter(t => t.type === typeParam);
      }

      const categoryParam = paramFor('category =');
      if (categoryParam !== undefined) {
        filteredTransactions = filteredTransactions.filter(t => t.category === categoryParam);
      }

      const fromParam = paramFor('date >=');
      if (fromParam !== undefined) {
        filteredTransactions = filteredTransactions.filter(t => t.date >= fromParam);
      }

      const toParam = paramFor('date <=');
      if (toParam !== undefined) {
        filteredTransactions = filteredTransactions.filter(t => t.date <= toParam);
      }

      // Apply sorting
      if (text.includes('ORDER BY date DESC')) {
        filteredTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }

      // Apply pagination
      if (text.includes('LIMIT') && params) {
        // The query ends `LIMIT $n OFFSET $n+1` and pushes them in that order,
        // so limit is second-to-last and offset is last. Deriving the index by
        // counting '$' had these the wrong way round: with three placeholders it
        // read limit=offset(0) and offset=limit(50), producing slice(50, 50) and
        // an empty result for every unpaginated list query.
        const limit = Number(params[params.length - 2]) || 0;
        const offset = Number(params[params.length - 1]) || 0;

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
      business_id: transaction.business_id,
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