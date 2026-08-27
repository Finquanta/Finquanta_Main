import { assertResolvesPublicly, isPrivateAddress } from '../imports/url-fetch';
import { MAX_ATTACHMENT_BYTES } from './inbound.types';

/**
 * Downloading an attachment from a URL that arrived in a webhook.
 *
 * Resend does not inline attachment bytes — it sends metadata plus a temporary
 * download URL. That URL arrives over the network, which makes this the second
 * place in the server that fetches an address it did not hardcode, and it gets
 * the same treatment as the first (`imports/url-fetch.ts`): https only, an
 * allowlist of hosts, and the check applied to the RESOLVED ADDRESS rather than
 * the hostname, because an allowed name can still point at 127.0.0.1.
 *
 * The webhook is signature-verified before we ever get here, so this is defence
 * in depth rather than the only thing standing between us and a forged URL. It
 * is worth having anyway: a signature proves who sent the payload, not that
 * every field inside it is safe to dereference.
 */

/**
 * Hosts an attachment may legitimately come from.
 *
 * Configurable because Resend's storage host is not something to guess at from
 * documentation — CONFIRM THE ACTUAL HOST during integration and set this, or
 * every attachment will be refused. The default covers Resend's own domains;
 * if they serve from presigned object storage, that host goes here too.
 */
const ALLOWED_HOSTS = (process.env.INBOUND_ATTACHMENT_HOSTS || 'resend.com,resend.dev')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;

export class AttachmentFetchError extends Error {}

function hostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

async function assertFetchable(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AttachmentFetchError('That attachment link is not a URL.');
  }
  if (url.protocol !== 'https:') {
    throw new AttachmentFetchError('Attachments are only fetched over https.');
  }
  if (!hostAllowed(url.hostname)) {
    throw new AttachmentFetchError(`Attachment host not allowed: ${url.hostname}`);
  }
  await assertResolvesPublicly(url.hostname);
  return url;
}

export interface FetchedAttachment {
  body: Buffer;
  contentType: string;
}

/**
 * Fetch one attachment, following redirects BY HAND so every hop is
 * re-validated. `fetch` follows them silently by default, which would let an
 * allowed host redirect straight to a private address and defeat the allowlist
 * and the address check together.
 */
export async function fetchAttachment(rawUrl: string): Promise<FetchedAttachment> {
  let current = await assertFetchable(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new AttachmentFetchError(
        (error as Error)?.name === 'TimeoutError'
          ? 'That attachment took too long to download.'
          : 'That attachment could not be downloaded.'
      );
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new AttachmentFetchError('That attachment redirected nowhere.');
      current = await assertFetchable(new URL(location, current).toString());
      continue;
    }

    if (!res.ok) {
      throw new AttachmentFetchError(`That attachment could not be downloaded (${res.status}).`);
    }

    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > MAX_ATTACHMENT_BYTES) {
      throw new AttachmentFetchError('That attachment is too large (max 10MB).');
    }

    const body = Buffer.from(await res.arrayBuffer());
    // Checked again after reading: content-length is a claim, not a guarantee.
    if (body.byteLength > MAX_ATTACHMENT_BYTES) {
      throw new AttachmentFetchError('That attachment is too large (max 10MB).');
    }

    return {
      body,
      contentType: (res.headers.get('content-type') || 'application/octet-stream').split(';')[0]?.trim()
        || 'application/octet-stream',
    };
  }

  throw new AttachmentFetchError('That attachment redirected too many times.');
}

/** Exported for the tests — the allowlist rules are worth asserting directly. */
export const __testing = { hostAllowed, isPrivateAddress };
