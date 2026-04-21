"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Link as LinkIcon, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getRoomBookingLink,
  type RoomBookingLinkResult,
} from "@/features/booking-forms/actions/booking-link";

interface CopyBookingLinkButtonProps {
  unitId: string;
  size?: "sm" | "md";
}

export function CopyBookingLinkButton({ unitId, size = "sm" }: CopyBookingLinkButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<RoomBookingLinkResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRoomBookingLink(unitId).then((result) => {
      if (!cancelled) setStatus(result);
    });
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  const handleCopy = () => {
    if (!status || "error" in status) return;
    startTransition(async () => {
      try {
        await navigator.clipboard.writeText(status.url);
        setCopied(true);
        toast.success("Booking link copied", { description: status.url });
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Could not access clipboard");
      }
    });
  };

  if (status === null) {
    return (
      <div className="flex flex-col gap-1.5">
        <Button type="button" variant="outline" size={size === "sm" ? "sm" : "md"} disabled>
          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          Checking link…
        </Button>
      </div>
    );
  }

  if ("error" in status) {
    return (
      <div className="flex flex-col gap-1.5">
        <Button type="button" variant="outline" size={size === "sm" ? "sm" : "md"} disabled>
          <AlertTriangle className="h-3.5 w-3.5 mr-1 text-amber-500" />
          Link unavailable
        </Button>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
          <p className="font-medium">{status.error}</p>
          {status.reason === "no_form_for_portfolio" && (
            <p className="mt-1 text-amber-800">
              Create a booking form for
              {status.portfolioName ? <> the <span className="font-medium">{status.portfolioName}</span> portfolio</> : " this portfolio"}
              {" "}so applicants can apply for this room.
              {" "}
              <Link
                href="/settings/booking-forms"
                className="underline font-medium hover:text-amber-950"
              >
                Open booking forms →
              </Link>
            </p>
          )}
          {status.reason === "no_portfolio" && (
            <p className="mt-1 text-amber-800">
              Assign this unit&apos;s property to a portfolio first, then create a matching booking form.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="outline"
        size={size === "sm" ? "sm" : "md"}
        onClick={handleCopy}
        loading={isPending}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 mr-1" />
            Copied
          </>
        ) : (
          <>
            <LinkIcon className="h-3.5 w-3.5 mr-1" />
            Copy booking link
          </>
        )}
      </Button>
      <p className="text-[11px] text-foreground-muted">
        Share this link with prospective tenants to apply for this specific room.
      </p>
    </div>
  );
}
