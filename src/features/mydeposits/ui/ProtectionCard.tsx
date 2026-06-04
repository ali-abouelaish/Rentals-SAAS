"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw, ChevronDown, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MdStatusBadge } from "./MdStatusBadge";
import { CertificateButton } from "./CertificateButton";
import { PaymentInstructions } from "./PaymentInstructions";
import { ReleaseRequestPanel } from "./ReleaseRequestPanel";
import { syncProtection } from "../actions/sync";
import type { MdProtection, MdReleaseRequest } from "../domain/types";

export function ProtectionCard({
  protection,
  releaseRequests,
}: {
  protection: MdProtection;
  releaseRequests: MdReleaseRequest[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const contract = protection.contract;
  const propertyName = contract?.unit?.property?.name ?? "—";
  const room = contract?.unit?.room_number;
  const tenantName = contract?.pm_tenant?.full_name ?? "—";

  const onSync = () =>
    startTransition(async () => {
      try {
        const res = await syncProtection(protection.id);
        toast.success(res.result === "advanced" ? "Status updated" : "Synced");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Sync failed");
      }
    });

  return (
    <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">
              {propertyName}
              {room ? ` · Room ${room}` : ""}
            </p>
            <MdStatusBadge status={protection.status} />
          </div>
          <p className="text-xs text-foreground-secondary truncate">
            {tenantName}
            {protection.deposit_amount_pence != null &&
              ` · £${(protection.deposit_amount_pence / 100).toLocaleString()}`}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {protection.status === "protected" && protection.remote_deposit_id && (
            <CertificateButton protectionId={protection.id} />
          )}
          <Button variant="outline" size="sm" loading={isPending} onClick={onSync}>
            <RefreshCw className="h-3.5 w-3.5" />
            Sync
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setExpanded((e) => !e)} aria-label="Toggle details">
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </div>

      {protection.last_error && (
        <div className="flex items-start gap-2 border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="break-words">{protection.last_error}</span>
        </div>
      )}

      {expanded && (
        <div className="border-t border-border p-4 space-y-4">
          {protection.status === "awaiting_payment" && (
            <PaymentInstructions instructions={protection.payment_instructions} />
          )}
          <ReleaseRequestPanel protection={protection} releaseRequests={releaseRequests} />
        </div>
      )}
    </div>
  );
}
