// Merge-field rendering for user-authored message templates. Deliberately NOT
// Handlebars: a plain regex substitution against the static allowlist means
// user content can never invoke helpers or partials. Unknown keys are left
// visible in the output and reported so the editor can warn.

const MERGE_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function renderTemplate(
  text: string,
  ctx: Record<string, string>
): { text: string; unknownKeys: string[] } {
  const unknown = new Set<string>();
  const rendered = text.replace(MERGE_RE, (match, key: string) => {
    const value = ctx[key];
    if (value === undefined) {
      unknown.add(key);
      return match;
    }
    return value;
  });
  return { text: rendered, unknownKeys: [...unknown] };
}

/** Every {{key}} referenced in a template body/subject. */
export function extractMergeKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const match of text.matchAll(MERGE_RE)) {
    keys.add(match[1]);
  }
  return [...keys];
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Plain-text body → simple HTML email (paragraphs on blank lines, <br/> on
 * single newlines). Same output as the manual rent-reminder custom-body path.
 */
export function bodyToHtml(body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 12px 0;line-height:1.5;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`
    )
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;">${paragraphs}</div>`;
}

/**
 * SMS length accounting: 160 chars fits one segment; longer messages split
 * into 153-char segments. (Conservative GSM-7 approximation — non-GSM chars
 * would halve these limits, close enough for an editor warning.)
 */
export function smsSegments(body: string): { chars: number; segments: number } {
  const chars = body.length;
  const segments = chars === 0 ? 0 : chars <= 160 ? 1 : Math.ceil(chars / 153);
  return { chars, segments };
}
