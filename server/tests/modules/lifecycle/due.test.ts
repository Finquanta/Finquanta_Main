import { LifecycleService } from '../../../src/modules/lifecycle/lifecycle.service';
import { Database } from '../../../src/infrastructure/database';

/**
 * Who the scheduled reminders would email, and — more importantly — who they
 * would not.
 *
 * These are the only emails Finquanta sends that nobody asked for, so the
 * interesting assertions are all about restraint. Every one of them corresponds
 * to a way of annoying a real customer:
 *
 *   - nagging somebody to buy what a grandfather window already gives them free
 *   - nagging somebody mid-trial
 *   - nagging somebody who unsubscribed
 *   - nagging somebody who already clicked the last one
 *   - sending three separate emails to one person on the same morning
 */

const DAY = 86_400_000;
const at = (n: number) => new Date(Date.now() + n * DAY).toISOString();

interface Row { [k: string]: any }

class FakeDb {
  queries: string[] = [];
  constructor(private plan: { upgrade?: Row[]; verify?: Row[]; phone?: Row[]; reengage?: Row[] } = {}) {}

  async query(text: string): Promise<any> {
    const flat = text.replace(/\s+/g, ' ').trim();
    this.queries.push(flat);
    if (flat.includes("reminder_type = 'upgrade_nudge'")) return { rows: this.plan.upgrade ?? [] };
    if (flat.includes("reminder_type = 'email_verification'")) return { rows: this.plan.verify ?? [] };
    if (flat.includes("reminder_type = 'phone_recovery'")) return { rows: this.plan.phone ?? [] };
    if (flat.includes("reminder_type = 'workspace_reengagement'")) return { rows: this.plan.reengage ?? [] };
    return { rows: [], rowCount: 0 };
  }

  get upgradeSql() { return this.queries.find((q) => q.includes("reminder_type = 'upgrade_nudge'")) ?? ''; }
  get verifySql() { return this.queries.find((q) => q.includes("reminder_type = 'email_verification'")) ?? ''; }
  get reengageSql() { return this.queries.find((q) => q.includes("reminder_type = 'workspace_reengagement'")) ?? ''; }
}

const svc = (db: FakeDb) => new LifecycleService(db as unknown as Database);

/** A candidate row as the upgrade query returns it. */
const candidate = (over: Row = {}): Row => ({
  id: 'u1', email: 'a@example.com', first_name: 'A',
  business_id: 'b1', business_name: 'Books',
  plan: 'freemium', status: 'none', trial_ends_at: null, grandfathered_until: null,
  ...over,
});

describe('the upgrade nudge leaves covered workspaces alone', () => {
  it('asks a workspace with nothing covering it', async () => {
    const db = new FakeDb({ upgrade: [candidate()] });
    const due = await svc(db).collectDue();
    expect(due.filter((d) => d.type === 'upgrade_nudge')).toHaveLength(1);
  });

  it('does NOT ask a grandfathered workspace', async () => {
    // The one that matters most: 30 of 31 production workspaces are
    // grandfathered until Feb 2027. A trigger of "plan = freemium" alone would
    // ask nearly every customer to pay for what they already have free.
    const db = new FakeDb({ upgrade: [candidate({ grandfathered_until: at(180) })] });
    const due = await svc(db).collectDue();
    expect(due.filter((d) => d.type === 'upgrade_nudge')).toHaveLength(0);
  });

  it('does NOT ask a workspace on a running trial', async () => {
    const db = new FakeDb({ upgrade: [candidate({ status: 'trialing', trial_ends_at: at(9) })] });
    const due = await svc(db).collectDue();
    expect(due.filter((d) => d.type === 'upgrade_nudge')).toHaveLength(0);
  });

  it('DOES ask once a grandfather window has lapsed', async () => {
    const db = new FakeDb({ upgrade: [candidate({ grandfathered_until: at(-1) })] });
    const due = await svc(db).collectDue();
    expect(due.filter((d) => d.type === 'upgrade_nudge')).toHaveLength(1);
  });

  it('DOES ask once a trial has expired', async () => {
    // status stays 'trialing' forever — nothing moves it when a trial lapses —
    // so the date is the only thing that distinguishes the two.
    const db = new FakeDb({ upgrade: [candidate({ status: 'trialing', trial_ends_at: at(-3) })] });
    const due = await svc(db).collectDue();
    expect(due.filter((d) => d.type === 'upgrade_nudge')).toHaveLength(1);
  });

  it('treats a workspace with no subscription row as plain freemium', async () => {
    // Rows are created lazily by ensureFor, so a workspace that has never
    // opened the billing page has none at all. An inner join here silently
    // excluded exactly the newest customers.
    const db = new FakeDb({ upgrade: [candidate({ plan: null, status: null })] });
    const due = await svc(db).collectDue();
    expect(due.filter((d) => d.type === 'upgrade_nudge')).toHaveLength(1);
    expect(db.upgradeSql).toContain('LEFT JOIN business_subscriptions');
  });
});

describe('the queries carry their own guards', () => {
  it('every reminder skips anyone who clicked or opted out', async () => {
    const db = new FakeDb();
    await svc(db).collectDue();
    for (const sql of [db.upgradeSql, db.verifySql, db.reengageSql]) {
      expect(sql).toContain('NOT COALESCE(r.stopped, false)');
      expect(sql).toContain('COALESCE(p.enabled, true)');
    }
  });

  it('cadence is enforced in SQL, not by trusting the schedule', async () => {
    // A cron that fires twice, late, or during a redeploy is ordinary. If the
    // interval only existed in the schedule, any of those would double-send.
    const db = new FakeDb();
    await svc(db).collectDue();
    expect(db.verifySql).toContain("interval '14 days'");
    expect(db.upgradeSql).toContain("interval '30 days'");
    expect(db.reengageSql).toContain("interval '60 days'");
  });

  it('gives a new account time before asking it for money', async () => {
    const db = new FakeDb();
    await svc(db).collectDue();
    // Signing up on Monday and being asked to buy on Tuesday reads as a shop
    // rather than a product, and the personalised line has no usage to cite.
    expect(db.upgradeSql).toContain("u.created_at <= NOW() - interval '14 days'");
    expect(db.verifySql).toContain("u.created_at <= NOW() - interval '7 days'");
  });

  it('re-engagement waits for EVERY member to go quiet', async () => {
    const db = new FakeDb();
    await svc(db).collectDue();
    // MAX across members, not each member's own clock: one active colleague
    // means the workspace is not abandoned.
    expect(db.reengageSql).toContain('MAX(u2.last_active_at)');
  });

  it('only owners and admins are asked to upgrade', async () => {
    const db = new FakeDb();
    await svc(db).collectDue();
    expect(db.upgradeSql).toContain("m.role IN ('Owner', 'Admin')");
  });
});

describe('one digest per person', () => {
  it('combines everything due into a single email', async () => {
    const db = new FakeDb({
      verify: [{ id: 'u1', email: 'a@example.com', first_name: 'A' }],
      phone: [{ id: 'u1', email: 'a@example.com', first_name: 'A' }],
      upgrade: [candidate()],
    });
    const result = await svc(db).run({ dryRun: true });

    // Three reminders, one recipient — not three emails in the same minute,
    // which is the fastest way to be marked as spam.
    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0]?.types.sort()).toEqual(
      ['email_verification', 'phone_recovery', 'upgrade_nudge']
    );
  });

  it('counts a type once per person even across several workspaces', async () => {
    const db = new FakeDb({
      upgrade: [candidate({ business_id: 'b1' }), candidate({ business_id: 'b2' })],
    });
    const result = await svc(db).run({ dryRun: true });
    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0]?.types).toEqual(['upgrade_nudge']);
  });

  it('a dry run sends nothing', async () => {
    const db = new FakeDb({ verify: [{ id: 'u1', email: 'a@example.com', first_name: 'A' }] });
    const result = await svc(db).run({ dryRun: true });
    expect(result.sent).toBe(0);
    expect(result.dryRun).toBe(true);
  });
});
