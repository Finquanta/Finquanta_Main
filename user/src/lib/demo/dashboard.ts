/**
 * Demo data sources for the two dashboard cards that fetch their own data —
 * the Financial Health Score and the Revenue chart. Both real components take a
 * `source` prop, so the demo renders the identical component off its local
 * ledger rather than a lookalike that drifts from the real one.
 */
import { HealthScore, Ratio } from '@/lib/api/health';
import { RevenueMetric, RevenuePoint, RevenueRange } from '@/lib/api/dashboard';
import { DemoState } from './types';
import { load } from './store';
import { toLocalKey } from './dates';

const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const DEBIT_NATURAL = new Set(['CASH', 'AR', 'LOAN_RECEIVABLE', 'EXPENSE', 'INTEREST_EXPENSE']);

function balances(state: DemoState): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const entry of state.ledger.entries) {
    for (const line of entry.lines) {
      const natural = DEBIT_NATURAL.has(line.code) ? line.debit - line.credit : line.credit - line.debit;
      totals[line.code] = round((totals[line.code] ?? 0) + natural);
    }
  }
  return totals;
}

/** Map a ratio onto 0–100 by where it falls between a poor and a good value. */
function scoreBetween(value: number, poor: number, good: number): number {
  if (good === poor) return 50;
  const pct = ((value - poor) / (good - poor)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** The translator from LanguageContext, passed in so this stays a plain module. */
export type Translate = (section: string, key: string) => string;

/**
 * The same four ratios the server scores, computed from the demo ledger.
 * Deliberately simpler than the server's version — it has no history to trend
 * against, so every trend is null and the period is the whole session.
 *
 * Takes `t` because the server returns this text already-worded in English;
 * the demo generates it locally, so it can be generated in the user's language.
 */
export async function getDemoHealthScore(t: Translate): Promise<HealthScore> {
  const state = load();
  const b = balances(state);

  const cash = round(b.CASH ?? 0);
  const ar = round(b.AR ?? 0);
  const ap = round(b.AP ?? 0);
  const loans = round(b.LOAN_PAYABLE ?? 0);
  const revenue = round((b.REVENUE ?? 0) + (b.INTEREST_INCOME ?? 0));
  const expenses = round((b.EXPENSE ?? 0) + (b.INTEREST_EXPENSE ?? 0));
  const profit = round(revenue - expenses);
  const assets = round(cash + ar);
  const liabilities = round(ap + loans);

  const hasBooks = state.ledger.entries.length > 0;

  // Current ratio: what you can pay with, against what's due.
  const liquidityValue = liabilities > 0 ? round(assets / liabilities) : assets > 0 ? 999 : 0;
  const liquidityScore = liabilities === 0 && assets > 0 ? 100 : scoreBetween(liquidityValue, 0.5, 2);

  // Net margin.
  const marginValue = revenue > 0 ? round((profit / revenue) * 100) : 0;
  const marginScore = revenue > 0 ? scoreBetween(marginValue, -20, 25) : 0;

  // Debt load against what you own. Lower is better, so the bounds are flipped.
  const debtValue = assets > 0 ? round(liabilities / assets) : liabilities > 0 ? 999 : 0;
  const debtScore = liabilities === 0 ? 100 : scoreBetween(debtValue, 1.5, 0.2);

  // How much of your revenue has actually landed as cash.
  const cashFlowValue = revenue > 0 ? round((cash / revenue) * 100) : 0;
  const cashFlowScore = revenue > 0 ? scoreBetween(cashFlowValue, 0, 60) : 0;

  const d = (key: string) => t('demo', key);

  const ratios: Ratio[] = [
    {
      key: 'liquidity',
      name: d('hLiquidity'),
      label: d('hLiquidityLabel'),
      value: hasBooks && liquidityValue < 999 ? liquidityValue : null,
      format: 'ratio',
      score: liquidityScore,
      trend: null,
      explanation: d('hLiquidityExp'),
      insight: liabilities === 0
        ? d('hLiquidityNoDebt')
        : liquidityValue >= 1
          ? d('hLiquidityOk')
          : d('hLiquidityLow'),
    },
    {
      key: 'profitability',
      name: d('hProfit'),
      label: d('hProfitLabel'),
      value: hasBooks && revenue > 0 ? marginValue : null,
      format: 'percent',
      score: marginScore,
      trend: null,
      explanation: d('hProfitExp'),
      insight: revenue === 0
        ? d('hProfitNone')
        : profit >= 0
          ? d('hProfitOk').replace('{pct}', String(marginValue))
          : d('hProfitLoss'),
    },
    {
      key: 'debtRisk',
      name: d('hDebt'),
      label: d('hDebtLabel'),
      value: hasBooks && debtValue < 999 ? debtValue : null,
      format: 'ratio',
      score: debtScore,
      trend: null,
      explanation: d('hDebtExp'),
      insight: liabilities === 0
        ? d('hDebtNone')
        : debtValue <= 0.5
          ? d('hDebtOk')
          : d('hDebtHigh'),
    },
    {
      key: 'cashFlow',
      name: d('hCash'),
      label: d('hCashLabel'),
      value: hasBooks && revenue > 0 ? cashFlowValue : null,
      format: 'percent',
      score: cashFlowScore,
      trend: null,
      explanation: d('hCashExp'),
      insight: ar > 0
        ? d('hCashOutstanding')
        : d('hCashCollected'),
    },
  ];

  const score = Math.round((liquidityScore + marginScore + debtScore + cashFlowScore) / 4);

  return {
    // A demo session has no 30-day history, but withholding the score would show
    // an empty "collecting data" ring — which reads as broken rather than honest.
    // It's scored off what the visitor entered, and the summary says so.
    ready: hasBooks,
    daysOfData: hasBooks ? 30 : 0,
    daysRequired: 30,
    score: hasBooks ? score : null,
    trend: null,
    ratios,
    summary: hasBooks ? d('hSummaryReady') : d('hSummaryEmpty'),
    periodDays: 30,
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Revenue / cashflow / expense over time, bucketed to match the real endpoint:
 * `day` = the last 30 days, `month` = the 12 months of this year, `year` = the
 * last 5 years.
 */
export async function getDemoRevenue(
  range: RevenueRange,
  metric: RevenueMetric = 'revenue'
): Promise<{ range: RevenueRange; metric: RevenueMetric; points: RevenuePoint[] }> {
  const state = load();

  /** What this entry contributes to the selected metric. */
  const valueOf = (lines: { code: string; debit: number; credit: number }[]): number => {
    if (metric === 'revenue') {
      return lines
        .filter((l) => l.code === 'REVENUE' || l.code === 'INTEREST_INCOME')
        .reduce((s, l) => s + (l.credit - l.debit), 0);
    }
    if (metric === 'expense') {
      return lines
        .filter((l) => l.code === 'EXPENSE' || l.code === 'INTEREST_EXPENSE')
        .reduce((s, l) => s + (l.debit - l.credit), 0);
    }
    // Cashflow: money in only, so the bars read as income rather than net.
    const cash = lines.filter((l) => l.code === 'CASH').reduce((s, l) => s + (l.debit - l.credit), 0);
    return Math.max(0, cash);
  };

  const buckets = new Map<string, number>();
  for (const entry of state.ledger.entries) {
    const v = valueOf(entry.lines);
    if (v <= 0) continue;
    const key = range === 'day' ? entry.date : range === 'month' ? entry.date.slice(0, 7) : entry.date.slice(0, 4);
    buckets.set(key, round((buckets.get(key) ?? 0) + v));
  }

  const today = new Date();
  const points: RevenuePoint[] = [];

  if (range === 'day') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      // Local, matching how the label is derived and how entry dates are stored.
      // Built from toISOString() these disagreed by a day either side of UTC, so
      // a bar labelled "10" was showing the 11th's total.
      const key = toLocalKey(d);
      points.push({
        label: String(d.getDate()),
        full: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
        value: buckets.get(key) ?? 0,
      });
    }
  } else if (range === 'month') {
    const year = today.getFullYear();
    for (let m = 0; m < 12; m++) {
      const key = `${year}-${String(m + 1).padStart(2, '0')}`;
      points.push({ label: MONTHS[m], full: `${MONTHS[m]} ${year}`, value: buckets.get(key) ?? 0 });
    }
  } else {
    for (let i = 4; i >= 0; i--) {
      const y = today.getFullYear() - i;
      points.push({ label: String(y), full: String(y), value: buckets.get(String(y)) ?? 0 });
    }
  }

  return { range, metric, points };
}

/** Which card this is. The page turns it into a label — see below. */
export type DemoSummaryCardKey = 'balance' | 'cashflow' | 'expense';

/**
 * The Balance / Cashflow / Expense cards at the top of the dashboard.
 *
 * Returns a key rather than a title: this module has no access to the language
 * context, and titles built here shipped as English into an otherwise fully
 * translated page. The keys match `dashboard.balance/cashflow/expense`.
 */
export async function getDemoSummaryCards(): Promise<{ key: DemoSummaryCardKey; amount: string }[]> {
  const state = load();
  const b = balances(state);
  const money = (n: number) =>
    `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cashIn = state.ledger.entries
    .flatMap((e) => e.lines)
    .filter((l) => l.code === 'CASH')
    .reduce((s, l) => s + l.debit, 0);
  const cashOut = state.ledger.entries
    .flatMap((e) => e.lines)
    .filter((l) => l.code === 'CASH')
    .reduce((s, l) => s + l.credit, 0);

  return [
    { key: 'balance', amount: money(round(b.CASH ?? 0)) },
    { key: 'cashflow', amount: money(round(cashIn)) },
    { key: 'expense', amount: money(round(cashOut)) },
  ];
}
