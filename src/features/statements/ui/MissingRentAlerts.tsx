"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { resolveFlag } from "../actions/manage";
import type { FlagsGrouped } from "../data/queries";
import { formatPence } from "./bank-meta";

function ResolveButton({ flagId, onResolved }: { flagId: string; onResolved: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await resolveFlag(flagId);
      if (!result.ok) {
        alert(result.error ?? "Could not resolve.");
        return;
      }
      onResolved();
      router.refresh();
    });
  }

  return (
    <Button variant="secondary" size="xs" onClick={onClick} loading={isPending}>
      <CheckCircle2 className="h-3 w-3" />
      Mark resolved
    </Button>
  );
}

export function MissingRentAlerts({
  flags,
}: {
  flags: FlagsGrouped;
}) {
  const [openLandlords, setOpenLandlords] = useState<Set<string>>(
    new Set(flags.landlords.map((l) => l.manager_landlord_id ?? "unassigned")),
  );

  if (flags.total_missing === 0 && flags.resolved_count === 0) {
    return null;
  }

  function toggle(key: string) {
    setOpenLandlords((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {flags.total_missing > 0 && (
        <div className="rounded-xl border border-error/30 bg-error/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {flags.total_missing} contract{flags.total_missing === 1 ? "" : "s"} missing rent across{" "}
              {flags.landlords.length} landlord{flags.landlords.length === 1 ? "" : "s"}
              {flags.portfolio_name ? ` — ${flags.portfolio_name}` : ""}
            </p>
            <p className="text-xs text-foreground-secondary mt-0.5">
              No matching credit was found for these tenants during the statement period.
            </p>
          </div>
        </div>
      )}

      {flags.landlords.map((l) => {
        const key = l.manager_landlord_id ?? "unassigned";
        const isOpen = openLandlords.has(key);
        return (
          <div key={key} className="rounded-xl border border-border bg-surface-card overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(key)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-inset transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChevronDown
                  className={cn("h-4 w-4 text-foreground-muted transition-transform", isOpen && "rotate-180")}
                />
                <span className="text-sm font-semibold text-foreground">{l.landlord_name}</span>
                <span className="inline-flex items-center rounded-full border border-error/30 bg-error/10 px-2 py-0.5 text-[10px] font-semibold text-error">
                  {l.missing_count} missing
                </span>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-inset text-[11px] uppercase tracking-wider text-foreground-muted font-semibold">
                    <tr>
                      <th className="text-left px-4 py-2">Tenant</th>
                      <th className="text-left px-4 py-2">Property</th>
                      <th className="text-right px-4 py-2">Expected rent</th>
                      <th className="text-right px-4 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {l.flags.map((f) => (
                      <tr key={f.id} className="hover:bg-surface-inset transition-colors">
                        <td className="px-4 py-2.5 text-foreground text-xs">
                          {f.tenant_name ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-foreground-secondary text-xs">
                          {f.property_address ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-foreground">
                          {formatPence(f.expected_amount_pence)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <ResolveButton flagId={f.id} onResolved={() => undefined} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {flags.resolved_count > 0 && (
        <p className="text-xs text-foreground-muted text-center py-2">
          {flags.resolved_count} flag{flags.resolved_count === 1 ? "" : "s"} resolved
        </p>
      )}
    </div>
  );
}
