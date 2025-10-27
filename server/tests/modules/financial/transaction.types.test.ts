import {
  TransactionType,
  TransactionStatus,
  CreateTransactionData,
  Transaction,
  TransactionFilters,
  FinancialSummary
} from '../../../src/modules/financial/transaction.types';

describe('Transaction Types', () => {
  describe('TransactionType', () => {
    it('should have correct values', () => {
      expect(TransactionType.INCOME).toBe('income');
      expect(TransactionType.EXPENSE).toBe('expense');
    });
  });

  describe('TransactionStatus', () => {
    it('should have correct values', () => {
      expect(TransactionStatus.PENDING).toBe('pending');
      expect(TransactionStatus.COMPLETED).toBe('completed');
      expect(TransactionStatus.FAILED).toBe('failed');
    });
  });

  describe('CreateTransactionData', () => {
    it('should validate required fields', () => {
      const validData: CreateTransactionData = {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: '2024-01-01'
      };

      expect(validData.type).toBeDefined();
      expect(validData.category).toBeDefined();
      expect(validData.amount).toBeDefined();
      expect(validData.date).toBeDefined();
    });

    it('should allow optional fields', () => {
      const dataWithOptions: CreateTransactionData = {
        type: TransactionType.EXPENSE,
        category: 'Food',
        subcategory: 'Restaurants',
        amount: 50,
        description: 'Dinner with friends',
        date: '2024-01-01',
        invoice: 'INV-001',
        metadata: { tags: ['business'] }
      };

      expect(dataWithOptions.subcategory).toBe('Restaurants');
      expect(dataWithOptions.description).toBe('Dinner with friends');
      expect(dataWithOptions.invoice).toBe('INV-001');
      expect(dataWithOptions.metadata).toEqual({ tags: ['business'] });
    });
  });

  describe('Transaction', () => {
    it('should include all fields', () => {
      const transaction: Transaction = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'user123',
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: '5000.00',
        date: '2024-01-01',
        status: TransactionStatus.COMPLETED,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      expect(transaction.id).toBeDefined();
      expect(transaction.userId).toBeDefined();
      expect(transaction.type).toBe(TransactionType.INCOME);
      expect(transaction.amount).toBe('5000.00'); // Decimal as string
      expect(transaction.status).toBe(TransactionStatus.COMPLETED);
    });
  });

  describe('TransactionFilters', () => {
    it('should accept various filter options', () => {
      const filters: TransactionFilters = {
        type: TransactionType.EXPENSE,
        category: 'Food',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        limit: 50,
        offset: 0
      };

      expect(filters.type).toBe(TransactionType.EXPENSE);
      expect(filters.category).toBe('Food');
      expect(filters.startDate).toBe('2024-01-01');
      expect(filters.endDate).toBe('2024-01-31');
      expect(filters.limit).toBe(50);
      expect(filters.offset).toBe(0);
    });

    it('should allow empty filters', () => {
      const emptyFilters: TransactionFilters = {};

      expect(Object.keys(emptyFilters)).toHaveLength(0);
    });
  });

  describe('FinancialSummary', () => {
    it('should contain summary data', () => {
      const summary: FinancialSummary = {
        totalIncome: '6000.00',
        totalExpenses: '2500.00',
        netIncome: '3500.00',
        transactionCount: 25,
        periodStart: '2024-01-01',
        periodEnd: '2024-01-31'
      };

      expect(summary.totalIncome).toBe('6000.00');
      expect(summary.totalExpenses).toBe('2500.00');
      expect(summary.netIncome).toBe('3500.00');
      expect(summary.transactionCount).toBe(25);
      expect(summary.periodStart).toBe('2024-01-01');
      expect(summary.periodEnd).toBe('2024-01-31');
    });
  });
});