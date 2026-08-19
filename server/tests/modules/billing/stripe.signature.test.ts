import { createHmac } from 'crypto';
import { verifyWebhookSignature } from '../../../src/modules/billing/stripe.client';

/**
 * The webhook endpoint is public and grants plans. If this check is wrong,
 * anyone who finds the URL can POST `invoice.paid` and give themselves
 * Corporate — so every rejection path is tested, not just the happy one.
 */

const SECRET = 'whsec_testsecret_do_not_use';

/** Builds the header exactly as Stripe does, so a pass here means a real pass. */
function sign(body: string, secret = SECRET, ts = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac('sha256', secret).update(ts + '.' + body, 'utf8').digest('hex');
  return { header: 't=' + ts + ',v1=' + v1, ts };
}

const BODY = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });

describe('verifyWebhookSignature', () => {
  it('accepts a genuine Stripe signature', () => {
    const { header } = sign(BODY);
    expect(verifyWebhookSignature(BODY, header, SECRET)).toEqual({ ok: true });
  });

  it('rejects a signature made with a different secret', () => {
    const { header } = sign(BODY, 'whsec_someone_elses_secret');
    const r = verifyWebhookSignature(BODY, header, SECRET);
    expect(r).toEqual({ ok: false, reason: 'signature_mismatch' });
  });

  it('rejects a tampered body', () => {
    const { header } = sign(BODY);
    // The attack this stops: a real captured webhook, edited to say something
    // more useful, replayed with its original signature.
    const tampered = JSON.stringify({ id: 'evt_1', type: 'invoice.paid', hacked: true });
    expect(verifyWebhookSignature(tampered, header, SECRET).ok).toBe(false);
  });

  it('rejects an old signature even when otherwise valid', () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    const { header } = sign(BODY, SECRET, old);
    const r = verifyWebhookSignature(BODY, header, SECRET);
    expect(r).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' });
  });

  it('rejects a future timestamp too', () => {
    const ahead = Math.floor(Date.now() / 1000) + 3600;
    const { header } = sign(BODY, SECRET, ahead);
    expect(verifyWebhookSignature(BODY, header, SECRET).ok).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(verifyWebhookSignature(BODY, undefined, SECRET))
      .toEqual({ ok: false, reason: 'missing_signature' });
  });

  it('rejects a malformed header', () => {
    expect(verifyWebhookSignature(BODY, 'garbage', SECRET).ok).toBe(false);
    expect(verifyWebhookSignature(BODY, 't=123', SECRET).ok).toBe(false);
    expect(verifyWebhookSignature(BODY, 'v1=abc', SECRET).ok).toBe(false);
  });

  it('refuses everything when no secret is configured', () => {
    // Fail CLOSED. An unconfigured endpoint must reject, never wave things
    // through, or forgetting the env var becomes a public plan dispenser.
    const { header } = sign(BODY);
    expect(verifyWebhookSignature(BODY, header, ''))
      .toEqual({ ok: false, reason: 'no_secret_configured' });
  });

  it('accepts when one of several rotated signatures matches', () => {
    const ts = Math.floor(Date.now() / 1000);
    const good = createHmac('sha256', SECRET).update(ts + '.' + BODY, 'utf8').digest('hex');
    // Stripe sends both during a secret rotation.
    const header = 't=' + ts + ',v1=' + 'f'.repeat(64) + ',v1=' + good;
    expect(verifyWebhookSignature(BODY, header, SECRET)).toEqual({ ok: true });
  });

  it('does not throw on a signature of the wrong length', () => {
    // timingSafeEqual throws on differing lengths — the length guard exists so
    // a short signature is a rejection rather than a 500.
    const ts = Math.floor(Date.now() / 1000);
    expect(() => verifyWebhookSignature(BODY, 't=' + ts + ',v1=abc', SECRET)).not.toThrow();
    expect(verifyWebhookSignature(BODY, 't=' + ts + ',v1=abc', SECRET).ok).toBe(false);
  });
});
