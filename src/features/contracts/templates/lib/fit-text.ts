import type { PDFFont } from "pdf-lib";

export type FittedText = {
  text: string;
  size: number;
};

export type FittedLines = {
  lines: string[];
  size: number;
  lineHeight: number;
  /** True when text had to be cut to fit the box. */
  truncated: boolean;
};

const ELLIPSIS = "…";
const MIN_SIZE = 6;
const LINE_HEIGHT = 1.2;

/**
 * A single-line field can't hold a line break; turn breaks into ", " so an
 * address typed over several lines still reads as one ("Flat 2, 12 High St").
 */
export function toSingleLine(value: string): string {
  return value
    .split(/\r\n|\r|\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ")
    .replace(/[\t\f\v]+/g, " ");
}

function truncateToWidth(value: string, font: PDFFont, size: number, boxWidth: number): string {
  const ellipsisWidth = font.widthOfTextAtSize(ELLIPSIS, size);
  let lo = 0;
  let hi = value.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const w = font.widthOfTextAtSize(value.slice(0, mid), size) + ellipsisWidth;
    if (w <= boxWidth) lo = mid + 1;
    else hi = mid;
  }
  const cut = Math.max(0, lo - 1);
  return value.slice(0, cut).trimEnd() + ELLIPSIS;
}

export function fitTextToBox(
  value: string,
  font: PDFFont,
  desiredSize: number,
  boxWidth: number,
  _boxHeight: number,
  truncateOverflow: boolean,
): FittedText {
  if (!value) return { text: "", size: desiredSize };

  const width = font.widthOfTextAtSize(value, desiredSize);
  if (width <= boxWidth) return { text: value, size: desiredSize };

  if (truncateOverflow) {
    return { text: truncateToWidth(value, font, desiredSize, boxWidth), size: desiredSize };
  }

  // Shrink-to-fit: binary-search a font size between MIN_SIZE and desiredSize.
  let lo = MIN_SIZE;
  let hi = desiredSize;
  while (hi - lo > 0.25) {
    const mid = (lo + hi) / 2;
    if (font.widthOfTextAtSize(value, mid) <= boxWidth) lo = mid;
    else hi = mid;
  }
  // Still too wide at the minimum size — cut it rather than spill past the box.
  if (font.widthOfTextAtSize(value, lo) > boxWidth) {
    return { text: truncateToWidth(value, font, lo, boxWidth), size: lo };
  }
  return { text: value, size: lo };
}

/** Greedy word wrap; a word wider than the box is broken by character. */
function wrapLines(value: string, font: PDFFont, size: number, boxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of value.split(/\r\n|\r|\n/)) {
    const words = paragraph.replace(/[\t\f\v]+/g, " ").split(/ +/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= boxWidth) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      // Break an over-long word across lines.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > boxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > boxWidth) cut--;
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    out.push(line);
  }
  // Drop trailing blank lines from a trailing newline.
  while (out.length > 1 && out[out.length - 1] === "") out.pop();
  return out;
}

/**
 * Wrap text into a box over as many lines as its height allows. Shrinks the
 * font (down to MIN_SIZE) when truncation is off; otherwise keeps the size and
 * ends the last visible line with an ellipsis.
 */
export function wrapTextToBox(
  value: string,
  font: PDFFont,
  desiredSize: number,
  boxWidth: number,
  boxHeight: number,
  truncateOverflow: boolean,
): FittedLines {
  const layout = (size: number) => {
    const lines = wrapLines(value, font, size, boxWidth);
    const lineHeight = size * LINE_HEIGHT;
    const capacity = Math.max(1, Math.floor((boxHeight + (lineHeight - size)) / lineHeight));
    return { lines, lineHeight, capacity };
  };

  let size = desiredSize;
  let { lines, lineHeight, capacity } = layout(size);

  if (lines.length > capacity && !truncateOverflow) {
    let lo = MIN_SIZE;
    let hi = desiredSize;
    while (hi - lo > 0.25) {
      const mid = (lo + hi) / 2;
      const attempt = layout(mid);
      if (attempt.lines.length <= attempt.capacity) lo = mid;
      else hi = mid;
    }
    size = lo;
    ({ lines, lineHeight, capacity } = layout(size));
  }

  if (lines.length <= capacity) return { lines, size, lineHeight, truncated: false };

  const kept = lines.slice(0, capacity);
  const last = kept[kept.length - 1] ?? "";
  const lastWithEllipsis = last + ELLIPSIS;
  kept[kept.length - 1] =
    font.widthOfTextAtSize(lastWithEllipsis, size) <= boxWidth
      ? lastWithEllipsis
      : truncateToWidth(last, font, size, boxWidth);
  return { lines: kept, size, lineHeight, truncated: true };
}
