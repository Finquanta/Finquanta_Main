import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { InvoicesRepository, InvoiceInput } from './invoices.repository';
import { AccountingRepository } from '../accounting/accounting.repository';
import { buildWorkflow } from '../accounting/accounting.engine';

/**
 * Invoices, and the accounting that follows automatically (Section 5):
 *
 *   Draft            → no accounting impact at all.
 *   Mark as Sent     → credit_revenue: Accounts Receivable ↑, Revenue ↑.
 *   Mark as Paid     → receive_ar_payment: Business Cash ↑, Accounts Receivable ↓.
 *                      (If it was never marked sent, the receivable is booked
 *                      first so the books stay correct.)
 *   Cancel (unpaid)  → a reversing entry backs the receivable out.
 *
 * All of this is deterministic code — no AI calls.
 */
export async function invoiceRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new InvoicesRepository(options.database);
  const ledger = new AccountingRepository(options.database);
  const pre = [authenticate, withBusiness(options.database)];

  const fail = (reply: FastifyReply, error: unknown, request: AuthenticatedRequest) => {
    request.log.error(error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return reply.status(500).send({ success: false, error: msg });
  };

  fastify.get('/v1/invoices', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await repo.list(request.businessId!) });
    } catch (error) { return fail(reply, error, request); }
  }) as any);

  fastify.get('/v1/invoices/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const invoice = await repo.getById(request.businessId!, id);
      if (!invoice) return reply.status(404).send({ success: false, error: 'Invoice not found' });
      return reply.send({ success: true, data: invoice });
    } catch (error) { return fail(reply, error, request); }
  }) as any);

  fastify.post('/v1/invoices', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as InvoiceInput) || {};
      const created = await repo.create(request.businessId!, request.user!.id, body);
      return reply.status(201).send({ success: true, data: created });
    } catch (error) { return fail(reply, error, request); }
  }) as any);

  fastify.patch('/v1/invoices/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const existing = await repo.getById(request.businessId!, id);
      if (!existing) return reply.status(404).send({ success: false, error: 'Invoice not found' });
      if (existing.status === 'paid') {
        return reply.status(400).send({ success: false, error: 'A paid invoice cannot be edited.' });
      }
      const updated = await repo.update(request.businessId!, id, (request.body as InvoiceInput) || {});
      return reply.send({ success: true, data: updated });
    } catch (error) { return fail(reply, error, request); }
  }) as any);

  /** The recycle bin. Must be declared before /:id so it isn't read as an id. */
  fastify.get('/v1/invoices/deleted', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await repo.listDeleted(request.businessId!) });
    } catch (error) { return fail(reply, error, request); }
  }) as any);

  /**
   * Delete = move to the recycle bin (recoverable). An invoice that's already
   * in the books must be cancelled first, so the ledger is reversed properly
   * rather than a receivable being left stranded.
   */
  fastify.delete('/v1/invoices/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const existing = await repo.getById(request.businessId!, id);
      if (!existing) return reply.status(404).send({ success: false, error: 'Invoice not found' });
      if (existing.arEntryId && existing.status !== 'cancelled') {
        return reply.status(400).send({ success: false, error: 'This invoice is already in your books. Cancel it first, then delete it.' });
      }
      await repo.softDelete(request.businessId!, id);
      return reply.send({ success: true, data: { id } });
    } catch (error) { return fail(reply, error, request); }
  }) as any);

  /** Restore from the recycle bin. */
  fastify.post('/v1/invoices/:id/restore', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ok = await repo.restore(request.businessId!, id);
      if (!ok) return reply.status(404).send({ success: false, error: 'Invoice not found' });
      return reply.send({ success: true, data: await repo.getById(request.businessId!, id) });
    } catch (error) { return fail(reply, error, request); }
  }) as any);

  /** Permanently delete — only from the recycle bin. */
  fastify.delete('/v1/invoices/:id/permanent', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const existing = await repo.getById(request.businessId!, id);
      if (!existing) return reply.status(404).send({ success: false, error: 'Invoice not found' });
      await repo.remove(request.businessId!, id);
      return reply.send({ success: true, data: { id } });
    } catch (error) { return fail(reply, error, request); }
  }) as any);

  /** Mark as Sent — books the receivable. */
  fastify.post('/v1/invoices/:id/send', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const invoice = await repo.getById(request.businessId!, id);
      if (!invoice) return reply.status(404).send({ success: false, error: 'Invoice not found' });
      if (invoice.status === 'paid') return reply.status(400).send({ success: false, error: 'This invoice is already paid.' });
      if (invoice.total <= 0) return reply.status(400).send({ success: false, error: 'Add at least one line item before sending.' });

      let arEntryId = invoice.arEntryId;
      if (!arEntryId) {
        const built = buildWorkflow('credit_revenue', {
          amount: invoice.total,
          description: `Invoice ${invoice.number}${invoice.customerName ? ` — ${invoice.customerName}` : ''}`,
        });
        arEntryId = await ledger.createEntry({
          businessId: request.businessId!,
          description: built.description,
          sourceType: 'invoice',
          sourceId: invoice.id,
          createdBy: request.user!.id,
          lines: built.lines,
        });
      }
      await repo.setStatus(request.businessId!, id, 'sent', { arEntryId });
      return reply.send({ success: true, data: await repo.getById(request.businessId!, id) });
    } catch (error) { return fail(reply, error, request); }
  }) as any);

  /** Mark as Paid — books the payment (cash in, receivable cleared). */
  fastify.post('/v1/invoices/:id/pay', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const invoice = await repo.getById(request.businessId!, id);
      if (!invoice) return reply.status(404).send({ success: false, error: 'Invoice not found' });
      if (invoice.status === 'paid') return reply.status(400).send({ success: false, error: 'This invoice is already paid.' });
      if (invoice.total <= 0) return reply.status(400).send({ success: false, error: 'This invoice has no amount to pay.' });

      // If it was never marked sent, book the receivable first so the ledger is
      // correct before we clear it.
      let arEntryId = invoice.arEntryId;
      if (!arEntryId) {
        const ar = buildWorkflow('credit_revenue', {
          amount: invoice.total,
          description: `Invoice ${invoice.number}${invoice.customerName ? ` — ${invoice.customerName}` : ''}`,
        });
        arEntryId = await ledger.createEntry({
          businessId: request.businessId!,
          description: ar.description,
          sourceType: 'invoice',
          sourceId: invoice.id,
          createdBy: request.user!.id,
          lines: ar.lines,
        });
      }

      const payment = buildWorkflow('receive_ar_payment', {
        amount: invoice.total,
        description: `Payment for invoice ${invoice.number}${invoice.customerName ? ` — ${invoice.customerName}` : ''}`,
      });
      const paymentEntryId = await ledger.createEntry({
        businessId: request.businessId!,
        description: payment.description,
        sourceType: 'invoice_payment',
        sourceId: invoice.id,
        createdBy: request.user!.id,
        lines: payment.lines,
      });

      await repo.setStatus(request.businessId!, id, 'paid', { arEntryId, paymentEntryId });
      return reply.send({ success: true, data: await repo.getById(request.businessId!, id) });
    } catch (error) { return fail(reply, error, request); }
  }) as any);

  /** Cancel — reverses the receivable if one was booked. */
  fastify.post('/v1/invoices/:id/cancel', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const invoice = await repo.getById(request.businessId!, id);
      if (!invoice) return reply.status(404).send({ success: false, error: 'Invoice not found' });
      if (invoice.status === 'paid') {
        return reply.status(400).send({ success: false, error: 'A paid invoice cannot be cancelled.' });
      }

      if (invoice.arEntryId) {
        // Reverse the receivable: Revenue ↓ (debit), Accounts Receivable ↓ (credit).
        await ledger.createEntry({
          businessId: request.businessId!,
          description: `Cancelled invoice ${invoice.number}`,
          sourceType: 'invoice_cancelled',
          sourceId: invoice.id,
          createdBy: request.user!.id,
          lines: [
            { code: 'REVENUE', debit: invoice.total, credit: 0 },
            { code: 'AR', debit: 0, credit: invoice.total },
          ],
        });
      }
      await repo.setStatus(request.businessId!, id, 'cancelled');
      return reply.send({ success: true, data: await repo.getById(request.businessId!, id) });
    } catch (error) { return fail(reply, error, request); }
  }) as any);
}
