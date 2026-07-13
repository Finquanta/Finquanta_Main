import { FinancialSnapshot, HealthContext, HealthScore, Ratio } from './health.types';

/**
 * Section 11 — the Financial Health Score.
 *
 * This is deterministic code, not an AI call. The numbers and the reasoning are
 * computed here; Finna's job (Section 12) is to talk about them, not to work
 * them out. That keeps the score consistent, instant and free.
 */

/** Roughly a month of data before the first score, per the spec. */
export const DAYS_REQUIRED = 30;

/** Profit and cash-flow figures cover a trailing quarter. */
export const PERIOD_DAYS = 90;

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Equity is derived from the accounting identity (Assets − Liabilities) rather
 * than read off the Equity account. The ledger is always balanced, so this can't
 * drift out of step with the books, and it correctly includes profit the
 * business has retained but never formally closed out to equity.
 */
function equityOf(s: FinancialSnapshot): number {
  const assets = s.cash + s.receivables + s.loanReceivable;
  const liabilities = s.payables + s.loanPayable;
  return assets - liabilities;
}

/**
 * Each ratio is scored 0–100 against a threshold where a business is comfortably
 * healthy. The curves are deliberately gentle: this is a nudge, not a credit
 * rating.
 */

/** Current Ratio — 2.0 or better is a full score; below 1.0 you can't cover bills. */
function scoreLiquidity(ratio: number | null): number {
  if (ratio === null) return 100; // nothing owed short-term — nothing to fail at
  return clamp((ratio / 2) * 100);
}

/** Net Profit Margin — 20% or better is a full score; losing money scores zero. */
function scoreProfitability(marginPct: number | null): number {
  if (marginPct === null) return 0; // no revenue yet is not profitable
  return clamp((marginPct / 20) * 100);
}

/** Debt-to-Equity — no debt is a full score; 2× equity or worse scores zero. */
function scoreDebtRisk(de: number | null, equity: number): number {
  if (equity <= 0) return 0; // owing more than the business is worth
  if (de === null) return 100; // no debt at all
  return clamp(100 - de * 50);
}

/** Operating Cash Flow Ratio — covering short-term bills 1× over is a full score. */
function scoreCashFlow(ratio: number | null, ocf: number): number {
  if (ratio === null) return ocf >= 0 ? 100 : 0; // no bills; only the sign matters
  return clamp(ratio * 100);
}

function buildRatios(s: FinancialSnapshot, prev: FinancialSnapshot | null, ctx: HealthContext): Ratio[] {
  const currentAssets = s.cash + s.receivables;
  const currentLiabilities = s.payables;
  /**
   * Debt here means BORROWED money — loans — not everything the business owes.
   * An unpaid supplier bill isn't borrowing, and it already drives both the
   * liquidity and cash-flow ratios; counting it again as "debt risk" would
   * penalise the same money twice. Equity still nets off every liability.
   */
  const totalDebt = s.loanPayable;
  const equity = equityOf(s);
  const netProfit = s.revenue - s.expenses;

  const liquidity = currentLiabilities > 0 ? currentAssets / currentLiabilities : null;
  const margin = s.revenue > 0 ? (netProfit / s.revenue) * 100 : null;
  // Undefined with no debt (nothing to measure) and with no equity (nothing to
  // measure it against) — the score function handles both cases directly.
  const debtToEquity = totalDebt > 0 && equity > 0 ? totalDebt / equity : null;
  const ocfRatio = currentLiabilities > 0 ? s.operatingCashFlow / currentLiabilities : null;

  // The same four numbers a month ago, for the trend arrows.
  const before = prev
    ? {
        liquidity: prev.payables > 0 ? (prev.cash + prev.receivables) / prev.payables : null,
        margin: prev.revenue > 0 ? ((prev.revenue - prev.expenses) / prev.revenue) * 100 : null,
        debtToEquity:
          prev.payables + prev.loanPayable > 0 && equityOf(prev) > 0
            ? (prev.payables + prev.loanPayable) / equityOf(prev)
            : null,
        ocfRatio: prev.payables > 0 ? prev.operatingCashFlow / prev.payables : null,
      }
    : null;

  const delta = (now: number | null, then: number | null | undefined) =>
    now !== null && then !== null && then !== undefined ? round1(now - then) : null;

  const young = ctx.maturityStage === 'Idea' || ctx.maturityStage === 'Startup';

  return [
    {
      key: 'liquidity',
      name: 'Current Ratio',
      label: 'Liquidity',
      value: liquidity === null ? null : round1(liquidity),
      format: 'ratio',
      score: Math.round(scoreLiquidity(liquidity)),
      trend: delta(liquidity, before?.liquidity),
      explanation:
        'Your current ratio shows how easily your business can pay upcoming bills and short-term debts. A higher ratio generally means stronger short-term stability.',
      insight:
        liquidity === null
          ? "You have no short-term bills outstanding, so there's nothing straining your cash right now."
          : liquidity >= 2
            ? `You hold $${Math.round(currentAssets).toLocaleString()} in cash and money owed to you against $${Math.round(currentLiabilities).toLocaleString()} in bills — comfortably able to cover what's due.`
            : liquidity >= 1
              ? `You can cover your bills, but not by much: $${Math.round(currentAssets).toLocaleString()} available against $${Math.round(currentLiabilities).toLocaleString()} owed. A late-paying customer would squeeze you.`
              : `Your bills ($${Math.round(currentLiabilities).toLocaleString()}) are larger than the cash and receivables you have to meet them ($${Math.round(currentAssets).toLocaleString()}). Chase what you're owed before taking on more commitments.`,
      note: liquidity === null ? 'No short-term liabilities recorded.' : undefined,
    },
    {
      key: 'profitability',
      name: 'Net Profit Margin',
      label: 'Profitability',
      value: margin === null ? null : round1(margin),
      format: 'percent',
      score: Math.round(scoreProfitability(margin)),
      trend: delta(margin, before?.margin),
      explanation:
        'Your net profit margin shows how efficiently your business converts revenue into actual profit after expenses.',
      insight:
        margin === null
          ? young
            ? "You haven't recorded revenue yet. That's normal this early — once money starts coming in, this is the number to watch."
            : "No revenue recorded in this period, so there's no margin to measure. Record your income to see this."
          : margin >= 20
            ? `You keep about $${Math.round(margin)} of every $100 you earn after expenses — a strong margin.`
            : margin > 0
              ? `You keep about $${Math.round(margin)} of every $100 you earn. Expenses of $${Math.round(s.expenses).toLocaleString()} are eating most of your $${Math.round(s.revenue).toLocaleString()} in revenue.`
              : `You're spending more than you earn — $${Math.round(s.expenses).toLocaleString()} out against $${Math.round(s.revenue).toLocaleString()} in. Every sale is currently costing you money.`,
      note: margin === null ? 'No revenue recorded in this period.' : undefined,
    },
    {
      key: 'debtRisk',
      name: 'Debt-to-Equity',
      label: 'Debt Risk',
      value: debtToEquity === null ? null : round1(debtToEquity),
      format: 'ratio',
      score: Math.round(scoreDebtRisk(debtToEquity, equity)),
      trend: delta(debtToEquity, before?.debtToEquity),
      explanation:
        'This ratio shows how dependent your business is on borrowed money. Higher debt levels can increase financial risk.',
      insight:
        equity <= 0
          ? `Your business owes more ($${Math.round(s.payables + s.loanPayable).toLocaleString()}) than it owns. Until that turns around, taking on more borrowing is risky.`
          : totalDebt === 0
            ? 'You carry no loans, so borrowing costs you nothing and no lender has a claim on the business.'
            : debtToEquity! <= 1
              ? `You've borrowed $${Math.round(totalDebt).toLocaleString()} against $${Math.round(equity).toLocaleString()} of your own money in the business — a manageable level.`
              : `You've borrowed $${Math.round(totalDebt).toLocaleString()}, more than the $${Math.round(equity).toLocaleString()} of equity behind it. Review your repayment plan before borrowing further.`,
      note: totalDebt === 0 ? 'No loans recorded.' : equity <= 0 ? 'Equity is zero or negative.' : undefined,
    },
    {
      key: 'cashFlow',
      name: 'Operating Cash Flow Ratio',
      label: 'Cash Flow',
      value: ocfRatio === null ? null : round1(ocfRatio),
      format: 'ratio',
      score: Math.round(scoreCashFlow(ocfRatio, s.operatingCashFlow)),
      trend: delta(ocfRatio, before?.ocfRatio),
      explanation:
        'This shows whether your normal business operations generate enough cash to support your financial obligations.',
      insight:
        s.operatingCashFlow < 0
          ? `Your day-to-day operations used up $${Math.abs(Math.round(s.operatingCashFlow)).toLocaleString()} more cash than they brought in. Money borrowed or already banked is covering the gap.`
          : ocfRatio === null
            ? `Your operations generated $${Math.round(s.operatingCashFlow).toLocaleString()} in cash, and you have no short-term bills against it.`
            : ocfRatio >= 1
              ? `Your operations generated $${Math.round(s.operatingCashFlow).toLocaleString()} — more than enough to cover the $${Math.round(currentLiabilities).toLocaleString()} you owe.`
              : `Your operations generated $${Math.round(s.operatingCashFlow).toLocaleString()}, short of the $${Math.round(currentLiabilities).toLocaleString()} you owe. The business isn't yet funding its own bills.`,
      note: ocfRatio === null && s.operatingCashFlow >= 0 ? 'No short-term liabilities recorded.' : undefined,
    },
  ];
}

/**
 * The plain-language summary. It names the strongest and weakest areas and says
 * what to do — never just "this number is good".
 */
function buildSummary(score: number, ratios: Ratio[], ctx: HealthContext): string {
  const sorted = [...ratios].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  // buildRatios always returns four, but a summary is not worth crashing over.
  if (!best || !worst) return 'Not enough data to summarise your financial health yet.';

  const standing =
    score >= 80
      ? 'Your business is in strong financial shape.'
      : score >= 60
        ? 'Your business is financially stable overall.'
        : score >= 40
          ? 'Your business is holding together, but there are real weak spots.'
          : 'Your business is under financial strain.';

  const advice: Record<string, string> = {
    liquidity: 'Collect what you\'re owed and keep more cash on hand before taking on new bills.',
    profitability: 'Look at what you\'re spending — expenses are taking too much of what you earn.',
    debtRisk: 'Bring your borrowing down relative to what the business actually owns.',
    cashFlow: 'Focus on getting cash in the door from operations rather than relying on borrowing.',
  };

  const goalNudge =
    ctx.primaryGoal === 'Reduce expenses' && worst.key === 'profitability'
      ? ' That lines up with the goal you set at signup.'
      : ctx.primaryGoal === 'Improve cash flow' && worst.key === 'cashFlow'
        ? ' That lines up with the goal you set at signup.'
        : '';

  return `${standing} Your ${best.label.toLowerCase()} is the strongest part of the picture, while ${worst.label.toLowerCase()} is holding you back. ${advice[worst.key]}${goalNudge}`;
}

export function computeHealthScore(
  snapshot: FinancialSnapshot,
  previous: FinancialSnapshot | null,
  daysOfData: number,
  context: HealthContext
): HealthScore {
  const ratios = buildRatios(snapshot, previous, context);

  // Every ratio carries the same weight — none of the four is the whole story.
  const score = Math.round(ratios.reduce((sum, r) => sum + r.score, 0) / ratios.length);

  const ready = daysOfData >= DAYS_REQUIRED;

  // The spec is explicit: don't hand out recommendations on thin data. Below the
  // threshold we show progress toward the first score, not a number.
  if (!ready) {
    return {
      ready: false,
      daysOfData,
      daysRequired: DAYS_REQUIRED,
      score: null,
      trend: null,
      ratios,
      summary:
        daysOfData === 0
          ? 'Record your income and expenses and your first health score will appear once there\'s about a month of data to read.'
          : `${daysOfData} day${daysOfData === 1 ? '' : 's'} of data so far. Your first health score arrives at ${DAYS_REQUIRED} days — there isn't enough history yet to say anything useful.`,
      periodDays: PERIOD_DAYS,
    };
  }

  let trend: number | null = null;
  if (previous) {
    const prevRatios = buildRatios(previous, null, context);
    const prevScore = Math.round(prevRatios.reduce((sum, r) => sum + r.score, 0) / prevRatios.length);
    trend = score - prevScore;
  }

  return {
    ready: true,
    daysOfData,
    daysRequired: DAYS_REQUIRED,
    score,
    trend,
    ratios,
    summary: buildSummary(score, ratios, context),
    periodDays: PERIOD_DAYS,
  };
}
