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
};

/** Returns the mapped local status, or null when the raw value is unrecognised. */
export function mapRemoteDepositStatus(raw: string | null | undefined): MdProtectionStatus | null {
  if (!raw) return null;
  return RAW_TO_LOCAL[raw.trim().toLowerCase()] ?? null;
}

const TERMINAL: ReadonlySet<MdProtectionStatus> = new Set(["protected", "released", "cancelled"]);

export function isTerminalStatus(status: MdProtectionStatus): boolean {
  return TERMINAL.has(status);
}
