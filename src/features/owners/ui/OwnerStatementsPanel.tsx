"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { formatDate, formatPence } from "@/lib/utils/formatters";
import { generateOwnerStatement } from "@/features/owner-statements/actions/owner-statements";
import { monthLabel } from "@/features/owner-statements/domain/derive";
import type { OwnerStatementListItem } from "@/features/owner-statements/domain/types";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-surface-inset text-foreground-secondary",
  approved: "bg-blue-100 text-blue-800",
  sent: "bg-emerald-100 text-emerald-800",
  void: "bg-red-100 text-red-800",
};

/** Previous calendar month as a yyyy-MM string, the usual thing to generate. */
function defaultPeriod(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function OwnerStatementsPanel({
  ownerId,
  statements,
  propertyCount,
}: {
  ownerId: string;
  statements: OwnerStatementListItem[];
  propertyCount: number;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState(defaultPeriod());
  const [isPending, startTransition] = useTransition();

  const onGenerate = () => {
    const [yearStr, monthStr] = period.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month) {
      toast.error("Pick a month first.");
      return;
    }
    startTransition(async () => {
      try {
        const id = await generateOwnerStatement(ownerId, year, month);
        toast.success(`Statement drafted for ${monthLabel(year, month)}.`);
        router.push(`/owners/${ownerId}/statements/${id}`);
      } catch (err) {
        toast.error("Could not generate statement", {
          description: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
    });
  };

  return (
    <div className="space-y-[var(--gap-bento)]">
      {/* ── Generate ────────────────────────────────────── */}
      <div className="rounded-bento bg-surface-card shadow-bento p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Generate a statement</h2>
        <p className="text-xs text-foreground-muted mb-4">
          Pulls the rent owed on each of their properties, rechargeable maintenance costs and the
          management fee for the month you pick. Re-running refreshes those figures and keeps any
          lines you added by hand.
        </p>

        {propertyCount === 0 ? (
          <p className="text-sm text-foreground-secondary">
            This landlord doesn&apos;t own any properties yet. Set them as the owner on a property
            (Ownership section) before generating a statement.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="period" className="text-sm font-medium text-foreground">
                Period
              </label>
              <p className="text-[11px] text-foreground-muted mt-0.5 mb-1">
                One calendar month. Defaults to last month.
              </p>
              <input
                id="period"
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="h-11 md:h-9 rounded-lg border border-border bg-surface-inset px-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
            <Tooltip content="Creates a draft you can edit. Nothing is emailed to the landlord until you send it.">
              <Button variant="secondary" size="md" loading={isPending} onClick={onGenerate}>
                <Plus className="h-4 w-4 mr-1.5" />
                Generate draft
              </Button>
            </Tooltip>
          </div>
        )}
      </div>

      {/* ── History ─────────────────────────────────────── */}
      <div className="rounded-bento bg-surface-card shadow-bento p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Past statements</h2>
        {statements.length === 0 ? (
          <p className="text-sm text-foreground-secondary">
            No statements yet. Generate one above and it will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-foreground-muted">
                  <th className="pb-2 pr-3 font-medium">Period</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 pr-3 font-medium text-right">Rent</th>
                  <th className="pb-2 pr-3 font-medium text-right">Fee</th>
                  <th className="pb-2 pr-3 font-medium text-right">Works</th>
                  <th className="pb-2 pr-3 font-medium text-right">Net</th>
                  <th className="pb-2 pr-3 font-medium text-right">Closing</th>
                  <th className="pb-2 font-medium">Sent</th>
                </tr>
              </thead>
              <tbody>
                {statements.map((s) => (
                  <tr key={s.id} className="border-t border-border/60">
                    <td className="py-2 pr-3">
                      <Link
                        href={`/owners/${ownerId}/statements/${s.id}`}
                        className="inline-flex min-h-11 md:min-h-0 items-center gap-1.5 text-brand hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {monthLabel(s.period_year, s.period_month)}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          STATUS_STYLES[s.status] ?? STATUS_STYLES.draft
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatPence(s.total_rent_received_pence)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-foreground-secondary">
                      {formatPence(s.total_management_fee_pence)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-foreground-secondary">
                      {formatPence(s.total_works_pence)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums font-medium">
                      {formatPence(s.net_to_owner_pence)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatPence(s.closing_balance_pence)}
                    </td>
                    <td className="py-2 text-foreground-secondary whitespace-nowrap">
                      {s.sent_at ? formatDate(s.sent_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
