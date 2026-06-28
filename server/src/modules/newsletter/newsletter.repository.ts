import { Database } from '../../infrastructure/database';

export class NewsletterRepository {
  constructor(private database: Database) {}

  /** Idempotently create the subscribers table. */
  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(320) NOT NULL UNIQUE,
        source VARCHAR(40) NOT NULL DEFAULT 'newsletter',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
  }

  /** Insert a subscriber. Returns true if newly added, false if already present. */
  async subscribe(email: string, source: string): Promise<boolean> {
    const result = await this.database.query(
      `INSERT INTO newsletter_subscribers (email, source) VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      [email, source]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
