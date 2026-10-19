// Generate the binary fixtures the PM E2E run uploads.
//
//   node e2e/fixtures/build-fixtures.mjs
//
// Produces, in this directory:
//   sample-contract.pdf  — a one-page A4 PDF with a little text, for template
//                          upload / field placement / stamping checks.
//   sample-photo.png      — a small valid PNG, for room/property/work-order photo
//                          uploads and the passport-document check.
// The bank-statement CSV is checked in directly (sample-statement.csv); it is
// text and benefits from being readable in a diff.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const HERE = path.dirname(fileURLToPath(import.meta.url));

async function buildPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 in PDF points
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const lines = [
    ["Assured Shorthold Tenancy Agreement", bold, 18],
    ["This is a PM5- end-to-end test fixture. Not a real contract.", font, 11],
    ["", font, 11],
    ["Landlord: ____________________", font, 12],
    ["Tenant:   ____________________", font, 12],
    ["Property: ____________________", font, 12],
    ["Monthly rent: £ __________", font, 12],
    ["Deposit: £ __________", font, 12],
    ["Tenancy start date: __________", font, 12],
    ["", font, 11],
    ["Signature: ____________________   Date: __________", font, 12],
  ];
  let y = 790;
  for (const [text, f, size] of lines) {
    if (text) page.drawText(text, { x: 56, y, size, font: f, color: rgb(0.1, 0.1, 0.12) });
    y -= size + 10;
  }
  const bytes = await doc.save();
  fs.writeFileSync(path.join(HERE, "sample-contract.pdf"), bytes);
  return bytes.length;
}

// A minimal but valid 2x2 PNG (checker), base64-decoded. Small and real enough
// for any uploader/content-type check without pulling in an image library.
function buildPng() {
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mNk+M9Qz0BkYBxVSF0AAMzBA/3bs5GkAAAAAElFTkSuQmCC";
  const bytes = Buffer.from(b64, "base64");
  fs.writeFileSync(path.join(HERE, "sample-photo.png"), bytes);
  return bytes.length;
}

const pdfLen = await buildPdf();
const pngLen = buildPng();
console.log(`sample-contract.pdf  (${pdfLen} bytes)`);
console.log(`sample-photo.png     (${pngLen} bytes)`);
console.log("sample-statement.csv (checked in)");
