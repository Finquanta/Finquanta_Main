import { Pool, PoolClient, PoolConfig } from 'pg';
import { currentActor } from './request-context';

/** Host portion of a postgres URL, without leaking the credentials in it. */
function dbHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Stop `npm run dev` from operating on the production database.
 *
 * This is not hypothetical. `server/.env` pointed at the same Neon endpoint as
 * production, and because every module runs `ensureSchema()` on boot, simply
 * starting the dev server executed CREATE TABLE / ALTER TABLE against live
 * customer data. That is also how `businesses.status` came to exist in
 * production before it had ever been deployed.
 *
 * Two levels, because a blunt "no remote databases" rule would also reject a
 * perfectly good Neon dev branch:
 *
 *  - Naming PRODUCTION_DB_HOST makes this a hard stop. Point dev at that exact
 *    host and the server refuses to start.
 *  - Without it, a managed host in development only earns a warning, since we
 *    cannot tell a production endpoint from a dev branch on the same provider.
 *
 * Only ever runs when NODE_ENV is 'development'. Tests set 'test' and the
 * deployed server sets 'production', so neither is affected.
 */
function guardDevelopmentTarget(): void {
  if ((process.env.NODE_ENV || 'development') !== 'development') return;

  const host = dbHost(process.env.DATABASE_URL);
  if (!host) return;

  const prodHost = (process.env.PRODUCTION_DB_HOST || '').trim();
  if (prodHost && host === prodHost) {
    if (process.env.ALLOW_PROD_DB === '1') {
      console.warn(
        `\n  !!  Development server is connected to the PRODUCTION database (${host}).\n` +
        `      ALLOW_PROD_DB=1 is set, so this is permitted. Writes and schema\n` +
        `      changes here affect live customer data.\n`
      );
      return;
    }
    throw new Error(
      `Refusing to start: DATABASE_URL points at the production database (${host}) ` +
      `while NODE_ENV=development.\n` +
      `Booting runs ensureSchema(), so this would execute DDL against live data.\n` +
      `Fix by pointing DATABASE_URL at a dev database (a Neon branch works well), ` +
      `or set ALLOW_PROD_DB=1 if you genuinely mean to touch production.`
    );
  }

  const managed = /neon\.tech|supabase\.|amazonaws\.com|render\.com/i.test(host);
  if (managed) {
    console.warn(
      `\n  !!  Development server is using a hosted database: ${host}\n` +
      `      Booting runs ensureSchema(), which issues DDL. If this is the same\n` +
      `      database production uses, that DDL lands on live data.\n` +
      `      Set PRODUCTION_DB_HOST in server/.env to turn this into a hard stop.\n`
    );
  }
}

/**
 * Statements that can change rows: a plain write, or a WITH wrapping one. A
 * read-only WITH (reports use them) must not count — tagging it costs extra
 * round trips for an actor nothing reads.
 */
export const isWriteStatement = (text: string): boolean =>
  /^\s*(insert|update|delete)\b/i.test(text) ||
  (/^\s*with\b/i.test(text) && /\b(insert|update|delete)\b/i.test(text));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * BEGIN, tagged with who is making the changes, in one round trip where it can
 * be: a user id is a UUID, which is safe to inline, and a parameterless string
 * may carry two statements. Anything else falls back to a bound parameter.
 */
async function beginAs(client: PoolClient, actor: string | undefined): Promise<void> {
  if (!actor) {
    await client.query('BEGIN');
  } else if (UUID.test(actor)) {
    await client.query(`BEGIN; SELECT set_config('app.actor_id', '${actor}', true)`);
  } else {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.actor_id', $1, true)`, [actor]);
  }
}

export class Database {
  private pool: Pool | null = null;
  private connected = false;

  constructor(config?: PoolConfig) {
    // Default configuration for testing
    const defaultConfig: PoolConfig = {
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      // Neon serverless can cold-start slower than 2s; give connections room.
      connectionTimeoutMillis: 10000,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
    };

    // In the constructor, not connect(): nothing in the running server ever
    // calls connect() — it is only used by two test helpers, one of which is
    // commented out. Every query goes straight through the pool. Guarding
    // connect() would have looked right and never once fired.
    guardDevelopmentTarget();

    this.pool = new Pool(config || defaultConfig);
  }

  async connect(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    try {
      // Test the connection
      const client = await this.pool.connect();
      client.release();
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    /**
     * A write made while serving a signed-in request says who made it, so the
     * books history can show it. The trigger reads `app.actor_id`, which is
     * transaction-local, so the statement runs in a short transaction that sets
     * it first. Reads, and anything outside a request (boot, cron), go straight
     * through as before.
     */
    const actor = currentActor();
    if (actor && isWriteStatement(text)) {
      const client = await this.pool.connect();
      try {
        await beginAs(client, actor);
        const result = await client.query(text, params);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    const result = await this.pool.query(text, params);
    return result;
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const client = await this.pool.connect();

    try {
      // Same as query(): changes inside the transaction carry who made them.
      await beginAs(client, currentActor());
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}