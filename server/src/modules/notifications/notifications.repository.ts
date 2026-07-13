import { Database } from '../../infrastructure/database';

/**
 * Admin-authored notifications, delivered to users' inboxes.
 *
 * Modelled as announcements + read receipts, NOT as a copy of the message per
 * user. Sending to 10,000 users writes one row, not 10,000, and editing or
 * deleting an announcement affects everyone at once instead of needing a
 * fan-out. The cost is a join on read, which is cheap and bounded.
 */

export type Audience = 'all' | 'verified' | 'unverified';

export const AUDIENCES: Audience[] = ['all', 'verified', 'unverified'];

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  createdAt: string;
  /** When it goes out. Null means it went out immediately. */
  scheduledFor: string | null;
  /** False while a scheduled notification is still waiting. */
  delivered: boolean;
  /** Admin view only. */
  authorName?: string;
  recipients?: number;
  readCount?: number;
}

export interface InboxItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export class NotificationsRepository {
  constructor(private database: Database) {}

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(160) NOT NULL,
        body TEXT NOT NULL,
        audience VARCHAR(20) NOT NULL DEFAULT 'all',
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    // Null = send immediately. A future time = hold it until then.
    await this.database.query(
      `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE`
    );
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS announcement_reads (
        announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (announcement_id, user_id)
      );
    `);
  }

  /**
   * When an announcement actually goes out: the scheduled time if there is one,
   * otherwise the moment it was created.
   *
   * Scheduling changes who receives it, not just when. A notice scheduled for
   * next Tuesday reaches everyone who has signed up BY Tuesday — which is the
   * point of scheduling it rather than sending it now.
   */
  private static readonly SEND_AT = `COALESCE(a.scheduled_for, a.created_at)`;

  /**
   * Who an announcement is for, and whether it has gone out yet.
   *
   * Users who sign up after it lands don't get it — an announcement is a moment
   * in time, not a standing message, and a new user shouldn't open their inbox
   * to a year of old notices. A scheduled one is invisible to everyone until its
   * time comes: there's no cron job, the clock in the query IS the scheduler,
   * so nothing can fail to fire.
   */
  private static readonly AUDIENCE_MATCH = `
    (a.audience = 'all'
      OR (a.audience = 'verified' AND u.email_verified = true)
      OR (a.audience = 'unverified' AND u.email_verified = false))
    AND u.created_at <= COALESCE(a.scheduled_for, a.created_at)
  `;

  /** Has it actually gone out yet? Kept separate from WHO it's for, so the admin
   *  panel can show the projected reach of something still queued. */
  private static readonly DELIVERED = `COALESCE(a.scheduled_for, a.created_at) <= NOW()`;

  async create(
    authorId: string,
    data: { title: string; body: string; audience: Audience; scheduledFor?: string | null }
  ): Promise<Announcement> {
    const result = await this.database.query(
      `INSERT INTO announcements (title, body, audience, created_by, scheduled_for)
       VALUES ($1, $2, $3, $4::uuid, $5::timestamptz)
       RETURNING id, title, body, audience, created_at, scheduled_for,
                 (COALESCE(scheduled_for, created_at) <= NOW()) AS delivered`,
      [data.title.trim(), data.body.trim(), data.audience, authorId, data.scheduledFor ?? null]
    );
    const r = result.rows[0];
    return {
      id: r.id,
      title: r.title,
      body: r.body,
      audience: r.audience,
      createdAt: r.created_at,
      scheduledFor: r.scheduled_for ?? null,
      delivered: !!r.delivered,
    };
  }

  /**
   * Admin list: what's been sent and what's still queued, who it reached, how
   * many opened it. Scheduled-but-not-yet-sent items sort to the top — they're
   * the ones you might still want to change your mind about.
   */
  async listSent(limit = 100): Promise<Announcement[]> {
    const result = await this.database.query(
      `SELECT a.id, a.title, a.body, a.audience, a.created_at, a.scheduled_for,
              (${NotificationsRepository.DELIVERED}) AS delivered,
              COALESCE(NULLIF(TRIM(CONCAT(au.first_name, ' ', au.last_name)), ''), au.email, '—') AS author_name,
              (SELECT COUNT(*)::int FROM users u
                 WHERE ${NotificationsRepository.AUDIENCE_MATCH}) AS recipients,
              (SELECT COUNT(*)::int FROM announcement_reads r WHERE r.announcement_id = a.id) AS read_count
       FROM announcements a
       LEFT JOIN users au ON au.id = a.created_by
       ORDER BY (${NotificationsRepository.SEND_AT} > NOW()) DESC, ${NotificationsRepository.SEND_AT} DESC
       LIMIT $1`,
      [limit]
    );

    return (result.rows as any[]).map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      audience: r.audience,
      createdAt: r.created_at,
      scheduledFor: r.scheduled_for ?? null,
      delivered: !!r.delivered,
      authorName: r.author_name,
      recipients: r.recipients,
      readCount: r.read_count,
    }));
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.database.query('DELETE FROM announcements WHERE id = $1::uuid', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /** A user's inbox: everything addressed to them, newest first. */
  async inbox(userId: string, limit = 50): Promise<InboxItem[]> {
    const result = await this.database.query(
      `SELECT a.id, a.title, a.body, a.created_at,
              (r.user_id IS NOT NULL) AS read
       FROM announcements a
       JOIN users u ON u.id = $1::uuid
       LEFT JOIN announcement_reads r ON r.announcement_id = a.id AND r.user_id = u.id
       WHERE ${NotificationsRepository.AUDIENCE_MATCH}
         AND ${NotificationsRepository.DELIVERED}
       ORDER BY COALESCE(a.scheduled_for, a.created_at) DESC
       LIMIT $2`,
      [userId, limit]
    );

    return (result.rows as any[]).map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      createdAt: r.created_at,
      read: !!r.read,
    }));
  }

  async markRead(userId: string, announcementId: string): Promise<void> {
    await this.database.query(
      `INSERT INTO announcement_reads (announcement_id, user_id)
       VALUES ($1::uuid, $2::uuid)
       ON CONFLICT DO NOTHING`,
      [announcementId, userId]
    );
  }

  /** Mark everything currently in this user's inbox as read. */
  async markAllRead(userId: string): Promise<void> {
    await this.database.query(
      `INSERT INTO announcement_reads (announcement_id, user_id)
       SELECT a.id, u.id
       FROM announcements a
       JOIN users u ON u.id = $1::uuid
       WHERE ${NotificationsRepository.AUDIENCE_MATCH}
         AND ${NotificationsRepository.DELIVERED}
       ON CONFLICT DO NOTHING`,
      [userId]
    );
  }
}
