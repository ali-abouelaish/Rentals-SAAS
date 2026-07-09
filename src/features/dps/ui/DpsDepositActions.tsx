"use client";

// Per-deposit actions on the DPS deposits panel:
//  - Mark for bank transfer (status: created) — collects the allocation
//    reference, shows the returned payment reference.
//  - Confirm protected (status: created | marked_for_transfer) — records a
//    manual portal check; DPS has no API to observe protection.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Landmark, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { markDpsDepositForBankTransfer } from "../actions/markForBankTransfer";
import { confirmDpsDepositProtected } from "../actions/confirmProtected";

export function DpsMarkForTransferDialog({ depositRowId }: { depositRowId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = () => {
    const ref = reference.trim();
    if (!/^[A-Za-z0-9]{1,18}$/.test(ref)) {
      setFieldError("1–18 letters and numbers, no spaces.");
      return;
    }
    setFieldError(null);
    startTransition(async () => {
      const result = await markDpsDepositForBankTransfer({
        depositRowId,
        allocationReference: ref,
      });
      if (!result.ok || !result.paymentReference) {
        toast.error("Could not mark for bank transfer", { description: result.error });
        return;
      }
      setPaymentReference(result.paymentReference);
      toast.success("Marked for bank transfer");
      router.refresh();
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        title="Pay this deposit by bank transfer — DPS returns the payment reference to put on the transfer"
      >
        <Landmark className="h-3.5 w-3.5 mr-1.5" />
        Bank transfer
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setPaymentReference(null);
            setReference("");
            setFieldError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark for bank transfer</DialogTitle>
            <DialogDescription>
              Moves the deposit to “Awaiting bank transfer” so a single bank payment can cover one
              or more deposits. Use the same allocation reference for every deposit in the batch.
            </DialogDescription>
          </DialogHeader>

          {paymentReference ? (
            <div className="space-y-4">
              <p className="text-sm text-foreground">
                Payment reference:{" "}
                <span className="font-mono font-semibold">{paymentReference}</span>
              </p>
              <p className="text-xs text-foreground-secondary">
                Make the bank transfer from the agency&apos;s account using this reference so DPS can
                auto-allocate the payment. Once it clears, confirm protection from the DPS portal
                and record it here with “Confirm protected”.
              </p>
              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="dps-alloc-ref" className="text-sm font-medium text-foreground">
                  Allocation reference
                </label>
                <p className="text-xs text-foreground-muted">
                  1–18 letters/numbers, no spaces — e.g. an internal batch code like{" "}
                  <span className="font-mono">JUL26BATCH1</span>.
                </p>
                <Input
                  id="dps-alloc-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={18}
                  disabled={isPending}
                />
                {fieldError ? <p className="text-xs text-red-500">{fieldError}</p> : null}
              </div>
              <Button
                variant="secondary"
                className="w-full"
                onClick={onSubmit}
                disabled={isPending || !reference.trim()}
                loading={isPending}
              >
                Mark for bank transfer
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DpsConfirmProtectedButton({ depositRowId }: { depositRowId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onConfirm = () => {
    if (
      !window.confirm(
        "Confirm this deposit shows as protected in the agency's DPS portal? This records the protection date on the contract."
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await confirmDpsDepositProtected({ depositRowId });
      if (!result.ok) {
        toast.error("Could not confirm protection", { description: result.error });
        return;
      }
      toast.success("Deposit recorded as protected");
      router.refresh();
    });
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onConfirm}
      disabled={isPending}
      title="DPS has no status API — check the DPS portal, then record the protection here"
    >
      <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
      Confirm protected
    </Button>
  );
}
