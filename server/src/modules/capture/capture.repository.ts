import { Database } from '../../infrastructure/database';
import {
  CaptureMethod, CaptureStatus, ConfidenceScores, Destination, DocumentCapture,
  DocumentType, ExtractedFields, emptyFields,
} from './capture.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Document captures — one row per photograph or scan a visitor puts in.
 *
 * Scoped to `business_id`, not `user_id`. A capture is workspace data like every
 * other financial record: whoever else is in the workspace should see the bill
 * that was scanned, and it must not vanish from the books when the person who
 * photographed it leaves. `captured_by` is ON DELETE SET NULL for the same
 * reason the billing attribution table is — the document still happened.
 */
export class CaptureRepository {
  constructor(private readonly database: Database) {}

  /**
   * Idempotent, run at boot alongside the other module schemas.
   *
   * ONE query, not one per statement. Boot already runs ~20 of these sequentially
   * against a remote Neon branch, and every extra round trip is latency nobody
   * is served during. Postgres executes a multi-statement simple query in a
   * single implicit transaction, so this is also all-or-nothing.
   */
  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS document_captures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        captured_by UUID REFERENCES users(id) ON DELETE SET NULL,
        capture_method VARCHAR(20) NOT NULL,
        storage_key TEXT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        original_filename VARCHAR(255),
        document_type VARCHAR(40) NOT NULL DEFAULT 'other',
        extracted_fields JSONB NOT NULL DEFAULT '{}',
        confidence_scores JSONB NOT NULL DEFAULT '{}',
        destination VARCHAR(30),
        destination_record_id UUID,
        status VARCHAR(20) NOT NULL DEFAULT 'pending_review',
        extraction_error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        confirmed_at TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_captures_business_status
        ON document_captures (business_id, status, created_at DESC);
    `);
  }

  async create(input: {
    businessId: string;
    /**
     * Null when nobody was there to do it — a document that arrived by email
     * has no user behind it. The column is already ON DELETE SET NULL for the
     * same reason: the document still happened.
     */
    capturedBy: string | null;
    captureMethod: CaptureMethod;
    storageKey: string;
    mimeType: string;
    originalFilename: string | null;
    documentType: DocumentType;
  }): Promise<DocumentCapture> {
    const r = await this.database.query(
      `INSERT INTO document_captures
         (business_id, captured_by, capture_method, storage_key, mime_type, original_filename, document_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.businessId, input.capturedBy, input.captureMethod, input.storageKey,
        input.mimeType, input.originalFilename, input.documentType,
      ]
    );
    return this.toCapture(r.rows[0]);
  }

  /** Store what the model read. Called once, right after extraction. */
  async saveExtraction(
    id: string,
    businessId: string,
    fields: ExtractedFields,
    confidence: ConfidenceScores,
    documentType: DocumentType
  ): Promise<void> {
    await this.database.query(
      `UPDATE document_captures
          SET extracted_fields = $1, confidence_scores = $2, document_type = $3, extraction_error = NULL
        WHERE id = $4 AND business_id = $5`,
      [JSON.stringify(fields), JSON.stringify(confidence), documentType, id, businessId]
    );
  }

  /**
   * Record that extraction failed, rather than leaving the row looking pending
   * forever. The user still gets the popup — with blank fields to type into.
   */
  async saveExtractionError(id: string, businessId: string, message: string): Promise<void> {
    await this.database.query(
      'UPDATE document_captures SET extraction_error = $1 WHERE id = $2 AND business_id = $3',
      [message.slice(0, 500), id, businessId]
    );
  }

  async findById(id: string, businessId: string): Promise<DocumentCapture | null> {
    const r = await this.database.query(
      'SELECT * FROM document_captures WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );
    return r.rows.length ? this.toCapture(r.rows[0]) : null;
  }

  /**
   * Documents that arrived by email and still need a human.
   *
   * Scoped to `email` rather than every pending capture: an upload or a phone
   * photo is reviewed on the spot, in the popup that opened with it. Only email
   * produces captures nobody is currently looking at, which is the whole reason
   * a queue exists.
   */
  async listPendingFromEmail(businessId: string): Promise<DocumentCapture[]> {
    const r = await this.database.query(
      `SELECT * FROM document_captures
        WHERE business_id = $1 AND status = 'pending_review' AND capture_method = 'email'
        ORDER BY created_at DESC
        LIMIT 100`,
      [businessId]
    );
    return r.rows.map((row: any) => this.toCapture(row));
  }

  /** Mark confirmed and point at whatever it became. */
  async markConfirmed(
    id: string,
    businessId: string,
    destination: Destination,
    destinationRecordId: string | null
  ): Promise<void> {
    await this.database.query(
      `UPDATE document_captures
          SET status = 'confirmed', destination = $1, destination_record_id = $2, confirmed_at = NOW()
        WHERE id = $3 AND business_id = $4`,
      [destination, destinationRecordId, id, businessId]
    );
  }

  async markDiscarded(id: string, businessId: string): Promise<void> {
    await this.database.query(
      `UPDATE document_captures SET status = 'discarded' WHERE id = $1 AND business_id = $2`,
      [id, businessId]
    );
  }

  /** For cleanup when a capture is discarded — the image goes with it. */
  async storageKeyFor(id: string, businessId: string): Promise<string | null> {
    const r = await this.database.query(
      'SELECT storage_key FROM document_captures WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );
    return r.rows[0]?.storage_key ?? null;
  }

  private toCapture(row: any): DocumentCapture {
    return {
      id: row.id,
      businessId: row.business_id,
      capturedBy: row.captured_by,
      captureMethod: row.capture_method,
      storageKey: row.storage_key,
      mimeType: row.mime_type,
      originalFilename: row.original_filename,
      documentType: row.document_type,
      // Postgres hands JSONB back parsed; the ?? guards a row written before a
      // field existed rather than a parse failure.
      extractedFields: { ...emptyFields(), ...(row.extracted_fields ?? {}) },
      confidenceScores: row.confidence_scores ?? {},
      destination: row.destination,
      destinationRecordId: row.destination_record_id,
      status: row.status as CaptureStatus,
      extractionError: row.extraction_error,
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at,
    };
  }
}
