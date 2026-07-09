// Map the raw remote deposit status string onto our local protection enum.
// Case-insensitive; unknown values leave the existing status untouched.

export type MdProtectionStatus =
  | "draft"
  | "created_remote"
  | "awaiting_payment"
  | "part_protected"
  | "protected"
  | "release_requested"
  | "released"
  | "disputed"
  | "cancelled"
  | "error";

const RAW_TO_LOCAL: Record<string, MdProtectionStatus> = {
  "not protected": "created_remote",
  "waiting for payment": "awaiting_payment",
  "awaiting payment": "awaiting_payment",
  "part protected": "part_protected",
  "partially protected": "part_protected",
  protected: "protected",
  released: "released",
  cancelled: "cancelled",
  canceled: "cancelled",
  // Dispute states (best-effort strings, like the rest — adjust if sandbox differs).
  disputed: "disputed",
  "in dispute": "disputed",
  dispute: "disputed",
};

/** Returns the mapped local status, or null when the raw value is unrecognised. */
export function mapRemoteDepositStatus(raw: string | null | undefined): MdProtectionStatus | null {
  if (!raw) return null;
  return RAW_TO_LOCAL[raw.trim().toLowerCase()] ?? null;
}

// Monotonic lifecycle order. A deposit poll may only ADVANCE the local status,
// never move it backward: several remote states collapse onto an earlier local
// rank (e.g. an unpaid deposit keeps reporting "not protected" → created_remote
// long after we've locally moved to awaiting_payment), and a stale "protected"
// must not clobber a release we've already requested. error sits at the bottom
// so a successful poll always recovers out of it; cancelled/disputed sit high
// so they always win.
const STATUS_RANK: Record<MdProtectionStatus, number> = {
  error: 0,
  draft: 1,
  created_remote: 2,
  awaiting_payment: 3,
  part_protected: 4,
  protected: 5,
  release_requested: 6,
  released: 7,
  disputed: 8,
  cancelled: 9,
};

export function statusRank(status: MdProtectionStatus): number {
  return STATUS_RANK[status] ?? 0;
}

/** True when a polled remote status should overwrite the current local status. */
export function shouldAdvanceStatus(
  current: MdProtectionStatus,
  next: MdProtectionStatus
): boolean {
  return statusRank(next) > statusRank(current);
}

const TERMINAL: ReadonlySet<MdProtectionStatus> = new Set(["protected", "released", "cancelled"]);

export function isTerminalStatus(status: MdProtectionStatus): boolean {
  return TERMINAL.has(status);
}
