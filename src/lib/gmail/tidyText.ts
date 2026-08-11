/**
 * Normalise enquiry message text for storage and display. Portal emails are
 * deeply-nested HTML — stripping tags leaves lots of indented lines and runs of
 * blank lines from empty wrapper elements. This trims per-line whitespace and
 * collapses blank-line runs to a single blank line, preserving paragraph breaks
 * without the huge vertical gaps.
 */
export function tidyMessageText(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/\r\n?/g, "\n")        // normalise line endings
    .split("\n")
    .map((line) => line.trim())     // drop leading/trailing indentation per line
    .join("\n")
    .replace(/\n{2,}/g, "\n\n")     // collapse blank-line runs to one blank line
    .replace(/[ \t]{2,}/g, " ")     // collapse runs of inline whitespace
    .trim();
}
