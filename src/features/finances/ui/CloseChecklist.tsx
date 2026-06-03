"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Lock,
  Unlock,
  ClipboardCheck,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  beginReview,
  closeMonth,
  reopenMonth,
  refreshChecklist,
  toggleAttestation,
} from "../actions/closes";
import type {
  MonthlyClose,
  MonthlyCloseChecklist,
} from "../domain/closes";
import type { FinanceMonthRollup } from "../domain/types";

type Props = {
  year: number;
  month: number;
  monthLabel: string;
  monthKey: string;
  rollup: FinanceMonthRollup;
  close: MonthlyClose | null;
  isFutureOrCurrent: boolean;
  canReopen: boolean;
};

function formatPounds(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString()}`;
}

const AUTO_KEYS: Array<{
  key: keyof Pick<MonthlyCloseChecklist, "rent_recorded" | "recurring_posted" | "bank_reconciled">;
  label: string;
  hint: string;
}> = [
  {
    key: "rent_recorded",
    label: "Rent payments recorded",
    hint: "At least one rent_payments row exists for this month.",
  },
  {
    key: "recurring_posted",
    label: "Recurring entries posted",
    hint: "Finance entries materialized via the Post recurring action on the hub.",
  },
  {
    key: "bank_reconciled",
    label: "Bank statement reconciled",
    hint: "A statement was uploaded and no unresolved missing-rent flags remain.",
  },
];

const ATTEST_KEYS: Array<{
  key: "costs_reviewed" | "overheads_reviewed";
  label: string;
  hint: string;
}> = [
  {
    key: "costs_reviewed",
    label: "Property costs reviewed",
    hint: "I've checked the per-property costs are accurate for this month.",
  },
  {
    key: "overheads_reviewed",
    label: "Admin overheads reviewed",
    hint: "I've checked the business-level overheads are accurate for this month.",
  },
];

export function CloseChecklist({
  year,
  month,
  monthLabel,
  monthKey,
  rollup,
  close,
  isFutureOrCurrent,
  canReopen,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<null | "refresh" | "review" | "close" | "reopen" | "attest">(
    null
  );

  const status = close?.status ?? "open";
  const checklist: MonthlyCloseChecklist = {
    rent_recorded: close?.checklist?.rent_recorded ?? false,
    recurring_posted: close?.checklist?.recurring_posted ?? false,
    bank_reconciled: close?.checklist?.bank_reconciled ?? false,
    costs_reviewed: close?.checklist?.costs_reviewed ?? false,
    overheads_reviewed: close?.checklist?.overheads_reviewed ?? false,
  };

  const isClosed = status === "closed";
  const allChecked = Object.values(checklist).every(Boolean);

  async function runRefresh() {
    setBusy("refresh");
    try {
      const res = await refreshChecklist({ year, month });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Checklist refreshed");
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(null);
    }
  }

  async function runBeginReview() {
    setBusy("review");
    try {
      const res = await beginReview({ year, month });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Marked as in review");
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(null);
    }
  }

  async function runClose() {
    if (!confirm(`Close ${monthLabel}? You'll need super-admin access to reopen.`)) return;
    setBusy("close");
    try {
      const res = await closeMonth({ year, month });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success(`${monthLabel} closed`);
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(null);
    }
  }

  async function runReopen() {
    if (!confirm(`Reopen ${monthLabel}? The close snapshot will be retained for audit.`)) return;
    setBusy("reopen");
    try {
      const res = await reopenMonth({ year, month });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success(`${monthLabel} reopened`);
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(null);
    }
  }

  async function runAttest(key: "costs_reviewed" | "overheads_reviewed", value: boolean) {
    setBusy("attest");
    try {
      const res = await toggleAttestation({ year, month, key, value });
      if ("error" in res) toast.error(res.error);
      else startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
          <ClipboardCheck className="h-5 w-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Monthly Close · {monthLabel}
            </h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-xs text-foreground-secondary truncate">
            Reconcile, attest, then lock the period to freeze totals.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/finances?month=${monthKey}`}>Back to hub</Link>
        </Button>
      </div>

      {isFutureOrCurrent ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            You can only close months that have fully ended. Pick a past month from the hub&apos;s
            month picker.
          </span>
        </div>
      ) : null}

      {/* Snapshot preview */}
      <div className="rounded-xl border border-border bg-surface-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Snapshot preview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Mini label="Rent received" value={formatPounds(rollup.rent_received)} />
          <Mini label="Outstanding" value={formatPounds(rollup.rent_outstanding)} />
          <Mini label="Total costs" value={formatPounds(rollup.total_costs)} />
          <Mini
            label="Net profit"
            value={formatPounds(rollup.net_profit)}
            tone={rollup.net_profit < 0 ? "danger" : "success"}
          />
        </div>
        <p className="text-[11px] text-foreground-secondary mt-3">
          These are the figures that will be frozen into the close snapshot when you press Close
          month.
        </p>
      </div>

      {/* Checklist */}
      <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Checklist</h2>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={runRefresh}
            disabled={busy === "refresh" || isClosed}
          >
            {busy === "refresh" && <Loader2 className="h-3 w-3 animate-spin" />}
            Refresh
          </Button>
        </div>
        <ul className="divide-y divide-border">
          {AUTO_KEYS.map((row) => (
            <ChecklistRow
              key={row.key}
              checked={checklist[row.key]}
              label={row.label}
              hint={row.hint}
              actionLabel="Auto-detected"
            />
          ))}
          {ATTEST_KEYS.map((row) => (
            <ChecklistRow
              key={row.key}
              checked={checklist[row.key]}
              label={row.label}
              hint={row.hint}
              actionLabel={
                <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklist[row.key]}
                    disabled={isClosed || busy === "attest"}
                    onChange={(e) => runAttest(row.key, e.target.checked)}
                    className="rounded border-border text-brand focus:ring-brand"
                  />
                  <span>I&apos;ve reviewed</span>
                </label>
              }
            />
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {!isClosed && (
          <>
            {status === "open" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={runBeginReview}
                disabled={busy === "review" || pending}
              >
                {busy === "review" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Mark in review
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={runClose}
              disabled={busy === "close" || pending || isFutureOrCurrent || !allChecked}
            >
              {busy === "close" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              Close {monthLabel}
            </Button>
            {!allChecked && !isFutureOrCurrent ? (
              <span className="text-[11px] text-foreground-secondary">
                Tick every item before closing.
              </span>
            ) : null}
          </>
        )}
        {isClosed ? (
          <>
            <Button
              asChild
              variant="secondary"
              size="sm"
            >
              <Link href={`/finances/close/${year}/${String(month).padStart(2, "0")}`}>
                <ClipboardCheck className="h-3.5 w-3.5" />
                View close summary
              </Link>
            </Button>
            {canReopen ? (
              <Button
                variant="outline"
                size="sm"
                onClick={runReopen}
                disabled={busy === "reopen" || pending}
              >
                {busy === "reopen" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unlock className="h-3.5 w-3.5" />
                )}
                Reopen month
              </Button>
            ) : (
              <span className="text-[11px] text-foreground-secondary">
                Reopen requires super admin access.
              </span>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function ChecklistRow({
  checked,
  label,
  hint,
  actionLabel,
}: {
  checked: boolean;
  label: string;
  hint: string;
  actionLabel: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5">
        {checked ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <Circle className="h-4 w-4 text-foreground-muted" />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="text-[11px] text-foreground-secondary mt-0.5">{hint}</p>
      </div>
      <div className="text-[11px] text-foreground-muted shrink-0">{actionLabel}</div>
    </li>
  );
}

function StatusBadge({ status }: { status: "open" | "in_review" | "closed" }) {
  if (status === "closed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] font-semibold text-foreground border border-border">
        <Lock className="h-3 w-3" />
        Closed
      </span>
    );
  }
  if (status === "in_review") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
        In review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-inset px-2 py-0.5 text-[11px] font-semibold text-foreground-muted border border-border">
      Open
    </span>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success";
}) {
  const cls =
    tone === "danger"
      ? "text-red-600"
      : tone === "success"
        ? "text-emerald-600"
        : "text-foreground";
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-foreground-muted font-semibold">
        {label}
      </p>
      <p className={`text-lg font-bold tracking-tight tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}
