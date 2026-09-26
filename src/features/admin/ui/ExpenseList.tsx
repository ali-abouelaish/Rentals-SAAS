"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pause, Play, Trash2 } from "lucide-react";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { formatPence } from "@/lib/envelopes/packs";
import { COST_MODE_LABELS } from "@/lib/finance/platformExpenses";
import { deleteExpenseAction, setExpenseActiveAction } from "../actions/finance";
import { ExpenseDialog } from "./ExpenseDialog";
import type { PlatformExpense } from "../data/finance";

type Result = { error: string } | { success: true; message: string };

function shortDate(value: string | null): string {
  if (!value) return "";
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

export function ExpenseList({
  expenses,
  periodLabel
}: {
  expenses: PlatformExpense[];
  periodLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<Result>) => {
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  };

  const onDelete = (expense: PlatformExpense) => {
    // Deleting removes the cost from every month it ever applied to, which
    // silently changes past profit. Worth a confirm, and worth saying why.
    const ok = window.confirm(
      `Delete "${expense.label}"?\n\nThis removes it from every month it applied to, so past figures will change. To stop it going forward without touching history, pause it instead.`
    );
    if (!ok) return;
    run(() => deleteExpenseAction({ id: expense.id }));
  };

  if (expenses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm text-foreground-secondary">
          No expenses recorded yet. Add your hosting, Supabase and integration
          costs and this becomes a real P&amp;L.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {expenses.map((expense) => (
        <div
          key={expense.id}
          className={cn(
            "rounded-xl border border-border p-3",
            !expense.isActive && "opacity-60"
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-foreground">{expense.label}</p>
                <span className="inline-flex items-center rounded-full bg-surface-inset px-2 py-0.5 text-[11px] font-medium text-foreground-secondary">
                  {expense.categoryLabel}
                </span>
                {!expense.isActive && (
                  <span className="inline-flex items-center rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                    paused
                  </span>
                )}
              </div>

              <p className="text-[11px] text-foreground-muted mt-0.5">
                {formatPence(expense.amountPence)}
                {" · "}
                {COST_MODE_LABELS[expense.costMode].toLowerCase()}
                {expense.costMode === "amortised" && expense.amortiseMonths
                  ? ` over ${expense.amortiseMonths} months`
                  : ""}
                {expense.vendor ? ` · ${expense.vendor}` : ""}
                {" · from "}
                {shortDate(expense.startsOn)}
                {expense.endsOn ? ` to ${shortDate(expense.endsOn)}` : ""}
              </p>

              {expense.notes && (
                <p className="text-[11px] text-foreground-secondary mt-1">{expense.notes}</p>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Tooltip
                content={
                  expense.monthAmountPence > 0
                    ? `What this costs in ${periodLabel}. For an amortised cost that is the monthly slice, not the full amount.`
                    : `This does not apply to ${periodLabel} — it is outside its date range, or paused.`
                }
              >
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums cursor-help",
                    expense.monthAmountPence > 0
                      ? "text-foreground"
                      : "text-foreground-muted"
                  )}
                >
                  {expense.monthAmountPence > 0
                    ? formatPence(expense.monthAmountPence)
                    : "—"}
                </span>
              </Tooltip>

              <ExpenseDialog expense={expense} />

              <Tooltip
                content={
                  expense.isActive
                    ? "Stop counting this from now on. History is unaffected — use this when you are not sure, since it is reversible."
                    : "Start counting this again."
                }
              >
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    run(() =>
                      setExpenseActiveAction({
                        id: expense.id,
                        isActive: !expense.isActive
                      })
                    )
                  }
                  aria-label={expense.isActive ? "Pause expense" : "Resume expense"}
                  className="text-foreground-muted hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {expense.isActive ? (
                    <Pause className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Play className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
              </Tooltip>

              <Tooltip content="Delete permanently. Removes it from every month it applied to, changing past figures.">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onDelete(expense)}
                  aria-label="Delete expense"
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
  );
}
