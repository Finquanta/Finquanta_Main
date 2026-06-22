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
    // Don't crash the flow in environments without email configured; just log.
    console.warn('[email] RESEND_API_KEY not set — skipping send to', to);
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
