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

/**
 * Convert and shrink an image so the API will take it.
 *
 * Returns the file untouched when it is a PDF (the API reads those directly) or
 * when it is already small enough that re-encoding would only lose detail.
 */
export async function prepareForUpload(file: File): Promise<File> {
  if (file.type === 'application/pdf') return file;

  /**
   * HEIC needs no library. It comes from iPhones, and Safari — the browser on
   * an iPhone — decodes it natively, so drawing it to a canvas re-encodes it as
   * JPEG for free. A desktop browser that cannot decode it throws here, and the
   * message says what to do rather than failing at the API with a media_type
   * error the user cannot act on.
   */
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      isHeic(file)
        ? 'This browser cannot read HEIC photos. Open the photo on your phone, or save it as JPEG first.'
        : 'That image could not be read. Try a JPEG or PNG.'
    );
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

  // Already small and already an accepted type: send it as-is.
  if (scale === 1 && !isHeic(file) && file.size <= MAX_UPLOAD_BYTES) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  );
  if (!blob) return file;

  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
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
