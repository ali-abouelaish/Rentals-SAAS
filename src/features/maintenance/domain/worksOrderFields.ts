// Signature geometry for the works order document.
//
// This is the single source of truth for where the contractor signs. Two things
// consume it and they MUST agree:
//
//   1. WorksOrderPdf.tsx draws the dashed boxes at these coordinates.
//   2. worksOrderSignatureFields() turns the same numbers into BoldSign form
//      fields, which are overlaid on the rendered PDF.
//
// If the two came from different constants the contractor would see a box in
// one place and be asked to sign in another. Hence one module, imported by
// both, rather than a number typed twice.
//
// Two subtleties, both learned the hard way:
//
//   - The BOXES are positioned absolutely, not a wrapper around box + caption.
//     Wrapping them meant `bottom` referred to the bottom of the caption, so
//     the field sat below the box it was meant to fill. The captions are
//     positioned separately, above their boxes.
//   - The page number is passed in, not assumed. An absolutely-positioned
//     element renders on whichever page the flow reaches, so on a two-page
//     works order the block is on page 2 while a hard-coded page 1 field would
//     be stranded on the first. The caller reads the rendered page count and
//     passes it here.
//
// Coordinate systems:
//   - react-pdf positions from the BOTTOM of the page (`bottom: N`).
//   - BoldSign form fields use a TOP-LEFT origin, the same as Harbor Ops'
//     contract_template_fields (confirmed against the sandbox).
// The conversion happens in one place, below.

import type { SignatureFieldSpec } from "@/lib/boldsign/types";

/** A4 in PDF points, matching <Page size="A4">. */
export const WORKS_ORDER_PAGE = { width: 595.28, height: 841.89 } as const;

export const SIGNATURE_BLOCK = {
  /** Matches the page's horizontal padding. */
  left: 32,
  /** Distance from the page bottom to the bottom of the BOXES themselves. */
  bottom: 78,
  /** Horizontal gap between the signature box and the date box. */
  gap: 16,
  /** Gap between a box and the caption above it. */
  captionGap: 4,
  signature: { width: 260, height: 56 },
  dateSigned: { width: 140, height: 56 },
  /**
   * Bottom padding reserved on the page so flowing content can never overlap
   * the absolutely-positioned block: the boxes, their captions, and the footer.
   */
  reservedBottomSpace: 175,
} as const;

/** Left edge of the date box — derived, never typed twice. */
export const DATE_BOX_LEFT =
  SIGNATURE_BLOCK.left + SIGNATURE_BLOCK.signature.width + SIGNATURE_BLOCK.gap;

/** Bottom edge of a caption sitting above a box of the given height. */
export function captionBottom(boxHeight: number): number {
  return SIGNATURE_BLOCK.bottom + boxHeight + SIGNATURE_BLOCK.captionGap;
}

/**
 * Convert a box positioned from the page bottom (react-pdf) into the
 * top-left-origin rectangle BoldSign expects.
 */
export function topLeftY(bottom: number, height: number): number {
  return WORKS_ORDER_PAGE.height - bottom - height;
}

/**
 * The fields to place on a rendered works order, for the contractor to sign.
 *
 * One signer: the contractor accepts the instruction. The agency issues the
 * order rather than counter-signing it, so a second signature block would be
 * ceremony without meaning.
 *
 * @param pageNumber 1-based page the signature block was rendered on — the last
 *   page of the document. Read it from the rendered PDF rather than guessing.
 */
export function worksOrderSignatureFields(pageNumber: number): SignatureFieldSpec[] {
  const { left, bottom, signature, dateSigned } = SIGNATURE_BLOCK;

  return [
    {
      type: "Signature",
      pageNumber,
      x: left,
      y: topLeftY(bottom, signature.height),
      width: signature.width,
      height: signature.height,
      isRequired: true,
    },
    {
      type: "DateSigned",
      pageNumber,
      x: DATE_BOX_LEFT,
      y: topLeftY(bottom, dateSigned.height),
      width: dateSigned.width,
      height: dateSigned.height,
      isRequired: true,
    },
  ];
}
