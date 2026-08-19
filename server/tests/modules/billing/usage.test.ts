import { UsageService, currentPeriod } from '../../../src/modules/billing/usage.service';
import { Database } from '../../../src/infrastructure/database';

/**
 * The rule these exist to protect: upgrading mid-cycle raises the ceiling but
 * does NOT refill the bucket.
 *
 * Without that, someone upgrades on day 28 for a couple of pounds of proration,
 * burns the larger allowance, and drops back — monthly, forever. Stripe gets the
 * money right; only the metering can stop the exploit.
 */

/** In-memory stand-in for the two tables this touches. */
class FakeDb {
  usage = new Map<string, number>();
  plan = 'freemium';
  status = 'none';

  private key(b: string, m: string, p: string) { return `${b}|${m}|${p}`; }

  async query(text: string, params: any[] = []): Promise<any> {
    if (text.includes('FROM billing_usage')) {
      const v = this.usage.get(this.key(params[0], params[1], params[2]));
      return { rows: v === undefined ? [] : [{ used: v }] };
    }
    if (text.includes('INSERT INTO billing_usage')) {
      const k = this.key(params[0], params[1], params[2]);
      const next = (this.usage.get(k) ?? 0) + Number(params[3]);
      this.usage.set(k, next);
      return { rows: [{ used: next }] };
    }
    if (text.includes('FROM business_members')) return { rows: [{ n: 1 }] };
    if (text.includes('INSERT INTO business_subscriptions')) return { rows: [], rowCount: 1 };
    if (text.includes('FROM business_subscriptions')) {
      return {
        rows: [{
          business_id: 'biz', plan: this.plan, status: this.status,
          trial_started_at: null, trial_ends_at: null, grandfathered_until: null,
          stripe_customer_id: null, stripe_subscription_id: null,
          current_period_end: null, cancel_at: null, updated_at: null,
        }],
      };
    }
    return { rows: [], rowCount: 0 };
  }
}

describe('UsageService', () => {
  let db: FakeDb;
  let usage: UsageService;

  beforeEach(() => {
    db = new FakeDb();
    usage = new UsageService(db as unknown as Database);
  });

  it('refuses a metric the plan does not include at all', async () => {
    // Freemium gets no Council sessions.
    const c = await usage.check('biz', 'council_sessions');
    expect(c.limit).toBe(0);
    expect(c.allowed).toBe(false);
    expect(c.remaining).toBe(0);
  });

  it('allows up to the plan limit and then stops', async () => {
    db.plan = 'entrepreneur'; db.status = 'active'; // 10 sessions/month
    for (let i = 0; i < 10; i++) {
      const c = await usage.check('biz', 'council_sessions');
      expect(c.allowed).toBe(true);
      await usage.record('biz', 'council_sessions');
    }
    const after = await usage.check('biz', 'council_sessions');
    expect(after.used).toBe(10);
    expect(after.allowed).toBe(false);
    expect(after.remaining).toBe(0);
  });

  it('treats null as unlimited', async () => {
    db.plan = 'corporate'; db.status = 'active';
    await usage.record('biz', 'finna_messages', 9999);
    const c = await usage.check('biz', 'finna_messages');
    expect(c.limit).toBeNull();
    expect(c.allowed).toBe(true);
    expect(c.remaining).toBeNull();
  });

  it('UPGRADING RAISES THE CEILING WITHOUT REFILLING THE BUCKET', async () => {
    db.plan = 'entrepreneur'; db.status = 'active';
    // Burn the Entrepreneur allowance.
    await usage.record('biz', 'council_sessions', 10);
    expect((await usage.check('biz', 'council_sessions')).allowed).toBe(false);

    // Upgrade mid-period.
    db.plan = 'business'; // 30/month

    const after = await usage.check('biz', 'council_sessions');
    // Consumption survives the plan change — this is the whole point.
    expect(after.used).toBe(10);
    expect(after.limit).toBe(30);
    // They get the DIFFERENCE, not a fresh 30.
    expect(after.remaining).toBe(20);
    expect(after.allowed).toBe(true);
  });

  it('DOWNGRADING DOES NOT ERASE WHAT WAS ALREADY SPENT', async () => {
    db.plan = 'business'; db.status = 'active';
    await usage.record('biz', 'council_sessions', 25);

    // Drop back after burning a Business-sized allowance.
    db.plan = 'entrepreneur'; // 10/month

    const after = await usage.check('biz', 'council_sessions');
    expect(after.used).toBe(25);
    expect(after.limit).toBe(10);
    // Already over the lower ceiling, so no more this period. Cycling up and
    // down within a month buys nothing.
    expect(after.allowed).toBe(false);
    expect(after.remaining).toBe(0);
  });

  it('counts each metric separately', async () => {
    db.plan = 'entrepreneur'; db.status = 'active';
    await usage.record('biz', 'council_sessions', 5);
    expect((await usage.check('biz', 'finna_messages')).used).toBe(0);
  });

  it('keeps a separate count per business', async () => {
    db.plan = 'entrepreneur'; db.status = 'active';
    await usage.record('biz', 'council_sessions', 5);
    expect(await usage.used('other', 'council_sessions')).toBe(0);
  });

  it('reports a period so a new month starts clean', () => {
    expect(currentPeriod(new Date(Date.UTC(2026, 7, 17)))).toBe('2026-08');
    expect(currentPeriod(new Date(Date.UTC(2026, 11, 1)))).toBe('2026-12');
    // Zero-padded, so string comparison and grouping behave.
    expect(currentPeriod(new Date(Date.UTC(2027, 0, 9)))).toBe('2027-01');
  });

  it('summarises every metric for the dashboard meters', async () => {
    db.plan = 'business'; db.status = 'active';
    await usage.record('biz', 'finna_messages', 120);
    const s = await usage.summary('biz');
    expect(s.finna_messages.used).toBe(120);
    expect(s.finna_messages.limit).toBe(2000);
    expect(s.council_sessions.used).toBe(0);
    expect(s.council_sessions.limit).toBe(30);
  });
});
