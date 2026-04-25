"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, DoorOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TenantHistoryTimeline } from "./TenantHistoryTimeline";
import { HistoryStatsStrip } from "./HistoryStatsStrip";
import type { PropertyHistory, UnitHistory } from "../domain/history";

function currentTenantOf(unit: UnitHistory): string | null {
  const top = unit.entries.find((e) => e.kind === "tenancy");
  if (top && top.kind === "tenancy" && top.endDate === null) return top.tenant.name;
  return null;
}

function currentVoidDays(unit: UnitHistory): number | null {
  const top = unit.entries[0];
  return top && top.kind === "void" && top.endDate === null
    ? top.durationDays
    : null;
}

function UnitAccordionRow({
  unit,
  defaultOpen,
  canCloseout,
  onCloseoutSuccess,
}: {
  unit: UnitHistory;
  defaultOpen: boolean;
  canCloseout: boolean;
  onCloseoutSuccess: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const currentTenant = currentTenantOf(unit);
  const voidDays = currentVoidDays(unit);

  return (
    <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-inset/40 transition-colors"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-inset border border-border">
          <DoorOpen className="h-4 w-4 text-foreground-muted" strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{unit.unit.label}</p>
          <p className="text-xs text-foreground-muted truncate">
            {currentTenant
              ? `Currently let to ${currentTenant}`
              : voidDays != null
                ? `Vacant — ${voidDays} day${voidDays === 1 ? "" : "s"}`
                : `${unit.stats.totalTenancies} tenancies`}
          </p>
        </div>
        {currentTenant ? (
          <span className="rounded-full bg-brand/10 border border-brand/20 px-2 py-0.5 text-[10px] font-semibold text-brand">
            Occupied
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            Vacant
          </span>
        )}
        <ChevronRight
          className={cn(
            "h-4 w-4 text-foreground-muted transition-transform",
            open && "rotate-90"
          )}
        />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          <HistoryStatsStrip stats={unit.stats} currentVoidDays={voidDays} />
          <TenantHistoryTimeline
            entries={unit.entries}
            canCloseout={canCloseout}
            onCloseoutSuccess={onCloseoutSuccess}
          />
        </div>
      )}
    </div>
  );
}

export function PropertyTenantHistory({
  history,
  canCloseout,
}: {
  history: PropertyHistory;
  canCloseout: boolean;
}) {
  const router = useRouter();
  // Page-level data is fetched server-side, so a router refresh re-runs
  // the route's `Promise.all` and pulls the new contract state.
  const onCloseoutSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  // Single-unit properties collapse to one timeline directly.
  if (history.units.length === 1) {
    const u = history.units[0];
    return (
      <div className="space-y-4">
        <HistoryStatsStrip stats={u.stats} currentVoidDays={currentVoidDays(u)} />
        <TenantHistoryTimeline
          entries={u.entries}
          canCloseout={canCloseout}
          onCloseoutSuccess={onCloseoutSuccess}
        />
      </div>
    );
  }

  if (history.units.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-card py-10 text-center">
        <p className="text-sm text-foreground-secondary">No units on this property yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HistoryStatsStrip stats={history.rollup} />
      <div className="space-y-2">
        {history.units.map((u, i) => (
          <UnitAccordionRow
            key={u.unit.id}
            unit={u}
            defaultOpen={i === 0}
            canCloseout={canCloseout}
            onCloseoutSuccess={onCloseoutSuccess}
          />
        ))}
      </div>
    </div>
  );
}
