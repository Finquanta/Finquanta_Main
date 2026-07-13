import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { InvoicesRepository, InvoiceInput, Invoice } from './invoices.repository';
import { AccountingRepository } from '../accounting/accounting.repository';
import { buildWorkflow } from '../accounting/accounting.engine';
import { ActivityRepository } from '../activity/activity.repository';

/**
 * Invoices, and the accounting that follows automatically (Section 5):
 *
 *   Draft            → no accounting impact at all.
 *   Mark as Sent     → credit_revenue: Accounts Receivable ↑, Revenue ↑.
 *   Mark as Paid     → receive_ar_payment: Business Cash ↑, Accounts Receivable ↓.
 *                      (If it was never marked sent, the receivable is booked
 *                      first so the books stay correct.)
 *   Cancel / Void    → a reversing entry backs out whatever was posted, leaving
 *                      the cancelled invoice on record.
 *   Delete           → no reversing entry: the invoice's journal entries are
 *                      erased outright, so it vanishes from the books entirely.
 *
 * All of this is deterministic code — no AI calls.
 */
export async function invoiceRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new InvoicesRepository(options.database);
  const ledger = new AccountingRepository(options.database);
  const activity = new ActivityRepository(options.database);
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

      // A draft touches no ledger, so this event exists only on the timeline.
      await activity.record(request.businessId!, {
        type: 'invoice_created',
        title: `Invoice ${created.number} created`,
        description: created.customerName ? `For ${created.customerName}` : null,
        amount: created.total,
        entityType: 'invoice',
        entityId: created.id,
        actorId: request.user!.id,
      });

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
   * Put an invoice on the books to match its status. Used when marking it
   * sent/paid, and again when it comes back out of the recycle bin.
   *
   *   draft / cancelled     → nothing is posted
   *   sent / viewed/overdue → the receivable (AR ↑, Revenue ↑)
   *   paid                  → the receivable, then its settlement (Cash ↑, AR ↓)
   */
  const postForStatus = async (
    businessId: string, userId: string, invoice: Invoice
  ): Promise<{ arEntryId?: string; paymentEntryId?: string }> => {
    const booked = ['sent', 'viewed', 'overdue', 'paid'].includes(invoice.status);
    if (!booked || invoice.total <= 0) return {};
    const who = invoice.customerName ? ` — ${invoice.customerName}` : '';

    const ar = buildWorkflow('credit_revenue', {
      amount: invoice.total,
      description: `Invoice ${invoice.number}${who}`,
    });
    const arEntryId = await ledger.createEntry({
      businessId, description: ar.description, sourceType: 'invoice',
      sourceId: invoice.id, createdBy: userId, lines: ar.lines,
    });
    if (invoice.status !== 'paid') return { arEntryId };

    const payment = buildWorkflow('receive_ar_payment', {
      amount: invoice.total,
      description: `Payment for invoice ${invoice.number}${who}`,
    });
    const paymentEntryId = await ledger.createEntry({
      businessId, description: payment.description, sourceType: 'invoice_payment',
      sourceId: invoice.id, createdBy: userId, lines: payment.lines,
    });
    return { arEntryId, paymentEntryId };
  };

  /**
   * Delete = move to the recycle bin, and erase everything the invoice put on
   * the books.
   *
   * No reversing entry is posted. The invoice's journal entries are removed
   * outright, so a deleted invoice leaves no trace in Bookkeeping, the
   * dashboard totals or the revenue chart — as if it had never been raised.
   * Works from any status, including paid.
   *
   * The invoice document itself is kept (with its status), so restoring it from
   * the bin can put the same entries straight back.
   */
  fastify.delete('/v1/invoices/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const existing = await repo.getById(request.businessId!, id);
      if (!existing) return reply.status(404).send({ success: false, error: 'Invoice not found' });

      await ledger.purgeInvoiceEntries(request.businessId!, id);
      await repo.clearLedgerLinks(request.businessId!, id);
      await repo.softDelete(request.businessId!, id);

      await activity.record(request.businessId!, {
        type: 'invoice_deleted',
        title: `Invoice ${existing.number} moved to the recycle bin`,
        amount: existing.total,
        entityType: 'invoice',
        entityId: existing.id,
        actorId: request.user!.id,
      });
      return reply.send({ success: true, data: { id } });
    } catch (error) { return fail(reply, error, request); }
  }) as any);

  /** Restore from the recycle bin — and put it back on the books as it was. */
  fastify.post('/v1/invoices/:id/restore', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ok = await repo.restore(request.businessId!, id);
      if (!ok) return reply.status(404).send({ success: false, error: 'Invoice not found' });

      const restored = await repo.getById(request.businessId!, id);
      if (restored) {
        // Deleting erased its entries, so re-post whatever its status implies.
        const entries = await postForStatus(request.businessId!, request.user!.id, restored);
        if (entries.arEntryId) await repo.setStatus(request.businessId!, id, restored.status, entries);
      }

      const final = await repo.getById(request.businessId!, id);
      await activity.record(request.businessId!, {
        type: 'invoice_restored',
        title: `Invoice ${final?.number ?? ''} restored from the recycle bin`,
        amount: final?.total ?? null,
        entityType: 'invoice',
        entityId: id,
        actorId: request.user!.id,
      });
      return reply.send({ success: true, data: final });
    } catch (error) { return fail(reply, error, request); }
  }) as any);

  /** Permanently delete — only from the recycle bin. Its entries are long gone. */
  fastify.delete('/v1/invoices/:id/permanent', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const existing = await repo.getById(request.businessId!, id);
      if (!existing) return reply.status(404).send({ success: false, error: 'Invoice not found' });
      await ledger.purgeInvoiceEntries(request.businessId!, id);
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

  /**
   * Cancel (void) — reverses whatever this invoice actually posted, so the books
   * end up exactly as if it had never existed.
   *
   *   Draft  → nothing was posted, so nothing to reverse.
   *   Sent   → a receivable was raised (AR ↑, Revenue ↑), so reverse that:
   *              Revenue ↓ (debit), Accounts Receivable ↓ (credit).
   *   Paid   → a receivable was raised AND settled, so AR already nets to zero.
   *            What's left on the books is Revenue ↑ and Cash ↑, so reverse THAT:
   *              Revenue ↓ (debit), Business Cash ↓ (credit).
   *
   * Cancelling a paid invoice is allowed on purpose — otherwise a mistakenly
   * paid invoice could never be undone or removed.
   */
  fastify.post('/v1/invoices/:id/cancel', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const invoice = await repo.getById(request.businessId!, id);
      if (!invoice) return reply.status(404).send({ success: false, error: 'Invoice not found' });
      if (invoice.status === 'cancelled') {
        return reply.send({ success: true, data: invoice }); // already void — nothing to do
      }

      if (invoice.paymentEntryId) {
        // Paid: the receivable already cancelled itself out. Undo revenue + cash.
        await ledger.createEntry({
          businessId: request.businessId!,
          description: `Voided paid invoice ${invoice.number}`,
          sourceType: 'invoice_cancelled',
          sourceId: invoice.id,
          createdBy: request.user!.id,
          lines: [
            { code: 'REVENUE', debit: invoice.total, credit: 0 },
            { code: 'CASH', debit: 0, credit: invoice.total },
          ],
        });
      } else if (invoice.arEntryId) {
        // Sent but unpaid: undo the receivable.
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
