import { Database } from '../../infrastructure/database';
import { BrainRepository } from './brain.repository';
import { BrainPin, BrainPinsService, PinKey } from './brain.pins';

/**
 * Guided categories (spec §6b) — Marketing and Sales.
 *
 * These two differ from every other category because Finquanta has no social
 * posting, no ad platform and no CRM integration. Finna cannot post, run a
 * campaign or contact a lead. So rather than leaving them as silent notebooks
 * (most categories) or wiring a data pin (§6), they get an advisor: Finna asks
 * the questions a sharp marketing advisor would, and its suggestions sharpen in
 * direct proportion to how specific the answers are.
 *
 * Nothing in this file calls the AI API. It assembles the context the chat
 * route injects, and stores the answers — all deterministic. The dialogue
 * itself is ordinary Finna chat, drawing on the normal message quota, and only
 * runs when the user opens the category and engages.
 */

export const GUIDED_CATEGORIES = ['marketing', 'sales'] as const;
export type GuidedCategory = (typeof GUIDED_CATEGORIES)[number];

export const isGuidedCategory = (v: unknown): v is GuidedCategory =>
  GUIDED_CATEGORIES.includes(v as GuidedCategory);

/**
 * The profiling questions, straight from §6b.
 *
 * `id` is the stable storage key — never renamed, because answers are keyed on
 * it. `promptKey` is the i18n key for the question text, so the wording is
 * translated client-side rather than shipped from the server in English.
 */
export interface AdvisorQuestion {
  id: string;
  promptKey: string;
  /**
   * English label, used only when writing a node body — the UI always renders
   * `promptKey` through the translator. A node is a durable record, so it needs
   * words rather than a key that means nothing when read back.
   */
  label: string;
}

const MARKETING_QUESTIONS: AdvisorQuestion[] = [
  { id: 'cadence', promptKey: 'brainAdvisorQMarketingCadence', label: 'How often do you post?' },
  { id: 'content', promptKey: 'brainAdvisorQMarketingContent', label: 'What do you usually post?' },
  { id: 'platforms', promptKey: 'brainAdvisorQMarketingPlatforms', label: 'Where do you post?' },
  { id: 'history', promptKey: 'brainAdvisorQMarketingHistory', label: "What's worked before, and what hasn't?" },
];

/**
 * Sales asks about the shape of the funnel rather than the channel mix. Kept
 * here so slice 2 is a prompt change rather than a schema change — the storage
 * is already keyed by category.
 */
const SALES_QUESTIONS: AdvisorQuestion[] = [
  { id: 'who', promptKey: 'brainAdvisorQSalesWho', label: 'Who are your best customers, and how did they find you?' },
  { id: 'process', promptKey: 'brainAdvisorQSalesProcess', label: 'What happens between interest and payment?' },
  { id: 'objections', promptKey: 'brainAdvisorQSalesObjections', label: "What do people say when they don't buy?" },
  { id: 'closing', promptKey: 'brainAdvisorQSalesClosing', label: 'What usually tips someone into buying?' },
];

const QUESTIONS: Record<GuidedCategory, AdvisorQuestion[]> = {
  marketing: MARKETING_QUESTIONS,
  sales: SALES_QUESTIONS,
};

/**
 * How much the advisor has to work with.
 *
 * §6b makes this a promise to the user rather than a hidden heuristic: "this
 * category rewards specificity". Surfacing the level lets the UI say so plainly
 * and lets the system prompt calibrate how concrete it is allowed to be.
 */
export type Specificity = 'none' | 'thin' | 'partial' | 'rich';

/** Short answers are barely answers; they shouldn't earn a precise suggestion. */
const MEANINGFUL_ANSWER_CHARS = 12;

/**
 * One saved conversation.
 *
 * A business rarely has a single marketing question — a crypto exchange might
 * be promoting a trading platform and an NFT collection at once, and those are
 * different budgets, different stages and different audiences. Collapsing them
 * into one endless chat makes the advice worse and the record useless, so each
 * subject gets its own thread that can be left and resumed.
 *
 * `stage`, `budget` and `situation` live on the THREAD rather than the business
 * for the same reason: they differ per campaign, and they're the context that
 * makes a note still meaningful when it's read back in six months.
 */
export const THREAD_STATUSES = ['active', 'archived'] as const;
export type ThreadStatus = (typeof THREAD_STATUSES)[number];

export const isThreadStatus = (v: unknown): v is ThreadStatus =>
  THREAD_STATUSES.includes(v as ThreadStatus);

export interface AdvisorThread {
  id: string;
  category: GuidedCategory;
  title: string;
  stage: string | null;
  budget: string | null;
  situation: string | null;
  /** Archived threads stay readable but drop out of the default list. */
  status: ThreadStatus;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdvisorMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** A thread plus its transcript. */
export interface AdvisorThreadDetail extends AdvisorThread {
  messages: AdvisorMessage[];
}

/** Keeps one runaway conversation from growing without bound. */
const MAX_THREAD_MESSAGES = 200;

export interface AdvisorContext {
  category: GuidedCategory;
  /** The real category row, so a note the advisor drafts is filed correctly. */
  categoryId: string | null;
  /** Set when the conversation is scoped to a saved thread. */
  thread: AdvisorThread | null;
  /** Stored answers, keyed by question id. */
  answers: Record<string, string>;
  questions: AdvisorQuestion[];
  /** Question ids with no meaningful answer yet — what Finna should ask next. */
  unanswered: string[];
  specificity: Specificity;
  /** Recent notes already in this category, so advice builds on the record. */
  notes: { id: string; title: string; summary: string | null }[];
  /** The live data pin for this category, when a matching Group exists. */
  pin: BrainPin | null;
}

export class BrainAdvisorService {
  private readonly repo: BrainRepository;
  private readonly pins: BrainPinsService;

  constructor(private readonly database: Database) {
    this.repo = new BrainRepository(database);
    this.pins = new BrainPinsService(database);
  }

  async ensureSchema(): Promise<void> {
    // Keyed by category slug rather than a marketing-specific table, so adding
    // Sales later is a prompt and a question list, not a migration.
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS brain_advisor_profiles (
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        category_slug VARCHAR(40) NOT NULL,
        answers JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (business_id, category_slug)
      );
    `);

    // Saved conversations. Messages live in a JSONB array rather than their own
    // table: a transcript is only ever read and appended whole, and appending
    // with `messages || $1` is a single atomic statement.
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS brain_advisor_threads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        category_slug VARCHAR(40) NOT NULL,
        title VARCHAR(200) NOT NULL,
        stage VARCHAR(60),
        budget VARCHAR(120),
        situation TEXT,
        messages JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await this.database.query(
      `CREATE INDEX IF NOT EXISTS idx_brain_advisor_threads_business
         ON brain_advisor_threads(business_id, category_slug, updated_at DESC)`
    );

    // Additive, so an existing install picks archiving up without a rebuild.
    await this.database.query(
      `ALTER TABLE brain_advisor_threads
         ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active'`
    );
    await this.database.query(
      `ALTER TABLE brain_advisor_threads
         ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE`
    );
  }

  private mapThread(row: any): AdvisorThread {
    return {
      id: row.id,
      category: row.category_slug,
      title: row.title,
      stage: row.stage ?? null,
      budget: row.budget ?? null,
      situation: row.situation ?? null,
      status: row.status === 'archived' ? 'archived' : 'active',
      messageCount: Array.isArray(row.messages) ? row.messages.length : 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /** Defaults to active only — archived conversations are opt-in on every read. */
  async listThreads(
    businessId: string,
    category: GuidedCategory,
    status: ThreadStatus = 'active'
  ): Promise<AdvisorThread[]> {
    const result = await this.database.query(
      `SELECT id, category_slug, title, stage, budget, situation, status, messages,
              created_at, updated_at
         FROM brain_advisor_threads
        WHERE business_id = $1 AND category_slug = $2 AND status = $3
        ORDER BY updated_at DESC`,
      [businessId, category, status]
    );
    return result.rows.map((r: any) => this.mapThread(r));
  }

  async createThread(
    businessId: string,
    category: GuidedCategory,
    input: { title: string; stage?: string | null; budget?: string | null; situation?: string | null }
  ): Promise<AdvisorThread> {
    const result = await this.database.query(
      `INSERT INTO brain_advisor_threads (business_id, category_slug, title, stage, budget, situation)
            VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
      [
        businessId, category, input.title.trim().slice(0, 200),
        input.stage?.trim().slice(0, 60) || null,
        input.budget?.trim().slice(0, 120) || null,
        input.situation?.trim().slice(0, 2000) || null,
      ]
    );
    return this.mapThread(result.rows[0]);
  }

  async getThread(businessId: string, id: string): Promise<AdvisorThreadDetail | null> {
    const result = await this.database.query(
      `SELECT * FROM brain_advisor_threads WHERE business_id = $1 AND id = $2`,
      [businessId, id]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      ...this.mapThread(row),
      messages: Array.isArray(row.messages) ? row.messages : [],
    };
  }

  /** Rename or re-scope a thread. Only the fields present are touched. */
  async updateThread(
    businessId: string,
    id: string,
    patch: {
      title?: string; stage?: string | null; budget?: string | null;
      situation?: string | null; status?: ThreadStatus;
    }
  ): Promise<AdvisorThread | null> {
    const sets: string[] = [];
    const values: any[] = [businessId, id];
    const put = (col: string, v: string | null, max: number) => {
      values.push(v === null ? null : v.trim().slice(0, max) || null);
      sets.push(`${col} = $${values.length}`);
    };

    if (typeof patch.title === 'string' && patch.title.trim()) put('title', patch.title, 200);
    if (patch.stage !== undefined) put('stage', patch.stage, 60);
    if (patch.budget !== undefined) put('budget', patch.budget, 120);
    if (patch.situation !== undefined) put('situation', patch.situation, 2000);
    if (isThreadStatus(patch.status)) {
      values.push(patch.status);
      sets.push(`status = $${values.length}`);
      // Stamped alongside so "when did we park this?" is answerable.
      sets.push(patch.status === 'archived' ? 'archived_at = NOW()' : 'archived_at = NULL');
    }
    if (sets.length === 0) return this.getThread(businessId, id);

    const result = await this.database.query(
      `UPDATE brain_advisor_threads SET ${sets.join(', ')}, updated_at = NOW()
        WHERE business_id = $1 AND id = $2
        RETURNING *`,
      values
    );
    return result.rows[0] ? this.mapThread(result.rows[0]) : null;
  }

  /**
   * Append to the transcript, then trim to the newest MAX_THREAD_MESSAGES.
   * One statement, so two browser tabs can't interleave a lost update.
   */
  async appendMessages(
    businessId: string,
    id: string,
    messages: AdvisorMessage[]
  ): Promise<void> {
    const clean = messages
      .filter((m) => m && typeof m.content === 'string' && m.content.trim())
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content.slice(0, 8000),
      }));
    if (clean.length === 0) return;

    await this.database.query(
      `UPDATE brain_advisor_threads
          SET messages = (
                -- WITH ORDINALITY + explicit ORDER BY: see the same trim in
                -- finna.repository.ts. Row order out of jsonb_array_elements is
                -- incidental rather than promised, and getting it wrong
                -- scrambles a transcript silently.
                SELECT COALESCE(jsonb_agg(m ORDER BY ord), '[]'::jsonb) FROM (
                  SELECT m, ord
                    FROM jsonb_array_elements(messages || $3::jsonb)
                         WITH ORDINALITY AS t(m, ord)
                   ORDER BY ord
                   OFFSET GREATEST(jsonb_array_length(messages || $3::jsonb) - ${MAX_THREAD_MESSAGES}, 0)
                ) trimmed
              ),
              updated_at = NOW()
        WHERE business_id = $1 AND id = $2`,
      [businessId, id, JSON.stringify(clean)]
    );
  }

  async deleteThread(businessId: string, id: string): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM brain_advisor_threads WHERE business_id = $1 AND id = $2`,
      [businessId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getAnswers(businessId: string, category: GuidedCategory): Promise<Record<string, string>> {
    const result = await this.database.query(
      `SELECT answers FROM brain_advisor_profiles
        WHERE business_id = $1 AND category_slug = $2`,
      [businessId, category]
    );
    const raw = result.rows[0]?.answers;
    if (!raw || typeof raw !== 'object') return {};

    // Only keep keys this category actually defines. A renamed or removed
    // question shouldn't keep feeding stale text into the prompt.
    const valid = new Set(QUESTIONS[category].map((q) => q.id));
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (valid.has(k) && typeof v === 'string' && v.trim()) answers[k] = v.trim();
    }
    return answers;
  }

  /**
   * Merge answers rather than replace them: the user answers one question at a
   * time, in whatever order they like, and a partial save must never wipe what
   * they already said. An empty string deletes that answer.
   */
  async saveAnswers(
    businessId: string,
    category: GuidedCategory,
    patch: Record<string, string>,
    userId?: string | null
  ): Promise<Record<string, string>> {
    const questions = QUESTIONS[category];
    const valid = new Map(questions.map((q) => [q.id, q]));
    const current = await this.getAnswers(businessId, category);

    /**
     * Overwriting an answer silently would lose real history: "we post twice a
     * week" becoming "we post daily" is a change in the business, not a typo
     * correction. Each change is recorded as a node so the Brain keeps the
     * before and after, with the date. First-time answers aren't recorded —
     * they're already visible in the profile, and four nodes on day one is
     * noise rather than history.
     */
    const changes: { question: AdvisorQuestion; from: string; to: string }[] = [];

    for (const [k, v] of Object.entries(patch)) {
      const question = valid.get(k);
      if (!question || typeof v !== 'string') continue;
      const trimmed = v.trim().slice(0, 2000);
      const previous = current[k];

      if (trimmed) {
        if (previous && previous !== trimmed) {
          changes.push({ question, from: previous, to: trimmed });
        }
        current[k] = trimmed;
      } else {
        delete current[k];
      }
    }

    await this.database.query(
      `INSERT INTO brain_advisor_profiles (business_id, category_slug, answers, updated_at)
            VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (business_id, category_slug)
       DO UPDATE SET answers = EXCLUDED.answers, updated_at = NOW()`,
      [businessId, category, JSON.stringify(current)]
    );

    if (changes.length > 0) {
      const categoryId = await this.categoryIdFor(businessId, category);
      const on = new Date().toISOString().slice(0, 10);
      for (const c of changes) {
        // Best-effort: failing to write the history note must never lose the
        // answer the user actually typed.
        try {
          await this.repo.createNode(businessId, userId ?? null, {
            title: `Updated: ${c.question.label}`.slice(0, 300),
            content:
              `${c.question.label}\n\nChanged on ${on}.\n\n` +
              `**Previously:** ${c.from}\n\n**Now:** ${c.to}`,
            type: 'note',
            categoryId,
            source: 'system',
            payload: {
              advisorChange: {
                category, questionId: c.question.id, from: c.from, to: c.to, at: on,
              },
            },
          });
        } catch {
          // swallowed on purpose — see above
        }
      }
    }

    return current;
  }

  /**
   * Save a whole conversation into the Brain as one readable node.
   *
   * Deterministic — it formats the stored transcript, no AI call and no cost.
   * This is the "so it can be read later" path: Finna's own note proposals
   * capture a single decision, whereas this keeps the whole thread of reasoning.
   */
  async saveThreadAsNote(
    businessId: string,
    threadId: string,
    userId?: string | null
  ): Promise<{ id: string } | null> {
    const thread = await this.getThread(businessId, threadId);
    if (!thread) return null;

    const header = [
      thread.stage ? `**Stage:** ${thread.stage}` : null,
      thread.budget ? `**Budget:** ${thread.budget}` : null,
      thread.situation ? `**Situation:** ${thread.situation}` : null,
    ].filter(Boolean);

    const body = thread.messages
      .map((m) => `**${m.role === 'user' ? 'Us' : 'Finna'}:** ${m.content}`)
      .join('\n\n');

    const node = await this.repo.createNode(businessId, userId ?? null, {
      title: thread.title.slice(0, 300),
      content:
        `Advisor conversation — saved ${new Date().toISOString().slice(0, 10)}.\n\n` +
        (header.length ? `${header.join('\n')}\n\n---\n\n` : '') +
        (body || '_No messages yet._'),
      type: 'note',
      categoryId: await this.categoryIdFor(businessId, thread.category),
      source: 'system',
      payload: { advisorThreadId: threadId, category: thread.category },
    });
    return { id: node.id };
  }

  /** Everything the chat route needs to brief the advisor, in one round trip. */
  async getContext(
    businessId: string,
    category: GuidedCategory,
    restrict?: string,
    threadId?: string | null
  ): Promise<AdvisorContext> {
    const answers = await this.getAnswers(businessId, category);
    const questions = QUESTIONS[category];

    const unanswered = questions
      .filter((q) => (answers[q.id] ?? '').length < MEANINGFUL_ANSWER_CHARS)
      .map((q) => q.id);

    const categoryId = await this.categoryIdFor(businessId, category);

    // Restricted nodes are filtered here for the same reason they are
    // everywhere else: a note the user can't see must not reach the model and
    // come back paraphrased in a suggestion.
    const notes = categoryId
      ? (await this.repo.listNodes(businessId, {
          categoryId,
          includeSubcategories: true,
          status: 'active',
          restrict,
        })).slice(0, 20).map((n) => ({ id: n.id, title: n.title, summary: n.summary }))
      : [];

    // The transcript is dropped here on purpose: the client already holds the
    // messages it is chatting with, and echoing them back would double the
    // payload of a call made on every keystroke-idle refresh.
    const detail = threadId ? await this.getThread(businessId, threadId) : null;
    const { messages: _transcript, ...thread } = detail ?? {};

    return {
      category,
      categoryId,
      thread: detail ? (thread as AdvisorThread) : null,
      answers,
      questions,
      unanswered,
      specificity: this.specificityOf(answers, questions),
      notes,
      pin: await this.pinFor(businessId, category),
    };
  }

  private specificityOf(
    answers: Record<string, string>,
    questions: AdvisorQuestion[]
  ): Specificity {
    const answered = questions.filter(
      (q) => (answers[q.id] ?? '').length >= MEANINGFUL_ANSWER_CHARS
    ).length;
    if (answered === 0) return 'none';
    if (answered < questions.length / 2) return 'thin';
    if (answered < questions.length) return 'partial';

    // All answered, but a set of terse answers is still a thin brief. Length is
    // a crude proxy for detail, and deliberately so — the alternative is paying
    // a model to grade the user's answers before the real call.
    const total = questions.reduce((s, q) => s + (answers[q.id] ?? '').length, 0);
    return total >= questions.length * 60 ? 'rich' : 'partial';
  }

  private async categoryIdFor(businessId: string, slug: GuidedCategory): Promise<string | null> {
    const result = await this.database.query(
      `SELECT id FROM brain_categories
        WHERE business_id = $1 AND slug = $2 AND status = 'active'`,
      [businessId, slug]
    );
    return result.rows[0]?.id ?? null;
  }

  private async pinFor(businessId: string, category: GuidedCategory): Promise<BrainPin | null> {
    const [pin] = await this.pins.resolve(businessId, [category as PinKey]);
    return pin?.available ? pin : null;
  }
}
