"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TenantHistoryTimeline } from "./TenantHistoryTimeline";
import { HistoryStatsStrip } from "./HistoryStatsStrip";
import { fetchUnitTenantHistory } from "../actions/contracts";
import type { UnitHistory } from "../domain/history";

function currentVoidDays(history: UnitHistory): number | null {
  const top = history.entries[0];
  return top && top.kind === "void" && top.endDate === null
    ? top.durationDays
    : null;
}

export function UnitHistoryPanel({ unitId }: { unitId: string }) {
  const router = useRouter();
  const [history, setHistory] = useState<UnitHistory | null>(null);
  const [canCloseout, setCanCloseout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => {
    setReloadKey((k) => k + 1);
    // Server-rendered surfaces (Property page Tenants tab, unit list)
    // also need to re-pull contract/unit state.
    router.refresh();
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    setHistory(null);
    setError(null);
    fetchUnitTenantHistory(unitId)
      .then((res) => {
        if (cancelled) return;
        setHistory(res.history);
        setCanCloseout(res.canCloseout);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load history");
      });
    return () => {
      cancelled = true;
    };
  }, [unitId, reloadKey]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!history) {
    return (
      <div className="space-y-2">
        <div className="h-16 rounded-xl bg-surface-inset animate-pulse" />
        <div className="h-20 rounded-xl bg-surface-inset animate-pulse" />
        <div className="h-20 rounded-xl bg-surface-inset animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HistoryStatsStrip stats={history.stats} currentVoidDays={currentVoidDays(history)} />
      <TenantHistoryTimeline
        entries={history.entries}
        canCloseout={canCloseout}
        onCloseoutSuccess={refetch}
      />
    </div>
  );
}
