import { Database } from '../../infrastructure/database';

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceItem {
  id?: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  issueDate: string | null;
  dueDate: string | null;
  message: string | null;
  details: string | null;
  paymentTerms: string | null;
  notes: string | null;
  taxRate: number;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  sentAt: string | null;
  paidAt: string | null;
  arEntryId: string | null;
  paymentEntryId: string | null;
  groupId: string | null;
  items: InvoiceItem[];
}

export interface InvoiceInput {
  customerId?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  message?: string | null;
  details?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  taxRate?: number;
  items?: InvoiceItem[];
  /** Business Group (cost/profit center) this invoice belongs to, if any. */
  groupId?: string | null;
}

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const iso = (v: any) => (v ? new Date(v).toISOString() : null);
const day = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : null);

/**
 * 'sent'/'viewed' invoices past their due date read as 'overdue'. This is
 * derived, never stored — so it can't drift out of date.
 */
function withOverdue(status: InvoiceStatus, dueDate: string | null): InvoiceStatus {
  if (status !== 'sent' && status !== 'viewed') return status;
  if (!dueDate) return status;
  return new Date(dueDate) < new Date(new Date().toISOString().slice(0, 10)) ? 'overdue' : status;
}

export class InvoicesRepository {
  constructor(private database: Database) {}

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
        number VARCHAR(40) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
        due_date DATE,
        message TEXT,
        details TEXT,
        payment_terms VARCHAR(120),
        notes TEXT,
        tax_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
        subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
        tax NUMERIC(14,2) NOT NULL DEFAULT 0,
        total NUMERIC(14,2) NOT NULL DEFAULT 0,
        currency VARCHAR(8) NOT NULL DEFAULT 'USD',
        sent_at TIMESTAMP WITH TIME ZONE,
        viewed_at TIMESTAMP WITH TIME ZONE,
        paid_at TIMESTAMP WITH TIME ZONE,
        ar_entry_id UUID,
        payment_entry_id UUID,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (business_id, number)
      );
    `);
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
        unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
        amount NUMERIC(14,2) NOT NULL DEFAULT 0,
        position INT NOT NULL DEFAULT 0
      );
    `);
    // Soft delete — deleted invoices go to the recycle bin, not the void.
    await this.database.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE`);
    // Business Groups (cost/profit centers) — organizational metadata only.
    await this.database.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS group_id UUID`);
    await this.database.query(`CREATE INDEX IF NOT EXISTS idx_invoices_business ON invoices(business_id, issue_date DESC)`);
    await this.database.query(`CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id, position)`);
  }

  /** Next sequential invoice number for a business, e.g. INV-0007. */
  async nextNumber(businessId: string): Promise<string> {
    const result = await this.database.query(
      `SELECT number FROM invoices WHERE business_id = $1 AND number ~ '^INV-[0-9]+$'
       ORDER BY (regexp_replace(number, '\\D', '', 'g'))::int DESC LIMIT 1`,
      [businessId]
    );
    const last = result.rows[0]?.number as string | undefined;
    const n = last ? Number.parseInt(last.replace(/\D/g, ''), 10) + 1 : 1;
    return `INV-${String(n).padStart(4, '0')}`;
  }

  /** Subtotal / tax / total from the line items. Pure arithmetic — no AI. */
  private totals(items: InvoiceItem[], taxRate: number) {
    const subtotal = money(items.reduce((s, it) => s + money((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)), 0));
    const tax = money(subtotal * ((Number(taxRate) || 0) / 100));
    return { subtotal, tax, total: money(subtotal + tax) };
  }

  private async replaceItems(client: any, invoiceId: string, items: InvoiceItem[]) {
    await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [invoiceId]);
    if (!items.length) return;
    await client.query(
      `INSERT INTO invoice_items (invoice_id, name, description, quantity, unit_price, amount, position)
       SELECT $1, x.name, x.description, x.quantity, x.unit_price, x.amount, x.position
       FROM UNNEST($2::text[], $3::text[], $4::numeric[], $5::numeric[], $6::numeric[], $7::int[])
         AS x(name, description, quantity, unit_price, amount, position)`,
      [
        invoiceId,
        items.map((i) => i.name),
        items.map((i) => i.description ?? null),
        items.map((i) => Number(i.quantity) || 0),
        items.map((i) => money(i.unitPrice)),
        items.map((i) => money((Number(i.quantity) || 0) * (Number(i.unitPrice) || 0))),
        items.map((_, idx) => idx),
      ]
    );
  }

  async create(businessId: string, createdBy: string, data: InvoiceInput): Promise<Invoice> {
    const items = data.items ?? [];
    const taxRate = Number(data.taxRate) || 0;
    const { subtotal, tax, total } = this.totals(items, taxRate);
    const number = await this.nextNumber(businessId);

    const id = await this.database.transaction(async (client) => {
      const res = await client.query(
        `INSERT INTO invoices (business_id, customer_id, number, status, issue_date, due_date,
           message, details, payment_terms, notes, tax_rate, subtotal, tax, total, created_by, group_id)
         VALUES ($1,$2,$3,'draft', COALESCE($4::date, CURRENT_DATE), $5, $6,$7,$8,$9,$10,$11,$12,$13,$14,$15::uuid)
         RETURNING id`,
        [
          businessId, data.customerId ?? null, number,
          data.issueDate ?? null, data.dueDate ?? null,
          data.message ?? null, data.details ?? null, data.paymentTerms ?? null, data.notes ?? null,
          taxRate, subtotal, tax, total, createdBy, data.groupId ?? null,
        ]
      );
      const invoiceId = res.rows[0].id as string;
      await this.replaceItems(client, invoiceId, items);
      return invoiceId;
    });

    return (await this.getById(businessId, id))!;
  }

  /** Update a draft. Totals are always recomputed from the items. */
  async update(businessId: string, id: string, data: InvoiceInput): Promise<Invoice | null> {
    const existing = await this.getById(businessId, id);
    if (!existing) return null;

    const items = data.items ?? existing.items;
    const taxRate = data.taxRate !== undefined ? Number(data.taxRate) || 0 : existing.taxRate;
    const { subtotal, tax, total } = this.totals(items, taxRate);

    await this.database.transaction(async (client) => {
      await client.query(
        `UPDATE invoices SET
           customer_id = COALESCE($3, customer_id),
           issue_date = COALESCE($4::date, issue_date),
           due_date = $5,
           message = $6, details = $7, payment_terms = $8, notes = $9,
           tax_rate = $10, subtotal = $11, tax = $12, total = $13, updated_at = NOW(),
           group_id = $14::uuid
         WHERE business_id = $1 AND id = $2`,
        [
          businessId, id,
          data.customerId ?? null,
          data.issueDate ?? null,
          data.dueDate !== undefined ? data.dueDate : existing.dueDate,
          data.message !== undefined ? data.message : existing.message,
          data.details !== undefined ? data.details : existing.details,
          data.paymentTerms !== undefined ? data.paymentTerms : existing.paymentTerms,
          data.notes !== undefined ? data.notes : existing.notes,
          taxRate, subtotal, tax, total,
          data.groupId !== undefined ? data.groupId : existing.groupId,
        ]
      );
      if (data.items) await this.replaceItems(client, id, data.items);
    });

    return this.getById(businessId, id);
  }

  async setStatus(
    businessId: string,
    id: string,
    status: InvoiceStatus,
    entries?: { arEntryId?: string | null; paymentEntryId?: string | null }
  ): Promise<void> {
    // Every placeholder is cast explicitly: $3 is used both as a value and
    // inside comparisons, and Postgres can't deduce a single type from that
    // ("inconsistent types deduced for parameter $3"). Same for the nullable
    // uuids, which have no type to infer from when they arrive as NULL.
    await this.database.query(
      `UPDATE invoices SET
         status = $3::varchar,
         sent_at = CASE WHEN $3::text IN ('sent','viewed') AND sent_at IS NULL THEN NOW() ELSE sent_at END,
         paid_at = CASE WHEN $3::text = 'paid' THEN NOW() ELSE paid_at END,
         ar_entry_id = COALESCE($4::uuid, ar_entry_id),
         payment_entry_id = COALESCE($5::uuid, payment_entry_id),
         updated_at = NOW()
       WHERE business_id = $1::uuid AND id = $2::uuid`,
      [businessId, id, status, entries?.arEntryId ?? null, entries?.paymentEntryId ?? null]
    );
  }

  /**
   * Forget the journal entries this invoice used to own.
   *
   * setStatus COALESCEs the entry ids, so it can never clear them — that's
   * deliberate there, but deleting an invoice erases its entries outright and
   * the links have to go with them, or the invoice would point at rows that no
   * longer exist.
   */
  async clearLedgerLinks(businessId: string, id: string): Promise<void> {
    await this.database.query(
      `UPDATE invoices SET ar_entry_id = NULL, payment_entry_id = NULL, updated_at = NOW()
       WHERE business_id = $1::uuid AND id = $2::uuid`,
      [businessId, id]
    );
  }

  async getById(businessId: string, id: string): Promise<Invoice | null> {
    const result = await this.database.query(
      `SELECT i.*, c.name AS customer_name, c.email AS customer_email
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.business_id = $1 AND i.id = $2`,
      [businessId, id]
    );
    const r = result.rows[0];
    if (!r) return null;

    const itemsRes = await this.database.query(
      `SELECT id, name, description, quantity, unit_price, amount
       FROM invoice_items WHERE invoice_id = $1 ORDER BY position ASC`,
      [id]
    );

    return this.mapRow(r, itemsRes.rows);
  }

  /** Active invoices (anything in the recycle bin is excluded). */
  async list(businessId: string): Promise<Invoice[]> {
    const result = await this.database.query(
      `SELECT i.*, c.name AS customer_name, c.email AS customer_email
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.business_id = $1 AND i.deleted_at IS NULL
       ORDER BY i.issue_date DESC, i.created_at DESC`,
      [businessId]
    );
    return result.rows.map((r: any) => this.mapRow(r, []));
  }

  /** The recycle bin — deleted invoices, most recently deleted first. */
  async listDeleted(businessId: string): Promise<Invoice[]> {
    const result = await this.database.query(
      `SELECT i.*, c.name AS customer_name, c.email AS customer_email
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.business_id = $1 AND i.deleted_at IS NOT NULL
       ORDER BY i.deleted_at DESC`,
      [businessId]
    );
    return result.rows.map((r: any) => this.mapRow(r, []));
  }

  /** Move to the recycle bin. Recoverable. */
  async softDelete(businessId: string, id: string): Promise<boolean> {
    const result = await this.database.query(
      'UPDATE invoices SET deleted_at = NOW(), updated_at = NOW() WHERE business_id = $1 AND id = $2 AND deleted_at IS NULL',
      [businessId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async restore(businessId: string, id: string): Promise<boolean> {
    const result = await this.database.query(
      'UPDATE invoices SET deleted_at = NULL, updated_at = NOW() WHERE business_id = $1 AND id = $2',
      [businessId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Gone for good. Only allowed from the recycle bin. */
  async remove(businessId: string, id: string): Promise<boolean> {
    const result = await this.database.query(
      'DELETE FROM invoices WHERE business_id = $1 AND id = $2',
      [businessId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Total unpaid (sent/viewed/overdue) per customer — drives outstanding balance. */
  async outstandingByCustomer(businessId: string): Promise<Map<string, number>> {
    const result = await this.database.query(
      `SELECT customer_id, COALESCE(SUM(total), 0) AS owed
       FROM invoices
       WHERE business_id = $1 AND customer_id IS NOT NULL
         AND deleted_at IS NULL
         AND status IN ('sent','viewed','overdue')
       GROUP BY customer_id`,
      [businessId]
    );
    return new Map(result.rows.map((r: any) => [r.customer_id as string, Number.parseFloat(r.owed ?? '0')]));
  }

  private mapRow(r: any, itemRows: any[]): Invoice {
    const dueDate = day(r.due_date);
    return {
      id: r.id,
      number: r.number,
      status: withOverdue(r.status as InvoiceStatus, dueDate),
      customerId: r.customer_id ?? null,
      customerName: r.customer_name ?? null,
      customerEmail: r.customer_email ?? null,
      issueDate: day(r.issue_date),
      dueDate,
      message: r.message ?? null,
      details: r.details ?? null,
      paymentTerms: r.payment_terms ?? null,
      notes: r.notes ?? null,
      taxRate: Number.parseFloat(r.tax_rate ?? '0'),
      subtotal: Number.parseFloat(r.subtotal ?? '0'),
      tax: Number.parseFloat(r.tax ?? '0'),
      total: Number.parseFloat(r.total ?? '0'),
      currency: r.currency ?? 'USD',
      sentAt: iso(r.sent_at),
      paidAt: iso(r.paid_at),
      arEntryId: r.ar_entry_id ?? null,
      paymentEntryId: r.payment_entry_id ?? null,
      groupId: r.group_id ?? null,
      items: itemRows.map((it: any) => ({
        id: it.id,
        name: it.name,
        description: it.description ?? null,
        quantity: Number.parseFloat(it.quantity ?? '0'),
        unitPrice: Number.parseFloat(it.unit_price ?? '0'),
        amount: Number.parseFloat(it.amount ?? '0'),
      })),
    };
  }
}
