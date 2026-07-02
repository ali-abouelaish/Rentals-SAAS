import { TDS_STATUS_CONFIG, type TdsDepositStatus } from "../domain/deposit-types";

export function TdsStatusBadge({ status }: { status: TdsDepositStatus }) {
  const cfg = TDS_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.bg} ${cfg.fg}`}
    >
      {cfg.label}
    </span>
  );
}
