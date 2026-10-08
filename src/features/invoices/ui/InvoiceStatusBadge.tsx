import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

const statusStyles: Record<string, string> = {
  draft: "border-border-muted text-foreground-secondary",
  submitted: "border-gold text-gold",
  approved: "border-gold text-gold",
  sent: "border-border-muted text-foreground-secondary",
  paid: "border-emerald-500 text-success",
  declined: "border-red-500 text-error",
  void: "border-border-muted text-foreground-secondary"
};

/**
 * Display names for invoice statuses. `submitted` is what a finalised invoice
 * is stored as — there is no approval step any more, so it reads as "Ready to
 * send". `approved` only appears on invoices from before that change.
 */
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Ready to send",
  approved: "Approved",
  sent: "Sent",
  paid: "Paid",
  declined: "Declined",
  void: "Void"
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn(statusStyles[status] ?? "")}>
      {INVOICE_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
