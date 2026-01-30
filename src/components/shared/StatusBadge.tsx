import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

const statusStyles: Record<string, string> = {
  pending: "border-muted text-gray-600",
  approved: "border-gold text-gold",
  paid: "border-emerald-500 text-emerald-600",
  refunded: "border-red-500 text-red-600",
  on_hold: "border-muted text-gray-600",
  solved: "border-emerald-500 text-emerald-600"
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("capitalize", statusStyles[status] ?? "")}>
      {status.replace("_", " ")}
    </Badge>
  );
}
