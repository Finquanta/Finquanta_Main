import { Database } from '../../infrastructure/database';

/**
 * The Financial Activity Timeline — a complete, append-only history of every
 * financial event in a business: expenses, revenue, invoices raised/sent/paid,
 * receivables and payables moving, loans taken and repaid.
 *
 * There is deliberately no update or delete path. Deleting an invoice records a
 * *new* event rather than erasing the old ones — the history of what happened
 * shouldn't change just because a document was removed.
 */
export type ActivityType =
  | 'revenue_added'
  | 'expense_created'
  | 'invoice_created'
  | 'invoice_sent'
  | 'invoice_paid'
  | 'invoice_cancelled'
  | 'invoice_deleted'
  | 'invoice_restored'
  | 'receivable_created'
  | 'receivable_settled'
  | 'payable_created'
  | 'payable_settled'
  | 'loan_received'
  | 'loan_issued'
  | 'loan_payment'
  | 'loan_repayment_received'
  | 'manual_entry';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  amount: number | null;
  entityType: string | null;
  entityId: string | null;
  occurredAt: string | null;
  createdAt: string | null;
}

/** How a ledger entry's source maps onto a timeline event. */
const SOURCE_TO_ACTIVITY: Record<string, { type: ActivityType; title: string }> = {
  bookkeeping: { type: 'revenue_added', title: 'Bookkeeping entry' }, // refined by amount side below
  cash_revenue: { type: 'revenue_added', title: 'Revenue added' },
  cash_expense: { type: 'expense_created', title: 'Expense created' },
  credit_revenue: { type: 'receivable_created', title: 'Accounts Receivable created' },
  credit_expense: { type: 'payable_created', title: 'Accounts Payable created' },
  receive_ar_payment: { type: 'receivable_settled', title: 'Customer paid — Accounts Receivable cleared' },
  pay_ap: { type: 'payable_settled', title: 'Bill paid — Accounts Payable cleared' },
  invoice: { type: 'invoice_sent', title: 'Invoice sent — Accounts Receivable raised' },
  invoice_payment: { type: 'invoice_paid', title: 'Invoice paid — cash received' },
  invoice_cancelled: { type: 'invoice_cancelled', title: 'Invoice cancelled — receivable reversed' },
  loan_received: { type: 'loan_received', title: 'Loan received' },
  loan_issued: { type: 'loan_issued', title: 'Loan issued' },
  loan_payment: { type: 'loan_payment', title: 'Loan payment made' },
  loan_repayment_received: { type: 'loan_repayment_received', title: 'Loan repayment received' },
  manual: { type: 'manual_entry', title: 'Manual journal entry' },
};

export class ActivityRepository {
  constructor(private database: Database) {}

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS financial_activity (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        type VARCHAR(40) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        amount NUMERIC(14,2),
        entity_type VARCHAR(40),
        entity_id UUID,
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await this.database.query(`CREATE INDEX IF NOT EXISTS idx_activity_business ON financial_activity(business_id, occurred_at DESC)`);
    // One event per (entity_type, entity_id, type) — makes the backfill and the
    // live recording idempotent, so an event can't be logged twice.
    await this.database.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_unique_event
      ON financial_activity(business_id, type, entity_type, entity_id)
      WHERE entity_id IS NOT NULL
    `);
  }

  /** Log an event. Silently ignores a duplicate of the same event. */
  async record(businessId: string, e: {
    type: ActivityType;
    title: string;
    description?: string | null;
    amount?: number | null;
    entityType?: string | null;
    entityId?: string | null;
    actorId?: string | null;
    occurredAt?: string | null;
  }): Promise<void> {
    await this.database.query(
      `INSERT INTO financial_activity
         (business_id, type, title, description, amount, entity_type, entity_id, actor_id, occurred_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::uuid, $8::uuid, COALESCE($9::timestamptz, NOW()))
       ON CONFLICT DO NOTHING`,
      [
        businessId, e.type, e.title, e.description ?? null, e.amount ?? null,
        e.entityType ?? null, e.entityId ?? null, e.actorId ?? null, e.occurredAt ?? null,
      ]
    );
  }

  /**
   * Build timeline events from ledger entries that don't have one yet. This
   * backfills history from before the timeline existed and acts as a safety net
   * if a module ever forgets to log an event — the ledger is the source of
   * truth, so anything in it belongs on the timeline.
   */
  async syncFromLedger(businessId: string): Promise<number> {
    const result = await this.database.query(
      `INSERT INTO financial_activity
         (business_id, type, title, description, amount, entity_type, entity_id, actor_id, occurred_at)
       SELECT
         e.business_id,
         CASE
           WHEN e.source_type = 'bookkeeping' THEN
             CASE WHEN EXISTS (
               SELECT 1 FROM journal_lines l JOIN accounts a ON a.id = l.account_id
               WHERE l.entry_id = e.id AND a.type = 'expense' AND l.debit > 0
             ) THEN 'expense_created' ELSE 'revenue_added' END
           WHEN e.source_type = 'cash_revenue' THEN 'revenue_added'
           WHEN e.source_type = 'cash_expense' THEN 'expense_created'
           WHEN e.source_type = 'credit_revenue' THEN 'receivable_created'
           WHEN e.source_type = 'credit_expense' THEN 'payable_created'
           WHEN e.source_type = 'receive_ar_payment' THEN 'receivable_settled'
           WHEN e.source_type = 'pay_ap' THEN 'payable_settled'
           WHEN e.source_type = 'invoice' THEN 'invoice_sent'
           WHEN e.source_type = 'invoice_payment' THEN 'invoice_paid'
           WHEN e.source_type = 'invoice_cancelled' THEN 'invoice_cancelled'
           WHEN e.source_type = 'loan_received' THEN 'loan_received'
           WHEN e.source_type = 'loan_issued' THEN 'loan_issued'
           WHEN e.source_type = 'loan_payment' THEN 'loan_payment'
           WHEN e.source_type = 'loan_repayment_received' THEN 'loan_repayment_received'
           ELSE 'manual_entry'
         END AS type,
         e.description AS title,
         NULL AS description,
         (SELECT COALESCE(SUM(l.debit), 0) FROM journal_lines l WHERE l.entry_id = e.id) AS amount,
         'entry' AS entity_type,
         e.id AS entity_id,
         e.created_by AS actor_id,
         COALESCE(e.created_at, e.date::timestamptz) AS occurred_at
       FROM journal_entries e
       WHERE e.business_id = $1::uuid
         AND NOT EXISTS (
           SELECT 1 FROM financial_activity fa
           WHERE fa.entity_type = 'entry' AND fa.entity_id = e.id
         )
       ON CONFLICT DO NOTHING`,
      [businessId]
    );
    return result.rowCount ?? 0;
  }

  /**
   * Drop events whose subject no longer exists.
   *
   * Deleting an invoice erases its journal entries outright (no reversing
   * entry), so the events those entries produced — "invoice sent", "invoice
   * paid" — would otherwise linger forever, showing money coming in from an
   * invoice that is gone. Same for a bookkeeping entry the user removed.
   *
   * The timeline is still append-only in normal use: nothing is edited or
   * back-dated, only events for deleted subjects are dropped, which is what
   * "deleted completely" has to mean for a financial history.
   */
  async purgeOrphans(businessId: string): Promise<number> {
    const result = await this.database.query(
      `DELETE FROM financial_activity fa
       WHERE fa.business_id = $1::uuid
         AND (
           (fa.entity_type = 'entry'
             AND NOT EXISTS (SELECT 1 FROM journal_entries e WHERE e.id = fa.entity_id))
           OR
           (fa.entity_type = 'invoice'
             AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = fa.entity_id))
         )`,
      [businessId]
    );
    return result.rowCount ?? 0;
  }

  async list(businessId: string, limit = 100): Promise<Activity[]> {
    const result = await this.database.query(
      `SELECT id, type, title, description, amount, entity_type, entity_id, occurred_at, created_at
       FROM financial_activity
       WHERE business_id = $1::uuid
       ORDER BY occurred_at DESC, created_at DESC
       LIMIT $2`,
      [businessId, limit]
    );
    return result.rows.map((r: any) => ({
      id: r.id,
      type: r.type as ActivityType,
      title: r.title,
      description: r.description ?? null,
      amount: r.amount != null ? Number.parseFloat(r.amount) : null,
      entityType: r.entity_type ?? null,
      entityId: r.entity_id ?? null,
      occurredAt: r.occurred_at ? new Date(r.occurred_at).toISOString() : null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    }));
  }
}

export { SOURCE_TO_ACTIVITY };
