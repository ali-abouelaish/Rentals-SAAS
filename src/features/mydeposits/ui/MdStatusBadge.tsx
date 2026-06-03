import { MD_STATUS_CONFIG, type MdProtectionStatus } from "../domain/types";

export function MdStatusBadge({ status }: { status: MdProtectionStatus }) {
  const cfg = MD_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.bg} ${cfg.fg}`}
    >
      {cfg.label}
    </span>
  );
}
