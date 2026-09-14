/**
 * When a subscription grants access.
 *
 * Deliberately dependency-free — no catalogue, no database client, no path
 * aliases. This is the rule that decides whether an agency can use a paid
 * feature, so it should be provable in isolation, and `node --test` can only
 * load a module whose runtime imports resolve without a bundler.
 *
 * The catalogue lookup is injected rather than imported for the same reason.
 */

export type AccessRow = {
  integration_key: string;
  status: string;
  ends_on: string | null;
};

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Whether a subscription row currently grants access.
 *
 * Three rules, and the third is the one that matters:
 *
 *   - An active or pending_setup row grants. `pending_setup` grants
 *     deliberately: the agency has subscribed but not yet connected the
 *     service, and it has to reach the setup screen, which the feature owns.
 *   - A row past its `ends_on` grants nothing, whatever its status.
 *   - A CANCELLED row still grants until `ends_on`. Cancellation is
 *     end-of-period, not immediate — the month is paid for, and yanking
 *     deposit protection mid-month could strand a deposit that has to be
 *     registered inside 30 days.
 */
export function subscriptionGrantsAccess(
  row: Pick<AccessRow, "status" | "ends_on">,
  asOf: string = todayIso()
): boolean {
  if (row.ends_on && row.ends_on < asOf) return false;
  if (row.status === "cancelled") return Boolean(row.ends_on) && row.ends_on! >= asOf;
  return row.status === "active" || row.status === "pending_setup";
}

/**
 * The feature keys a set of subscription rows grants.
 *
 * `lookup` maps an integration key to the features it covers, and returns null
 * for a key that is no longer in the catalogue — which grants nothing, so a
 * retired integration cannot keep unlocking a feature through an old row.
 */
export function featureKeysFromRows<TKey extends string>(
  rows: AccessRow[],
  lookup: (integrationKey: string) => readonly TKey[] | null,
  asOf: string = todayIso()
): TKey[] {
  const keys: TKey[] = [];
  for (const row of rows) {
    if (!subscriptionGrantsAccess(row, asOf)) continue;
    const features = lookup(row.integration_key);
    if (!features) continue;
    keys.push(...features);
  }
  return keys;
}

/**
 * The first of next month.
 *
 * When a paid subscription starts billing. Activation is instant but the
 * charge starts next cycle, so the agency gets the remainder of the current
 * month free rather than being part-charged — which keeps the activation
 * dialog to a single number and avoids proration nobody asked for.
 *
 * UTC throughout. A server west of Greenwich would otherwise roll the month
 * over a day early for anyone activating late on the 31st.
 */
export function firstOfNextMonth(from: Date = new Date()): string {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  return next.toISOString().slice(0, 10);
}

/**
 * The last day of the current month — when a cancellation takes effect.
 *
 * Day 0 of next month is the last day of this one, which handles 28/29/30/31
 * without a table of month lengths.
 */
export function endOfCurrentMonth(from: Date = new Date()): string {
  const end = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0));
  return end.toISOString().slice(0, 10);
}
