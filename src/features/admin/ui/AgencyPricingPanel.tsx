"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { formatPence } from "@/lib/envelopes/packs";
import {
  createPlatformChargeAction,
  deletePlatformChargeAction,
  updatePlatformChargeAction,
  updateSubscriptionPricingAction
} from "../actions/pricing";
import type { AgencyChargeRow, AgencySubscriptionRow } from "../data/billing";

type Result = { error: string } | { success: true; message: string };

function firstOfNextMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
}

function shortDate(value: string | null): string {
  if (!value) return "";
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

function Field({
  id,
  label,
  hint,
  error,
  children
}: {
  id: string;
  label: string;
  hint: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground mb-1">
        {label}
      </label>
      <p className="text-xs text-foreground-muted mb-1.5">{hint}</p>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

/* ============================================================
   Charge dialog — the base fee and anything else agreed
   ============================================================ */

function ChargeDialog({
  tenantId,
  charge,
  open,
  onOpenChange
}: {
  tenantId: string;
  charge?: AgencyChargeRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(charge);

  const [label, setLabel] = useState(charge?.label ?? "");
  // Pounds in the field; converted to pence once, on submit.
  const [amount, setAmount] = useState(
    charge ? String(charge.amountPence / 100) : ""
  );
  const [startsOn, setStartsOn] = useState(
    charge?.billingStartsOn ?? firstOfNextMonth()
  );
  const [endsOn, setEndsOn] = useState(charge?.endsOn ?? "");
  const [notes, setNotes] = useState(charge?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Mirrors chargeSchema in actions/pricing.ts; the server validates again.
  const validate = (): number | null => {
    const next: Record<string, string> = {};

    if (label.trim().length < 2) next.label = "Give the charge a name of at least 2 characters";
    else if (label.trim().length > 120) next.label = "Keep the name under 120 characters";

    const pounds = Number(amount.trim());
    if (!amount.trim() || Number.isNaN(pounds)) {
      next.amount = "Enter an amount in pounds";
    } else if (pounds === 0) {
      next.amount = "An amount of zero would never appear on an invoice";
    } else if (Math.abs(pounds) > 100_000) {
      next.amount = "That is over £100,000 a month — check the amount";
    }

    if (!startsOn) next.startsOn = "Pick a start date";
    if (endsOn && startsOn && endsOn < startsOn) {
      next.endsOn = "The end date cannot be before the start date";
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return null;
    return Math.round(pounds * 100);
  };

  const onSubmit = () => {
    const amountPence = validate();
    if (amountPence === null) return;

    const payload = {
      tenantId,
      label: label.trim(),
      amountPence,
      billingStartsOn: startsOn,
      endsOn: endsOn || null,
      notes: notes.trim() || undefined
    };

    startTransition(async () => {
      const result = charge
        ? await updatePlatformChargeAction({ ...payload, id: charge.id })
        : await createPlatformChargeAction(payload);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
      router.refresh();
    });
  };

  const pounds = Number(amount.trim());
  const isDiscount = !Number.isNaN(pounds) && pounds < 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit charge" : "What does this agency pay?"}</DialogTitle>
          <DialogDescription>
            A recurring amount agreed with this agency — their base monthly fee, a
            custom line, or an ongoing discount. It appears on every invoice from
            its start month until you end it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field
            id="charge-label"
            label="What it is"
            hint="Appears on the invoice exactly as written. 2–120 characters."
            error={errors.label}
          >
            <Input
              id="charge-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Harbor Ops Professional"
              maxLength={120}
              aria-invalid={Boolean(errors.label)}
            />
          </Field>

          <Field
            id="charge-amount"
            label="Amount per month (£)"
            hint="In pounds. Use a minus sign for a recurring discount — e.g. -50 takes £50 off every month."
            error={errors.amount}
          >
            <Input
              id="charge-amount"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="299.00"
              aria-invalid={Boolean(errors.amount)}
            />
          </Field>

          <Field
            id="charge-starts"
            label="First billed"
            hint="Defaults to the 1st of next month, matching how add-ons start billing. Nothing before this date is affected."
            error={errors.startsOn}
          >
            <Input
              id="charge-starts"
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              aria-invalid={Boolean(errors.startsOn)}
            />
          </Field>

          <Field
            id="charge-ends"
            label="Last billed (optional)"
            hint="Leave blank while ongoing. Set it when they leave or the discount expires — earlier invoices keep the charge."
            error={errors.endsOn}
          >
            <Input
              id="charge-ends"
              type="date"
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              aria-invalid={Boolean(errors.endsOn)}
            />
          </Field>

          <Field
            id="charge-notes"
            label="Notes (optional)"
            hint="Why this rate — the deal, who agreed it, when it is due for review. Max 1000 characters."
          >
            <Textarea
              id="charge-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={1000}
            />
          </Field>

          {isDiscount && (
            <p className="rounded-lg bg-surface-inset px-3 py-2 text-xs text-foreground-secondary">
              This is a discount of {formatPence(Math.abs(Math.round(pounds * 100)))} a
              month. It reduces the bill but can never take an invoice below zero.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={isPending}
            onClick={onSubmit}
          >
            {isEdit ? "Save changes" : "Add charge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   Subscription re-pricing
   ============================================================ */

function SubscriptionPriceDialog({
  tenantId,
  subscription,
  open,
  onOpenChange
}: {
  tenantId: string;
  subscription: AgencySubscriptionRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [price, setPrice] = useState(String(subscription.monthlyPricePence / 100));
  const [grandfathered, setGrandfathered] = useState(subscription.isGrandfathered);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = () => {
    const pounds = Number(price.trim());
    if (!price.trim() || Number.isNaN(pounds)) {
      setError("Enter a price in pounds");
      return;
    }
    if (pounds < 0) {
      setError("Price cannot be negative — use a separate discount charge instead");
      return;
    }
    if (pounds > 100_000) {
      setError("That is over £100,000 a month — check the price");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result: Result = await updateSubscriptionPricingAction({
        tenantId,
        integrationKey: subscription.integrationKey,
        monthlyPricePence: Math.round(pounds * 100),
        isGrandfathered: grandfathered,
        billingStartsOn: subscription.billingStartsOn,
        endsOn: subscription.endsOn
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Re-price {subscription.name}</DialogTitle>
          <DialogDescription>
            This add-on was priced from the catalogue when the agency switched it on,
            and that price was frozen onto their record. Changing it here affects
            this agency only — the catalogue and every other agency are untouched.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field
            id="sub-price"
            label="Price per month (£)"
            hint="What this agency pays for this add-on. Zero makes it free without marking it grandfathered."
            error={error}
          >
            <Input
              id="sub-price"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              aria-invalid={Boolean(error)}
            />
          </Field>

          <div>
            <label
              htmlFor="sub-grandfathered"
              className="flex items-center gap-2 text-sm font-medium text-foreground"
            >
              <input
                id="sub-grandfathered"
                type="checkbox"
                checked={grandfathered}
                onChange={(e) => setGrandfathered(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Grandfathered
            </label>
            <p className="text-xs text-foreground-muted mt-1.5">
              They were already using this when it became a paid add-on, so they keep
              it free. A grandfathered subscription is never billed, whatever price is
              set above.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={isPending}
            onClick={onSubmit}
          >
            Save price
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   Panel
   ============================================================ */

export function AgencyPricingPanel({
  tenantId,
  agencyName,
  charges,
  subscriptions,
  mrrPence
}: {
  tenantId: string;
  agencyName: string;
  charges: AgencyChargeRow[];
  subscriptions: AgencySubscriptionRow[];
  mrrPence: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AgencyChargeRow | null>(null);
  const [repricing, setRepricing] = useState<AgencySubscriptionRow | null>(null);

  const onDelete = (charge: AgencyChargeRow) => {
    const ok = window.confirm(
      `Remove "${charge.label}"?\n\nThis removes it from future invoices entirely. To stop billing it from a date while keeping the history, set an end date instead.`
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await deletePlatformChargeAction({ id: charge.id, tenantId });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">What they pay</h2>
          <p className="text-xs text-foreground-secondary mt-0.5">
            Their agreed monthly charges, plus the add-ons they switched on themselves.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tooltip content="Agreed charges plus active add-ons, less any recurring discount. This is what their next invoice will come to before envelopes and usage.">
            <span className="text-sm font-semibold text-foreground cursor-help tabular-nums">
              {formatPence(mrrPence)}/month
            </span>
          </Tooltip>
          <Button type="button" variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden />
            Add charge
          </Button>
        </div>
      </div>

      {charges.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-foreground-secondary">
            No agreed charges for {agencyName}. Until one is set they are billed only
            for the add-ons they switched on themselves — no base fee.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden />
            Set their monthly fee
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {charges.map((charge) => (
            <div
              key={charge.id}
              className={cn(
                "rounded-xl border border-border p-3",
                !charge.isLive && "opacity-60"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{charge.label}</p>
                    {charge.amountPence < 0 && (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                        discount
                      </span>
                    )}
                    {!charge.isLive && (
                      <Tooltip
                        content={
                          charge.billingStartsOn > new Date().toISOString().slice(0, 10)
                            ? "Starts in the future — not on the current invoice yet."
                            : "Ended — kept so past invoices still explain themselves."
                        }
                      >
                        <span className="inline-flex items-center rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-600 cursor-help">
                          not current
                        </span>
                      </Tooltip>
                    )}
                  </div>
                  <p className="text-[11px] text-foreground-muted mt-0.5">
                    From {shortDate(charge.billingStartsOn)}
                    {charge.endsOn ? ` to ${shortDate(charge.endsOn)}` : " · ongoing"}
                  </p>
                  {charge.notes && (
                    <p className="text-[11px] text-foreground-secondary mt-1">
                      {charge.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      charge.amountPence < 0 ? "text-emerald-700" : "text-foreground"
                    )}
                  >
                    {charge.amountPence < 0 ? "−" : ""}
                    {formatPence(Math.abs(charge.amountPence))}
                  </span>

                  <Tooltip content="Change the amount, the dates, or the note explaining the deal.">
                    <button
                      type="button"
                      onClick={() => setEditing(charge)}
                      aria-label="Edit charge"
                      className="text-foreground-muted hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </Tooltip>

                  <Tooltip content="Remove permanently. Prefer setting an end date, which stops future billing without losing the record.">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => onDelete(charge)}
                      aria-label="Delete charge"
                      className="text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {subscriptions.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            Add-ons
          </p>
          {subscriptions.map((sub) => (
            <div
              key={sub.integrationKey}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground">{sub.name}</p>
                  {sub.blockedOnUs && (
                    <Tooltip content="This scheme issues credentials per agency and only a super admin can apply them. The agency cannot clear this themselves — and they are being billed while they wait.">
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 cursor-help">
                        waiting on us
                      </span>
                    </Tooltip>
                  )}
                </div>
                <p className="text-[11px] text-foreground-muted mt-0.5">
                  {sub.status.replaceAll("_", " ")}
                  {sub.billingStartsOn ? ` · bills from ${shortDate(sub.billingStartsOn)}` : ""}
                  {sub.endsOn ? ` · ends ${shortDate(sub.endsOn)}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {sub.isGrandfathered ? (
                  <Tooltip content="Kept free when paid add-ons were introduced. Never billed, whatever price is on the record.">
                    <span className="text-sm text-foreground-muted cursor-help">
                      grandfathered
                    </span>
                  </Tooltip>
                ) : (
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {formatPence(sub.monthlyPricePence)}
                  </span>
                )}

                <Tooltip content="Override the catalogue price for this agency only — what a negotiated rate looks like.">
                  <button
                    type="button"
                    onClick={() => setRepricing(sub)}
                    aria-label={`Re-price ${sub.name}`}
                    className="text-foreground-muted hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <ChargeDialog tenantId={tenantId} open={addOpen} onOpenChange={setAddOpen} />
      )}

      {editing && (
        <ChargeDialog
          // Remount per charge so the dialog picks up that row as its initial state.
          key={editing.id}
          tenantId={tenantId}
          charge={editing}
          open
          onOpenChange={(next) => !next && setEditing(null)}
        />
      )}

      {repricing && (
        <SubscriptionPriceDialog
          key={repricing.integrationKey}
          tenantId={tenantId}
          subscription={repricing}
          open
          onOpenChange={(next) => !next && setRepricing(null)}
        />
      )}
    </div>
  );
}
