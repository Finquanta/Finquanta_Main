import { apiFetch } from './client';

/** Currencies the entry form offers. Books are always kept in USD. */
export const CURRENCIES = ['USD', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_SYMBOL: Record<Currency, string> = { USD: '$', EUR: '€' };

export interface FxRate {
  from: string;
  to: string;
  date: string;
  /** The date the rate actually belongs to (weekends fall back to Friday). */
  effectiveDate: string;
  rate: number;
}

/** Rate to convert 1 `from` into `to` as at `date` (YYYY-MM-DD). */
export const getFxRate = (from: string, to: string, date: string) =>
  apiFetch<FxRate>(`/v1/fx/rate?from=${from}&to=${to}&date=${date}`);

/** Format an amount in its own currency, e.g. €100.00. */
export function formatMoney(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency as Currency] ?? '';
  const n = Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym}${n}${sym ? '' : ' ' + currency}`;
}
