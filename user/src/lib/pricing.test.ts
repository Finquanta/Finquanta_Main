import { describe, expect, it } from 'vitest';
import { PLANS } from '../../../server/src/modules/billing/plans';
import { PRICING, formatPrice, limitCell, type PlanDisplayKey } from '@/lib/pricing';

/**
 * The pricing the site shows must be the pricing the server charges.
 *
 * This imports the server's own plan catalogue rather than pinning numbers a
 * second time: pinned numbers would only prove the page matches itself. A tier
 * changed in plans.ts without this file (or the other way round) fails here.
 */

const KEYS: PlanDisplayKey[] = ['freemium', 'starter', 'entrepreneur', 'business', 'corporate'];

describe('marketing pricing mirrors the server plan catalogue', () => {
  it.each(KEYS)('%s: prices', (key) => {
    const server = PLANS[key];
    const page = PRICING[key];
    expect(page.monthly).toBe(server.monthly);
    expect(page.annual).toBe(server.annual);
    expect(page.contactSales).toBe(server.contactSales);
  });

  it.each(KEYS)('%s: allowances', (key) => {
    const { limits } = PLANS[key];
    const page = PRICING[key];
    expect(page.finnaMessagesPerMonth).toBe(limits.finnaMessagesPerMonth);
    expect(page.councilSessionsPerMonth).toBe(limits.councilSessionsPerMonth);
    expect(page.groups).toBe(limits.groups);
    expect(page.scansPerMonth).toBe(limits.scansPerMonth);
    expect(page.exportsPerMonth).toBe(limits.exportsPerMonth);
  });
});

describe('formatting', () => {
  it('writes prices as dollars with two decimals', () => {
    expect(formatPrice(19.99)).toBe('$19.99');
    expect(formatPrice(0)).toBe('$0.00');
  });

  it('writes limits the way the comparison table shows them', () => {
    expect(limitCell(2000)).toBe('2,000');
    expect(limitCell(0)).toBe('—');
    expect(limitCell(null)).toBe('pfUnlimited');
  });
});
