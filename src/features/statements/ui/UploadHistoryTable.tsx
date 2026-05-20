"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { deleteUpload } from "../actions/manage";
import type { StatementUploadRow } from "../data/queries";
import { BANK_META, formatDateRange, formatShortDate } from "./bank-meta";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    parsed: "bg-success/10 text-success border-success/30",
    failed: "bg-error/10 text-error border-error/30",
    pending: "bg-surface-inset text-foreground-secondary border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        map[status] ?? map.pending,
      )}
    >
      {status}
    </span>
  );
}

function DeleteButton({ uploadId, filename }: { uploadId: string; filename: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(`Delete "${filename}" and all its transactions?`)) return;
    startTransition(async () => {
      const result = await deleteUpload(uploadId);
      if (!result.ok) {
        alert(result.error ?? "Could not delete.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-error hover:bg-error/10 transition-colors disabled:opacity-50"
      aria-label="Delete upload"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

export function UploadHistoryTable({ rows }: { rows: StatementUploadRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-card py-12 text-center">
        <p className="text-sm font-semibold text-foreground mb-1">No statements yet</p>
        <p className="text-xs text-foreground-muted max-w-sm mx-auto">
          Upload your first CSV or PDF above to detect transactions and flag any missing rent.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-inset text-[11px] uppercase tracking-wider text-foreground-muted font-semibold">
            <tr>
              <th className="text-left px-4 py-2.5">Filename</th>
              <th className="text-left px-4 py-2.5">Portfolio</th>
              <th className="text-left px-4 py-2.5">Bank</th>
              <th className="text-left px-4 py-2.5">Date range</th>
              <th className="text-right px-4 py-2.5">Credits</th>
              <th className="text-right px-4 py-2.5">Missing</th>
              <th className="text-left px-4 py-2.5">Uploaded</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const bank =
                row.bank_name && row.bank_name in BANK_META
                  ? BANK_META[row.bank_name as keyof typeof BANK_META]
                  : BANK_META.unknown;
              return (
                <tr key={row.id} className="hover:bg-surface-inset transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/rent-collection/statements/${row.id}`}
                      className="font-medium text-foreground hover:text-brand"
                    >
                      {row.filename}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground-secondary">
                    {row.portfolio?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        bank.chipClass,
                      )}
                    >
                      {bank.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground-secondary text-xs">
                    {formatDateRange(row.statement_from, row.statement_to)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    <span className="text-success font-semibold">{row.matched_count}</span>
                    <span className="text-foreground-muted"> / {row.total_credits}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.missing_count > 0 ? (
                      <span className="text-error font-semibold">{row.missing_count}</span>
                    ) : (
                      <span className="text-foreground-muted">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground-secondary text-xs">
                    {formatShortDate(row.uploaded_at)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" aria-label="View upload">
                        <Link href={`/rent-collection/statements/${row.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <DeleteButton uploadId={row.id} filename={row.filename} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
