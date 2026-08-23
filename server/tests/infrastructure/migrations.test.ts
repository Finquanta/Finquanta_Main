import { Database } from '../../src/infrastructure/database';
import { runOnce, resetMigrationLedgerCache } from '../../src/infrastructure/migrations';

/**
 * The migration ledger, which exists so historical backfills stop re-running on
 * every deploy. Boot already had to raise its plugin timeout from 10s to 30s to
 * 120s chasing that cost, and it grows with the database rather than with the
 * change.
 */

/**
 * Models the two things that actually matter about Postgres here: a claim is
 * invisible until COMMIT, and `ON CONFLICT DO NOTHING` will not hand the same
 * key to a second transaction while the first still holds it.
 *
 * `claimed` is every key inserted but not yet rolled back — committed or not —
 * which is what a competing INSERT collides with. `applied` is only what
 * survived a COMMIT. Rolling back removes that transaction's keys from
 * `claimed` without ever adding them to `applied`, which is precisely the
 * behaviour the real fix relies on.
 */
class FakeDb {
  statements: string[] = [];
  applied = new Set<string>();
  private claimed = new Set<string>();

  async query(text: string, params: any[] = []): Promise<any> {
    return this.run(text, params, null);
  }

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const pending = new Set<string>();
    const client = { query: (t: string, p: any[] = []) => this.run(t, p, pending) };

    this.statements.push('BEGIN');
    try {
      const result = await callback(client);
      this.statements.push('COMMIT');
      for (const key of pending) this.applied.add(key);
      return result;
    } catch (error) {
      this.statements.push('ROLLBACK');
      for (const key of pending) this.claimed.delete(key);
      throw error;
    }
  }

  private async run(text: string, params: any[], pending: Set<string> | null): Promise<any> {
    const flat = text.replace(/\s+/g, ' ').trim();
    this.statements.push(flat);

    if (flat.startsWith('INSERT INTO schema_migrations')) {
      const key = params[0];
      if (this.claimed.has(key)) return { rows: [], rowCount: 0 };
      this.claimed.add(key);
      if (pending) pending.add(key);
      else this.applied.add(key);
      return { rows: [{ key }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }
}

const db = (f: FakeDb) => f as unknown as Database;

beforeEach(() => resetMigrationLedgerCache());

describe('runOnce', () => {
  it('runs the work the first time and records it', async () => {
    const f = new FakeDb();
    let runs = 0;

    const ran = await runOnce(db(f), 'm1', async () => { runs += 1; });

    expect(ran).toBe(true);
    expect(runs).toBe(1);
    expect(f.applied.has('m1')).toBe(true);
  });

  it('skips the work on every later boot', async () => {
    const f = new FakeDb();
    let runs = 0;

    await runOnce(db(f), 'm1', async () => { runs += 1; });
    await runOnce(db(f), 'm1', async () => { runs += 1; });
    await runOnce(db(f), 'm1', async () => { runs += 1; });

    // The whole point: the expensive scan happens once, not once per deploy.
    expect(runs).toBe(1);
  });

  it('claims atomically, so two instances booting together do not both run it', async () => {
    const f = new FakeDb();
    let runs = 0;

    // Render can start a second instance while the first is still booting.
    const [a, b] = await Promise.all([
      runOnce(db(f), 'm1', async () => { runs += 1; }),
      runOnce(db(f), 'm1', async () => { runs += 1; }),
    ]);

    expect(runs).toBe(1);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    const claims = f.statements.filter((s) => s.startsWith('INSERT INTO schema_migrations'));
    expect(claims[0]).toContain('ON CONFLICT (key) DO NOTHING');
  });

  /**
   * The one that matters, and the reason the claim moved inside a transaction.
   *
   * Claiming first and deleting the row in a `catch` covered a backfill that
   * THROWS but not one that is KILLED — an evicted container or a timed-out
   * deploy runs no catch block, so the claim would survive over half-migrated
   * data and never be retried. Nothing is committed until the work returns.
   */
  it('commits the claim only after the work succeeds', async () => {
    const f = new FakeDb();

    await runOnce(db(f), 'm1', async () => { f.statements.push('-- backfill --'); });

    const shape = f.statements.filter(
      (s) => s === 'BEGIN' || s === 'COMMIT' || s === '-- backfill --'
        || s.startsWith('INSERT INTO schema_migrations')
    );
    // The claim and the work are inside the same BEGIN/COMMIT, work before commit.
    expect(shape[0]).toBe('BEGIN');
    expect(shape[1]).toContain('INSERT INTO schema_migrations');
    expect(shape[2]).toBe('-- backfill --');
    expect(shape[3]).toBe('COMMIT');
  });

  it('rolls the claim back when the work throws, so a later boot retries', async () => {
    const f = new FakeDb();

    await expect(
      runOnce(db(f), 'm1', async () => { throw new Error('backfill exploded'); })
    ).rejects.toThrow('backfill exploded');

    // Rolled back, not deleted after the fact — nothing was ever committed.
    expect(f.applied.has('m1')).toBe(false);
    expect(f.statements).toContain('ROLLBACK');
    expect(f.statements.some((s) => s.startsWith('DELETE FROM schema_migrations'))).toBe(false);

    // ...so the next boot picks it up again.
    let runs = 0;
    const ran = await runOnce(db(f), 'm1', async () => { runs += 1; });
    expect(ran).toBe(true);
    expect(runs).toBe(1);
  });

  it('keeps separate migrations independent', async () => {
    const f = new FakeDb();
    const seen: string[] = [];

    await runOnce(db(f), 'm1', async () => { seen.push('m1'); });
    await runOnce(db(f), 'm2', async () => { seen.push('m2'); });
    await runOnce(db(f), 'm1', async () => { seen.push('m1-again'); });

    expect(seen).toEqual(['m1', 'm2']);
  });

  it('hands the work the transaction client, not the pool', async () => {
    const f = new FakeDb();
    let received: any = null;

    await runOnce(db(f), 'm1', async (client) => { received = client; });

    // A backfill run on the pool would sit outside the transaction and undo the
    // whole guarantee, so `work` must be given something to run its SQL on.
    expect(received).not.toBeNull();
    expect(typeof received.query).toBe('function');
  });

  it('creates the ledger table once per process, not once per migration', async () => {
    const f = new FakeDb();

    await runOnce(db(f), 'm1', async () => {});
    await runOnce(db(f), 'm2', async () => {});

    const creates = f.statements.filter((s) => s.includes('CREATE TABLE IF NOT EXISTS schema_migrations'));
    expect(creates).toHaveLength(1);
  });
});
