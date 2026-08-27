import dns from 'dns/promises';
import net from 'net';

/**
 * Fetching a spreadsheet from a link the user pasted.
 *
 * THIS IS THE ONLY PLACE THIS SERVER FETCHES A USER-SUPPLIED URL, and it is
 * treated accordingly. Every other outbound call goes to a hardcoded host (see
 * fx.repository.ts). An authenticated endpoint that fetches arbitrary URLs is a
 * server-side request forgery vector: it runs inside the deployment, so it can
 * reach things the caller cannot — cloud instance metadata at 169.254.169.254,
 * localhost, and any internal service on the private network.
 *
 * Four rules, and all four are load-bearing:
 *
 *  1. https only. http would let a network attacker rewrite the response.
 *  2. An ALLOWLIST of hosts, never a denylist. A denylist is a list of the
 *     attacks someone already thought of.
 *  3. The check is against the RESOLVED ADDRESS, not the hostname. An allowed
 *     host is a DNS record, and a DNS record can point at 127.0.0.1.
 *  4. Redirects are followed BY HAND, re-validating every hop. `fetch` follows
 *     them silently by default, which would let an allowed host redirect
 *     straight to a private address and defeat rules 2 and 3 together.
 */

/** Hosts a spreadsheet may legitimately come from. Additions are a deliberate act. */
const ALLOWED_HOSTS = [
  'docs.google.com',
  'drive.google.com',
  'www.dropbox.com',
  'dl.dropboxusercontent.com',
  'onedrive.live.com',
  '1drv.ms',
  'sharepoint.com',
];

const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

export class UrlFetchError extends Error {}

/** Host matches an allowlist entry, or is a subdomain of one. */
function hostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/**
 * Ranges that must never be reachable from here. Covers loopback, the RFC1918
 * private space, link-local (which is where cloud metadata lives), carrier-grade
 * NAT, and the IPv6 equivalents including v4-mapped addresses.
 */
export function isPrivateAddress(address: string): boolean {
  const family = net.isIP(address);

  if (family === 4) {
    const parts = address.split('.').map(Number);
    // net.isIP already said this is a v4 address, but the guard is cheap and an
    // unparseable octet must fail CLOSED rather than read as 0.
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) return true;
    const [a, b] = parts as [number, number, number, number];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local / instance metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a >= 224) return true; // multicast and reserved
    return false;
  }

  if (family === 6) {
    const v6 = address.toLowerCase();
    if (v6 === '::1' || v6 === '::') return true;
    if (v6.startsWith('fc') || v6.startsWith('fd')) return true; // unique local
    if (v6.startsWith('fe80')) return true; // link-local
    // ::ffff:127.0.0.1 — an IPv4 address wearing an IPv6 coat.
    const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isPrivateAddress(mapped[1]);
    return false;
  }

  // Not an IP literal at all: refuse rather than guess.
  return true;
}

/** Every address this hostname resolves to must be public — not just the first. */
export async function assertResolvesPublicly(hostname: string): Promise<void> {
  let addresses: string[];
  try {
    const records = await dns.lookup(hostname, { all: true });
    addresses = records.map((r) => r.address);
  } catch {
    throw new UrlFetchError('That address could not be resolved.');
  }
  if (addresses.length === 0) throw new UrlFetchError('That address could not be resolved.');
  if (addresses.some(isPrivateAddress)) {
    throw new UrlFetchError('That link points somewhere private and cannot be fetched.');
  }
}

/** Validate one URL — scheme, host, and where it actually resolves to. */
async function assertFetchable(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlFetchError('That does not look like a link.');
  }
  if (url.protocol !== 'https:') {
    throw new UrlFetchError('Only https links can be imported.');
  }
  if (!hostAllowed(url.hostname)) {
    throw new UrlFetchError(
      'Links can only be imported from Google Sheets, Dropbox or OneDrive. ' +
      'Otherwise download the file and upload it here.'
    );
  }
  await assertResolvesPublicly(url.hostname);
  return url;
}

export interface FetchedFile {
  content: string;
  contentType: string;
  /** Where we ended up, which may not be where we started. */
  finalUrl: string;
}

/**
 * Fetch a spreadsheet from a link. Returns the raw text for the CLIENT to parse
 * — parsing lives in one place, in the browser, so the server needs no
 * spreadsheet dependency.
 */
export async function fetchSpreadsheetFromUrl(rawUrl: string): Promise<FetchedFile> {
  let current = await assertFetchable(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        // Manual, so every hop is re-validated instead of followed blindly.
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: 'text/csv,text/plain,application/vnd.ms-excel,*/*' },
      });
    } catch (error) {
      throw new UrlFetchError(
        (error as Error)?.name === 'TimeoutError'
          ? 'That link took too long to respond.'
          : 'That link could not be reached.'
      );
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new UrlFetchError('That link redirected nowhere.');
      // Re-validate from scratch: the whole point of doing this by hand.
      current = await assertFetchable(new URL(location, current).toString());
      continue;
    }

    if (!res.ok) {
      // A private Google Sheet answers with a sign-in page, not the data. Say
      // what to do about it rather than reporting an opaque status code.
      throw new UrlFetchError(
        res.status === 401 || res.status === 403
          ? 'That file is private. Publish it to the web, or download it and upload the file here.'
          : `That link could not be read (${res.status}).`
      );
    }

    const contentType = res.headers.get('content-type') || '';
    if (/text\/html/i.test(contentType)) {
      // HTML where a spreadsheet was expected almost always means a login or
      // consent page returned with a 200.
      throw new UrlFetchError(
        'That link returned a web page rather than a file. If it is a private sheet, ' +
        'publish it to the web or download it and upload the file here.'
      );
    }

    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) throw new UrlFetchError('That file is too large (max 10MB).');

    const buffer = Buffer.from(await res.arrayBuffer());
    // Checked again after reading: content-length is a claim, not a guarantee.
    if (buffer.byteLength > MAX_BYTES) throw new UrlFetchError('That file is too large (max 10MB).');

    return { content: buffer.toString('utf8'), contentType, finalUrl: current.toString() };
  }

  throw new UrlFetchError('That link redirected too many times.');
}

/** Exported for the tests — the rules are worth asserting directly. */
export const __testing = { isPrivateAddress, hostAllowed };
