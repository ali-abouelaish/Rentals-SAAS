// Map the raw TDS CreateDepositStatus value onto our local tds_deposit_status
// enum. The remote status is one of pending | created | failed (case-insensitive
// — the docs show both "failed" and "Failed"). Mirrors
// src/lib/mydeposits/statusMap.ts.

export type TdsDepositStatus =
  | "draft"
  | "submitted"
  | "pending"
  | "created"
  | "failed"
  | "error";

const RAW_TO_LOCAL: Record<string, TdsDepositStatus> = {
  pending: "pending",
  created: "created",
  failed: "failed",
};

/** Returns the mapped local status, or null when the raw value is unrecognised. */
export function mapTdsStatus(raw: string | null | undefined): TdsDepositStatus | null {
  if (!raw) return null;
  return RAW_TO_LOCAL[raw.trim().toLowerCase()] ?? null;
}

const TERMINAL: ReadonlySet<TdsDepositStatus> = new Set(["created", "failed"]);

/** created / failed are terminal — the cron stops polling once reached. */
export function isTerminalTdsStatus(status: TdsDepositStatus): boolean {
  return TERMINAL.has(status);
}
