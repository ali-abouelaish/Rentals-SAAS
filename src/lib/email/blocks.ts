/**
 * Agency-authored message bodies → structured email HTML.
 *
 * Agencies never write HTML. They write plain text with a tiny, documented
 * markup subset, and this turns it into the block markup the email shell
 * styles. That split is the point: the agency owns the words, we own how they
 * look, and there is no path for markup in a template to reach the email as
 * raw HTML — everything is escaped before any tag is added.
 *
 *   # Heading      the hero headline (first block only; drives the shell's H1)
 *   ## Heading     a section heading
 *   - item         a bullet (consecutive lines make one list)
 *   [Label](url)   alone on a line: a call-to-action button. Inline: a link.
 *   ---            a divider
 *   **bold**       bold
 *   blank line     new paragraph (a single newline is a line break)
 *
 * Bare URLs are linked automatically.
 */

const FONT = "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export type RenderedBody = {
  /** The `# heading` opening the body, if present — rendered by the shell. */
  headline: string | null;
  /** Block HTML for the body area. */
  html: string;
  /** Plain-text alternative with the markup flattened. */
  text: string;
};

/**
 * Escape for HTML text, dropping control characters. Note the ordering rule
 * this file follows throughout: links are matched against the RAW text and
 * each piece is then escaped for the context it lands in (text vs attribute).
 * Escaping first and pattern-matching after would leave entity fragments like
 * `&quot` inside an href, which browsers may decode back into a quote.
 */
function esc(s: string): string {
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BOLD = /\*\*([^*\n]+)\*\*/g;
/** One pass finds markdown links and bare URLs, so neither can nest. */
const LINKISH = /\[([^\]\n]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<]+[^\s<.,:;"')\]])/g;

/**
 * Only ever emit hrefs we recognise — no javascript:, no data:, and nothing
 * carrying a character that could break out of the attribute.
 */
function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (/["'<>`\s]/.test(trimmed)) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(trimmed)) return trimmed;
  // An unresolved {{merge_field}} survives so a preview still renders the
  // button; it cannot form a scheme, so it is inert rather than dangerous.
  if (/^\{\{[a-zA-Z0-9_]+\}\}$/.test(trimmed)) return trimmed;
  return null;
}

/** A run of plain text: escaped, then bold and line breaks applied. */
function textRun(raw: string): string {
  return esc(raw)
    .replace(BOLD, '<strong style="font-weight:600;">$1</strong>')
    .replace(/\n/g, "<br>");
}

function anchor(href: string, label: string, color: string): string {
  return `<a href="${esc(href)}" style="color:${color};text-decoration:underline;">${esc(
    label
  )}</a>`;
}

/** Inline markup on one raw run of text. */
function inline(raw: string, color: string): string {
  const parts: string[] = [];
  let last = 0;
  LINKISH.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = LINKISH.exec(raw)) !== null) {
    parts.push(textRun(raw.slice(last, match.index)));
    const [whole, mdLabel, mdUrl, bareUrl] = match;
    if (mdLabel !== undefined) {
      const href = safeHref(mdUrl);
      parts.push(href ? anchor(href, mdLabel, color) : textRun(whole));
    } else {
      const href = safeHref(bareUrl);
      parts.push(href ? anchor(href, bareUrl, color) : textRun(whole));
    }
    last = LINKISH.lastIndex;
  }
  parts.push(textRun(raw.slice(last)));
  return parts.join("");
}

/** Markup flattened for the plain-text alternative. */
function flatten(raw: string): string {
  return raw.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, "$1: $2").replace(BOLD, "$1");
}

function isBullet(line: string): boolean {
  return /^\s*[-*]\s+\S/.test(line);
}

function bulletText(line: string): string {
  return line.replace(/^\s*[-*]\s+/, "");
}

/** A line that is nothing but one markdown link becomes a button. */
function asButton(line: string): { label: string; url: string } | null {
  const m = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/.exec(line.trim());
  if (!m) return null;
  const href = safeHref(m[2]);
  return href ? { label: m[1], url: href } : null;
}

export function renderMessageBody(
  markup: string,
  opts: { primaryColor: string; linkColor?: string } = { primaryColor: "#111111" }
): RenderedBody {
  const primary = opts.primaryColor || "#111111";
  const linkColor = opts.linkColor || primary;

  const lines = markup.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  const text: string[] = [];
  let headline: string | null = null;

  let i = 0;
  let firstBlock = true;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const raw = paragraph.join("\n");
    html.push(
      `<p style="margin:0 0 14px 0;font-family:${FONT};font-size:15px;line-height:1.6;color:#2a2a2a;">${inline(raw, linkColor)}</p>`
    );
    text.push(flatten(raw));
    text.push("");
    paragraph = [];
    firstBlock = false;
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      flushParagraph();
      i += 1;
      continue;
    }

    // Hero headline — only when it opens the body.
    const h1 = /^#\s+(.+)$/.exec(trimmed);
    if (h1 && firstBlock && paragraph.length === 0 && headline === null) {
      headline = h1[1].trim();
      text.push(headline);
      text.push("");
      firstBlock = false;
      i += 1;
      continue;
    }

    const h2 = /^##\s+(.+)$/.exec(trimmed);
    if (h2) {
      flushParagraph();
      const heading = h2[1].trim();
      html.push(
        `<div style="margin:26px 0 10px 0;font-family:${MONO};font-size:10px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">${inline(heading, linkColor)}</div>`
      );
      text.push(heading.toUpperCase());
      firstBlock = false;
      i += 1;
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) {
      flushParagraph();
      html.push(
        `<div style="margin:22px 0;border-top:1px solid #e5e7eb;font-size:0;line-height:0;">&nbsp;</div>`
      );
      text.push("---");
      text.push("");
      firstBlock = false;
      i += 1;
      continue;
    }

    const button = asButton(trimmed);
    if (button) {
      flushParagraph();
      html.push(
        `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 20px 0;">` +
          `<tr><td align="center" style="background-color:${esc(primary)};border-radius:10px;">` +
          `<a href="${esc(button.url)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:500;color:#ffffff;text-decoration:none;">${esc(
            button.label
          )}</a>` +
          `</td></tr></table>`
      );
      text.push(`${button.label}: ${button.url}`);
      text.push("");
      firstBlock = false;
      i += 1;
      continue;
    }

    if (isBullet(line)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i])) {
        items.push(bulletText(lines[i]));
        i += 1;
      }
      html.push(
        `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 14px 0;">` +
          items
            .map(
              (item) =>
                `<tr>` +
                `<td width="16" valign="top" style="width:16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${esc(
                  primary
                )};">&bull;</td>` +
                `<td valign="top" style="font-family:${FONT};font-size:15px;line-height:1.6;color:#2a2a2a;padding-bottom:4px;">${inline(item, linkColor)}</td>` +
                `</tr>`
            )
            .join("") +
          `</table>`
      );
      for (const item of items) {
        text.push(`  • ${flatten(item)}`);
      }
      text.push("");
      firstBlock = false;
      continue;
    }

    paragraph.push(line);
    i += 1;
  }

  flushParagraph();

  return {
    headline,
    html: html.join(""),
    text: text.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
  };
}
