import { Database } from '../../infrastructure/database';
import { AccountingRepository } from '../accounting/accounting.repository';
import {
  ExportHeader, INVOICE_TYPE_LABELS, InvoiceRow, InvoiceType, LedgerExportFilters,
  LedgerRow, MAX_ROWS, UNASSIGNED_GROUP,
} from './exports.types';

/** Data URIs we are willing to hand to the PDF renderer. */
const PDF_SAFE_IMAGE = /^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=\s]+$/;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** `2026-03-31` -> `31 Mar 2026`. Locale-free on purpose: the file is English. */
export function displayDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  const month = MONTHS[Number(m) - 1];
  if (!y || !month || !d) return iso.slice(0, 10);
  return `${Number(d)} ${month} ${y}`;
}

/**
 * The `Invoice Type` value for a ledger row.
 *
 * Loans are labelled from their own `sourceType`, because a loan is neither
 * income nor an expense: receiving principal is not revenue and repaying it is
 * not a cost, and a reader who saw "Income" against a loan would draw the
 * wrong conclusion about the business. Everything else falls back to
 * `direction`, which the ledger read has already derived from the cash/AR/AP
 * deltas.
 */
export function invoiceTypeOf(row: { sourceType: string; direction: string }): InvoiceType {
  switch (row.sourceType) {
    case 'loan_received': return 'loan_received';
    case 'loan_issued': return 'loan_issued';
    case 'loan_payment': return 'loan_payment';
    case 'loan_repayment_received': return 'loan_repaid';
    default: break;
  }
  switch (row.direction) {
    case 'in': return 'income';
    case 'out': return 'expense';
    case 'owed_to_you': return 'accounts_receivable';
    case 'you_owe': return 'accounts_payable';
    default: return 'income';
  }
}

export class ExportsRepository {
  private readonly accounting: AccountingRepository;

  constructor(private readonly database: Database) {
    this.accounting = new AccountingRepository(database);
  }

  /**
   * The identifying block at the top of every export.
   *
   * `business_profiles` is joined on `business_id`, never `user_id` — the table
   * still carries a `user_id` column but has one row per BUSINESS, and joining
   * on the user multiplies rows.
   */
  async header(
    businessId: string,
    userId: string,
    userEmail: string,
    filters: LedgerExportFilters
  ): Promise<ExportHeader> {
    const res = await this.database.query(
      `SELECT b.name AS fallback_name,
              p.business_name, p.business_phone, p.logo_url,
              p.registration_number, p.tax_number
         FROM businesses b
         LEFT JOIN business_profiles p ON p.business_id = b.id
        WHERE b.id = $1::uuid`,
      [businessId]
    );
    const row = (res.rows as any[])[0] ?? {};

    const who = await this.database.query(
      `SELECT first_name, last_name, email FROM users WHERE id = $1::uuid`,
      [userId]
    );
    const u = (who.rows as any[])[0];
    const fullName = u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : '';

    const logo = typeof row.logo_url === 'string' ? row.logo_url.trim() : '';

    return {
      businessName: (row.business_name || row.fallback_name || 'Business').trim(),
      businessPhone: nullIfBlank(row.business_phone),
      registrationNumber: nullIfBlank(row.registration_number),
      taxNumber: nullIfBlank(row.tax_number),
      exportedBy: fullName || u?.email || userEmail,
      exportedAt: displayDate(new Date().toISOString().slice(0, 10)),
      rangeLabel: rangeLabel(filters.startDate, filters.endDate),
      basisLabel: filters.basis === 'cash' ? 'Cash Basis' : 'Accrual',
      // Anything that is not plainly a PNG or JPEG data URI is dropped rather
      // than passed on. The column is TEXT and predates this use, so a
      // malformed value must cost a logo, not the whole export.
      logoDataUri: PDF_SAFE_IMAGE.test(logo) ? logo : null,
    };
  }

  /** id -> name, for the Group column. */
  async groupNames(businessId: string): Promise<Map<string, string>> {
    const res = await this.database.query(
      `SELECT id, name FROM groups WHERE business_id = $1::uuid`,
      [businessId]
    );
    return new Map((res.rows as any[]).map((r) => [r.id as string, r.name as string]));
  }

  /**
   * The ledger, filtered and shaped into export rows.
   *
   * Reuses `AccountingRepository.listTransactions`, which already derives the
   * hard parts — the cash/AR/AP deltas that decide direction, the cash-basis
   * EXISTS clause, and the group COALESCE across bookkeeping metadata, invoice,
   * entry and loan. Copying that SQL is where the bugs would be.
   *
   * Date bounds go to SQL (they bound the read); group and type filtering
   * happen here, because both are resolved in that method's JS mapping step.
   */
  async ledgerRows(
    businessId: string,
    filters: LedgerExportFilters
  ): Promise<{ rows: LedgerRow[]; truncated: boolean }> {
    // Every other ledger route resyncs first; without it a recently edited
    // entry is missing from the file.
    await this.accounting.resyncBookkeeping(businessId);

    const groups = await this.groupNames(businessId);

    // Read one past the cap so we can tell "exactly at the cap" from "more".
    const raw = await this.accounting.listTransactions(
      businessId,
      filters.basis,
      MAX_ROWS + 1,
      { startDate: filters.startDate, endDate: filters.endDate }
    );

    const truncated = raw.length > MAX_ROWS;
    const bounded = truncated ? raw.slice(0, MAX_ROWS) : raw;

    // Empty means "all". Forcing someone to tick eight boxes to export
    // everything would be hostile, and everything is the common case.
    const wantGroups = new Set(filters.groupIds ?? []);
    const wantTypes = new Set<InvoiceType>(filters.invoiceTypes ?? []);

    const rows: LedgerRow[] = [];
    for (const tx of bounded) {
      const type = invoiceTypeOf(tx);
      if (wantTypes.size > 0 && !wantTypes.has(type)) continue;

      if (wantGroups.size > 0) {
        const key = tx.groupId ?? UNASSIGNED_GROUP;
        if (!wantGroups.has(key)) continue;
      }

      rows.push({
        name: tx.description ?? '',
        amount: tx.signedAmount,
        description: tx.note ?? '',
        invoiceType: INVOICE_TYPE_LABELS[type],
        group: tx.groupId ? (groups.get(tx.groupId) ?? '') : '',
        date: displayDate(tx.date),
      });
    }

    return { rows, truncated };
  }

  /**
   * The invoice list. Filtered by `issue_date` here rather than by changing
   * `InvoicesRepository.list()`, which the invoice list page depends on.
   * `overdue` is derived at read time by that repository, so it arrives correct.
   */
  async invoiceRows(
    businessId: string,
    filters: Pick<LedgerExportFilters, 'startDate' | 'endDate'>
  ): Promise<{ rows: InvoiceRow[]; truncated: boolean }> {
    const params: unknown[] = [businessId];
    let where = '';
    if (filters.startDate) {
      params.push(filters.startDate);
      where += ` AND i.issue_date >= $${params.length}::date`;
    }
    if (filters.endDate) {
      params.push(filters.endDate);
      where += ` AND i.issue_date <= $${params.length}::date`;
    }
    params.push(MAX_ROWS + 1);

    const res = await this.database.query(
      `SELECT i.number, i.status, i.issue_date, i.due_date, i.total, i.currency,
              i.paid_at, c.name AS customer_name
         FROM invoices i
         LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.business_id = $1::uuid
          AND i.deleted_at IS NULL${where}
        ORDER BY i.issue_date DESC, i.number DESC
        LIMIT $${params.length}`,
      params
    );

    const all = res.rows as any[];
    const truncated = all.length > MAX_ROWS;
    const bounded = truncated ? all.slice(0, MAX_ROWS) : all;
    const today = new Date().toISOString().slice(0, 10);

    const rows = bounded.map((r) => ({
      number: r.number ?? '',
      customer: r.customer_name ?? '',
      // Overdue is never stored; it is "past due and not yet paid". Derived the
      // same way InvoicesRepository.withOverdue does, so the file agrees with
      // the invoice list on screen.
      status: deriveStatus(r.status, r.due_date, r.paid_at, today),
      issueDate: displayDate(r.issue_date ? toIso(r.issue_date) : null),
      dueDate: displayDate(r.due_date ? toIso(r.due_date) : null),
      total: Math.round((Number.parseFloat(r.total ?? '0') || 0) * 100) / 100,
      currency: r.currency ?? 'USD',
    }));

    return { rows, truncated };
  }
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function nullIfBlank(value: unknown): string | null {
  const s = typeof value === 'string' ? value.trim() : '';
  return s.length > 0 ? s : null;
}

function deriveStatus(
  status: string | null,
  dueDate: unknown,
  paidAt: unknown,
  today: string
): string {
  const base = (status ?? 'draft').toLowerCase();
  if (base === 'paid' || base === 'cancelled' || base === 'draft') return titleCase(base);
  if (!paidAt && dueDate && toIso(dueDate) < today) return 'Overdue';
  return titleCase(base);
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "1 Jan 2026 – 31 Mar 2026", or an open-ended equivalent. */
export function rangeLabel(start?: string, end?: string): string {
  if (start && end) return `${displayDate(start)} – ${displayDate(end)}`;
  if (start) return `From ${displayDate(start)}`;
  if (end) return `Up to ${displayDate(end)}`;
  return 'All time';
}
