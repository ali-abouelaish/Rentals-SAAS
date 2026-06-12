// Assert-based selftest for the import pipeline's normalization rules.
// Every case in section 5 of the import spec ("known data quality issues")
// must be caught. Run: node import/selftest.mjs

import assert from "node:assert/strict";
import { extractAvailability, normalizePhone, normalizeEmail, normalizeDob, normalizePcm, classifyContractCell } from "./lib/normalize.mjs";
import { normPostcode, parseDmy, parseDMonY, titleCaseName, fuzzyNameMatch, slugify } from "./lib/util.mjs";
import { findDates, extractContractDates } from "./lib/contracts.mjs";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`ok ${n}  ${name}`); };

// --- Available column extractor (section 4) ---
t("NOW", () => assert.deepEqual(extractAvailability({ text: "NOW" }), { status: "NOW", endDate: null, relet: false, marketed: false, raw: "NOW" }));
t("NOW-BOOKED", () => assert.equal(extractAvailability({ text: "NOW-BOOKED" }).relet, true));
t("BOOKED", () => assert.equal(extractAvailability({ text: "BOOKED" }).status, "BOOKED"));
t("ROLLING", () => assert.equal(extractAvailability({ text: "ROLLING" }).status, "ROLLING"));
t("TBC", () => assert.equal(extractAvailability({ text: "TBC" }).status, "TBC"));
t("plain date", () => assert.deepEqual(extractAvailability({ text: "25 Jun 2026" }), { status: "DATE", endDate: "2026-06-25", relet: false, marketed: false, raw: "25 Jun 2026" }));
t("date-typed cell", () => assert.equal(extractAvailability({ text: "25 Jun 2026", iso: "2026-06-25" }).endDate, "2026-06-25"));
t("date-BOOKED", () => {
  const r = extractAvailability({ text: "16 Jun 2026-BOOKED" });
  assert.equal(r.endDate, "2026-06-16"); assert.equal(r.relet, true);
});
t("date(Available)", () => {
  const r = extractAvailability({ text: "18 Jun 2026(Available)" });
  assert.equal(r.endDate, "2026-06-18"); assert.equal(r.relet, false); assert.equal(r.marketed, true);
});
t("date( Available) stray space", () => assert.equal(extractAvailability({ text: "9 Jul 2026( Available)" }).endDate, "2026-07-09"));
t("date (Renew)", () => {
  const r = extractAvailability({ text: "30 Jun 2026 (Renew)" });
  assert.equal(r.status, "RENEW"); assert.equal(r.endDate, "2026-06-30");
});
t("garbage -> null", () => assert.equal(extractAvailability({ text: "whenever" }), null));

// --- Phones (issue 5) ---
t("bare UK mobile 7745192286", () => assert.equal(normalizePhone("7745192286").phone, "+447745192286"));
t("44 prefix", () => assert.equal(normalizePhone("44 7983864421").phone, "+447983864421"));
t("0044 prefix", () => assert.equal(normalizePhone("0044 7780071311").phone, "+447780071311"));
t("07… UK standard", () => assert.equal(normalizePhone("07512571350").phone, "+447512571350"));
t("Turkish 905415879747", () => assert.equal(normalizePhone("905415879747").phone, "+905415879747"));
t("French 33 7 81 79 01 78", () => assert.equal(normalizePhone("33 7 81 79 01 78").phone, "+33781790178"));
t("Irish 353 876618600", () => assert.equal(normalizePhone("353 876618600").phone, "+353876618600"));
t("dual slash 447562291413/+525585347092", () => {
  const r = normalizePhone("447562291413/+525585347092");
  assert.equal(r.phone, "+447562291413"); assert.equal(r.whatsapp, "+525585347092");
  assert.ok(r.issues.some((i) => i.category === "phone_multi"));
});
t("dual slash with spaces 44 7561 489798 / +91 9633999507", () => {
  const r = normalizePhone("44 7561 489798 / +91 9633999507");
  assert.equal(r.phone, "+447561489798"); assert.equal(r.whatsapp, "+919633999507");
});
t("date-shaped phone 1/18/1989 nulled", () => {
  const r = normalizePhone("1/18/1989");
  assert.equal(r.phone, null);
  assert.ok(r.issues.some((i) => i.category === "phone_date_shaped"));
});
t("ambiguous 689192243 kept raw + flagged", () => {
  const r = normalizePhone("689192243");
  assert.equal(r.phone, "689192243");
  assert.ok(r.issues.some((i) => i.category === "phone_invalid"));
});

// --- Emails (issue 7) ---
t(".con fixed via map", () => {
  const r = normalizeEmail("sofia.alekseemko16@gmail.con");
  assert.equal(r.email, "sofia.alekseemko16@gmail.com");
  assert.ok(r.issues.some((i) => i.category === "email_fixed"));
});
t("valid email passes", () => assert.equal(normalizeEmail("Maisie.b552@gmail.com").email, "maisie.b552@gmail.com"));
t("invalid email flagged", () => {
  const r = normalizeEmail("not-an-email");
  assert.equal(r.email, null);
  assert.ok(r.issues.some((i) => i.category === "email_invalid"));
});

// --- DOB (issue 6) ---
t("valid DOB 11/11/2000", () => assert.equal(normalizeDob("11/11/2000").dob, "2000-11-11"));
t("future-ish DOB 01/08/2024 (under 16) flagged + nulled", () => {
  const r = normalizeDob("01/08/2024");
  assert.equal(r.dob, null);
  assert.ok(r.issues.some((i) => i.category === "dob_invalid"));
});
t("unparseable DOB flagged", () => assert.equal(normalizeDob("99/99/1999").dob, null));

// --- Names (issue 8) ---
t("romain -> Romain", () => assert.equal(titleCaseName("romain"), "Romain"));
t("Leah pidgeon -> Leah Pidgeon", () => assert.equal(titleCaseName("Leah pidgeon"), "Leah Pidgeon"));
t("ALL CAPS name", () => assert.equal(titleCaseName("JERLIN MICHELLE IMMANUEL JEBASINGH"), "Jerlin Michelle Immanuel Jebasingh"));
t("particles: edouard de pouilly", () => assert.equal(titleCaseName("edouard de pouilly"), "Edouard de Pouilly"));

// --- PCM / dual rent (question 4 default) ---
t("£1,100 -> 1100", () => assert.equal(normalizePcm({ text: "£1,100" }).rent, 1100));
t("dual £1,120 / £1,160", () => {
  const r = normalizePcm({ text: "£1,120 / £1,160" });
  assert.equal(r.rent, 1120); assert.equal(r.min, 1120); assert.equal(r.max, 1160); assert.equal(r.dual, true);
  assert.ok(r.issues.some((i) => i.category === "dual_rent"));
});

// --- Contract cell classification (section 4) ---
t("pdf filename cell", () => {
  const r = classifyContractCell({ text: "trundleys d1 (2) - signed.pdf", link: "https://drive.google.com/file/d/1e6qRuWU5hv1kqjpvhP2b1MSp3X0_exB2/view?usp=share_link" });
  assert.equal(r.kind, "pdf"); assert.equal(r.driveFileId, "1e6qRuWU5hv1kqjpvhP2b1MSp3X0_exB2");
});
t("address cell with folder link", () => {
  const r = classifyContractCell({ text: "129 Boundaries Road, SW12 8EU", link: "https://drive.google.com/drive/folders/1SwgJL6MgmBLmpQ-scBs8Y9N5nMZhOwAs?usp=drive_link" });
  assert.equal(r.kind, "address"); assert.equal(r.headAddress, "129 Boundaries Road, SW12 8EU");
});
t("address-shaped cell that links a PDF is treated as pdf", () => {
  const r = classifyContractCell({ text: "15 Everard House, E1 1LY", link: "https://drive.google.com/file/d/abc123/view" });
  assert.equal(r.kind, "pdf"); assert.equal(r.driveFileId, "abc123");
});

// --- util ---
t("postcode normalize", () => assert.equal(normPostcode("sw128eu"), "SW12 8EU"));
t("fuzzy: John Silikin vs John Silkin", () => assert.ok(fuzzyNameMatch("John Silikin Lane", "John Silkin Lane")));
t("fuzzy: Everard trailing space", () => assert.ok(fuzzyNameMatch("Everard House ", "Everard House")));
t("parseDMonY", () => assert.equal(parseDMonY("9 Jul 2026"), "2026-07-09"));
t("parseDmy", () => assert.equal(parseDmy("14/02/2001"), "2001-02-14"));
t("slugify", () => assert.equal(slugify("St Michael's Street"), "st-michaels-street"));

// --- contract date extraction ---
t("findDates ordinal", () => assert.equal(findDates("commencing on the 1st July 2025 for")[0].iso, "2025-07-01"));
t("findDates dd/mm/yyyy", () => assert.equal(findDates("from 01/07/2025 until")[0].iso, "2025-07-01"));
t("extract start near commencement", () => {
  const r = extractContractDates("THIS AGREEMENT ... The tenancy commencing on 15th June 2025 and ending on 14th June 2026 ...");
  assert.equal(r.startDate, "2025-06-15");
  assert.equal(r.endDate, "2026-06-14");
  assert.equal(r.confidence, "high");
});
t("no keyword near date -> none", () => {
  const r = extractContractDates(`signed on ${" x".repeat(300)} 01/07/2025`);
  assert.equal(r.startDate, null); assert.equal(r.confidence, "none");
});

console.log(`\nAll ${n} selftests passed.`);
