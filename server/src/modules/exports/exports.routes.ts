import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { UsageService } from '../billing/usage.service';
import { ExportsRepository } from './exports.repository';
import {
  coverText, money2, safeFilename, toCsv, toTxt,
} from './exports.service';
import {
  EXPORT_FORMATS, ExportFormat, INVOICE_COLUMNS, INVOICE_TYPES, InvoiceType,
  LEDGER_COLUMNS, LedgerExportFilters, MAX_PDF_ROWS, PDF_ROWS_PER_PAGE,
  PREVIEW_ROWS,
} from './exports.types';

/**
 * Books Export — download the ledger or the invoice list as a real file.
 *
 * Nothing is stored: a few thousand rows of CSV or XLSX is sub-second, so the
 * file is generated and streamed on the request. No exports table, no job
 * queue, no blob store. When Export History arrives it can record the
 * PARAMETERS and re-run them, since a closed date range is deterministic.
 *
 * The quota is checked on preview but recorded only on download. Previewing
 * has to be free, or the two-step flow charges someone for checking their work.
 */
export async function exportsRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new ExportsRepository(options.database);
  const usage = new UsageService(options.database);
  const pre = [authenticate, withBusiness(options.database)];

  /** Repeated query keys (?groupId=a&groupId=b) arrive as string | string[]. */
  const many = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    if (typeof v === 'string' && v.length > 0) return [v];
    return [];
  };

  const isIsoDate = (v: unknown): v is string =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

  function readFilters(query: Record<string, unknown>): LedgerExportFilters {
    const start = isIsoDate(query.startDate) ? query.startDate : undefined;
    const end = isIsoDate(query.endDate) ? query.endDate : undefined;
    const types = many(query.type).filter((t): t is InvoiceType =>
      (INVOICE_TYPES as readonly string[]).includes(t));

    return {
      basis: query.basis === 'accrual' ? 'accrual' : 'cash',
      // Swapped dates would silently return nothing at all, which reads as "you
      // have no transactions" rather than "you asked for an impossible range".
      startDate: start && end && start > end ? end : start,
      endDate: start && end && start > end ? start : end,
      groupIds: many(query.groupId),
      invoiceTypes: types,
    };
  }

  /**
   * The two PDF refusals carry a message written for the person reading it, so
   * pass it straight through instead of flattening it to "could not build".
   */
  const pdfRefusal = (error: unknown): string | null => {
    const name = (error as { name?: string } | null)?.name;
    if (name === 'PdfTooLongError' || name === 'PdfUnsupportedTextError') {
      return (error as Error).message;
    }
    return null;
  };

  const quotaMessage = (limit: number | null) =>
    limit === 0
      ? 'Your plan does not include exports.'
      : `You've used all ${limit} export${limit === 1 ? '' : 's'} on your plan this month. They reset on the 1st.`;

  /** The allowance meter, so the modal can say "1 of 5 used" before anything is configured. */
  fastify.get('/v1/exports/usage', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await usage.check(request.businessId!, 'exports') });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load your export allowance.' });
    }
  }) as any);

  /**
   * What the file will contain, without producing it: the header block, the
   * column names and the first 100 rows. Free — nothing is recorded here.
   */
  fastify.get('/v1/exports/ledger/preview', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, unknown>;
      const filters = readFilters(query);

      // Checked, not charged. The paywall should appear BEFORE someone spends
      // time configuring an export they cannot have.
      const quota = await usage.check(request.businessId!, 'exports');
      if (!quota.allowed) {
        return reply.status(402).send({
          success: false, error: quotaMessage(quota.limit), data: { usage: quota },
        });
      }

      const [header, { rows, truncated }] = await Promise.all([
        repo.header(request.businessId!, request.user!.id, request.user!.email, filters),
        repo.ledgerRows(request.businessId!, filters),
      ]);

      return reply.send({
        success: true,
        data: {
          header,
          columns: LEDGER_COLUMNS,
          rows: rows.slice(0, PREVIEW_ROWS),
          totalRows: rows.length,
          estimatedPages: Math.max(1, Math.ceil(rows.length / PDF_ROWS_PER_PAGE)),
          pdfRowLimit: MAX_PDF_ROWS,
          truncated,
          usage: quota,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not build that preview.' });
    }
  }) as any);

  /** The ledger as a file. This is the call that spends an allowance. */
  fastify.get('/v1/exports/ledger', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, unknown>;
      const format = (EXPORT_FORMATS as readonly string[]).includes(String(query.format))
        ? (String(query.format) as ExportFormat)
        : 'csv';
      const filters = readFilters(query);

      const quota = await usage.check(request.businessId!, 'exports');
      if (!quota.allowed) {
        return reply.status(402).send({
          success: false, error: quotaMessage(quota.limit), data: { usage: quota },
        });
      }

      const header = await repo.header(
        request.businessId!, request.user!.id, request.user!.email, filters
      );
      const { rows } = await repo.ledgerRows(request.businessId!, filters);

      const table = rows.map((r) => [
        r.name, money2(r.amount), r.description, r.invoiceType, r.group, r.date,
      ]);

      const built = await buildLedgerFile(format, header, table, rows.length);
      if (!built) {
        return reply.status(400).send({ success: false, error: 'That format is not available yet.' });
      }

      // Recorded only once the bytes exist. A generation that threw must not
      // cost the customer one of their allowance.
      await usage.record(request.businessId!, 'exports', 1, request.user!.id);

      return reply
        .header('Content-Type', built.mime)
        .header('Content-Disposition', `attachment; filename="${built.filename}"`)
        .header('Cache-Control', 'no-store')
        .send(built.body);
    } catch (error) {
      // A PDF refused for its length, or for text Roboto cannot draw, is the
      // user's answer to change format — not a server fault. Nothing was
      // recorded, because `record` runs only after the bytes exist.
      const refusal = pdfRefusal(error);
      if (refusal) return reply.status(400).send({ success: false, error: refusal });
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not build that export.' });
    }
  }) as any);

  /** The invoice list — same two endpoints, narrower filters (date only). */
  fastify.get('/v1/exports/invoices/preview', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const filters = readFilters(request.query as Record<string, unknown>);
      const quota = await usage.check(request.businessId!, 'exports');
      if (!quota.allowed) {
        return reply.status(402).send({
          success: false, error: quotaMessage(quota.limit), data: { usage: quota },
        });
      }

      const [header, { rows, truncated }] = await Promise.all([
        repo.header(request.businessId!, request.user!.id, request.user!.email, filters),
        repo.invoiceRows(request.businessId!, filters),
      ]);

      return reply.send({
        success: true,
        data: {
          header,
          columns: INVOICE_COLUMNS,
          rows: rows.slice(0, PREVIEW_ROWS),
          totalRows: rows.length,
          truncated,
          usage: quota,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not build that preview.' });
    }
  }) as any);

  fastify.get('/v1/exports/invoices', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, unknown>;
      const format = (EXPORT_FORMATS as readonly string[]).includes(String(query.format))
        ? (String(query.format) as ExportFormat)
        : 'csv';
      const filters = readFilters(query);

      const quota = await usage.check(request.businessId!, 'exports');
      if (!quota.allowed) {
        return reply.status(402).send({
          success: false, error: quotaMessage(quota.limit), data: { usage: quota },
        });
      }

      const header = await repo.header(
        request.businessId!, request.user!.id, request.user!.email, filters
      );
      const { rows } = await repo.invoiceRows(request.businessId!, filters);

      const table = rows.map((r) => [
        r.number, r.customer, r.status, r.issueDate, r.dueDate, money2(r.total), r.currency,
      ]);

      const built = await buildFile(
        format, header, INVOICE_COLUMNS, table, rows.length, 'invoices'
      );
      if (!built) {
        return reply.status(400).send({ success: false, error: 'That format is not available yet.' });
      }

      await usage.record(request.businessId!, 'exports', 1, request.user!.id);

      return reply
        .header('Content-Type', built.mime)
        .header('Content-Disposition', `attachment; filename="${built.filename}"`)
        .header('Cache-Control', 'no-store')
        .send(built.body);
    } catch (error) {
      // A PDF refused for its length, or for text Roboto cannot draw, is the
      // user's answer to change format — not a server fault. Nothing was
      // recorded, because `record` runs only after the bytes exist.
      const refusal = pdfRefusal(error);
      if (refusal) return reply.status(400).send({ success: false, error: refusal });
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not build that export.' });
    }
  }) as any);

  const buildLedgerFile = (
    format: ExportFormat,
    header: Parameters<typeof coverText>[0],
    table: Array<Array<unknown>>,
    total: number
  ) => buildFile(format, header, LEDGER_COLUMNS, table, total, 'ledger');

  /**
   * Format dispatch. The heavy serialisers are imported lazily so the server
   * boots (and typechecks) without them — the same convention object-storage
   * uses for the S3 driver.
   */
  async function buildFile(
    format: ExportFormat,
    header: Parameters<typeof coverText>[0],
    columns: readonly string[],
    table: Array<Array<unknown>>,
    total: number,
    what: string
  ): Promise<{ body: Buffer; mime: string; filename: string } | null> {
    if (format === 'txt') {
      return {
        body: toTxt(header, columns, table),
        mime: 'text/plain; charset=utf-8',
        filename: safeFilename(header.businessName, what, 'txt'),
      };
    }

    if (format === 'csv') {
      // A zip, so the CSV itself stays importable. A header block inside the
      // CSV would break every importer, which defeats the point of offering it.
      const { zipCsv } = await import('./exports.archive');
      return {
        body: await zipCsv(`${what}.csv`, toCsv(columns, table), coverText(header, total)),
        mime: 'application/zip',
        filename: safeFilename(header.businessName, what, 'zip'),
      };
    }

    if (format === 'xlsx') {
      const { toXlsx } = await import('./exports.xlsx');
      return {
        body: await toXlsx(header, columns, table),
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: safeFilename(header.businessName, what, 'xlsx'),
      };
    }

    if (format === 'pdf') {
      const { toPdf } = await import('./exports.pdf');
      return {
        body: await toPdf(header, columns, table),
        mime: 'application/pdf',
        filename: safeFilename(header.businessName, what, 'pdf'),
      };
    }

    return null;
  }
}
