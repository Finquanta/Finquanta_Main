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
