import { WebSocketManager } from './websocket.manager';
import { Transaction } from '../financial/transaction.types';

export interface TransactionNotification {
  type: 'transaction_created' | 'transaction_updated' | 'transaction_deleted';
  data: {
    transaction: Transaction;
    userId: string;
    timestamp: string;
  };
}

export interface NotificationService {
  notifyTransactionCreated(userId: string, transaction: Transaction): void;
  notifyTransactionUpdated(userId: string, transaction: Transaction): void;
  notifyTransactionDeleted(userId: string, transaction: Transaction): void;
  notifyMultipleUsers(userIds: string[], notification: TransactionNotification): void;
}

export class WebSocketNotificationService implements NotificationService {
  constructor(private wsManager: WebSocketManager) {}

  /**
   * Notify a user about a new transaction creation
   */
  notifyTransactionCreated(userId: string, transaction: Transaction): void {
    const notification: TransactionNotification = {
      type: 'transaction_created',
      data: {
        transaction,
        userId,
        timestamp: new Date().toISOString()
      }
    };

    this.sendNotificationToUser(userId, notification);
  }

  /**
   * Notify a user about a transaction update
   */
  notifyTransactionUpdated(userId: string, transaction: Transaction): void {
    const notification: TransactionNotification = {
      type: 'transaction_updated',
      data: {
        transaction,
        userId,
        timestamp: new Date().toISOString()
      }
    };

    this.sendNotificationToUser(userId, notification);
  }

  /**
   * Notify a user about a transaction deletion
   */
  notifyTransactionDeleted(userId: string, transaction: Transaction): void {
    const notification: TransactionNotification = {
      type: 'transaction_deleted',
      data: {
        transaction,
        userId,
        timestamp: new Date().toISOString()
      }
    };

    this.sendNotificationToUser(userId, notification);
  }

  /**
   * Notify multiple users about a transaction event
   */
  notifyMultipleUsers(userIds: string[], notification: TransactionNotification): void {
    userIds.forEach(userId => {
      this.sendNotificationToUser(userId, notification);
    });
  }

  /**
   * Send a balance summary notification
   */
  notifyBalanceUpdate(userId: string, summary: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    period: string;
  }): void {
    const notification = {
      type: 'balance_update',
      data: {
        userId,
        summary,
        timestamp: new Date().toISOString()
      }
    };

    this.sendNotificationToUser(userId, notification);
  }

  /**
   * Send a financial insights notification
   */
  notifyFinancialInsights(userId: string, insights: {
    topCategories: Array<{ category: string; amount: number; percentage: number }>;
    dailyAverage: number;
    monthlyTrend: Array<{ date: string; amount: number }>;
  }): void {
    const notification = {
      type: 'financial_insights',
      data: {
        userId,
        insights,
        timestamp: new Date().toISOString()
      }
    };

    this.sendNotificationToUser(userId, notification);
  }

  /**
   * Send notification to all connected users (admin broadcasts)
   */
  broadcastSystemMessage(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    const notification = {
      type: 'system_message',
      data: {
        message,
        type,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    this.wsManager.broadcast(notification);
  }

  /**
   * Send notification when user reaches financial limits
   */
  notifyLimitReached(userId: string, limit: {
    type: 'daily_spending' | 'monthly_budget' | 'category_limit';
    currentAmount: number;
    limitAmount: number;
    category?: string;
  }): void {
    const notification = {
      type: 'limit_reached',
      data: {
        userId,
        limit,
        timestamp: new Date().toISOString()
      }
    };

    this.sendNotificationToUser(userId, notification);
  }

  /**
   * Helper method to send notification to a specific user
   */
  private sendNotificationToUser(userId: string, notification: any): void {
    const message = {
      type: notification.type,
      data: notification.data,
      timestamp: new Date().toISOString()
    };

    const sentCount = this.wsManager.sendToUser(userId, message);

    if (sentCount > 0) {
      console.log(`WebSocket notification sent to user ${userId}: ${notification.type}`);
    } else {
      console.log(`User ${userId} not connected via WebSocket, notification skipped`);
    }
  }

  /**
   * Get statistics about notification delivery
   */
  getNotificationStats(): {
    connectedUsers: number;
    totalConnections: number;
  } {
    return {
      connectedUsers: this.wsManager.getUserCount(),
      totalConnections: this.wsManager.getConnectionCount()
    };
  }
}