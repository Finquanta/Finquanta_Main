import { Database } from '../../infrastructure/database';

/**
 * Business Groups — cost & profit centers.
 *
 * A group bundles the money in AND out for one area of the business (a
 * department, project, campaign, location or product) so the owner can see
 * whether that area pays for itself.
 *
 * Groups are organizational metadata ONLY. They never touch the double-entry
 * ledger: a grouped expense is still an expense. Assignment lives on the source
 * records (financial_transactions.metadata.groupId, invoices.group_id) and the
 * report resolves the group at read time by joining the ledger to its source —
 * so there's no denormalized column to drift when the ledger resyncs. This
 * mirrors how `currency` was added.
 */

export const GROUP_TYPES = ['department', 'project', 'campaign', 'location', 'product', 'other'] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

export interface Group {
  id: string;
  name: string;
  description: string | null;
  type: GroupType;
  color: string;
  status: 'active' | 'archived';
  createdAt: string;
}

export interface GroupItem {
  /** How to reassign it: cash entry, invoice, accrual ledger entry, or loan. */
  kind: 'bookkeeping' | 'invoice' | 'accrual' | 'loan';
  id: string;
  date: string | null;
  description: string;
  /** Positive = money in, negative = money out. */
  signedAmount: number;
  groupId: string | null;
}

export interface GroupReportRow {
  /** null = the Unassigned bucket. */
  groupId: string | null;
  name: string;
  color: string | null;
  inflow: number;
  outflow: number;
  net: number;
  entries: number;
}

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export class GroupsRepository {
  constructor(private database: Database) {}

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL,
        name VARCHAR(120) NOT NULL,
        description TEXT,
        type VARCHAR(20) NOT NULL DEFAULT 'other',
        color VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await this.database.query(
      `CREATE INDEX IF NOT EXISTS idx_groups_business ON groups(business_id)`
    );
  }

  private map(row: any): Group {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      type: row.type,
      color: row.color,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  async list(businessId: string, includeArchived = false): Promise<Group[]> {
    const result = await this.database.query(
      `SELECT id, name, description, type, color, status, created_at
       FROM groups
       WHERE business_id = $1::uuid ${includeArchived ? '' : `AND status = 'active'`}
       ORDER BY created_at ASC`,
      [businessId]
    );
    return (result.rows as any[]).map((r) => this.map(r));
  }

  async create(
    businessId: string,
    data: { name: string; description?: string | null; type?: GroupType; color?: string }
  ): Promise<Group> {
    const result = await this.database.query(
      `INSERT INTO groups (business_id, name, description, type, color)
       VALUES ($1::uuid, $2, $3, $4, $5)
       RETURNING id, name, description, type, color, status, created_at`,
      [businessId, data.name.trim(), data.description?.trim() || null, data.type ?? 'other', data.color ?? '#3b82f6']
    );
    return this.map(result.rows[0]);
  }

  async update(
    businessId: string,
    id: string,
    data: { name?: string; description?: string | null; type?: GroupType; color?: string; status?: 'active' | 'archived' }
  ): Promise<Group | null> {
    const result = await this.database.query(
      `UPDATE groups SET
         name = COALESCE($3, name),
         description = COALESCE($4, description),
         type = COALESCE($5, type),
         color = COALESCE($6, color),
         status = COALESCE($7, status),
         updated_at = NOW()
       WHERE business_id = $1::uuid AND id = $2::uuid
       RETURNING id, name, description, type, color, status, created_at`,
      [businessId, id, data.name?.trim() ?? null, data.description ?? null, data.type ?? null, data.color ?? null, data.status ?? null]
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  /**
   * Delete a group. Its entries and invoices are returned to Unassigned first
   * (their assignment is cleared) so nothing orphans or vanishes from reports.
   */
  async remove(businessId: string, id: string): Promise<boolean> {
    await this.database.query(
      `UPDATE financial_transactions
       SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('groupId', NULL::text)
       WHERE business_id = $1::uuid AND metadata->>'groupId' = $2`,
      [businessId, id]
    );
    await this.database.query(
      `UPDATE invoices SET group_id = NULL WHERE business_id = $1::uuid AND group_id = $2::uuid`,
      [businessId, id]
    );
    await this.database.query(
      `UPDATE journal_entries SET group_id = NULL WHERE business_id = $1::uuid AND group_id = $2::uuid`,
      [businessId, id]
    );
    await this.database.query(
      `UPDATE loans SET group_id = NULL WHERE business_id = $1::uuid AND group_id = $2::uuid`,
      [businessId, id]
    );
    const r = await this.database.query(
      `DELETE FROM groups WHERE business_id = $1::uuid AND id = $2::uuid`,
      [businessId, id]
    );
    return (r.rowCount ?? 0) > 0;
  }

  /**
   * The items assigned to a group (or the Unassigned bucket when groupId is
   * null) — the bookkeeping entries and invoices themselves, so the user can
   * see what's inside and move things between groups.
   */
  async getItems(businessId: string, groupId: string | null): Promise<GroupItem[]> {
    const bookkeeping = await this.database.query(
      `SELECT id, category, description, amount, type, date
       FROM financial_transactions
       WHERE business_id = $1::uuid AND status = 'completed' AND amount > 0
         AND ${groupId === null ? `(metadata->>'groupId') IS NULL` : `metadata->>'groupId' = $2`}
       ORDER BY date DESC`,
      groupId === null ? [businessId] : [businessId, groupId]
    );
    const invoices = await this.database.query(
      `SELECT i.id, i.number, i.total, i.issue_date, i.status, c.name AS customer_name
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.business_id = $1::uuid AND i.deleted_at IS NULL
         AND ${groupId === null ? 'i.group_id IS NULL' : 'i.group_id = $2::uuid'}
       ORDER BY i.issue_date DESC`,
      groupId === null ? [businessId] : [businessId, groupId]
    );
    // Accrual / manual ledger entries carry their group on the entry itself.
    // Only those touching a revenue or expense account are shown — a bare AR/AP
    // payment moves no profit, so it isn't a meaningful line in a group.
    const accrual = await this.database.query(
      `SELECT e.id, e.date, e.description,
              SUM(CASE WHEN a.type IN ('revenue','expense') THEN l.credit - l.debit ELSE 0 END) AS signed
       FROM journal_entries e
       JOIN journal_lines l ON l.entry_id = e.id
       JOIN accounts a ON a.id = l.account_id
       WHERE e.business_id = $1::uuid
         AND e.source_type NOT IN ('bookkeeping','invoice','invoice_payment','invoice_cancelled',
                                   'loan_received','loan_issued','loan_payment','loan_repayment_received')
         AND ${groupId === null ? 'e.group_id IS NULL' : 'e.group_id = $2::uuid'}
       GROUP BY e.id, e.date, e.description
       HAVING COUNT(*) FILTER (WHERE a.type IN ('revenue','expense')) > 0
       ORDER BY e.date DESC`,
      groupId === null ? [businessId] : [businessId, groupId]
    );
    // Loans: the item is the loan; its net contribution is the interest booked
    // against it (a cost for money borrowed, income for money lent out).
    const loans = await this.database.query(
      `SELECT ln.id, ln.name, ln.type, ln.start_date,
              COALESCE(SUM(lp.interest), 0) AS interest
       FROM loans ln
       LEFT JOIN loan_payments lp ON lp.loan_id = ln.id
       WHERE ln.business_id = $1::uuid
         AND ${groupId === null ? 'ln.group_id IS NULL' : 'ln.group_id = $2::uuid'}
       GROUP BY ln.id, ln.name, ln.type, ln.start_date
       ORDER BY ln.start_date DESC`,
      groupId === null ? [businessId] : [businessId, groupId]
    );

    const bk: GroupItem[] = (bookkeeping.rows as any[]).map((r) => ({
      kind: 'bookkeeping',
      id: r.id,
      date: r.date ? new Date(r.date).toISOString().slice(0, 10) : null,
      description: [r.category, r.description].filter(Boolean).join(' — ') || 'Bookkeeping entry',
      signedAmount: money((r.type === 'income' ? 1 : -1) * Number.parseFloat(r.amount ?? '0')),
      groupId,
    }));
    const inv: GroupItem[] = (invoices.rows as any[]).map((r) => ({
      kind: 'invoice',
      id: r.id,
      date: r.issue_date ? new Date(r.issue_date).toISOString().slice(0, 10) : null,
      description: `Invoice ${r.number}${r.customer_name ? ` — ${r.customer_name}` : ''}`,
      signedAmount: money(Number.parseFloat(r.total ?? '0')),
      groupId,
    }));
    const acc: GroupItem[] = (accrual.rows as any[]).map((r) => ({
      kind: 'accrual',
      id: r.id,
      date: r.date ? new Date(r.date).toISOString().slice(0, 10) : null,
      description: r.description || 'Accrual entry',
      signedAmount: money(Number.parseFloat(r.signed ?? '0')),
      groupId,
    }));
    const ln: GroupItem[] = (loans.rows as any[]).map((r) => ({
      kind: 'loan',
      id: r.id,
      date: r.start_date ? new Date(r.start_date).toISOString().slice(0, 10) : null,
      description: `Loan: ${r.name}`,
      // Interest is a cost on money borrowed (payable), income on money lent out.
      signedAmount: money((r.type === 'payable' ? -1 : 1) * Number.parseFloat(r.interest ?? '0')),
      groupId,
    }));

    return [...bk, ...inv, ...acc, ...ln].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }

  /**
   * Move a bookkeeping entry or invoice into a group (or out, when groupId is
   * null). For bookkeeping the group lives in the metadata JSONB, so we MERGE
   * rather than overwrite — otherwise recurrence/currency on that entry would be
   * wiped. Returns false if the item isn't the business's.
   */
  async assign(
    businessId: string,
    kind: 'bookkeeping' | 'invoice' | 'accrual' | 'loan',
    id: string,
    groupId: string | null
  ): Promise<boolean> {
    if (kind === 'invoice') {
      const r = await this.database.query(
        `UPDATE invoices SET group_id = $3::uuid, updated_at = NOW()
         WHERE business_id = $1::uuid AND id = $2::uuid`,
        [businessId, id, groupId]
      );
      return (r.rowCount ?? 0) > 0;
    }
    if (kind === 'accrual') {
      // Group lives on the journal entry itself for directly-posted entries.
      const r = await this.database.query(
        `UPDATE journal_entries SET group_id = $3::uuid
         WHERE business_id = $1::uuid AND id = $2::uuid`,
        [businessId, id, groupId]
      );
      return (r.rowCount ?? 0) > 0;
    }
    if (kind === 'loan') {
      const r = await this.database.query(
        `UPDATE loans SET group_id = $3::uuid WHERE business_id = $1::uuid AND id = $2::uuid`,
        [businessId, id, groupId]
      );
      return (r.rowCount ?? 0) > 0;
    }
    const r = await this.database.query(
      `UPDATE financial_transactions
       SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('groupId', $3::text),
           updated_at = NOW()
       WHERE business_id = $1::uuid AND id = $2::uuid`,
      [businessId, id, groupId]
    );
    return (r.rowCount ?? 0) > 0;
  }

  /**
   * Net contribution per group over a period, resolved from the ledger.
   *
   * Accrual basis (revenue when earned): the natural view for "did this area
   * make money?". Every group the business has is returned even with zero
   * activity, plus an Unassigned row for entries with no group — so nothing is
   * silently lost. Revenue is counted once: only the credit_revenue entry
   * carries revenue lines; an invoice's payment entry touches only CASH/AR.
   */
  async getGroupReport(businessId: string, startDate: string, endDate: string): Promise<GroupReportRow[]> {
    const result = await this.database.query(
      `WITH entry_group AS (
         SELECT
           e.id AS entry_id,
           -- Resolve the group from wherever it lives for that kind of entry:
           -- bookkeeping on the source txn's metadata, invoices on their column,
           -- then the journal entry's own group (accrual, or a loan PAYMENT the
           -- user grouped individually), and finally the loan's group (so a
           -- loan principal row and un-grouped payments inherit the loan).
           COALESCE(t.metadata->>'groupId', i.group_id::text, e.group_id::text, ln.group_id::text) AS group_id
         FROM journal_entries e
         LEFT JOIN financial_transactions t
                ON e.source_type = 'bookkeeping' AND t.id = e.source_id
         LEFT JOIN invoices i
                ON e.source_type IN ('invoice','invoice_payment','invoice_cancelled') AND i.id = e.source_id
         LEFT JOIN loans ln
                ON e.source_type IN ('loan_received','loan_issued','loan_payment','loan_repayment_received') AND ln.id = e.source_id
         WHERE e.business_id = $1::uuid
           AND e.date >= $2::date AND e.date <= $3::date
       ),
       totals AS (
         SELECT
           eg.group_id,
           COALESCE(SUM(CASE WHEN a.type = 'revenue' THEN l.credit - l.debit ELSE 0 END), 0) AS inflow,
           COALESCE(SUM(CASE WHEN a.type = 'expense' THEN l.debit - l.credit ELSE 0 END), 0) AS outflow,
           COUNT(DISTINCT eg.entry_id) AS entries
         FROM entry_group eg
         JOIN journal_lines l ON l.entry_id = eg.entry_id
         JOIN accounts a ON a.id = l.account_id
         GROUP BY eg.group_id
       )
       SELECT
         g.id::text AS group_id, g.name, g.color,
         COALESCE(tg.inflow, 0) AS inflow, COALESCE(tg.outflow, 0) AS outflow, COALESCE(tg.entries, 0) AS entries
       FROM groups g
       LEFT JOIN totals tg ON tg.group_id = g.id::text
       WHERE g.business_id = $1::uuid AND g.status = 'active'
       UNION ALL
       -- Always return the Unassigned bucket, even with nothing in it, so it's a
       -- constant fixture in the Groups tab.
       SELECT NULL::text AS group_id, 'Unassigned' AS name, NULL AS color,
              COALESCE((SELECT inflow FROM totals WHERE group_id IS NULL), 0) AS inflow,
              COALESCE((SELECT outflow FROM totals WHERE group_id IS NULL), 0) AS outflow,
              COALESCE((SELECT entries FROM totals WHERE group_id IS NULL), 0) AS entries`,
      [businessId, startDate, endDate]
    );

    return (result.rows as any[])
      .map((r) => {
        const inflow = money(Number.parseFloat(r.inflow ?? '0'));
        const outflow = money(Number.parseFloat(r.outflow ?? '0'));
        return {
          groupId: r.group_id ?? null,
          name: r.name,
          color: r.color ?? null,
          inflow,
          outflow,
          net: money(inflow - outflow),
          entries: Number.parseInt(r.entries ?? '0', 10),
        };
      })
      // Most valuable first: biggest net contribution, then biggest drain.
      .sort((a, b) => b.net - a.net);
  }
}
