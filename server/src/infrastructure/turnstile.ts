/**
 * Cloudflare Turnstile verification. Configure with:
 *   TURNSTILE_SECRET_KEY — your Turnstile secret key (Render env)
 *
 * Falls back to Cloudflare's published "always passes" test secret when unset,
 * so localhost works without needing real keys — never falls back in production.
 */
const SITEVERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const DEV_TEST_SECRET = '1x0000000000000000000000000000000AA';

/** Verify a Turnstile response token. Never throws — a network hiccup fails closed. */
export async function verifyTurnstile(token: string | undefined | null, remoteIp?: string): Promise<boolean> {
  if (!token) return false;

  const secret = process.env.TURNSTILE_SECRET_KEY
    || (process.env.NODE_ENV !== 'production' ? DEV_TEST_SECRET : undefined);
  if (!secret) {
    console.error('[turnstile] TURNSTILE_SECRET_KEY not set in production — refusing to verify');
    return false;
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetch(SITEVERIFY_ENDPOINT, { method: 'POST', body });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    console.error('[turnstile] verification request failed:', error instanceof Error ? error.message : error);
    return false;
  }
}
