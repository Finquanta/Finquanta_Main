import { Database } from '../../infrastructure/database';

export interface ReceiptFile {
  filename: string;
  mimeType: string;
  data: Buffer;
}

export class ReceiptRepository {
  constructor(private database: Database) {}

  /** Idempotently create the receipts table. Safe to run on every boot. */
  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS transaction_receipts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID NOT NULL UNIQUE REFERENCES financial_transactions(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        data BYTEA NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
  }

  /** Confirm a transaction belongs to the user before attaching a receipt. */
  async transactionBelongsToUser(transactionId: string, userId: string): Promise<boolean> {
    const result = await this.database.query(
      'SELECT 1 FROM financial_transactions WHERE id = $1 AND user_id = $2',
      [transactionId, userId]
    );
    return result.rows.length > 0;
  }

  async save(userId: string, transactionId: string, file: ReceiptFile): Promise<void> {
    await this.database.query(
      `INSERT INTO transaction_receipts (transaction_id, user_id, filename, mime_type, data, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (transaction_id) DO UPDATE SET
         filename = EXCLUDED.filename,
         mime_type = EXCLUDED.mime_type,
         data = EXCLUDED.data,
         created_at = NOW()`,
      [transactionId, userId, file.filename, file.mimeType, file.data]
    );
  }

  async get(userId: string, transactionId: string): Promise<ReceiptFile | null> {
    const result = await this.database.query(
      'SELECT filename, mime_type, data FROM transaction_receipts WHERE transaction_id = $1 AND user_id = $2',
      [transactionId, userId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return { filename: row.filename, mimeType: row.mime_type, data: row.data };
  }
}
