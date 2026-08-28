/**
 * Recurring entries — the ones that come round again.
 *
 * A subscription paid on the 20th of August is almost certainly paid again on
 * the 20th of September, and the only reason it is missing from the books is
 * that nobody remembered. This asks.
 *
 * NOTHING here is a new kind of record. `metadata.recurrence` already exists on
 * financial_transactions and is already written by the entry form, so a series
 * is not a new table — it is the transactions that share a name, a type and a
 * recurrence. Adding a second concept for "a recurring thing" would mean two
 * places that disagree about what repeats.
 */

export const RECURRENCES = ['monthly', 'yearly'] as const;
export type Recurrence = (typeof RECURRENCES)[number];

export const isRecurrence = (v: unknown): v is Recurrence =>
  RECURRENCES.includes(v as Recurrence);

/** The head of a series: the most recent entry that carries a recurrence. */
export interface SeriesHead {
  seriesKey: string;
  sourceTransactionId: string;
  type: 'income' | 'expense';
  /** The entry's name. `category` on the row; "Invoice Name" in the UI. */
  name: string;
  amount: number;
  description: string | null;
  groupId: string | null;
  currency: string | null;
  recurrence: Recurrence;
  /** The first entry in the series — the anchor the schedule is counted from. */
  firstDate: string;
  /** The most recent one recorded. */
  lastDate: string;
}

/** A series whose next occurrence has come round and is not yet recorded. */
export interface DueItem extends SeriesHead {
  dueDate: string;
}

/**
 * Add whole periods to a date, anchored on the ORIGINAL day of the month.
 *
 * Counting from the anchor rather than stepping from the last entry is what
 * stops a schedule drifting: the 31st of January advances to the 28th of
 * February and then back to the 31st of March, where repeated one-month steps
 * would have stuck on the 28th for the rest of the year.
 */
export function addPeriods(anchor: string, unit: Recurrence, periods: number): string {
  const [y, m, d] = anchor.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + (unit === 'monthly' ? periods : periods * 12);
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  // Day 0 of the NEXT month is the last day of this one.
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(d, lastDayOfMonth);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * How many periods to walk before giving up.
 *
 * A bound on the loop, nothing more — it stops an ancient series being stepped
 * through one month at a time on every dashboard load.
 */
const MAX_PERIODS = 240;

/**
 * How far behind a series can fall before it is treated as ABANDONED.
 *
 * Bounding the loop is not the same as knowing when to stop asking. A
 * subscription last recorded in 1990 still has an occurrence outstanding every
 * month between then and now, and the earliest of them is the one that would be
 * offered — so the prompt would ask whether a bill was paid in February 1990.
 *
 * The honest signal is how long it has been since the series last actually
 * happened. Someone three months behind wants the reminder; someone three years
 * behind stopped paying for the thing.
 */
const ABANDONED_AFTER_DAYS: Record<Recurrence, number> = {
  // Comfortably over a year, so a late annual entry on a monthly-ish cadence
  // is still caught rather than dropped on a technicality.
  monthly: 400,
  yearly: 800,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days from `a` to `b`, both YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / MS_PER_DAY);
}

/**
 * The earliest occurrence that is genuinely outstanding, or null.
 *
 * Deliberately ONE at a time rather than every missed period at once. Somebody
 * three months behind gets asked about September, and once that is recorded the
 * series head moves and October becomes the question. A list of three
 * near-identical prompts is a thing people dismiss without reading.
 */
export function nextDue(args: {
  firstDate: string;
  lastDate: string;
  recurrence: Recurrence;
  /** YYYY-MM-DD. Passed in rather than read from the clock, so this is testable. */
  today: string;
  /** Occurrences already answered with "no". */
  skipped: ReadonlySet<string>;
}): string | null {
  const { firstDate, lastDate, recurrence, today, skipped } = args;

  // Long dead — see ABANDONED_AFTER_DAYS. Asking about it is noise.
  if (daysBetween(lastDate, today) > ABANDONED_AFTER_DAYS[recurrence]) return null;

  for (let n = 1; n <= MAX_PERIODS; n++) {
    const occurrence = addPeriods(firstDate, recurrence, n);
    // Not yet — the future is not outstanding.
    if (occurrence > today) return null;
    // Already recorded, or answered "no" for that date.
    if (occurrence <= lastDate) continue;
    if (skipped.has(occurrence)) continue;
    return occurrence;
  }
  return null;
}
