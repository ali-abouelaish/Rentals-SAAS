"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Ban, FileText, RefreshCw, RotateCcw, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { formatPence } from "@/lib/utils/formatters";
import {
  addAdjustmentLine,
  deleteOwnerTransaction,
  regenerateOwnerStatement,
  sendOwnerStatement,
  setCostRechargeable,
  viewOwnerStatementPdf,
  voidOwnerStatement,
} from "../actions/owner-statements";
import { monthLabel } from "../domain/derive";
import {
  adjustmentLineSchema,
  TRANSACTION_TYPE_LABELS,
  type AdjustmentLineInput,
  type OwnerStatementWithLines,
  type OwnerTransaction,
} from "../domain/types";
import { FeeOverrideDialog } from "./FeeOverrideDialog";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-surface-inset text-foreground-secondary",
  approved: "bg-blue-100 text-blue-800",
  sent: "bg-emerald-100 text-emerald-800",
  void: "bg-red-100 text-red-800",
};

function SummaryRow({
  label,
  value,
  strong,
  hint,
  action,
}: {
  label: string;
  value: string;
  strong?: boolean;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/60 last:border-0">
      <span className="flex items-center gap-2">
        <span className={strong ? "font-semibold text-foreground" : "text-foreground-secondary"}>
          {label}
        </span>
        {hint && (
          <Tooltip content={hint}>
            <span className="text-[11px] rounded-full border border-border px-1.5 text-foreground-muted cursor-help">
              ?
            </span>
          </Tooltip>
        )}
        {action}
      </span>
      <span
        className={`tabular-nums whitespace-nowrap ${strong ? "font-semibold text-foreground" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}

export function OwnerStatementDetail({ statement }: { statement: OwnerStatementWithLines }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const editable = statement.status === "draft" || statement.status === "approved";
  const ownerHref = `/owners/${statement.owner_id}`;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdjustmentLineInput>({
    resolver: zodResolver(adjustmentLineSchema),
    defaultValues: {
      statement_id: statement.id,
      type: "other_deduction",
      txn_date: statement.period_end,
      property_id: null,
    },
  });

  const run = (fn: () => Promise<unknown>, success?: string) => {
    startTransition(async () => {
      try {
        await fn();
        if (success) toast.success(success);
        router.refresh();
      } catch (err) {
        toast.error("Action failed", {
          description: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
    });
  };

  const onAddLine = (values: AdjustmentLineInput) => {
    startTransition(async () => {
      try {
        await addAdjustmentLine(values);
        toast.success("Line added.");
        reset({
          statement_id: statement.id,
          type: values.type,
          txn_date: values.txn_date,
          property_id: null,
          description: "",
          amount: undefined as unknown as number,
        });
        router.refresh();
      } catch (err) {
        toast.error("Failed to add line", {
          description: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
    });
  };

  // Group lines by property for display.
  const groups = new Map<string, OwnerTransaction[]>();
  for (const l of statement.transactions) {
    const key = l.property_id ?? "__general__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }

  const propertyOptions = Object.entries(statement.property_names);
  const isFeeOverridden = statement.fee_override_type != null;
  const excluded = statement.excluded_works;
  const excludedTotal = excluded.reduce((s, c) => s + c.amount_pence, 0);

  /** Maintenance costs are keyed by their source row so the toggle can flip them. */
  const worksSourceIds = new Map<string, string>();
  for (const l of statement.transactions) {
    if (l.type === "works_order" && l.source_kind === "maintenance_cost" && l.source_id) {
      worksSourceIds.set(l.id, l.source_id);
    }
  }

  return (
    <div className="space-y-[var(--gap-bento)]">
      <Link
        href={ownerHref}
        className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {statement.owner?.name ?? "landlord"}
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-heading">
            {monthLabel(statement.period_year, statement.period_month)}
          </h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            {statement.owner?.name ?? "Owner"}
            {statement.owner?.email ? ` · ${statement.owner.email}` : ""}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
            STATUS_STYLES[statement.status] ?? STATUS_STYLES.draft
          }`}
        >
          {statement.status}
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip content="Opens the generated PDF via a link that expires in an hour.">
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => run(() => viewOwnerStatementPdf(statement.id))}
          >
            <FileText className="h-4 w-4 mr-1.5" /> Preview PDF
          </Button>
        </Tooltip>

        {editable && (
          <Tooltip content="Re-pulls rent, rechargeable works and the fee from source data. Lines you added by hand are kept.">
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => run(() => regenerateOwnerStatement(statement.id), "Statement refreshed.")}
            >
              <RefreshCw className="h-4 w-4 mr-1.5" /> Regenerate
            </Button>
          </Tooltip>
        )}

        {statement.status !== "void" && (
          <Tooltip
            content={
              statement.owner?.email
                ? "Emails the PDF to the landlord and locks the statement so the figures can't change afterwards."
                : "This landlord has no email address on file — add one on their Overview tab."
            }
          >
            <Button
              variant="secondary"
              size="sm"
              disabled={isPending || !statement.owner?.email}
              onClick={() =>
                run(() => sendOwnerStatement(statement.id), "Statement emailed to the landlord.")
              }
            >
              <Send className="h-4 w-4 mr-1.5" />
              {statement.status === "sent" ? "Resend" : "Send to landlord"}
            </Button>
          </Tooltip>
        )}

        {statement.status !== "void" && (
          <Tooltip content="Cancels this statement. Later periods are recalculated so their opening balances stay correct.">
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => run(() => voidOwnerStatement(statement.id), "Statement voided.")}
              className="text-red-600 hover:text-red-700"
            >
              <Ban className="h-4 w-4 mr-1.5" /> Void
            </Button>
          </Tooltip>
        )}
      </div>

      {/* Properties with no agreed rent contribute nothing — say so rather
          than quietly producing a short statement. */}
      {statement.properties_missing_rent.length > 0 && (
        <div className="rounded-bento border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            No agreed rent set on {statement.properties_missing_rent.length} propert
            {statement.properties_missing_rent.length === 1 ? "y" : "ies"}
          </p>
          <p className="text-xs text-amber-800 mt-1">
            Rent on a statement comes from each property&apos;s <strong>monthly rent owed</strong>.
            These contribute nothing until it&apos;s set:{" "}
            {statement.properties_missing_rent.map((p, i) => (
              <span key={p.id}>
                {i > 0 ? ", " : ""}
                <Link href={`/properties/${p.id}`} className="underline hover:no-underline">
                  {p.name}
                </Link>
              </span>
            ))}
            . Set it, then <strong>Regenerate</strong>.
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-bento bg-surface-card shadow-bento p-5 max-w-lg">
        <h2 className="text-sm font-semibold text-foreground mb-2">Summary</h2>
        <SummaryRow
          label="Opening balance"
          value={formatPence(statement.opening_balance_pence)}
          hint="Carried over from the previous statement — what you were still holding for this landlord."
        />
        <SummaryRow
          label="Rent due"
          value={formatPence(statement.total_rent_received_pence)}
          hint="The rent contracted on each property for this period. Not what tenants actually paid — voids and arrears stay with the agency."
        />
        <SummaryRow
          label="Management fee"
          value={`−${formatPence(statement.total_management_fee_pence)}`}
          hint="Your fee for the period. Edit to change it for this month only."
          action={
            editable ? (
              <span className="flex items-center gap-2">
                <FeeOverrideDialog statement={statement} />
                {isFeeOverridden && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    adjusted
                  </span>
                )}
              </span>
            ) : isFeeOverridden ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                adjusted
              </span>
            ) : null
          }
        />
        <SummaryRow
          label="Works orders"
          value={`−${formatPence(statement.total_works_pence)}`}
          hint="Maintenance costs recharged to the landlord. Costs you absorbed are listed separately below."
        />
        <SummaryRow label="Other deductions" value={`−${formatPence(statement.total_other_pence)}`} />
        <SummaryRow
          label="Net for the period"
          value={formatPence(statement.net_to_owner_pence)}
          strong
          hint="Rent due less the fee, works and other deductions — what this month earned the landlord."
        />
        <SummaryRow
          label="Closing balance"
          value={formatPence(statement.closing_balance_pence)}
          strong
          hint="Opening balance plus the net for the period, less anything already paid out and any manual corrections. Carries into next month."
        />
      </div>

      {/* Lines */}
      <div className="rounded-bento bg-surface-card shadow-bento p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Transactions</h2>
        {statement.transactions.length === 0 ? (
          <p className="text-sm text-foreground-secondary">
            No transactions for this period. If you expected some, check that this landlord&apos;s
            properties have a monthly rent owed set, then Regenerate.
          </p>
        ) : (
          <div className="space-y-5">
            {[...groups.entries()].map(([key, lines]) => (
              <div key={key}>
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted mb-2">
                  {key === "__general__" ? "General" : statement.property_names[key] ?? "Property"}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {lines.map((l) => {
                        const costId = worksSourceIds.get(l.id);
                        return (
                          <tr key={l.id} className="border-b border-border/60 last:border-0">
                            <td className="py-2 pr-3 text-foreground-secondary whitespace-nowrap">
                              {new Date(l.txn_date).toLocaleDateString("en-GB")}
                            </td>
                            <td className="py-2 pr-3 text-foreground">
                              {l.description ?? TRANSACTION_TYPE_LABELS[l.type]}
                              {l.is_manual ? (
                                <span className="ml-2 text-xs text-foreground-muted">(added by hand)</span>
                              ) : null}
                            </td>
                            <td className="py-2 pr-3 text-foreground-muted whitespace-nowrap">
                              {TRANSACTION_TYPE_LABELS[l.type]}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">
                              {l.direction === "out" ? "−" : "+"}
                              {formatPence(l.amount_pence)}
                            </td>
                            <td className="py-2 w-32 text-right whitespace-nowrap">
                              {editable && costId ? (
                                <Tooltip content="Stop charging this cost to the landlord. The change is saved on the cost itself, so it stays excluded when you regenerate.">
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() =>
                                      run(
                                        () => setCostRechargeable(statement.id, costId, false),
                                        "Cost is no longer charged to the landlord."
                                      )
                                    }
                                    className="text-xs text-foreground-muted hover:text-foreground underline"
                                  >
                                    Don&apos;t charge
                                  </button>
                                </Tooltip>
                              ) : editable && l.is_manual ? (
                                <Tooltip content="Remove this line. Derived rent, works and fee lines are refreshed by Regenerate instead.">
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => run(() => deleteOwnerTransaction(l.id), "Line removed.")}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </Tooltip>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Costs deliberately absorbed */}
      {excluded.length > 0 && (
        <details className="rounded-bento bg-surface-card shadow-bento p-5">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            Not charged to the landlord ({excluded.length}) ·{" "}
            <span className="font-normal text-foreground-secondary">{formatPence(excludedTotal)}</span>
          </summary>
          <p className="text-xs text-foreground-muted mt-2 mb-3">
            Maintenance costs in this period that your agency is absorbing. They don&apos;t appear on
            the landlord&apos;s PDF. Charge one back if it was flagged in error.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {excluded.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-foreground-secondary whitespace-nowrap">
                      {new Date(c.date_incurred).toLocaleDateString("en-GB")}
                    </td>
                    <td className="py-2 pr-3 text-foreground">
                      {c.description}
                      {c.supplier ? (
                        <span className="text-foreground-muted"> ({c.supplier})</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-foreground-muted">
                      {c.property_id ? statement.property_names[c.property_id] ?? "Property" : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap text-foreground-secondary">
                      {formatPence(c.amount_pence)}
                    </td>
                    <td className="py-2 w-24 text-right">
                      {editable && (
                        <Tooltip content="Add this cost back onto the statement and charge it to the landlord.">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              run(
                                () => setCostRechargeable(statement.id, c.id, true),
                                "Cost charged to the landlord."
                              )
                            }
                            className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                          >
                            <RotateCcw className="h-3 w-3" /> Charge
                          </button>
                        </Tooltip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Add a line */}
      {editable && (
        <div className="rounded-bento bg-surface-card shadow-bento p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">Add a line</h2>
          <p className="text-xs text-foreground-muted mb-4">
            For anything not pulled in automatically — a deduction, a payment you&apos;ve already made
            to the landlord, or a correction. Rent, works and fee lines are refreshed by Regenerate.
          </p>
          <form onSubmit={handleSubmit(onAddLine)} className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-foreground" htmlFor="type">
                Type
              </label>
              <p className="text-[11px] text-foreground-muted mt-0.5 mb-1">
                Deductions and payments reduce the balance.
              </p>
              <select id="type" {...register("type")} className={inputCls}>
                <option value="other_deduction">Other deduction</option>
                <option value="payment_to_owner">Payment to landlord</option>
                <option value="adjustment">Adjustment</option>
                <option value="rent_received">Additional rent</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-foreground" htmlFor="description">
                Description
              </label>
              <p className="text-[11px] text-foreground-muted mt-0.5 mb-1">
                Shown on the landlord&apos;s PDF. Max 200 characters.
              </p>
              <input
                id="description"
                {...register("description")}
                className={inputCls}
                placeholder="e.g. Gardening — recharged"
              />
              {errors.description && (
                <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground" htmlFor="amount">
                Amount (£)
              </label>
              <p className="text-[11px] text-foreground-muted mt-0.5 mb-1">In pounds, e.g. 45.00.</p>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                {...register("amount", { valueAsNumber: true })}
                className={inputCls}
                placeholder="0.00"
              />
              {errors.amount && <p className="text-xs text-red-600 mt-1">{errors.amount.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground" htmlFor="txn_date">
                Date
              </label>
              <p className="text-[11px] text-foreground-muted mt-0.5 mb-1">
                Use a date inside the statement period.
              </p>
              <input id="txn_date" type="date" {...register("txn_date")} className={inputCls} />
              {errors.txn_date && (
                <p className="text-xs text-red-600 mt-1">{errors.txn_date.message}</p>
              )}
            </div>

            {propertyOptions.length > 0 && (
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground" htmlFor="property_id">
                  Property (optional)
                </label>
                <p className="text-[11px] text-foreground-muted mt-0.5 mb-1">
                  Groups the line under a property on the PDF.
                </p>
                <select id="property_id" {...register("property_id")} className={inputCls}>
                  <option value="">General (no property)</option>
                  {propertyOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="md:col-span-1 flex items-end">
              <Button type="submit" variant="secondary" size="md" loading={isPending} className="w-full">
                Add line
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
