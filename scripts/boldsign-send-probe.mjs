// BoldSign send probe — Phase 2 contract check
// (see docs/boldsign-integration-plan.md §2).
//
// Settles the one thing that can't be reasoned about from the SDK types:
// whether FormField.bounds uses a TOP-LEFT origin (like Harbor Ops'
// contract_template_fields) or a bottom-left one (like pdf-lib). Get this wrong
// and every signature box lands at the wrong end of the page.
//
//   npm run boldsign:send-probe
//
// Sends a one-page test PDF with two markers — "TOP MARKER" printed near the
// top of the page and "BOTTOM MARKER" near the bottom — and places a signature
// field at y=90, i.e. just under the TOP marker if the origin is top-left.
//
//   Open the document in the BoldSign sandbox and look at where the signature
//   box landed:
//     next to TOP MARKER     -> top-left origin, map Harbor Ops coords straight through
//     next to BOTTOM MARKER  -> bottom-left origin, y must be flipped:
//                               y_boldsign = pageHeight - y_harborops - height
//
// Safe to run: it sets disableEmails so no recipient is contacted, and
// isSandbox so nothing counts as a real agreement. Documents pile up in the
// sandbox account and can be deleted from the BoldSign UI.
//
// Requires BOLDSIGN_API_KEY in .env.local. The signer address defaults to
// test@example.com — an IANA-reserved domain that cannot receive mail. Override
// with BOLDSIGN_TEST_SIGNER_EMAIL, and set BOLDSIGN_PROBE_SEND_EMAIL=1 to
// actually deliver the request (that is what closes the Phase 2 acceptance
// criterion, and it emails a real person, so it is opt-in).

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const EU_HOST = "https://api-eu.boldsign.com";

const PAGE_WIDTH = 595; // A4 portrait, points
const PAGE_HEIGHT = 842;

const FIELD = { x: 60, y: 90, width: 180, height: 40 };

async function buildTestPdf() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);

  // pdf-lib's origin is bottom-left, so "near the top" is a HIGH y here.
  page.drawText("TOP MARKER — signature box should be just below this line", {
    x: 60,
    y: PAGE_HEIGHT - 60,
    size: 11,
    font,
    color: rgb(0.8, 0, 0),
  });
  page.drawText("BOTTOM MARKER — if the box is here, the origin is bottom-left", {
    x: 60,
    y: 60,
    size: 11,
    font,
    color: rgb(0, 0, 0.8),
  });

  return Buffer.from(await pdf.save());
}

async function main() {
  const apiKey = process.env.BOLDSIGN_API_KEY?.trim();
  const host = (process.env.BOLDSIGN_HOST?.trim() || EU_HOST).replace(/\/+$/, "");
  const signerEmail = process.env.BOLDSIGN_TEST_SIGNER_EMAIL?.trim() || "test@example.com";
  const deliver = process.env.BOLDSIGN_PROBE_SEND_EMAIL === "1";

  if (!apiKey) {
    console.error("Set BOLDSIGN_API_KEY in .env.local first.");
    return 1;
  }

  const { DocumentApi, SendForSign, DocumentSigner, FormField, Rectangle } = await import("boldsign");

  const pdf = await buildTestPdf();

  const bounds = new Rectangle();
  bounds.x = FIELD.x;
  bounds.y = FIELD.y;
  bounds.width = FIELD.width;
  bounds.height = FIELD.height;

  const field = new FormField();
  field.fieldType = FormField.FieldTypeEnum.Signature;
  field.pageNumber = 1;
  field.bounds = bounds;
  field.isRequired = true;

  const signer = new DocumentSigner();
  signer.name = "Coordinate Probe";
  signer.emailAddress = signerEmail;
  signer.signerType = DocumentSigner.SignerTypeEnum.Signer;
  signer.formFields = [field];

  const request = new SendForSign();
  request.title = "Harbor Ops coordinate probe";
  request.message = "Test document. Not a real agreement.";
  request.signers = [signer];
  request.files = [
    { value: pdf, options: { filename: "coordinate-probe.pdf", contentType: "application/pdf" } },
  ];
  request.isSandbox = true;
  request.disableEmails = !deliver;
  request.metaData = { source: "harbor-ops-probe", purpose: "coordinate-origin" };

  console.log(`host:        ${host}`);
  console.log(`page:        ${PAGE_WIDTH} x ${PAGE_HEIGHT} pt`);
  console.log(`field:       x=${FIELD.x} y=${FIELD.y} w=${FIELD.width} h=${FIELD.height}`);
  console.log(`signer:      ${signerEmail}`);
  console.log(`emails:      ${deliver ? "ENABLED — a real request will be delivered" : "disabled"}`);
  console.log("");

  const api = new DocumentApi(host);
  api.setApiKey(apiKey);

  let documentId;
  try {
    const created = await api.sendDocument(request);
    documentId = created.documentId;
  } catch (err) {
    console.error("FAIL — send rejected:", err.statusCode ?? "", err.body?.error ?? err.message);
    return 1;
  }

  console.log(`PASS — document created: ${documentId}`);

  // Read the field back: if BoldSign echoes bounds, that alone may settle the
  // origin without needing to eyeball the document.
  try {
    const props = await api.getProperties(documentId);
    const echoed = props.formFields?.[0]?.bounds ?? props.signerDetails?.[0]?.formFields?.[0]?.bounds;
    if (echoed) {
      console.log(`bounds echoed back: ${JSON.stringify(echoed)}`);
      if (echoed.y !== undefined && echoed.y !== FIELD.y) {
        console.log(
          `NOTE: y came back as ${echoed.y}, not ${FIELD.y}. ` +
            `${PAGE_HEIGHT} - ${FIELD.y} - ${FIELD.height} = ${PAGE_HEIGHT - FIELD.y - FIELD.height}` +
            ` — if that matches, the origin is bottom-left.`
        );
      }
    } else {
      console.log("bounds not echoed by getProperties — check the document visually.");
    }
  } catch (err) {
    console.log("(getProperties failed:", err.body?.error ?? err.message, ")");
  }

  console.log("");
  console.log("Now open the document in the BoldSign sandbox and check which marker");
  console.log("the signature box sits next to. See the header of this file.");

  return 0;
}

process.exitCode = await main();
