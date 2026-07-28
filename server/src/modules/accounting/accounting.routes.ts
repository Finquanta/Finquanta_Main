import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { AccountingRepository } from './accounting.repository';
import { buildWorkflow, isWorkflowType, WORKFLOW_TYPES, WORKFLOW_META } from './accounting.engine';
import { JournalLineInput } from './accounting.types';

export async function accountingRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new AccountingRepository(options.database);
  const pre = [authenticate, withBusiness(options.database)];

  // Account balances (Accounts Receivable, Accounts Payable, Loans, Cash, …).
  fastify.get('/v1/accounting/accounts', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await repo.getBalances(request.businessId!) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  /**
   * The unified transactions list behind the Bookkeeping card.
   *
   *   basis=cash    — money that actually moved (your entries + invoice/loan payments)
   *   basis=accrual — the above, plus what's owed (invoices raised, bills)
   *
   * Syncs bookkeeping into the ledger first, so nothing is missing.
   */
  fastify.get('/v1/accounting/transactions', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { basis, limit } = request.query as { basis?: string; limit?: string };
      const b = basis === 'accrual' ? 'accrual' : 'cash';
      const n = Math.min(Math.max(Number.parseInt(limit ?? '100', 10) || 100, 1), 500);

      await repo.resyncBookkeeping(request.businessId!);
      return reply.send({ success: true, data: await repo.listTransactions(request.businessId!, b, n) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // The ledger — recent journal entries with their debit/credit lines.
  fastify.get('/v1/accounting/entries', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { limit, basis } = request.query as { limit?: string; basis?: string };
      const n = Math.min(Math.max(Number.parseInt(limit ?? '100', 10) || 100, 1), 500);
      // 'cash' = only entries where money actually moved; 'accrual' = everything.
      const b = basis === 'cash' ? 'cash' : 'accrual';
      return reply.send({ success: true, data: await repo.listEntries(request.businessId!, n, b) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  /**
   * The available workflows with their metadata, so the UI can render each
   * module's options without hardcoding them: bookkeeping = cash basis (cash
   * flow + expenses), accounting = accrual (AR / AP / loans).
   */
  fastify.get('/v1/accounting/workflows', { preHandler: pre }, (async (_request: AuthenticatedRequest, reply: FastifyReply) => {
    const data = WORKFLOW_TYPES.map((type) => ({ type, ...WORKFLOW_META[type] }));
    return reply.send({ success: true, data });
  }) as any);

  /**
   * Run an accounting workflow (cash_revenue, credit_expense, loan_payment, …).
   * The engine builds the balanced entry — the caller just describes the event.
   */
  fastify.post('/v1/accounting/workflows', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as { type?: string; amount?: number; interest?: number; description?: string; date?: string; groupId?: string | null }) || {};
      if (!isWorkflowType(body.type)) {
        return reply.status(400).send({ success: false, error: `Unknown workflow. Expected one of: ${WORKFLOW_TYPES.join(', ')}` });
      }
      const built = buildWorkflow(body.type, {
        amount: Number(body.amount),
        interest: body.interest !== undefined ? Number(body.interest) : undefined,
        description: body.description,
      });
      const id = await repo.createEntry({
        businessId: request.businessId!,
        description: built.description,
        sourceType: body.type,
        createdBy: request.user!.id,
        date: body.date ?? null,
        groupId: body.groupId ?? null,
        lines: built.lines,
      });
      return reply.status(201).send({ success: true, data: { id } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not record entry';
      request.log.error(error);
      return reply.status(400).send({ success: false, error: msg });
    }
  }) as any);

  /** Delete an accrual/manual ledger entry (loan/bookkeeping/invoice entries are refused). */
  fastify.delete('/v1/accounting/entries/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const removed = await repo.deleteDirectEntry(request.businessId!, id);
      if (!removed) return reply.status(404).send({ success: false, error: 'Entry not found, or not one you can delete here' });
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Manual journal entry — for the advanced cases the workflows don't cover.
  fastify.post('/v1/accounting/entries', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as { description?: string; date?: string; lines?: JournalLineInput[] }) || {};
      if (!body.description?.trim()) {
        return reply.status(400).send({ success: false, error: 'A description is required' });
      }
      if (!Array.isArray(body.lines) || body.lines.length < 2) {
        return reply.status(400).send({ success: false, error: 'A manual entry needs at least two lines' });
      }
      const id = await repo.createEntry({
        businessId: request.businessId!,
        description: body.description.trim(),
        sourceType: 'manual',
        createdBy: request.user!.id,
        date: body.date ?? null,
        lines: body.lines,
      });
      return reply.status(201).send({ success: true, data: { id } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not record entry';
      request.log.error(error);
      return reply.status(400).send({ success: false, error: msg });
    }
  }) as any);
}
