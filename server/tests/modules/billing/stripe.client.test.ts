import {
  changeSubscriptionPrice, createCheckoutSession, syncSubscriptionQuantity,
} from '../../../src/modules/billing/stripe.client';

/**
 * The three ways this integration can quietly take the wrong amount of money.
 *
 * None of them fail loudly: a duplicate customer, a second subscription and a
 * stale seat count all look fine from inside the app and only show up on the
 * customer's statement. So the assertions here are about the exact fields sent
 * to Stripe, which is the only place the difference exists.
 */

const OLD_KEY = process.env.STRIPE_SECRET_KEY;

/** Decode the form-encoded body back into something assertable. */
const bodyOf = (call: any): Record<string, string> =>
  Object.fromEntries(new URLSearchParams(call[1].body as string).entries());

const okResponse = (json: unknown) => ({
  ok: true,
  status: 200,
  json: async () => json,
});

describe('stripe.client', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  afterAll(() => {
    if (OLD_KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = OLD_KEY;
  });

  describe('createCheckoutSession', () => {
    it('reuses an existing customer instead of minting a second one', async () => {
      fetchMock.mockResolvedValue(okResponse({ id: 'cs_1', url: 'https://stripe.test/pay' }));

      await createCheckoutSession({
        priceId: 'price_1', quantity: 3, businessId: 'biz',
        customerId: 'cus_existing', customerEmail: 'owner@example.com',
        successUrl: 'https://app/ok', cancelUrl: 'https://app/no',
      });

      const body = bodyOf(fetchMock.mock.calls[0]);
      expect(body.customer).toBe('cus_existing');
      // Sending both is rejected by Stripe outright, and sending only the email
      // creates a DUPLICATE customer holding the same person's card history.
      expect(body.customer_email).toBeUndefined();
    });

    it('identifies a first-time buyer by email', async () => {
      fetchMock.mockResolvedValue(okResponse({ id: 'cs_1', url: 'https://stripe.test/pay' }));

      await createCheckoutSession({
        priceId: 'price_1', quantity: 1, businessId: 'biz',
        customerId: null, customerEmail: 'new@example.com',
        successUrl: 'https://app/ok', cancelUrl: 'https://app/no',
      });

      const body = bodyOf(fetchMock.mock.calls[0]);
      expect(body.customer_email).toBe('new@example.com');
      expect(body.customer).toBeUndefined();
    });

    it('sends the seat count as the quantity', async () => {
      fetchMock.mockResolvedValue(okResponse({ id: 'cs_1', url: 'https://stripe.test/pay' }));

      await createCheckoutSession({
        priceId: 'price_1', quantity: 4, businessId: 'biz',
        successUrl: 'https://app/ok', cancelUrl: 'https://app/no',
      });

      expect(bodyOf(fetchMock.mock.calls[0])['line_items[0][quantity]']).toBe('4');
    });
  });

  describe('changeSubscriptionPrice', () => {
    const liveSubscription = {
      id: 'sub_1',
      status: 'active',
      items: { data: [{ id: 'si_1', price: { id: 'price_old' }, quantity: 2 }] },
    };

    it('moves the existing subscription rather than creating another', async () => {
      fetchMock
        .mockResolvedValueOnce(okResponse(liveSubscription))
        .mockResolvedValueOnce(okResponse({ id: 'sub_1', status: 'active' }));

      await changeSubscriptionPrice({
        subscriptionId: 'sub_1', priceId: 'price_new', quantity: 2, invoiceNow: true,
      });

      // Second call is the update — on /subscriptions/sub_1, NOT /checkout/sessions.
      const [url, init] = fetchMock.mock.calls[1];
      expect(url).toContain('/subscriptions/sub_1');
      expect(init.method).toBe('POST');

      const body = bodyOf(fetchMock.mock.calls[1]);
      // Addressed by item id: without it Stripe ADDS a line rather than
      // replacing one, and the customer is billed for both plans at once.
      expect(body['items[0][id]']).toBe('si_1');
      expect(body['items[0][price]']).toBe('price_new');
    });

    it('bills an upgrade immediately', async () => {
      fetchMock
        .mockResolvedValueOnce(okResponse(liveSubscription))
        .mockResolvedValueOnce(okResponse({ id: 'sub_1' }));

      await changeSubscriptionPrice({
        subscriptionId: 'sub_1', priceId: 'price_new', quantity: 1, invoiceNow: true,
      });

      // always_invoice is what makes `invoice.paid` fire, and invoice.paid is
      // the only thing that grants the new plan.
      expect(bodyOf(fetchMock.mock.calls[1]).proration_behavior).toBe('always_invoice');
    });

    it('moves no money at all on a downgrade', async () => {
      fetchMock
        .mockResolvedValueOnce(okResponse(liveSubscription))
        .mockResolvedValueOnce(okResponse({ id: 'sub_1' }));

      await changeSubscriptionPrice({
        subscriptionId: 'sub_1', priceId: 'price_cheaper', quantity: 1, invoiceNow: false,
      });

      /**
       * Not `create_prorations`, which would credit back the unused part of a
       * period the customer is still using. They keep what they paid for until
       * it ends, and the cheaper price simply applies from the next invoice —
       * the plan change itself is scheduled on our side to match.
       */
      expect(bodyOf(fetchMock.mock.calls[1]).proration_behavior).toBe('none');
    });

    it('cancels a pending cancellation — changing plan means staying', async () => {
      fetchMock
        .mockResolvedValueOnce(okResponse(liveSubscription))
        .mockResolvedValueOnce(okResponse({ id: 'sub_1' }));

      await changeSubscriptionPrice({
        subscriptionId: 'sub_1', priceId: 'price_new', quantity: 1, invoiceNow: true,
      });

      expect(bodyOf(fetchMock.mock.calls[1]).cancel_at_period_end).toBe('false');
    });
  });

  describe('syncSubscriptionQuantity', () => {
    const withQuantity = (quantity: number, status = 'active') => ({
      id: 'sub_1',
      status,
      items: { data: [{ id: 'si_1', price: { id: 'price_1' }, quantity }] },
    });

    it('updates the quantity when the team has grown', async () => {
      fetchMock
        .mockResolvedValueOnce(okResponse(withQuantity(1)))
        .mockResolvedValueOnce(okResponse({ id: 'sub_1' }));

      const result = await syncSubscriptionQuantity({ subscriptionId: 'sub_1', quantity: 5 });

      expect(result).toEqual({ changed: true, from: 1, to: 5 });
      const body = bodyOf(fetchMock.mock.calls[1]);
      expect(body['items[0][quantity]']).toBe('5');
      // Held for the next invoice: charging a few dollars every time somebody
      // accepts an invite would be mostly bank fees.
      expect(body.proration_behavior).toBe('create_prorations');
    });

    it('does not call Stripe when the count already matches', async () => {
      fetchMock.mockResolvedValueOnce(okResponse(withQuantity(3)));

      const result = await syncSubscriptionQuantity({ subscriptionId: 'sub_1', quantity: 3 });

      expect(result.changed).toBe(false);
      // One read, no write. This runs on every membership change, so a needless
      // write would mean a proration event each time anyone was touched.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('leaves a cancelled subscription alone', async () => {
      fetchMock.mockResolvedValueOnce(okResponse(withQuantity(1, 'canceled')));

      const result = await syncSubscriptionQuantity({ subscriptionId: 'sub_1', quantity: 4 });

      expect(result.changed).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('never sends a quantity of zero', async () => {
      fetchMock
        .mockResolvedValueOnce(okResponse(withQuantity(2)))
        .mockResolvedValueOnce(okResponse({ id: 'sub_1' }));

      // A workspace of nothing but viewers still has its owner, and Stripe
      // rejects a quantity of 0 outright.
      await syncSubscriptionQuantity({ subscriptionId: 'sub_1', quantity: 0 });

      expect(bodyOf(fetchMock.mock.calls[1])['items[0][quantity]']).toBe('1');
    });
  });
});
