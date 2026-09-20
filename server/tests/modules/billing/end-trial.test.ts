import { BillingRepository } from '../../../src/modules/billing/billing.repository';
import { Database } from '../../../src/infrastructure/database';

/**
 * Ending a trial outright, for the admin comping a workspace mid-trial.
 *
 * The rule it has to keep is that a trial is used ONCE: ending one early is a
 * favour to the customer, not a way to hand them a second fortnight, so nothing
 * here may touch `users.trial_used_at`. It also leaves `status` alone — a
 * lapsed trial is told apart from a live one by its DATE everywhere else in the
 * product, and a second convention would leave the end-of-trial prompt unable
 * to recognise the trials this ended.
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

  /** The statement that actually ends it. */
  get end() {
    return this.statements.find((s) => s.text.includes('SET trial_ends_at = NOW()'));
  }

  /** Anything that would give the owner their trial back. */
  get touchedTrialUsed() {
    return this.statements.some((s) => s.text.includes('trial_used_at'));
  }
}

const repo = (db: FakeDb) => new BillingRepository(db as unknown as Database);

describe('ending a trial', () => {
  it('ends a running trial now', async () => {
    const db = new FakeDb(at(9));

    await repo(db).endTrial('biz');

    expect(db.end).toBeDefined();
    expect(db.end!.params).toEqual(['biz']);
  });

  it('never gives the trial back', async () => {
    const db = new FakeDb(at(9));

    await repo(db).endTrial('biz');

    expect(db.touchedTrialUsed).toBe(false);
  });

  it('leaves the status alone, so the end-of-trial prompt still recognises it', async () => {
    const db = new FakeDb(at(9));

    await repo(db).endTrial('biz');

    expect(db.end!.text).not.toContain('status =');
  });

  it('refuses when there is no trial to end', async () => {
    const db = new FakeDb(null);

    await expect(repo(db).endTrial('biz')).rejects.toThrow(/no running trial/i);
    expect(db.end).toBeUndefined();
  });

  it('refuses when the trial already lapsed', async () => {
    const db = new FakeDb(at(-3));

    // Nothing to end, and writing NOW() over a past date would move the end of
    // a finished trial forward — quietly restarting it for a few hours.
    await expect(repo(db).endTrial('biz')).rejects.toThrow(/no running trial/i);
    expect(db.end).toBeUndefined();
  });
});
