import { COPY_PLAN, TableSpec } from './copy-plan';

/**
 * The row-level copy behind "Import my real books". Production runs the export
 * half, beta the import half; both read the same COPY_PLAN.
 *
 * Works from the live schema (information_schema) rather than a hand-written
 * column list, so a column added to production next month copies without
 * touching this file, and one beta does not have yet is simply left out.
 */

/** A database, a transaction client, or the test shim — the part used here. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }>;
}

export interface ScopeIds {
  business: string;
  owner: string;
}

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

/**
 * `:business` / `:owner` → positional parameters.
 *
 * Numbers only the names a scope actually uses: Postgres rejects a parameter
 * that is sent but never referenced, and cannot type one that is skipped.
 */
export function bindScope(sql: string, ids: ScopeIds): { text: string; params: string[] } {
  const params: string[] = [];
  const position = new Map<string, number>();
  const text = sql.replace(/:(business|owner)\b/g, (_match, name: 'business' | 'owner') => {
    if (!position.has(name)) {
      params.push(ids[name]);
      position.set(name, params.length);
    }
    return `$${position.get(name)}`;
  });
  return { text, params };
}

/** A table that belongs to a person, not the workspace. */
export const isPerUser = (spec: TableSpec): boolean => spec.scope.includes(':owner');

/**
 * Bytes survive JSON as `{ $bytes: base64 }`; everything else pg returns already
 * serialises. pg hands BYTEA back as a Buffer, PGlite as a plain Uint8Array —
 * Buffer is a Uint8Array, so one check covers both.
 */
export function encodeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value instanceof Uint8Array ? { $bytes: Buffer.from(value).toString('base64') } : value;
  }
  return out;
}

function toParam(value: unknown, dataType: string | undefined): unknown {
  if (value && typeof value === 'object' && '$bytes' in value) {
    return Buffer.from(String((value as { $bytes: unknown }).$bytes), 'base64');
  }
  if (value !== null && value !== undefined && (dataType === 'json' || dataType === 'jsonb')) {
    return JSON.stringify(value);
  }
  return value;
}

/** A table or column this database does not have (older schema, optional module). */
function isMissingRelation(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === '42P01' || code === '42703';
}

export async function exportPage(
  db: Queryable,
  spec: TableSpec,
  ids: ScopeIds,
  offset: number
): Promise<{ rows: Record<string, unknown>[]; done: boolean }> {
  const size = spec.pageSize ?? 200;
  const start = Math.max(0, Math.floor(Number.isFinite(offset) ? offset : 0));
  const { text, params } = bindScope(spec.scope, ids);
  try {
    // One extra row answers "is there another page?" without a COUNT.
    const result = await db.query(
      `SELECT * FROM ${quote(spec.table)} WHERE ${text} ORDER BY 1 LIMIT ${size + 1} OFFSET ${start}`,
      params
    );
    return { rows: result.rows.slice(0, size).map(encodeRow), done: result.rows.length <= size };
  } catch (error) {
    if (isMissingRelation(error)) return { rows: [], done: true };
    throw error;
  }
}

/** Does this stored-file key belong to the workspace being exported? */
export async function fileKeyBelongs(db: Queryable, ids: ScopeIds, key: string): Promise<boolean> {
  for (const spec of COPY_PLAN) {
    if (!spec.fileKeyColumn) continue;
    const { text, params } = bindScope(spec.scope, ids);
    try {
      const result = await db.query(
        `SELECT 1 FROM ${quote(spec.table)} WHERE (${text}) AND ${quote(spec.fileKeyColumn)} = $${params.length + 1} LIMIT 1`,
        [...params, key]
      );
      if (result.rows.length) return true;
    } catch (error) {
      if (!isMissingRelation(error)) throw error;
    }
  }
  return false;
}

/** column name → data type, for one table. Empty when the table does not exist. */
export async function columnTypes(db: Queryable, table: string): Promise<Map<string, string>> {
  const result = await db.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return new Map(result.rows.map((c: any) => [String(c.column_name), String(c.data_type)]));
}

/** Swap production's user ids for the importing beta user, and blank what must not cross. */
export function prepareRow(
  spec: TableSpec,
  row: Record<string, unknown>,
  importerId: string
): Record<string, unknown> {
  const out = { ...row };
  for (const column of spec.userColumns ?? []) if (column in out) out[column] = importerId;
  for (const column of spec.nullColumns ?? []) if (column in out) out[column] = null;
  return out;
}

/** Order rows so every parent precedes its children (self-referencing tables). */
export function parentsFirst(
  rows: Record<string, unknown>[],
  parentColumn: string
): Record<string, unknown>[] {
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  const placed = new Set<string>();
  const ordered: Record<string, unknown>[] = [];
  const visit = (row: Record<string, unknown>, depth: number) => {
    const id = String(row.id);
    if (placed.has(id) || depth > rows.length) return;
    const parent = row[parentColumn];
    const parentRow = parent == null ? undefined : byId.get(String(parent));
    if (parentRow) visit(parentRow, depth + 1);
    if (!placed.has(id)) {
      placed.add(id);
      ordered.push(row);
    }
  };
  for (const row of rows) visit(row, 0);
  return ordered;
}

export async function insertRows(
  db: Queryable,
  spec: TableSpec,
  rows: Record<string, unknown>[],
  types: Map<string, string>,
  onConflictDoNothing: boolean
): Promise<number> {
  if (!rows.length || !types.size) return 0;
  const ordered = spec.parentColumn ? parentsFirst(rows, spec.parentColumn) : rows;
  // Only columns beta has. A column production added since beta last deployed
  // is dropped rather than failing the whole copy.
  const columns = Object.keys(ordered[0]!).filter((column) => types.has(column));
  if (!columns.length) return 0;

  let written = 0;
  for (let i = 0; i < ordered.length; i += 50) {
    const slice = ordered.slice(i, i + 50);
    const params: unknown[] = [];
    const tuples = slice.map(
      (row) =>
        `(${columns
          .map((column) => {
            params.push(toParam(row[column], types.get(column)));
            return `$${params.length}`;
          })
          .join(', ')})`
    );
    const result = await db.query(
      `INSERT INTO ${quote(spec.table)} (${columns.map(quote).join(', ')})
       VALUES ${tuples.join(', ')}${onConflictDoNothing ? ' ON CONFLICT DO NOTHING' : ''}`,
      params
    );
    written += result.rowCount ?? slice.length;
  }
  return written;
}

/** Remove rows by id before re-copying a person's own rows (documents, plans). */
export async function deleteByIds(db: Queryable, table: string, ids: unknown[]): Promise<void> {
  if (!ids.length) return;
  await db.query(`DELETE FROM ${quote(table)} WHERE id = ANY($1::uuid[])`, [ids]);
}

/**
 * Wipe a previous beta copy of a workspace before refreshing it.
 *
 * Several workspace tables carry business_id without a foreign key (the
 * transactions, Brain), so deleting the business row alone would leave rows
 * whose ids collide with the fresh copy. Each table is cleared explicitly.
 *
 * Journal entries go first and ALL of them, bookkeeping included —
 * journal_lines.account_id is ON DELETE RESTRICT (see delete-business.ts).
 * A person's own rows are not touched here; they are replaced by id on insert.
 */
export async function purgeWorkspace(
  db: Queryable,
  businessId: string,
  typesOf: (table: string) => Promise<Map<string, string>>
): Promise<void> {
  await db.query('DELETE FROM journal_entries WHERE business_id = $1', [businessId]);
  for (const spec of [...COPY_PLAN].reverse()) {
    if (spec.table === 'businesses' || isPerUser(spec)) continue;
    if (!(await typesOf(spec.table)).size) continue;
    const { text, params } = bindScope(spec.scope, { business: businessId, owner: '' });
    await db.query(`DELETE FROM ${quote(spec.table)} WHERE ${text}`, params);
  }
  await db.query('DELETE FROM businesses WHERE id = $1', [businessId]);
}

/**
 * Write a fetched workspace into beta, inside the caller's transaction.
 *
 * `data` is every table's rows as production exported them. Returns what was
 * written and the stored-file keys the rows point at, which the caller copies
 * after the transaction commits.
 */
export async function writeWorkspaceCopy(
  tx: Queryable,
  data: Map<string, Record<string, unknown>[]>,
  businessId: string,
  importerId: string,
  refreshing: boolean
): Promise<{ counts: Record<string, number>; fileKeys: Set<string> }> {
  const typeCache = new Map<string, Map<string, string>>();
  const typesOf = async (table: string) => {
    if (!typeCache.has(table)) typeCache.set(table, await columnTypes(tx, table));
    return typeCache.get(table)!;
  };

  if (refreshing) await purgeWorkspace(tx, businessId, typesOf);

  const counts: Record<string, number> = {};
  const fileKeys = new Set<string>();

  for (const spec of COPY_PLAN) {
    const rows = (data.get(spec.table) ?? []).map((row) => prepareRow(spec, row, importerId));
    const types = await typesOf(spec.table);
    if (isPerUser(spec) && types.has('id')) {
      await deleteByIds(tx, spec.table, rows.map((row) => row.id).filter(Boolean));
    }
    counts[spec.table] = await insertRows(tx, spec, rows, types, isPerUser(spec));

    // The importer owns the copy. Right after the business row, before anything
    // that could look the workspace up by membership.
    if (spec.table === 'businesses' && counts[spec.table] && (await typesOf('business_members')).size) {
      await tx.query(
        `INSERT INTO business_members (business_id, user_id, role) VALUES ($1, $2, 'Owner')
         ON CONFLICT (business_id, user_id) DO UPDATE SET role = 'Owner'`,
        [businessId, importerId]
      );
    }

    if (spec.fileKeyColumn) {
      for (const row of rows) {
        const key = row[spec.fileKeyColumn];
        if (typeof key === 'string' && key) fileKeys.add(key);
      }
    }
  }

  return { counts, fileKeys };
}
