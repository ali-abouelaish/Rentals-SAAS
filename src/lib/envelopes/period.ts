/**
 * Monthly allowance periods, and what a stored balance row actually means.
 *
 * Dependency-free — no imports at all, so `node --test` can load it and so the
 * allowance rule is provable in isolation. `monthlyAllowance` is a required
 * parameter rather than an import for the same reason.
 *
 * The rule this exists for: the database resets a stale allowance lazily,
 * inside `consume_envelope`, at the moment it is spent. A row read between the
 * 1st and the next send therefore still holds LAST month's exhausted figures.
 * Rendering those literally would tell an agency it has nothing left on the
 * morning of the 1st, and would push it into buying envelopes it already has.
 */

export type StoredBalanceRow = {
  allowance_period: string;
  allowance_total: number;
  allowance_used: number;
  topup_balance: number;
  lifetime_sent: number;
};

export type ProjectedBalance = {
  allowanceRemaining: number;
  allowanceTotal: number;
  topupRemaining: number;
  remaining: number;
  lifetimeSent: number;
};

/** First day of the month containing `now`, in UTC, as `YYYY-MM-DD`. */
export function currentPeriod(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

/**
 * What the stored row means as of `period`.
 *
 * A row whose period is behind `period` is treated as a fresh allowance:
 * unused envelopes do not carry over, so the new month starts at the full
 * grant regardless of how the old one ended.
 */
export function projectBalance(
  row: StoredBalanceRow,
  period: string,
  monthlyAllowance: number
): ProjectedBalance {
  const stale = row.allowance_period < period;

  const allowanceTotal = stale ? monthlyAllowance : row.allowance_total;
  const allowanceUsed = stale ? 0 : row.allowance_used;

  // Clamped because the allowance can legitimately shrink: if the plan's
  // monthly grant is reduced mid-period, a row already past the new total
  // would otherwise compute a negative remainder and subtract from the
  // purchased pool, making top-ups silently disappear.
  const allowanceRemaining = Math.max(allowanceTotal - allowanceUsed, 0);

  return {
    allowanceRemaining,
    allowanceTotal,
    topupRemaining: row.topup_balance,
    remaining: allowanceRemaining + row.topup_balance,
    lifetimeSent: row.lifetime_sent,
  };
}
