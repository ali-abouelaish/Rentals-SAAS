// Pure helpers for pro-rated first-month rent.
// Convention: pro-rata covers `start_date` through the last day of the move-in
// month. The next full calendar month is paid in advance as a normal
// rent_payments row. Regular cycle resumes from the month after.

function parseUtcDate(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

export function daysInMonthUtc(year: number, monthIndex0: number): number {
  // Day 0 of next month = last day of this month.
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

export function proRataDayCount(startDate: string): number {
  const d = parseUtcDate(startDate);
  if (Number.isNaN(d.getTime())) return 0;
  const total = daysInMonthUtc(d.getUTCFullYear(), d.getUTCMonth());
  return total - d.getUTCDate() + 1;
}

export function suggestProRata(startDate: string, rentPcm: number): number {
  const d = parseUtcDate(startDate);
  if (Number.isNaN(d.getTime()) || !Number.isFinite(rentPcm) || rentPcm <= 0) {
    return 0;
  }
  const total = daysInMonthUtc(d.getUTCFullYear(), d.getUTCMonth());
  const remaining = total - d.getUTCDate() + 1;
  if (remaining <= 0 || total <= 0) return 0;
  // Round to 2dp so the form shows clean money.
  return Math.round((rentPcm / total) * remaining * 100) / 100;
}

// First day of the calendar month *after* the move-in month, as YYYY-MM-DD.
export function firstFullMonthStart(startDate: string): string {
  const d = parseUtcDate(startDate);
  if (Number.isNaN(d.getTime())) return startDate;
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return next.toISOString().slice(0, 10);
}

export function inclusiveMonthsBetween(startIso: string, endIso: string): number {
  const start = parseUtcDate(startIso);
  const end = parseUtcDate(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end < start) return 0;
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1
  );
}

// Expected total rent at `endDate`, given the contract's start, monthly rent,
// and optional pro-rata for the first partial period.
export function expectedRent(
  startDate: string,
  endDate: string,
  rentPcm: number,
  proRataAmount: number | null | undefined
): number {
  const hasProRata = proRataAmount != null;
  if (hasProRata) {
    const firstFull = firstFullMonthStart(startDate);
    const fullMonths = inclusiveMonthsBetween(firstFull, endDate);
    return Number(proRataAmount) + fullMonths * rentPcm;
  }
  return inclusiveMonthsBetween(startDate, endDate) * rentPcm;
}

export function isMoveInMonth(
  startDate: string,
  periodYear: number,
  periodMonth1: number
): boolean {
  const d = parseUtcDate(startDate);
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCFullYear() === periodYear && d.getUTCMonth() + 1 === periodMonth1;
}

export function endOfMoveInMonth(startDate: string): string {
  const d = parseUtcDate(startDate);
  if (Number.isNaN(d.getTime())) return startDate;
  const last = daysInMonthUtc(d.getUTCFullYear(), d.getUTCMonth());
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), last));
  return dt.toISOString().slice(0, 10);
}
