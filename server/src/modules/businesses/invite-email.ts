/**
 * The workspace invite email.
 *
 * Rendered through the shared shell like every other Finquanta email. It used
 * to build its own complete HTML, and had already drifted from the rest: its
 * own escaping helper, a different grey palette, and a bare `<a>` for its
 * button with no table around it — which Outlook renders without padding, so
 * the one call to action in the email was already broken there.
 *
 * The recipient may never have heard of Finquanta, so the message leads with
 * WHO invited them and to WHAT, not with the product. An invite that reads like
 * marketing gets deleted.
 */
import { esc, renderEmail } from '../../infrastructure/email-template';

export function inviteEmailHtml(input: {
  inviter: string;
  businessName: string;
  role: string;
  link: string;
  requiresPassword: boolean;
  expiresAt: string | null;
  singleUse: boolean;
}): string {
  const paragraphs: string[] = [];

  if (input.requiresPassword) {
    paragraphs.push(
      `This invite is password protected. Ask ${input.inviter} for the password — `
      + 'it is deliberately not in this email, so the link alone is not enough.'
    );
  }

  const validity = input.singleUse
    ? 'This link can be used once.'
    : input.expiresAt
      ? `This link expires on ${new Date(input.expiresAt).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric',
        })}.`
      : undefined;

  return renderEmail({
    title: `${input.inviter} invited you to ${input.businessName}`,
    sections: [{
      paragraphs,
      // The role is bolded, which `paragraphs` cannot express. Every
      // user-supplied value inside this markup goes through esc() first.
      html:
        `<p style="margin:0 0 4px">You have been added as a <strong style="color:#F2F4F3">${esc(input.role)}</strong> `
        + `on Finquanta, where ${esc(input.businessName)} keeps its books, invoices and financial reporting.</p>`,
      cta: { label: 'Accept the invitation', url: input.link },
    }],
    expiresIn: validity,
    rawLink: input.link,
    footerNote:
      'If you were not expecting this, you can ignore it — nothing happens until you accept, '
      + 'and whoever invited you cannot see anything of yours in the meantime.',
  });
}
