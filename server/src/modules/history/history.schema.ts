import { Database } from '../../infrastructure/database';

/**
 * Books history: every change to a workspace's books, recorded by the database
 * itself.
 *
 * Triggers, not application code, because writes to the books come from many
 * places — repositories, route handlers, raw SQL in groups and loans, workspace
 * deletion. A trigger sees all of them. Who made a change comes from the
 * transaction-local `app.actor_id`, set by Database for signed-in requests;
 * without one it is recorded as nobody ("System").
 *
 * What is recorded
 *   - the original records: transactions, invoices, loans, customers, groups,
 *     and journal entries made by hand (accruals, manual, invoice and loan
 *     postings)
 *   - NOT bookkeeping journal entries: they are rebuilt from transactions on
 *     page loads, so recording them would flood the history and fight undo
 *   - child rows (invoice items, loan payments, receipts, journal lines) are
 *     recorded when changed on their own; when their parent is deleted, the
 *     parent's record carries them under `__children`, so one undo restores both
 *
 * A change in the UI is every row sharing one database transaction (txid).
 * `app.history_off = 'on'` suspends recording — used when deleting a whole
 * workspace or writing a beta copy, where a history of it is noise.
 *
 * The trigger functions have no EXCEPTION handler, on purpose. In PL/pgSQL each
 * one opens a subtransaction every time it runs — per row, so a 10,000-row
 * import made 10,000, and past 64 in one transaction Postgres slows every
 * concurrent reader. A failure to record history now fails the write instead:
 * loud, where swallowing it meant silently missing history.
 */

export interface TrackedTable {
  table: string;
  children: { table: string; fk: string }[];
}

export const TRACKED: readonly TrackedTable[] = [
  { table: 'financial_transactions', children: [{ table: 'transaction_receipts', fk: 'transaction_id' }] },
  { table: 'invoices', children: [{ table: 'invoice_items', fk: 'invoice_id' }] },
  { table: 'loans', children: [{ table: 'loan_payments', fk: 'loan_id' }] },
  { table: 'journal_entries', children: [{ table: 'journal_lines', fk: 'entry_id' }] },
  { table: 'customers', children: [] },
  { table: 'groups', children: [] },
];

export const CHILDREN: readonly { table: string; parent: string; fk: string }[] = TRACKED.flatMap((t) =>
  t.children.map((c) => ({ table: c.table, parent: t.table, fk: c.fk }))
);

/** Every table an undo is allowed to write. */
export const HISTORY_TABLES = new Set<string>([
  ...TRACKED.map((t) => t.table),
  ...CHILDREN.map((c) => c.table),
]);

const FUNCTIONS = `
CREATE OR REPLACE FUNCTION books_history_write(
  p_business UUID, p_table TEXT, p_row TEXT, p_op TEXT, p_before JSONB, p_after JSONB
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO books_history (business_id, table_name, row_id, op, before, after, txid, actor_id, undo_of)
  VALUES (
    p_business, p_table, p_row, p_op, p_before, p_after, txid_current(),
    NULLIF(current_setting('app.actor_id', true), '')::uuid,
    NULLIF(current_setting('app.undo_of', true), '')::bigint
  );
END $$;

-- Inserts and updates on any tracked table; deletes too on child tables.
-- TG_ARGV: parent table and the column pointing at it, or '' for top-level tables.
CREATE OR REPLACE FUNCTION books_history_row() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_row JSONB;
  new_row JSONB;
  cur JSONB;
  parent_table TEXT := NULLIF(TG_ARGV[0], '');
  parent_fk TEXT := NULLIF(TG_ARGV[1], '');
  biz UUID;
  parent_source TEXT;
BEGIN
  IF current_setting('app.history_off', true) = 'on' THEN RETURN NULL; END IF;
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
  cur := COALESCE(new_row, old_row);

  -- Touching nothing but updated_at is not a change anyone made.
  IF TG_OP = 'UPDATE' AND (old_row - 'updated_at') = (new_row - 'updated_at') THEN RETURN NULL; END IF;
  IF TG_TABLE_NAME = 'journal_entries' AND cur->>'source_type' = 'bookkeeping' THEN RETURN NULL; END IF;

  IF parent_table IS NULL THEN
    biz := (cur->>'business_id')::uuid;
  ELSE
    EXECUTE format(
      'SELECT business_id, %s FROM %I WHERE id = $1',
      CASE WHEN parent_table = 'journal_entries' THEN 'source_type' ELSE 'NULL::text' END,
      parent_table
    ) INTO biz, parent_source USING (cur->>parent_fk)::uuid;
    -- Parent already gone: this row is going with it, and the parent's own
    -- record holds it.
    IF biz IS NULL THEN RETURN NULL; END IF;
    IF parent_source = 'bookkeeping' THEN RETURN NULL; END IF;
  END IF;

  PERFORM books_history_write(biz, TG_TABLE_NAME, cur->>'id', left(TG_OP, 1), old_row, new_row);
  RETURN NULL;
END $$;

-- BEFORE DELETE on top-level tables: records the row with its children, while
-- the children still exist. TG_ARGV: pairs of child table, column pointing here.
CREATE OR REPLACE FUNCTION books_history_delete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_row JSONB := to_jsonb(OLD);
  children JSONB := '{}'::jsonb;
  child_rows JSONB;
  i INT := 0;
BEGIN
  IF current_setting('app.history_off', true) = 'on' THEN RETURN OLD; END IF;
  IF TG_TABLE_NAME = 'journal_entries' AND old_row->>'source_type' = 'bookkeeping' THEN RETURN OLD; END IF;

  WHILE i + 1 < TG_NARGS LOOP
    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(to_jsonb(c)), ''[]''::jsonb) FROM %I c WHERE %I = $1',
      TG_ARGV[i], TG_ARGV[i + 1]
    ) INTO child_rows USING (old_row->>'id')::uuid;
    IF jsonb_array_length(child_rows) > 0 THEN
      children := children || jsonb_build_object(TG_ARGV[i], child_rows);
    END IF;
    i := i + 2;
  END LOOP;
  IF children <> '{}'::jsonb THEN
    old_row := old_row || jsonb_build_object('__children', children);
  END IF;

  PERFORM books_history_write((old_row->>'business_id')::uuid, TG_TABLE_NAME, old_row->>'id', 'D', old_row, NULL);
  RETURN OLD;
END $$;
`;

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;

async function tableExists(database: Database, table: string): Promise<boolean> {
  const result = await database.query(`SELECT to_regclass($1) AS t`, [`public.${table}`]);
  return Boolean(result.rows[0]?.t);
}

/**
 * Create the history table, its functions and triggers. Idempotent: triggers
 * are dropped and re-created on every boot, so a change here takes effect on
 * the next deploy. Run after every tracked table exists.
 */
export async function ensureHistorySchema(database: Database): Promise<void> {
  await database.query(`
    CREATE TABLE IF NOT EXISTS books_history (
      id BIGSERIAL PRIMARY KEY,
      business_id UUID,
      table_name TEXT NOT NULL,
      row_id TEXT NOT NULL,
      op CHAR(1) NOT NULL CHECK (op IN ('I', 'U', 'D')),
      before JSONB,
      after JSONB,
      txid BIGINT NOT NULL,
      actor_id UUID,
      undo_of BIGINT,
      undone_by BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`CREATE INDEX IF NOT EXISTS idx_books_history_business ON books_history (business_id, id DESC)`);
  await database.query(`CREATE INDEX IF NOT EXISTS idx_books_history_txid ON books_history (business_id, txid)`);
  await database.query(FUNCTIONS);

  for (const tracked of TRACKED) {
    if (!(await tableExists(database, tracked.table))) continue;
    const t = quote(tracked.table);
    const childArgs = tracked.children.flatMap((c) => [literal(c.table), literal(c.fk)]).join(', ');
    await database.query(`DROP TRIGGER IF EXISTS books_history_iu ON ${t}`);
    await database.query(`DROP TRIGGER IF EXISTS books_history_d ON ${t}`);
    await database.query(
      `CREATE TRIGGER books_history_iu AFTER INSERT OR UPDATE ON ${t}
       FOR EACH ROW EXECUTE FUNCTION books_history_row('', '')`
    );
    await database.query(
      `CREATE TRIGGER books_history_d BEFORE DELETE ON ${t}
       FOR EACH ROW EXECUTE FUNCTION books_history_delete(${childArgs})`
    );
  }

  for (const child of CHILDREN) {
    if (!(await tableExists(database, child.table))) continue;
    const t = quote(child.table);
    await database.query(`DROP TRIGGER IF EXISTS books_history_row ON ${t}`);
    await database.query(
      `CREATE TRIGGER books_history_row AFTER INSERT OR UPDATE OR DELETE ON ${t}
       FOR EACH ROW EXECUTE FUNCTION books_history_row(${literal(child.parent)}, ${literal(child.fk)})`
    );
  }
}
