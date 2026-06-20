import { FastifyInstance } from 'fastify';
import { Database } from '../../infrastructure/database';
import { TransactionRepository } from '../financial/transaction.repository';
import { TransactionService } from '../financial/transaction.service';
import { authenticate } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { BookkeepingController } from './bookkeeping.controller';
import { BookkeepingService } from './bookkeeping.service';

export async function bookkeepingRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const transactionService = new TransactionService(new TransactionRepository(options.database));
  const controller = new BookkeepingController(new BookkeepingService(transactionService));
  const pre = [authenticate, withBusiness(options.database)];

  fastify.get('/v1/bookkeeping/overview', { preHandler: pre }, controller.getOverview.bind(controller) as any);
  fastify.post('/v1/bookkeeping/transactions', { preHandler: pre }, controller.createTransaction.bind(controller) as any);
  fastify.patch('/v1/bookkeeping/transactions/:id', { preHandler: pre }, controller.updateTransaction.bind(controller) as any);
  fastify.delete('/v1/bookkeeping/transactions/:id', { preHandler: pre }, controller.deleteTransaction.bind(controller) as any);
}
