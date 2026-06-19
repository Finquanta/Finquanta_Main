import { FastifyInstance, FastifyReply } from 'fastify';
import { TransactionController, AuthenticatedRequest } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { TransactionRepository } from './transaction.repository';
import { Database } from '../../infrastructure/database';
import { CreateTransactionData, UpdateTransactionData } from './transaction.types';
import { authenticate } from '../shared/authenticate';
import { ReceiptRepository } from './receipt.repository';

const ALLOWED_RECEIPT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

export async function transactionRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const { database } = options;

  // Initialize dependencies
  const transactionRepository = new TransactionRepository(database);
  const transactionService = new TransactionService(transactionRepository);
  const transactionController = new TransactionController(transactionService);
  const receiptRepository = new ReceiptRepository(database);

  // Schema definitions for validation
  const createTransactionSchema = {
    type: 'object',
    required: ['type', 'category', 'amount', 'date'],
    properties: {
      type: { type: 'string', enum: ['income', 'expense'] },
      category: { type: 'string', minLength: 1, maxLength: 100 },
      subcategory: { type: 'string', maxLength: 100 },
      amount: { type: 'number', minimum: 0.01 },
      description: { type: 'string', maxLength: 500 },
      date: { type: 'string', format: 'date' },
      invoice: { type: 'string', maxLength: 100 },
      metadata: { type: 'object' }
    }
  };

  const updateTransactionSchema = {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['income', 'expense'] },
      category: { type: 'string', minLength: 1, maxLength: 100 },
      subcategory: { type: 'string', maxLength: 100 },
      amount: { type: 'number', minimum: 0.01 },
      description: { type: 'string', maxLength: 500 },
      date: { type: 'string', format: 'date' },
      invoice: { type: 'string', maxLength: 100 },
      status: { type: 'string', enum: ['pending', 'completed', 'failed'] },
      metadata: { type: 'object' }
    }
  };

  const transactionParamsSchema = {
    type: 'object',
    properties: {
      id: { type: 'string' }
    }
  };

  const transactionQuerySchema = {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['income', 'expense'] },
      category: { type: 'string' },
      subcategory: { type: 'string' },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      status: { type: 'string', enum: ['pending', 'completed', 'failed'] },
      invoice: { type: 'string' },
      limit: { type: 'number', minimum: 1, maximum: 1000 },
      offset: { type: 'number', minimum: 0 },
      sortBy: { type: 'string', enum: ['date', 'amount', 'category', 'createdAt'] },
      sortOrder: { type: 'string', enum: ['asc', 'desc'] }
    }
  };

  const financialSummaryQuerySchema = {
    type: 'object',
    required: ['startDate', 'endDate'],
    properties: {
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' }
    }
  };

  // POST /api/v1/financial/transactions - Create transaction
  fastify.post<{
    Body: CreateTransactionData;
  }>('/v1/financial/transactions', {
    preHandler: [authenticate],
    schema: {
      body: createTransactionSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, ((request: AuthenticatedRequest, reply: FastifyReply) => {
    return transactionController.createTransaction(request, reply);
  }) as any);

  // GET /api/v1/financial/transactions - Get user transactions
  fastify.get('/v1/financial/transactions', {
    preHandler: [authenticate],
    schema: {
      querystring: transactionQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                transactions: { type: 'array' },
                totalCount: { type: 'number' },
                hasMore: { type: 'boolean' },
                filters: { type: 'object' }
              }
            }
          }
        }
      }
    }
  }, ((request: AuthenticatedRequest, reply: FastifyReply) => {
    return transactionController.getTransactions(request, reply);
  }) as any);

  // GET /api/v1/financial/transactions/:id - Get transaction by ID
  fastify.get<{
    Params: { id: string };
  }>('/v1/financial/transactions/:id', {
    preHandler: [authenticate],
    schema: {
      params: transactionParamsSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, ((request: AuthenticatedRequest, reply: FastifyReply) => {
    return transactionController.getTransactionById(request, reply);
  }) as any);

  // PUT /api/v1/financial/transactions/:id - Update transaction
  fastify.put<{
    Params: { id: string };
    Body: UpdateTransactionData;
  }>('/v1/financial/transactions/:id', {
    preHandler: [authenticate],
    schema: {
      params: transactionParamsSchema,
      body: updateTransactionSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, ((request: AuthenticatedRequest, reply: FastifyReply) => {
    return transactionController.updateTransaction(request, reply);
  }) as any);

  // DELETE /api/v1/financial/transactions/:id - Delete transaction
  fastify.delete<{
    Params: { id: string };
  }>('/v1/financial/transactions/:id', {
    preHandler: [authenticate],
    schema: {
      params: transactionParamsSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, ((request: AuthenticatedRequest, reply: FastifyReply) => {
    return transactionController.deleteTransaction(request, reply);
  }) as any);

  // GET /api/v1/financial/summary - Get financial summary
  fastify.get('/v1/financial/summary', {
    preHandler: [authenticate],
    schema: {
      querystring: financialSummaryQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalIncome: { type: 'string' },
                totalExpenses: { type: 'string' },
                netIncome: { type: 'string' },
                transactionCount: { type: 'number' },
                periodStart: { type: 'string' },
                periodEnd: { type: 'string' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, ((request: AuthenticatedRequest, reply: FastifyReply) => {
    return transactionController.getFinancialSummary(request, reply);
  }) as any);

  // POST /api/v1/financial/transactions/:id/receipt — upload a receipt (PDF/image)
  fastify.post('/v1/financial/transactions/:id/receipt', {
    preHandler: [authenticate]
  }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = request.user!.id;

      if (!(await receiptRepository.transactionBelongsToUser(id, userId))) {
        return reply.status(404).send({ success: false, error: 'Transaction not found' });
      }

      const file = await (request as any).file();
      if (!file) {
        return reply.status(400).send({ success: false, error: 'No file uploaded' });
      }
      if (!ALLOWED_RECEIPT_TYPES.includes(file.mimetype)) {
        return reply.status(400).send({ success: false, error: 'Only PDF or image files are allowed' });
      }

      let buffer: Buffer;
      try {
        buffer = await file.toBuffer();
      } catch (err: any) {
        if (err?.code === 'FST_REQ_FILE_TOO_LARGE') {
          return reply.status(413).send({ success: false, error: 'File too large (max 10MB)' });
        }
        throw err;
      }
      if ((file as any).truncated) {
        return reply.status(413).send({ success: false, error: 'File too large (max 10MB)' });
      }

      // Make sure the table exists (idempotent) in case the boot migration was skipped.
      await receiptRepository.ensureSchema();
      await receiptRepository.save(userId, id, {
        filename: file.filename,
        mimeType: file.mimetype,
        data: buffer
      });

      return reply.status(201).send({ success: true, data: { transactionId: id } });
    } catch (error) {
      request.log.error(error);
      // Surface the underlying reason so the user/devs can see what failed.
      const detail = error instanceof Error ? error.message : 'Internal server error';
      return reply.status(500).send({ success: false, error: detail });
    }
  }) as any);

  // GET /api/v1/financial/transactions/:id/receipt — download/view the receipt
  fastify.get('/v1/financial/transactions/:id/receipt', {
    preHandler: [authenticate]
  }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const receipt = await receiptRepository.get(request.user!.id, id);
      if (!receipt) {
        return reply.status(404).send({ success: false, error: 'Receipt not found' });
      }
      return reply
        .header('Content-Type', receipt.mimeType)
        .header('Content-Disposition', `inline; filename="${receipt.filename.replace(/"/g, '')}"`)
        .send(receipt.data);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);
}
