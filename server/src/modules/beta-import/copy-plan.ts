/**
 * What "Import my real books" copies from production into beta, in insert order.
 *
 * Rows keep their ORIGINAL ids. Every table here has a random UUID key, beta's
 * database is separate, and most links between rows have no foreign key
 * (journal_entries.source_id, invoices.ar_entry_id, loans.entry_id,
 * metadata.groupId, document_captures.destination_record_id) — keeping ids is
 * what keeps those links true without rewriting them one by one.
 *
 * Only user ids change: beta's accounts are different accounts.
 *
 * `scope` selects the workspace's rows: `:business` is the workspace id and
 * `:owner` the production owner's user id. A scope using `:owner` marks a table
 * that belongs to a PERSON rather than the workspace (documents, business
 * plans) — those copy only the owner's own rows.
 *
 * Deliberately absent: business_subscriptions (Stripe ids), billing_* tables,
 * inbound_* (addresses route real mail), referrals, refresh tokens, capture
 * handoff sessions, business_invites, audit logs, and every member but the
 * owner. Bookkeeping journal entries are skipped too — they are rebuilt from
 * transactions by resyncBookkeeping, and a copied one would be pruned or clash
 * with its unique index.
 */
export interface TableSpec {
  table: string;
  scope: string;
  /** User-id columns; each becomes the importing beta user. */
  userColumns?: readonly string[];
  /** Columns that must not carry production values onto beta. */
  nullColumns?: readonly string[];
  /** Column holding a stored-file key; the file is copied too. */
  fileKeyColumn?: string;
  /** Self-referencing parent column: rows are inserted parents first. */
  parentColumn?: string;
  /** Rows per export page. Lower for tables carrying file bytes. */
  pageSize?: number;
}

const NOT_BOOKKEEPING = `source_type IS DISTINCT FROM 'bookkeeping'`;

export const COPY_PLAN: readonly TableSpec[] = [
  { table: 'businesses', scope: 'id = :business', userColumns: ['owner_id'], nullColumns: ['previous_owner_id'] },
  { table: 'business_profiles', scope: 'business_id = :business', userColumns: ['user_id'] },
  { table: 'groups', scope: 'business_id = :business' },
  // Before any journal line: journal_lines.account_id is ON DELETE RESTRICT.
  { table: 'accounts', scope: 'business_id = :business' },
  { table: 'customers', scope: 'business_id = :business' },

  { table: 'financial_transactions', scope: 'business_id = :business', userColumns: ['user_id'] },
  {
    table: 'transaction_receipts',
    scope: 'transaction_id IN (SELECT id FROM financial_transactions WHERE business_id = :business)',
    userColumns: ['user_id'],
    pageSize: 20,
  },

  { table: 'invoices', scope: 'business_id = :business', userColumns: ['created_by'] },
  { table: 'invoice_items', scope: 'invoice_id IN (SELECT id FROM invoices WHERE business_id = :business)' },
  { table: 'loans', scope: 'business_id = :business', userColumns: ['created_by'] },
  { table: 'loan_payments', scope: 'loan_id IN (SELECT id FROM loans WHERE business_id = :business)' },

  { table: 'journal_entries', scope: `business_id = :business AND ${NOT_BOOKKEEPING}`, userColumns: ['created_by'] },
  {
    table: 'journal_lines',
    scope: `entry_id IN (SELECT id FROM journal_entries WHERE business_id = :business AND ${NOT_BOOKKEEPING})`,
  },

  { table: 'recurring_skips', scope: 'business_id = :business', userColumns: ['decided_by'] },
  { table: 'user_goals', scope: 'business_id = :business', userColumns: ['user_id'] },
  { table: 'financial_activity', scope: 'business_id = :business', userColumns: ['actor_id'] },

  { table: 'brain_categories', scope: 'business_id = :business', parentColumn: 'parent_category_id' },
  { table: 'brain_nodes', scope: 'business_id = :business', userColumns: ['created_by'] },
  { table: 'brain_edges', scope: 'business_id = :business' },
  { table: 'brain_settings', scope: 'business_id = :business' },
  { table: 'brain_link_dismissals', scope: 'business_id = :business' },
  // Per person inside the workspace: only the owner's own access row.
  { table: 'brain_access', scope: 'business_id = :business AND user_id = :owner', userColumns: ['user_id'] },
  { table: 'brain_advisor_profiles', scope: 'business_id = :business' },
  { table: 'brain_advisor_threads', scope: 'business_id = :business' },
  { table: 'brain_insight_state', scope: 'business_id = :business' },
  { table: 'council_sessions', scope: 'business_id = :business', userColumns: ['created_by'] },

  {
    table: 'document_captures',
    scope: 'business_id = :business',
    userColumns: ['captured_by'],
    // The inbound message is not copied: inbound addresses route real mail.
    nullColumns: ['inbound_message_id'],
    fileKeyColumn: 'storage_key',
  },

  // Belong to the person, not the workspace.
  { table: 'document_folders', scope: 'user_id = :owner', userColumns: ['user_id'], parentColumn: 'parent_id' },
  { table: 'documents', scope: 'user_id = :owner', userColumns: ['user_id'], fileKeyColumn: 'storage_key' },
  { table: 'business_plans', scope: 'user_id = :owner', userColumns: ['user_id'] },
  { table: 'business_plan_sections', scope: 'plan_id IN (SELECT id FROM business_plans WHERE user_id = :owner)' },
  { table: 'business_plan_milestones', scope: 'user_id = :owner', userColumns: ['user_id'] },
  { table: 'business_plan_financial_projections', scope: 'user_id = :owner', userColumns: ['user_id'] },
];

export const specFor = (table: string): TableSpec | undefined =>
  COPY_PLAN.find((spec) => spec.table === table);
