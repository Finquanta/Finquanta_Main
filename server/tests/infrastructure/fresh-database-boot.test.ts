import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import { PGlite } from '@electric-sql/pglite';

/**
 * The whole API booting against an EMPTY database.
 *
 * beta.finquanta.ai starts from a new, empty database, and the first attempt
 * could not boot: five modules still keep their original tables in schema.sql
 * files that nothing ran, so `users` did not exist and everything after it
 * failed. Production never noticed, because its tables were created by hand
 * years ago.
 *
 * This registers the real apiRoutes — every module, in its real order — against
 * PGlite instead of Neon, and fails if any module's setup logs an error.
 */

jest.mock('../../src/infrastructure/database', () => {
  // A statement without parameters may be a multi-statement script (the
  // schema.sql files); PGlite runs those through exec, pg through query.
  const run = async (target: any, text: string, params?: unknown[]) => {
    if (!params || params.length === 0) {
      const results = await target.exec(text);
      const last = results[results.length - 1];
      return { rows: last?.rows ?? [], rowCount: last?.affectedRows ?? last?.rows?.length ?? 0 };
    }
    const result = await target.query(text, params);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };
  return {
    Database: class {
      query(text: string, params?: unknown[]) {
        return run((global as any).__freshPg, text, params);
      }
      transaction(callback: (client: unknown) => Promise<unknown>) {
        return (global as any).__freshPg.transaction((tx: unknown) =>
          callback({ query: (text: string, params?: unknown[]) => run(tx, text, params) })
        );
      }
      async connect() { /* in-process */ }
      async disconnect() { /* in-process */ }
      isConnected() { return true; }
    },
  };
});

// uuid 13 ships ES modules only, which this jest setup cannot load; the app
// only uses v4, which Node's own crypto provides.
jest.mock('uuid', () => ({ v4: () => require('crypto').randomUUID() }));

// Imported after the mocks are registered (jest hoists jest.mock above imports).
import apiRoutes from '../../src/routes/api';
import { Database } from '../../src/infrastructure/database';
import { ensureBaseSchema } from '../../src/infrastructure/base-schema';

describe('booting the API on an empty database', () => {
  let app: FastifyInstance;
  let pg: PGlite;
  const logged: Array<{ level: number; msg: string; detail: string }> = [];

  beforeAll(async () => {
    pg = new PGlite();
    (global as any).__freshPg = pg;

    app = Fastify({
      pluginTimeout: 600_000,
      logger: {
        level: 'warn',
        stream: {
          write: (line: string) => {
            try {
              const entry = JSON.parse(line);
              const e = entry.error ?? entry.err ?? {};
              logged.push({ level: entry.level, msg: entry.msg, detail: e.message ?? e.code ?? '' });
            } catch {
              logged.push({ level: 50, msg: line, detail: '' });
            }
          },
        },
      },
    });
    await app.register(fastifyJwt, { secret: 'test-secret' });
    await app.register(fastifyRateLimit, { global: false });
    await app.register(fastifyMultipart);
    await app.register(apiRoutes, { prefix: '/api' });
    await app.ready();
  }, 900_000);

  afterAll(async () => {
    await app?.close();
    await pg?.close();
  });

  const exists = async (table: string) => {
    const r = await pg.query<{ t: string | null }>(`SELECT to_regclass('public.${table}')::text AS t`);
    return r.rows[0]?.t !== null;
  };

  it('sets up every module without a single error', () => {
    const errors = logged.filter((entry) => entry.level >= 50).map((entry) => `${entry.msg}: ${entry.detail}`);
    expect(errors).toEqual([]);
  });

  it('has the tables the product runs on', async () => {
    const tables = [
      // from the original schema.sql files
      'users', 'user_goals', 'financial_transactions', 'documents', 'business_plans', 'payroll_transactions',
      // from the modules' own ensureSchema
      'refresh_tokens', 'businesses', 'business_members', 'business_profiles', 'accounts', 'journal_entries',
      'journal_lines', 'customers', 'invoices', 'loans', 'financial_activity', 'groups', 'business_subscriptions',
      'brain_nodes', 'admin_audit_logs',
      // beta workspaces
      'beta_export_codes', 'beta_login_codes', 'beta_imports', 'beta_member_invites',
    ];
    const missing: string[] = [];
    for (const table of tables) if (!(await exists(table))) missing.push(table);
    expect(missing).toEqual([]);
  });

  it('accepts the owner role, which the original users table did not know', async () => {
    await expect(
      pg.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES ($1, 'x', 'O', 'W', 'owner')`,
        ['owner@example.com']
      )
    ).resolves.toBeDefined();
  });

  it('leaves an existing database alone on the next boot', async () => {
    // Re-running financial/schema.sql would fail on its trigger; this must not try.
    await expect(ensureBaseSchema(new Database())).resolves.toBe(false);
  });
});
