/**
 * The workspace invite email.
 *
 * Plain HTML, inline styles, no images and no external assets — the same shape
 * as the password-reset and verification mails this app already sends, and for
 * the same reason: mail clients strip stylesheets, block remote images by
 * default, and anything clever here degrades into an unreadable message in
 * whichever client the recipient happens to use.
 *
 * The recipient may never have heard of Finquanta, so the message leads with
 * WHO invited them and to WHAT, not with the product. An invite that reads like
 * marketing gets deleted.
 */

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));

export function inviteEmailHtml(input: {
  inviter: string;
  businessName: string;
  role: string;
  link: string;
  requiresPassword: boolean;
  expiresAt: string | null;
  singleUse: boolean;
}): string {
  const inviter = escapeHtml(input.inviter);
  const business = escapeHtml(input.businessName);
  const role = escapeHtml(input.role);

  // The link is built by us from a UUID token, never from user input — but it
  // is still escaped, because one day something will pass through here that was.
  const link = escapeHtml(input.link);

  const validity = input.singleUse
    ? 'This link can be used once.'
    : input.expiresAt
      ? `This link expires on ${new Date(input.expiresAt).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric',
        })}.`
      : '';

  const passwordNote = input.requiresPassword
    ? '<p style="margin:0 0 16px;font-size:14px;color:#6b7280;">'
      + 'This invite is password protected. Ask ' + inviter + ' for the password — '
      + 'it is deliberately not in this email, so the link alone is not enough.'
      + '</p>'
    : '';

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a;">
  <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;">
    ${inviter} invited you to ${business}
  </h1>
  <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.5;">
    You have been added as a <strong>${role}</strong> on Finquanta, where ${business} keeps its
    books, invoices and financial reporting.
  </p>

  <a href="${link}"
     style="display:inline-block;background:#22c55e;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">
    Accept the invitation
  </a>

  <p style="margin:20px 0 8px;font-size:13px;color:#6b7280;">
    Or paste this into your browser:
  </p>
  <p style="margin:0 0 20px;font-size:13px;color:#2563eb;word-break:break-all;">${link}</p>

  ${passwordNote}

  <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">${validity}</p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
  <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
    If you were not expecting this, you can ignore it — nothing happens until you accept, and
    whoever invited you cannot see anything of yours in the meantime.
  </p>
</div>`.trim();
}
