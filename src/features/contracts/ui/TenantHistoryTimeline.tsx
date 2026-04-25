"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { TenancyCard } from "./TenancyCard";
import { VoidCard } from "./VoidCard";
import { CloseoutDialog } from "./CloseoutDialog";
import type { TenantHistoryEntry, TenancyEntry } from "../domain/history";

export function TenantHistoryTimeline({
  entries,
  canCloseout,
  onCloseoutSuccess,
}: {
  entries: TenantHistoryEntry[];
  canCloseout: boolean;
  onCloseoutSuccess?: () => void;
}) {
  const [closeoutFor, setCloseoutFor] = useState<TenancyEntry | null>(null);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-card py-10 text-center">
        <Users className="h-7 w-7 text-foreground-muted mx-auto mb-2 opacity-40" />
        <p className="text-sm text-foreground-secondary">No tenancy history yet</p>
        <p className="text-xs text-foreground-muted mt-1">
          Once a contract is created for this unit, it will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {entries.map((entry, i) => {
          if (entry.kind === "void") {
            return <VoidCard key={`void-${i}`} entry={entry} />;
          }
          return (
            <TenancyCard
              key={entry.contractId}
              entry={entry}
              canCloseout={canCloseout}
              onCloseout={() => setCloseoutFor(entry)}
            />
          );
        })}
      </div>

      {closeoutFor && (
        <CloseoutDialog
          contract={closeoutFor}
          open={!!closeoutFor}
          onClose={() => setCloseoutFor(null)}
          onSuccess={onCloseoutSuccess}
        />
      )}
    </>
  );
}
