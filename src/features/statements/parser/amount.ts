export function toPence(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;

  const cleaned = str.replace(/[£$\s,]/g, "");
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;

  return Math.round(num * 100);
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

export function parseUkDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;

  const slash = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]) - 1;
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    const d = new Date(Date.UTC(year, month, day));
    return isFinite(d.getTime()) ? d : null;
  }

  const text = str.match(/^(\d{1,2})[\s\-]+([A-Za-z]+)[\s\-]+(\d{2,4})$/);
  if (text) {
    const day = Number(text[1]);
    const monthKey = text[2].toLowerCase().slice(0, 4);
    const monthCandidate = MONTHS[monthKey] ?? MONTHS[monthKey.slice(0, 3)];
    if (monthCandidate === undefined) return null;
    let year = Number(text[3]);
    if (year < 100) year += 2000;
    const d = new Date(Date.UTC(year, monthCandidate, day));
    return isFinite(d.getTime()) ? d : null;
  }

  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return isFinite(d.getTime()) ? d : null;
  }

  return null;
}
