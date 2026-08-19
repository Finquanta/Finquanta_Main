import { BillingRepository } from '../../../src/modules/billing/billing.repository';
import { Database } from '../../../src/infrastructure/database';

/**
 * setPlan is the single line that turns a payment into access. It is also the
 * only line that never runs until money actually arrives — which is how it
 * shipped broken.
 *
 * The original query used `$2` twice: assigned to a `varchar` column, and
 * compared against a bare `'freemium'` literal inside a CASE. Postgres deduced
 * `character varying` from one use and `text` from the other and rejected the
 * whole statement with 42P08. Every paid invoice threw, the webhook answered
 * 500, and the customer was charged and granted nothing.
 *
 * These tests pin the shape that cannot fail that way: one placeholder, one
 * use, and the status decided in TypeScript.
 */

class FakeDb {
  calls: { text: string; params: any[] }[] = [];

  async query(text: string, params: any[] = []): Promise<any> {
    this.calls.push({ text: text.replace(/\s+/g, ' ').trim(), params });
    if (text.includes('FROM business_subscriptions')) {
      return {
        rows: [{
          business_id: 'biz', plan: 'freemium', status: 'none',
          trial_started_at: null, trial_ends_at: null, grandfathered_until: null,
          stripe_customer_id: null, stripe_subscription_id: null,
          current_period_end: null, cancel_at: null, updated_at: null,
        }],
      };
    }
    return { rows: [], rowCount: 1 };
  }

  /**
   * The setPlan statement specifically.
   *
   * `get()` now issues its OWN `UPDATE business_subscriptions SET plan = ...`
   * to apply a scheduled downgrade whose date has arrived, and `setPlan` calls
   * `ensureFor` -> `get()` first. Matching on the prefix alone found that one
   * instead, which is why this looks for the parameter placeholder.
   */
  get update() {
    return this.calls.find((c) => c.text.includes('SET plan = $2'));
  }
}

describe('BillingRepository.setPlan', () => {
  it('never uses the same placeholder in two different type positions', async () => {
    const db = new FakeDb();
    await new BillingRepository(db as unknown as Database).setPlan('biz', 'business');

    const sql = db.update!.text;
    // The exact defect: `$2` assigned to a column AND compared to a literal.
    // Postgres infers a different type from each and refuses the statement.
    expect(sql).not.toMatch(/CASE WHEN \$2/);
    expect((sql.match(/\$2/g) || []).length).toBe(1);
  });

  it('marks a paid plan active', async () => {
    const db = new FakeDb();
    await new BillingRepository(db as unknown as Database).setPlan('biz', 'business');

    expect(db.update!.params).toEqual(['biz', 'business', 'active']);
  });

  it('marks freemium as no subscription at all', async () => {
    const db = new FakeDb();
    await new BillingRepository(db as unknown as Database).setPlan('biz', 'freemium');

    // Not 'active': nobody is being billed, so calling it an active
    // subscription would make the admin revenue view count it.
    expect(db.update!.params).toEqual(['biz', 'freemium', 'none']);
  });

  it('creates the row first, so granting a plan cannot miss', async () => {
    const db = new FakeDb();
    await new BillingRepository(db as unknown as Database).setPlan('biz', 'entrepreneur');

    // A workspace that never touched billing has no subscription row, and an
    // UPDATE against nothing would silently affect zero rows — a paid customer
    // left on freemium with no error anywhere.
    expect(db.calls[0]?.text).toContain('INSERT INTO business_subscriptions');
  });
});
