import { HISTORY_TABLES } from './history.schema';

/**
 * Reading and undoing the books history. See history.schema.ts for what is
 * recorded.
 *
 * An undo writes the books back through the same tables, so it is itself
 * recorded (with `undo_of`) and can be undone in turn.
 */

export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }>;
}

export type Json = Record<string, unknown>;

export interface HistoryChange {
  id: string;
  table: string;
  rowId: string;
  op: 'I' | 'U' | 'D';
  before: Json | null;
  after: Json | null;
}

export interface HistoryGroup {
  txid: string;
  at: string;
  actor: { id: string; name: string; email: string } | null;
  /** This group undid the group with this txid. */
  undoOf: string | null;
  /** Undone by the group with this txid. */
  undoneBy: string | null;
  changes: HistoryChange[];
}

export class HistoryError extends Error {
  constructor(readonly status: number, readonly reason: 'not_found' | 'already_undone' | 'changed_since' | 'nothing' | 'too_many', message: string) {
    super(message);
  }
}

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

function groupRows(rows: any[]): HistoryGroup[] {
  const groups = new Map<string, HistoryGroup>();
  for (const row of rows) {
    const txid = String(row.txid);
    let group = groups.get(txid);
    if (!group) {
      const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
      group = {
        txid,
        at: new Date(row.created_at).toISOString(),
        actor: row.actor_id ? { id: String(row.actor_id), name: name || String(row.email ?? ''), email: String(row.email ?? '') } : null,
        undoOf: row.undo_of === null || row.undo_of === undefined ? null : String(row.undo_of),
        undoneBy: row.undone_by === null || row.undone_by === undefined ? null : String(row.undone_by),
        changes: [],
      };
      groups.set(txid, group);
    }
    group.changes.push({
      id: String(row.id),
      table: row.table_name,
      rowId: row.row_id,
      op: row.op,
      before: row.before,
      after: row.after,
    });
  }
  return [...groups.values()];
}

/**
 * Receipt files are recorded so undo can restore them, but never sent to the
 * browser — and stripped here, in SQL, so the bytes never leave the database:
 * a page of history with a few PDF receipts would otherwise be megabytes.
 * They sit on a receipt's own row, or under a deleted transaction's __children.
 */
const withoutReceiptBytes = (column: string) => `
  CASE
    WHEN h.table_name = 'transaction_receipts' THEN ${column} - 'data'
    WHEN ${column} #> '{__children,transaction_receipts}' IS NOT NULL THEN jsonb_set(
      ${column}, '{__children,transaction_receipts}',
      (SELECT COALESCE(jsonb_agg(r - 'data'), '[]'::jsonb)
         FROM jsonb_array_elements(${column} #> '{__children,transaction_receipts}') r))
    ELSE ${column}
  END`;

const GROUP_SELECT = `
  SELECT h.id, h.txid, h.table_name, h.row_id, h.op,
         ${withoutReceiptBytes('h.before')} AS before, ${withoutReceiptBytes('h.after')} AS after, h.actor_id,
         h.undo_of, h.undone_by, h.created_at, u.first_name, u.last_name, u.email
    FROM books_history h
    LEFT JOIN users u ON u.id = h.actor_id`;

/** Newest changes first, a page of groups at a time. `cursor` is the last page's `nextCursor`. */
export async function listHistory(
  db: Queryable,
  businessId: string,
  options: { cursor?: string | null; limit?: number } = {}
): Promise<{ groups: HistoryGroup[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
  const cursor = options.cursor && /^\d+$/.test(options.cursor) ? options.cursor : null;

  const page = await db.query(
    `SELECT txid, MAX(id) AS last_id FROM books_history
      WHERE business_id = $1
      GROUP BY txid
     HAVING ($2::bigint IS NULL OR MAX(id) < $2::bigint)
      ORDER BY MAX(id) DESC
      LIMIT $3`,
    [businessId, cursor, limit + 1]
  );
  const more = page.rows.length > limit;
  const chosen = page.rows.slice(0, limit);
  if (!chosen.length) return { groups: [], nextCursor: null };

  const rows = await db.query(
    `${GROUP_SELECT}
      WHERE h.business_id = $1 AND h.txid = ANY($2::bigint[])
      ORDER BY h.id ASC`,
    [businessId, chosen.map((r: any) => String(r.txid))]
  );
  const order = new Map(chosen.map((r: any, i: number) => [String(r.txid), i]));
  const groups = groupRows(rows.rows).sort((a, b) => (order.get(a.txid) ?? 0) - (order.get(b.txid) ?? 0));
  return { groups, nextCursor: more ? String(chosen[chosen.length - 1].last_id) : null };
}

/** Where "go back to" starts: a change (everything from it on) or a moment in time (everything after it). */
export type BackPoint = { txid: string } | { date: string };

/**
 * Most changes one go back may undo. It runs in a single transaction inside one
 * request, and its preview lists every change — past this, it would hold locks
 * until the request timed out. Further back means going back in steps.
 */
export const MAX_GO_BACK = 50;

/** The groups that going back to `point` would undo, newest first. */
export async function groupsAfter(db: Queryable, businessId: string, point: BackPoint): Promise<HistoryGroup[]> {
  let txids: string[];
  if ('txid' in point) {
    const start = await db.query(
      'SELECT MIN(id) AS first_id FROM books_history WHERE business_id = $1 AND txid = $2',
      [businessId, point.txid]
    );
    const firstId = start.rows[0]?.first_id;
    if (!firstId) throw new HistoryError(404, 'not_found', 'That change is not in this workspace’s history.');
    const r = await db.query(
      `SELECT txid FROM books_history WHERE business_id = $1
        GROUP BY txid HAVING MAX(id) >= $2 ORDER BY MAX(id) DESC LIMIT $3`,
      [businessId, firstId, MAX_GO_BACK + 1]
    );
    txids = r.rows.map((row: any) => String(row.txid));
  } else {
    const when = new Date(point.date);
    if (Number.isNaN(when.getTime())) throw new HistoryError(400, 'nothing', 'That date is not valid.');
    const r = await db.query(
      `SELECT txid FROM books_history WHERE business_id = $1
        GROUP BY txid HAVING MIN(created_at) > $2 ORDER BY MAX(id) DESC LIMIT $3`,
      [businessId, when.toISOString(), MAX_GO_BACK + 1]
    );
    txids = r.rows.map((row: any) => String(row.txid));
  }
  if (!txids.length) return [];
  if (txids.length > MAX_GO_BACK) {
    throw new HistoryError(
      422,
      'too_many',
      `That goes back past more than ${MAX_GO_BACK} changes. Pick a later point, or go back in steps.`
    );
  }

  const rows = await db.query(
    `${GROUP_SELECT} WHERE h.business_id = $1 AND h.txid = ANY($2::bigint[]) ORDER BY h.id ASC`,
    [businessId, txids]
  );
  const order = new Map(txids.map((t, i) => [t, i]));
  return groupRows(rows.rows).sort((a, b) => (order.get(a.txid) ?? 0) - (order.get(b.txid) ?? 0));
}

/**
 * A table's columns, looked up once per undo (`cache` lives as long as the
 * undo's transaction). Never process-wide: a column added after the first undo
 * would be left out of every later restore, silently.
 */
async function columnsOf(tx: Queryable, table: string, cache: Map<string, string[]>): Promise<string[]> {
  if (!cache.has(table)) {
    const r = await tx.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      [table]
    );
    cache.set(table, r.rows.map((c: any) => String(c.column_name)));
  }
  return cache.get(table)!;
}

/** Does the row still look exactly as this change left it? */
async function unchangedSince(tx: Queryable, table: string, rowId: string, expected: Json | null): Promise<boolean> {
  const t = quote(table);
  const r = await tx.query(
    `SELECT (to_jsonb(t) - 'updated_at') = ($2::jsonb - 'updated_at' - '__children') AS same
       FROM ${t} t WHERE id::text = $1`,
    [rowId, JSON.stringify(expected ?? {})]
  );
  return r.rows[0]?.same === true;
}

async function rowExists(tx: Queryable, table: string, rowId: string): Promise<boolean> {
  const r = await tx.query(`SELECT 1 FROM ${quote(table)} WHERE id::text = $1`, [rowId]);
  return r.rows.length > 0;
}

async function insertFromJson(tx: Queryable, table: string, row: Json): Promise<void> {
  const t = quote(table);
  const { __children: _children, ...plain } = row;
  await tx.query(`INSERT INTO ${t} SELECT * FROM jsonb_populate_record(NULL::${t}, $1::jsonb)`, [JSON.stringify(plain)]);
}

const CHANGED_SINCE =
  'Part of this change has been edited again since. Undo the later change first, or use Go back to.';

/**
 * Undo one change (every row of one recorded transaction), inside the caller's
 * transaction. With `strict`, refuses if anything it touched has changed since;
 * without it (go back to), an already-undone change is skipped instead.
 *
 * Returns false when the change was skipped.
 */
export async function undoGroup(
  tx: Queryable,
  businessId: string,
  txid: string,
  actorId: string | null,
  strict: boolean,
  columns: Map<string, string[]> = new Map()
): Promise<boolean> {
  const found = await tx.query(
    `SELECT id, table_name, row_id, op, before, after, undo_of, undone_by
       FROM books_history WHERE business_id = $1 AND txid = $2 ORDER BY id DESC`,
    [businessId, txid]
  );
  const rows = found.rows;
  if (!rows.length) throw new HistoryError(404, 'not_found', 'That change is not in this workspace’s history.');
  if (rows[0].undone_by !== null && rows[0].undone_by !== undefined) {
    if (strict) throw new HistoryError(409, 'already_undone', 'That change has already been undone.');
    return false;
  }

  if (actorId) await tx.query(`SELECT set_config('app.actor_id', $1, true)`, [actorId]);
  await tx.query(`SELECT set_config('app.undo_of', $1, true)`, [String(txid)]);

  /**
   * Three passes, each newest row first:
   *   1. put deleted rows back — an edit in the same change may point at them
   *      (deleting a customer blanks it on its invoices in the same statement,
   *      and restoring the invoice's link needs the customer to exist)
   *   2. revert edits
   *   3. remove added rows — once nothing edited in pass 2 still points at them
   */
  const ordered = [
    ...rows.filter((row: any) => row.op === 'D'),
    ...rows.filter((row: any) => row.op === 'U'),
    ...rows.filter((row: any) => row.op === 'I'),
  ];
  for (const row of ordered) {
    const table = String(row.table_name);
    if (!HISTORY_TABLES.has(table)) continue;
    const t = quote(table);

    if (row.op === 'I') {
      if (!(await unchangedSince(tx, table, row.row_id, row.after))) {
        if (strict || (await rowExists(tx, table, row.row_id))) {
          throw new HistoryError(409, 'changed_since', CHANGED_SINCE);
        }
        continue; // already gone
      }
      await tx.query(`DELETE FROM ${t} WHERE id::text = $1`, [row.row_id]);
    } else if (row.op === 'U') {
      if (!(await unchangedSince(tx, table, row.row_id, row.after))) {
        throw new HistoryError(409, 'changed_since', CHANGED_SINCE);
      }
      const set = (await columnsOf(tx, table, columns)).filter((c) => c !== 'id').map(quote).join(', ');
      const { __children: _children, ...before } = (row.before ?? {}) as Json;
      await tx.query(
        `UPDATE ${t} SET (${set}) = (SELECT ${set} FROM jsonb_populate_record(NULL::${t}, $1::jsonb))
          WHERE id::text = $2`,
        [JSON.stringify(before), row.row_id]
      );
    } else {
      if (await rowExists(tx, table, row.row_id)) {
        throw new HistoryError(409, 'changed_since', CHANGED_SINCE);
      }
      const before = (row.before ?? {}) as Json;
      await insertFromJson(tx, table, before);
      const children = (before.__children ?? {}) as Record<string, Json[]>;
      for (const [childTable, childRows] of Object.entries(children)) {
        if (!HISTORY_TABLES.has(childTable)) continue;
        for (const child of childRows) await insertFromJson(tx, childTable, child);
      }
    }
  }

  const self = await tx.query('SELECT txid_current()::text AS txid');
  const undoTxid = String(self.rows[0].txid);
  await tx.query('UPDATE books_history SET undone_by = $3 WHERE business_id = $1 AND txid = $2', [
    businessId,
    txid,
    undoTxid,
  ]);
  // Undoing an undo puts what it undid back: no longer undone. A go back undoes
  // many changes in one transaction, so its rows can point at several of them.
  const undid = [
    ...new Set(rows.filter((row: any) => row.undo_of !== null && row.undo_of !== undefined).map((row: any) => String(row.undo_of))),
  ];
  if (undid.length) {
    await tx.query('UPDATE books_history SET undone_by = NULL WHERE business_id = $1 AND txid = ANY($2::bigint[])', [
      businessId,
      undid,
    ]);
  }
  await tx.query(`SELECT set_config('app.undo_of', '', true)`);
  return true;
}

/** Undo every change from `point` on, newest first. Returns how many changes were undone. */
export async function undoAfter(
  tx: Queryable,
  businessId: string,
  point: BackPoint,
  actorId: string | null
): Promise<number> {
  const groups = await groupsAfter(tx, businessId, point);
  if (!groups.length) throw new HistoryError(400, 'nothing', 'There are no changes after that point.');
  let undone = 0;
  const columns = new Map<string, string[]>();
  for (const group of groups) {
    if (await undoGroup(tx, businessId, group.txid, actorId, false, columns)) undone++;
  }
  return undone;
}
