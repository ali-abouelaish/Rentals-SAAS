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

type ReadyStatus = Extract<RoomBookingLinkResult, { forms: unknown }>;

const WEEKS_PER_MONTH = 52 / 12; // 4.33333…

function holdingDepositFromRent(rent: number): number {
  return Math.round(rent / WEEKS_PER_MONTH);
}

export function CopyBookingLinkButton({ unitId, size = "sm" }: CopyBookingLinkButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<RoomBookingLinkResult | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string>("");
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

  const handleOpen = () => {
    if (!status || "error" in status) return;
    setSelectedFormId(status.forms[0]?.id ?? "");
    setPriceInput(status.minPrice ? String(status.minPrice) : "");
    setPriceError(null);
    setDialogOpen(true);
  };

  const submit = (ready: ReadyStatus) => {
    const trimmed = priceInput.trim();
    const price = Number(trimmed);

    if (!trimmed || !Number.isFinite(price) || price <= 0) {
      setPriceError("Enter a valid monthly rent.");
      return;
    }
    if (ready.minPrice !== null && price < ready.minPrice) {
      setPriceError(`Must be at least £${ready.minPrice.toLocaleString()}.`);
      return;
    }

    const form = ready.forms.find((f) => f.id === selectedFormId);
    if (!form) {
      setPriceError("Pick a form to send.");
      return;
    }

    const url = new URL(`${ready.baseUrl}/apply/${form.public_slug}/${ready.unitId}`);
    url.searchParams.set("price", String(Math.round(price)));
    writeToClipboard(url.toString());
    setDialogOpen(false);
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

  const parsedPrice = Number(priceInput);
  const previewDeposit =
    Number.isFinite(parsedPrice) && parsedPrice > 0
      ? holdingDepositFromRent(parsedPrice)
      : null;

  const priceRangeLabel =
    status.minPrice !== null && status.maxPrice !== null
      ? status.minPrice === status.maxPrice
        ? `£${status.minPrice.toLocaleString()} pcm`
        : `£${status.minPrice.toLocaleString()} – £${status.maxPrice.toLocaleString()} pcm`
      : null;

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="outline"
        size={size === "sm" ? "sm" : "md"}
        onClick={handleOpen}
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
        Pick the form and agreed price — we&apos;ll build the link.
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send a booking link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {status.forms.length > 1 && (
              <div className="space-y-1.5">
                <label htmlFor="booking-form" className="block text-sm font-medium text-foreground">
                  Form to send
                </label>
                <select
                  id="booking-form"
                  value={selectedFormId}
                  onChange={(e) => setSelectedFormId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-surface-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
                >
                  {status.forms.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="agreed-price" className="block text-sm font-medium text-foreground">
                Agreed monthly rent (£)
              </label>
              <input
                id="agreed-price"
                type="number"
                inputMode="numeric"
                min={status.minPrice ?? undefined}
                value={priceInput}
                onChange={(e) => {
                  setPriceInput(e.target.value);
                  setPriceError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit(status);
                  }
                }}
                className="h-10 w-full rounded-xl border border-border bg-surface-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
                placeholder={status.minPrice?.toString() ?? "e.g. 1200"}
                autoFocus
              />
              {priceRangeLabel && (
                <p className="text-[11px] text-foreground-muted">
                  Listed at {priceRangeLabel}.
                </p>
              )}
              {priceError && <p className="text-xs text-red-600">{priceError}</p>}
            </div>

            <div className="rounded-xl border border-border bg-surface-inset/40 px-3 py-2.5">
              <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                Holding deposit (1 week)
              </span>
              <p className="mt-1 text-sm font-medium text-foreground">
                {previewDeposit !== null
                  ? `£${previewDeposit.toLocaleString()}`
                  : "Enter a rent to calculate"}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => submit(status)}
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
