import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ContractTemplateField } from "../domain/types";
import { fitTextToBox, toSingleLine, wrapTextToBox } from "./fit-text";
import { resolveFieldValue, type ResolverContext } from "./resolver";

export type StampInput = {
  sourceBytes: Uint8Array | ArrayBuffer;
  fields: ContractTemplateField[];
  context: ResolverContext;
};

export type StampResult = {
  bytes: Uint8Array;
  /** Plain-English notes for the agent: blank fields, unprintable characters. */
  warnings: string[];
};

// Liberation Sans (SIL OFL, metric-compatible with Helvetica/Arial). The PDF
// standard fonts only encode WinAnsi, so a single "Ł", "ș" or line break in any
// value made pdf-lib throw and the whole contract fail to generate. Embedding a
// real font covers Latin Extended, Greek and Cyrillic; it is subset, so only the
// glyphs actually used are added to the file.
//
// Under public/ because that is what the deploy syncs to the VPS alongside
// .next — a separate assets folder would be missing in production.
const FONT_DIR = path.join(process.cwd(), "public", "fonts");
let fontBytes: Promise<{ regular: Uint8Array; bold: Uint8Array }> | null = null;

function loadFontBytes() {
  if (!fontBytes) {
    fontBytes = Promise.all([
      readFile(path.join(FONT_DIR, "LiberationSans-Regular.ttf")),
      readFile(path.join(FONT_DIR, "LiberationSans-Bold.ttf")),
    ])
      .then(([regular, bold]) => ({ regular: new Uint8Array(regular), bold: new Uint8Array(bold) }))
      .catch((err) => {
        fontBytes = null; // let the next call retry rather than caching the failure
        throw err;
      });
  }
  return fontBytes;
}

/** Errors whose message is safe and useful to show the agent. */
export class PdfTemplateError extends Error {}

async function loadPdf(sourceBytes: Uint8Array | ArrayBuffer): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(sourceBytes as ArrayBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/encrypt/i.test(message)) {
      throw new PdfTemplateError(
        "This PDF is password-protected or encrypted. Save an unprotected copy (e.g. Print → Save as PDF) and upload that.",
      );
    }
    throw new PdfTemplateError("That file couldn't be read as a PDF. Re-export it from your editor and try again.");
  }
}

/**
 * The visible page area. Editor coordinates are measured from the top-left of
 * what pdf.js renders, which is the crop box — not the media box, which can be
 * larger (bleed) or offset from the origin. Drawing against the media box put
 * text off by the difference on such PDFs.
 */
function visibleBox(page: PDFPage) {
  const media = page.getMediaBox();
  const crop = page.getCropBox();
  // pdf.js shows the intersection of the two.
  const x1 = Math.max(media.x, crop.x);
  const y1 = Math.max(media.y, crop.y);
  const x2 = Math.min(media.x + media.width, crop.x + crop.width);
  const y2 = Math.min(media.y + media.height, crop.y + crop.height);
  if (x2 <= x1 || y2 <= y1) return media;
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

function unsupportedChars(value: string, supported: Set<number>): string[] {
  const missing = new Set<string>();
  for (const ch of value) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0x0a || cp === 0x0d || cp === 0x09) continue;
    if (!supported.has(cp)) missing.add(ch);
  }
  return [...missing];
}

export async function stampContractPdf({ sourceBytes, fields, context }: StampInput): Promise<StampResult> {
  const pdf = await loadPdf(sourceBytes);
  pdf.registerFontkit(fontkit);
  const { regular, bold } = await loadFontBytes();

  // Embedded lazily: an unused bold face shouldn't add to every contract.
  let regularFont: PDFFont | null = null;
  let boldFont: PDFFont | null = null;
  const fontFor = async (weight: string) => {
    if (weight === "bold") return (boldFont ??= await pdf.embedFont(bold, { subset: true }));
    return (regularFont ??= await pdf.embedFont(regular, { subset: true }));
  };
  const charSets = new Map<PDFFont, Set<number>>();
  const supportedBy = (font: PDFFont) => {
    let set = charSets.get(font);
    if (!set) {
      set = new Set(font.getCharacterSet());
      charSets.set(font, set);
    }
    return set;
  };

  const pages = pdf.getPages();
  const blank: string[] = [];
  const warnings: string[] = [];

  for (const field of fields) {
    if (field.page_index < 0 || field.page_index >= pages.length) continue;

    // E-signature fields are placed by BoldSign at send time, not stamped —
    // they bind to no data, and drawing anything in the box would sit under the
    // signature the signer later adds.
    //
    // Defaulted rather than compared directly: migrations are applied by hand,
    // so between deploy and migration this column is absent. Treating undefined
    // as "not data" would skip every field and generate blank contracts.
    if ((field.field_kind ?? "data") !== "data") continue;

    const label = field.label?.trim() || "Unnamed field";

    try {
      const raw = resolveFieldValue(field, context);
      if (!raw.trim()) {
        blank.push(label);
        continue;
      }

      const page = pages[field.page_index];
      const box = visibleBox(page);
      const font = await fontFor(field.font_weight);

      const missing = unsupportedChars(raw, supportedBy(font));
      if (missing.length > 0) {
        warnings.push(
          `"${label}" contains characters the contract font can't print (${missing.slice(0, 5).join(" ")}) — they will show as boxes. Check the PDF before sending it.`,
        );
      }

      // Box top in PDF user space (bottom-left origin), offset by the crop box.
      const boxLeft = box.x + field.x;
      const boxTop = box.y + box.height - field.y;
      const lineX = (text: string, size: number) => {
        const textWidth = font.widthOfTextAtSize(text, size);
        if (field.text_align === "center") return boxLeft + (field.width - textWidth) / 2;
        if (field.text_align === "right") return boxLeft + field.width - textWidth;
        return boxLeft;
      };

      if (field.format === "multiline") {
        const fitted = wrapTextToBox(raw, font, field.font_size, field.width, field.height, field.truncate_overflow);
        if (fitted.truncated) warnings.push(`"${label}" was too long for its box and has been cut short.`);
        fitted.lines.forEach((line, i) => {
          if (!line) return;
          // First baseline sits one font-size below the box top.
          const y = boxTop - fitted.size - i * fitted.lineHeight;
          page.drawText(line, { x: lineX(line, fitted.size), y, size: fitted.size, font, color: rgb(0, 0, 0) });
        });
        continue;
      }

      const value = toSingleLine(raw);
      const fitted = fitTextToBox(value, font, field.font_size, field.width, field.height, field.truncate_overflow);
      if (!fitted.text) continue;
      if (fitted.text !== value) warnings.push(`"${label}" was too long for its box and has been cut short.`);

      // Vertically centred in the box.
      const y = boxTop - field.height + (field.height - fitted.size) / 2;
      page.drawText(fitted.text, { x: lineX(fitted.text, fitted.size), y, size: fitted.size, font, color: rgb(0, 0, 0) });
    } catch (err) {
      // One bad field must not cost the whole contract. Say which one.
      console.error("[contracts] could not stamp field", { fieldId: field.id, label, err });
      warnings.push(`"${label}" couldn't be printed and has been left blank.`);
    }
  }

  if (blank.length > 0) {
    warnings.unshift(
      `${blank.length === 1 ? "This field was" : "These fields were"} left blank because the data is missing: ${blank.join(", ")}.`,
    );
  }

  return { bytes: await pdf.save(), warnings };
}

/**
 * Read page count + sizes from a source PDF. Used at upload time so the
 * editor can render the canvas at authoritative dimensions later.
 * Sizes are the visible (crop) box, which is what the editor shows.
 * Rejects rotated pages (we don't support stamping onto them in v1).
 */
export async function readPdfPageMeta(sourceBytes: Uint8Array | ArrayBuffer): Promise<{
  pageCount: number;
  pageSizes: { width: number; height: number }[];
}> {
  const pdf = await loadPdf(sourceBytes);
  const pages = pdf.getPages();
  const pageSizes: { width: number; height: number }[] = [];
  for (const page of pages) {
    const rotation = page.getRotation().angle;
    if (rotation % 360 !== 0) {
      throw new PdfTemplateError("Rotated pages are not supported. Rotate pages in your PDF tool and re-upload.");
    }
    const { width, height } = visibleBox(page);
    pageSizes.push({ width, height });
  }
  return { pageCount: pages.length, pageSizes };
}
