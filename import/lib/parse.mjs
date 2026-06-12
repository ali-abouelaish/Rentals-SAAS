// Stage 1: parse the workbook into raw row objects with sheet row numbers and
// hyperlink targets. No normalization here — that's stage 2.

import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { AP_COLUMNS, HORIZON_COLUMNS, KEYBOX_COLUMNS, PORTFOLIOS } from "../config.mjs";
import { dateToIso, normSpace, parseDMonY } from "./util.mjs";

function cellAt(ws, r, c) {
  return ws[XLSX.utils.encode_cell({ r, c })] ?? null;
}

// Raw cell -> { text, iso (if date-typed), link } | null
function readCell(ws, r, c) {
  const cell = cellAt(ws, r, c);
  if (!cell || cell.v == null) return null;
  const out = {};
  if (cell.v instanceof Date) {
    out.iso = dateToIso(cell.v);
    out.text = normSpace(cell.w ?? out.iso);
    // The formatted text is what staff see — if it parses and disagrees with
    // the Date object (timezone skew), the text wins.
    const fromText = parseDMonY(out.text);
    if (fromText && fromText !== out.iso) out.iso = fromText;
  } else {
    out.text = normSpace(String(cell.w ?? cell.v));
  }
  if (out.text === "") return null;
  if (cell.l?.Target) out.link = cell.l.Target;
  return out;
}

function rowIsEmpty(ws, r, cols) {
  return cols.every((c) => readCell(ws, r, c) == null);
}

function findBanner(ws, range, needle, excludeNeedle) {
  // The row-2 subtitle names BOTH companies — a section banner is a row that
  // mentions this company and not the other one.
  const lower = needle.toLowerCase();
  const exclude = excludeNeedle?.toLowerCase();
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cell = readCell(ws, r, 0);
    if (!cell) continue;
    const text = cell.text.toLowerCase();
    if (text.includes(lower) && !(exclude && text.includes(exclude))) return r;
  }
  return -1;
}

function readRowObject(ws, r, columns) {
  const row = { sheetRow: r + 1, cells: {} };
  for (const [field, c] of Object.entries(columns)) {
    const cell = readCell(ws, r, c);
    if (cell) row.cells[field] = cell;
  }
  return row;
}

function parsePortfolioTab(ws) {
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const apBanner = findBanner(ws, range, PORTFOLIOS.AP.sheetBanner, PORTFOLIOS.HORIZON.sheetBanner);
  const hzBanner = findBanner(ws, range, PORTFOLIOS.HORIZON.sheetBanner, PORTFOLIOS.AP.sheetBanner);
  if (apBanner < 0 || hzBanner < 0) {
    throw new Error(
      `Section banners not found in Property Portfolio tab (AP at ${apBanner}, Horizon at ${hzBanner}). ` +
      `Sheet structure changed — update config.mjs banner strings.`,
    );
  }
  if (hzBanner <= apBanner) throw new Error("Horizon banner found above AP banner — unexpected layout.");

  const sections = { ap: [], horizon: [] };
  const structural = [];

  // AP section: rows between banners, positional columns, no header row.
  for (let r = apBanner + 1; r < hzBanner; r++) {
    const property = readCell(ws, r, AP_COLUMNS.property);
    const room = readCell(ws, r, AP_COLUMNS.room);
    if (!property && !room) {
      if (!rowIsEmpty(ws, r, Object.values(AP_COLUMNS))) {
        structural.push({ sheetRow: r + 1, note: "non-empty row inside AP section without property/room — skipped" });
      }
      continue;
    }
    sections.ap.push(readRowObject(ws, r, AP_COLUMNS));
  }

  // Horizon section: a header row is expected right under the banner.
  let dataStart = hzBanner + 1;
  const maybeHeader = readCell(ws, hzBanner + 1, 0);
  let headerVerified = false;
  if (maybeHeader && maybeHeader.text === "#") {
    headerVerified = true;
    dataStart = hzBanner + 2;
  } else {
    structural.push({ sheetRow: hzBanner + 2, note: "expected Horizon header row starting with '#' — not found, parsing positionally" });
  }

  for (let r = dataStart; r <= range.e.r; r++) {
    const property = readCell(ws, r, HORIZON_COLUMNS.property);
    const room = readCell(ws, r, HORIZON_COLUMNS.room);
    if (!property && !room) {
      if (!rowIsEmpty(ws, r, Object.values(HORIZON_COLUMNS))) {
        structural.push({ sheetRow: r + 1, note: "non-empty row inside Horizon section without property/room — skipped" });
      }
      continue;
    }
    sections.horizon.push(readRowObject(ws, r, HORIZON_COLUMNS));
  }

  return { sections, structural, headerVerified, apBannerRow: apBanner + 1, horizonBannerRow: hzBanner + 1 };
}

function parseKeyboxTab(ws) {
  if (!ws?.["!ref"]) return { rows: [], structural: [{ note: "Keybox Codes tab empty or missing" }] };
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const rows = [];
  const structural = [];
  let company = null;
  for (let r = range.s.r; r <= range.e.r; r++) {
    const a = readCell(ws, r, KEYBOX_COLUMNS.rowNum);
    const address = readCell(ws, r, KEYBOX_COLUMNS.address);
    const code = readCell(ws, r, KEYBOX_COLUMNS.code);
    const companyCell = readCell(ws, r, KEYBOX_COLUMNS.company);
    if (a && /AP REAL ESTATE/i.test(a.text)) { company = "ap"; continue; }
    if (a && /HORIZON DREAMS/i.test(a.text)) { company = "horizon"; continue; }
    if (a && a.text === "#") continue; // header row
    if (!address || !code) {
      if (a || address || code) structural.push({ sheetRow: r + 1, note: `keybox row without address+code — skipped (${a?.text ?? ""} ${address?.text ?? ""})` });
      continue;
    }
    rows.push({
      sheetRow: r + 1,
      company: companyCell?.text?.toLowerCase().includes("horizon") ? "horizon" : companyCell ? "ap" : company,
      address: address.text,
      code: code.text,
    });
  }
  return { rows, structural };
}

// Agent Info is free-form; harvest label/value pairs per company section and
// dump everything raw for human review.
function parseAgentInfoTab(ws) {
  if (!ws?.["!ref"]) return { sections: {}, raw: [], structural: [{ note: "Agent Info tab empty or missing" }] };
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const raw = [];
  const sections = { ap: { bank: [], links: [] }, horizon: { bank: [], links: [] } };
  let company = null;
  let currentBank = null;
  for (let r = range.s.r; r <= range.e.r; r++) {
    const a = readCell(ws, r, 0);
    const b = readCell(ws, r, 1);
    const c = readCell(ws, r, 2);
    if (!a && !b && !c) { currentBank = null; continue; }
    raw.push({ sheetRow: r + 1, a: a?.text ?? null, b: b?.text ?? null, c: c?.text ?? null, link: c?.link ?? b?.link ?? null });
    if (a && /AP REAL ESTATE/i.test(a.text)) { company = "ap"; continue; }
    if (a && /HORIZON DREAMS/i.test(a.text)) { company = "horizon"; continue; }
    if (!company) continue;
    if (b && !c) {
      // A bank name line ("Lloyds Business Banking", "Monzo (...)", "Barclays")
      currentBank = { bank: b.text, fields: {} };
      sections[company].bank.push(currentBank);
      continue;
    }
    if (b && c) {
      if (/form link/i.test(b.text) || c.link) {
        sections[company].links.push({ label: b.text, value: c.text, link: c.link ?? null });
      }
      if (currentBank) currentBank.fields[b.text] = c.text;
    }
  }
  return { sections, raw };
}

export function parseWorkbook(filePath) {
  const wb = XLSX.read(readFileSync(filePath), { cellDates: true, cellNF: true, cellText: true });
  const tabs = wb.SheetNames;
  const expect = ["Property Portfolio", "Keybox Codes", "Agent Info"];
  const missing = expect.filter((t) => !tabs.includes(t));

  const portfolio = parsePortfolioTab(wb.Sheets["Property Portfolio"]);
  const keybox = parseKeyboxTab(wb.Sheets["Keybox Codes"]);
  const agentInfo = parseAgentInfoTab(wb.Sheets["Agent Info"]);
  const unknownTabs = tabs.filter((t) => !expect.includes(t));

  return {
    file: filePath,
    tabs,
    missingTabs: missing,
    unknownTabs,
    portfolio,
    keybox,
    agentInfo,
  };
}
