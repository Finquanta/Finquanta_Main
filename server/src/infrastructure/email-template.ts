/**
 * The one HTML shell every Finquanta email is rendered into.
 *
 * There was no template system before this — the verification and password-reset
 * emails each carried their own hand-written copy of the same markup, already
 * drifting apart (one had a "you can safely ignore this" line, one did not; the
 * font sizes disagreed). Adding four lifecycle reminders on top would have made
 * six copies of a layout nobody could change in one place.
 *
 * Deliberately plain HTML with inline styles and tables throughout. Email
 * clients are not browsers: Outlook ignores most of flexbox, `<style>` blocks
 * are stripped by several webmail clients, and anything clever degrades into an
 * unstyled wall of text in exactly the clients least likely to forgive it.
 *
 * DARK, per the transactional email draft and its mockup. Three things make a
 * dark email survive real clients, and each is load-bearing:
 *
 *   1. A full-width outer table carrying `bgcolor`. Without it Gmail and Outlook
 *      float the dark card on their own white canvas.
 *   2. Every cell sets BOTH its background and its text colour explicitly.
 *      Several clients force-invert dark mail; inherited colours are exactly
 *      what they flip.
 *   3. Images are decoration, never meaning. Most clients block remote images
 *      by default, so the heading carries the message and every image has alt
 *      text styled to read on the dark card.
 */

/** Escape text destined for HTML. Names and business names come from users. */
export const esc = (s: string): string =>
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

/**
 * Where the email images are served from.
 *
 * Separate from `appUrl()` because the two diverge in exactly one situation
 * that matters: local development. Links there should point at localhost, but
 * images must NOT — Gmail fetches remote images through Google's own proxy,
 * which cannot reach a developer's machine, so every image in a locally-sent
 * email arrives broken. Setting `EMAIL_ASSET_URL` to a publicly reachable
 * origin fixes the images without also sending the links somewhere else.
 */
export function emailAssetUrl(): string {
  return (process.env.EMAIL_ASSET_URL || appUrl()).trim().replace(/\/$/, '');
}

export interface EmailSection {
  /** Omitted for a single-purpose email, where the title already says it. */
  heading?: string;
  paragraphs: string[];
  /**
   * Trusted markup, rendered UNESCAPED after the paragraphs.
   *
   * For the few emails that need inline structure `paragraphs` cannot express —
   * the invite's bolded role, a row of code digits. The caller owns escaping
   * anything user-supplied inside it with `esc()`. Never pass user input here
   * directly; that is what `paragraphs` is for.
   */
  html?: string;
  cta?: { label: string; url: string };
}

export interface RenderEmailOptions {
  title: string;
  sections: EmailSection[];
  /**
   * The short muted line under the content — "Expires in 24 hours". Passed in,
   * never hardcoded: verification links last 24 hours and reset links 1 hour,
   * and the mockup's own "15 minutes" matched neither.
   */
  expiresIn?: string;
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

/** Design tokens, from the transactional email draft §2. */
const FQ_DARK = '#05040A';   // card and page ground
const FQ_GREEN = '#3AD542';  // brand green, sampled from the real logo
const FQ_TEXT = '#F2F4F3';   // headings, primary text
const FQ_BODY = '#B9BEBA';   // paragraph text: derived — fq-muted is too dim for long copy
const FQ_MUTED = '#8A9089';  // secondary text, footer
const FQ_LINE = '#1E212B';   // hairline divider

/** Inter where it is installed, the platform face everywhere else. No @import: webmail strips it. */
const FONT = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

const SITE = 'https://finquanta.ai';

/** Footer link row, in the order the draft confirmed. */
const SOCIAL = [
  { label: 'finquanta.ai', url: SITE },
  { label: 'Instagram', url: 'https://www.instagram.com/finquanta' },
  { label: 'X', url: 'https://x.com/finquanta' },
  { label: 'LinkedIn', url: 'https://www.linkedin.com/company/finquanta/' },
];

/**
 * A URL made safe for an `href` attribute WITHOUT re-encoding it.
 *
 * This used to be `encodeURI(url)`, which double-encoded every lifecycle CTA:
 * those URLs already carry a percent-encoded `next` (`%2Fprofile-settings`),
 * and `encodeURI` escapes the `%` itself, producing `%252F`. The click
 * tracker then decoded once, saw `%2Fprofile-settings`, failed its "must start
 * with /" check and sent every reminder to /dashboard regardless of what the
 * button said.
 *
 * Callers already build URLs with `encodeURIComponent` on their parameters.
 * All this adds is escaping for the handful of characters that are never
 * legal raw in a URL — whitespace and non-ASCII — while leaving existing
 * `%XX` sequences alone, then HTML-escaping for the attribute.
 */
const href = (url: string): string =>
  esc(url.replace(/[\s"<>\\^`{|}]|[^\x00-\x7F]/gu, (c) => encodeURIComponent(c)));

/**
 * A button that survives Outlook, which ignores padding on an anchor.
 *
 * Wrapped in its own full-width row. The inner table used to carry
 * `align="left"`, and on a table that attribute does not align, it FLOATS:
 * in a digest, the next reminder's heading and paragraph wrapped up into the
 * space beside the button. A full-width wrapper row leaves nothing beside the
 * button for later content to flow into. `align="center"` does not float, so
 * the centred emails were never affected.
 */
const button = (label: string, url: string, align: 'center' | 'left'): string => `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px">
            <tr><td align="${align}">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"${align === 'center' ? ' align="center" style="margin:0 auto"' : ''}>
                <tr><td bgcolor="${FQ_GREEN}" style="background-color:${FQ_GREEN};border-radius:10px">
                  <a href="${href(url)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:700;line-height:1;color:${FQ_DARK};text-decoration:none;border-radius:10px">${esc(label)}</a>
                </td></tr>
              </table>
            </td></tr>
          </table>`;

/** A table cell on the card, with both colours set so inverting clients have nothing to flip. */
const cell = (content: string, padding: string, align: 'center' | 'left' = 'left'): string => `
      <tr><td align="${align}" bgcolor="${FQ_DARK}" style="padding:${padding};background-color:${FQ_DARK};color:${FQ_TEXT};font-family:${FONT}">${content}</td></tr>`;

export function renderEmail(options: RenderEmailOptions): string {
  const assets = emailAssetUrl();
  // A single-purpose email is centred, like the mockup. A digest of several
  // reminders is left-aligned: centred paragraphs are fine for one line and
  // hard to read for four.
  const align: 'center' | 'left' = options.sections.length <= 1 ? 'center' : 'left';

  const body = options.sections
    .map((s) => {
      const heading = s.heading
        ? `<h3 style="margin:28px 0 8px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1.35;color:${FQ_TEXT}">${esc(s.heading)}</h3>`
        : '';
      const paragraphs = s.paragraphs
        .map((p) => `<p style="margin:0 0 12px;font-family:${FONT};font-size:15px;line-height:1.6;color:${FQ_BODY}">${esc(p)}</p>`)
        .join('');
      const markup = s.html
        ? `<div style="font-family:${FONT};font-size:15px;line-height:1.6;color:${FQ_BODY}">${s.html}</div>`
        : '';
      return heading + paragraphs + markup + (s.cta ? button(s.cta.label, s.cta.url, align) : '');
    })
    .join('');

  const expiry = options.expiresIn
    ? `<p style="margin:14px 0 0;font-family:${FONT};font-size:13px;color:${FQ_MUTED}">${esc(options.expiresIn)}</p>`
    : '';

  const raw = options.rawLink
    ? `<p style="margin:20px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${FQ_MUTED};word-break:break-all">Or paste this link into your browser:<br><span style="color:${FQ_BODY}">${esc(options.rawLink)}</span></p>`
    : '';

  const note = options.footerNote
    ? `<p style="margin:16px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${FQ_MUTED}">${esc(options.footerNote)}</p>`
    : '';

  const links = SOCIAL
    .map((s) => `<a href="${href(s.url)}" style="font-family:${FONT};font-size:12px;color:${FQ_MUTED};text-decoration:none">${esc(s.label)}</a>`)
    .join(`<span style="color:${FQ_LINE}">&nbsp;&nbsp;&nbsp;&nbsp;</span>`);

  const optOut = options.unsubscribeUrl
    ? `<a href="${href(options.unsubscribeUrl)}" style="font-family:${FONT};font-size:12px;color:${FQ_MUTED};text-decoration:underline">Unsubscribe from these reminders</a>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${esc(options.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${FQ_DARK}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${FQ_DARK}" style="background-color:${FQ_DARK}">
    <tr><td align="center" bgcolor="${FQ_DARK}" style="padding:24px 12px;background-color:${FQ_DARK}">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${FQ_DARK}" style="width:100%;max-width:600px;background-color:${FQ_DARK}">
${cell(
    `<a href="${SITE}" style="text-decoration:none"><img src="${href(`${assets}/email/wordmark-green.png`)}" width="132" height="31" alt="Finquanta" style="display:block;border:0;height:auto;font-family:${FONT};font-size:18px;font-weight:700;color:${FQ_GREEN}"></a>`,
    '28px 40px 4px'
  )}
${cell(
    `<img src="${href(`${assets}/email/icon-glow.png`)}" width="220" height="150" alt="" style="display:block;border:0;height:auto;margin:0 auto">`,
    '8px 40px 0',
    'center'
  )}
${cell(
    `<h1 style="margin:0;font-family:${FONT};font-size:26px;font-weight:700;line-height:1.25;color:${FQ_TEXT}">${esc(options.title)}</h1>`,
    '4px 40px 0',
    align
  )}
${cell(body + expiry + raw + note, '16px 40px 8px', align)}
      <tr><td bgcolor="${FQ_DARK}" style="padding:28px 40px 0;background-color:${FQ_DARK}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td height="1" bgcolor="${FQ_LINE}" style="height:1px;line-height:1px;font-size:1px;background-color:${FQ_LINE}">&nbsp;</td></tr>
        </table>
      </td></tr>
      <tr><td bgcolor="${FQ_DARK}" style="padding:22px 40px 0;background-color:${FQ_DARK}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="left" valign="middle" style="background-color:${FQ_DARK}"><a href="${SITE}" style="text-decoration:none"><img src="${href(`${assets}/email/wordmark-white.png`)}" width="96" height="22" alt="Finquanta" style="display:block;border:0;height:auto;font-family:${FONT};font-size:14px;font-weight:700;color:${FQ_TEXT}"></a></td>
            <td align="right" valign="middle" style="background-color:${FQ_DARK};font-family:${FONT};font-size:12px;color:${FQ_MUTED}">AI-Powered Company Brain</td>
          </tr>
        </table>
      </td></tr>
${cell(links, '20px 40px 0')}
${optOut ? cell(optOut, '12px 40px 0') : ''}
${cell(
    `<span style="font-family:${FONT};font-size:11px;color:${FQ_MUTED}">&copy; ${new Date().getFullYear()} Finquanta</span>`,
    '10px 40px 32px'
  )}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
