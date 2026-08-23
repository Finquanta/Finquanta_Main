import { BillingRepository } from '../../../src/modules/billing/billing.repository';
import { Database } from '../../../src/infrastructure/database';

/**
 * One trial per PERSON, not per workspace.
 *
 * Creating a workspace is free and unlimited, so a per-workspace trial is one
 * anybody can have as often as they can be bothered to click: make another
 * workspace, get another fortnight of Business. Deleting and remaking one works
 * too. The claim against the user row is what closes it.
 */

interface Row { trial_used_at: string | null; trial_bonus_at: string | null }

const DAY = 86_400_000;
export const daysFromNow = (n: number) => new Date(Date.now() + n * DAY).toISOString();

class FakeDb {
  statements: { text: string; params: any[] }[] = [];

  /**
   * `trialEndsAt` is when the trial on the workspace this person OWNS runs out.
   * Null means they have no trial at all; a date in the past is the state a
   * lapsed trial actually sits in, because nothing ever moves `status` off
   * 'trialing' when one expires.
   */
  constructor(
    private user: Row = { trial_used_at: null, trial_bonus_at: null },
    private trialEndsAt: string | null = null
  ) {}

  /** The `trial_ends_at > NOW()` the real claim and extend both carry. */
  private get hasLiveTrial() {
    return !!this.trialEndsAt && new Date(this.trialEndsAt).getTime() > Date.now();
  }

  async query(text: string, params: any[] = []): Promise<any> {
    const flat = text.replace(/\s+/g, ' ').trim();
    this.statements.push({ text: flat, params });

    // The one-shot claim: succeeds only while the column is still null, which
    // is what makes it safe against two requests arriving together.
    if (flat.includes('UPDATE users SET trial_used_at = NOW()') && flat.includes('trial_used_at IS NULL')) {
      if (this.user.trial_used_at) return { rows: [], rowCount: 0 };
      this.user.trial_used_at = new Date().toISOString();
      return { rows: [{ id: params[0] }], rowCount: 1 };
    }
    if (flat.includes('SET trial_bonus_at = NOW()')) {
      // Mirrors the real guard: used a trial, not yet bonused, and there is a
      // trial still RUNNING to add the days to.
      if (!this.user.trial_used_at || this.user.trial_bonus_at || !this.hasLiveTrial) {
        return { rows: [], rowCount: 0 };
      }
      this.user.trial_bonus_at = new Date().toISOString();
      return { rows: [{ id: params[0] }], rowCount: 1 };
    }
    if (flat.includes('SET trial_ends_at')) {
      // The extend carries the same liveness condition, so an expired trial
      // matches no rows rather than being restarted from today.
      return { rows: [], rowCount: this.hasLiveTrial ? 1 : 0 };
    }
    if (flat.startsWith('SELECT trial_used_at FROM users')) {
      return { rows: [{ trial_used_at: this.user.trial_used_at }] };
    }
    if (flat.includes('FROM business_subscriptions WHERE business_id')) {
      return {
        rows: [{
          business_id: params[0], plan: 'freemium', status: 'none',
          trial_started_at: null, trial_ends_at: null, grandfathered_until: null,
          stripe_customer_id: null, stripe_subscription_id: null,
          current_period_end: null, cancel_at: null,
          pending_plan: null, pending_plan_at: null, updated_at: null,
        }],
      };
    }
    return { rows: [], rowCount: 1 };
  }

  /** Did the subscription row actually get put into a trial? */
  get startedTrial() {
    return this.statements.some((s) => s.text.includes("SET status = 'trialing'"));
  }
}

const repo = (db: FakeDb) => new BillingRepository(db as unknown as Database);

describe('one trial per account', () => {
  it('starts the trial and stamps the person', async () => {
    const db = new FakeDb();

    await repo(db).startTrial('biz-1', 14, { userId: 'user-1' });

    expect(db.startedTrial).toBe(true);
    const claim = db.statements.find((s) => s.text.includes('UPDATE users SET trial_used_at = NOW()'));
    expect(claim?.params).toEqual(['user-1']);
  });

  it('refuses a second trial on a different workspace', async () => {
    // The whole point: a new workspace must not come with a new trial.
    const db = new FakeDb({ trial_used_at: '2026-01-01T00:00:00Z', trial_bonus_at: null });

    await repo(db).startTrial('biz-2', 14, { userId: 'user-1' });

    expect(db.startedTrial).toBe(false);
  });

  it('claims with a guarded UPDATE rather than reading first', async () => {
    const db = new FakeDb();

    await repo(db).startTrial('biz-1', 14, { userId: 'user-1' });

    // A read-then-write would let two simultaneous requests both see null and
    // both start a trial. The condition has to live in the write.
    const claim = db.statements.find((s) => s.text.includes('UPDATE users SET trial_used_at = NOW()'));
    expect(claim?.text).toContain('trial_used_at IS NULL');
  });

  it('lets an admin grant one anyway', async () => {
    // Comping somebody a second trial is a deliberate act, not the accident
    // this rule exists to prevent.
    const db = new FakeDb({ trial_used_at: '2026-01-01T00:00:00Z', trial_bonus_at: null });

    await repo(db).startTrial('biz-2', 14, { userId: 'user-1', force: true });

    expect(db.startedTrial).toBe(true);
  });

  it('reports whether the person has used theirs', async () => {
    expect(await repo(new FakeDb()).hasUsedTrial('user-1')).toBe(false);
    expect(
      await repo(new FakeDb({ trial_used_at: '2026-01-01T00:00:00Z', trial_bonus_at: null })).hasUsedTrial('user-1')
    ).toBe(true);
  });
});

describe('verification bonus', () => {
  it('extends a running trial once', async () => {
    const db = new FakeDb({ trial_used_at: '2026-01-01T00:00:00Z', trial_bonus_at: null }, daysFromNow(3));

    const extended = await repo(db).awardVerificationBonus('user-1', 7);

    expect(extended).toBe(1);
    const bump = db.statements.find((s) => s.text.includes('UPDATE business_subscriptions s SET trial_ends_at'));
    expect(bump?.params).toEqual(['user-1', '7']);
    // Added to the trial's OWN end date, not to today — 7 days started
    // unverified must come to exactly the 14 a verified signup would have had.
    expect(bump?.text).toContain('SET trial_ends_at = s.trial_ends_at + ');
  });

  /**
   * The one that matters. `status` is never moved off 'trialing' when a trial
   * lapses, so 'trialing' also describes every trial that has ever expired.
   * Extending from GREATEST(trial_ends_at, NOW()) therefore restarted a dead
   * trial from TODAY — a full week of Business for anyone whose trial ended
   * months ago, the first time they confirmed an address. The boot-time
   * backfill stamps trial_used_at on exactly that population, and
   * resendVerification is public, so it was reachable on demand.
   */
  it('does NOT revive a trial that has already expired', async () => {
    const db = new FakeDb({ trial_used_at: '2026-01-01T00:00:00Z', trial_bonus_at: null }, daysFromNow(-30));

    const extended = await repo(db).awardVerificationBonus('user-1', 7);

    expect(extended).toBe(0);
    // And the bonus is not burnt on somebody it could not be paid to.
    expect(db.statements.some((s) => s.text.includes('SET trial_ends_at'))).toBe(false);
  });

  it('only tops up a trial that is still running', async () => {
    const db = new FakeDb({ trial_used_at: '2026-01-01T00:00:00Z', trial_bonus_at: null }, daysFromNow(2));

    await repo(db).awardVerificationBonus('user-1', 7);

    // Both statements have to carry the liveness test; the claim alone is not
    // enough, and the extend alone would still spend the one-shot bonus.
    const claim = db.statements.find((s) => s.text.includes('SET trial_bonus_at = NOW()'));
    const bump = db.statements.find((s) => s.text.includes('SET trial_ends_at'));
    expect(claim?.text).toContain('trial_ends_at > NOW()');
    expect(bump?.text).toContain('trial_ends_at > NOW()');
  });

  it('cannot be claimed twice', async () => {
    const db = new FakeDb(
      { trial_used_at: '2026-01-01T00:00:00Z', trial_bonus_at: '2026-01-02T00:00:00Z' },
      daysFromNow(3)
    );

    const extended = await repo(db).awardVerificationBonus('user-1', 7);

    expect(extended).toBe(0);
    expect(db.statements.some((s) => s.text.includes('SET trial_ends_at'))).toBe(false);
  });

  it('does nothing for somebody who never started a trial', async () => {
    const db = new FakeDb();

    expect(await repo(db).awardVerificationBonus('user-1', 7)).toBe(0);
  });
});
