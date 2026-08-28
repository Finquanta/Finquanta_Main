/**
 * Inbound email — shared shapes.
 *
 * A workspace gets a private address. Anything sent to it is read with the same
 * pipeline a photographed receipt goes through, and lands in a review queue.
 * Nothing posts to the books on its own.
 */

/**
 * The domain the MX record points at. A SUBDOMAIN on purpose: the apex already
 * carries Resend's sending records and whatever real mail the company gets, and
 * putting an MX on it would disturb both.
 */
export const INBOUND_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN || 'in.finquanta.ai';

export const MESSAGE_STATUSES = [
  /** Held: the sender is not trusted yet. NOTHING has been extracted. */
  'quarantined',
  'processing',
  'processed',
  /** Read, and there was nothing financial in it. */
  'ignored',
  'failed',
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const SENDER_STATUSES = ['trusted', 'blocked'] as const;
export type SenderStatus = (typeof SENDER_STATUSES)[number];

export interface InboundAddress {
  id: string;
  businessId: string;
  /** The part before the @. Random and rotatable — never the business id. */
  localPart: string;
  status: 'active' | 'revoked';
  createdAt: string;
  rotatedAt: string | null;
}

/** What the user copies. Built rather than stored, so changing the domain does
 * not mean rewriting every row. */
export const addressFor = (a: Pick<InboundAddress, 'localPart'>): string =>
  `${a.localPart}@${INBOUND_DOMAIN}`;

export interface InboundSender {
  id: string;
  businessId: string;
  email: string;
  status: SenderStatus;
  addedBy: string | null;
  createdAt: string;
}

export interface InboundMessage {
  id: string;
  businessId: string;
  addressId: string;
  /** Resend's id for the message. The idempotency key — webhooks retry. */
  providerMessageId: string;
  fromEmail: string;
  fromName: string | null;
  subject: string | null;
  receivedAt: string;
  status: MessageStatus;
  senderTrusted: boolean;
  attachmentCount: number;
  bodyExtracted: boolean;
  /** When somebody first looked at it. Null means unread. */
  openedAt: string | null;
  error: string | null;
}

/**
 * Attachment types worth reading. Narrower than what people attach: a signature
 * image or a company logo is an attachment too, and paying to read one is pure
 * waste. Size and count are capped by the caller.
 */
export const READABLE_ATTACHMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

/**
 * Work out what an attachment actually IS.
 *
 * Mail systems routinely label attachments `application/octet-stream` — it is
 * the honest answer for a sender that did not look inside the file, and it is
 * extremely common for PDFs in particular. Matching the declared type against
 * READABLE_ATTACHMENT_TYPES therefore rejects real invoices for having been
 * described vaguely, and from the product that is indistinguishable from the
 * email having had no attachment at all.
 *
 * So: trust the declared type when it is one we accept, and otherwise fall back
 * to the file extension. The extension is not authoritative either, but it is
 * the sender's own description of the file, and being wrong here costs one
 * failed extraction rather than a document silently vanishing.
 */
const EXTENSION_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function contentTypeFor(filename: string | null, declared: string): string {
  const clean = (declared || '').split(';')[0]!.trim().toLowerCase();
  if (READABLE_ATTACHMENT_TYPES.includes(clean)) return clean;

  const ext = (filename ?? '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const guessed = ext ? EXTENSION_TYPES[ext] : undefined;
  return guessed ?? clean;
}

/** Same ceiling the upload endpoints use. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Per message.
 *
 * Sized for the real behaviour, which is somebody selecting a month of receipts
 * and sending them in one go — not forwarding one bill at a time. There is
 * still a ceiling, because a mail with a hundred attachments is an attack or a
 * mistake, and anything over it is reported rather than silently dropped.
 */
export const MAX_ATTACHMENTS_PER_MESSAGE = Number(process.env.INBOUND_MAX_ATTACHMENTS || 20);

/** Normalise for comparison and storage. Addresses are matched case-insensitively
 * because in practice every provider treats them that way. */
export const normaliseEmail = (raw: string): string => raw.trim().toLowerCase();

/** Pull the bare address out of `Display Name <someone@example.com>`. */
export function parseFromHeader(raw: string): { email: string; name: string | null } {
  const angled = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (angled?.[2]) {
    const name = (angled[1] ?? '').replace(/^"|"$/g, '').trim();
    return { email: normaliseEmail(angled[2]), name: name || null };
  }
  return { email: normaliseEmail(raw), name: null };
}
