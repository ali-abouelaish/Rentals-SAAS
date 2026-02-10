import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

const statusStyles: Record<string, string> = {
  draft: "border-border-muted text-foreground-secondary",
  submitted: "border-border-muted text-foreground-secondary",
  approved: "border-gold text-gold",
  sent: "border-border-muted text-foreground-secondary",
  paid: "border-emerald-500 text-success",
  declined: "border-red-500 text-error",
  void: "border-border-muted text-foreground-secondary"
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("capitalize", statusStyles[status] ?? "")}>
      {status}
    </Badge>
  );
}
