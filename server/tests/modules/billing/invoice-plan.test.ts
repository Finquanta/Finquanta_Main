import { planFromInvoiceForTest } from '../../../src/modules/billing/webhook.routes';

/**
 * Which plan a paid invoice bought.
 *
 * A plan change produces a PRORATION invoice with two lines — a credit for the
 * unused part of the old plan and a charge for the new one — and Stripe does
 * not promise which comes first. Reading `lines.data[0]` meant an upgrade to
 * Business booked the Entrepreneur credit line and set the plan BACKWARDS.
 *
 * The customer then could not fix it themselves: our row said Entrepreneur,
 * Stripe said Business, and clicking Business was refused with "that is already
 * your current plan".
 */

const line = (priceEnv: string, amount: number) => ({
  amount,
  price: { id: process.env[priceEnv] },
});

const OLD = { ...process.env };

describe('plan from a paid invoice', () => {
  beforeEach(() => {
    process.env.STRIPE_PRICE_ENTREPRENEUR_MONTHLY = 'price_ent_m';
    process.env.STRIPE_PRICE_ENTREPRENEUR_YEARLY = 'price_ent_y';
    process.env.STRIPE_PRICE_BUSINESS_MONTHLY = 'price_biz_m';
    process.env.STRIPE_PRICE_BUSINESS_YEARLY = 'price_biz_y';
  });

  afterAll(() => { process.env = OLD; });

  it('reads a plain renewal', () => {
    const invoice = { lines: { data: [line('STRIPE_PRICE_BUSINESS_MONTHLY', 9999)] } };
    expect(planFromInvoiceForTest(invoice)).toBe('business');
  });

  it('takes the CHARGED plan on an upgrade, not the credited one', () => {
    // The exact shape that caused the bug: the credit for the old plan is
    // listed first, and it is negative.
    const invoice = {
      lines: {
        data: [
          line('STRIPE_PRICE_ENTREPRENEUR_MONTHLY', -2500), // unused Entrepreneur
          line('STRIPE_PRICE_BUSINESS_MONTHLY', 5000),      // remaining Business
        ],
      },
    };
    expect(planFromInvoiceForTest(invoice)).toBe('business');
  });

  it('takes the charged plan on a downgrade too', () => {
    const invoice = {
      lines: {
        data: [
          line('STRIPE_PRICE_BUSINESS_MONTHLY', -5000),    // unused Business
          line('STRIPE_PRICE_ENTREPRENEUR_MONTHLY', 1200), // remaining Entrepreneur
        ],
      },
    };
    expect(planFromInvoiceForTest(invoice)).toBe('entrepreneur');
  });

  it('is unaffected by the order of the lines', () => {
    const invoice = {
      lines: {
        data: [
          line('STRIPE_PRICE_BUSINESS_MONTHLY', 5000),
          line('STRIPE_PRICE_ENTREPRENEUR_MONTHLY', -2500),
        ],
      },
    };
    expect(planFromInvoiceForTest(invoice)).toBe('business');
  });

  it('reads the newer pricing shape as well as the old one', () => {
    // Newer Stripe API versions moved the price into pricing.price_details.
    const invoice = {
      lines: { data: [{ amount: 9999, pricing: { price_details: { price: 'price_biz_m' } } }] },
    };
    expect(planFromInvoiceForTest(invoice)).toBe('business');
  });

  it('falls back to a recognised line when nothing was charged', () => {
    // A change fully covered by credit still tells us which plan they are on.
    const invoice = { lines: { data: [line('STRIPE_PRICE_ENTREPRENEUR_MONTHLY', 0)] } };
    expect(planFromInvoiceForTest(invoice)).toBe('entrepreneur');
  });

  it('ignores a price we do not sell', () => {
    const invoice = { lines: { data: [{ amount: 500, price: { id: 'price_someone_elses' } }] } };
    expect(planFromInvoiceForTest(invoice)).toBeNull();
  });
});
