import { BillingRepository } from '../../../src/modules/billing/billing.repository';
import { Database } from '../../../src/infrastructure/database';

/**
 * A trial's end date has to move in BOTH directions.
 *
 * It only ever moved out before: the admin route rejected anything <= 0, so a
 * trial set too generously could only be corrected in the database by hand.
 *
 * Reducing is not simply extending by a negative number, because the statement
 * that extends also CREATES a trial where none exists — `COALESCE(trial_ends_at,
 * NOW())` with status forced to 'trialing'. Taking days off a workspace that
 * never had a trial would therefore invent one, already expired, and the
 * end-of-trial plan prompt would then fire at somebody who was never offered a
 * trial at all.
 */

const DAY = 86_400_000;
const at = (n: number) => new Date(Date.now() + n * DAY).toISOString();

class FakeDb {
  statements: { text: string; params: any[] }[] = [];

  constructor(private trialEndsAt: string | null) {}

  async query(text: string, params: any[] = []): Promise<any> {
    const flat = text.replace(/\s+/g, ' ').trim();
    this.statements.push({ text: flat, params });
    if (flat.startsWith('SELECT * FROM business_subscriptions')) {
      return {
        rows: [{
          business_id: 'biz', plan: 'freemium',
          status: this.trialEndsAt ? 'trialing' : 'none',
          trial_started_at: this.trialEndsAt ? at(-7) : null,
          trial_ends_at: this.trialEndsAt,
          grandfathered_until: null, stripe_customer_id: null,
          stripe_subscription_id: null, current_period_end: null, cancel_at: null,
          pending_plan: null, pending_plan_at: null, trial_prompt_at: null, updated_at: null,
        }],
      };
    }
    return { rows: [], rowCount: 1 };
  }

  /** The statement that actually moves the date. */
  get move() {
    return this.statements.find((s) => s.text.includes('SET status = \'trialing\'') && s.text.includes('trial_ends_at ='));
  }
}

const repo = (db: FakeDb) => new BillingRepository(db as unknown as Database);

describe('adjusting a trial', () => {
  it('adds days to a running trial', async () => {
    const db = new FakeDb(at(5));

    await repo(db).extendTrial('biz', 10);

    expect(db.move).toBeDefined();
    expect(db.move!.params).toEqual(['biz', '10']);
  });

  it('takes days off a running trial', async () => {
    const db = new FakeDb(at(20));

    await repo(db).extendTrial('biz', -6);

    // Passed straight through as a negative interval — Postgres subtracts it.
    expect(db.move!.params).toEqual(['biz', '-6']);
  });

  it('refuses to take days off a workspace with no trial', async () => {
    const db = new FakeDb(null);

    // The case that matters: this must not invent an already-expired trial,
    // which would then trigger the end-of-trial plan prompt.
    await expect(repo(db).extendTrial('biz', -6)).rejects.toThrow(/no trial/i);
    expect(db.move).toBeUndefined();
  });

  it('still creates the row when ADDING to a workspace with no trial', async () => {
    const db = new FakeDb(null);

    // Extending is allowed to start one — that is what the admin panel's own
    // Start trial relies on, and it is only the reducing direction that must
    // not fabricate anything.
    await expect(repo(db).extendTrial('biz', 14)).resolves.toBeDefined();
    expect(db.move).toBeDefined();
  });

  it('measures from the later of now and the existing end', async () => {
    const db = new FakeDb(at(-30));

    await repo(db).extendTrial('biz', 7);

    // A lapsed trial extended from its OWN old end date would hand out days
    // that are already gone — seven days that expired last month.
    expect(db.move!.text).toContain('GREATEST');
    expect(db.move!.text).toContain('NOW()');
  });
});
