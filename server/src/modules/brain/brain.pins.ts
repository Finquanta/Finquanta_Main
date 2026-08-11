import { Database } from '../../infrastructure/database';
import { AccountingRepository } from '../accounting/accounting.repository';
import { GroupsRepository } from '../groups/groups.repository';
import { HealthRepository } from '../health/health.repository';
import { ProfileRepository } from '../profile/profile.repository';
import { computeHealthScore, PERIOD_DAYS } from '../health/health.service';
import { HealthContext, HealthScore } from '../health/health.types';

/**
 * Live data pins — the half of the Company Brain the user didn't write.
 *
 * Every figure here is read from data the platform already holds, by the same
 * repositories the dashboard and health score use. This file makes NO AI call
 * and computes no accounting of its own: it reads `getLedgerSummary`,
 * `getBalances`, `getGroupReport` and `computeHealthScore` and reshapes what
 * they return. If a number here ever disagreed with the dashboard, that would
 * be a bug in this file, not a second opinion.
 *
 * Metrics are returned as `{ key, value, format }` rather than finished
 * sentences so the client renders them in the reader's language — the same
 * reason health.service.ts returns `insightParts`.
 */

/** Category slugs that render a pin. Support and Compliance are notes-only in v1. */
export const PIN_KEYS = ['ceo', 'finance', 'sales', 'marketing', 'operations', 'engineering'] as const;
export type PinKey = (typeof PIN_KEYS)[number];

export interface PinMetric {
  /** Translation key the client renders a label from. */
  key: string;
  value: number | null;
  format: 'money' | 'number' | 'percent' | 'ratio';
}

export interface BrainPin {
  key: PinKey;
  /** False when the pin has nothing to show — e.g. no matching Business Group. */
  available: boolean;
  metrics: PinMetric[];
  /** Present on the CEO and Finance pins. */
  health?: HealthScore;
  /** Translation key for a caveat shown under the pin. */
  noteKey?: string;
}

/** The Business Group name each department pin looks for, case-insensitively. */
const GROUP_NAME_FOR: Partial<Record<PinKey, string[]>> = {
  marketing: ['marketing'],
  operations: ['operations', 'ops'],
  engineering: ['engineering', 'development', 'dev', 'product'],
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export class BrainPinsService {
  private ledger: AccountingRepository;
  private groups: GroupsRepository;
  private health: HealthRepository;
  private profiles: ProfileRepository;

  constructor(private database: Database) {
    this.ledger = new AccountingRepository(database);
    this.groups = new GroupsRepository(database);
    this.health = new HealthRepository(database);
    this.profiles = new ProfileRepository(database);
  }

  /** Resolve the requested pins for one workspace. */
  async resolve(businessId: string, keys: PinKey[]): Promise<BrainPin[]> {
    const wanted = keys.filter((k) => PIN_KEYS.includes(k));
    if (wanted.length === 0) return [];

    // Same guarantee the dashboard and health score make: the ledger is current
    // before anything reads from it, so a pin never shows stale books.
    await this.ledger.resyncBookkeeping(businessId);

    const needsHealth = wanted.includes('ceo') || wanted.includes('finance');
    const health = needsHealth ? await this.healthScore(businessId) : undefined;

    const pins: BrainPin[] = [];
    for (const key of wanted) {
      if (key === 'ceo') pins.push(await this.ceoPin(businessId, health!));
      else if (key === 'finance') pins.push(await this.financePin(businessId, health!));
      else if (key === 'sales') pins.push(await this.salesPin(businessId));
      else pins.push(await this.groupPin(businessId, key));
    }
    return pins;
  }

  private async healthScore(businessId: string): Promise<HealthScore> {
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [daysOfData, snapshot, previous, business] = await Promise.all([
      this.health.daysOfData(businessId),
      this.health.snapshot(businessId, iso(today), PERIOD_DAYS),
      this.health.snapshot(businessId, iso(monthAgo), PERIOD_DAYS),
      this.profiles.getBusiness(businessId),
    ]);

    const context: HealthContext = {
      maturityStage: business.maturityStage,
      industry: business.industry,
      niche: business.niche,
      hasDebt: business.hasDebt,
      primaryGoal: business.primaryGoal,
    };
    return computeHealthScore(snapshot, daysOfData >= 30 ? previous : null, daysOfData, context);
  }

  /** The CEO's own dashboard: the headline score plus the top-line figures. */
  private async ceoPin(businessId: string, health: HealthScore): Promise<BrainPin> {
    const { start, end } = this.monthToDate();
    const [summary, balances] = await Promise.all([
      this.ledger.getLedgerSummary(businessId, start, end, 'accrual'),
      this.ledger.getBalances(businessId),
    ]);
    const cash = balances.find((b: any) => b.code === 'CASH')?.balance ?? 0;

    return {
      key: 'ceo',
      available: true,
      health,
      metrics: [
        { key: 'cashPosition', value: cash, format: 'money' },
        { key: 'revenueThisMonth', value: Number.parseFloat(summary.totalIncome), format: 'money' },
        { key: 'netIncomeThisMonth', value: Number.parseFloat(summary.netIncome), format: 'money' },
      ],
    };
  }

  /** Always-current finance summary: score + ratios + cash + AR/AP + open invoices. */
  private async financePin(businessId: string, health: HealthScore): Promise<BrainPin> {
    const { start, end } = this.monthToDate();
    const [summary, balances, open] = await Promise.all([
      this.ledger.getLedgerSummary(businessId, start, end, 'accrual'),
      this.ledger.getBalances(businessId),
      this.openInvoices(businessId),
    ]);
    const at = (code: string) => balances.find((b: any) => b.code === code)?.balance ?? 0;

    return {
      key: 'finance',
      available: true,
      health,
      metrics: [
        { key: 'cashPosition', value: at('CASH'), format: 'money' },
        { key: 'revenueThisMonth', value: Number.parseFloat(summary.totalIncome), format: 'money' },
        { key: 'expensesThisMonth', value: Number.parseFloat(summary.totalExpenses), format: 'money' },
        { key: 'receivables', value: at('AR'), format: 'money' },
        { key: 'payables', value: at('AP'), format: 'money' },
        { key: 'openInvoices', value: open.count, format: 'number' },
        { key: 'openInvoiceValue', value: open.total, format: 'money' },
      ],
      // The spec asks for upcoming bill due dates here. Finquanta has no bills
      // entity and no due-date model yet — that arrives with document import —
      // so the pin shows what is owed in total, without dates, and says so
      // rather than implying the dates were checked.
      noteKey: 'pinNoBillDates',
    };
  }

  /** What the platform tracks that is closest to sales activity. */
  private async salesPin(businessId: string): Promise<BrainPin> {
    const since = new Date();
    since.setDate(since.getDate() - PERIOD_DAYS);

    const [newCustomers, open, top] = await Promise.all([
      this.database.query(
        `SELECT COUNT(*)::int AS n FROM customers WHERE business_id = $1 AND created_at >= $2`,
        [businessId, iso(since)]
      ),
      this.openInvoices(businessId),
      this.database.query(
        `SELECT COALESCE(SUM(total), 0) AS revenue
           FROM invoices
          WHERE business_id = $1 AND deleted_at IS NULL
            AND status IN ('sent','viewed','overdue','paid')
            AND issue_date >= $2
          GROUP BY customer_id
          ORDER BY revenue DESC
          LIMIT 1`,
        [businessId, iso(since)]
      ),
    ]);

    return {
      key: 'sales',
      available: true,
      metrics: [
        { key: 'newCustomers', value: Number(newCustomers.rows[0]?.n) || 0, format: 'number' },
        { key: 'topCustomerRevenue', value: Number.parseFloat(top.rows[0]?.revenue ?? '0'), format: 'money' },
        { key: 'openInvoices', value: open.count, format: 'number' },
        { key: 'openInvoiceValue', value: open.total, format: 'money' },
      ],
    };
  }

  /**
   * Marketing / Operations / Engineering pin the matching Business Group's net
   * contribution. The user may not have created one — that isn't an error, the
   * pin just isn't available and the category stays notes-only until they do.
   */
  private async groupPin(businessId: string, key: PinKey): Promise<BrainPin> {
    const names = GROUP_NAME_FOR[key] ?? [];
    const report = await this.groups.getGroupReport(
      businessId, `${new Date().getFullYear()}-01-01`, iso(new Date())
    );
    const row = report.find(
      (r) => r.groupId !== null && names.some((n) => r.name.toLowerCase().includes(n))
    );
    if (!row) return { key, available: false, metrics: [] };

    return {
      key,
      available: true,
      metrics: [
        { key: 'groupNet', value: row.net, format: 'money' },
        { key: 'groupSpend', value: row.outflow, format: 'money' },
        { key: 'groupInflow', value: row.inflow, format: 'money' },
        { key: 'groupEntries', value: row.entries, format: 'number' },
      ],
    };
  }

  /** Count and value of invoices still owed to the business. */
  private async openInvoices(businessId: string): Promise<{ count: number; total: number }> {
    const result = await this.database.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(total), 0) AS total
         FROM invoices
        WHERE business_id = $1 AND deleted_at IS NULL
          AND status IN ('sent','viewed','overdue')`,
      [businessId]
    );
    return {
      count: Number(result.rows[0]?.n) || 0,
      total: Number.parseFloat(result.rows[0]?.total ?? '0'),
    };
  }

  private monthToDate(): { start: string; end: string } {
    const now = new Date();
    return {
      start: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: iso(now),
    };
  }
}
