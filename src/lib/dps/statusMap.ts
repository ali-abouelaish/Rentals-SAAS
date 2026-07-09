// Local DPS deposit lifecycle states (dps_deposit_status enum in Postgres).
//
// DPS has no status/read endpoint, so unlike TDS there is no remote state to
// map — every transition is driven by our own actions:
//   draft               row created, nothing sent
//   submitted           create POST in flight / crashed mid-flow
//   created             DPS returned a depositId (awaiting deposit payment)
//   marked_for_transfer MarkForBankTransfer accepted (awaiting bank transfer)
//   protected           admin manually confirmed protection in the DPS portal
//   failed              DPS rejected the request (validation)
//   error               transport/unexpected failure; retryable

export type DpsDepositStatus =
  | "draft"
  | "submitted"
  | "created"
  | "marked_for_transfer"
  | "protected"
  | "failed"
  | "error";

/** States from which re-submitting the create call is safe (no depositId yet). */
export function isDpsRetryable(status: DpsDepositStatus): boolean {
  return status === "draft" || status === "submitted" || status === "failed" || status === "error";
}

/** States in which the tenancy exists at DPS (a depositId was issued). */
export function isDpsCreated(status: DpsDepositStatus): boolean {
  return status === "created" || status === "marked_for_transfer" || status === "protected";
}
