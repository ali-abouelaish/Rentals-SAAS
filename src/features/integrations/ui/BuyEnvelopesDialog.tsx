"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import {
  ENVELOPE_PACKS,
  formatPence,
  formatPerEnvelope,
  type EnvelopeBalance,
  type EnvelopePack,
} from "@/lib/envelopes/packs";
import { purchaseEnvelopesAction } from "../actions/envelopes";

const HIGHLIGHT_LABEL: Record<NonNullable<EnvelopePack["highlight"]>, string> = {
  popular: "Most popular",
  best_value: "Best value",
};

/**
 * Buying envelopes, either from the settings page or in place when a send is
 * blocked.
 *
 * `blockedContext` switches the copy from "top up" to "you can't send until
 * you do". Same dialog either way — an agency stopped mid-send shouldn't be
 * bounced to a different screen and have to find their way back.
 */
export function BuyEnvelopesDialog({
  open,
  onClose,
  onPurchased,
  balance,
  blockedContext = false,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after a successful purchase — used to retry the blocked send. */
  onPurchased?: () => void;
  balance: EnvelopeBalance | null;
  blockedContext?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string>(
    ENVELOPE_PACKS.find((p) => p.highlight === "popular")?.key ?? ENVELOPE_PACKS[0].key
  );
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const pack = ENVELOPE_PACKS.find((p) => p.key === selected) ?? ENVELOPE_PACKS[0];

  const handleBuy = () => {
    if (!accepted) {
      setError("Tick the box to confirm the charge on your next invoice");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await purchaseEnvelopesAction({
        packKey: pack.key,
        acceptCharge: true,
      });
      if ("error" in result) {
        toast.error("Could not buy envelopes", { description: result.error });
        return;
      }
      toast.success(result.message);
      setAccepted(false);
      router.refresh();
      onPurchased?.();
      onClose();
    });
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-brand" aria-hidden />
            <DialogTitle>
              {blockedContext ? "You're out of envelopes" : "Buy envelopes"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {blockedContext
              ? "One envelope is used each time you send a document for signature, and you have none left. Buy a pack and your document sends straight away."
              : "One envelope is used each time you send a document for signature. Purchased envelopes never expire."}
          </DialogDescription>
        </DialogHeader>

        {balance && (
          <p className="rounded-lg bg-surface-inset p-2.5 text-[11px] text-foreground-secondary">
            You have <strong className="text-foreground">{balance.remaining}</strong>{" "}
            {balance.remaining === 1 ? "envelope" : "envelopes"} left
            {balance.allowanceRemaining > 0 && (
              <>
                {" "}
                — {balance.allowanceRemaining} from this month&apos;s included{" "}
                {balance.allowanceTotal}, which resets on the 1st
              </>
            )}
            {balance.topupRemaining > 0 && (
              <> and {balance.topupRemaining} purchased, which don&apos;t expire</>
            )}
            .
          </p>
        )}

        <div className="space-y-2 py-1">
          {ENVELOPE_PACKS.map((option) => {
            const isSelected = option.key === selected;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelected(option.key)}
                aria-pressed={isSelected}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors",
                  isSelected
                    ? "border-brand bg-surface-inset"
                    : "border-border hover:bg-surface-inset"
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {option.envelopes} envelopes
                    </span>
                    {option.highlight && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                        {HIGHLIGHT_LABEL[option.highlight]}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-foreground-muted mt-0.5">
                    {formatPerEnvelope(option)} · never expire
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-foreground">
                    {formatPence(option.pricePence)}
                  </span>
                  {isSelected && <Check className="h-4 w-4 text-brand" aria-hidden />}
                </div>
              </button>
            );
          })}
        </div>

        <div>
          <label
            htmlFor="acceptEnvelopeCharge"
            className="flex items-start gap-2 text-sm text-foreground cursor-pointer"
          >
            <input
              id="acceptEnvelopeCharge"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border accent-[var(--brand)]"
              checked={accepted}
              onChange={(e) => {
                setAccepted(e.target.checked);
                if (e.target.checked) setError(null);
              }}
            />
            <span>
              I agree to {formatPence(pack.pricePence)} being added to my agency&apos;s
              invoice
            </span>
          </label>
          <p className="mt-1 ml-6 text-[11px] text-foreground-muted">
            Nothing is charged today and no card is needed — it goes on your next
            monthly invoice. The envelopes are usable immediately.
          </p>
          {error && <p className="mt-1 ml-6 text-[11px] text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {blockedContext ? "Not now" : "Cancel"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={isPending}
            onClick={handleBuy}
          >
            Buy {pack.envelopes} for {formatPence(pack.pricePence)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
