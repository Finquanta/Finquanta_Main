import { FastifyRequest, FastifyReply } from 'fastify';
import { TransactionService } from './transaction.service';
import {
  CreateTransactionData,
  UpdateTransactionData,
  TransactionFilters,
  TransactionType,
  TransactionStatus
} from './transaction.types';

export type AuthenticatedRequest = Omit<FastifyRequest, 'user'> & {
  user?: {
    id: string;
    email: string;
    role: string;
  };
};

export class TransactionController {
  constructor(private transactionService: TransactionService) {}

  async createTransaction(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      // Check if user is authenticated
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const userId = request.user.id;
      const transactionData = request.body as CreateTransactionData;

      // Validate required fields
      if (!transactionData.type || !Object.values(TransactionType).includes(transactionData.type)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid transaction type'
        });
      }

      if (!transactionData.category || transactionData.category.trim().length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Category is required'
        });
      }

      if (!transactionData.amount || transactionData.amount <= 0) {
        return reply.status(400).send({
          success: false,
          error: 'Amount must be positive'
        });
      }

      if (!transactionData.date) {
        return reply.status(400).send({
          success: false,
          error: 'Date is required'
        });
      }

      // Create transaction through service (scoped to the active business)
      const businessId = (request as any).businessId as string;
      const transaction = await this.transactionService.createTransaction(businessId, userId, transactionData);

      return reply.status(201).send({
        success: true,
        data: transaction
      });
    } catch (error) {
      console.error('Error creating transaction:', error);

      if (error instanceof Error) {
        // Handle validation errors
        if (error.message.includes('required') ||
            error.message.includes('Invalid') ||
            error.message.includes('must be')) {
          return reply.status(400).send({
            success: false,
            error: error.message
          });
        }
      }

      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getTransactions(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      // Check if user is authenticated
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const userId = request.user.id;
      const query = request.query as any;

      // Parse and validate filters
      const filters: TransactionFilters = {};

      if (query.type && Object.values(TransactionType).includes(query.type)) {
        filters.type = query.type;
      }

      if (query.category) {
        filters.category = query.category;
      }

      if (query.subcategory) {
        filters.subcategory = query.subcategory;
      }

      if (query.startDate) {
        filters.startDate = query.startDate;
      }

      if (query.endDate) {
        filters.endDate = query.endDate;
      }

      if (query.status && Object.values(TransactionStatus).includes(query.status)) {
        filters.status = query.status;
      }

      if (query.invoice) {
        filters.invoice = query.invoice;
      }

      // Parse pagination parameters
      if (query.limit) {
        const limit = parseInt(query.limit);
        if (limit > 0) {
          filters.limit = limit;
        }
      }

      if (query.offset) {
        const offset = parseInt(query.offset);
        if (offset >= 0) {
          filters.offset = offset;
        }
      }

      // Parse sorting parameters
      if (query.sortBy) {
        const allowedSortFields = ['date', 'amount', 'category', 'createdAt'];
        if (allowedSortFields.includes(query.sortBy)) {
          filters.sortBy = query.sortBy;
        }
      }

      if (query.sortOrder) {
        const sortOrder = query.sortOrder.toLowerCase();
        if (sortOrder === 'asc' || sortOrder === 'desc') {
          filters.sortOrder = sortOrder as 'asc' | 'desc';
        }
      }

      // Get transactions through service (scoped to the active business)
      const result = await this.transactionService.getUserTransactions((request as any).businessId, filters);

      return reply.status(200).send({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);

      if (error instanceof Error) {
        // Handle validation errors
        if (error.message.includes('must be') ||
            error.message.includes('Invalid') ||
            error.message.includes('cannot')) {
          return reply.status(400).send({
            success: false,
            error: error.message
          });
        }
      }

      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getTransactionById(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      // Check if user is authenticated
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const userId = request.user.id;
      const { id } = request.params as { id: string };

      if (!id) {
        return reply.status(400).send({
          success: false,
          error: 'Transaction ID is required'
        });
      }

      // Get transaction through service (scoped to the active business)
      const transaction = await this.transactionService.getTransactionById(id, (request as any).businessId);

      if (!transaction) {
        return reply.status(404).send({
          success: false,
          error: 'Transaction not found'
        });
      }

      return reply.status(200).send({
        success: true,
        data: transaction
      });
    } catch (error) {
      console.error('Error fetching transaction:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async updateTransaction(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      // Check if user is authenticated
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const userId = request.user.id;
      const { id } = request.params as { id: string };
      const updateData = request.body as UpdateTransactionData;

      if (!id) {
        return reply.status(400).send({
          success: false,
          error: 'Transaction ID is required'
        });
      }

      // Validate update data
      if (updateData.amount !== undefined && updateData.amount <= 0) {
        return reply.status(400).send({
          success: false,
          error: 'Amount must be positive'
        });
      }

      if (updateData.type !== undefined && !Object.values(TransactionType).includes(updateData.type)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid transaction type'
        });
      }

      if (updateData.status !== undefined && !Object.values(TransactionStatus).includes(updateData.status)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid transaction status'
        });
      }

      // Update transaction through service (scoped to the active business)
      const updatedTransaction = await this.transactionService.updateTransaction(id, (request as any).businessId, updateData);

      if (!updatedTransaction) {
        return reply.status(404).send({
          success: false,
          error: 'Transaction not found'
        });
      }

      return reply.status(200).send({
        success: true,
        data: updatedTransaction
      });
    } catch (error) {
      console.error('Error updating transaction:', error);

      if (error instanceof Error) {
        // Handle validation errors
        if (error.message.includes('must be') ||
            error.message.includes('Invalid') ||
            error.message.includes('cannot')) {
          return reply.status(400).send({
            success: false,
            error: error.message
          });
        }
      }

      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async deleteTransaction(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      // Check if user is authenticated
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const userId = request.user.id;
      const { id } = request.params as { id: string };

      if (!id) {
        return reply.status(400).send({
          success: false,
          error: 'Transaction ID is required'
        });
      }

      // Delete transaction through service (scoped to the active business)
      const deleted = await this.transactionService.deleteTransaction(id, (request as any).businessId);

      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: 'Transaction not found'
        });
      }

      return reply.status(200).send({
        success: true,
        message: 'Transaction deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getFinancialSummary(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      // Check if user is authenticated
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const userId = request.user.id;
      const query = request.query as any;

      const { startDate, endDate } = query;

      if (!startDate || !endDate) {
        return reply.status(400).send({
          success: false,
          error: 'Start date and end date are required'
        });
      }

      // Get financial summary through service (scoped to the active business)
      const summary = await this.transactionService.getFinancialSummary((request as any).businessId, {
        startDate,
        endDate
      });

      return reply.status(200).send({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error fetching financial summary:', error);

      if (error instanceof Error) {
        // Handle validation errors
        if (error.message.includes('must be') ||
            error.message.includes('Invalid') ||
            error.message.includes('required')) {
          return reply.status(400).send({
            success: false,
            error: error.message
          });
        }
      }

      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}
