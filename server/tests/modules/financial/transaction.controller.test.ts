import { TransactionController } from '../../../src/modules/financial/transaction.controller';
import { TransactionService } from '../../../src/modules/financial/transaction.service';
import { TransactionRepository } from '../../../src/modules/financial/transaction.repository';
import { FinancialMockDatabase } from '../../mocks/financial.database.mock';
import { FastifyRequest, FastifyReply } from 'fastify';
import {
  TransactionType,
  CreateTransactionData,
  Transaction,
  TransactionFilters
} from '../../../src/modules/financial/transaction.types';

describe('TransactionController', () => {
  let controller: TransactionController;
  let service: TransactionService;
  let repository: TransactionRepository;
  let mockDb: FinancialMockDatabase;
  const testUserId = 'user-123';

  beforeEach(() => {
    mockDb = new FinancialMockDatabase();
    repository = new TransactionRepository(mockDb);
    service = new TransactionService(repository);
    controller = new TransactionController(service);
  });

  describe('createTransaction', () => {
    it('should create a transaction successfully', async () => {
      const requestBody: CreateTransactionData = {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: '2024-01-01',
        description: 'Monthly salary'
      };

      const mockRequest = {
        user: { id: testUserId },
        body: requestBody
      } as any;

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;

      await controller.createTransaction(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            type: TransactionType.INCOME,
            category: 'Salary',
            amount: '5000.00',
            userId: testUserId
          })
        })
      );
    });

    it('should handle validation errors', async () => {
      const invalidBody = {
        type: TransactionType.INCOME,
        category: '',
        amount: -100,
        date: 'invalid-date'
      };

      const mockRequest = {
        user: { id: testUserId },
        body: invalidBody
      } as any;

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;

      await controller.createTransaction(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String)
        })
      );
    });

    it('should require authentication', async () => {
      const mockRequest = {
        user: null,
        body: {}
      } as any;

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;

      await controller.createTransaction(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Authentication required'
        })
      );
    });
  });

  describe('getTransactions', () => {
    beforeEach(async () => {
      // Create some test transactions
      await service.createTransaction(testUserId, {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: '2024-01-01'
      });

      await service.createTransaction(testUserId, {
        type: TransactionType.EXPENSE,
        category: 'Food',
        amount: 100,
        date: '2024-01-02'
      });
    });

    it('should return user transactions', async () => {
      const mockRequest = {
        user: { id: testUserId },
        query: {}
      } as any;

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;

      await controller.getTransactions(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            transactions: expect.any(Array),
            totalCount: expect.any(Number),
            hasMore: expect.any(Boolean)
          })
        })
      );
    });

    it('should handle query parameters', async () => {
      const mockRequest = {
        user: { id: testUserId },
        query: {
          type: TransactionType.EXPENSE,
          limit: 10,
          offset: 0
        }
      } as any;

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;

      await controller.getTransactions(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalled();
    });

    it('should handle invalid query parameters', async () => {
      const mockRequest = {
        user: { id: testUserId },
        query: {
          limit: -1 // Invalid
        }
      } as any;

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;

      await controller.getTransactions(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String)
        })
      );
    });
  });

  describe('getTransactionById', () => {
    it('should return transaction by id', async () => {
      const transaction = await service.createTransaction(testUserId, {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: '2024-01-01'
      });

      const mockRequest = {
        user: { id: testUserId },
        params: { id: transaction.id }
      } as any;

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;

      await controller.getTransactionById(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: transaction.id,
            category: 'Salary'
          })
        })
      );
    });

    it('should return 404 for non-existent transaction', async () => {
      const mockRequest = {
        user: { id: testUserId },
        params: { id: 'non-existent-id' }
      } as any;

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;

      await controller.getTransactionById(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Transaction not found'
        })
      );
    });

    it('should return 404 for transaction belonging to different user', async () => {
      const otherUserId = 'user-456';
      const transaction = await service.createTransaction(otherUserId, {
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: 5000,
        date: '2024-01-01'
      });

      const mockRequest = {
        user: { id: testUserId },
        params: { id: transaction.id }
      } as any;

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;

      await controller.getTransactionById(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateTransaction', () => {
    it('should update transaction successfully', async () => {
      const transaction = await service.createTransaction(testUserId, {
        type: TransactionType.EXPENSE,
        category: 'Food',
        amount: 100,
        date: '2024-01-01'
      });

      const mockRequest = {
        user: { id: testUserId },
        params: { id: transaction.id },
        body: {
          category: 'Updated Food',
          amount: 150,
          description: 'Updated description'
        }
      } as any;

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;

      await controller.updateTransaction(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: transaction.id,
            category: 'Updated Food'
          })
        })
      );
    });

    it('should return 404 when updating non-existent transaction', async () => {
      const mockRequest = {
        user: { id: testUserId },
        params: { id: 'non-existent-id' },
        body: { category: 'Updated' }
      } as any;

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;

      await controller.updateTransaction(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });

    it('should handle validation errors', async () => {
      const transaction = await service.createTransaction(testUserId, {
        type: TransactionType.EXPENSE,
        category: 'Food',
        amount: 100,
        date: '2024-01-01'
      });

      const mockRequest = {
        user: { id: testUserId },
        params: { id: transaction.id },
        body: {
          amount: -50 // Invalid
        }
      } as any;

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;

      await controller.updateTransaction(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String)
        })
      );
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

      const mockRequest = {
        user: { id: testUserId },
        params: { id: transaction.id }
      } as any;

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;

      await controller.deleteTransaction(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Transaction deleted successfully'
        })
      );
    });

    it('should return 404 when deleting non-existent transaction', async () => {
      const mockRequest = {
        user: { id: testUserId },
        params: { id: 'non-existent-id' }
      } as any;

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;

      await controller.deleteTransaction(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
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
        category: 'Food',
        amount: 1000,
        date: '2024-01-15'
      });
    });

    it('should return financial summary', async () => {
      const mockRequest = {
        user: { id: testUserId },
        query: {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        }
      } as any;

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;

      await controller.getFinancialSummary(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalIncome: expect.any(String),
            totalExpenses: expect.any(String),
            netIncome: expect.any(String),
            transactionCount: expect.any(Number)
          })
        })
      );
    });

    it('should handle missing date parameters', async () => {
      const mockRequest = {
        user: { id: testUserId },
        query: {}
      } as any;

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;

      await controller.getFinancialSummary(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('required')
        })
      );
    });

    it('should handle invalid date parameters', async () => {
      const mockRequest = {
        user: { id: testUserId },
        query: {
          startDate: 'invalid-date',
          endDate: '2024-01-31'
        }
      } as any;

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;

      await controller.getFinancialSummary(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String)
        })
      );
    });
  });
});