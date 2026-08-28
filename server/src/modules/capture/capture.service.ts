import crypto from 'crypto';
import { CaptureRepository } from './capture.repository';
import { StorageDriver } from '../../infrastructure/object-storage';
import { extractDocument } from './capture.extraction';
import {
  CaptureMethod, ConfidenceScores, DocumentCapture, DocumentType, ExtractedFields,
} from './capture.types';

/**
 * Storing a document and reading it — the ONE path that does this.
 *
 * Lives here rather than inside `captureRoutes` because it now has three
 * callers, not one: a desktop upload, a photo sent from a phone over the QR
 * handoff, and an attachment that arrived by email. All three must produce an
 * identical capture. A second copy of this logic would be a second set of bugs
 * and, worse, a second set of rules about what reaches somebody's books.
 */

/** The abuse ceiling. Cost is spent at extraction, which the visible per-plan
 * cap does not govern, so this is the thing standing between a script and the
 * balance. */
const GLOBAL_DAILY_LIMIT = Number(process.env.CAPTURE_GLOBAL_DAILY_LIMIT || 500);

/**
 * Extraction attempts today, platform-wide. Separate from the plan quota.
 *
 * Module scope on purpose: this used to be a closure inside `captureRoutes`,
 * which meant each registration got its own counter. Now that email ingestion
 * is a second entry point, one shared ceiling is the only version that actually
 * bounds the spend.
 *
 * Still per-process, so it resets on deploy and each Render instance counts
 * separately — moving it into `billing_usage` keyed by workspace and day is the
 * known fix, and is worth doing before this is public.
 */
let extractionsToday = 0;
let extractionDay = new Date().toISOString().slice(0, 10);

export function underGlobalCeiling(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== extractionDay) {
    extractionDay = today;
    extractionsToday = 0;
  }
  return extractionsToday < GLOBAL_DAILY_LIMIT;
}

export interface IngestDeps {
  repo: CaptureRepository;
  storage: StorageDriver;
  /** Where a failed reading gets logged. The caller owns its own logger. */
  onError: (error: unknown) => void;
}

export interface IngestInput {
  businessId: string;
  /** Null for a document that arrived unattended — nobody was there to do it. */
  userId: string | null;
  captureMethod: CaptureMethod;
  buffer: Buffer;
  mimeType: string;
  filename: string | null;
  documentType: DocumentType;
}

/**
 * Store a document and read it.
 *
 * Never throws for a failed reading. The image is stored BEFORE extraction is
 * attempted, so a capture always exists to review by hand, and the error is
 * recorded on the row rather than returned as a failure. Refusing the whole
 * thing because the model had a bad day would leave the user worse off than the
 * manual entry they had before.
 */
export async function storeExtractedDocument(
  deps: Pick<IngestDeps, 'repo' | 'storage'>,
  input: Omit<IngestInput, 'documentType'> & {
    documentType: DocumentType;
    fields: ExtractedFields;
    confidence: ConfidenceScores;
  }
): Promise<DocumentCapture> {
  /**
   * A capture whose fields are ALREADY known — no AI call here.
   *
   * The email body path needs this: the reading happened over text, so by the
   * time we have something worth keeping the extraction is done. Running
   * `extractDocument` over a text blob would be a second charge for an answer
   * we already hold.
   */
  const storageKey = `captures/${input.businessId}/${crypto.randomUUID()}`;
  await deps.storage.put(storageKey, input.buffer, input.mimeType);

  const capture = await deps.repo.create({
    businessId: input.businessId,
    capturedBy: input.userId,
    captureMethod: input.captureMethod,
    storageKey,
    mimeType: input.mimeType,
    originalFilename: input.filename,
    documentType: input.documentType,
  });

  await deps.repo.saveExtraction(
    capture.id,
    input.businessId,
    input.fields,
    input.confidence,
    input.documentType
  );

  return {
    ...capture,
    extractedFields: input.fields,
    confidenceScores: input.confidence,
  };
}

export async function ingestDocument(
  deps: IngestDeps,
  input: IngestInput
): Promise<DocumentCapture> {
  const { repo, storage } = deps;
  const { businessId, userId, buffer, mimeType, documentType } = input;

  // Store first, so the document survives even if reading it fails.
  const storageKey = `captures/${businessId}/${crypto.randomUUID()}`;
  await storage.put(storageKey, buffer, mimeType);

  const capture = await repo.create({
    businessId,
    capturedBy: userId,
    captureMethod: input.captureMethod,
    storageKey,
    mimeType,
    originalFilename: input.filename,
    documentType,
  });

  if (!underGlobalCeiling()) {
    await repo.saveExtractionError(capture.id, businessId, 'Daily reading limit reached.');
    return { ...capture, extractionError: 'Too many documents read today. Enter this one by hand.' };
  }

  try {
    extractionsToday += 1;
    const result = await extractDocument(buffer, mimeType, documentType);
    await repo.saveExtraction(capture.id, businessId, result.fields, result.confidence, result.documentType);
    return {
      ...capture,
      documentType: result.documentType,
      extractedFields: result.fields,
      confidenceScores: result.confidence,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read that document.';
    deps.onError(error);
    await repo.saveExtractionError(capture.id, businessId, message);
    return { ...capture, extractionError: message };
  }
}

/**
 * How long a thrown-away document stays in the recycle bin.
 *
 * The bin exists because discarding is a one-click action taken on a small
 * preview, and being wrong about it should not be final. That argument has a
 * shelf life: nobody comes back for a receipt they binned two months ago, and
 * the blobs are the largest thing this feature stores.
 */
const PURGE_AFTER_DAYS = Number(process.env.CAPTURE_PURGE_AFTER_DAYS || 30);

/**
 * One sweep's worth. Bounded so a first run against a long-neglected bin does a
 * chunk and finishes, rather than holding a connection open against thousands
 * of blob deletes and timing out having committed nothing.
 */
const PURGE_BATCH = 200;

export interface PurgeResult {
  examined: number;
  blobsDeleted: number;
  rowsDeleted: number;
  blobFailures: number;
  olderThanDays: number;
}

/**
 * Empty the recycle bin of anything past its window.
 *
 * BLOB FIRST, THEN THE ROW, and the order is the whole reason this is not two
 * lines. The row is the only thing that knows the storage key, so deleting it
 * first turns a failed blob delete into a permanent leak — bytes on disk with
 * nothing left pointing at them. Doing it this way, a failed blob delete leaves
 * the row in place and the next sweep tries again.
 *
 * A blob that is already gone is a success, not a failure: the drivers treat a
 * missing key as a no-op, which is what makes re-running this safe.
 */
export async function purgeDiscardedCaptures(
  deps: { repo: CaptureRepository; storage: StorageDriver; onError?: (e: unknown) => void },
  options: { olderThanDays?: number; limit?: number } = {}
): Promise<PurgeResult> {
  const olderThanDays = options.olderThanDays ?? PURGE_AFTER_DAYS;
  const limit = options.limit ?? PURGE_BATCH;

  const candidates = await deps.repo.listPurgeable(olderThanDays, limit);
  const deletable: string[] = [];
  let blobsDeleted = 0;
  let blobFailures = 0;

  for (const candidate of candidates) {
    try {
      await deps.storage.delete(candidate.storageKey);
      blobsDeleted++;
      deletable.push(candidate.id);
    } catch (error) {
      // Keep the row. It is the only record of the key still to be freed.
      blobFailures++;
      deps.onError?.(error);
    }
  }

  const rowsDeleted = await deps.repo.deleteByIds(deletable);
  return {
    examined: candidates.length,
    blobsDeleted,
    rowsDeleted,
    blobFailures,
    olderThanDays,
  };
}
