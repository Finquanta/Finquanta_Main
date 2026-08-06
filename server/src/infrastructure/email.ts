/**
 * Minimal email sender backed by Resend's REST API. Uses global fetch (Node 18+)
 * so we don't pull in an SDK. Configure with:
 *   RESEND_API_KEY    — your Resend API key (required to actually send)
 *   RESET_EMAIL_FROM  — verified sender, e.g. "Finquanta <no-reply@yourdomain.com>"
 *                       (defaults to Resend's shared test sender)
 */
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESET_EMAIL_FROM || 'Finquanta <onboarding@resend.dev>';

  if (!apiKey) {
    // No key means email isn't configured — local dev, tests, a fresh clone.
    // Don't crash the flow, but don't silently swallow it either: every one of
    // these messages exists to carry a link (reset password, verify email), and
    // the endpoints deliberately return success whether or not an account
    // exists, so a dropped send is invisible from the UI. Someone waiting on a
    // password reset here would wait forever with no way to tell why.
    //
    // The link is printed for local dev only, and gated on NODE_ENV rather than
    // on "no key means not production". That reasoning is an assumption about
    // deployment config, not an invariant: a blanked, rotated or mistyped
    // RESEND_API_KEY on the real host would take this branch and write live,
    // single-use reset tokens into the log stream and every aggregator behind
    // it — turning a delivery outage into account takeover. The warning itself
    // stays unconditional so the outage is still loud in production.
    const link =
      process.env.NODE_ENV !== 'production'
        ? html.match(/https?:\/\/[^"'\s>]+/)?.[0]
        : undefined;
    console.warn(
      `[email] RESEND_API_KEY not set — nothing sent to ${to}\n` +
      `        subject: ${subject}\n` +
      (link ? `        link:    ${link}\n` : '') +
      `        (set RESEND_API_KEY to deliver these for real)`
    );
    return;
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend send failed: ${res.status} ${detail}`);
  }
}
