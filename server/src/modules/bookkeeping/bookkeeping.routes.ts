import { FastifyInstance } from 'fastify';
import { Database } from '../../infrastructure/database';
import { TransactionRepository } from '../financial/transaction.repository';
import { TransactionService } from '../financial/transaction.service';
import { authenticate } from '../shared/authenticate';
import { BookkeepingController } from './bookkeeping.controller';
import { BookkeepingService } from './bookkeeping.service';

export async function bookkeepingRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const transactionService = new TransactionService(new TransactionRepository(options.database));
  const controller = new BookkeepingController(new BookkeepingService(transactionService));

  fastify.get('/v1/bookkeeping/overview', { preHandler: [authenticate] }, controller.getOverview.bind(controller) as any);
  fastify.post('/v1/bookkeeping/transactions', { preHandler: [authenticate] }, controller.createTransaction.bind(controller) as any);
  fastify.patch('/v1/bookkeeping/transactions/:id', { preHandler: [authenticate] }, controller.updateTransaction.bind(controller) as any);
  fastify.delete('/v1/bookkeeping/transactions/:id', { preHandler: [authenticate] }, controller.deleteTransaction.bind(controller) as any);
}
