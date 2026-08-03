import crypto from 'crypto';

/**
 * Have I Been Pwned Pwned Passwords range API — k-anonymity, no key needed.
 * We send only the first 5 hex chars of the SHA-1 hash; HIBP returns every
 * suffix it has seen for that prefix (with counts), so the full password
 * never leaves this process. Free, no signup, no rate limit that matters here.
 */
const RANGE_ENDPOINT = 'https://api.pwnedpasswords.com/range/';

/**
 * True if this password appears in the known-breach corpus. Fails OPEN on a
 * network hiccup — HIBP being unreachable must never block someone from
 * signing up or resetting their password.
 */
export async function isPasswordPwned(password: string): Promise<boolean> {
  try {
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const res = await fetch(`${RANGE_ENDPOINT}${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!res.ok) return false;

    const body = await res.text();
    return body.split('\n').some((line) => line.split(':')[0]?.trim() === suffix);
  } catch (error) {
    console.error('[pwned-passwords] check failed, allowing:', error instanceof Error ? error.message : error);
    return false;
  }
}
