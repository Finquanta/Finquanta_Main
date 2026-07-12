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

  /** Recent journal entries with their lines, newest first. */
  async listEntries(businessId: string, limit = 100): Promise<JournalEntry[]> {
    const result = await this.database.query(
      `SELECT e.id, e.date, e.description, e.source_type, e.source_id, e.created_at,
              a.code AS account_code, a.name AS account_name, a.type AS account_type,
              l.debit, l.credit
       FROM journal_entries e
       JOIN journal_lines l ON l.entry_id = e.id
       JOIN accounts a ON a.id = l.account_id
       WHERE e.business_id = $1
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
