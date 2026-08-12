import { Database } from '../../infrastructure/database';

/**
 * Saved Finna chat conversations.
 *
 * Until now the widget kept its messages in React state only — closing it threw
 * the conversation away. That is fine for a one-off lookup and useless for
 * anything a user might want to return to.
 *
 * Scoped to (business_id, user_id), NOT business alone. A chat is personal in a
 * way the Company Brain is not: two colleagues sharing a workspace should not
 * read each other's questions to Finna. The business is still on the row so a
 * workspace switch shows the right history.
 */

export interface FinnaMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface FinnaConversation {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FinnaConversationDetail extends FinnaConversation {
  messages: FinnaMessage[];
}

/** Keeps one long-running chat from growing without bound. */
const MAX_MESSAGES = 200;

export class FinnaRepository {
  constructor(private readonly database: Database) {}

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS finna_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        messages JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await this.database.query(
      `CREATE INDEX IF NOT EXISTS idx_finna_conversations_owner
         ON finna_conversations(business_id, user_id, updated_at DESC)`
    );
  }

  private map(row: any): FinnaConversation {
    return {
      id: row.id,
      title: row.title,
      messageCount: Array.isArray(row.messages) ? row.messages.length : 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async list(businessId: string, userId: string, limit = 25): Promise<FinnaConversation[]> {
    const result = await this.database.query(
      `SELECT id, title, messages, created_at, updated_at
         FROM finna_conversations
        WHERE business_id = $1 AND user_id = $2
        ORDER BY updated_at DESC
        LIMIT $3`,
      [businessId, userId, limit]
    );
    return result.rows.map((r: any) => this.map(r));
  }

  async get(
    businessId: string,
    userId: string,
    id: string
  ): Promise<FinnaConversationDetail | null> {
    const result = await this.database.query(
      `SELECT * FROM finna_conversations
        WHERE business_id = $1 AND user_id = $2 AND id = $3`,
      [businessId, userId, id]
    );
    const row = result.rows[0];
    if (!row) return null;
    return { ...this.map(row), messages: Array.isArray(row.messages) ? row.messages : [] };
  }

  async create(businessId: string, userId: string, title: string): Promise<FinnaConversation> {
    const result = await this.database.query(
      `INSERT INTO finna_conversations (business_id, user_id, title)
            VALUES ($1, $2, $3)
         RETURNING *`,
      [businessId, userId, title.trim().slice(0, 200) || 'Untitled']
    );
    return this.map(result.rows[0]);
  }

  /**
   * Append and trim to the newest MAX_MESSAGES in one statement, so two open
   * tabs can't interleave into a lost update.
   */
  async append(
    businessId: string,
    userId: string,
    id: string,
    messages: FinnaMessage[]
  ): Promise<boolean> {
    const clean = messages
      .filter((m) => m && typeof m.content === 'string' && m.content.trim())
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content.slice(0, 8000),
      }));
    if (clean.length === 0) return true;

    const result = await this.database.query(
      `UPDATE finna_conversations
          SET messages = (
                -- WITH ORDINALITY + explicit ORDER BY: without them the row
                -- order out of jsonb_array_elements is incidental, not
                -- guaranteed, and a re-plan could silently scramble a
                -- transcript on the trim path.
                SELECT COALESCE(jsonb_agg(m ORDER BY ord), '[]'::jsonb) FROM (
                  SELECT m, ord
                    FROM jsonb_array_elements(messages || $4::jsonb)
                         WITH ORDINALITY AS t(m, ord)
                   ORDER BY ord
                   OFFSET GREATEST(jsonb_array_length(messages || $4::jsonb) - ${MAX_MESSAGES}, 0)
                ) trimmed
              ),
              updated_at = NOW()
        WHERE business_id = $1 AND user_id = $2 AND id = $3`,
      [businessId, userId, id, JSON.stringify(clean)]
    );
    // Reported so the route can 404 instead of telling the caller a message was
    // saved into a conversation that doesn't exist.
    return (result.rowCount ?? 0) > 0;
  }

  async rename(
    businessId: string,
    userId: string,
    id: string,
    title: string
  ): Promise<FinnaConversation | null> {
    const result = await this.database.query(
      `UPDATE finna_conversations SET title = $4, updated_at = NOW()
        WHERE business_id = $1 AND user_id = $2 AND id = $3
        RETURNING *`,
      [businessId, userId, id, title.trim().slice(0, 200) || 'Untitled']
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async remove(businessId: string, userId: string, id: string): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM finna_conversations
        WHERE business_id = $1 AND user_id = $2 AND id = $3`,
      [businessId, userId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
