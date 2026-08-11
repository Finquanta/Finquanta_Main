import { Database } from '../../infrastructure/database';
import { BusinessRole } from '../businesses/businesses.repository';

/**
 * Brain access control (spec §10).
 *
 * Deliberately SEPARATE from the financial role. A Bookkeeper needs the books
 * but has no business reading the CEO's notes on a funding round, and an
 * external Accountant may need Viewer on the Brain while holding wide financial
 * permissions. One axis cannot express both.
 *
 * The rule that matters most: a restricted node is **absent**, not locked. It
 * does not appear in search, in the graph, in the tree, in a category list, or
 * as a backlink on somebody else's note. A lock icon would announce that a
 * sensitive note exists and roughly what it's attached to, which for a note
 * about a personnel issue or a funding round is most of the leak.
 *
 * All of this is enforced server-side. The client is never trusted to hide.
 */

export const ACCESS_LEVELS = ['editor', 'commenter', 'viewer', 'none'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

/** What a node can be locked down to, over and above the member's level. */
export const NODE_OVERRIDES = ['owners_admins'] as const;
export type NodeOverride = (typeof NODE_OVERRIDES)[number];

export const isAccessLevel = (v: unknown): v is AccessLevel =>
  ACCESS_LEVELS.includes(v as AccessLevel);

export const isNodeOverride = (v: unknown): v is NodeOverride =>
  NODE_OVERRIDES.includes(v as NodeOverride);

/**
 * The level a member gets when nobody has set one explicitly.
 *
 * Owners and Admins run the business, so they edit. Everyone else can read but
 * not write, which is the safe default — the Brain is where decisions and
 * reasoning live, and an accidental edit is worse than an accidental omission.
 */
export function defaultLevelFor(role: BusinessRole | null): AccessLevel {
  if (!role) return 'none';
  return role === 'Owner' || role === 'Admin' ? 'editor' : 'viewer';
}

export interface BrainAccess {
  level: AccessLevel;
  role: BusinessRole | null;
  /** Owners and Admins see nodes restricted with `owners_admins`. */
  privileged: boolean;
}

export const canRead = (a: BrainAccess) => a.level !== 'none';
export const canWrite = (a: BrainAccess) => a.level === 'editor';

export class BrainAccessService {
  constructor(private database: Database) {}

  /**
   * Resolve one member's effective access.
   *
   * Membership is checked first: someone who isn't in the business at all gets
   * `none`, whatever `brain_access` might say — a stale row must never grant
   * access to a workspace the user was removed from.
   */
  async resolve(businessId: string, userId: string): Promise<BrainAccess> {
    const [member, explicit] = await Promise.all([
      this.database.query(
        `SELECT role FROM business_members WHERE business_id = $1 AND user_id = $2`,
        [businessId, userId]
      ),
      this.database.query(
        `SELECT level FROM brain_access WHERE business_id = $1 AND user_id = $2`,
        [businessId, userId]
      ),
    ]);

    const role: BusinessRole | null = member.rows[0]?.role ?? null;
    if (!role) return { level: 'none', role: null, privileged: false };

    const stored = explicit.rows[0]?.level;
    const level = isAccessLevel(stored) ? stored : defaultLevelFor(role);
    return { level, role, privileged: role === 'Owner' || role === 'Admin' };
  }

  /** Everyone in the business with their effective Brain level. */
  async list(businessId: string): Promise<{
    userId: string; email: string; name: string | null;
    role: BusinessRole; level: AccessLevel; explicit: boolean;
  }[]> {
    const r = await this.database.query(
      `SELECT m.user_id, m.role, u.email, u.name, a.level
         FROM business_members m
         JOIN users u ON u.id = m.user_id
         LEFT JOIN brain_access a
           ON a.business_id = m.business_id AND a.user_id = m.user_id
        WHERE m.business_id = $1
        ORDER BY u.email`,
      [businessId]
    );
    return r.rows.map((row: any) => ({
      userId: row.user_id,
      email: row.email,
      name: row.name ?? null,
      role: row.role,
      level: isAccessLevel(row.level) ? row.level : defaultLevelFor(row.role),
      explicit: isAccessLevel(row.level),
    }));
  }

  /** Set a member's level. Passing null clears it back to the role default. */
  async setLevel(
    businessId: string, userId: string, level: AccessLevel | null
  ): Promise<boolean> {
    // Only an actual member can be given a level, or a row could be planted for
    // an arbitrary user id and take effect the moment they were invited.
    const member = await this.database.query(
      `SELECT 1 FROM business_members WHERE business_id = $1 AND user_id = $2`,
      [businessId, userId]
    );
    if (member.rows.length === 0) return false;

    if (level === null) {
      await this.database.query(
        `DELETE FROM brain_access WHERE business_id = $1 AND user_id = $2`,
        [businessId, userId]
      );
      return true;
    }

    await this.database.query(
      `INSERT INTO brain_access (business_id, user_id, level, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (business_id, user_id)
         DO UPDATE SET level = EXCLUDED.level, updated_at = NOW()`,
      [businessId, userId, level]
    );
    return true;
  }

  /**
   * A SQL fragment that removes nodes this member may not see.
   *
   * Returned as a fragment rather than applied by a wrapper so it can go into
   * the existing list/search/graph queries directly — every read path shares
   * one definition of "visible", instead of each remembering to filter.
   *
   * `alias` is the table alias of brain_nodes in the calling query.
   */
  visibilityClause(access: BrainAccess, alias = 'n'): string {
    // Owners and Admins see everything, so the clause collapses to nothing.
    if (access.privileged) return 'TRUE';
    // Everyone else is shown only nodes with no override on them.
    return `${alias}.access_override IS NULL`;
  }
}
