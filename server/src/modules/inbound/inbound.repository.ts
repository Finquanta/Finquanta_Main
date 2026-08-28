import crypto from 'crypto';
import { Database } from '../../infrastructure/database';
import {
  InboundAddress, InboundMessage, InboundSender, MessageStatus, SenderStatus, normaliseEmail,
} from './inbound.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Inbound email — addresses, senders and received messages.
 *
 * Three tables, and the shape of each is driven by one assumption: **the
 * address will leak.** It gets forwarded, pasted into a supplier portal, added
 * to a mailing list. So the address alone must not be enough to put anything in
 * somebody's books — which is what `inbound_senders` is for.
 */
export class InboundRepository {
  constructor(private readonly database: Database) {}

  /**
   * All of it in ONE round trip.
   *
   * Boot already runs ~20 of these sequentially against a remote Neon branch,
   * and each one waits on the network before anything is served. Six separate
   * statements here would have been six more waits. Postgres runs a
   * multi-statement simple query inside a single implicit transaction, so this
   * is also all-or-nothing rather than half a schema.
   *
   * The ALTER at the end needs `document_captures` to exist, which is why the
   * inbound module is registered AFTER the capture module in api.ts.
   */
  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS inbound_addresses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        local_part TEXT NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        rotated_at TIMESTAMP WITH TIME ZONE
      );

      -- One live address per workspace. A partial index rather than a plain
      -- UNIQUE, because revoked addresses must stay in the table: mail already
      -- in flight to an old address should be recognised and dropped, not
      -- mistaken for an unknown recipient.
      CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_active_per_business
        ON inbound_addresses (business_id) WHERE status = 'active';

      CREATE TABLE IF NOT EXISTS inbound_senders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'trusted',
        added_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (business_id, email)
      );

      CREATE TABLE IF NOT EXISTS inbound_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        address_id UUID REFERENCES inbound_addresses(id) ON DELETE SET NULL,
        provider_message_id TEXT NOT NULL UNIQUE,
        from_email TEXT NOT NULL,
        from_name TEXT,
        subject TEXT,
        received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        status VARCHAR(20) NOT NULL DEFAULT 'processing',
        sender_trusted BOOLEAN NOT NULL DEFAULT FALSE,
        attachment_count INT NOT NULL DEFAULT 0,
        body_extracted BOOLEAN NOT NULL DEFAULT FALSE,
        error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_inbound_messages_business
        ON inbound_messages (business_id, received_at DESC);

      -- Per WORKSPACE, not per user: this is a shared queue, and a colleague
      -- having already looked at something is exactly what you want to know.
      ALTER TABLE inbound_messages ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP WITH TIME ZONE;

      -- Where a capture came from, when it came from an email. Added here so the
      -- dependency points one way: inbound knows about capture, capture knows
      -- nothing about inbound.
      ALTER TABLE document_captures
        ADD COLUMN IF NOT EXISTS inbound_message_id UUID
        REFERENCES inbound_messages(id) ON DELETE SET NULL;
    `);
  }

  /* ----------------------------- addresses ----------------------------- */

  /**
   * The workspace's live address, minted on first ask.
   *
   * 10 random bytes as hex. Not the business id, and not derived from anything:
   * an address that can be guessed from a company name is an address anyone can
   * post documents to.
   */
  async ensureAddress(businessId: string): Promise<InboundAddress> {
    const existing = await this.database.query(
      `SELECT * FROM inbound_addresses WHERE business_id = $1 AND status = 'active'`,
      [businessId]
    );
    if (existing.rows.length) return this.toAddress(existing.rows[0]);

    const r = await this.database.query(
      `INSERT INTO inbound_addresses (business_id, local_part) VALUES ($1, $2)
       ON CONFLICT (business_id) WHERE status = 'active' DO NOTHING
       RETURNING *`,
      [businessId, this.newLocalPart()]
    );
    // Lost a race with a concurrent first request: read back the winner rather
    // than minting a second address for the same workspace.
    if (!r.rows.length) {
      const again = await this.database.query(
        `SELECT * FROM inbound_addresses WHERE business_id = $1 AND status = 'active'`,
        [businessId]
      );
      return this.toAddress(again.rows[0]);
    }
    return this.toAddress(r.rows[0]);
  }

  /** Burn the current address and mint a new one. For when it has leaked. */
  async rotateAddress(businessId: string): Promise<InboundAddress> {
    await this.database.query(
      `UPDATE inbound_addresses SET status = 'revoked', rotated_at = NOW()
        WHERE business_id = $1 AND status = 'active'`,
      [businessId]
    );
    return this.ensureAddress(businessId);
  }

  /** Resolve a recipient. Only an ACTIVE address accepts mail. */
  async findByLocalPart(localPart: string): Promise<InboundAddress | null> {
    const r = await this.database.query(
      `SELECT * FROM inbound_addresses WHERE local_part = $1 AND status = 'active'`,
      [localPart.toLowerCase()]
    );
    return r.rows.length ? this.toAddress(r.rows[0]) : null;
  }

  private newLocalPart(): string {
    return `docs-${crypto.randomBytes(10).toString('hex')}`;
  }

  /* ------------------------------ senders ------------------------------ */

  /**
   * How this workspace feels about an address. `null` means "never seen" —
   * which is NOT the same as trusted, and is what quarantines a message.
   */
  async senderStatus(businessId: string, email: string): Promise<SenderStatus | null> {
    const r = await this.database.query(
      `SELECT status FROM inbound_senders WHERE business_id = $1 AND email = $2`,
      [businessId, normaliseEmail(email)]
    );
    return r.rows.length ? (r.rows[0].status as SenderStatus) : null;
  }

  async setSenderStatus(
    businessId: string,
    email: string,
    status: SenderStatus,
    addedBy: string | null
  ): Promise<void> {
    await this.database.query(
      `INSERT INTO inbound_senders (business_id, email, status, added_by)
            VALUES ($1, $2, $3, $4)
       ON CONFLICT (business_id, email)
       DO UPDATE SET status = EXCLUDED.status, added_by = EXCLUDED.added_by`,
      [businessId, normaliseEmail(email), status, addedBy]
    );
  }

  async listSenders(businessId: string): Promise<InboundSender[]> {
    const r = await this.database.query(
      `SELECT * FROM inbound_senders WHERE business_id = $1 ORDER BY email`,
      [businessId]
    );
    return r.rows.map((x: any) => this.toSender(x));
  }

  /**
   * Is this address one of the workspace's own members?
   *
   * A member forwarding a bill from their own mailbox is the ordinary case and
   * should not need approving — they are already trusted with the books. This
   * is what makes the feature usable on day one without a setup step.
   */
  async isMemberEmail(businessId: string, email: string): Promise<boolean> {
    const r = await this.database.query(
      `SELECT 1 FROM business_members m
         JOIN users u ON u.id = m.user_id
        WHERE m.business_id = $1 AND LOWER(u.email) = $2
        LIMIT 1`,
      [businessId, normaliseEmail(email)]
    );
    return r.rows.length > 0;
  }

  /* ----------------------------- messages ------------------------------ */

  /** Idempotency. Resend retries a webhook until it is acknowledged. */
  async findByProviderId(providerMessageId: string): Promise<InboundMessage | null> {
    const r = await this.database.query(
      `SELECT * FROM inbound_messages WHERE provider_message_id = $1`,
      [providerMessageId]
    );
    return r.rows.length ? this.toMessage(r.rows[0]) : null;
  }

  async createMessage(input: {
    businessId: string;
    addressId: string;
    providerMessageId: string;
    fromEmail: string;
    fromName: string | null;
    subject: string | null;
    status: MessageStatus;
    senderTrusted: boolean;
    attachmentCount: number;
  }): Promise<InboundMessage> {
    const r = await this.database.query(
      `INSERT INTO inbound_messages
         (business_id, address_id, provider_message_id, from_email, from_name,
          subject, status, sender_trusted, attachment_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (provider_message_id) DO NOTHING
       RETURNING *`,
      [
        input.businessId, input.addressId, input.providerMessageId, input.fromEmail,
        input.fromName, input.subject, input.status, input.senderTrusted, input.attachmentCount,
      ]
    );
    // Two deliveries of the same message raced. The other one won; use it.
    if (!r.rows.length) {
      const existing = await this.findByProviderId(input.providerMessageId);
      if (existing) return existing;
      throw new Error('Could not record that message.');
    }
    return this.toMessage(r.rows[0]);
  }

  async setStatus(id: string, status: MessageStatus, error: string | null = null): Promise<void> {
    await this.database.query(
      `UPDATE inbound_messages SET status = $2, error = $3 WHERE id = $1`,
      [id, status, error ? error.slice(0, 500) : null]
    );
  }

  /** Somebody has looked at it. Idempotent — re-opening keeps the first time. */
  async markRead(id: string, businessId: string): Promise<void> {
    await this.database.query(
      `UPDATE inbound_messages SET opened_at = COALESCE(opened_at, NOW())
        WHERE id = $1 AND business_id = $2`,
      [id, businessId]
    );
  }

  async markBodyExtracted(id: string): Promise<void> {
    await this.database.query(
      `UPDATE inbound_messages SET body_extracted = TRUE WHERE id = $1`,
      [id]
    );
  }

  /** How many messages this workspace has taken today — the abuse ceiling. */
  async countToday(businessId: string): Promise<number> {
    const r = await this.database.query(
      `SELECT COUNT(*)::int AS n FROM inbound_messages
        WHERE business_id = $1 AND received_at >= CURRENT_DATE`,
      [businessId]
    );
    return Number(r.rows[0]?.n) || 0;
  }

  async listMessages(businessId: string, limit = 50): Promise<InboundMessage[]> {
    const r = await this.database.query(
      `SELECT * FROM inbound_messages WHERE business_id = $1
        ORDER BY received_at DESC LIMIT $2`,
      [businessId, Math.min(Math.max(limit, 1), 200)]
    );
    return r.rows.map((x: any) => this.toMessage(x));
  }

  /** Point a capture at the email it arrived in. */
  async linkCapture(captureId: string, messageId: string): Promise<void> {
    await this.database.query(
      `UPDATE document_captures SET inbound_message_id = $2 WHERE id = $1`,
      [captureId, messageId]
    );
  }

  /* ------------------------------ mapping ------------------------------ */

  private toAddress(row: any): InboundAddress {
    return {
      id: row.id,
      businessId: row.business_id,
      localPart: row.local_part,
      status: row.status,
      createdAt: row.created_at,
      rotatedAt: row.rotated_at,
    };
  }

  private toSender(row: any): InboundSender {
    return {
      id: row.id,
      businessId: row.business_id,
      email: row.email,
      status: row.status as SenderStatus,
      addedBy: row.added_by,
      createdAt: row.created_at,
    };
  }

  private toMessage(row: any): InboundMessage {
    return {
      id: row.id,
      businessId: row.business_id,
      addressId: row.address_id,
      providerMessageId: row.provider_message_id,
      fromEmail: row.from_email,
      fromName: row.from_name,
      subject: row.subject,
      receivedAt: row.received_at,
      status: row.status as MessageStatus,
      senderTrusted: row.sender_trusted,
      attachmentCount: row.attachment_count,
      bodyExtracted: row.body_extracted,
      openedAt: row.opened_at ?? null,
      error: row.error,
    };
  }
}
