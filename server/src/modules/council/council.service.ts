import { Database } from '../../infrastructure/database';
import { BrainRepository } from '../brain/brain.repository';
import { CouncilContext, CouncilContextService } from './council.context';
import {
  CouncilRepository, CouncilSession, CouncilVerdict, MemberPosition, Vote,
} from './council.repository';

/**
 * The Finna Council (spec 07) — four specialist perspectives debate a decision.
 *
 * TWO Anthropic calls per question, never thirteen:
 *   1. the four opening positions
 *   2. the cross-examination AND the synthesis, with the openings fed back in
 *
 * The naive shape — one call per member per round — re-sends the whole
 * transcript every time and costs roughly 3x for the same debate. Two is the
 * floor that still buys REAL disagreement: in call 2 the model is reacting to
 * four positions that already exist, rather than writing all four sides in one
 * breath. Spec §1 is explicit that if the members always agree the feature is
 * theatre, so that reactivity is the point, not a refinement.
 *
 * Called over plain `fetch`, deliberately without @anthropic-ai/sdk — same
 * reasoning as brain.enrich.ts: the server has no AI dependency today and
 * adding one risks the Render build.
 */

/** Haiku unless overridden — the cost lever, kept in config not in code. */
const MODEL = process.env.COUNCIL_MODEL || 'claude-haiku-4-5';
/** The synthesis call may use a stronger model; defaults to the same one. */
const SYNTHESIS_MODEL = process.env.COUNCIL_SYNTHESIS_MODEL || MODEL;

const OPENINGS_MAX_TOKENS = 1400;
const VERDICT_MAX_TOKENS = 2000;

/**
 * Without this a hung upstream leaves the session row stuck on 'running'
 * forever — quota spent, no verdict, and nothing that ever marks it failed.
 */
const CALL_TIMEOUT_MS = 90_000;

/** Per business, per day. Deliberately low while the balance is small. */
const DAILY_LIMIT_PER_BUSINESS = Number.parseInt(process.env.COUNCIL_DAILY_LIMIT ?? '', 10) || 3;
/**
 * Across every business, per day.
 *
 * The per-business cap alone does NOT bound spend — the total grows with every
 * workspace. This is the number that protects the prepaid balance.
 */
const GLOBAL_DAILY_LIMIT =
  Number.parseInt(process.env.COUNCIL_GLOBAL_DAILY_LIMIT ?? '', 10) || 15;

export const COUNCIL_MEMBERS = [
  {
    key: 'cfo',
    name: 'The Accountant / CFO',
    brief:
      'Priorities: accuracy, cash preservation, obligations, insolvency risk, tax and compliance exposure. ' +
      'Asks: can we afford this, what happens to cash in the worst case, what obligations does it create. ' +
      'Watch your own bias: you can be too conservative and block growth that is worth the risk.',
  },
  {
    key: 'advisor',
    name: 'The Advisor',
    brief:
      'Priorities: strategy, positioning, timing, competitive context, the stated goal. ' +
      'Asks: does this fit where the business is going, is now the right time, what is the opportunity cost. ' +
      'Watch your own bias: you can favour narrative over numbers.',
  },
  {
    key: 'ceo',
    name: 'The CEO',
    brief:
      'Priorities: decisiveness, growth, execution, momentum, calculated risk. ' +
      'Asks: what is the upside, what is the fastest way to test it, are we being too cautious, who does this. ' +
      'Watch your own bias: you can underweight cash constraints and downside risk.',
  },
  {
    key: 'analyst',
    name: 'The Analyst',
    brief:
      'Priorities: evidence, quantification, break-even, sensitivity to assumptions. ' +
      'Asks: what do the numbers actually say, what is this resting on, what if the key assumption is wrong by half. ' +
      'Watch your own bias: you can demand data that does not exist and stall the decision.',
  },
] as const;

const GUARDRAILS =
  'Hard rules for every member:\n' +
  '- You are decision support, NOT a licensed accountant, tax advisor or financial advisor. ' +
  'For tax, legal or regulatory questions, say plainly that a professional should be consulted.\n' +
  '- NEVER invent a financial figure. If a number is not in the briefing, say the data is missing ' +
  'and name what would be needed. The briefing lists what is unavailable — do not estimate those.\n' +
  '- You cannot take any action. You cannot create records, send invoices or change data. You advise; the user acts.\n' +
  '- Do not manufacture disagreement on a question with a clear correct answer. Disagree where you genuinely differ.';

/**
 * Raised when the slot reservation loses a race with a concurrent request.
 * Distinct from a generic failure so the route can answer 429, not 502 —
 * nothing was spent.
 */
export class CouncilQuotaError extends Error {
  constructor() {
    super("The Council has reached today's limit. It resets tomorrow.");
    this.name = 'CouncilQuotaError';
  }
}

export class CouncilService {
  private readonly repo: CouncilRepository;
  private readonly context: CouncilContextService;
  private readonly brain: BrainRepository;

  constructor(private readonly database: Database) {
    this.repo = new CouncilRepository(database);
    this.context = new CouncilContextService(database);
    this.brain = new BrainRepository(database);
  }

  /** Checked BEFORE a session row is created, so a refusal costs nothing. */
  async checkQuota(businessId: string): Promise<{
    allowed: boolean; scope: 'business' | 'global' | null;
    used: number; limit: number; globalUsed: number; globalLimit: number;
  }> {
    const [used, globalUsed] = await Promise.all([
      this.repo.countToday(businessId),
      this.repo.countTodayGlobal(),
    ]);
    const overGlobal = globalUsed >= GLOBAL_DAILY_LIMIT;
    const overOwn = used >= DAILY_LIMIT_PER_BUSINESS;
    return {
      allowed: !overOwn && !overGlobal,
      scope: overGlobal ? 'global' : overOwn ? 'business' : null,
      used,
      limit: DAILY_LIMIT_PER_BUSINESS,
      globalUsed,
      globalLimit: GLOBAL_DAILY_LIMIT,
    };
  }

  async convene(
    businessId: string,
    userId: string | null,
    question: string
  ): Promise<CouncilSession> {
    // Reserving the slot IS the quota check — see createPending. The route's
    // earlier checkQuota is the friendly early exit; this is the guarantee.
    const session = await this.repo.createPending(businessId, userId, question, {
      perBusiness: DAILY_LIMIT_PER_BUSINESS,
      global: GLOBAL_DAILY_LIMIT,
    });
    if (!session) throw new CouncilQuotaError();

    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('No AI key is configured on the server.');
      }

      const ctx = await this.context.assemble(businessId);
      // Spec §7 — the Council reads from the Brain before deliberating, so it
      // can recognise when it's being asked to reverse an earlier call.
      const past = await this.repo.recentDecisions(businessId);
      const briefing = `${CouncilContextService.render(ctx)}${this.renderPast(past)}`;

      const openings = await this.openingPositions(question, briefing);
      const { crossExamination, verdict, contradictsIndex } =
        await this.crossExamineAndSynthesize(question, briefing, openings, past.length);

      // Index rather than an id: asking a model to echo a UUID invites a
      // hallucinated one, and a wrong id would link two unrelated decisions.
      const contradicted =
        contradictsIndex !== null && past[contradictsIndex] ? past[contradictsIndex] : null;

      const brainNodeId = await this.writeDecisionNode(
        businessId, userId, question, verdict, ctx, contradicted
      );

      if (brainNodeId && contradicted?.brainNodeId) {
        await this.linkContradiction(businessId, brainNodeId, contradicted.brainNodeId);
      }

      const done = await this.repo.complete(session.id, {
        openings, crossExamination, verdict, brainNodeId,
        contradictsSessionId: contradicted?.id ?? null,
      });
      return done ?? session;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The Council could not finish.';
      await this.repo.fail(session.id, message);
      throw error;
    }
  }

  /**
   * `created_at` is a timestamptz and node-postgres hands it back as a JS
   * `Date`, not the ISO string the CouncilSession type claims. `String(date)`
   * gives "Wed Aug 12 2026 14:23:11 GMT+0000 …", so slicing 10 characters off
   * it produced "Wed Aug 12" — a weekday with no year, in the model's briefing
   * and burned into permanent Brain nodes.
   */
  private static day(value: unknown): string {
    const d = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(d.getTime()) ? 'an earlier date' : d.toISOString().slice(0, 10);
  }

  /** Past decisions as prompt text, numbered so the model can point at one. */
  private renderPast(past: CouncilSession[]): string {
    if (past.length === 0) return '';
    const lines = ['', '', 'EARLIER DECISIONS BY THIS COUNCIL (most recent first):'];
    past.forEach((s, i) => {
      const on = CouncilService.day(s.createdAt);
      lines.push(`[${i}] ${on} — "${s.question}"`);
      lines.push(`     Verdict: ${s.verdict?.verdict ?? ''}`);
      if (s.outcome) lines.push(`     Outcome recorded: ${s.outcome}`);
    });
    lines.push(
      'If the current question would reverse or undercut one of these, say so plainly in the verdict and name it.'
    );
    return lines.join('\n');
  }

  /**
   * Record that this decision reverses an earlier one, as a `contradicts` edge
   * between the two Decision nodes (spec §7). The edge type already existed;
   * nothing had ever written one.
   */
  private async linkContradiction(
    businessId: string,
    fromNodeId: string,
    toNodeId: string
  ): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO brain_edges (business_id, from_node_id, to_node_id, relationship_type, created_by)
              VALUES ($1, $2, $3, 'contradicts', 'system')
         ON CONFLICT (from_node_id, to_node_id, relationship_type)
           WHERE to_node_id IS NOT NULL DO NOTHING`,
        [businessId, fromNodeId, toNodeId]
      );
    } catch {
      // A missing link must not fail a verdict the user already paid for.
    }
  }

  /** Call 1 — four opening positions in one structured response. */
  private async openingPositions(question: string, briefing: string): Promise<MemberPosition[]> {
    const roster = COUNCIL_MEMBERS.map((m) => `${m.name}\n${m.brief}`).join('\n\n');

    const json = await this.ask(
      MODEL,
      OPENINGS_MAX_TOKENS,
      `You are running a decision council for a small business owner. Four specialists each give an opening position on the owner's question, from their own priorities only.\n\n` +
        `${roster}\n\n${GUARDRAILS}\n\n` +
        `Reply with ONLY a JSON array, no markdown fence, no preamble:\n` +
        `[{"member":"The Accountant / CFO","position":"..."}, ...] — all four, in the order above. ` +
        `Each position is at most 90 words, concrete, and grounded in the briefing's real figures.`,
      `QUESTION FROM THE OWNER:\n${question}\n\nFINANCIAL BRIEFING (every figure computed from their books):\n${briefing}`
    );

    const parsed = this.parseJson<MemberPosition[]>(json);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('The Council could not form its opening positions.');
    }
    return parsed
      .filter((p) => p && typeof p.position === 'string')
      .map((p) => ({ member: String(p.member ?? 'Member'), position: p.position }));
  }

  /**
   * Call 2 — the members read the openings, attack the weakest points, and
   * Finna synthesizes. Carrying the openings back in is what makes the
   * disagreement real rather than performed.
   */
  private async crossExamineAndSynthesize(
    question: string,
    briefing: string,
    openings: MemberPosition[],
    pastCount: number
  ): Promise<{
    crossExamination: MemberPosition[];
    verdict: CouncilVerdict;
    contradictsIndex: number | null;
  }> {
    const positions = openings.map((o) => `${o.member}: ${o.position}`).join('\n\n');

    const json = await this.ask(
      SYNTHESIS_MODEL,
      VERDICT_MAX_TOKENS,
      `You are chairing a decision council. The four specialists have given their opening positions. Now: each challenges the WEAKEST point in the others' reasoning, states what would change its mind, and lands on a vote. Then you, as chair, synthesize. You do not vote.\n\n` +
        `${GUARDRAILS}\n\n` +
        `Reply with ONLY a JSON object, no markdown fence, no preamble:\n` +
        `{"crossExamination":[{"member":"...","position":"the challenge and what would change my mind, max 70 words","vote":"support|oppose|conditional"}],` +
        `"verdict":"one clear paragraph, no hedging",` +
        `"votes":[{"member":"...","vote":"support|oppose|conditional","because":"max 20 words"}],` +
        `"keyTension":"the single most important disagreement, stated plainly",` +
        `"conditions":["what must be true for the recommendation to hold"],` +
        `"watchItems":["specific metrics to monitor"],` +
        `"nextAction":"one concrete step",` +
        (pastCount > 0
          ? `"contradicts":<the [index] of an EARLIER DECISION this reverses, or null if none>}\n\n`
          : `"contradicts":null}\n\n`) +
        `Where the members genuinely disagree, keep the disagreement visible in the verdict — do not paper over it.`,
      `QUESTION:\n${question}\n\nFINANCIAL BRIEFING:\n${briefing}\n\nOPENING POSITIONS:\n${positions}`
    );

    const parsed = this.parseJson<any>(json);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('The Council could not reach a verdict.');
    }

    const validVote = (v: unknown): Vote =>
      v === 'support' || v === 'oppose' || v === 'conditional' ? v : 'conditional';

    /**
     * Only trust an index that actually points at a decision we showed it.
     *
     * Check the RAW value before coercing. `Number(null)` is 0, and 0 is a
     * valid index — so coercing first turned the model's correct "nothing is
     * reversed" answer into "this reverses your most recent decision", and
     * that lie was then written into a permanent Brain node and a `contradicts`
     * edge. Strings are accepted because models quote numbers about as often
     * as they don't.
     */
    const raw = parsed.contradicts;
    const rawIndex =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && raw.trim() !== ''
          ? Number(raw)
          : NaN;
    const contradictsIndex =
      Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < pastCount ? rawIndex : null;

    return {
      contradictsIndex,
      crossExamination: Array.isArray(parsed.crossExamination)
        ? parsed.crossExamination
            .filter((c: any) => c && typeof c.position === 'string')
            .map((c: any) => ({
              member: String(c.member ?? 'Member'),
              position: c.position,
              vote: validVote(c.vote),
            }))
        : [],
      verdict: {
        verdict: String(parsed.verdict ?? '').trim() || 'The Council could not reach a clear verdict.',
        votes: Array.isArray(parsed.votes)
          ? parsed.votes.map((v: any) => ({
              member: String(v.member ?? 'Member'),
              vote: validVote(v.vote),
              because: String(v.because ?? '').slice(0, 200),
            }))
          : [],
        keyTension: String(parsed.keyTension ?? '').trim(),
        conditions: this.stringList(parsed.conditions),
        watchItems: this.stringList(parsed.watchItems),
        nextAction: String(parsed.nextAction ?? '').trim(),
      },
    };
  }

  /**
   * Every completed session becomes a Decision node in the Company Brain
   * (spec §7). Free — this is metadata from a session that already ran, not
   * another AI call.
   */
  private async writeDecisionNode(
    businessId: string,
    userId: string | null,
    question: string,
    verdict: CouncilVerdict,
    ctx: CouncilContext,
    contradicted?: CouncilSession | null
  ): Promise<string | null> {
    try {
      const categoryId = await this.ceoCategoryId(businessId);
      const body = [
        `**Question:** ${question}`,
        '',
        `**Verdict:** ${verdict.verdict}`,
        '',
        verdict.votes.length
          ? `**Vote:** ${verdict.votes.map((v) => `${v.member} — ${v.vote}`).join('; ')}`
          : '',
        verdict.keyTension ? `\n**Key tension:** ${verdict.keyTension}` : '',
        verdict.conditions.length
          ? `\n**Conditions:**\n${verdict.conditions.map((c) => `- ${c}`).join('\n')}`
          : '',
        verdict.watchItems.length
          ? `\n**Watch:**\n${verdict.watchItems.map((w) => `- ${w}`).join('\n')}`
          : '',
        verdict.nextAction ? `\n**Next action:** ${verdict.nextAction}` : '',
        contradicted
          ? `\n**Reverses an earlier decision:** "${contradicted.question}" (${CouncilService.day(contradicted.createdAt)})`
          : '',
        `\n_Decided ${new Date().toISOString().slice(0, 10)}. Cash at the time: ${ctx.cash}._`,
      ]
        .filter(Boolean)
        .join('\n');

      const node = await this.brain.createNode(businessId, userId, {
        title: `Decision: ${question.slice(0, 200)}`,
        content: body,
        type: 'note',
        categoryId,
        source: 'council',
        payload: { council: true },
      });
      return node.id;
    } catch {
      // A Brain write must never lose the verdict the user just paid for.
      return null;
    }
  }

  private async ceoCategoryId(businessId: string): Promise<string | null> {
    const result = await this.database.query(
      `SELECT id FROM brain_categories
        WHERE business_id = $1 AND slug = 'ceo' AND status = 'active'`,
      [businessId]
    );
    return result.rows[0]?.id ?? null;
  }

  private stringList(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v.map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, 6);
  }

  /**
   * Models wrap JSON in prose or a markdown fence often enough that trusting a
   * bare parse would fail sessions the user already paid for. Strip to the
   * outermost bracket pair before parsing.
   */
  private parseJson<T>(raw: string): T | null {
    const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
    const start = cleaned.search(/[[{]/);
    if (start === -1) return null;
    const open = cleaned[start];
    const close = open === '[' ? ']' : '}';
    const end = cleaned.lastIndexOf(close);
    if (end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }

  private async ask(
    model: string,
    maxTokens: number,
    system: string,
    user: string
  ): Promise<string> {
    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: user }],
        }),
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
    } catch (error) {
      // A timeout must surface as a failed session, not a hung request — the
      // catch in `convene` marks the row failed so the user sees an error.
      throw new Error(
        (error as Error)?.name === 'TimeoutError'
          ? 'The Council timed out waiting for the AI service.'
          : 'The Council could not reach the AI service.'
      );
    }

    if (!res.ok) {
      throw new Error(`The Council could not reach the AI service (${res.status}).`);
    }
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = json.content?.find((c) => c.type === 'text')?.text?.trim();
    if (!text) throw new Error('The Council returned an empty response.');
    return text;
  }
}
