import { TransactionRepository } from '../../../src/modules/financial/transaction.repository';
import { FinancialMockDatabase } from '../../mocks/financial.database.mock';
import {
  TransactionType,
  TransactionStatus,
  CreateTransactionData,
  Transaction,
  TransactionFilters,
  FinancialSummary
} from '../../../src/modules/financial/transaction.types';

describe('TransactionRepository', () => {
  let repository: TransactionRepository;
  let mockDb: FinancialMockDatabase;
  const testUserId = 'user-123';
  // Transactions are scoped to a business, not a user: `create` takes the
  // business first, and every lookup is filtered by it.
  const testBusinessId = 'business-123';
  const otherBusinessId = 'business-456';

  beforeEach(() => {
    mockDb = new FinancialMockDatabase();
    repository = new TransactionRepository(mockDb);
  });

  describe('create', () => {
    it('should create a new transaction', async () => {
      const transactionData: CreateTransactionData = {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: '2024-01-01',
        description: 'Monthly salary'
      };

      const transaction = await repository.create(testBusinessId, testUserId, transactionData);

      expect(transaction).toBeDefined();
      expect(transaction.userId).toBe(testUserId);
      expect(transaction.type).toBe(TransactionType.INCOME);
      expect(transaction.category).toBe('Salary');
      expect(transaction.amount).toBe('5000.00');
      expect(transaction.date).toBe('2024-01-01');
      expect(transaction.description).toBe('Monthly salary');
      expect(transaction.status).toBe(TransactionStatus.COMPLETED);
      expect(transaction.id).toBeDefined();
      expect(transaction.createdAt).toBeDefined();
      expect(transaction.updatedAt).toBeDefined();
    });

    it('should create expense transaction', async () => {
      const transactionData: CreateTransactionData = {
        type: TransactionType.EXPENSE,
        category: 'Food & Dining',
        subcategory: 'Restaurants',
        amount: 85.50,
        date: '2024-01-02',
        description: 'Dinner at restaurant',
        invoice: 'INV-001'
      };

      const transaction = await repository.create(testBusinessId, testUserId, transactionData);

      expect(transaction.type).toBe(TransactionType.EXPENSE);
      expect(transaction.category).toBe('Food & Dining');
      expect(transaction.subcategory).toBe('Restaurants');
      expect(transaction.amount).toBe('85.50');
      expect(transaction.invoice).toBe('INV-001');
    });
  });

  describe('findById', () => {
    it('should find transaction by id', async () => {
      const transactionData: CreateTransactionData = {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: '2024-01-01'
      };

      const created = await repository.create(testBusinessId, testUserId, transactionData);
      const found = await repository.findById(created.id, testBusinessId);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.userId).toBe(testUserId);
      expect(found?.category).toBe('Salary');
    });

    it('should return null for non-existent transaction', async () => {
      const found = await repository.findById('non-existent-id', testBusinessId);
      expect(found).toBeNull();
    });

    it('should return null for transaction belonging to different user', async () => {
      const otherUserId = 'user-456';
      const transactionData: CreateTransactionData = {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: '2024-01-01'
      };

      const created = await repository.create(otherBusinessId, otherUserId, transactionData);
      const found = await repository.findById(created.id, testBusinessId);

      expect(found).toBeNull();
    });
  });

  describe('getUserTransactions', () => {
    beforeEach(async () => {
      // Create test transactions
      await repository.create(testBusinessId, testUserId, {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: '2024-01-01'
      });

      await repository.create(testBusinessId, testUserId, {
        type: TransactionType.EXPENSE,
        category: 'Food & Dining',
        amount: 100,
        date: '2024-01-02'
      });

      await repository.create(testBusinessId, testUserId, {
        type: TransactionType.EXPENSE,
        category: 'Transportation',
        amount: 50,
        date: '2024-01-03'
      });
    });

    it('should return all user transactions', async () => {
      const result = await repository.getUserTransactions(testBusinessId);

      expect(result.transactions).toHaveLength(3);
      expect(result.totalCount).toBe(3);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by transaction type', async () => {
      const filters: TransactionFilters = {
        type: TransactionType.EXPENSE
      };

      const result = await repository.getUserTransactions(testBusinessId, filters);

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions.every((t: Transaction) => t.type === TransactionType.EXPENSE)).toBe(true);
    });

    it('should filter by category', async () => {
      const filters: TransactionFilters = {
        category: 'Food & Dining'
      };

      const result = await repository.getUserTransactions(testBusinessId, filters);

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]?.category).toBe('Food & Dining');
    });

    it('should limit results', async () => {
      const filters: TransactionFilters = {
        limit: 2
      };

      const result = await repository.getUserTransactions(testBusinessId, filters);

      expect(result.transactions).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    it('should paginate with offset', async () => {
      const filters: TransactionFilters = {
        limit: 2,
        offset: 1
      };

      const result = await repository.getUserTransactions(testBusinessId, filters);

      // Three rows exist; skipping one and taking up to two returns the last
      // two, which is what LIMIT 2 OFFSET 1 does. The previous expectation of
      // one row never ran, so it was never caught.
      expect(result.transactions).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it('should sort by date descending by default', async () => {
      const result = await repository.getUserTransactions(testBusinessId);

      const dates = result.transactions.map((t: Transaction) => new Date(t.date).getTime());
      expect(dates[0]!).toBeGreaterThan(dates[1]!);
      expect(dates[1]!).toBeGreaterThan(dates[2]!);
    });
  });

  describe('update', () => {
    it('should update transaction', async () => {
      const transactionData: CreateTransactionData = {
        type: TransactionType.EXPENSE,
        category: 'Food & Dining',
        amount: 100,
        date: '2024-01-01'
      };

      const created = await repository.create(testBusinessId, testUserId, transactionData);

      // `updatedAt` is stamped from the clock, and create-then-update inside the
      // same millisecond produces the same timestamp — which made the last
      // assertion in this test fail roughly one run in three. A real edit is
      // never this fast; the wait removes the race without weakening what is
      // being checked. It matters now that CI runs these on every push: a suite
      // that is red at random is a suite people learn to ignore.
      await new Promise((resolve) => setTimeout(resolve, 5));

      const updateData = {
        category: 'Updated Category',
        amount: 150,
        description: 'Updated description'
      };

      const updated = await repository.update(created.id, testBusinessId, updateData);

      expect(updated).toBeDefined();
      expect(updated?.id).toBe(created.id);
      expect(updated?.category).toBe('Updated Category');
      expect(updated?.amount).toBe('150.00');
      expect(updated?.description).toBe('Updated description');
      expect(updated?.updatedAt).not.toBe(created.updatedAt);
    });

    it('should return null when updating non-existent transaction', async () => {
      const result = await repository.update('non-existent-id', testBusinessId, {
        category: 'Updated'
      });

      expect(result).toBeNull();
    });

    it('should return null when updating transaction belonging to different user', async () => {
      const otherUserId = 'user-456';
      const transactionData: CreateTransactionData = {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: '2024-01-01'
      };

      const created = await repository.create(otherBusinessId, otherUserId, transactionData);
      const result = await repository.update(created.id, testBusinessId, {
        category: 'Updated'
      });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete transaction', async () => {
      const transactionData: CreateTransactionData = {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: '2024-01-01'
      };

      const created = await repository.create(testBusinessId, testUserId, transactionData);
      const deleted = await repository.delete(created.id, testBusinessId);

      expect(deleted).toBe(true);

      const found = await repository.findById(created.id, testBusinessId);
      expect(found).toBeNull();
    });

    it('should return false when deleting non-existent transaction', async () => {
      const deleted = await repository.delete('non-existent-id', testBusinessId);
      expect(deleted).toBe(false);
    });

    it('should return false when deleting transaction belonging to different user', async () => {
      const otherUserId = 'user-456';
      const transactionData: CreateTransactionData = {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: '2024-01-01'
      };

      const created = await repository.create(otherBusinessId, otherUserId, transactionData);
      const deleted = await repository.delete(created.id, testBusinessId);

      expect(deleted).toBe(false);
    });
  });

  describe('calculateSummary', () => {
    beforeEach(async () => {
      // Create test transactions
      await repository.create(testBusinessId, testUserId, {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: '2024-01-01'
      });

      await repository.create(testBusinessId, testUserId, {
        type: TransactionType.INCOME,
        category: 'Freelance',
        amount: 1500,
        date: '2024-01-05'
      });

      await repository.create(testBusinessId, testUserId, {
        type: TransactionType.EXPENSE,
        category: 'Food & Dining',
        amount: 300,
        date: '2024-01-10'
      });

      await repository.create(testBusinessId, testUserId, {
        type: TransactionType.EXPENSE,
        category: 'Transportation',
        amount: 150,
        date: '2024-01-15'
      });
    });

    it('should calculate financial summary', async () => {
      const summary = await repository.calculateSummary(testBusinessId, {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });

      expect(summary.totalIncome).toBe('6500.00');
      expect(summary.totalExpenses).toBe('450.00');
      expect(summary.netIncome).toBe('6050.00');
      expect(summary.transactionCount).toBe(4);
      expect(summary.periodStart).toBe('2024-01-01');
      expect(summary.periodEnd).toBe('2024-01-31');
    });

    it('should calculate summary for date range', async () => {
      const summary = await repository.calculateSummary(testBusinessId, {
        startDate: '2024-01-01',
        endDate: '2024-01-05'
      });

      expect(summary.totalIncome).toBe('6500.00');
      expect(summary.totalExpenses).toBe('0.00');
      expect(summary.netIncome).toBe('6500.00');
      expect(summary.transactionCount).toBe(2);
    });
  });
});