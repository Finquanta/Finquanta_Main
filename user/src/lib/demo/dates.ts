/**
 * Local calendar dates for the demo.
 *
 * Every business date in the demo is a `YYYY-MM-DD` string that came from a
 * `<input type="date">` — which is the user's LOCAL calendar day. Defaulting or
 * bucketing those with `new Date().toISOString().slice(0, 10)` reads the UTC day
 * instead, so anyone far enough east or west of UTC gets entries dated a day off
 * and chart bars that don't line up with their labels.
 *
 * These build the same string from local getters, so a date the user picked and
 * a date we defaulted are always on the same calendar.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` for a Date, on the local calendar. */
export function toLocalKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today, on the local calendar. The default for any date the user didn't pick. */
export function todayLocal(): string {
  return toLocalKey(new Date());
}

/** `YYYY-MM` for a Date, on the local calendar. */
export function toLocalMonthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** This month, on the local calendar. */
export function thisMonthLocal(): string {
  return toLocalMonthKey(new Date());
}
