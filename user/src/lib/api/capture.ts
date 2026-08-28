import { apiFetch, PaymentRequiredError, serverApiUrl } from './client';

/**
 * Document Capture — photograph or upload a financial document and get a
 * pre-filled entry to review.
 *
 * Image preparation happens HERE, in the browser, not on the server:
 *   - HEIC (what an iPhone photo library hands over) is not accepted by the
 *     Messages API, and converting it server-side would mean sharp built
 *     against libheif, which is fragile on Render.
 *   - Downscaling a 12MP photo before upload cuts both the upload and the
 *     image-token cost, and a canvas does it for free.
 * Both avoid adding a server dependency, which this codebase deliberately
 * avoids (see the note in council.service.ts).
 */

export const DOCUMENT_TYPES = [
  'receipt', 'vendor_bill', 'customer_payment_proof', 'loan_debt', 'other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type Destination =
  | 'expense' | 'income' | 'bill' | 'receivable' | 'ar_payment' | 'loan' | 'none';

export interface ExtractedLineItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
}

export interface ExtractedFields {
  vendor: string | null;
  documentDate: string | null;
  total: number | null;
  taxAmount: number | null;
  currency: string | null;
  documentNumber: string | null;
  suggestedType: DocumentType | null;
  lineItems: ExtractedLineItem[];
}

export type ConfidenceScores = Partial<Record<keyof ExtractedFields, number>>;

/** Below this a field is flagged in the popup as worth re-reading. */
export const LOW_CONFIDENCE = 0.7;

export interface DocumentCapture {
  id: string;
  documentType: DocumentType;
  mimeType: string;
  originalFilename: string | null;
  extractedFields: ExtractedFields;
  confidenceScores: ConfidenceScores;
  extractionError: string | null;
  status: 'pending_review' | 'confirmed' | 'discarded';
  /**
   * When the capture was made — for email, when it landed.
   *
   * The server has always sent this; the type simply never declared it, so it
   * could not be shown. Distinct from `extractedFields.documentDate`, which is
   * the date printed ON the document and is often a different day entirely.
   */
  createdAt: string;
}

export interface ScanAllowance {
  allowed: boolean;
  used: number;
  /** null means unlimited. */
  limit: number | null;
  remaining: number | null;
  period: string;
}

/** The server's own ceiling. Anything bigger is refused before it is sent. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Longest edge after downscaling. Plenty for reading a receipt; far cheaper
 * than sending the original. */
const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

/** Multipart requests bypass apiFetch, so they carry these by hand — the same
 * pair uploadReceipt sends in transactions.ts. */
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    const businessId = localStorage.getItem('activeBusinessId');
    if (token) headers.Authorization = `Bearer ${token}`;
    if (businessId) headers['X-Business-Id'] = businessId;
  }
  return headers;
}

export const getScanAllowance = () => apiFetch<ScanAllowance>('/v1/captures/usage');

const isHeic = (file: File) =>
  /\.hei[cf]$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif';

/** The server's list, mirrored: what we may send WITHOUT converting first. */
const SERVER_ACCEPTS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

/** Can this file go up untouched if preparing it fails? */
const sendableAsIs = (file: File) =>
  SERVER_ACCEPTS.includes(file.type) && file.size <= MAX_UPLOAD_BYTES;

/** An <img> holding the file, plus the cleanup that frees it. */
async function loadImageElement(
  file: File
): Promise<{ img: HTMLImageElement; release: () => void }> {
  const url = URL.createObjectURL(file);
  const release = () => URL.revokeObjectURL(url);
  try {
    const img = new Image();
    img.src = url;
    // `decode()` is iOS 15.4+; onload works everywhere and is the fallback.
    if (typeof img.decode === 'function') {
      await img.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('image failed to load'));
      });
    }
    return { img, release };
  } catch (e) {
    release();
    throw e;
  }
}

/**
 * Convert and shrink an image so the API will take it.
 *
 * THE PHONE IS THE HARD CASE, and the first version of this got it wrong.
 * `createImageBitmap(file)` decodes at FULL resolution: a 48-megapixel photo
 * from a modern phone is roughly 190MB of RGBA before a canvas is even
 * allocated, which is how an Android browser ends up refusing with a memory
 * error. Worse, that failure used to abort the whole upload — a photo that
 * would have uploaded perfectly well was rejected because we tried to be
 * clever about shrinking it first.
 *
 * So this is a ladder, and every rung falls through rather than throwing:
 *
 *   1. Resize DURING decode, so the browser never holds the full-size bitmap.
 *      Needs `createImageBitmap` resize options — Chrome and recent Safari.
 *   2. Draw from an <img> instead. No `createImageBitmap` at all, which is
 *      what iOS before 15 has, and mobile browsers may downsample an <img>
 *      while decoding it rather than materialising every pixel.
 *   3. Send the original. Most phone JPEGs are 2-5MB, comfortably under the
 *      10MB ceiling, so shrinking is an optimisation — not a precondition.
 *
 * Only a file the server would refuse outright (a HEIC we could not convert)
 * actually fails, and then it says what to do about it.
 */
export async function prepareForUpload(file: File): Promise<File> {
  if (file.type === 'application/pdf') return file;

  const heic = isHeic(file);
  let release = () => {};

  try {
    const { img, release: releaseImg } = await loadImageElement(file);
    release = releaseImg;

    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) throw new Error('no dimensions');

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    // Already small, already a type the server takes: nothing to do.
    // Re-encoding would only lose detail off a receipt somebody has to read.
    if (scale === 1 && !heic && file.size <= MAX_UPLOAD_BYTES) return file;

    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    // Rung 1 — decode straight to the target size where that is supported.
    let bitmap: ImageBitmap | null = null;
    if (scale < 1 && typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(file, {
          resizeWidth: targetW,
          resizeHeight: targetH,
          resizeQuality: 'medium',
        });
      } catch { /* no resize options here — rung 2 draws from the <img> */ }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');

    // One call for both rungs: a pre-resized bitmap is drawn 1:1, an <img> is
    // scaled on the way in. iOS caps canvas area around 16M pixels and the
    // target here is at most ~5M, so this stays well inside it.
    ctx.drawImage(bitmap ?? img, 0, 0, targetW, targetH);
    bitmap?.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    );
    // Free the backing store now rather than waiting for collection — on a
    // phone this is the largest thing we allocated.
    canvas.width = 0;
    canvas.height = 0;
    if (!blob) throw new Error('toBlob returned nothing');

    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    // Rung 3 — shrinking failed, for whatever reason. Send it as it is if the
    // server will take it, because a slightly expensive upload beats no upload.
    if (sendableAsIs(file)) return file;

    throw new Error(
      heic
        ? 'This phone could not convert that HEIC photo. In Settings > Camera > Formats choose "Most Compatible", then take it again.'
        : file.size > MAX_UPLOAD_BYTES
          ? 'That photo is too large to send (max 10MB). Try taking it at a lower resolution.'
          : 'That image could not be read. Try a JPEG or PNG.'
    );
  } finally {
    release();
  }
}

/**
 * Upload one document and read it.
 *
 * Uses fetch rather than apiFetch because this is multipart, not JSON — the
 * same reason uploadReceipt does. The 402 is re-thrown as PaymentRequiredError
 * so the caller can open the upgrade dialog instead of printing a sentence.
 */
export async function uploadCapture(file: File, documentType: DocumentType): Promise<DocumentCapture> {
  const prepared = await prepareForUpload(file);

  if (prepared.size > MAX_UPLOAD_BYTES) {
    throw new Error('That file is too large (max 10MB). Try photographing it instead of scanning at full quality.');
  }

  const form = new FormData();
  // documentType before the file: @fastify/multipart exposes preceding fields
  // on the file part, and a field sent after it would not be seen.
  form.append('documentType', documentType);
  form.append('file', prepared);

  const res = await fetch(serverApiUrl('/v1/captures'), {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });

  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    let data: Record<string, unknown> | undefined;
    try {
      const body = await res.json();
      message = body?.error || body?.message || message;
      data = body?.data;
    } catch { /* no body */ }
    if (res.status === 402) throw new PaymentRequiredError(message, data);
    throw new Error(message);
  }

  const body = await res.json();
  return (body?.data ?? body) as DocumentCapture;
}

/**
 * Ask permission to record this capture. Called BEFORE the entry is created —
 * it consumes the allowance, so an over-cap workspace never ends up with an
 * entry it was refused.
 */
export const confirmCapture = (id: string, destination: Destination) =>
  apiFetch<{ confirmed?: boolean; alreadyConfirmed?: boolean }>(`/v1/captures/${id}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ destination }),
  });

/** Point a confirmed capture at what it became. Best effort. */
export const linkCapture = (id: string, destination: Destination, destinationRecordId: string) =>
  apiFetch<{ linked: boolean }>(`/v1/captures/${id}/link`, {
    method: 'PATCH',
    body: JSON.stringify({ destination, destinationRecordId }),
  });

export const discardCapture = (id: string) =>
  apiFetch<{ discarded: boolean }>(`/v1/captures/${id}/discard`, { method: 'POST' });

/* --------------------------------------------------------------------- *
 * QR handoff — photograph a document with your phone, from your desktop.
 *
 * The desktop file picker is not a camera, so a desktop user holding a paper
 * receipt has no way to photograph it. This opens a short-lived session, shows
 * it as a QR code, and waits for the phone that scans it to send a photo back.
 * --------------------------------------------------------------------- */

export interface HandoffSession {
  id: string;
  /** The credential itself. Goes into the QR code and nowhere else. */
  token: string;
  expiresAt: string;
  ttlMinutes: number;
}

export type HandoffStatus = 'waiting' | 'uploaded' | 'consumed' | 'expired';

export const createHandoff = () =>
  apiFetch<HandoffSession>('/v1/captures/handoff', { method: 'POST' });

/** Has the phone sent anything yet? The capture comes back over THIS request —
 * the desktop's authenticated session — never to the phone. */
export const pollHandoff = (id: string) =>
  apiFetch<{ status: HandoffStatus; capture: DocumentCapture | null }>(`/v1/captures/handoff/${id}`);

export const cancelHandoff = (id: string) =>
  apiFetch<{ cancelled: boolean }>(`/v1/captures/handoff/${id}/cancel`, { method: 'POST' });

/**
 * The two calls below run ON THE PHONE, which is not logged in.
 *
 * They use plain `fetch`, deliberately, rather than `apiFetch` — that helper
 * attaches a bearer token and, on a 401, tries to refresh and then bounces to
 * the login page. On this page there is no session to refresh and being sent to
 * a login screen is the one outcome the whole feature exists to avoid. The
 * token in the URL is the entire credential.
 */
export async function getHandoffInfo(token: string): Promise<{ valid: boolean; expiresAt: string }> {
  const res = await fetch(serverApiUrl(`/v1/captures/handoff/token/${encodeURIComponent(token)}`));
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || 'This code has expired or has already been used.');
  return (body?.data ?? body) as { valid: boolean; expiresAt: string };
}

/** Send the photo. Nothing comes back — what was read off the document goes to
 * the desktop, not to the phone. */
export async function uploadViaHandoff(token: string, file: File): Promise<void> {
  const prepared = await prepareForUpload(file);

  if (prepared.size > MAX_UPLOAD_BYTES) {
    throw new Error('That photo is too large (max 10MB).');
  }

  const form = new FormData();
  form.append('file', prepared);

  const res = await fetch(serverApiUrl(`/v1/captures/handoff/token/${encodeURIComponent(token)}`), {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Could not send that photo (${res.status}).`);
  }
}

/**
 * The Try-It Demo's free scan.
 *
 * Unauthenticated, and it stores NOTHING server-side — the extraction comes
 * straight back and lives in the visitor's own browser until they sign up. It
 * still reuses `prepareForUpload`, so a demo visitor gets the same HEIC
 * conversion and downscaling a customer does rather than a worse second path.
 */
export async function uploadDemoCapture(file: File): Promise<{
  fields: ExtractedFields;
  confidence: ConfidenceScores;
  documentType: DocumentType;
}> {
  const prepared = await prepareForUpload(file);
  if (prepared.size > MAX_UPLOAD_BYTES) {
    throw new Error('That file is too large (max 10MB).');
  }

  const form = new FormData();
  form.append('file', prepared);

  // No auth headers: the demo has no session, and sending one would be a lie.
  const res = await fetch(serverApiUrl('/v1/demo/capture'), { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Could not read that document (${res.status}).`);
  }
  const body = await res.json();
  return (body?.data ?? body) as {
    fields: ExtractedFields;
    confidence: ConfidenceScores;
    documentType: DocumentType;
  };
}

/** The stored document, as a blob URL — a plain <img src> could not send auth. */
export async function getCaptureFileUrl(id: string): Promise<string> {
  const res = await fetch(serverApiUrl(`/v1/captures/${id}/file`), { headers: authHeaders() });
  if (!res.ok) throw new Error('Could not load that document.');
  return URL.createObjectURL(await res.blob());
}
