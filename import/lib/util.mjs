// Shared helpers for the portfolio import pipeline.

export function slugify(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normSpace(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

export function normPostcode(s) {
  const v = String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!v) return null;
  // UK postcodes: inward code is always 3 chars.
  if (v.length > 3) return `${v.slice(0, -3)} ${v.slice(-3)}`;
  return v;
}

export function titleCaseName(raw) {
  const s = normSpace(raw);
  if (!s) return s;
  const particles = new Set(["de", "da", "del", "der", "van", "von", "la", "le", "di", "dos", "el", "al", "bin"]);
  return s
    .split(" ")
    .map((w, i) => {
      const lw = w.toLowerCase();
      if (i > 0 && particles.has(lw)) return lw;
      if (/^[a-z]+$/i.test(w) && w.length <= 3 && w === w.toUpperCase() && i > 0) return w; // initials like SMK
      return lw.charAt(0).toUpperCase() + lw.slice(1);
    })
    .join(" ");
}

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
};

export function monthNum(name) {
  return MONTHS[String(name ?? "").toLowerCase()] ?? null;
}

export const isoDate = (y, m, d) =>
  `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function isValidDateParts(y, m, d) {
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// "DD/MM/YYYY" -> ISO date or null.
export function parseDmy(raw) {
  const m = String(raw ?? "").trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m.map(Number);
  if (y < 100) y += y > 30 ? 1900 : 2000;
  return isValidDateParts(y, mo, d) ? isoDate(y, mo, d) : null;
}

// "9 Jul 2026" / "01 Sep 2026" -> ISO or null.
export function parseDMonY(raw) {
  const m = String(raw ?? "").trim().match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = monthNum(m[2]);
  const y = Number(m[3]);
  return mo && isValidDateParts(y, mo, d) ? isoDate(y, mo, d) : null;
}

export function dateToIso(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  // SheetJS cellDates:true builds Dates from a LOCAL-time basedate (midnight
  // local). UTC accessors would land one day early on any UTC+ machine —
  // local accessors return the wall-clock date the cell displays.
  return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function yearsBetween(isoA, isoB) {
  const a = new Date(`${isoA}T00:00:00Z`);
  const b = new Date(`${isoB}T00:00:00Z`);
  return (b - a) / (365.25 * 24 * 3600 * 1000);
}

// "£1,100" / 1100 -> integer pounds; dual values handled by caller.
export function parseMoney(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return Math.round(raw);
  const v = String(raw).replace(/[£,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  return Math.round(Number(v));
}

export function levenshtein(a, b) {
  a = String(a); b = String(b);
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

// Loose name similarity for matching sheet properties to DB rows.
export function fuzzyNameMatch(a, b) {
  const sa = slugify(a), sb = slugify(b);
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  if (sa.includes(sb) || sb.includes(sa)) return true;
  return levenshtein(sa, sb) <= 2;
}

export function todayIso() {
  const now = new Date();
  return isoDate(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
}
