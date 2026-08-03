import { Database } from '../../infrastructure/database';

/**
 * Daily counters for Finna (Claude) usage, so a single user or anonymous IP
 * can't run up unbounded Anthropic spend. One row per (key, day); `key` is
 * `user:<id>` for a signed-in caller or `ip:<address>` for an anonymous one.
 */
export class AiUsageRepository {
  constructor(private database: Database) {}

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS ai_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usage_key TEXT NOT NULL,
        day DATE NOT NULL DEFAULT CURRENT_DATE,
        count INT NOT NULL DEFAULT 0,
        UNIQUE (usage_key, day)
      );
    `);
    await this.database.query(`CREATE INDEX IF NOT EXISTS idx_ai_usage_key_day ON ai_usage(usage_key, day)`);
  }

  /** Atomically bump today's count for this key and return the new total. */
  async incrementAndGet(key: string): Promise<number> {
    const r = await this.database.query(
      `INSERT INTO ai_usage (usage_key, day, count)
       VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (usage_key, day) DO UPDATE SET count = ai_usage.count + 1
       RETURNING count`,
      [key]
    );
    return Number.parseInt(r.rows[0].count, 10);
  }
}
