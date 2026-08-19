import { Database } from '../../infrastructure/database';
import { BrainRepository } from './brain.repository';
import { HealthScore, Ratio, RatioKey } from '../health/health.types';

/**
 * Insight nodes — spec 06 §5.1.
 *
 * "Financial Health Score readings and notable ratio movements, written by
 * deterministic code when a threshold is crossed."
 *
 * The platform already computes all of this on every dashboard load and then
 * throws it away. The nudges service notices the same movements, but a nudge is
 * disposable: press Dismiss and the observation is gone. An insight node is
 * permanent and sits in the graph, so six months later "margin went negative in
 * March" is still there next to the decision that was made that month, and the
 * two can be linked.
 *
 * ZERO AI. Every sentence here is assembled by code from numbers the ledger
 * already produced. This is the cheapest thing in the Brain and must stay that
 * way — an insight is a fact about the books, not an opinion about them.
 */

/** The bands `buildSummaryParts` already uses for the overall score. */
type Band = 'strong' | 'stable' | 'weak' | 'strained';

const scoreBand = (score: number): Band =>
  score >= 80 ? 'strong' : score >= 60 ? 'stable' : score >= 40 ? 'weak' : 'strained';

/**
 * The line that matters for each ratio, taken from the scoring functions in
 * health.service rather than invented here — a business is either on the
 * healthy side of these or it isn't, and the score already treats them as the
 * meaningful boundary.
 */
const RATIO_THRESHOLDS: Record<RatioKey, { at: number; above: string; below: string }> = {
  // "below 1.0 you can't cover bills"
  liquidity: { at: 1, above: 'can cover', below: 'cannot cover' },
  // "losing money scores zero"
  profitability: { at: 0, above: 'profitable', below: 'unprofitable' },
  // "2x equity or worse scores zero" — inverted: HIGHER is worse here
  debtRisk: { at: 2, above: 'overleveraged', below: 'sustainable' },
  // "covering short-term bills 1x over is a full score"
  cashFlow: { at: 1, above: 'covering', below: 'not covering' },
};

/** Which side of its threshold a ratio currently sits on. */
function ratioSide(r: Ratio): string | null {
  if (r.value === null) return null; // not computable — no side to be on
  const t = RATIO_THRESHOLDS[r.key];
  if (!t) return null;
  return r.value >= t.at ? t.above : t.below;
}

interface Crossing {
  metric: string;
  from: string;
  to: string;
  title: string;
  content: string;
  payload: Record<string, unknown>;
}

export class BrainInsightsService {
  private readonly brain: BrainRepository;

  constructor(private readonly database: Database) {
    this.brain = new BrainRepository(database);
  }

  async ensureSchema(): Promise<void> {
    /**
     * One row per metric per business, holding the side of the line it was last
     * seen on. This is what makes the writer idempotent: a dashboard refreshed
     * twenty times in an afternoon produces one insight, not twenty.
     *
     * Deliberately NOT derived by querying the last insight node — a user can
     * archive or delete a node, and doing so must not make the same crossing
     * fire again.
     */
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS brain_insight_state (
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        metric_key VARCHAR(40) NOT NULL,
        side VARCHAR(24) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (business_id, metric_key)
      );
    `);
  }

  /**
   * Compare the current reading against what was last seen and write a node for
   * anything that has crossed. Safe to call on every health-score request.
   *
   * Never throws: an insight is a nice-to-have and must not be able to take
   * down the health score, which is the thing the user actually asked for.
   */
  async record(businessId: string, health: HealthScore): Promise<number> {
    try {
      // Thin data produces meaningless readings, and the score itself refuses
      // to report until it has ~30 days. Writing insights off a number the
      // product declines to show would be worse than writing nothing.
      if (!health.ready || health.score === null) return 0;

      const observed = this.observe(health);
      const previous = await this.loadState(businessId);

      const crossings: Crossing[] = [];
      for (const [metric, side] of Object.entries(observed)) {
        const before = previous[metric];
        // No prior reading: record where they are and say nothing. You cannot
        // cross a line you have never been on a side of, and a new business
        // should not open the Brain to a wall of insights about its first day.
        if (before === undefined) continue;
        if (before === side) continue;
        const crossing = this.describe(metric, before, side, health);
        if (crossing) crossings.push(crossing);
      }

      for (const c of crossings) {
        await this.write(businessId, c);
      }

      await this.saveState(businessId, observed);
      return crossings.length;
    } catch {
      // Swallowed on purpose — see the doc comment.
      return 0;
    }
  }

  /** The current side of every line we watch. */
  private observe(health: HealthScore): Record<string, string> {
    const out: Record<string, string> = {};
    if (health.score !== null) out.score = scoreBand(health.score);
    for (const r of health.ratios) {
      const side = ratioSide(r);
      if (side) out[`ratio:${r.key}`] = side;
    }
    return out;
  }

  private async loadState(businessId: string): Promise<Record<string, string>> {
    const r = await this.database.query(
      'SELECT metric_key, side FROM brain_insight_state WHERE business_id = $1',
      [businessId]
    );
    const out: Record<string, string> = {};
    for (const row of r.rows) out[row.metric_key] = row.side;
    return out;
  }

  private async saveState(businessId: string, observed: Record<string, string>): Promise<void> {
    for (const [metric, side] of Object.entries(observed)) {
      await this.database.query(
        `INSERT INTO brain_insight_state (business_id, metric_key, side, updated_at)
              VALUES ($1, $2, $3, NOW())
         ON CONFLICT (business_id, metric_key)
         DO UPDATE SET side = EXCLUDED.side, updated_at = NOW()`,
        [businessId, metric, side]
      );
    }
  }

  /**
   * Turn a crossing into a sentence. English, like `HealthScore.summary` —
   * stored text cannot be re-rendered per reader the way the nudge message
   * keys are, so the structured payload is kept alongside for a later i18n
   * pass to work from.
   */
  private describe(
    metric: string,
    from: string,
    to: string,
    health: HealthScore
  ): Crossing | null {
    const on = new Date().toISOString().slice(0, 10);

    if (metric === 'score') {
      const better = ['strained', 'weak', 'stable', 'strong'].indexOf(to) >
        ['strained', 'weak', 'stable', 'strong'].indexOf(from);
      return {
        metric, from, to,
        title: `Financial health moved from ${from} to ${to}`,
        content:
          `The overall health score is now ${health.score}, which reads as **${to}** — ` +
          `${better ? 'up' : 'down'} from **${from}**.\n\n` +
          `Recorded automatically on ${on} when the score crossed a band. ` +
          `The four ratios behind it are liquidity, profitability, debt risk and cash flow.`,
        payload: { kind: 'score_band', from, to, score: health.score, on },
      };
    }

    const key = metric.replace('ratio:', '') as RatioKey;
    const ratio = health.ratios.find((r) => r.key === key);
    if (!ratio) return null;

    const shown = ratio.value === null
      ? 'n/a'
      : ratio.format === 'percent'
        ? `${ratio.value}%`
        : `${ratio.value}×`;

    return {
      metric, from, to,
      title: `${ratio.name} is now ${to} (${shown})`,
      content:
        `**${ratio.name}** (${ratio.label}) moved from *${from}* to *${to}*, now at ${shown}.\n\n` +
        // `insight` is what THIS business's number means given its own data;
        // `explanation` is the generic definition. Prefer the specific one.
        `${ratio.insight || ratio.explanation || ''}\n\n` +
        `Recorded automatically on ${on} when this crossed the threshold the health score treats as the dividing line.`,
      payload: { kind: 'ratio', ratio: key, from, to, value: ratio.value, on },
    };
  }

  /** Insights file under Finance — they are facts about the books. */
  private async write(businessId: string, c: Crossing): Promise<void> {
    const category = await this.database.query(
      `SELECT id FROM brain_categories
        WHERE business_id = $1 AND slug = 'finance' AND status = 'active'`,
      [businessId]
    );

    await this.brain.createNode(businessId, null, {
      type: 'insight',
      title: c.title,
      content: c.content,
      // `system`, not `manual` or `council` — the provenance line in the UI
      // should say this came from the platform reading its own numbers.
      source: 'system',
      categoryId: category.rows[0]?.id ?? null,
      payload: c.payload,
    });
  }
}
