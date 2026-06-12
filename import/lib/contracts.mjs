// Stage 3: download the signed contract PDFs linked from the Contract column,
// extract tenancy start dates from the AST text, and cross-check end dates
// against the parsed Available column. Tenancies whose start date cannot be
// extracted with confidence go on the manual entry list — dates are never guessed.

import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import { CONTRACTS_DIR, START_DATE_KEYWORDS, KEYWORD_WINDOW } from "../config.mjs";
import { monthNum, isoDate, isValidDateParts } from "./util.mjs";

const END_DATE_KEYWORDS = ["until", "ending", "end date", "ends", "expiry", "expiring", "expires", "to and including", " to "];

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9 ._()-]/g, "_");
}

async function downloadDriveFile(fileId, destPath) {
  const urls = [
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
  ];
  for (const url of urls) {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 5).toString("latin1").startsWith("%PDF")) {
      writeFileSync(destPath, buf);
      return { ok: true };
    }
    // HTML interstitial (virus-scan page) — try the next URL form.
  }
  return { ok: false, error: "no PDF content returned (file may not be shared publicly)" };
}

// Find all date-shaped substrings with their offsets. UK conventions.
export function findDates(text) {
  const out = [];
  const push = (index, iso, matched) => { if (iso) out.push({ index, iso, matched }); };

  // "1st July 2025" / "1 July 2025" / "01 day of July 2025"
  const re1 = /(\d{1,2})(?:st|nd|rd|th)?(?:\s+day\s+of)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?,?\s+(\d{4})/gi;
  for (const m of text.matchAll(re1)) {
    const d = Number(m[1]), mo = monthNum(m[2]), y = Number(m[3]);
    if (mo && isValidDateParts(y, mo, d)) push(m.index, isoDate(y, mo, d), m[0]);
  }
  // "July 1st, 2025"
  const re2 = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/gi;
  for (const m of text.matchAll(re2)) {
    const mo = monthNum(m[1]), d = Number(m[2]), y = Number(m[3]);
    if (mo && isValidDateParts(y, mo, d)) push(m.index, isoDate(y, mo, d), m[0]);
  }
  // "01/07/2025" (DD/MM/YYYY)
  const re3 = /(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/g;
  for (const m of text.matchAll(re3)) {
    const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
    if (isValidDateParts(y, mo, d)) push(m.index, isoDate(y, mo, d), m[0]);
  }
  // ISO "2025-07-01"
  const re4 = /(\d{4})-(\d{2})-(\d{2})/g;
  for (const m of text.matchAll(re4)) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (isValidDateParts(y, mo, d)) push(m.index, isoDate(y, mo, d), m[0]);
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

// Extract {startDate, endDate, confidence, matchedText} from contract text.
export function extractContractDates(text) {
  const lower = text.toLowerCase();
  const dates = findDates(text);
  if (!dates.length) return { startDate: null, endDate: null, confidence: "none", matchedText: null };

  const keywordHits = (keywords) => {
    const hits = [];
    for (const kw of keywords) {
      let i = 0;
      while ((i = lower.indexOf(kw, i)) !== -1) { hits.push({ kw, index: i }); i += kw.length; }
    }
    return hits;
  };

  const pickNear = (hits, strongKws) => {
    let best = null;
    for (const d of dates) {
      for (const h of hits) {
        const dist = Math.abs(d.index - h.index);
        if (dist > KEYWORD_WINDOW) continue;
        const strong = strongKws.some((k) => h.kw.includes(k));
        const score = dist - (strong ? 100 : 0);
        if (!best || score < best.score) {
          best = { date: d.iso, score, kw: h.kw, dist, strong, matched: d.matched };
        }
      }
    }
    return best;
  };

  const start = pickNear(keywordHits(START_DATE_KEYWORDS), ["commenc", "start", "begin", "move"]);
  const end = pickNear(keywordHits(END_DATE_KEYWORDS), ["until", "end", "expir"]);

  let endDate = end?.date ?? null;
  if (endDate && start?.date && endDate <= start.date) endDate = null; // picked the same/earlier date — not an end date

  return {
    startDate: start?.date ?? null,
    endDate,
    confidence: start ? (start.strong && start.dist <= KEYWORD_WINDOW / 2 ? "high" : "medium") : "none",
    matchedText: start ? `keyword "${start.kw}" → ${start.matched} (distance ${start.dist})` : null,
  };
}

async function pdfText(filePath) {
  const parser = new PDFParse({ data: new Uint8Array(readFileSync(filePath)) });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy?.();
  }
}

// graph -> contract extraction results, mutating tenancies with startDate/expiry.
export async function runContractStage(graph, { skipDownload = false } = {}) {
  mkdirSync(CONTRACTS_DIR, { recursive: true });
  const results = [];
  const manualEntry = [];

  const tenantsByKey = new Map(graph.tenants.map((t) => [t.key, t]));
  const roomsByKey = new Map(graph.rooms.map((r) => [r.key, r]));
  const propsByKey = new Map(graph.properties.map((p) => [p.key, p]));

  for (const tenancy of graph.tenancies) {
    const tenant = tenancy.tenantKey ? tenantsByKey.get(tenancy.tenantKey) : null;
    const room = roomsByKey.get(tenancy.roomKey);
    const prop = propsByKey.get(room?.propertyKey);
    const label = `${prop?.name ?? "?"} ${room?.roomCode ?? "?"}${tenant ? ` — ${tenant.fullName}` : " (no tenant)"}`;

    const c = tenancy.contract;
    if (!c || c.kind !== "pdf" || !c.driveFileId) {
      if (!tenancy.needsTenant) {
        manualEntry.push({
          tenancyKey: tenancy.key, sheetRow: tenancy.sheetRow, label,
          reason: c ? "contract cell is a head address, no signed PDF linked" : "no contract cell",
        });
      } else {
        manualEntry.push({
          tenancyKey: tenancy.key, sheetRow: tenancy.sheetRow, label,
          reason: "no tenant identity (needs_tenant) — AP must supply tenant details and contract",
        });
      }
      continue;
    }

    // Cache key includes the Drive file id — two different files sharing a
    // display name must not cross-contaminate.
    const fileName = sanitizeFilename(`${c.driveFileId}_${c.fileRef ?? "contract"}`);
    const localPath = path.join(CONTRACTS_DIR, fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
    const rec = {
      tenancyKey: tenancy.key, sheetRow: tenancy.sheetRow, label,
      fileRef: c.fileRef ?? null, driveFileId: c.driveFileId, localPath,
      downloaded: false, startDate: null, endDate: null, confidence: "none",
      tenantNameFound: null, issues: [],
    };

    if (!existsSync(localPath)) {
      if (skipDownload) {
        rec.issues.push("download skipped (--skip-download) and no local copy present");
        results.push(rec);
        manualEntry.push({ tenancyKey: tenancy.key, sheetRow: tenancy.sheetRow, label, reason: "PDF not downloaded" });
        continue;
      }
      const dl = await downloadDriveFile(c.driveFileId, localPath);
      if (!dl.ok) {
        rec.issues.push(`download failed: ${dl.error}`);
        results.push(rec);
        manualEntry.push({ tenancyKey: tenancy.key, sheetRow: tenancy.sheetRow, label, reason: `PDF download failed (${dl.error})` });
        continue;
      }
    }
    rec.downloaded = true;

    let text = "";
    try {
      text = await pdfText(localPath);
    } catch (e) {
      rec.issues.push(`PDF text extraction failed: ${e.message}`);
      results.push(rec);
      manualEntry.push({ tenancyKey: tenancy.key, sheetRow: tenancy.sheetRow, label, reason: "PDF unreadable" });
      continue;
    }

    const { startDate, endDate, confidence, matchedText } = extractContractDates(text);
    rec.startDate = startDate;
    rec.endDate = endDate;
    rec.confidence = confidence;
    rec.matchedText = matchedText;

    // Sanity: does the tenant's name appear in the contract?
    if (tenant) {
      const tokens = tenant.fullName.toLowerCase().split(" ").filter((t) => t.length >= 3);
      const found = tokens.filter((t) => text.toLowerCase().includes(t));
      rec.tenantNameFound = found.length > 0;
      if (!rec.tenantNameFound) {
        rec.issues.push(`tenant name "${tenant.fullName}" not found in PDF text — verify the right contract is linked`);
      }
    }

    // Cross-check contract end date vs sheet Available end date.
    if (rec.endDate && tenancy.endDate && rec.endDate !== tenancy.endDate) {
      rec.issues.push(`contract end ${rec.endDate} != sheet availability date ${tenancy.endDate}`);
    }

    if (startDate && confidence !== "none" && rec.tenantNameFound !== false) {
      tenancy.startDate = startDate;
      tenancy.startDateSource = `pdf:${rec.fileRef ?? rec.driveFileId} (${confidence})`;
      tenancy.contractEndDateFromPdf = rec.endDate;
      tenancy.tenantNameInPdf = rec.tenantNameFound;
      tenancy.contractLocalPath = localPath;
    } else if (startDate && rec.tenantNameFound === false) {
      // A date extracted from a PDF that never names the tenant is not a
      // confident extraction — manual entry, never guessed.
      manualEntry.push({
        tenancyKey: tenancy.key, sheetRow: tenancy.sheetRow, label,
        reason: `start date ${startDate} found in "${rec.fileRef ?? rec.driveFileId}" but the tenant's name does not appear in the PDF — verify manually`,
      });
    } else {
      manualEntry.push({
        tenancyKey: tenancy.key, sheetRow: tenancy.sheetRow, label,
        reason: `start date not confidently extractable from "${rec.fileRef ?? rec.driveFileId}"`,
      });
    }
    results.push(rec);
  }

  return { results, manualEntry };
}
