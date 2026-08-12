import { Database } from '../../infrastructure/database';

/**
 * Finna Council sessions (spec 07).
 *
 * A completed session is stored in full so re-reading a past decision costs
 * nothing — spec §5 makes that a cost requirement, not a nicety.
 *
 * The table doubles as the quota counter: "how many did this business convene
 * today" is a COUNT over rows created today, so there is no second counter to
 * keep in step with reality. A row is written even for a failed session, which
 * is deliberate — see `createPending`.
 */

export type Vote = 'support' | 'oppose' | 'conditional';
export type SessionStatus = 'running' | 'complete' | 'failed';

export interface MemberPosition {
  member: string;
  position: string;
  vote?: Vote;
}

export interface CouncilVerdict {
  verdict: string;
  votes: { member: string; vote: Vote; because: string }[];
  keyTension: string;
  conditions: string[];
  watchItems: string[];
  nextAction: string;
}

export type Outcome = 'worked' | 'mixed' | 'did_not_work' | 'not_done';

export interface CouncilSession {
  id: string;
  businessId: string;
  question: string;
  status: SessionStatus;
  openings: MemberPosition[];
  crossExamination: MemberPosition[];
  verdict: CouncilVerdict | null;
  /** The node written into the Company Brain, when one was created. */
  brainNodeId: string | null;
  error: string | null;
  /** null until the user says how it turned out. */
  outcome: Outcome | null;
  outcomeNote: string | null;
  outcomeRecordedAt: string | null;
  /** When this decision becomes worth reviewing. */
  reviewDueAt: string | null;
  /** An earlier session this one reverses, when the Council spotted one. */
  contradictsSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** How long before a decision is worth looking back at. */
export const REVIEW_AFTER_DAYS = 30;

export class CouncilRepository {
  constructor(private readonly database: Database) {}

  /**
   * Was the decision any good? Recorded by the user later, not guessed.
   * 'pending' means the review date has passed and nobody has said yet.
   */
  static readonly OUTCOMES = ['worked', 'mixed', 'did_not_work', 'not_done'] as const;

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS council_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        question TEXT NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'running',
        openings JSONB NOT NULL DEFAULT '[]'::jsonb,
        cross_examination JSONB NOT NULL DEFAULT '[]'::jsonb,
        verdict JSONB,
        brain_node_id UUID,
        error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await this.database.query(
      `CREATE INDEX IF NOT EXISTS idx_council_sessions_business
         ON council_sessions(business_id, created_at DESC)`
    );
    // Powers the global daily ceiling without scanning the whole table.
    await this.database.query(
      `CREATE INDEX IF NOT EXISTS idx_council_sessions_created
         ON council_sessions(created_at)`
    );

    // Outcome review (spec §7). Additive so an existing install picks it up.
    // `review_due_at` is set at completion — a decision with no review date
    // would never surface for review, which is how outcome tracking quietly
    // dies in most products.
    await this.database.query(
      `ALTER TABLE council_sessions
         ADD COLUMN IF NOT EXISTS outcome VARCHAR(16),
         ADD COLUMN IF NOT EXISTS outcome_note TEXT,
         ADD COLUMN IF NOT EXISTS outcome_recorded_at TIMESTAMP WITH TIME ZONE,
         ADD COLUMN IF NOT EXISTS review_due_at TIMESTAMP WITH TIME ZONE,
         ADD COLUMN IF NOT EXISTS contradicts_session_id UUID`
    );

    // Decisions made before the column existed have no review date, and the
    // "due for review" query requires one — so without this backfill every
    // pre-existing decision would be permanently invisible to outcome review.
    // Dated from when the decision was actually made, not from now.
    await this.database.query(
      `UPDATE council_sessions
          SET review_due_at = created_at + INTERVAL '${REVIEW_AFTER_DAYS} days'
        WHERE status = 'complete' AND review_due_at IS NULL`
    );
  }

  private map(row: any): CouncilSession {
    return {
      id: row.id,
      businessId: row.business_id,
      question: row.question,
      status: row.status,
      openings: Array.isArray(row.openings) ? row.openings : [],
      crossExamination: Array.isArray(row.cross_examination) ? row.cross_examination : [],
      verdict: row.verdict ?? null,
      brainNodeId: row.brain_node_id ?? null,
      error: row.error ?? null,
      outcome: row.outcome ?? null,
      outcomeNote: row.outcome_note ?? null,
      outcomeRecordedAt: row.outcome_recorded_at ?? null,
      reviewDueAt: row.review_due_at ?? null,
      contradictsSessionId: row.contradicts_session_id ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Reserve the slot BEFORE spending anything.
   *
   * The row is created up front so a session that then fails still consumes
   * quota. Otherwise a request that errors after the Anthropic call — the
   * expensive half — would cost money and leave the counter untouched, which is
   * exactly the hole a quota exists to close.
   */
  async createPending(
    businessId: string,
    userId: string | null,
    question: string,
    limits: { perBusiness: number; global: number }
  ): Promise<CouncilSession | null> {
    /**
     * The quota is enforced HERE, in the same statement that reserves the slot.
     *
     * Counting first and inserting second leaves a window: two requests both
     * read "2 of 3 used" and both proceed, so the cap that bounds Anthropic
     * spend becomes a suggestion. Folding both counts into the INSERT's WHERE
     * closes it — Postgres evaluates them against the same snapshot that
     * performs the write, so a loser inserts nothing and gets zero rows back.
     */
    const result = await this.database.query(
      `INSERT INTO council_sessions (business_id, created_by, question)
       SELECT $1, $2, $3
        WHERE (SELECT COUNT(*) FROM council_sessions
                WHERE business_id = $1 AND created_at >= CURRENT_DATE) < $4
          AND (SELECT COUNT(*) FROM council_sessions
                WHERE created_at >= CURRENT_DATE) < $5
         RETURNING *`,
      [
        businessId, userId, question.trim().slice(0, 4000),
        limits.perBusiness, limits.global,
      ]
    );
    // No row means the quota went while this request was in flight.
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async complete(
    id: string,
    data: {
      openings: MemberPosition[];
      crossExamination: MemberPosition[];
      verdict: CouncilVerdict;
      brainNodeId?: string | null;
      contradictsSessionId?: string | null;
    }
  ): Promise<CouncilSession | null> {
    const result = await this.database.query(
      `UPDATE council_sessions
          SET status = 'complete', openings = $2::jsonb, cross_examination = $3::jsonb,
              verdict = $4::jsonb, brain_node_id = $5, contradicts_session_id = $6,
              review_due_at = NOW() + INTERVAL '${REVIEW_AFTER_DAYS} days',
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [
        id,
        JSON.stringify(data.openings),
        JSON.stringify(data.crossExamination),
        JSON.stringify(data.verdict),
        data.brainNodeId ?? null,
        data.contradictsSessionId ?? null,
      ]
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  /**
   * The last few decisions, for briefing a new session (spec §7).
   *
   * Without this the Council starts cold every time and can't notice it is
   * being asked to reverse a call it made two months ago — which is most of
   * the reason the Brain was built before it.
   */
  async recentDecisions(businessId: string, limit = 5): Promise<CouncilSession[]> {
    const result = await this.database.query(
      `SELECT * FROM council_sessions
        WHERE business_id = $1 AND status = 'complete' AND verdict IS NOT NULL
        ORDER BY created_at DESC
        LIMIT $2`,
      [businessId, limit]
    );
    return result.rows.map((r: any) => this.map(r));
  }

  async recordOutcome(
    businessId: string,
    id: string,
    outcome: Outcome,
    note: string | null
  ): Promise<CouncilSession | null> {
    const result = await this.database.query(
      `UPDATE council_sessions
          SET outcome = $3, outcome_note = $4, outcome_recorded_at = NOW(), updated_at = NOW()
        WHERE business_id = $1 AND id = $2
        RETURNING *`,
      [businessId, id, outcome, note?.trim().slice(0, 2000) || null]
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  /** Completed decisions past their review date that nobody has judged yet. */
  async dueForReview(businessId: string, limit = 3): Promise<CouncilSession[]> {
    const result = await this.database.query(
      `SELECT * FROM council_sessions
        WHERE business_id = $1 AND status = 'complete'
          AND outcome IS NULL AND review_due_at IS NOT NULL AND review_due_at <= NOW()
        ORDER BY review_due_at ASC
        LIMIT $2`,
      [businessId, limit]
    );
    return result.rows.map((r: any) => this.map(r));
  }

  async fail(id: string, error: string): Promise<void> {
    await this.database.query(
      `UPDATE council_sessions SET status = 'failed', error = $2, updated_at = NOW()
        WHERE id = $1`,
      [id, error.slice(0, 500)]
    );
  }

  async listForBusiness(businessId: string, limit = 30): Promise<CouncilSession[]> {
    const result = await this.database.query(
      `SELECT * FROM council_sessions
        WHERE business_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [businessId, limit]
    );
    return result.rows.map((r: any) => this.map(r));
  }

  async get(businessId: string, id: string): Promise<CouncilSession | null> {
    const result = await this.database.query(
      `SELECT * FROM council_sessions WHERE business_id = $1 AND id = $2`,
      [businessId, id]
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  /** Sessions this business has convened today, in its own row count. */
  async countToday(businessId: string): Promise<number> {
    const result = await this.database.query(
      `SELECT COUNT(*)::int AS n FROM council_sessions
        WHERE business_id = $1 AND created_at >= CURRENT_DATE`,
      [businessId]
    );
    return Number(result.rows[0]?.n) || 0;
  }

  /** Sessions convened across every business today. */
  async countTodayGlobal(): Promise<number> {
    const result = await this.database.query(
      `SELECT COUNT(*)::int AS n FROM council_sessions WHERE created_at >= CURRENT_DATE`
    );
    return Number(result.rows[0]?.n) || 0;
  }
}
