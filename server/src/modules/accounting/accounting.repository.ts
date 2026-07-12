import { Database } from '../../infrastructure/database';
import {
  AccountBalance, AccountCode, CHART_OF_ACCOUNTS, CreateEntryInput,
  DEBIT_NORMAL, JournalEntry,
} from './accounting.types';

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export class AccountingRepository {
  constructor(private database: Database) {}

  /** Idempotently create the ledger tables. */
  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        code VARCHAR(40) NOT NULL,
        name VARCHAR(120) NOT NULL,
        type VARCHAR(20) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (business_id, code)
      );
    `);
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        description TEXT NOT NULL,
        source_type VARCHAR(40) NOT NULL DEFAULT 'manual',
        source_id UUID,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS journal_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
        debit NUMERIC(14,2) NOT NULL DEFAULT 0,
        credit NUMERIC(14,2) NOT NULL DEFAULT 0
      );
    `);
    await this.database.query(`CREATE INDEX IF NOT EXISTS idx_journal_entries_business ON journal_entries(business_id, date DESC)`);
    await this.database.query(`CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(entry_id)`);
    await this.database.query(`CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id)`);
  }

  /**
   * Seed the standard chart of accounts for a business. Lazy + idempotent, so a
   * business gets its accounts the first time its ledger is touched (no heavy
   * boot-time migration for every existing business).
   */
  async ensureAccounts(businessId: string): Promise<void> {
    const codes = CHART_OF_ACCOUNTS.map((a) => a.code);
    const names = CHART_OF_ACCOUNTS.map((a) => a.name);
    const types = CHART_OF_ACCOUNTS.map((a) => a.type);
    await this.database.query(
      `INSERT INTO accounts (business_id, code, name, type)
       SELECT $1, x.code, x.name, x.type
       FROM UNNEST($2::text[], $3::text[], $4::text[]) AS x(code, name, type)
       ON CONFLICT (business_id, code) DO NOTHING`,
      [businessId, codes, names, types]
    );
  }

  /** code -> account id for a business (seeds first if needed). */
  async getAccountMap(businessId: string): Promise<Map<AccountCode, string>> {
    await this.ensureAccounts(businessId);
    const result = await this.database.query(
      'SELECT id, code FROM accounts WHERE business_id = $1',
      [businessId]
    );
    return new Map(result.rows.map((r: any) => [r.code as AccountCode, r.id as string]));
  }

  /**
   * Write a balanced journal entry atomically. Rejects entries whose debits and
   * credits don't match — the ledger is never allowed to go out of balance.
   */
  async createEntry(input: CreateEntryInput): Promise<string> {
    if (!input.lines?.length) throw new Error('An entry needs at least one line');

    const debits = money(input.lines.reduce((s, l) => s + (l.debit || 0), 0));
    const credits = money(input.lines.reduce((s, l) => s + (l.credit || 0), 0));
    if (debits <= 0 || credits <= 0) throw new Error('An entry must move a non-zero amount');
    if (debits !== credits) throw new Error(`Entry does not balance: debits ${debits} vs credits ${credits}`);

    const accounts = await this.getAccountMap(input.businessId);
    const accountIds: string[] = [];
    for (const line of input.lines) {
      const id = accounts.get(line.code);
      if (!id) throw new Error(`Unknown account code: ${line.code}`);
      accountIds.push(id);
    }

    return this.database.transaction(async (client) => {
      const entry = await client.query(
        `INSERT INTO journal_entries (business_id, date, description, source_type, source_id, created_by)
         VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6)
         RETURNING id`,
        [input.businessId, input.date ?? null, input.description, input.sourceType, input.sourceId ?? null, input.createdBy ?? null]
      );
      const entryId = entry.rows[0].id as string;

      await client.query(
        `INSERT INTO journal_lines (entry_id, account_id, debit, credit)
         SELECT $1, x.account_id, x.debit, x.credit
         FROM UNNEST($2::uuid[], $3::numeric[], $4::numeric[]) AS x(account_id, debit, credit)`,
        [
          entryId,
          accountIds,
          input.lines.map((l) => money(l.debit || 0)),
          input.lines.map((l) => money(l.credit || 0)),
        ]
      );

      return entryId;
    });
  }

  /**
   * Mirror bookkeeping entries into the ledger, so the ledger is the single
   * source of truth for every number the dashboard shows.
   *
   * A bookkeeping transaction is cash that actually moved:
   *   income  -> Business Cash ↑ , Revenue ↑
   *   expense -> Expenses ↑      , Business Cash ↓
   *
   * Idempotent and safe to run on every request: an entry is only written for a
   * transaction that doesn't already have one (matched on source_type +
   * source_id), so it both BACKFILLS existing history and keeps new entries in
   * step. Deterministic code — no AI.
   */
  async syncBookkeeping(businessId: string): Promise<number> {
    await this.ensureAccounts(businessId);

    const result = await this.database.query(
      `WITH new_entries AS (
         INSERT INTO journal_entries (business_id, date, description, source_type, source_id, created_by)
         SELECT t.business_id,
                t.date,
                COALESCE(NULLIF(t.category, ''), 'Bookkeeping entry'),
                'bookkeeping',
                t.id,
                t.user_id
         FROM financial_transactions t
         WHERE t.business_id = $1::uuid
           AND t.status = 'completed'
           AND t.amount > 0
           AND NOT EXISTS (
             SELECT 1 FROM journal_entries e
             WHERE e.source_type = 'bookkeeping' AND e.source_id = t.id
           )
         RETURNING id AS entry_id, source_id
       )
       INSERT INTO journal_lines (entry_id, account_id, debit, credit)
       SELECT ne.entry_id, a.id, l.debit, l.credit
       FROM new_entries ne
       JOIN financial_transactions t ON t.id = ne.source_id
       CROSS JOIN LATERAL (VALUES
         -- income: debit Cash / expense: debit Expenses
         (CASE WHEN t.type = 'income' THEN 'CASH' ELSE 'EXPENSE' END, t.amount, 0::numeric),
         -- income: credit Revenue / expense: credit Cash
         (CASE WHEN t.type = 'income' THEN 'REVENUE' ELSE 'CASH' END, 0::numeric, t.amount)
       ) AS l(code, debit, credit)
       JOIN accounts a ON a.business_id = t.business_id AND a.code = l.code`,
      [businessId]
    );
    return result.rowCount ?? 0;
  }

  /**
   * Remove the ledger entries for bookkeeping transactions that no longer exist
   * (or are no longer completed), so an edited/deleted entry doesn't leave a
   * stale figure behind on the dashboard.
   */
  async pruneBookkeeping(businessId: string): Promise<number> {
    const result = await this.database.query(
      `DELETE FROM journal_entries e
       WHERE e.business_id = $1::uuid
         AND e.source_type = 'bookkeeping'
         AND NOT EXISTS (
           SELECT 1 FROM financial_transactions t
           WHERE t.id = e.source_id AND t.status = 'completed'
         )`,
      [businessId]
    );
    return result.rowCount ?? 0;
  }

  /**
   * Re-post any bookkeeping entry whose amount/type/date changed after it was
   * mirrored. Cheapest correct approach: drop the stale entry, then re-sync.
   */
  async resyncBookkeeping(businessId: string): Promise<void> {
    await this.database.query(
      `DELETE FROM journal_entries e
       USING financial_transactions t
       WHERE e.business_id = $1::uuid
         AND e.source_type = 'bookkeeping'
         AND t.id = e.source_id
         AND (
           e.date <> t.date
           OR NOT EXISTS (
             SELECT 1 FROM journal_lines l
             JOIN accounts a ON a.id = l.account_id
             WHERE l.entry_id = e.id
               AND a.code = CASE WHEN t.type = 'income' THEN 'CASH' ELSE 'EXPENSE' END
               AND l.debit = t.amount
           )
         )`,
      [businessId]
    );
    await this.pruneBookkeeping(businessId);
    await this.syncBookkeeping(businessId);
  }

  /**
   * The numbers the dashboard shows, derived from the ledger.
   *
   * basis 'cash'    — only entries where money actually moved (they touch CASH).
   *                   An unpaid invoice is invisible here, which is the point.
   * basis 'accrual' — everything, including money owed to you.
   */
  async getLedgerSummary(
    businessId: string,
    startDate: string,
    endDate: string,
    basis: 'cash' | 'accrual' = 'accrual'
  ): Promise<{ totalIncome: string; totalExpenses: string; netIncome: string; transactionCount: number }> {
    await this.ensureAccounts(businessId);

    const cashOnly = basis === 'cash'
      ? `AND EXISTS (
           SELECT 1 FROM journal_lines cl
           JOIN accounts ca ON ca.id = cl.account_id
           WHERE cl.entry_id = e.id AND ca.code = 'CASH'
         )`
      : '';

    const result = await this.database.query(
      `SELECT
         COALESCE(SUM(CASE WHEN a.type = 'revenue' THEN l.credit - l.debit ELSE 0 END), 0) AS income,
         COALESCE(SUM(CASE WHEN a.type = 'expense' THEN l.debit - l.credit ELSE 0 END), 0) AS expenses,
         COUNT(DISTINCT e.id) AS entries
       FROM journal_entries e
       JOIN journal_lines l ON l.entry_id = e.id
       JOIN accounts a ON a.id = l.account_id
       WHERE e.business_id = $1::uuid
         AND e.date >= $2::date AND e.date <= $3::date
         ${cashOnly}`,
      [businessId, startDate, endDate]
    );

    const r = result.rows[0] ?? {};
    const income = money(Number.parseFloat(r.income ?? '0'));
    const expenses = money(Number.parseFloat(r.expenses ?? '0'));
    return {
      totalIncome: income.toFixed(2),
      totalExpenses: expenses.toFixed(2),
      netIncome: money(income - expenses).toFixed(2),
      transactionCount: Number.parseInt(r.entries ?? '0', 10),
    };
  }

  /**
   * The unified transactions list behind the Bookkeeping card — every event, in
   * plain English, with no debits or credits on show.
   *
   *  basis 'cash'    — money that actually moved: your own entries PLUS invoice
   *                    payments and loan payments.
   *  basis 'accrual' — the above, plus what's owed (invoices raised, bills).
   *
   * Rows that came from a bookkeeping entry carry `transactionId`, so they stay
   * editable/deletable with their receipt. Rows generated by an invoice or a
   * loan are read-only — editing them here would put the books out of step with
   * the document that produced them.
   */
  async listTransactions(
    businessId: string,
    basis: 'cash' | 'accrual' = 'cash',
    limit = 100
  ): Promise<Array<{
    id: string;
    date: string | null;
    description: string;
    sourceType: string;
    sourceId: string | null;
    /** Positive = money in / owed to you. Negative = money out / you owe. */
    signedAmount: number;
    direction: 'in' | 'out' | 'owed_to_you' | 'you_owe';
    cashMoved: boolean;
    transactionId: string | null;
    category: string | null;
    hasReceipt: boolean;
    recurrence: string | null;
    lines: Array<{ accountCode: string; accountName: string; debit: number; credit: number }>;
  }>> {
    await this.ensureAccounts(businessId);

    const cashOnly = basis === 'cash'
      ? `AND EXISTS (
           SELECT 1 FROM journal_lines cl JOIN accounts ca ON ca.id = cl.account_id
           WHERE cl.entry_id = e.id AND ca.code = 'CASH' AND (cl.debit > 0 OR cl.credit > 0)
         )`
      : '';

    const result = await this.database.query(
      `SELECT
         e.id, e.date, e.description, e.source_type, e.source_id,
         COALESCE((SELECT SUM(l.debit - l.credit) FROM journal_lines l
                   JOIN accounts a ON a.id = l.account_id
                   WHERE l.entry_id = e.id AND a.code = 'CASH'), 0) AS cash_delta,
         COALESCE((SELECT SUM(l.debit - l.credit) FROM journal_lines l
                   JOIN accounts a ON a.id = l.account_id
                   WHERE l.entry_id = e.id AND a.code = 'AR'), 0) AS ar_delta,
         COALESCE((SELECT SUM(l.credit - l.debit) FROM journal_lines l
                   JOIN accounts a ON a.id = l.account_id
                   WHERE l.entry_id = e.id AND a.code = 'AP'), 0) AS ap_delta,
         COALESCE((SELECT SUM(l.debit) FROM journal_lines l WHERE l.entry_id = e.id), 0) AS gross,
         t.id AS tx_id, t.category, t.metadata,
         EXISTS (SELECT 1 FROM transaction_receipts r WHERE r.transaction_id = t.id) AS has_receipt
       FROM journal_entries e
       LEFT JOIN financial_transactions t
              ON e.source_type = 'bookkeeping' AND t.id = e.source_id
       WHERE e.business_id = $1::uuid ${cashOnly}
       ORDER BY e.date DESC, e.created_at DESC
       LIMIT $2`,
      [businessId, limit]
    );

    const rows = result.rows as any[];
    if (rows.length === 0) return [];

    // Fetch the debit/credit lines for the optional "Accountant view".
    const ids = rows.map((r) => r.id);
    const lineRes = await this.database.query(
      `SELECT l.entry_id, a.code, a.name, l.debit, l.credit
       FROM journal_lines l JOIN accounts a ON a.id = l.account_id
       WHERE l.entry_id = ANY($1::uuid[])`,
      [ids]
    );
    const linesBy = new Map<string, any[]>();
    for (const l of lineRes.rows as any[]) {
      const arr = linesBy.get(l.entry_id) ?? [];
      arr.push({
        accountCode: l.code,
        accountName: l.name,
        debit: Number.parseFloat(l.debit ?? '0'),
        credit: Number.parseFloat(l.credit ?? '0'),
      });
      linesBy.set(l.entry_id, arr);
    }

    return rows.map((r) => {
      const cash = money(Number.parseFloat(r.cash_delta ?? '0'));
      const ar = money(Number.parseFloat(r.ar_delta ?? '0'));
      const ap = money(Number.parseFloat(r.ap_delta ?? '0'));
      const gross = money(Number.parseFloat(r.gross ?? '0'));

      let signedAmount: number;
      let direction: 'in' | 'out' | 'owed_to_you' | 'you_owe';
      if (cash !== 0) {
        signedAmount = cash;
        direction = cash > 0 ? 'in' : 'out';
      } else if (ar > 0) {
        signedAmount = ar;
        direction = 'owed_to_you';
      } else if (ap > 0) {
        signedAmount = -ap;
        direction = 'you_owe';
      } else {
        signedAmount = gross;
        direction = 'in';
      }

      const meta = r.metadata ?? {};
      return {
        id: r.id,
        date: r.date ? new Date(r.date).toISOString().slice(0, 10) : null,
        description: r.description,
        sourceType: r.source_type,
        sourceId: r.source_id ?? null,
        signedAmount: money(signedAmount),
        direction,
        cashMoved: cash !== 0,
        transactionId: r.tx_id ?? null,
        category: r.category ?? null,
        hasReceipt: !!r.has_receipt,
        recurrence: typeof meta?.recurrence === 'string' ? meta.recurrence : null,
        lines: linesBy.get(r.id) ?? [],
      };
    });
  }

  /** Account balances, signed by each account's normal balance. */
  async getBalances(businessId: string): Promise<AccountBalance[]> {
    await this.ensureAccounts(businessId);
    const result = await this.database.query(
      `SELECT a.id, a.code, a.name, a.type,
              COALESCE(SUM(l.debit), 0)  AS debits,
              COALESCE(SUM(l.credit), 0) AS credits
       FROM accounts a
       LEFT JOIN journal_lines l ON l.account_id = a.id
       WHERE a.business_id = $1
       GROUP BY a.id, a.code, a.name, a.type`,
      [businessId]
    );
    return result.rows.map((r: any) => {
      const debits = Number.parseFloat(r.debits ?? '0');
      const credits = Number.parseFloat(r.credits ?? '0');
      const isDebitNormal = DEBIT_NORMAL.includes(r.type);
      return {
        id: r.id,
        code: r.code as AccountCode,
        name: r.name,
        type: r.type,
        balance: money(isDebitNormal ? debits - credits : credits - debits),
      };
    });
  }

  /**
   * Recent journal entries with their lines, newest first.
   *
   * `basis` selects the accounting basis:
   *  - 'cash'    — only entries where money actually moved (they touch the CASH
   *                account). This is what the simple bookkeeping view reports.
   *  - 'accrual' — every entry, including receivables/payables that moved no cash.
   */
  async listEntries(businessId: string, limit = 100, basis: 'cash' | 'accrual' = 'accrual'): Promise<JournalEntry[]> {
    const cashOnly = basis === 'cash'
      ? `AND EXISTS (
           SELECT 1 FROM journal_lines cl
           JOIN accounts ca ON ca.id = cl.account_id
           WHERE cl.entry_id = e.id AND ca.code = 'CASH'
         )`
      : '';

    const result = await this.database.query(
      `SELECT e.id, e.date, e.description, e.source_type, e.source_id, e.created_at,
              a.code AS account_code, a.name AS account_name, a.type AS account_type,
              l.debit, l.credit
       FROM journal_entries e
       JOIN journal_lines l ON l.entry_id = e.id
       JOIN accounts a ON a.id = l.account_id
       WHERE e.business_id = $1 ${cashOnly}
       ORDER BY e.date DESC, e.created_at DESC, e.id
       LIMIT $2`,
      [businessId, limit * 4] // a few lines per entry
    );

    const byId = new Map<string, JournalEntry>();
    for (const r of result.rows as any[]) {
      let entry = byId.get(r.id);
      if (!entry) {
        entry = {
          id: r.id,
          date: r.date ? new Date(r.date).toISOString().slice(0, 10) : null,
          description: r.description,
          sourceType: r.source_type,
          sourceId: r.source_id ?? null,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
          lines: [],
        };
        byId.set(r.id, entry);
      }
      entry.lines.push({
        accountCode: r.account_code,
        accountName: r.account_name,
        accountType: r.account_type,
        debit: Number.parseFloat(r.debit ?? '0'),
        credit: Number.parseFloat(r.credit ?? '0'),
      });
    }
    return [...byId.values()].slice(0, limit);
  }
}
