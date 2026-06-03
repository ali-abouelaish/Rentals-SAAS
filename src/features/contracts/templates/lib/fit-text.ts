import type { PDFFont } from "pdf-lib";

export type FittedText = {
  text: string;
  size: number;
};

const ELLIPSIS = "…";

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
    const ellipsisWidth = font.widthOfTextAtSize(ELLIPSIS, desiredSize);
    let lo = 0;
    let hi = value.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const slice = value.slice(0, mid);
      const w = font.widthOfTextAtSize(slice, desiredSize) + ellipsisWidth;
      if (w <= boxWidth) lo = mid + 1;
      else hi = mid;
    }
    const cut = Math.max(0, lo - 1);
    return { text: value.slice(0, cut) + ELLIPSIS, size: desiredSize };
  }

  // Shrink-to-fit: binary-search a font size between MIN_SIZE and desiredSize.
  const MIN_SIZE = 6;
  let lo = MIN_SIZE;
  let hi = desiredSize;
  while (hi - lo > 0.25) {
    const mid = (lo + hi) / 2;
    if (font.widthOfTextAtSize(value, mid) <= boxWidth) lo = mid;
    else hi = mid;
  }
  return { text: value, size: lo };
}
