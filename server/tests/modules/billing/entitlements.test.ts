import { EntitlementsService } from '../../../src/modules/billing/entitlements.service';
import { Database } from '../../../src/infrastructure/database';

/**
 * Entitlements decide what a paying customer gets and what everyone else is
 * refused, so the precedence rules need to be pinned rather than assumed.
 *
 * The rule under test: the HIGHEST access wins. Someone grandfathered who buys
 * a plan must not be quietly downgraded when their window ends, and a trial
 * ending must not remove access a grandfather window still grants.
 */

const DAY = 86_400_000;
const future = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const past = (days: number) => new Date(Date.now() - days * DAY).toISOString();

interface Row {
  plan: string;
  status: string;
  trial_ends_at: string | null;
  grandfathered_until: string | null;
}

class FakeDb {
  constructor(private row: Row, private seats = 1, private viewers = 0) {}

  async query(text: string, _params: any[] = []): Promise<any> {
    if (text.includes('FROM business_members')) {
      // Mirrors the real query: viewers are excluded from billable seats.
      const billable = text.includes("role <> 'Viewer'") ? this.seats - this.viewers : this.seats;
      return { rows: [{ n: billable }] };
    }
    if (text.includes('INSERT INTO business_subscriptions')) return { rows: [], rowCount: 1 };
    if (text.includes('FROM business_subscriptions')) {
      return {
        rows: [{
          business_id: 'biz',
          plan: this.row.plan,
          status: this.row.status,
          trial_started_at: null,
          trial_ends_at: this.row.trial_ends_at,
          grandfathered_until: this.row.grandfathered_until,
          stripe_customer_id: null, stripe_subscription_id: null,
          current_period_end: null, cancel_at: null, updated_at: null,
        }],
      };
    }
    return { rows: [], rowCount: 0 };
  }
}

const svc = (row: Partial<Row>, seats = 1, viewers = 0) =>
  new EntitlementsService(
    new FakeDb({
      plan: 'freemium', status: 'none', trial_ends_at: null, grandfathered_until: null,
      ...row,
    }, seats, viewers) as unknown as Database
  );

describe('EntitlementsService', () => {
  it('gives a freemium workspace the Brain but not the graph', async () => {
    const e = await svc({}).for('biz');
    expect(e.effectivePlan).toBe('freemium');
    expect(e.features.brainGraph).toBe(false);
    expect(e.features.brainBacklinks).toBe(false);
    expect(e.features.council).toBe(false);
  });

  it('unlocks the graph and Council on Entrepreneur', async () => {
    const e = await svc({ plan: 'entrepreneur', status: 'active' }).for('biz');
    expect(e.features.brainGraph).toBe(true);
    expect(e.features.brainAutoAI).toBe(true);
    // Council starts at Entrepreneur, matching what the pricing page sells.
    expect(e.features.council).toBe(true);
    // The paid tiers differ by ALLOWANCE, not access.
    expect(e.limits.councilSessionsPerMonth).toBe(10);
  });

  it('gives Business a larger Council allowance than Entrepreneur', async () => {
    const e = await svc({ plan: 'business', status: 'active' }).for('biz');
    expect(e.features.council).toBe(true);
    expect(e.limits.councilSessionsPerMonth).toBe(30);
  });

  it('withholds Council from freemium', async () => {
    const e = await svc({}).for('biz');
    expect(e.features.council).toBe(false);
    expect(e.limits.councilSessionsPerMonth).toBe(0);
  });

  it('grants full access during a live trial', async () => {
    const e = await svc({ status: 'trialing', trial_ends_at: future(5) }).for('biz');
    expect(e.plan).toBe('freemium');          // nothing is being billed
    expect(e.effectivePlan).toBe('business'); // but everything is unlocked
    expect(e.reason).toBe('trial');
    expect(e.features.council).toBe(true);
    expect(e.daysRemaining).toBe(5);
  });

  it('drops back to freemium once the trial has lapsed', async () => {
    const e = await svc({ status: 'trialing', trial_ends_at: past(1) }).for('biz');
    expect(e.effectivePlan).toBe('freemium');
    expect(e.features.council).toBe(false);
  });

  it('keeps grandfathered accounts on full access inside the window', async () => {
    const e = await svc({ grandfathered_until: future(180) }).for('biz');
    expect(e.effectivePlan).toBe('business');
    expect(e.reason).toBe('grandfathered');
    expect(e.features.brainGraph).toBe(true);
  });

  it('lets a grandfather window lapse back to freemium', async () => {
    const e = await svc({ grandfathered_until: past(1) }).for('biz');
    expect(e.effectivePlan).toBe('freemium');
    expect(e.features.brainGraph).toBe(false);
  });

  it('never downgrades a paying customer because their free window ended', async () => {
    // The case that would be a support ticket: bought Business, grandfather
    // expired yesterday. Taking Council away here would be a bug.
    const e = await svc({
      plan: 'business', status: 'active', grandfathered_until: past(1),
    }).for('biz');
    expect(e.effectivePlan).toBe('business');
    expect(e.reason).toBe('plan');
    expect(e.features.council).toBe(true);
  });

  it('takes the best of plan, trial and grandfather together', async () => {
    // Paying for Entrepreneur, still inside the grandfather window: they should
    // see everything the window grants, not just what they pay for.
    const e = await svc({
      plan: 'entrepreneur', status: 'active', grandfathered_until: future(30),
    }).for('biz');
    expect(e.effectivePlan).toBe('business');
    expect(e.plan).toBe('entrepreneur');
    expect(e.features.council).toBe(true);
  });

  it('counts working members as seats', async () => {
    const e = await svc({ plan: 'business', status: 'active' }, 4).for('biz');
    expect(e.seats).toBe(4);
  });

  it('does NOT bill for viewers', async () => {
    // A viewer can only look at the books. Charging a full seat for read-only
    // access would make sharing figures with an accountant cost the same as
    // adding a colleague who actually uses the product.
    const e = await svc({ plan: 'business', status: 'active' }, 5, 2).for('biz');
    expect(e.seats).toBe(3);
  });

  it('never drops below one seat', async () => {
    // An owner plus only viewers still has the owner, and Stripe rejects a
    // quantity of zero outright.
    const e = await svc({ plan: 'business', status: 'active' }, 3, 3).for('biz');
    expect(e.seats).toBe(1);
  });

  it('answers a single feature question', async () => {
    const s = svc({ plan: 'entrepreneur', status: 'active' });
    await expect(s.can('biz', 'brainGraph')).resolves.toBe(true);
    await expect(s.can('biz', 'portfolio')).resolves.toBe(false);
  });
});
