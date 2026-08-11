import { createHash } from 'crypto';
import { Database } from '../../infrastructure/database';
import { AiUsageRepository } from '../ai-usage/ai-usage.repository';
import { BrainRepository, MIN_SUMMARY_CHARS } from './brain.repository';

/**
 * Background enrichment for the Company Brain (spec §7).
 *
 * Two jobs run after a note is saved:
 *   1. AUTO-LINKING — find notes that read like this one and draw suggested
 *      edges. Pure Postgres similarity, so it costs nothing and is on by
 *      default.
 *   2. AUTO-SUMMARIZATION — one short Haiku call per changed note. This costs
 *      real money, so it is OFF for every business until someone turns it on.
 *
 * Every guardrail in §7.1 is implemented here, because this is the one place in
 * Finquanta that spends money without a user pressing a button:
 *
 *   - DEBOUNCE      a save resets an 8s timer; a burst of edits collapses to one run
 *   - BATCH         work happens off the request, never inline on the save
 *   - CHEAP MODEL   Haiku only, 160 max tokens, never routed to a larger model
 *   - NO GENERATION FOR LINKS  similarity alone drives auto-linking
 *   - PER-BUSINESS CAP  daily, configurable, clamped to 500 server-side
 *   - GLOBAL CEILING    a hard daily stop across all businesses
 *   - IDEMPOTENT    keyed on a content hash; unchanged notes are never reprocessed
 *
 * No cron, no polling, no reprocessing of untouched content.
 */

/** §7.1: "cheapest suitable model … never route this to a larger model." */
const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 160;
/** Long enough that typing a paragraph is one run, short enough to feel live. */
const DEBOUNCE_MS = 8000;
/**
 * Hard stop across every business on the platform, per day.
 *
 * Deliberately low while the Anthropic balance is small: at worst-case note
 * size a summary costs about $0.002, so 100/day caps a runaway at roughly 20c
 * rather than a whole prepaid balance. A ceiling that sits above the account's
 * total credit isn't a safety net.
 *
 * RAISE THIS before onboarding real users — with the per-business cap at 50,
 * only two workspaces can reach their own limit in a day at this value.
 */
const GLOBAL_DAILY_CEILING = 100;
const MAX_SUGGESTED_LINKS = 5;

const hashOf = (title: string, content: string | null) =>
  createHash('sha256').update(`${title}\n${content ?? ''}`).digest('hex').slice(0, 32);

export class BrainEnrichService {
  private repo: BrainRepository;
  private usage: AiUsageRepository;
  /** nodeId → pending debounce timer. */
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(private database: Database) {
    this.repo = new BrainRepository(database);
    this.usage = new AiUsageRepository(database);
  }

  /**
   * Called after a note is created or edited. Returns immediately — the caller
   * is a request handler and must never wait on this.
   */
  schedule(businessId: string, nodeId: string): void {
    const existing = this.timers.get(nodeId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.timers.delete(nodeId);
      // Detached on purpose: nothing awaits this, and a failure must never
      // surface as a failed save. The note is already stored.
      this.run(businessId, nodeId).catch(() => undefined);
    }, DEBOUNCE_MS);

    // Don't hold the process open for a pending summary at shutdown.
    if (typeof timer.unref === 'function') timer.unref();
    this.timers.set(nodeId, timer);
  }

  /** Cancel pending work for a node that's been deleted or archived. */
  cancel(nodeId: string): void {
    const existing = this.timers.get(nodeId);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(nodeId);
    }
  }

  /**
   * One enrichment pass. Public so a route can force a run for testing without
   * waiting out the debounce.
   */
  async run(businessId: string, nodeId: string): Promise<{
    linked: number; summarized: boolean; skipped: string | null;
  }> {
    const settings = await this.repo.getSettings(businessId);

    // Read the node fresh: between the debounce firing and now the user may
    // have archived it, deleted it, or reverted their edit.
    const claimed = await this.repo.getNodeForEnrichment(businessId, nodeId);
    if (!claimed) return { linked: 0, summarized: false, skipped: 'gone' };

    const { node, storedHash } = claimed;
    const hash = hashOf(node.title, node.content);
    // §7.1: "Re-run only when a note changes." Same text, no work, no spend.
    if (storedHash === hash) return { linked: 0, summarized: false, skipped: 'unchanged' };

    const text = `${node.title}\n${node.content ?? ''}`;

    // --- Auto-linking. No AI call, so no cap and no credit check. -----------
    let linked = 0;
    if (settings.autoLink) {
      const matches = await this.repo.findSimilar(
        businessId, nodeId, text, MAX_SUGGESTED_LINKS
      );
      linked = await this.repo.applySuggestedLinks(
        businessId, nodeId, matches.map((m) => m.id)
      );
    }

    // --- Summarization. Everything below spends money. ----------------------
    let summary: string | null = null;
    let skipped: string | null = null;

    if (!settings.autoSummarize) {
      skipped = 'summaries_off';
    } else if (!process.env.ANTHROPIC_API_KEY) {
      skipped = 'no_api_key';
    } else if ((node.content ?? '').trim().length < MIN_SUMMARY_CHARS) {
      // A two-line note is its own summary. Paying to shorten it is waste.
      skipped = 'too_short';
    } else {
      const perBusiness = await this.usage.incrementAndGet(`brain:${businessId}`);
      const global = await this.usage.incrementAndGet('brain:global');
      if (perBusiness > settings.dailySummaryCap) skipped = 'business_cap';
      else if (global > GLOBAL_DAILY_CEILING) skipped = 'global_cap';
      else summary = await this.summarize(node.title, node.content ?? '');
    }

    // The hash is stored either way, so a note that was only linked isn't
    // reconsidered on every later save.
    await this.repo.saveEnrichment(businessId, nodeId, hash, summary);
    return { linked, summarized: summary !== null, skipped };
  }

  /**
   * One short Haiku call, over plain fetch.
   *
   * Deliberately no SDK: the server has no AI dependency today, and the
   * Messages API is one POST. Adding @anthropic-ai/sdk here would mean a new
   * server dependency and a lockfile change on a build that has bitten this
   * project before.
   */
  private async summarize(title: string, content: string): Promise<string | null> {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system:
            'Summarize this business note in one sentence, maximum 25 words. ' +
            'Write only the summary — no preamble, no quotes, no markdown. ' +
            'Keep the author\'s own terms for their business.',
          messages: [{
            role: 'user',
            // Truncated: a summary never needs the whole note, and tokens are
            // the cost driver.
            content: `${title}\n\n${content.slice(0, 4000)}`,
          }],
        }),
      });

      if (!res.ok) return null;
      const json = await res.json() as { content?: { type: string; text?: string }[] };
      const text = json.content?.find((c) => c.type === 'text')?.text?.trim();
      return text ? text.slice(0, 400) : null;
    } catch {
      // A failed summary is not a failed save. The note keeps its old summary
      // (or none) and the next edit tries again.
      return null;
    }
  }
}
