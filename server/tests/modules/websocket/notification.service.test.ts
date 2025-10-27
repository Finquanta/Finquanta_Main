import { WebSocketNotificationService } from '../../../src/modules/websocket/notification.service';
import { WebSocketManager } from '../../../src/modules/websocket/websocket.manager';
import { Transaction, TransactionType, TransactionStatus } from '../../../src/modules/financial/transaction.types';

describe('WebSocket Notification Service', () => {
  let notificationService: WebSocketNotificationService;
  let wsManager: WebSocketManager;
  let mockSendToUser: jest.Mock;

  beforeEach(() => {
    // Create a mock WebSocketManager
    wsManager = {
      sendToUser: jest.fn(),
      broadcast: jest.fn(),
      getUserCount: jest.fn().mockReturnValue(5),
      getConnectionCount: jest.fn().mockReturnValue(8)
    } as any;

    notificationService = new WebSocketNotificationService(wsManager);
    mockSendToUser = wsManager.sendToUser as jest.Mock;
  });

  describe('Transaction Notifications', () => {
    it('should send transaction created notification', () => {
      const userId = 'user-123';
      const transaction: Transaction = {
        id: 'tx-123',
        userId,
        type: TransactionType.EXPENSE,
        category: 'Food',
        amount: '50.00',
        date: '2024-01-15',
        description: 'Lunch',
        status: TransactionStatus.COMPLETED,
        createdAt: '2024-01-15T12:00:00Z',
        updatedAt: '2024-01-15T12:00:00Z'
      };

      notificationService.notifyTransactionCreated(userId, transaction);

      expect(mockSendToUser).toHaveBeenCalledWith(userId, {
        type: 'transaction_created',
        data: {
          transaction,
          userId,
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      });
    });

    it('should send transaction updated notification', () => {
      const userId = 'user-456';
      const transaction: Transaction = {
        id: 'tx-456',
        userId,
        type: TransactionType.INCOME,
        category: 'Salary',
        amount: '3000.00',
        date: '2024-01-15',
        description: 'Monthly salary',
        status: TransactionStatus.COMPLETED,
        createdAt: '2024-01-15T09:00:00Z',
        updatedAt: '2024-01-15T09:00:00Z'
      };

      notificationService.notifyTransactionUpdated(userId, transaction);

      expect(mockSendToUser).toHaveBeenCalledWith(userId, {
        type: 'transaction_updated',
        data: {
          transaction,
          userId,
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      });
    });

    it('should send transaction deleted notification', () => {
      const userId = 'user-789';
      const transaction: Transaction = {
        id: 'tx-789',
        userId,
        type: TransactionType.EXPENSE,
        category: 'Transport',
        amount: '25.00',
        date: '2024-01-15',
        description: 'Gas',
        status: TransactionStatus.COMPLETED,
        createdAt: '2024-01-15T08:00:00Z',
        updatedAt: '2024-01-15T08:00:00Z'
      };

      notificationService.notifyTransactionDeleted(userId, transaction);

      expect(mockSendToUser).toHaveBeenCalledWith(userId, {
        type: 'transaction_deleted',
        data: {
          transaction,
          userId,
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      });
    });

    it('should send notifications to multiple users', () => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      const notification = {
        type: 'transaction_created' as const,
        data: {
          transaction: {
            id: 'tx-multi',
            userId: 'user-1',
            type: TransactionType.EXPENSE,
            category: 'Shared',
            amount: '100.00',
            date: '2024-01-15',
            description: 'Shared expense',
            status: TransactionStatus.COMPLETED,
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T10:00:00Z'
          },
          userId: 'user-1',
          timestamp: new Date().toISOString()
        }
      };

      notificationService.notifyMultipleUsers(userIds, notification);

      expect(mockSendToUser).toHaveBeenCalledTimes(3);
      expect(mockSendToUser).toHaveBeenCalledWith('user-1', expect.any(Object));
      expect(mockSendToUser).toHaveBeenCalledWith('user-2', expect.any(Object));
      expect(mockSendToUser).toHaveBeenCalledWith('user-3', expect.any(Object));
    });
  });

  describe('Balance Notifications', () => {
    it('should send balance update notification', () => {
      const userId = 'user-balance';
      const summary = {
        totalIncome: 5000.00,
        totalExpenses: 3200.00,
        netBalance: 1800.00,
        period: '2024-01'
      };

      notificationService.notifyBalanceUpdate(userId, summary);

      expect(mockSendToUser).toHaveBeenCalledWith(userId, {
        type: 'balance_update',
        data: {
          userId,
          summary,
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('Financial Insights Notifications', () => {
    it('should send financial insights notification', () => {
      const userId = 'user-insights';
      const insights = {
        topCategories: [
          { category: 'Food', amount: 500.00, percentage: 25.0 },
          { category: 'Transport', amount: 300.00, percentage: 15.0 }
        ],
        dailyAverage: 150.00,
        monthlyTrend: [
          { date: '2024-01-01', amount: 200.00 },
          { date: '2024-01-02', amount: 180.00 }
        ]
      };

      notificationService.notifyFinancialInsights(userId, insights);

      expect(mockSendToUser).toHaveBeenCalledWith(userId, {
        type: 'financial_insights',
        data: {
          userId,
          insights,
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('System Notifications', () => {
    it('should broadcast system message', () => {
      const message = 'System maintenance scheduled for tonight';

      notificationService.broadcastSystemMessage(message, 'info');

      expect(wsManager.broadcast).toHaveBeenCalledWith({
        type: 'system_message',
        data: {
          message,
          type: 'info',
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      });
    });

    it('should broadcast warning system message', () => {
      const message = 'Unusual activity detected';

      notificationService.broadcastSystemMessage(message, 'warning');

      expect(wsManager.broadcast).toHaveBeenCalledWith({
        type: 'system_message',
        data: {
          message,
          type: 'warning',
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      });
    });

    it('should broadcast error system message', () => {
      const message = 'Service temporarily unavailable';

      notificationService.broadcastSystemMessage(message, 'error');

      expect(wsManager.broadcast).toHaveBeenCalledWith({
        type: 'system_message',
        data: {
          message,
          type: 'error',
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('Limit Notifications', () => {
    it('should send daily spending limit notification', () => {
      const userId = 'user-limit';
      const limit = {
        type: 'daily_spending' as const,
        currentAmount: 8500.00,
        limitAmount: 10000.00
      };

      notificationService.notifyLimitReached(userId, limit);

      expect(mockSendToUser).toHaveBeenCalledWith(userId, {
        type: 'limit_reached',
        data: {
          userId,
          limit,
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      });
    });

    it('should send category limit notification', () => {
      const userId = 'user-category-limit';
      const limit = {
        type: 'category_limit' as const,
        currentAmount: 950.00,
        limitAmount: 1000.00,
        category: 'Entertainment'
      };

      notificationService.notifyLimitReached(userId, limit);

      expect(mockSendToUser).toHaveBeenCalledWith(userId, {
        type: 'limit_reached',
        data: {
          userId,
          limit,
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('Notification Statistics', () => {
    it('should return notification statistics', () => {
      const stats = notificationService.getNotificationStats();

      expect(stats).toEqual({
        connectedUsers: 5,
        totalConnections: 8
      });

      expect(wsManager.getUserCount).toHaveBeenCalled();
      expect(wsManager.getConnectionCount).toHaveBeenCalled();
    });
  });
});