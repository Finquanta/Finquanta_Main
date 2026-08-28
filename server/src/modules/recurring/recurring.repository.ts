import { Database } from '../../infrastructure/database';
import { DueItem, Recurrence, SeriesHead, isRecurrence, nextDue } from './recurring.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Recurring series, read out of the transactions that already exist.
 *
 * There is no `recurring_series` table on purpose. A series IS the set of
 * transactions sharing a business, a type, a name and a recurrence, so it
 * cannot fall out of step with the ledger the way a mirrored table would.
 *
 * The one thing that genuinely needs storing is a NO. Confirming an occurrence
 * writes a transaction, which moves the series forward on its own; declining
 * one writes nothing, so without a record of the refusal the same question
 * would come back on every page load forever.
 */
export class RecurringRepository {
  constructor(private readonly database: Database) {}

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS recurring_skips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        series_key TEXT NOT NULL,
        due_date DATE NOT NULL,
        decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (business_id, series_key, due_date)
      );

      CREATE INDEX IF NOT EXISTS idx_recurring_skips_business
        ON recurring_skips (business_id);
    `);
  }

  /**
   * The most recent entry of every recurring series, with the first one's date.
   *
   * DISTINCT ON gives the head; the window function alongside it gives the
   * anchor. Both in one pass, because this runs on dashboard load and the
   * database is a network hop away.
   */
  async listSeries(businessId: string): Promise<SeriesHead[]> {
    const result = await this.database.query(
      `SELECT DISTINCT ON (t.type, t.category, t.metadata->>'recurrence')
         t.id,
         t.type,
         t.category,
         t.amount,
         t.description,
         t.date,
         t.metadata->>'recurrence' AS recurrence,
         t.metadata->>'groupId'    AS group_id,
         t.metadata->>'currency'   AS currency,
         MIN(t.date) OVER (
           PARTITION BY t.type, t.category, t.metadata->>'recurrence'
         ) AS first_date
       FROM financial_transactions t
       WHERE t.business_id = $1
         AND t.metadata->>'recurrence' IN ('monthly', 'yearly')
         AND t.status <> 'failed'
       ORDER BY t.type, t.category, t.metadata->>'recurrence', t.date DESC`,
      [businessId]
    );

    return (result.rows as any[])
      .filter((r) => isRecurrence(r.recurrence))
      .map((r) => ({
        seriesKey: seriesKeyOf(r.type, r.category, r.recurrence),
        sourceTransactionId: r.id,
        type: r.type,
        name: r.category,
        amount: Number(r.amount),
        description: r.description ?? null,
        groupId: r.group_id ?? null,
        currency: r.currency ?? null,
        recurrence: r.recurrence as Recurrence,
        firstDate: toIsoDate(r.first_date),
        lastDate: toIsoDate(r.date),
      }));
  }

  /** Every "no" this workspace has given, as series key → set of dates. */
  async listSkips(businessId: string): Promise<Map<string, Set<string>>> {
    const result = await this.database.query(
      'SELECT series_key, due_date FROM recurring_skips WHERE business_id = $1',
      [businessId]
    );
    const map = new Map<string, Set<string>>();
    for (const row of result.rows as any[]) {
      const key = row.series_key as string;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(toIsoDate(row.due_date));
    }
    return map;
  }

  /** Everything outstanding right now, soonest first. */
  async listDue(businessId: string, today: string): Promise<DueItem[]> {
    const [series, skips] = await Promise.all([
      this.listSeries(businessId),
      this.listSkips(businessId),
    ]);

    const due: DueItem[] = [];
    for (const head of series) {
      const dueDate = nextDue({
        firstDate: head.firstDate,
        lastDate: head.lastDate,
        recurrence: head.recurrence,
        today,
        skipped: skips.get(head.seriesKey) ?? new Set(),
      });
      if (dueDate) due.push({ ...head, dueDate });
    }
    return due.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  /**
   * Record a "no" for one occurrence.
   *
   * ON CONFLICT DO NOTHING because answering twice is not an error — two tabs
   * open is the ordinary way it happens.
   */
  async skip(
    businessId: string,
    seriesKey: string,
    dueDate: string,
    userId: string | null
  ): Promise<void> {
    await this.database.query(
      `INSERT INTO recurring_skips (business_id, series_key, due_date, decided_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (business_id, series_key, due_date) DO NOTHING`,
      [businessId, seriesKey, dueDate, userId]
    );
  }
}

/**
 * What identifies a series.
 *
 * Name-based, which has one consequence worth knowing: RENAMING a recurring
 * entry starts a new series rather than continuing the old one. That is the
 * price of matching on the ledger as it stands instead of asking people to
 * declare a series up front, and it fails in the harmless direction — a new
 * question, never a silent double entry.
 */
export const seriesKeyOf = (type: string, name: string, recurrence: string): string =>
  `${type}|${name.trim().toLowerCase()}|${recurrence}`;

/** `date` columns come back as Date objects; the whole module speaks YYYY-MM-DD. */
function toIsoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
