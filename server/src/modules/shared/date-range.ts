export interface DateRange {
  startDate: string;
  endDate: string;
}

export function getMonthRange(date = new Date()): DateRange {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

export function getPreviousMonthRange(startDate: string): DateRange {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const previous = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
  return getMonthRange(previous);
}

export function normalizeDateRange(query: { startDate?: string; endDate?: string }): DateRange {
  const fallback = getMonthRange();
  return {
    startDate: query.startDate || fallback.startDate,
    endDate: query.endDate || fallback.endDate
  };
}
