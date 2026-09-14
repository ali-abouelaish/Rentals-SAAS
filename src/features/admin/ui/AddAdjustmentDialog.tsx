"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatPence } from "@/lib/envelopes/packs";
import { addInvoiceAdjustmentAction } from "../actions/billing";

/**
 * Add a credit or extra charge to a draft platform invoice.
 *
 * Amounts are entered in POUNDS and converted to pence on submit — nobody types
 * a goodwill discount as "-5000". The conversion is the only place a float
 * touches money, and it is rounded immediately.
 */
export function AddAdjustmentDialog({
  invoiceId,
  tenantName,
  currentTotalPence
}: {
  invoiceId: string;
  tenantName: string;
  currentTotalPence: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const reset = () => {
    setDescription("");
    setAmount("");
    setDescriptionError(null);
    setAmountError(null);
  };

  // Client-side mirror of the server's zod schema. The server validates again —
  // this only spares a round trip and puts the message next to the field.
  const validate = (): number | null => {
    let ok = true;

    const reason = description.trim();
    if (reason.length < 3) {
      setDescriptionError("Give a reason of at least 3 characters");
      ok = false;
    } else if (reason.length > 200) {
      setDescriptionError("Keep the reason under 200 characters");
      ok = false;
    } else {
      setDescriptionError(null);
    }

    const pounds = Number(amount.trim());
    if (!amount.trim() || Number.isNaN(pounds)) {
      setAmountError("Enter an amount in pounds");
      ok = false;
    } else if (pounds === 0) {
      setAmountError("An adjustment of zero changes nothing");
      ok = false;
    } else if (Math.abs(pounds) > 10000) {
      setAmountError("Over £10,000 — add it in smaller parts");
      ok = false;
    } else {
      setAmountError(null);
    }

    if (!ok) return null;
    return Math.round(pounds * 100);
  };

  const onSubmit = () => {
    const amountPence = validate();
    if (amountPence === null) return;

    startTransition(async () => {
      const result = await addInvoiceAdjustmentAction({
        invoiceId,
        description: description.trim(),
        amountPence
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message);
      setOpen(false);
      reset();
      router.refresh();
    });
  };

  const preview = (() => {
    const pounds = Number(amount.trim());
    if (!amount.trim() || Number.isNaN(pounds) || pounds === 0) return null;
    const next = currentTotalPence + Math.round(pounds * 100);
    if (next < 0) return "This is more than the invoice total — it would take the bill below zero.";
    return `New total would be ${formatPence(next)}.`;
  })();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Adjustment
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust {tenantName}&apos;s invoice</DialogTitle>
          <DialogDescription>
            Add a credit or an extra charge. Current total {formatPence(currentTotalPence)}.
            Regenerating this draft rebuilds its lines from source and will discard
            adjustments, so add these after generating and before issuing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="adjustment-reason"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Reason
            </label>
            <p className="text-xs text-foreground-muted mb-1.5">
              Appears on the invoice as the line description. 3–200 characters.
            </p>
            <Input
              id="adjustment-reason"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Goodwill credit — March outage"
              maxLength={200}
              aria-invalid={Boolean(descriptionError)}
              aria-describedby={descriptionError ? "adjustment-reason-error" : undefined}
            />
            {descriptionError && (
              <p id="adjustment-reason-error" className="text-xs text-red-600 mt-1">
                {descriptionError}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="adjustment-amount"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Amount (£)
            </label>
            <p className="text-xs text-foreground-muted mb-1.5">
              In pounds. Use a minus sign for a credit — e.g. <code>-50</code> takes £50
              off the bill.
            </p>
            <Input
              id="adjustment-amount"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="-50.00"
              aria-invalid={Boolean(amountError)}
              aria-describedby={amountError ? "adjustment-amount-error" : undefined}
            />
            {amountError && (
              <p id="adjustment-amount-error" className="text-xs text-red-600 mt-1">
                {amountError}
              </p>
            )}
            {!amountError && preview && (
              <p className="text-xs text-foreground-secondary mt-1">{preview}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={isPending}
            onClick={onSubmit}
          >
            Add adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
