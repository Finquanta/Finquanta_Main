/**
 * Fetching the actual email, after the webhook has told us one arrived.
 *
 * THIS STEP WAS MISSING, and without it the feature could never have worked.
 * Resend's `email.received` webhook carries METADATA ONLY — sender, recipient,
 * subject, and a list of attachment names. The body text and the attachment
 * bytes are not in it. They have to be fetched with the `email_id`, which is
 * exactly what this does.
 *
 * The webhook is deliberately thin for a good reason: a mail with 20 megabytes
 * of attachments would otherwise be pushed at us whether we wanted it or not.
 * Fetching on demand also means an untrusted sender costs us one small webhook
 * and nothing else — we never download what we are not going to read.
 *
 * Plain `fetch` rather than the Resend SDK, matching how the rest of this
 * server talks to Resend (see infrastructure/email.ts) and to Anthropic: no
 * vendor client is a dependency here, and adding one risks the Render build.
 */

import { contentTypeFor } from './inbound.types';

const RECEIVING_ENDPOINT = 'https://api.resend.com/emails/receiving';
const TIMEOUT_MS = 30_000;

export class ReceivedFetchError extends Error {}

export interface ReceivedAttachment {
  filename: string | null;
  contentType: string;
  /** Base64 bytes, when the API returns content inline. */
  content: string | null;
  /** A download URL, when it does not. */
  url: string | null;
}

export interface ReceivedEmail {
  text: string;
  attachments: ReceivedAttachment[];
}

/**
 * Read one received email in full.
 *
 * The response shape is read defensively across the plausible spellings, for
 * the same reason `normalisePayload` is: this is the second and last place
 * that guesses at Resend's field names, so a rename breaks here and nowhere
 * else. Confirm both against one real delivery.
 */
export async function fetchReceivedEmail(
  emailId: string,
  /** Optional shape logging — keys only, never message content. */
  log?: (message: string) => void
): Promise<ReceivedEmail> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new ReceivedFetchError('RESEND_API_KEY is not set, so received email cannot be read.');
  }

  let res: Response;
  try {
    res = await fetch(`${RECEIVING_ENDPOINT}/${encodeURIComponent(emailId)}`, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new ReceivedFetchError(
      (error as Error)?.name === 'TimeoutError'
        ? 'Reading that email timed out.'
        : 'Could not reach Resend to read that email.'
    );
  }

  if (!res.ok) {
    throw new ReceivedFetchError(`Could not read that email from Resend (${res.status}).`);
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const json = (await res.json()) as any;
  const d = json?.data ?? json;

  // Every plausible spelling, because this is one of only two places that
  // guesses at Resend's field names.
  const rawAttachments = Array.isArray(d?.attachments) ? d.attachments
    : Array.isArray(d?.files) ? d.files
      : [];
  const attachments: ReceivedAttachment[] = rawAttachments.map((a: any) => {
    const filename = a?.filename ?? a?.name ?? null;
    return {
      filename,
      // Resolved from the extension when the declared type is vague — see
      // contentTypeFor. A PDF labelled application/octet-stream is the common
      // case, not an edge one.
      contentType: contentTypeFor(filename, a?.content_type ?? a?.contentType ?? a?.type ?? ''),
      content: typeof a?.content === 'string' ? a.content
        : typeof a?.data === 'string' ? a.data
          : null,
      url: a?.download_url ?? a?.url ?? a?.href ?? null,
    };
  });

  /**
   * Say what came back, in SHAPE only — keys and content types, never values,
   * because this is somebody's mail.
   *
   * The field names above are a guess against a provider whose response shape
   * is not pinned down here, and when the guess is wrong the symptom is an
   * email that appears to have had no attachment. That is invisible from the
   * product and was being diagnosed by trial and error.
   */
  if (rawAttachments.length === 0) {
    log?.(
      `Resend returned no attachments for ${emailId}. Top-level keys: ` +
      `[${Object.keys(json ?? {}).join(', ')}]. data keys: [${Object.keys(d ?? {}).join(', ')}].`
    );
  } else {
    log?.(
      `Resend returned ${rawAttachments.length} attachment(s) for ${emailId}. ` +
      `Keys on the first: [${Object.keys(rawAttachments[0] ?? {}).join(', ')}]. ` +
      `Resolved types: [${attachments.map((a) => a.contentType || '(none)').join(', ')}].`
    );
  }

  return {
    // `text` preferred over `html`: the extractor reads prose, and stripping
    // markup badly is worse than using the plain part the sender already wrote.
    text: d?.text ?? d?.plain ?? d?.body_plain ?? '',
    attachments,
  };
}

/** Base64 to bytes, for an attachment returned inline rather than by URL. */
export function decodeInline(content: string): Buffer {
  // Some encoders wrap base64 at 76 characters; Buffer copes, but stripping
  // whitespace first keeps a malformed body from silently truncating.
  return Buffer.from(content.replace(/\s+/g, ''), 'base64');
}

/**
 * The attachments, which are a SEPARATE CALL — and this was the bug.
 *
 * `GET /emails/receiving/{id}` returns an `attachments` array, which is what
 * made the original mistake so easy to make: it looks like the whole answer.
 * But those entries carry metadata only — id, filename, content_type,
 * content_disposition, content_id, size — and NO content and NO download_url.
 *
 * So every attachment was read, found to have no bytes, and skipped. Nothing
 * threw, nothing logged, and the message fell through to body extraction and
 * reported "this email had no attachment" — about an email that plainly had
 * one. Confirmed against Resend's API reference, not guessed:
 *
 *     GET /emails/receiving/{email_id}/attachments
 *     -> { object: "list", has_more: bool, data: [ { id, filename, size,
 *          content_type, content_disposition, content_id, download_url,
 *          expires_at } ] }
 *
 * `download_url` is signed and short-lived, which is why it is fetched now
 * rather than stored for later.
 */
export interface ListedAttachment {
  id: string;
  filename: string | null;
  contentType: string;
  size: number | null;
  downloadUrl: string | null;
}

export async function listReceivedAttachments(
  emailId: string,
  log?: (message: string) => void
): Promise<ListedAttachment[]> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new ReceivedFetchError('RESEND_API_KEY is not set, so attachments cannot be read.');
  }

  let res: Response;
  try {
    res = await fetch(
      `${RECEIVING_ENDPOINT}/${encodeURIComponent(emailId)}/attachments?limit=100`,
      { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
  } catch (error) {
    throw new ReceivedFetchError(
      (error as Error)?.name === 'TimeoutError'
        ? 'Listing the attachments on that email timed out.'
        : 'Could not reach Resend to list attachments.'
    );
  }

  if (!res.ok) {
    throw new ReceivedFetchError(`Could not list attachments (${res.status}).`);
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const json = (await res.json()) as any;
  const rows = Array.isArray(json?.data) ? json.data : [];

  const listed: ListedAttachment[] = rows.map((a: any) => {
    const filename = a?.filename ?? null;
    return {
      id: String(a?.id ?? ''),
      filename,
      // Extension fallback for octet-stream and friends; see contentTypeFor.
      contentType: contentTypeFor(filename, a?.content_type ?? ''),
      size: typeof a?.size === 'number' ? a.size : null,
      downloadUrl: a?.download_url ?? null,
    };
  });

  // Shape only, never content — this is somebody's mail.
  log?.(
    `Resend listed ${listed.length} attachment(s) for ${emailId}: ` +
    `[${listed.map((a) => `${a.contentType || '(none)'}${a.downloadUrl ? '' : ' NO-URL'}`).join(', ')}].`
  );

  return listed;
}
