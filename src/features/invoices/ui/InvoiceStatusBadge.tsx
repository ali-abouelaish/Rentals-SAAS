import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

const statusStyles: Record<string, string> = {
  draft: "border-muted text-gray-600",
  submitted: "border-muted text-gray-600",
  approved: "border-gold text-gold",
  sent: "border-muted text-gray-600",
  paid: "border-emerald-500 text-emerald-600",
  declined: "border-red-500 text-red-600",
  void: "border-muted text-gray-600"
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("capitalize", statusStyles[status] ?? "")}>
      {status}
    </Badge>
  );
}
