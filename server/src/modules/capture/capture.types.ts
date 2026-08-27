/**
 * Document Capture — shared shapes.
 *
 * Deliberately not limited to a fixed list of document types (spec §4): the
 * category set below is a starting point that keeps the review popup organised,
 * and `other` is a real answer rather than a fallback for things we forgot.
 */

export const CAPTURE_METHODS = ['photo', 'bulk_upload', 'qr_handoff', 'email'] as const;
export type CaptureMethod = (typeof CAPTURE_METHODS)[number];

export const DOCUMENT_TYPES = [
  'receipt',
  'vendor_bill',
  'customer_payment_proof',
  'loan_debt',
  'other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * Where a confirmed capture ends up in the books.
 *
 * `bill` and `receivable` are the two accrual sides — Accounts Payable and
 * Accounts Receivable. `ar_payment` is deliberately kept separate from
 * `receivable`: it means "a customer settled an invoice you already raised",
 * which is a different journal entry from raising one, and is not offered in
 * the popup yet.
 */
export const DESTINATIONS = [
  'expense', 'income', 'bill', 'receivable', 'ar_payment', 'loan', 'none',
] as const;
export type Destination = (typeof DESTINATIONS)[number];

export const CAPTURE_STATUSES = ['pending_review', 'confirmed', 'discarded'] as const;
export type CaptureStatus = (typeof CAPTURE_STATUSES)[number];

export interface ExtractedLineItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
}

/**
 * What the model read off the document. Every field is nullable: a blurry photo
 * should come back with blanks the user fills in, not with invented values that
 * look authoritative (spec §16).
 */
export interface ExtractedFields {
  vendor: string | null;
  documentDate: string | null; // YYYY-MM-DD
  total: number | null;
  taxAmount: number | null;
  currency: string | null;
  documentNumber: string | null;
  suggestedType: DocumentType | null;
  lineItems: ExtractedLineItem[];
}

/**
 * 0–1 per field, so the popup can flag what needs checking rather than treating
 * every field as equally trustworthy.
 */
export type ConfidenceScores = Partial<Record<keyof ExtractedFields, number>>;

/** Below this a field is visibly flagged in the review popup. */
export const LOW_CONFIDENCE = 0.7;

export interface DocumentCapture {
  id: string;
  businessId: string;
  capturedBy: string | null;
  captureMethod: CaptureMethod;
  storageKey: string;
  mimeType: string;
  originalFilename: string | null;
  documentType: DocumentType;
  extractedFields: ExtractedFields;
  confidenceScores: ConfidenceScores;
  destination: Destination | null;
  destinationRecordId: string | null;
  status: CaptureStatus;
  extractionError: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

export const isDocumentType = (v: unknown): v is DocumentType =>
  DOCUMENT_TYPES.includes(v as DocumentType);

export const emptyFields = (): ExtractedFields => ({
  vendor: null,
  documentDate: null,
  total: null,
  taxAmount: null,
  currency: null,
  documentNumber: null,
  suggestedType: null,
  lineItems: [],
});
