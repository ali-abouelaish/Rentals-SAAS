import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { ContractTemplateField } from "../domain/types";
import { fitTextToBox } from "./fit-text";
import { resolveFieldValue, type ResolverContext } from "./resolver";

export type StampInput = {
  sourceBytes: Uint8Array | ArrayBuffer;
  fields: ContractTemplateField[];
  context: ResolverContext;
};

export async function stampContractPdf({ sourceBytes, fields, context }: StampInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourceBytes as ArrayBuffer);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();

  for (const field of fields) {
    if (field.page_index < 0 || field.page_index >= pages.length) continue;

    const value = resolveFieldValue(field, context);
    if (!value) continue;

    const page = pages[field.page_index];
    const { height: pageH } = page.getSize();
    const font: PDFFont = field.font_weight === "bold" ? helvBold : helv;

    const yBottomLeft = pageH - field.y - field.height;

    const fitted = fitTextToBox(
      value,
      font,
      field.font_size,
      field.width,
      field.height,
      field.truncate_overflow,
    );
    if (!fitted.text) continue;

    const textWidth = font.widthOfTextAtSize(fitted.text, fitted.size);
    let xStart = field.x;
    if (field.text_align === "center") {
      xStart = field.x + (field.width - textWidth) / 2;
    } else if (field.text_align === "right") {
      xStart = field.x + field.width - textWidth;
    }

    const yDraw = yBottomLeft + (field.height - fitted.size) / 2;

    page.drawText(fitted.text, {
      x: xStart,
      y: yDraw,
      size: fitted.size,
      font,
      color: rgb(0, 0, 0),
    });
  }

  return pdf.save();
}

export type PageMeta = { width: number; height: number; rotation: number };

/**
 * Read page count + sizes from a source PDF. Used at upload time so the
 * editor can render the canvas at authoritative dimensions later.
 * Rejects rotated pages (we don't support stamping onto them in v1).
 */
export async function readPdfPageMeta(sourceBytes: Uint8Array | ArrayBuffer): Promise<{
  pageCount: number;
  pageSizes: { width: number; height: number }[];
}> {
  const pdf = await PDFDocument.load(sourceBytes as ArrayBuffer);
  const pages = pdf.getPages();
  const pageSizes: { width: number; height: number }[] = [];
  for (const page of pages) {
    const rotation = page.getRotation().angle;
    if (rotation !== 0) {
      throw new Error("Rotated pages are not supported. Rotate pages in your PDF tool and re-upload.");
    }
    const { width, height } = page.getSize();
    pageSizes.push({ width, height });
  }
  return { pageCount: pages.length, pageSizes };
}
