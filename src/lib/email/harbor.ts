/**
 * Harbor's own email shell — for mail Harbor sends in its own voice: platform
 * invoices, help desk, demo requests, and workspace notifications and alerts.
 *
 * Mail an agency sends to its tenants, landlords or contractors carries the
 * agency's branding instead (emails/*.hbs, templates/maintenance.ts, …) and
 * must not use this.
 *
 * The look follows the Harbor design system (the public site's home.css):
 * cream card on paper, Urbanist at weight 500, two-tone headlines, Deep
 * Harbour pills with the sand arrow, hairline rows. Email clients strip <style>
 * unevenly, so everything that matters is inline and tables do the layout;
 * the <style> block only adds the mobile padding and font loading.
 *
 * Every helper escapes its own text arguments. Only arguments named `html` are
 * emitted as-is, and those must be built from these helpers or `esc`.
 */

const INK = "#13201F";
const DEEP = "#19363A";
const TEAL = "#215B5D";
const CREAM = "#FDF9F2";
const PAPER = "#F3EDE3";
const CARD = "#FFFDF9";
/** Second tone at headline size (24px+ only). */
const TONE_2 = "#7D8B88";
/** Second tone and muted text at small sizes (4.6:1 on paper). */
const TONE_2_SMALL = "#626D6A";
const LINE = "#DEDEDA"; // `line` (14% ink) flattened onto the card
const ENAMEL = "#F7F1E5";

const FONT = "'Urbanist', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Callout tones. `notice` and `error` are the design's attention colours flattened onto the card. */
const TONES = {
  info: { bg: ENAMEL, ink: INK, rule: "#D4BE97" },
  notice: { bg: "#F7EAD7", ink: "#8A5A12", rule: "#E2B97A" },
  error: { bg: "#F6E6E1", ink: "#A3402E", rule: "#D9A497" },
} as const;

export type HarborTone = keyof typeof TONES;

export function esc(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Absolute URL for a brand image. Emails are read outside the app, so this is
 * the public apex domain (APP_PORTAL_DOMAIN, read at runtime), never a
 * NEXT_PUBLIC_* value frozen at build time. The PNGs live in
 * public/site/brand/email — SVG doesn't render in Gmail or Outlook.
 */
function assetUrl(file: string): string {
  const domain = (process.env.APP_PORTAL_DOMAIN ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();
  const host = domain || "harborops.co.uk";
  const scheme = host.startsWith("localhost") ? "http" : "https";
  return `${scheme}://${host}/site/brand/email/${file}`;
}

// ── Blocks ──────────────────────────────────────────────────────────

/** Body paragraph. `html` must already be escaped (use `esc`, `strong`, `link`). */
export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.5;font-weight:500;color:${INK};">${html}</p>`;
}

/** Smaller muted paragraph, for asides under the main content. */
export function note(html: string): string {
  return `<p style="margin:0 0 12px;font-family:${FONT};font-size:13.5px;line-height:1.45;font-weight:500;color:${TONE_2_SMALL};">${html}</p>`;
}

export function strong(text: string): string {
  return `<strong style="font-weight:600;">${esc(text)}</strong>`;
}

export function link(url: string, label: string): string {
  return `<a href="${esc(url)}" style="color:${TEAL};text-decoration:underline;">${esc(label)}</a>`;
}

/** Section label above a group (15px/600, sentence case — never caps). */
export function label(text: string): string {
  return `<p style="margin:28px 0 8px;font-family:${FONT};font-size:15px;line-height:1.5;font-weight:600;color:${TEAL};">${esc(text)}</p>`;
}

/** The primary pill: Deep Harbour, cream label, sand arrow. */
export function button(url: string, text: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 22px;border-collapse:separate;">
<tr><td bgcolor="${DEEP}" style="background-color:${DEEP};border-radius:999px;mso-padding-alt:14px 24px;">
<a href="${esc(url)}" style="display:inline-block;padding:14px 22px 14px 24px;font-family:${FONT};font-size:15px;line-height:16px;font-weight:500;letter-spacing:0.005em;color:${CREAM};text-decoration:none;border-radius:999px;">${esc(
    text
  )}&nbsp;&nbsp;<img src="${assetUrl("arrow-sand.png")}" width="14" height="14" alt="" style="display:inline-block;width:14px;height:14px;border:0;vertical-align:-2px;"></a>
</td></tr></table>`;
}

/**
 * Label / value rows on hairline rules — how the design lists facts. A value
 * of `{ html }` is emitted as-is (for links and chips).
 */
export function facts(rows: ReadonlyArray<readonly [string, string | { html: string }]>, opts: { emphasiseLast?: boolean } = {}): string {
  const body = rows
    .map(([key, value], i) => {
      const last = i === rows.length - 1;
      const big = opts.emphasiseLast && last;
      const shown = typeof value === "string" ? esc(value) : value.html;
      return `<tr>
<td valign="top" style="padding:11px 16px 11px 0;border-top:1px solid ${LINE};${last ? `border-bottom:1px solid ${LINE};` : ""}font-family:${FONT};font-size:14px;line-height:1.45;font-weight:500;color:${TONE_2_SMALL};white-space:nowrap;">${esc(key)}</td>
<td valign="top" align="right" style="padding:11px 0;border-top:1px solid ${LINE};${last ? `border-bottom:1px solid ${LINE};` : ""}font-family:${FONT};font-size:${big ? "17px" : "14px"};line-height:1.45;font-weight:600;color:${INK};text-align:right;word-break:break-word;${big ? "font-variant-numeric:tabular-nums;" : ""}">${shown}</td>
</tr>`;
    })
    .join("");
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:4px 0 24px;border-collapse:collapse;">${body}</table>`;
}

/** Someone else's words (a ticket body, a reply), kept verbatim with line breaks. */
export function quote(text: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:4px 0 22px;border-collapse:separate;">
<tr><td style="background-color:${ENAMEL};border-left:3px solid #D4BE97;border-radius:12px;padding:16px 18px;font-family:${FONT};font-size:15px;line-height:1.55;font-weight:500;color:${INK};white-space:pre-wrap;word-break:break-word;">${esc(
    text
  )}</td></tr></table>`;
}

/** A boxed message that needs attention. `html` must already be escaped. */
export function callout(html: string, tone: HarborTone = "info"): string {
  const t = TONES[tone];
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;border-collapse:separate;">
<tr><td style="background-color:${t.bg};border:1px solid ${t.rule};border-radius:12px;padding:14px 16px;font-family:${FONT};font-size:14px;line-height:1.5;font-weight:${tone === "info" ? 500 : 600};color:${t.ink};">${html}</td></tr></table>`;
}

/** A status chip: always a word, never colour alone. */
export function chip(text: string): string {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background-color:#E4EAE6;color:${TEAL};font-family:${FONT};font-size:13px;line-height:1.4;font-weight:600;">${esc(text)}</span>`;
}

// ── Shell ───────────────────────────────────────────────────────────

export type HarborEmailOptions = {
  /** The document <title>; usually the subject. */
  title: string;
  /** Inbox preview text. */
  preheader?: string;
  /** Short label above the headline, e.g. "Help desk" or "Invoice H-0042". */
  eyebrow?: string;
  /**
   * The two-tone headline: a claim, then its qualifier in the second tone.
   * Each part is a full sentence with its own full stop.
   */
  headline: readonly [string, string?];
  /** Body blocks, built from the helpers above. */
  html: string;
  /** Why this person got the email. Shown under the card. */
  footnote?: string;
};

export function harborEmail(o: HarborEmailOptions): string {
  const [first, second] = o.headline;
  const preheader = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAPER};opacity:0;">${esc(
        o.preheader
      )}${"&#8199;&#847; ".repeat(40)}</div>`
    : "";
  const eyebrow = o.eyebrow
    ? `<p style="margin:0 0 12px;font-family:${FONT};font-size:15px;line-height:1.5;font-weight:600;color:${TEAL};">${esc(o.eyebrow)}</p>`
    : "";
  const footnote = o.footnote
    ? `<p style="margin:0 0 8px;font-family:${FONT};font-size:12.5px;line-height:1.5;font-weight:500;color:${TONE_2_SMALL};">${esc(o.footnote)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en-GB" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(o.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light only; }
  body { margin: 0; padding: 0; }
  @media (max-width: 620px) {
    .h-outer { padding: 20px 12px 28px !important; }
    .h-card { padding: 30px 22px 10px !important; border-radius: 24px !important; }
    .h-headline { font-size: 25px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${PAPER};-webkit-text-size-adjust:100%;">
${preheader}
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="${PAPER}" style="background-color:${PAPER};">
<tr><td class="h-outer" align="center" style="padding:36px 16px 40px;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:580px;">
    <tr><td style="padding:0 6px 22px;">
      <img src="${assetUrl("harbor-logo-teal.png")}" width="118" height="29" alt="Harbor" style="display:block;width:118px;height:29px;border:0;font-family:${FONT};font-size:18px;font-weight:700;color:${TEAL};">
    </td></tr>
    <tr><td class="h-card" bgcolor="${CARD}" style="background-color:${CARD};border-radius:28px;padding:40px 40px 18px;box-shadow:0 1px 2px rgba(19,32,31,.04),0 18px 44px -22px rgba(19,32,31,.18);">
      ${eyebrow}
      <h1 class="h-headline" style="margin:0 0 22px;font-family:${FONT};font-size:30px;line-height:1.1;font-weight:600;letter-spacing:-0.02em;color:${INK};">${esc(first)}${
        second ? ` <span style="color:${TONE_2};">${esc(second)}</span>` : ""
      }</h1>
      ${o.html}
    </td></tr>
    <tr><td style="padding:22px 6px 0;">
      ${footnote}
      <p style="margin:0;font-family:${FONT};font-size:12.5px;line-height:1.5;font-weight:500;color:${TONE_2_SMALL};">Harbor &middot; Property management, room by room &middot; <a href="https://harborops.co.uk" style="color:${TONE_2_SMALL};text-decoration:underline;">harborops.co.uk</a></p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}
