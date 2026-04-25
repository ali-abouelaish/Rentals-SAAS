import { cn } from "@/lib/utils/cn";
import { KEY_STATUS_LABELS, type KeyStatus } from "../domain/types";

const STATUS_STYLES: Record<KeyStatus, string> = {
  in_office: "bg-green-100 text-green-800 border-green-200",
  loaned: "bg-amber-100 text-amber-800 border-amber-200",
  with_tenant: "bg-blue-100 text-blue-800 border-blue-200",
  lost: "bg-red-100 text-red-800 border-red-200",
  destroyed: "bg-gray-200 text-gray-700 border-gray-300",
};

export function KeyStatusPill({
  status,
  className,
}: {
  status: KeyStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        STATUS_STYLES[status],
        className
      )}
    >
      {KEY_STATUS_LABELS[status]}
    </span>
  );
}
