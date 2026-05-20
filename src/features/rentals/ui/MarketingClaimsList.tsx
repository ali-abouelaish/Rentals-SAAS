"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { reviewMarketingClaim } from "@/features/rentals/actions/marketing-claims";

export type ClaimProof = {
  id: string;
  file_name: string;
  url: string;
};

export type MarketingClaimItem = {
  id: string;
  agent_name: string;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  created_at: string;
  reject_reason: string | null;
  proofs: ClaimProof[];
};

type Props = {
  claims: MarketingClaimItem[];
  canReview: boolean;
};

const STATUS_STYLE: Record<MarketingClaimItem["status"], string> = {
  pending: "border-warning/40 text-warning-dark bg-warning/10",
  approved: "border-success/40 text-success bg-success/10",
  rejected: "border-error/40 text-error bg-error/10",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function MarketingClaimsList({ claims, canReview }: Props) {
  if (claims.length === 0) return null;
  return (
    <div className="space-y-3">
      {claims.map((claim) => (
        <MarketingClaimRow key={claim.id} claim={claim} canReview={canReview} />
      ))}
    </div>
  );
}

function MarketingClaimRow({ claim, canReview }: { claim: MarketingClaimItem; canReview: boolean }) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const decide = (decision: "approved" | "rejected") => {
    const formData = new FormData();
    formData.set("claim_id", claim.id);
    formData.set("decision", decision);
    if (decision === "rejected") formData.set("reject_reason", rejectReason.trim());

    startTransition(async () => {
      const result = await reviewMarketingClaim(formData);
      if (result.ok) {
        toast.success(decision === "approved" ? "Claim approved." : "Claim rejected.");
        setRejectMode(false);
        setRejectReason("");
      } else {
        toast.error(result.error ?? "Failed to update claim.");
      }
    });
  };

  return (
    <div className="rounded-xl border border-border bg-surface-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy">{claim.agent_name}</p>
          <p className="text-xs text-foreground-muted">{formatDate(claim.created_at)}</p>
        </div>
        <Badge className={STATUS_STYLE[claim.status]}>{claim.status}</Badge>
      </div>

      {claim.status === "pending" && (
        <p className="text-xs text-foreground-muted italic">
          Claim pending — can be approved or rejected by an admin or the assisting agent.
        </p>
      )}

      {claim.note && (
        <p className="text-sm text-foreground-secondary">
          <span className="font-medium text-foreground">Note:</span> {claim.note}
        </p>
      )}

      {claim.proofs.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {claim.proofs.map((proof) => (
            <a
              key={proof.id}
              href={proof.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-border bg-surface-inset p-2 text-xs text-foreground-secondary hover:border-border-strong hover:text-foreground"
              title={proof.file_name}
            >
              <span className="line-clamp-2 break-all">{proof.file_name}</span>
            </a>
          ))}
        </div>
      )}

      {claim.status === "rejected" && claim.reject_reason && (
        <p className="text-xs text-error">Reason: {claim.reject_reason}</p>
      )}

      {canReview && claim.status === "pending" && (
        <div className="space-y-2 border-t border-border pt-3">
          {rejectMode ? (
            <div className="space-y-2">
              <Input
                placeholder="Reason for rejection (optional)"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                maxLength={300}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => decide("rejected")}
                  loading={isPending}
                >
                  Confirm reject
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRejectMode(false);
                    setRejectReason("");
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="success"
                size="sm"
                onClick={() => decide("approved")}
                loading={isPending}
              >
                <Check className="h-3.5 w-3.5" />
                Approve
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRejectMode(true)}
                disabled={isPending}
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
