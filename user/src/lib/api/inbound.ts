import { apiFetch } from './client';
import { DocumentCapture } from './capture';

/**
 * Inbound email — forward a bill to a private address and have it read.
 *
 * The address is a credential in everything but name: anyone who has it can put
 * documents in front of this workspace. That is why `rotate` exists, and why
 * the sender list is part of the feature rather than a setting nobody finds.
 */

export interface InboundAddress {
  id: string;
  localPart: string;
  /** The full address, built server-side so the domain lives in one place. */
  email: string;
  status: 'active' | 'revoked';
  createdAt: string;
  rotatedAt: string | null;
}

export type MessageStatus = 'quarantined' | 'processing' | 'processed' | 'ignored' | 'failed';

export interface InboundMessage {
  id: string;
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

export interface InboundSender {
  id: string;
  email: string;
  status: 'trusted' | 'blocked';
  createdAt: string;
}

export const getInboundAddress = () => apiFetch<InboundAddress>('/v1/inbound/address');

/** Burn the current address and mint a new one. For when it has leaked. */
export const rotateInboundAddress = () =>
  apiFetch<InboundAddress>('/v1/inbound/address/rotate', { method: 'POST' });

export const getInboundMessages = () => apiFetch<InboundMessage[]>('/v1/inbound/messages');

/** Just the number, for the header icon. Cheap enough to call on every load. */
export const getPendingCount = () =>
  apiFetch<{ count: number }>('/v1/inbound/pending/count');

/** Documents waiting for a human — what the queue shows. */
export const getPendingFromEmail = () => apiFetch<DocumentCapture[]>('/v1/inbound/pending');

/** The recycle bin — thrown away, not yet gone. */
export const getDiscardedFromEmail = () =>
  apiFetch<DocumentCapture[]>('/v1/inbound/discarded');

/** Put a discarded document back in the queue. */
export const restoreCapture = (id: string) =>
  apiFetch<{ restored: boolean }>(`/v1/captures/${id}/restore`, { method: 'POST' });

/** Mark a received message as looked at, so its dot goes away. */
/**
 * What one email produced — whatever became of it.
 *
 * Not filtered by status, because "what happened to the thing I sent?" is
 * asked most often once the document has left the review queue.
 */
export const getMessageCaptures = (id: string) =>
  apiFetch<DocumentCapture[]>(`/v1/inbound/messages/${id}/captures`);

/**
 * Empty the recycle bin now, rather than waiting for the schedule.
 *
 * The one irreversible action here: files go as well as rows, and both halves
 * of the bin are cleared. Ask before calling it.
 */
export const emptyRecycleBin = () =>
  apiFetch<{ documents: number; messages: number; blobFailures: number }>(
    '/v1/inbound/bin/empty',
    { method: 'POST' }
  );

/** Emails in the recycle bin. Deleting one no longer destroys it. */
export const getDeletedMessages = () =>
  apiFetch<InboundMessage[]>('/v1/inbound/messages/deleted');

/** Out of the bin, back into Received. */
export const restoreMessage = (id: string) =>
  apiFetch<{ restored: boolean }>(`/v1/inbound/messages/${id}/restore`, { method: 'POST' });

/** Put the unread dot back — reading something is not the same as dealing with it. */
export const markMessageUnread = (id: string) =>
  apiFetch<{ read: boolean }>(`/v1/inbound/messages/${id}/unread`, { method: 'POST' });

/**
 * Remove a received message from the list.
 *
 * Deletes the record of the EMAIL only. Documents it produced keep their place
 * in the books; they simply stop knowing which email carried them.
 */
export const deleteInboundMessage = (id: string) =>
  apiFetch<{ deleted: boolean }>(`/v1/inbound/messages/${id}`, { method: 'DELETE' });

export const markMessageRead = (id: string) =>
  apiFetch<{ read: boolean }>(`/v1/inbound/messages/${id}/read`, { method: 'POST' });

export interface InboundDiagnostics {
  address: string;
  inboundDomain: string;
  signingSecretSet: boolean;
  apiKeySet: boolean;
  webhook: {
    total: number;
    badSignature: number;
    unreadable: number;
    ignoredType: number;
    unknownAddress: number;
    routed: number;
    startedAt: string;
    /** The most recent rejection in words — the only part anybody can act on. */
    lastFailure?: string | null;
    lastFailureAt?: string | null;
  };
  /**
   * The SHAPE of the signing secret, never the secret itself.
   *
   * OPTIONAL because this app and the server deploy independently: a browser
   * running the newer frontend against the older server must render, not crash.
   */
  secret?: {
    set: boolean;
    hadSurroundingWhitespace: boolean;
    hasWhsecPrefix: boolean;
    looksBase64: boolean;
    keyBytes: number;
  };
  messagesEverReceived: boolean;
}

/**
 * Is Resend actually calling us?
 *
 * Behind auth like everything else, which is why it cannot be read by pasting
 * the URL into a browser — that sends no token. It is surfaced in the UI
 * instead, where the session already exists.
 */
export const getInboundDiagnostics = () =>
  apiFetch<InboundDiagnostics>('/v1/inbound/diagnostics');

export const getInboundSenders = () => apiFetch<InboundSender[]>('/v1/inbound/senders');

/**
 * Trust or block a sender.
 *
 * Trusting is forward-looking only: it releases what that address sends NEXT,
 * not everything it has ever sent. One click should not turn into an unbounded
 * pile of reading, or a queue full of months-old paperwork.
 */
export const setInboundSender = (email: string, status: 'trusted' | 'blocked') =>
  apiFetch<{ email: string; status: string }>('/v1/inbound/senders', {
    method: 'POST',
    body: JSON.stringify({ email, status }),
  });
