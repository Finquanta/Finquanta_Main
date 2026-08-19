import { effectivePlan, effectivePlanFromRow } from '../../../src/modules/billing/effective-plan';

/**
 * This helper exists because three surfaces answered the same question
 * differently: the business switcher said "Business" beside a workspace the
 * admin panel called "Freemium". Both were true — one showed what the customer
 * can USE, the other what they are BILLED — but nothing said which.
 *
 * These tests pin the rule now that the switcher, the entitlements service and
 * the admin panel all resolve it here.
 */

const DAY = 86_400_000;
const future = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const past = (days: number) => new Date(Date.now() - days * DAY).toISOString();

describe('effectivePlan', () => {
  it('is the billed plan when nothing else applies', () => {
    const e = effectivePlan({
      plan: 'entrepreneur', status: 'active', trialEndsAt: null, grandfatheredUntil: null,
    });
    expect(e.key).toBe('entrepreneur');
    expect(e.reason).toBe('plan');
    expect(e.onFreeWindow).toBe(false);
  });

  it('reads a grandfathered freemium workspace as Business', () => {
    // The exact case that surfaced the inconsistency: every account that
    // existed before billing shipped is freemium with a window into 2027.
    const e = effectivePlanFromRow({
      plan: 'freemium', status: 'none', trial_ends_at: null, grandfathered_until: future(180),
    });
    expect(e.name).toBe('Business');
    expect(e.reason).toBe('grandfathered');
    expect(e.onFreeWindow).toBe(true);
  });

  it('unlocks everything during a live trial', () => {
    const e = effectivePlan({
      plan: 'freemium', status: 'trialing', trialEndsAt: future(5), grandfatheredUntil: null,
    });
    expect(e.key).toBe('business');
    expect(e.reason).toBe('trial');
  });

  it('lets a lapsed window fall back', () => {
    const e = effectivePlan({
      plan: 'freemium', status: 'trialing', trialEndsAt: past(1), grandfatheredUntil: past(1),
    });
    expect(e.key).toBe('freemium');
    expect(e.onFreeWindow).toBe(false);
  });

  it('never downgrades a paying customer when their free window ends', () => {
    const e = effectivePlan({
      plan: 'business', status: 'active', trialEndsAt: null, grandfatheredUntil: past(1),
    });
    expect(e.key).toBe('business');
    expect(e.reason).toBe('plan');
  });

  it('takes the highest of plan and window together', () => {
    // Paying for Entrepreneur, still inside the window: they should see what
    // the window grants, not only what they pay for.
    const e = effectivePlan({
      plan: 'entrepreneur', status: 'active', trialEndsAt: null, grandfatheredUntil: future(30),
    });
    expect(e.key).toBe('business');
    expect(e.reason).toBe('grandfathered');
  });

  it('does not demote a Corporate customer to the trial plan', () => {
    // Corporate outranks the trial plan, so a window must not lower it.
    const e = effectivePlan({
      plan: 'corporate', status: 'active', trialEndsAt: null, grandfatheredUntil: future(30),
    });
    expect(e.key).toBe('corporate');
  });

  it('ignores a trial end date when the status is not trialing', () => {
    const e = effectivePlan({
      plan: 'freemium', status: 'none', trialEndsAt: future(10), grandfatheredUntil: null,
    });
    expect(e.key).toBe('freemium');
  });
});
