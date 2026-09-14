import fs from 'fs';
import path from 'path';
import { Database } from './database';

/**
 * The original tables, for a brand-new database.
 *
 * Five modules still define their tables in `schema.sql` files, from before
 * every module created its own tables in `ensureSchema()`. Production was built
 * from those files by hand long ago and nothing has run them since, so a fresh
 * database — beta.finquanta.ai's — could not boot: `users` did not exist, and
 * everything that references it failed after it.
 *
 * Runs only when `users` is missing, i.e. on an empty database. That is a hard
 * rule, not an optimisation: financial/schema.sql creates a trigger without IF
 * NOT EXISTS, so running it against an existing database would fail. Every
 * later column and constraint is added by the modules' own ensureSchema()
 * afterwards, exactly as on production.
 *
 * Order matters: users first, because the others reference it.
 */
const FILES = ['users', 'financial', 'documents', 'business-plans', 'payroll'];

/**
 * The .sql files are not compiled into dist/, so they are read from src/.
 * From src/infrastructure (ts-node) and dist/infrastructure (built) alike,
 * ../../src/modules is the same folder.
 */
const MODULES_DIR = path.resolve(__dirname, '../../src/modules');

export async function ensureBaseSchema(
  database: Database,
  // How to run a multi-statement script. pg's simple query does it; the test
  // database needs its own exec.
  runScript: (sql: string) => Promise<unknown> = (sql) => database.query(sql)
): Promise<boolean> {
  const existing = await database.query(`SELECT to_regclass('public.users') AS users`);
  if (existing.rows[0]?.users) return false;

  for (const name of FILES) {
    const file = path.join(MODULES_DIR, name, 'schema.sql');
    await runScript(fs.readFileSync(file, 'utf8'));
  }
  return true;
}
