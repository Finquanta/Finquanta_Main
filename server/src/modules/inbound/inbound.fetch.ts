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
export async function fetchReceivedEmail(emailId: string): Promise<ReceivedEmail> {
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

  const rawAttachments = Array.isArray(d?.attachments) ? d.attachments : [];
  const attachments: ReceivedAttachment[] = rawAttachments.map((a: any) => ({
    filename: a?.filename ?? a?.name ?? null,
    contentType: ((a?.content_type ?? a?.contentType ?? '').split(';')[0] ?? '').trim().toLowerCase(),
    content: typeof a?.content === 'string' ? a.content : null,
    url: a?.download_url ?? a?.url ?? null,
  }));

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
