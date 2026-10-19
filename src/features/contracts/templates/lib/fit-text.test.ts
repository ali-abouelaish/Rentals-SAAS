// Fitting stamped values into the boxes drawn on a template.
//
//   npm test

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";

import { fitTextToBox, toSingleLine, wrapTextToBox } from "./fit-text.ts";

let font: PDFFont;
before(async () => {
  const pdf = await PDFDocument.create();
  font = await pdf.embedFont(StandardFonts.Helvetica);
});

describe("toSingleLine", () => {
  it("joins a multi-line address with commas", () => {
    assert.equal(toSingleLine("Flat 2\n12 High Street\r\nLondon\n"), "Flat 2, 12 High Street, London");
  });
});

describe("fitTextToBox", () => {
  it("leaves text that fits alone", () => {
    assert.deepEqual(fitTextToBox("Short", font, 10, 200, 12, true), { text: "Short", size: 10 });
  });

  it("truncates with an ellipsis when asked to", () => {
    const fitted = fitTextToBox("A very long tenant name indeed", font, 10, 60, 12, true);
    assert.ok(fitted.text.endsWith("…"));
    assert.ok(font.widthOfTextAtSize(fitted.text, 10) <= 60);
  });

  it("never spills past the box, even at the minimum shrink size", () => {
    const value = "x".repeat(200);
    const fitted = fitTextToBox(value, font, 10, 50, 12, false);
    assert.ok(font.widthOfTextAtSize(fitted.text, fitted.size) <= 50);
  });
});

describe("wrapTextToBox", () => {
  it("keeps line breaks and wraps long lines", () => {
    const fitted = wrapTextToBox("Flat 2\n12 High Street, Camden, London", font, 10, 90, 100, true);
    assert.equal(fitted.lines[0], "Flat 2");
    assert.ok(fitted.lines.length >= 3);
    for (const line of fitted.lines) assert.ok(font.widthOfTextAtSize(line, fitted.size) <= 90);
    assert.equal(fitted.truncated, false);
  });

  it("cuts to the lines the box can hold and marks it truncated", () => {
    const fitted = wrapTextToBox("one\ntwo\nthree\nfour", font, 10, 200, 24, true);
    assert.equal(fitted.lines.length, 2);
    assert.ok(fitted.lines[1].endsWith("…"));
    assert.equal(fitted.truncated, true);
  });

  it("shrinks instead of cutting when truncation is off", () => {
    const fitted = wrapTextToBox("one\ntwo\nthree", font, 12, 200, 30, false);
    assert.equal(fitted.lines.length, 3);
    assert.ok(fitted.size < 12);
    assert.equal(fitted.truncated, false);
  });

  it("breaks a single word wider than the box", () => {
    const fitted = wrapTextToBox("Supercalifragilisticexpialidocious", font, 10, 40, 200, true);
    assert.ok(fitted.lines.length > 1);
    for (const line of fitted.lines) assert.ok(font.widthOfTextAtSize(line, 10) <= 40);
  });
});
