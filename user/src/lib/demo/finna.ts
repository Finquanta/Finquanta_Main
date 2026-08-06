/**
 * Finna, for anonymous demo sessions.
 *
 * The real Finna calls a model through /api/chat with the user's token, reads
 * their books over authenticated tools, and counts against their AI usage cap.
 * None of that is available to a visitor with no account, and putting an
 * unauthenticated model endpoint on a public page is an open invitation to run
 * up someone else's bill.
 *
 * So the demo's Finna answers deterministically from the session's own ledger.
 * The questions are the same ones the real dashboard suggests, the numbers are
 * genuinely computed from what the visitor entered, and the cap is what
 * eventually points them at a real account.
 */
import { DemoState } from './types';
import { thisMonthLocal } from './dates';

const money = (n: number) =>
  `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Suggestion chips. `labelKey` is what the visitor reads; `query` is what gets
 * asked. They are deliberately separate: answerFromDemo matches on ENGLISH
 * keywords ('cash', 'owe', 'invoice'), so sending a translated chip would match
 * nothing and drop every non-English visitor onto the fallback reply.
 */
export const DEMO_FINNA_PROMPTS: { labelKey: string; query: string }[] = [
  { labelKey: 'fpExpenses', query: 'What were my expenses this month?' },
  { labelKey: 'fpOwes', query: 'Who owes me money?' },
  { labelKey: 'fpDoing', query: 'How is my business doing?' },
  { labelKey: 'fpBiggest', query: 'What was my biggest expense?' },
];

/** Balances by account code, same derivation the accounting API uses. */
function balances(state: DemoState) {
  const totals: Record<string, number> = {};
  const DEBIT_NATURAL = new Set(['CASH', 'AR', 'LOAN_RECEIVABLE', 'EXPENSE', 'INTEREST_EXPENSE']);
  for (const entry of state.ledger.entries) {
    for (const line of entry.lines) {
      const natural = DEBIT_NATURAL.has(line.code) ? line.debit - line.credit : line.credit - line.debit;
      totals[line.code] = round((totals[line.code] ?? 0) + natural);
    }
  }
  return totals;
}

// Local, not UTC: entry dates come from a date input, so they're on the user's
// calendar. Comparing against the UTC month puts entries in the wrong month for
// a day at either end of it.
const isThisMonth = (date: string) => date.slice(0, 7) === thisMonthLocal();

function expensesThisMonth(state: DemoState): { total: number; count: number } {
  const rows = state.transactions.filter((t) => t.type === 'expense' && isThisMonth(t.date));
  return { total: round(rows.reduce((s, t) => s + t.amount, 0)), count: rows.length };
}

function biggestExpense(state: DemoState) {
  return state.transactions
    .filter((t) => t.type === 'expense')
    .sort((a, b) => b.amount - a.amount)[0] ?? null;
}

function whoOwes(state: DemoState, t: T) {
  const unpaid = state.invoices.filter((i) => i.status === 'sent');
  return unpaid.map((inv) => ({
    name: state.customers.find((c) => c.id === inv.customerId)?.name ?? t('demo', 'faUnnamed'),
    number: inv.number,
    total: inv.total,
  }));
}

/**
 * Answer a question from the session's own books. Deterministic — same question
 * against the same data gives the same answer.
 */
type T = (ns: string, key: string) => string;

/** Fill {name} placeholders in a translated template. */
const fill = (s: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((acc, [k, val]) => acc.split(`{${k}}`).join(String(val)), s);

export function answerFromDemo(question: string, state: DemoState, t: T): string {
  const q = question.toLowerCase();
  const b = balances(state);
  const empty = state.ledger.entries.length === 0;

  if (empty) {
    return t('demo', 'faEmpty');
  }

  // Expenses
  if (q.includes('expense') || q.includes('spend') || q.includes('spent') || q.includes('cost')) {
    if (q.includes('biggest') || q.includes('largest') || q.includes('most')) {
      const top = biggestExpense(state);
      if (!top) return t('demo', 'faBiggestNone');
      return fill(t('demo', 'faBiggest'), { category: top.category, amount: money(top.amount), date: top.date });
    }
    const month = expensesThisMonth(state);
    const all = round(b.EXPENSE ?? 0);
    if (month.count === 0) {
      return fill(t('demo', 'faExpNone'), { all: money(all) });
    }
    return fill(t('demo', 'faExpMonth'), { count: month.count, total: money(month.total), all: money(all) });
  }

  // Receivables
  if (q.includes('owe') && (q.includes('me') || q.includes('who'))) {
    const owed = whoOwes(state, t);
    const ar = round(b.AR ?? 0);
    if (owed.length === 0 && ar === 0) return t('demo', 'faOwedNone');
    if (owed.length === 0) return fill(t('demo', 'faOwedAccrual'), { amount: money(ar) });
    const lines = owed.map((o) => `· ${o.name} — ${money(o.total)} · ${o.number}`).join('\n');
    return `${fill(t('demo', 'faOwedTotal'), { amount: money(ar) })}\n${lines}`;
  }

  // Payables / debt
  if (q.includes('i owe') || q.includes('debt') || q.includes('loan') || q.includes('payable')) {
    const ap = round(b.AP ?? 0);
    const loan = round(b.LOAN_PAYABLE ?? 0);
    if (ap === 0 && loan === 0) return t('demo', 'faOweNone');
    const parts: string[] = [];
    if (ap > 0) parts.push(fill(t('demo', 'faOweBills'), { amount: money(ap) }));
    if (loan > 0) parts.push(fill(t('demo', 'faOweLoans'), { amount: money(loan), count: state.loans.filter((l) => l.type === 'payable').length }));
    return fill(t('demo', 'faOweTotal'), { parts: parts.join(` ${t('demo', 'tgAnd')} `) });
  }

  // Cash
  if (q.includes('cash') || q.includes('bank') || q.includes('balance')) {
    return fill(t('demo', 'faCash'), { amount: money(round(b.CASH ?? 0)) });
  }

  // Revenue
  if (q.includes('revenue') || q.includes('income') || q.includes('earn') || q.includes('made')) {
    const rev = round((b.REVENUE ?? 0) + (b.INTEREST_INCOME ?? 0));
    return fill(t('demo', 'faRevenue'), { amount: money(rev) });
  }

  // Invoices
  if (q.includes('invoice')) {
    const { draft = 0, sent = 0, paid = 0 } = state.invoices.reduce<Record<string, number>>((acc, i) => {
      acc[i.status] = (acc[i.status] ?? 0) + 1;
      return acc;
    }, {});
    if (state.invoices.length === 0) return t('demo', 'faInvNone');
    return fill(t('demo', 'faInvSummary'), { count: state.invoices.length, draft, sent, paid });
  }

  // Overall health
  if (q.includes('how') || q.includes('doing') || q.includes('health') || q.includes('summary')) {
    const cash = round(b.CASH ?? 0);
    const rev = round((b.REVENUE ?? 0) + (b.INTEREST_INCOME ?? 0));
    const exp = round((b.EXPENSE ?? 0) + (b.INTEREST_EXPENSE ?? 0));
    const profit = round(rev - exp);
    const ar = round(b.AR ?? 0);
    const verdict = profit > 0
      ? fill(t('demo', 'faProfit'), { amount: money(profit) })
      : profit < 0
        ? fill(t('demo', 'faLoss'), { amount: money(Math.abs(profit)) })
        : t('demo', 'faLevel');
    const arNote = ar > 0 ? ` ${fill(t('demo', 'faArNote'), { amount: money(ar) })}` : '';
    return `${verdict} ${fill(t('demo', 'faHealthBody'), { cash: money(cash), revenue: money(rev), expenses: money(exp) })}${arNote}`;
  }

  return t('demo', 'faFallback');
}
