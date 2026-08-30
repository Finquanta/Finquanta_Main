import { PGlite } from '@electric-sql/pglite';
import { Database } from '../../src/infrastructure/database';

/**
 * A real Postgres, in-process, for testing the SQL itself.
 *
 * Everything else in this suite mocks the database, which is right for logic
 * but useless for queries: a hand-written mock that pattern-matches SQL strings
 * only ever proves the mock agrees with the mock. It cannot tell you that a
 * WHERE clause filters on the wrong column, that an ORDER BY sorts the wrong
 * way, or that a NUMERIC comes back as a string and breaks the mapping.
 *
 * PGlite is Postgres compiled to WebAssembly, so this is the real parser, the
 * real planner and the real types — no server to install, nothing to clean up,
 * and it works the same in CI. Each test gets its own empty database.
 *
 * Scope: the schema is built by the repositories' own `ensureSchema()`, so the
 * tables under test are exactly the ones the product creates. Only `users` and
 * `businesses` are stubbed, because they are foreign-key parents owned by other
 * modules and nothing here exercises them.
 */
export class TestDatabase {
  private constructor(private readonly pg: PGlite) {}

  static async create(): Promise<TestDatabase> {
    const db = new TestDatabase(new PGlite());
    await db.pg.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT
      );
      CREATE TABLE IF NOT EXISTS businesses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT
      );
    `);
    return db;
  }

  /** Insert a parent row and hand back its id. */
  async newBusiness(name = 'Test Co'): Promise<string> {
    const r = await this.pg.query<{ id: string }>(
      'INSERT INTO businesses (name) VALUES ($1) RETURNING id',
      [name]
    );
    return r.rows[0]!.id;
  }

  async newUser(email = 'someone@example.com'): Promise<string> {
    const r = await this.pg.query<{ id: string }>(
      'INSERT INTO users (email) VALUES ($1) RETURNING id',
      [email]
    );
    return r.rows[0]!.id;
  }

  /**
   * `pg` reports DML row counts as `rowCount`; PGlite calls it `affectedRows`.
   * Repositories read `rowCount` to decide whether a delete matched anything,
   * so the shim has to translate or `remove()` silently always returns false.
   */
  async query(text: string, params?: any[]): Promise<any> {
    const r = await this.pg.query(text, params);
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  }

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    return this.pg.transaction(async (tx) => {
      return callback({
        query: async (text: string, params?: any[]) => {
          const r = await tx.query(text, params);
          return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
        },
      });
    }) as Promise<T>;
  }

  /** Raw DDL, for a table a test needs to stand up itself. */
  async exec(sql: string): Promise<void> {
    await this.pg.exec(sql);
  }

  /** The repositories take a Database; this satisfies the part they use. */
  asDatabase(): Database {
    return this as unknown as Database;
  }

  /**
   * Empty every table the tests created, keeping the schema.
   *
   * Booting PGlite takes a few seconds, so building one per test turned a
   * five-second file into seventy. One instance per file with a truncate
   * between tests gives the same isolation for a fraction of the time.
   */
  async reset(): Promise<void> {
    const tables = await this.pg.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    const names = tables.rows.map((r) => `"${r.tablename}"`);
    if (names.length) await this.pg.exec(`TRUNCATE ${names.join(', ')} RESTART IDENTITY CASCADE`);
  }

  async close(): Promise<void> {
    await this.pg.close();
  }
}
