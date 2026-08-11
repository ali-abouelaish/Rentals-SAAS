// Europe/London wall-clock helpers. Every "what day is it" / "what hour is it"
// decision in the automations engine goes through these — never through
// server-local Date arithmetic — so BST/GMT switches are handled uniformly
// (same approach as isLondonNineAM in src/lib/cron/rentReminders.ts).

const TIMEZONE = "Europe/London";

const DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const PARTS_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** YYYY-MM-DD for the given instant in Europe/London. */
export function londonToday(now: Date = new Date()): string {
  return DAY_FMT.format(now);
}

/** Hour-of-day (0-23) for the given instant in Europe/London. */
export function londonHour(now: Date = new Date()): number {
  const part = PARTS_FMT.formatToParts(now).find((p) => p.type === "hour");
  return parseInt(part?.value ?? "0", 10) % 24;
}

/** Add whole days to a YYYY-MM-DD date string (pure calendar math, no TZ). */
export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

/**
 * Add whole months to a YYYY-MM-DD date string, clamping the day to the target
 * month's length (31 Jan + 1 month → 28/29 Feb).
 */
export function addMonthsISO(dateISO: string, months: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const total = m - 1 + months;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const utc = new Date(Date.UTC(ny, nm, Math.min(d, lastDay)));
  return utc.toISOString().slice(0, 10);
}

function londonPartsAsUtcMs(instant: Date): number {
  const parts = PARTS_FMT.formatToParts(instant);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
}

/**
 * The UTC instant at which the London wall clock reads `dateISO` at `hour`:00.
 * Two-pass offset probe, DST-safe. On a spring-forward day a nonexistent hour
 * (01:00 on switch night) converges to the closest real instant.
 */
export function londonWallTimeToUtc(dateISO: string, hour: number): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const desired = Date.UTC(y, m - 1, d, hour, 0);
  let utc = desired;
  for (let i = 0; i < 2; i++) {
    utc += desired - londonPartsAsUtcMs(new Date(utc));
  }
  return new Date(utc);
}

/** Start of the London calendar day containing `now`, as a UTC instant. */
export function londonStartOfDay(now: Date = new Date()): Date {
  return londonWallTimeToUtc(londonToday(now), 0);
}

export type SendWindow = { windowStart: number; windowEnd: number };

/** True when the instant's London hour is inside [windowStart, windowEnd). */
export function isWithinSendWindow(window: SendWindow, at: Date = new Date()): boolean {
  const h = londonHour(at);
  return h >= window.windowStart && h < window.windowEnd;
}

/**
 * The next instant the send window opens at or after `from`. If `from` is
 * before today's window it's today at windowStart; otherwise tomorrow.
 * (Instants inside the window also map to the NEXT open — call
 * isWithinSendWindow first when "now is fine" should win.)
 */
export function nextWindowOpen(window: SendWindow, from: Date = new Date()): Date {
  const today = londonToday(from);
  if (londonHour(from) < window.windowStart) {
    return londonWallTimeToUtc(today, window.windowStart);
  }
  return londonWallTimeToUtc(addDaysISO(today, 1), window.windowStart);
}

/**
 * Clamp an intended send time into the agency's window: too-early moves to the
 * same day's windowStart, past-the-end moves to the next day's windowStart.
 */
export function clampToSendWindow(
  window: SendWindow,
  sendAt: Date
): { sendAt: Date; clamped: boolean } {
  if (isWithinSendWindow(window, sendAt)) return { sendAt, clamped: false };
  const day = londonToday(sendAt);
  const clamped =
    londonHour(sendAt) < window.windowStart
      ? londonWallTimeToUtc(day, window.windowStart)
      : londonWallTimeToUtc(addDaysISO(day, 1), window.windowStart);
  return { sendAt: clamped, clamped: true };
}
