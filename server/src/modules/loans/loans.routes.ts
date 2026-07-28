import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { LoansRepository, LoanType, splitPayment } from './loans.repository';
import { AccountingRepository } from '../accounting/accounting.repository';
import { JournalLineInput } from '../accounting/accounting.types';

/**
 * DEBT — both directions.
 *
 * Loan PAYABLE (money borrowed):
 *   received → Cash ↑            , Loan Payable ↑
 *   payment  → Cash ↓ (full)     , Loan Payable ↓ (principal), Interest Expense ↑ (interest)
 *
 * Loan RECEIVABLE (money lent out — the mirror opposite, an asset):
 *   issued   → Cash ↓            , Loan Receivable ↑
 *   repaid   → Cash ↑ (full)     , Loan Receivable ↓ (principal), Interest Income ↑ (interest)
 *
 * The principal/interest split is computed from the loan's own annual_rate and
 * remaining_balance (see splitPayment) — deterministic code, no AI.
 */
export async function loanRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new LoansRepository(options.database);
  const ledger = new AccountingRepository(options.database);
  const pre = [authenticate, withBusiness(options.database)];

  const isType = (v: unknown): v is LoanType => v === 'payable' || v === 'receivable';

  fastify.get('/v1/loans', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { type } = request.query as { type?: string };
      const loans = await repo.list(request.businessId!, isType(type) ? type : undefined);
      return reply.send({ success: true, data: loans });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  fastify.get('/v1/loans/:id/payments', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const loan = await repo.getById(request.businessId!, id);
      if (!loan) return reply.status(404).send({ success: false, error: 'Loan not found' });
      return reply.send({ success: true, data: await repo.listPayments(id) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  /** Create a loan. 'payable' = borrowed (cash in). 'receivable' = lent out (cash out). */
  fastify.post('/v1/loans', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as { name?: string; type?: string; amount?: number; annualRate?: number; date?: string; groupId?: string | null }) || {};
      if (!body.name?.trim()) return reply.status(400).send({ success: false, error: 'Give the loan a name' });
      if (!isType(body.type)) return reply.status(400).send({ success: false, error: "Loan type must be 'payable' or 'receivable'" });

      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return reply.status(400).send({ success: false, error: 'Amount must be greater than zero' });
      }
      const annualRate = Number(body.annualRate) || 0;
      if (annualRate < 0) return reply.status(400).send({ success: false, error: 'Interest rate cannot be negative' });

      const lines: JournalLineInput[] = body.type === 'payable'
        ? [{ code: 'CASH', debit: amount, credit: 0 }, { code: 'LOAN_PAYABLE', debit: 0, credit: amount }]
        : [{ code: 'LOAN_RECEIVABLE', debit: amount, credit: 0 }, { code: 'CASH', debit: 0, credit: amount }];

      const entryId = await ledger.createEntry({
        businessId: request.businessId!,
        description: body.type === 'payable' ? `Loan received — ${body.name.trim()}` : `Loan issued — ${body.name.trim()}`,
        sourceType: body.type === 'payable' ? 'loan_received' : 'loan_issued',
        createdBy: request.user!.id,
        date: body.date ?? null,
        lines,
      });

      const loan = await repo.create(request.businessId!, request.user!.id, {
        name: body.name, type: body.type, principal: amount, annualRate, startDate: body.date ?? null, entryId,
        groupId: body.groupId ?? null,
      });
      // Trace the ledger entry back to the loan so the row can be managed from it.
      await repo.linkReceivedEntry(entryId, loan.id);
      return reply.status(201).send({ success: true, data: loan });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not create loan';
      request.log.error(error);
      return reply.status(400).send({ success: false, error: msg });
    }
  }) as any);

  /**
   * Record a payment against a loan. The interest/principal split is derived
   * from the loan's rate and CURRENT remaining balance — never guessed.
   */
  fastify.post('/v1/loans/:id/payments', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as { amount?: number; date?: string }) || {};
      const loan = await repo.getById(request.businessId!, id);
      if (!loan) return reply.status(404).send({ success: false, error: 'Loan not found' });

      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return reply.status(400).send({ success: false, error: 'Payment must be greater than zero' });
      }
      if (loan.remainingBalance <= 0) {
        return reply.status(400).send({ success: false, error: 'This loan is already fully settled.' });
      }

      const { interest, principal, balanceAfter } = splitPayment(amount, loan.remainingBalance, loan.annualRate);

      // Cash always moves by the FULL payment; the split only decides how the
      // other side is booked.
      const lines: JournalLineInput[] = [];
      if (loan.type === 'payable') {
        // Paying down a debt: Loan Payable ↓ (principal), Interest Expense ↑, Cash ↓ (full).
        if (principal > 0) lines.push({ code: 'LOAN_PAYABLE', debit: principal, credit: 0 });
        if (interest > 0) lines.push({ code: 'INTEREST_EXPENSE', debit: interest, credit: 0 });
        lines.push({ code: 'CASH', debit: 0, credit: principal + interest });
      } else {
        // Being repaid: Cash ↑ (full), Loan Receivable ↓ (principal), Interest Income ↑.
        lines.push({ code: 'CASH', debit: principal + interest, credit: 0 });
        if (principal > 0) lines.push({ code: 'LOAN_RECEIVABLE', debit: 0, credit: principal });
        if (interest > 0) lines.push({ code: 'INTEREST_INCOME', debit: 0, credit: interest });
      }

      const entryId = await ledger.createEntry({
        businessId: request.businessId!,
        description: loan.type === 'payable'
          ? `Loan payment — ${loan.name} (principal ${principal.toFixed(2)}, interest ${interest.toFixed(2)})`
          : `Loan repayment received — ${loan.name} (principal ${principal.toFixed(2)}, interest ${interest.toFixed(2)})`,
        sourceType: loan.type === 'payable' ? 'loan_payment' : 'loan_repayment_received',
        sourceId: loan.id,
        createdBy: request.user!.id,
        date: body.date ?? null,
        lines,
      });

      const payment = await repo.addPayment(loan.id, {
        date: body.date ?? null, amount: principal + interest, interest, principal, balanceAfter, entryId,
      });

      return reply.status(201).send({ success: true, data: { payment, loan: await repo.getById(request.businessId!, id) } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not record payment';
      request.log.error(error);
      return reply.status(400).send({ success: false, error: msg });
    }
  }) as any);

  /** Reverse a single loan payment, identified by its ledger entry id. */
  fastify.delete('/v1/loans/payments/:entryId', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { entryId } = request.params as { entryId: string };
      const removed = await repo.deletePaymentByEntry(request.businessId!, entryId);
      if (!removed) return reply.status(404).send({ success: false, error: 'Payment not found' });
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  /** Delete a loan and every ledger entry + payment it created. */
  fastify.delete('/v1/loans/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const removed = await repo.deleteWithLedger(request.businessId!, id);
      if (!removed) return reply.status(404).send({ success: false, error: 'Loan not found' });
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);
}
