/**
 * The one HTML shell every Finquanta email is rendered into.
 *
 * There was no template system before this — the verification and password-reset
 * emails each carried their own hand-written copy of the same markup, already
 * drifting apart (one had a "you can safely ignore this" line, one did not; the
 * font sizes disagreed). Adding four lifecycle reminders on top would have made
 * six copies of a layout nobody could change in one place.
 *
 * Deliberately plain HTML with inline styles and a table for the button. Email
 * clients are not browsers: Outlook ignores most of flexbox, `<style>` blocks
 * are stripped by several webmail clients, and anything clever degrades into an
 * unstyled wall of text in exactly the clients least likely to forgive it.
 */

/** Escape text destined for HTML. Names and business names come from users. */
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Where links in emails should point.
 *
 * Both existing emails derived this the same way and separately. `APP_URL` is
 * the frontend origin; the first `CORS_ORIGIN` entry is the fallback, because
 * on Render the two have been set inconsistently before and a reset link to the
 * API host is a dead link.
 */
export function appUrl(): string {
  return (process.env.APP_URL || (process.env.CORS_ORIGIN || '').split(',')[0] || '')
    .trim()
    .replace(/\/$/, '');
}

export interface EmailSection {
  /** Omitted for a single-purpose email, where the title already says it. */
  heading?: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
}

export interface RenderEmailOptions {
  title: string;
  sections: EmailSection[];
  /** Small grey line under everything — "if you didn't request this...". */
  footerNote?: string;
  /**
   * Printed in full under the button. For links carrying a single-use token,
   * where a client that mangles the anchor leaves someone with no way through.
   */
  rawLink?: string;
  /**
   * One-click unsubscribe. Required by CAN-SPAM and Gmail's bulk-sender rules
   * on anything promotional, and omitted on transactional mail (a password
   * reset has nothing to unsubscribe from).
   *
   * A named option rather than something each caller remembers to append: the
   * lifecycle emails are exactly the ones that must never ship without it.
   */
  unsubscribeUrl?: string;
}

const GREEN = '#22c55e';
const INK = '#0f172a';
const BODY = '#475569';
const MUTED = '#94a3b8';

/** A button that survives Outlook, which ignores padding on an anchor. */
const button = (label: string, url: string): string => `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0">
        <tr><td style="background:${GREEN};border-radius:8px">
          <a href="${encodeURI(url)}" style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px">${esc(label)}</a>
        </td></tr>
      </table>`;

export function renderEmail(options: RenderEmailOptions): string {
  const body = options.sections
    .map((s) => {
      const heading = s.heading
        ? `<h3 style="color:${INK};font-size:15px;margin:24px 0 8px">${esc(s.heading)}</h3>`
        : '';
      const paragraphs = s.paragraphs
        .map((p) => `<p style="color:${BODY};font-size:14px;line-height:1.55;margin:0 0 12px">${esc(p)}</p>`)
        .join('');
      return heading + paragraphs + (s.cta ? button(s.cta.label, s.cta.url) : '');
    })
    .join('');

  const raw = options.rawLink
    ? `<p style="color:${MUTED};font-size:12px;word-break:break-all;margin:16px 0 0">Or paste this link into your browser:<br>${esc(options.rawLink)}</p>`
    : '';

  const note = options.footerNote
    ? `<p style="color:${MUTED};font-size:13px;margin:16px 0 0">${esc(options.footerNote)}</p>`
    : '';

  const unsubscribe = options.unsubscribeUrl
    ? `<p style="color:${MUTED};font-size:12px;margin:0">
           <a href="${encodeURI(options.unsubscribeUrl)}" style="color:${MUTED}">Unsubscribe from these reminders</a>
         </p>`
    : '';

  return `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:8px">
      <h2 style="color:${INK};font-size:19px;margin:0 0 12px">${esc(options.title)}</h2>
      ${body}
      ${raw}
      ${note}
      <div style="border-top:1px solid #e2e8f0;margin:28px 0 0;padding:14px 0 0">
        <p style="color:${MUTED};font-size:12px;margin:0 0 4px">Finquanta</p>
        ${unsubscribe}
      </div>
    </div>`;
}
