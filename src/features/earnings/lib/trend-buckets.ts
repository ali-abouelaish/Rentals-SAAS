/**
 * Earnings trend buckets. Shared by the server trend queries and the charts
 * that merge extra amounts (bonuses, manager commission) into a trend, so
 * every amount lands in the same day/week bucket as the rentals.
 */

export type TrendBucket = "day" | "week";

/** Ranges up to 45 days chart by day; longer ranges by week. */
export function trendBucketFor(from: string | Date, to: string | Date): TrendBucket {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const diffDays = Math.ceil((toMs - fromMs) / (1000 * 60 * 60 * 24));
  return diffDays <= 45 ? "day" : "week";
}

/** YYYY-MM-DD key of the bucket a date falls in (weeks start on Sunday, UTC). */
export function trendBucketKey(value: string | Date, bucket: TrendBucket): string {
  const d = new Date(value);
  const keyDate =
    bucket === "week"
      ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - d.getUTCDay()))
      : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return keyDate.toISOString().slice(0, 10);
}
