// BoldSign brand probe — Phase 5 check
// (see docs/boldsign-integration-plan.md §5).
//
// Proves the multi-agency mechanism: two agencies, two brands, two documents,
// each carrying its own agency's identity — and no per-agency seat cost, since
// brands are account-level objects rather than users.
//
//   npm run boldsign:brand-probe
//
// Creates two throwaway brands ("Probe Agency A/B") with different colours and
// logos, sends one document under each with emails disabled, then reads both
// documents back and checks each carries the right brandId. Cleans up the
// brands afterwards; the sandbox documents remain and can be deleted from the
// BoldSign UI.
//
// Requires BOLDSIGN_API_KEY in .env.local.

import { deflateSync, crc32 } from "node:zlib";
import { PDFDocument, StandardFonts } from "pdf-lib";

const EU_HOST = "https://api-eu.boldsign.com";

/** Minimal PNG encoder — a solid square, so each brand gets a distinct logo. */
function solidPng(size, [r, g, b]) {
  const chunk = (type, data) => {
    const typeBuf = Buffer.from(type, "latin1");
    const body = Buffer.concat([typeBuf, data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  // 10-12 default to 0: deflate, adaptive filtering, no interlace.

  // Each scanline is a filter byte followed by RGB triples.
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const p = rowStart + 1 + x * 3;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function onePagePdf(text) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 60, y: 700, size: 12, font });
  return Buffer.from(await pdf.save());
}

async function main() {
  const apiKey = process.env.BOLDSIGN_API_KEY?.trim();
  const host = (process.env.BOLDSIGN_HOST?.trim() || EU_HOST).replace(/\/+$/, "");
  if (!apiKey) {
    console.error("Set BOLDSIGN_API_KEY in .env.local first.");
    return 1;
  }

  const { BrandingApi, DocumentApi, SendForSign, DocumentSigner, FormField, Rectangle } =
    await import("boldsign");

  const branding = new BrandingApi(host);
  branding.setApiKey(apiKey);
  const documents = new DocumentApi(host);
  documents.setApiKey(apiKey);

  const agencies = [
    { name: "Probe Agency A", colour: "#0B5FFF", rgb: [11, 95, 255] },
    { name: "Probe Agency B", colour: "#C2185B", rgb: [194, 24, 91] },
  ];

  const created = [];
  const results = [];
  const check = (label, got, want) => {
    const pass = got === want;
    results.push(pass);
    console.log(`${pass ? "PASS" : "FAIL"}  ${label}${pass ? "" : ` -> got ${got}, want ${want}`}`);
  };

  try {
    // ── Create one brand per agency ──────────────────────────────
    for (const agency of agencies) {
      const logo = {
        value: solidPng(64, agency.rgb),
        options: { filename: "logo.png", contentType: "image/png" },
      };
      // createBrand(brandName, brandLogo, backgroundColor, buttonColor,
      //             buttonTextColor, emailDisplayName, ...)
      const brand = await branding.createBrand(
        agency.name,
        logo,
        undefined,
        agency.colour,
        undefined,
        agency.name
      );
      if (!brand.brandId) throw new Error(`No brandId returned for ${agency.name}`);
      created.push({ ...agency, brandId: brand.brandId });
      console.log(`created brand: ${agency.name} -> ${brand.brandId}`);
    }
    console.log("");

    // ── Send one document under each ─────────────────────────────
    for (const agency of created) {
      const bounds = new Rectangle();
      Object.assign(bounds, { x: 60, y: 90, width: 180, height: 40 });
      const field = new FormField();
      field.fieldType = FormField.FieldTypeEnum.Signature;
      field.pageNumber = 1;
      field.bounds = bounds;

      const signer = new DocumentSigner();
      signer.name = "Brand Probe";
      signer.emailAddress = "test@example.com";
      signer.signerType = DocumentSigner.SignerTypeEnum.Signer;
      signer.formFields = [field];

      const request = new SendForSign();
      request.title = `Brand probe — ${agency.name}`;
      request.signers = [signer];
      request.files = [
        {
          value: await onePagePdf(`Sent under ${agency.name}`),
          options: { filename: "brand-probe.pdf", contentType: "application/pdf" },
        },
      ];
      request.brandId = agency.brandId;
      request.isSandbox = true;
      request.disableEmails = true;

      const sent = await documents.sendDocument(request);
      agency.documentId = sent.documentId;
      console.log(`sent under ${agency.name}: ${sent.documentId}`);
    }
    console.log("");

    // ── Read back and confirm each carries its own brand ─────────
    for (const agency of created) {
      const props = await documents.getProperties(agency.documentId);
      check(`${agency.name} document carries its own brandId`, props.brandId, agency.brandId);
    }

    check(
      "the two documents carry different brands",
      created[0].brandId !== created[1].brandId,
      true
    );
  } catch (err) {
    // Mirrors src/lib/boldsign/errors.ts: a 400 rejects as a raw AxiosError,
    // where the detail lives in response.data rather than body.
    const status = err.statusCode ?? err.response?.status ?? "";
    const detail =
      err.response?.data?.error ?? err.body?.error ?? err.message ?? String(err);
    console.error(`FAILED: ${status} ${detail}`);
    results.push(false);
  } finally {
    // ── Clean up ─────────────────────────────────────────────────
    for (const brand of created) {
      try {
        await branding.deleteBrand(brand.brandId);
        console.log(`deleted brand ${brand.name}`);
      } catch (err) {
        console.warn(`could not delete brand ${brand.name}:`, err.body?.error ?? err.message);
      }
    }
  }

  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  return failed ? 1 : 0;
}

process.exitCode = await main();
