import { TransactionService } from '../../../src/modules/financial/transaction.service';
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

describe('TransactionService', () => {
  let service: TransactionService;
  let repository: TransactionRepository;
  let mockDb: FinancialMockDatabase;
  const testUserId = 'user-123';

  beforeEach(() => {
    mockDb = new FinancialMockDatabase();
    repository = new TransactionRepository(mockDb);
    service = new TransactionService(repository);
  });

  describe('createTransaction', () => {
    it('should create a valid income transaction', async () => {
      const transactionData: CreateTransactionData = {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: '2024-01-01',
        description: 'Monthly salary'
      };

      const transaction = await service.createTransaction(testUserId, transactionData);

      expect(transaction).toBeDefined();
      expect(transaction.userId).toBe(testUserId);
      expect(transaction.type).toBe(TransactionType.INCOME);
      expect(transaction.category).toBe('Salary');
      expect(transaction.amount).toBe('5000.00');
      expect(transaction.status).toBe(TransactionStatus.COMPLETED);
    });

    it('should create a valid expense transaction', async () => {
      const transactionData: CreateTransactionData = {
        type: TransactionType.EXPENSE,
        category: 'Food & Dining',
        amount: 85.50,
        date: '2024-01-01'
      };

      const transaction = await service.createTransaction(testUserId, transactionData);

      expect(transaction.type).toBe(TransactionType.EXPENSE);
      expect(transaction.amount).toBe('85.50');
    });

    it('should reject negative amounts', async () => {
      const transactionData: CreateTransactionData = {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: -1000,
        date: '2024-01-01'
      };

      await expect(service.createTransaction(testUserId, transactionData))
        .rejects.toThrow('Amount must be positive');
    });

    it('should reject zero amounts', async () => {
      const transactionData: CreateTransactionData = {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 0,
        date: '2024-01-01'
      };

      await expect(service.createTransaction(testUserId, transactionData))
        .rejects.toThrow('Amount must be positive');
    });

    it('should reject future dates for expense transactions', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const transactionData: CreateTransactionData = {
        type: TransactionType.EXPENSE,
        category: 'Food & Dining',
        amount: 50,
        date: futureDate.toISOString().split('T')[0]!
      };

      await expect(service.createTransaction(testUserId, transactionData))
        .rejects.toThrow('Expense transactions cannot have future dates');
    });

    it('should allow future dates for income transactions', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const transactionData: CreateTransactionData = {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: futureDate.toISOString().split('T')[0]!
      };

      const transaction = await service.createTransaction(testUserId, transactionData);
      expect(transaction).toBeDefined();
    });

    it('should reject invalid date format', async () => {
      const transactionData: CreateTransactionData = {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: 'invalid-date'
      };

      await expect(service.createTransaction(testUserId, transactionData))
        .rejects.toThrow('Invalid date format');
    });

    it('should reject missing required fields', async () => {
      const incompleteData = {
        type: TransactionType.INCOME,
        // Missing category, amount, date
      } as CreateTransactionData;

      await expect(service.createTransaction(testUserId, incompleteData))
        .rejects.toThrow('Category is required');
    });

    it('should validate category length', async () => {
      const transactionData: CreateTransactionData = {
        type: TransactionType.INCOME,
        category: 'A'.repeat(101), // Too long
        amount: 5000,
        date: '2024-01-01'
      };

      await expect(service.createTransaction(testUserId, transactionData))
        .rejects.toThrow('Category must be less than 100 characters');
    });
  });

  describe('updateTransaction', () => {
    let existingTransaction: Transaction;

    beforeEach(async () => {
      existingTransaction = await service.createTransaction(testUserId, {
        type: TransactionType.EXPENSE,
        category: 'Food & Dining',
        amount: 100,
        date: '2024-01-01'
      });
    });

    it('should update transaction with valid data', async () => {
      const updateData = {
        category: 'Updated Category',
        amount: 150,
        description: 'Updated description'
      };

      const updated = await service.updateTransaction(
        existingTransaction.id,
        testUserId,
        updateData
      );

      expect(updated).toBeDefined();
      expect(updated?.category).toBe('Updated Category');
      expect(updated?.amount).toBe('150.00');
      expect(updated?.description).toBe('Updated description');
    });

    it('should reject negative amounts on update', async () => {
      const updateData = {
        amount: -50
      };

      await expect(service.updateTransaction(existingTransaction.id, testUserId, updateData))
        .rejects.toThrow('Amount must be positive');
    });

    it('should reject invalid date format on update', async () => {
      const updateData = {
        date: 'invalid-date'
      };

      await expect(service.updateTransaction(existingTransaction.id, testUserId, updateData))
        .rejects.toThrow('Invalid date format');
    });

    it('should return null when updating non-existent transaction', async () => {
      const result = await service.updateTransaction('non-existent-id', testUserId, {
        category: 'Updated'
      });

      expect(result).toBeNull();
    });
  });

  describe('getUserTransactions', () => {
    beforeEach(async () => {
      await service.createTransaction(testUserId, {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: '2024-01-01'
      });

      await service.createTransaction(testUserId, {
        type: TransactionType.EXPENSE,
        category: 'Food & Dining',
        amount: 100,
        date: '2024-01-02'
      });
    });

    it('should return user transactions with validation', async () => {
      const result = await service.getUserTransactions(testUserId);

      expect(result.transactions).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should validate filter parameters', async () => {
      const invalidFilters = {
        limit: -1 // Negative limit
      } as TransactionFilters;

      await expect(service.getUserTransactions(testUserId, invalidFilters))
        .rejects.toThrow('Limit must be positive');
    });

    it('should validate date range filters', async () => {
      const invalidFilters = {
        startDate: '2024-01-31',
        endDate: '2024-01-01' // End before start
      } as TransactionFilters;

      await expect(service.getUserTransactions(testUserId, invalidFilters))
        .rejects.toThrow('End date must be after start date');
    });
  });

  describe('getFinancialSummary', () => {
    beforeEach(async () => {
      await service.createTransaction(testUserId, {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: '2024-01-01'
      });

      await service.createTransaction(testUserId, {
        type: TransactionType.EXPENSE,
        category: 'Food & Dining',
        amount: 1000,
        date: '2024-01-15'
      });
    });

    it('should calculate financial summary', async () => {
      const summary = await service.getFinancialSummary(testUserId, {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });

      expect(summary.totalIncome).toBe('5000.00');
      expect(summary.totalExpenses).toBe('1000.00');
      expect(summary.netIncome).toBe('4000.00');
      expect(summary.transactionCount).toBe(2);
    });

    it('should validate date range', async () => {
      await expect(service.getFinancialSummary(testUserId, {
        startDate: '2024-01-31',
        endDate: '2024-01-01'
      })).rejects.toThrow('End date must be after start date');
    });

    it('should validate date format', async () => {
      await expect(service.getFinancialSummary(testUserId, {
        startDate: 'invalid-date',
        endDate: '2024-01-31'
      })).rejects.toThrow('Invalid date format');
    });
  });

  describe('deleteTransaction', () => {
    it('should delete transaction successfully', async () => {
      const transaction = await service.createTransaction(testUserId, {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: '2024-01-01'
      });

      const deleted = await service.deleteTransaction(transaction.id, testUserId);
      expect(deleted).toBe(true);
    });

    it('should return false for non-existent transaction', async () => {
      const deleted = await service.deleteTransaction('non-existent-id', testUserId);
      expect(deleted).toBe(false);
    });
  });

  describe('business logic validation', () => {
    it('should enforce business transaction limits', async () => {
      // Create many transactions to test limits
      const promises = [];
      for (let i = 0; i < 105; i++) {
        promises.push(service.createTransaction(testUserId, {
          type: TransactionType.EXPENSE,
          category: 'Test',
          amount: 1,
          date: '2024-01-01'
        }));
      }

      // Should allow up to 100 transactions
      const results = await Promise.allSettled(promises);
      const failures = results.filter(r => r.status === 'rejected');
      expect(failures.length).toBeGreaterThan(0);
    });

    it('should enforce daily amount limits for expenses', async () => {
      const largeAmount = 1000000; // Very large amount

      await expect(service.createTransaction(testUserId, {
        type: TransactionType.EXPENSE,
        category: 'Luxury',
        amount: largeAmount,
        date: '2024-01-01'
      })).rejects.toThrow('Expense amount exceeds daily limit');
    });
  });
});