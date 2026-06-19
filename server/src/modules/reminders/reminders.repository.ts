import { Database } from '../../infrastructure/database';

export interface Reminder {
  id: string;
  text: string;
  remindAt: string | null;
  done: boolean;
}

export interface CreateReminderData {
  text: string;
  remindAt?: string | null;
}

export interface UpdateReminderData {
  text?: string;
  remindAt?: string | null;
  done?: boolean;
}

export class RemindersRepository {
  constructor(private database: Database) {}

  /** Idempotently create the reminders table. Safe to run on every boot. */
  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text VARCHAR(500) NOT NULL,
        remind_at TIMESTAMP WITH TIME ZONE,
        done BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await this.database.query(
      'CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id, remind_at)'
    );
  }

  async list(userId: string): Promise<Reminder[]> {
    const result = await this.database.query(
      `SELECT id, text, remind_at, done FROM reminders
       WHERE user_id = $1
       ORDER BY done ASC, remind_at ASC NULLS LAST, created_at DESC`,
      [userId]
    );
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async create(userId: string, data: CreateReminderData): Promise<Reminder> {
    const result = await this.database.query(
      `INSERT INTO reminders (user_id, text, remind_at, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id, text, remind_at, done`,
      [userId, data.text, data.remindAt ?? null]
    );
    return this.mapRow(result.rows[0]);
  }

  async update(userId: string, id: string, data: UpdateReminderData): Promise<Reminder | null> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.text !== undefined) { setClause.push(`text = $${paramIndex++}`); values.push(data.text); }
    if (data.remindAt !== undefined) { setClause.push(`remind_at = $${paramIndex++}`); values.push(data.remindAt); }
    if (data.done !== undefined) { setClause.push(`done = $${paramIndex++}`); values.push(data.done); }

    if (setClause.length === 0) {
      const existing = await this.database.query(
        'SELECT id, text, remind_at, done FROM reminders WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      return existing.rows[0] ? this.mapRow(existing.rows[0]) : null;
    }

    setClause.push('updated_at = NOW()');
    values.push(id, userId);

    const result = await this.database.query(
      `UPDATE reminders SET ${setClause.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING id, text, remind_at, done`,
      values
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.database.query(
      'DELETE FROM reminders WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: any): Reminder {
    return {
      id: row.id,
      text: row.text,
      remindAt: row.remind_at ? new Date(row.remind_at).toISOString() : null,
      done: row.done
    };
  }
}
