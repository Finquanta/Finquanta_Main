import fs from 'fs';
import path from 'path';
import { planFromInvoiceForTest } from '../../../src/modules/billing/webhook.routes';

/**
 * Does a paid Starter invoice actually resolve to the Starter plan?
 *
 * This is the exact step that fails SILENTLY when a STRIPE_PRICE_* value is
 * missing or mistyped: `invoice.paid` arrives, no plan matches the price that
 * was charged, and the handler returns having granted nothing. The customer's
 * card is debited and their plan never changes. Before the logging added
 * alongside this test there was no trace of it anywhere.
 *
 * It reads the REAL ids out of server/.env rather than inventing fixtures,
 * because the failure being guarded against is a configuration mismatch — a
 * test with made-up ids would pass happily while production stayed broken.
 *
 * Skips rather than fails when .env has no Stripe ids, so CI and a fresh clone
 * are not blocked by credentials they were never given.
 */

function envFromFile(): Record<string, string> {
  const file = path.join(__dirname, '..', '..', '..', '.env');
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1]) out[m[1]] = (m[2] ?? '').trim();
  }
  return out;
}

const fileEnv = envFromFile();
const priceOf = (k: string) => process.env[k] || fileEnv[k] || '';

/** One line of a Stripe invoice, in the shape the handler reads. */
const line = (priceId: string, amount: number) => ({ price: { id: priceId }, amount });

const STARTER_MONTHLY = priceOf('STRIPE_PRICE_STARTER_MONTHLY');
const STARTER_YEARLY = priceOf('STRIPE_PRICE_STARTER_YEARLY');
const BUSINESS_MONTHLY = priceOf('STRIPE_PRICE_BUSINESS_MONTHLY');

const configured = !!STARTER_MONTHLY && !!STARTER_YEARLY;
const describeIf = configured ? describe : describe.skip;

if (!configured) {
  // Visible in the run, so a skip is never mistaken for a pass.
  console.warn(
    '[starter-grant-path] SKIPPED: STRIPE_PRICE_STARTER_* not found in env or server/.env'
  );
}

describeIf('a paid Starter invoice grants Starter', () => {
  beforeAll(() => {
    // planForPriceId reads process.env directly.
    process.env.STRIPE_PRICE_STARTER_MONTHLY = STARTER_MONTHLY;
    process.env.STRIPE_PRICE_STARTER_YEARLY = STARTER_YEARLY;
    if (BUSINESS_MONTHLY) process.env.STRIPE_PRICE_BUSINESS_MONTHLY = BUSINESS_MONTHLY;
  });

  it('maps the configured monthly price to starter', () => {
    const invoice = { lines: { data: [line(STARTER_MONTHLY, 1999)] } };
    expect(planFromInvoiceForTest(invoice)).toBe('starter');
  });

  it('maps the configured yearly price to starter', () => {
    const invoice = { lines: { data: [line(STARTER_YEARLY, 19999)] } };
    expect(planFromInvoiceForTest(invoice)).toBe('starter');
  });

  it('returns null for a price we do not sell — the silent-failure case', () => {
    // Exactly what a mistyped or stale env var produces. Null here is what the
    // handler now logs loudly instead of swallowing.
    const invoice = { lines: { data: [line('price_not_ours_at_all', 1999)] } };
    expect(planFromInvoiceForTest(invoice)).toBeNull();
  });

  it('ignores the credit line when upgrading away from Starter', () => {
    if (!BUSINESS_MONTHLY) return;
    // A proration invoice: credit for unused Starter, charge for Business.
    // Stripe does not promise an order and the credit often comes first.
    const invoice = {
      lines: { data: [line(STARTER_MONTHLY, -1200), line(BUSINESS_MONTHLY, 9999)] },
    };
    expect(planFromInvoiceForTest(invoice)).toBe('business');
  });

  it('reads the newer pricing.price_details shape too', () => {
    // Stripe moved the price id on invoice lines; both shapes are in the wild.
    const invoice = {
      lines: { data: [{ pricing: { price_details: { price: STARTER_MONTHLY } }, amount: 1999 }] },
    };
    expect(planFromInvoiceForTest(invoice)).toBe('starter');
  });
});
