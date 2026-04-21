"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Link as LinkIcon, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getRoomBookingLink,
  type RoomBookingLinkResult,
} from "@/features/booking-forms/actions/booking-link";

interface CopyBookingLinkButtonProps {
  unitId: string;
  size?: "sm" | "md";
}

type ReadyStatus = Extract<RoomBookingLinkResult, { url: string }>;

export function CopyBookingLinkButton({ unitId, size = "sm" }: CopyBookingLinkButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<RoomBookingLinkResult | null>(null);
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRoomBookingLink(unitId).then((result) => {
      if (!cancelled) setStatus(result);
    });
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  const writeToClipboard = (url: string) => {
    startTransition(async () => {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success("Booking link copied", { description: url });
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Could not access clipboard");
      }
    });
  };

  const handleCopy = () => {
    if (!status || "error" in status) return;

    const hasRange =
      status.minPrice !== null &&
      status.maxPrice !== null &&
      status.minPrice !== status.maxPrice;

    if (hasRange) {
      setPriceInput(status.minPrice?.toString() ?? "");
      setPriceError(null);
      setPriceOpen(true);
      return;
    }

    writeToClipboard(status.url);
  };

  const submitPrice = (ready: ReadyStatus) => {
    const trimmed = priceInput.trim();
    const price = Number(trimmed);

    if (!trimmed || !Number.isFinite(price) || price <= 0) {
      setPriceError("Enter a valid number.");
      return;
    }
    if (ready.minPrice !== null && price < ready.minPrice) {
      setPriceError(`Must be at least £${ready.minPrice.toLocaleString()}.`);
      return;
    }
    if (ready.maxPrice !== null && price > ready.maxPrice) {
      setPriceError(`Must be at most £${ready.maxPrice.toLocaleString()}.`);
      return;
    }

    const urlWithPrice = new URL(ready.url);
    urlWithPrice.searchParams.set("price", String(Math.round(price)));
    writeToClipboard(urlWithPrice.toString());
    setPriceOpen(false);
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

  const hasRange =
    status.minPrice !== null &&
    status.maxPrice !== null &&
    status.minPrice !== status.maxPrice;

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="outline"
        size={size === "sm" ? "sm" : "md"}
        onClick={handleCopy}
        loading={isPending && !priceOpen}
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
        {hasRange
          ? "This room has a price range — you'll be asked for the agreed price."
          : "Share this link with prospective tenants to apply for this specific room."}
      </p>

      <Dialog open={priceOpen} onOpenChange={setPriceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set the agreed price</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-foreground-secondary">
              This room is listed between{" "}
              <span className="font-medium text-foreground">
                £{status.minPrice?.toLocaleString()}
              </span>{" "}
              and{" "}
              <span className="font-medium text-foreground">
                £{status.maxPrice?.toLocaleString()}
              </span>{" "}
              pcm. The price you enter here will be shown on the applicant&apos;s booking form.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="agreed-price" className="block text-sm font-medium text-foreground">
                Agreed monthly rent (£)
              </label>
              <input
                id="agreed-price"
                type="number"
                inputMode="numeric"
                min={status.minPrice ?? undefined}
                max={status.maxPrice ?? undefined}
                value={priceInput}
                onChange={(e) => {
                  setPriceInput(e.target.value);
                  setPriceError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitPrice(status);
                  }
                }}
                className="h-10 w-full rounded-xl border border-border bg-surface-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
                placeholder={status.minPrice?.toString() ?? ""}
                autoFocus
              />
              {priceError && <p className="text-xs text-red-600">{priceError}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPriceOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => submitPrice(status)}
                loading={isPending}
              >
                <LinkIcon className="h-3.5 w-3.5 mr-1" />
                Copy link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
