import { Database } from '../../infrastructure/database';

/**
 * Foreign-exchange rates.
 *
 * The books are always in USD (the base currency). When a business enters a
 * transaction in another currency, we convert it to USD at the rate ON THE
 * TRANSACTION'S DATE — the historical rate, not today's. A €100 expense from
 * last month is locked at last month's rate forever; it never moves again.
 *
 * Rates come from Frankfurter (frankfurter.app), which serves European Central
 * Bank reference rates: free, no API key, historical data. Each (date, from, to)
 * is fetched once and cached forever — a historical rate can't change — so this
 * costs a single request per currency-day, ever.
 */
export class FxRepository {
  constructor(private database: Database) {}

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS fx_rates (
        rate_date DATE NOT NULL,
        base_currency VARCHAR(3) NOT NULL,
        quote_currency VARCHAR(3) NOT NULL,
        rate NUMERIC(18, 8) NOT NULL,
        fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (rate_date, base_currency, quote_currency)
      );
    `);
  }

  /**
   * Rate to convert 1 `from` into `to`, as at `date` (YYYY-MM-DD).
   *
   * `effectiveDate` is the date the rate actually belongs to — Frankfurter has
   * no rate on weekends/holidays and returns the previous business day, so the
   * caller can show and store the date that was really used.
   */
  async getRate(from: string, to: string, date: string): Promise<{ rate: number; effectiveDate: string }> {
    const base = from.toUpperCase();
    const quote = to.toUpperCase();

    if (base === quote) return { rate: 1, effectiveDate: date };

    const cached = await this.database.query(
      `SELECT rate, rate_date FROM fx_rates
       WHERE rate_date = $1::date AND base_currency = $2 AND quote_currency = $3`,
      [date, base, quote]
    );
    if (cached.rows[0]) {
      return {
        rate: Number(cached.rows[0].rate),
        effectiveDate: new Date(cached.rows[0].rate_date).toISOString().slice(0, 10),
      };
    }

    const { rate, effectiveDate } = await fetchFromFrankfurter(base, quote, date);

    // Cache under BOTH the date asked for and the date the rate belongs to, so a
    // weekend lookup is a hit next time without re-deriving the business day.
    await this.database.query(
      `INSERT INTO fx_rates (rate_date, base_currency, quote_currency, rate)
       VALUES ($1::date, $2, $3, $4), ($5::date, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [date, base, quote, rate, effectiveDate]
    );

    return { rate, effectiveDate };
  }
}

/** The currencies the UI offers. Frankfurter covers far more; widen freely. */
export const SUPPORTED_CURRENCIES = ['USD', 'EUR'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

async function fetchFromFrankfurter(
  base: string,
  quote: string,
  date: string
): Promise<{ rate: number; effectiveDate: string }> {
  // Frankfurter only holds data from 1999 up to the latest business day. A
  // future date (or today before the ECB publishes) resolves to 'latest'.
  const path = date > new Date().toISOString().slice(0, 10) ? 'latest' : date;
  const url = `https://api.frankfurter.app/${path}?from=${base}&to=${quote}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Exchange-rate lookup failed (${res.status})`);

  const json = (await res.json()) as { date?: string; rates?: Record<string, number> };
  const rate = json?.rates?.[quote];
  if (typeof rate !== 'number' || !(rate > 0)) {
    throw new Error(`No exchange rate available for ${base}→${quote}`);
  }

  return { rate, effectiveDate: json.date ?? date };
}
