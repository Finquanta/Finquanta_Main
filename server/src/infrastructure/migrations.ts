import { PoolClient } from 'pg';
import { Database } from './database';

/**
 * A ledger of one-time migrations, so historical backfills stop re-running on
 * every deploy.
 *
 * THE PROBLEM THIS SOLVES. Boot calls ~20 `ensureSchema()` methods in sequence,
 * and several of them end in a backfill that rewrites history: stamp
 * `trial_used_at` from existing subscriptions, seed the grandfather window,
 * attach every pre-scoping row to a business. Each is guarded so that re-running
 * it changes nothing — but "changes nothing" is not "costs nothing". The guard
 * is a WHERE clause, so Postgres still has to scan the table to discover there
 * is nothing to do, on every single boot, forever.
 *
 * That cost grows with the size of the database rather than with the size of
 * the change, and it is already load-bearing: `server.ts` documents
 * `pluginTimeout` being raised from 10s to 30s to 120s chasing exactly this.
 * Nothing serves traffic until the migrations finish, so when they eventually
 * outrun the ceiling the deploy aborts and reads as an outage with no obvious
 * cause.
 *
 * A migration recorded here runs ONCE across the life of the database, and
 * every later boot pays a single indexed primary-key lookup instead.
 *
 * WHAT BELONGS HERE: a backfill that repairs history, where "already done" is
 * permanent. WHAT DOES NOT: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT
 * EXISTS`, `CREATE INDEX IF NOT EXISTS`. Those are cheap no-ops that also
 * reconcile a drifted database back to the schema the code expects, which is
 * worth doing on every boot — and a table someone dropped by hand should come
 * back, not be skipped because a ledger row says it once existed.
 */

/**
 * `CREATE TABLE IF NOT EXISTS` is idempotent but not free, and `runOnce` is
 * called from several repositories. Memoised per process so the DDL is issued
 * once per boot rather than once per migration.
 */
let ledgerReady: Promise<void> | null = null;

export function resetMigrationLedgerCache(): void {
  ledgerReady = null;
}

export async function ensureMigrationLedger(database: Database): Promise<void> {
  if (!ledgerReady) {
    ledgerReady = database
      .query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          key VARCHAR(120) PRIMARY KEY,
          applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `)
      .then(() => undefined)
      // A failed CREATE must not poison every later call with a rejected
      // promise that is never retried.
      .catch((error) => { ledgerReady = null; throw error; });
  }
  return ledgerReady;
}

/**
 * Run `work` if this migration has never been applied. Returns whether it ran.
 *
 * THE CLAIM AND THE WORK SHARE ONE TRANSACTION, and that is the whole point.
 * `work` is handed the transaction's client and MUST use it — running the
 * backfill on the pool instead would put it on a different connection, outside
 * the transaction, and reintroduce exactly the gap this closes.
 *
 * Marking the migration done before knowing it finished is the failure that
 * matters. An earlier version claimed the row first and deleted it in a `catch`
 * — which covers a backfill that THROWS, but not one that is KILLED. Render
 * evicts instances, deploys time out, containers run out of memory; none of
 * those run a `catch` block. The claim would survive, the data would be half
 * converted, and the migration would never be retried, because the ledger now
 * says it is done. That is strictly worse than having no ledger at all.
 *
 * Inside a transaction there is no such window. The INSERT is not visible to
 * anyone until COMMIT, and COMMIT only happens after `work` returns. A process
 * killed at any point simply loses the transaction, and the next boot finds the
 * migration unclaimed and runs it again.
 *
 * Concurrency: with two Render instances booting together, `ON CONFLICT DO
 * NOTHING` makes the second one BLOCK on the first one's uncommitted row rather
 * than skip past it. If the winner commits, the loser sees zero rows and does
 * nothing; if the winner dies, the loser claims it and runs. The wait only ever
 * happens on the single boot where a migration first runs — afterwards the row
 * is committed and the INSERT returns immediately without blocking.
 */
export async function runOnce(
  database: Database,
  key: string,
  work: (client: PoolClient) => Promise<void>
): Promise<boolean> {
  await ensureMigrationLedger(database);

  return database.transaction(async (client) => {
    const claim = await client.query(
      `INSERT INTO schema_migrations (key) VALUES ($1)
       ON CONFLICT (key) DO NOTHING
       RETURNING key`,
      [key]
    );
    if ((claim.rowCount ?? 0) === 0) return false;

    await work(client);
    return true;
  });
}
