import { PLANS, PLAN_KEYS, SELF_SERVE_PLANS } from '../../../src/modules/billing/plans';
import { effectivePlan } from '../../../src/modules/billing/effective-plan';

/**
 * Starter is a NEW TIER, and a tier is only real if every place that reasons
 * about plans agrees it exists. These are the joins where a missing entry would
 * not fail to compile — it would just quietly misbehave in production.
 */
describe('starter tier wiring', () => {
  it('sits between freemium and entrepreneur, because the order IS the ranking', () => {
    // PLAN_KEYS order decides upgrade vs downgrade. Wrong position => an
    // upgrade bills as a downgrade.
    expect(PLAN_KEYS.indexOf('starter')).toBe(1);
    expect(PLAN_KEYS.indexOf('freemium')).toBeLessThan(PLAN_KEYS.indexOf('starter'));
    expect(PLAN_KEYS.indexOf('starter')).toBeLessThan(PLAN_KEYS.indexOf('entrepreneur'));
  });

  it('is in the catalogue and is self-serve', () => {
    expect(PLANS.starter).toBeDefined();
    expect(PLANS.starter.monthly).toBe(19.99);
    expect(PLANS.starter.annual).toBe(199.99);
    expect(PLANS.starter.contactSales).toBe(false);
    expect(SELF_SERVE_PLANS).toContain('starter');
  });

  it('every plan key has a catalogue entry', () => {
    // Guards the lookup that used to throw on an unknown key.
    for (const k of PLAN_KEYS) expect(PLANS[k]).toBeDefined();
  });

  it('resolves as its own plan when billed, not as something else', () => {
    const e = effectivePlan(
      { plan: 'starter', status: 'active', trialEndsAt: null, grandfatheredUntil: null },
      'business'
    );
    expect(e.key).toBe('starter');
    expect(e.name).toBe('Starter');
    expect(e.onFreeWindow).toBe(false);
  });

  it('a trial still outranks Starter, so a trialling Starter keeps Business features', () => {
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const e = effectivePlan(
      { plan: 'starter', status: 'trialing', trialEndsAt: future, grandfatheredUntil: null },
      'business'
    );
    expect(e.key).toBe('business');
    expect(e.reason).toBe('trial');
  });
});
