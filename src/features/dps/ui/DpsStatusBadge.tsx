import { DPS_STATUS_CONFIG, type DpsDepositStatus } from "../domain/deposit-types";

export function DpsStatusBadge({ status }: { status: DpsDepositStatus }) {
  const cfg = DPS_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.bg} ${cfg.fg}`}
    >
      {cfg.label}
    </span>
  );
}
