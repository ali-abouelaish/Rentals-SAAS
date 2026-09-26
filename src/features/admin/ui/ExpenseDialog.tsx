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
import { Textarea } from "@/components/ui/textarea";
import { formatPence } from "@/lib/envelopes/packs";
import {
  COST_MODE_LABELS,
  EXPENSE_CATEGORIES,
  getExpenseCategory,
  type CostMode,
  type ExpenseCategory
} from "@/lib/finance/platformExpenses";
import { createExpenseAction, updateExpenseAction } from "../actions/finance";
import type { PlatformExpense } from "../data/finance";

const SELECT_CLASS =
  "flex h-10 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground";

const MODES: CostMode[] = ["recurring", "one_off", "amortised"];

const MODE_HINTS: Record<CostMode, string> = {
  recurring: "Charged every month from the start date until you set an end date.",
  one_off: "A single payment, counted entirely in the month it was incurred.",
  amortised:
    "A lump sum spread evenly across several months — an annual bill paid upfront, say."
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Field wrapper: visible label, hint under it, error under the control. */
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
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-600 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

export function ExpenseDialog({ expense }: { expense?: PlatformExpense }) {
  const router = useRouter();
  const isEdit = Boolean(expense);

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [category, setCategory] = useState<ExpenseCategory>(
    expense?.category ?? "infrastructure"
  );
  const [label, setLabel] = useState(expense?.label ?? "");
  const [vendor, setVendor] = useState(expense?.vendor ?? "");
  // Held as pounds — nobody types a hosting bill in pence.
  const [amount, setAmount] = useState(
    expense ? String(expense.amountPence / 100) : ""
  );
  const [costMode, setCostMode] = useState<CostMode>(expense?.costMode ?? "recurring");
  const [startsOn, setStartsOn] = useState(expense?.startsOn ?? todayIso());
  const [endsOn, setEndsOn] = useState(expense?.endsOn ?? "");
  const [amortiseMonths, setAmortiseMonths] = useState(
    expense?.amortiseMonths ? String(expense.amortiseMonths) : "12"
  );
  const [notes, setNotes] = useState(expense?.notes ?? "");

  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    if (isEdit) return; // Editing keeps the row's values on reopen.
    setCategory("infrastructure");
    setLabel("");
    setVendor("");
    setAmount("");
    setCostMode("recurring");
    setStartsOn(todayIso());
    setEndsOn("");
    setAmortiseMonths("12");
    setNotes("");
    setErrors({});
  };

  // Mirrors the zod schema in actions/finance.ts. The server validates again —
  // this only spares a round trip and puts each message beside its field.
  const validate = (): number | null => {
    const next: Record<string, string> = {};

    if (label.trim().length < 2) next.label = "Give it a name of at least 2 characters";
    if (label.trim().length > 120) next.label = "Keep the name under 120 characters";

    const pounds = Number(amount.trim());
    if (!amount.trim() || Number.isNaN(pounds)) {
      next.amount = "Enter an amount in pounds";
    } else if (pounds <= 0) {
      next.amount = "Amount must be more than zero";
    } else if (pounds > 1_000_000) {
      next.amount = "That is over £1,000,000 — check the amount";
    }

    if (!startsOn) next.startsOn = "Pick a start date";

    if (costMode === "amortised") {
      const months = Number(amortiseMonths);
      if (!months || months < 1) next.amortiseMonths = "Spread must be at least 1 month";
      else if (months > 120) next.amortiseMonths = "Spread cannot exceed 120 months";
    }

    if (costMode === "recurring" && endsOn && endsOn < startsOn) {
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
      category,
      label: label.trim(),
      vendor: vendor.trim() || undefined,
      amountPence,
      costMode,
      startsOn,
      endsOn: costMode === "recurring" && endsOn ? endsOn : null,
      amortiseMonths: costMode === "amortised" ? Number(amortiseMonths) : null,
      notes: notes.trim() || undefined
    };

    startTransition(async () => {
      const result = expense
        ? await updateExpenseAction({ ...payload, id: expense.id })
        : await createExpenseAction(payload);

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

  // Live preview of the monthly effect, which is the number that actually lands
  // on the P&L and is not the number being typed for an amortised cost.
  const monthlyPreview = (() => {
    const pounds = Number(amount.trim());
    if (!amount.trim() || Number.isNaN(pounds) || pounds <= 0) return null;
    const pence = Math.round(pounds * 100);

    if (costMode === "recurring") return `${formatPence(pence)} every month.`;
    if (costMode === "one_off") return `${formatPence(pence)} once, in the start month.`;

    const months = Number(amortiseMonths);
    if (!months || months < 1) return null;
    return `${formatPence(Math.floor(pence / months))} a month for ${months} months.`;
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
        {isEdit ? (
          <button
            type="button"
            className="text-[11px] font-medium text-foreground-secondary hover:text-foreground hover:underline"
          >
            Edit
          </button>
        ) : (
          <Button type="button" variant="secondary" size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden />
            Add expense
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit expense" : "Add an expense"}</DialogTitle>
          <DialogDescription>
            A cost of running Harbor Ops. Recorded once as a rule — it is counted
            into every month it applies to, so a monthly subscription is entered
            once, not twelve times.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field
            id="expense-label"
            label="What is it"
            hint="How it should read on the list. 2–120 characters."
            error={errors.label}
          >
            <Input
              id="expense-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Supabase Pro"
              maxLength={120}
              aria-invalid={Boolean(errors.label)}
            />
          </Field>

          <Field
            id="expense-category"
            label="Category"
            hint={getExpenseCategory(category)?.hint ?? "Group this cost for the breakdown."}
            error={errors.category}
          >
            <select
              id="expense-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className={SELECT_CLASS}
            >
              {EXPENSE_CATEGORIES.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="expense-amount"
            label="Amount (£)"
            hint={
              costMode === "amortised"
                ? "The full amount paid, not the monthly slice — we work that out."
                : "In pounds. Decimals are fine, e.g. 8.99."
            }
            error={errors.amount}
          >
            <Input
              id="expense-amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="200.00"
              aria-invalid={Boolean(errors.amount)}
            />
          </Field>

          <Field
            id="expense-mode"
            label="How it is charged"
            hint={MODE_HINTS[costMode]}
            error={errors.costMode}
          >
            <select
              id="expense-mode"
              value={costMode}
              onChange={(e) => setCostMode(e.target.value as CostMode)}
              className={SELECT_CLASS}
            >
              {MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {COST_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </Field>

          {costMode === "amortised" && (
            <Field
              id="expense-months"
              label="Spread over (months)"
              hint="1–120. The last month absorbs any rounding, so the slices add up exactly."
              error={errors.amortiseMonths}
            >
              <Input
                id="expense-months"
                type="number"
                min="1"
                max="120"
                value={amortiseMonths}
                onChange={(e) => setAmortiseMonths(e.target.value)}
                aria-invalid={Boolean(errors.amortiseMonths)}
              />
            </Field>
          )}

          <Field
            id="expense-starts"
            label={costMode === "one_off" ? "Date incurred" : "Starts"}
            hint={
              costMode === "one_off"
                ? "The month this lands in."
                : "The first month this is counted. Nothing before it is affected."
            }
            error={errors.startsOn}
          >
            <Input
              id="expense-starts"
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              aria-invalid={Boolean(errors.startsOn)}
            />
          </Field>

          {costMode === "recurring" && (
            <Field
              id="expense-ends"
              label="Ends (optional)"
              hint="Leave blank while it is ongoing. Set it when you cancel — earlier months keep the cost."
              error={errors.endsOn}
            >
              <Input
                id="expense-ends"
                type="date"
                value={endsOn}
                onChange={(e) => setEndsOn(e.target.value)}
                aria-invalid={Boolean(errors.endsOn)}
              />
            </Field>
          )}

          <Field
            id="expense-vendor"
            label="Vendor (optional)"
            hint="Who you pay. Useful when the name alone is ambiguous."
            error={errors.vendor}
          >
            <Input
              id="expense-vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Supabase"
              maxLength={120}
            />
          </Field>

          <Field
            id="expense-notes"
            label="Notes (optional)"
            hint="Anything worth remembering — plan tier, renewal terms. Max 1000 characters."
            error={errors.notes}
          >
            <Textarea
              id="expense-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={1000}
            />
          </Field>

          {monthlyPreview && (
            <p className="rounded-lg bg-surface-inset px-3 py-2 text-xs text-foreground-secondary">
              {monthlyPreview}
            </p>
          )}
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
            {isEdit ? "Save changes" : "Add expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
