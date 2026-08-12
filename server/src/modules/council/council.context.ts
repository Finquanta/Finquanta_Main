import { Database } from '../../infrastructure/database';
import { AccountingRepository } from '../accounting/accounting.repository';
import { GroupsRepository } from '../groups/groups.repository';
import { HealthRepository } from '../health/health.repository';
import { ProfileRepository } from '../profile/profile.repository';
import { computeHealthScore, computeRunway, PERIOD_DAYS, Runway } from '../health/health.service';
import { HealthContext } from '../health/health.types';

/**
 * The Council's financial briefing (spec 07 §3.2).
 *
 * Every figure here is computed by CODE and injected. The members interpret
 * numbers; they never calculate them. That is a correctness decision before it
 * is a cost one — a model doing arithmetic over a ledger will eventually get it
 * wrong, and a confidently wrong figure in a recommendation is worse than no
 * recommendation. It also means the Council can never disagree with the
 * dashboard, because both read the same repositories.
 *
 * No AI call happens in this file.
 */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const money = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;

export interface CouncilContext {
  business: {
    name?: string;
    industry?: string;
    niche?: string;
    maturityStage?: string;
    primaryGoal?: string;
  };
  cash: number;
  receivables: number;
  payables: number;
  loanPayable: number;
  loanReceivable: number;
  /** Over the health score's window (90 days). */
  revenue: number;
  expenses: number;
  operatingCashFlow: number;
  periodDays: number;
  healthScore: number | null;
  healthReady: boolean;
  daysOfData: number;
  ratios: { name: string; value: number | null; format: string; score: number }[];
  groups: { name: string; net: number }[];
  /**
   * Burn rate and months of cash left (spec §3.2), computed from operating
   * cash flow — see computeRunway. Not stated when there's too little history
   * to average honestly.
   */
  runway: Runway;
  /**
   * What the platform genuinely cannot answer yet. The prompt forbids guessing
   * at these — same posture the Finance pin takes on bill due dates.
   */
  unavailable: string[];
}

export class CouncilContextService {
  private readonly ledger: AccountingRepository;
  private readonly groups: GroupsRepository;
  private readonly health: HealthRepository;
  private readonly profiles: ProfileRepository;

  constructor(private readonly database: Database) {
    this.ledger = new AccountingRepository(database);
    this.groups = new GroupsRepository(database);
    this.health = new HealthRepository(database);
    this.profiles = new ProfileRepository(database);
  }

  async assemble(businessId: string): Promise<CouncilContext> {
    /**
     * Bring the books up to date BEFORE reading them.
     *
     * Every other consumer of these repositories resyncs first — health.routes,
     * brain.pins, dashboard.repository, accounting.routes, activity.routes —
     * because a figure computed from stale postings is wrong. This briefing is
     * handed to the model as "every figure computed from their books" and the
     * verdict it produces is written into the Brain as a permanent record, so
     * it is the last read in the product that should be skipping this.
     */
    await this.ledger.resyncBookkeeping(businessId);

    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [daysOfData, snapshot, previous, business, balances] = await Promise.all([
      this.health.daysOfData(businessId),
      this.health.snapshot(businessId, iso(today), PERIOD_DAYS),
      this.health.snapshot(businessId, iso(monthAgo), PERIOD_DAYS),
      this.profiles.getBusiness(businessId),
      this.ledger.getBalances(businessId),
    ]);

    const healthContext: HealthContext = {
      maturityStage: business.maturityStage,
      industry: business.industry,
      niche: business.niche,
      hasDebt: business.hasDebt,
      primaryGoal: business.primaryGoal,
    };
    const health = computeHealthScore(
      snapshot,
      daysOfData >= 30 ? previous : null,
      daysOfData,
      healthContext
    );

    const cash = money(balances.find((b: any) => b.code === 'CASH')?.balance ?? snapshot.cash);

    return {
      business: {
        name: business.businessName,
        industry: business.industry,
        niche: business.niche,
        maturityStage: business.maturityStage,
        primaryGoal: business.primaryGoal,
      },
      cash,
      receivables: money(snapshot.receivables),
      payables: money(snapshot.payables),
      loanPayable: money(snapshot.loanPayable),
      loanReceivable: money(snapshot.loanReceivable),
      revenue: money(snapshot.revenue),
      expenses: money(snapshot.expenses),
      operatingCashFlow: money(snapshot.operatingCashFlow),
      periodDays: PERIOD_DAYS,
      healthScore: health.score,
      healthReady: health.ready,
      daysOfData,
      ratios: health.ratios.map((r) => ({
        name: r.name,
        value: r.value,
        format: r.format,
        score: r.score,
      })),
      groups: await this.groupTotals(businessId),
      runway: computeRunway(snapshot, cash, daysOfData, PERIOD_DAYS),
      unavailable: ['upcoming bill due dates (no due-date model exists)'],
    };
  }

  /** Net contribution per Business Group, when the user has created any. */
  private async groupTotals(businessId: string): Promise<{ name: string; net: number }[]> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - PERIOD_DAYS);
      const report = await this.groups.getGroupReport(businessId, iso(since), iso(new Date()));
      return (report ?? [])
        .map((g: any) => ({ name: String(g.name ?? ''), net: money(g.net ?? g.netContribution) }))
        .filter((g) => g.name)
        .slice(0, 10);
    } catch {
      // Groups are optional — a business with none still gets a full briefing.
      return [];
    }
  }

  /**
   * The briefing as prompt text.
   *
   * Written as plain labelled lines rather than JSON: the members read it, they
   * don't parse it, and prose costs fewer tokens than braces and quotes.
   */
  static render(ctx: CouncilContext): string {
    const lines: string[] = [];
    const b = ctx.business;

    lines.push(`Business: ${b.name ?? 'unnamed'}`);
    if (b.industry) lines.push(`Industry: ${b.industry}${b.niche ? ` (${b.niche})` : ''}`);
    if (b.maturityStage) lines.push(`Stage: ${b.maturityStage}`);
    if (b.primaryGoal) lines.push(`Stated primary goal: ${b.primaryGoal}`);

    lines.push('', 'POSITION TODAY');
    lines.push(`Cash: ${ctx.cash}`);
    lines.push(`Owed to the business (receivables): ${ctx.receivables}`);
    lines.push(`Owed by the business (payables): ${ctx.payables}`);
    lines.push(`Loans payable: ${ctx.loanPayable}`);
    lines.push(`Loans receivable: ${ctx.loanReceivable}`);

    lines.push('', `LAST ${ctx.periodDays} DAYS`);
    lines.push(`Revenue: ${ctx.revenue}`);
    lines.push(`Expenses: ${ctx.expenses}`);
    lines.push(`Operating cash flow (excludes borrowing/lending): ${ctx.operatingCashFlow}`);

    lines.push('', 'BURN AND RUNWAY');
    if (ctx.runway.status === 'insufficient_data') {
      lines.push(
        `Not calculable — only ${ctx.runway.basedOnDays} days of data. Do NOT estimate a burn rate or runway.`
      );
    } else if (ctx.runway.status === 'profitable') {
      lines.push(
        `Operations are cash-positive over the last ${ctx.runway.basedOnDays} days, so the business is not burning cash. There is no runway figure to give.`
      );
    } else {
      lines.push(`Monthly burn (operating cash out): ${ctx.runway.monthlyBurn}`);
      lines.push(`Runway at that burn: ${ctx.runway.runwayMonths} months`);
      lines.push(`(Averaged over ${ctx.runway.basedOnDays} days. Excludes borrowing and lending.)`);
    }

    lines.push('', 'FINANCIAL HEALTH');
    if (!ctx.healthReady) {
      lines.push(
        `Not yet available — only ${ctx.daysOfData} days of data recorded (30 needed).` +
          ` Do NOT give confident financial recommendations from this little history; say so.`
      );
    } else {
      lines.push(`Overall score: ${ctx.healthScore}/100`);
      for (const r of ctx.ratios) {
        lines.push(`- ${r.name}: ${r.value ?? 'not computable'} (score ${r.score}/100)`);
      }
    }

    if (ctx.groups.length) {
      lines.push('', 'BUSINESS GROUPS (net contribution)');
      for (const g of ctx.groups) lines.push(`- ${g.name}: ${g.net}`);
    }

    lines.push('', 'NOT AVAILABLE — do not estimate or invent these:');
    for (const u of ctx.unavailable) lines.push(`- ${u}`);

    return lines.join('\n');
  }
}
