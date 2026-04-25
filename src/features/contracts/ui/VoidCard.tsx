"use client";

import { Clock } from "lucide-react";
import type { VoidEntry } from "../domain/history";

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function VoidCard({ entry }: { entry: VoidEntry }) {
  const ongoing = entry.endDate === null;
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-inset/40 p-3">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-surface-inset flex items-center justify-center shrink-0">
          <Clock className="h-3.5 w-3.5 text-foreground-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground-secondary">
            {ongoing
              ? `Vacant — ${entry.durationDays} day${entry.durationDays === 1 ? "" : "s"} (and counting)`
              : `Vacant — ${entry.durationDays} day${entry.durationDays === 1 ? "" : "s"}`}
          </p>
          <p className="text-[11px] text-foreground-muted">
            {dateFmt(entry.startDate)}
            {" → "}
            {entry.endDate ? dateFmt(entry.endDate) : "Present"}
          </p>
        </div>
      </div>
    </div>
  );
}
