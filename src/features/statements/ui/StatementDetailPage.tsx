import Link from "next/link";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { FlagsGrouped, StatementTransaction, StatementUploadRow } from "../data/queries";
import { MissingRentAlerts } from "./MissingRentAlerts";
import { TransactionFeed } from "./TransactionFeed";
import { BANK_META, formatDateRange } from "./bank-meta";

export function StatementDetailPage({
  upload,
  transactions,
  flags,
}: {
  upload: StatementUploadRow;
  transactions: StatementTransaction[];
  flags: FlagsGrouped;
}) {
  const bank =
    upload.bank_name && upload.bank_name in BANK_META
      ? BANK_META[upload.bank_name as keyof typeof BANK_META]
      : BANK_META.unknown;

  const isPdf = upload.file_format === "pdf";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/rent-collection/statements"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-inset transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
          <FileSpreadsheet className="h-5 w-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground tracking-tight truncate">
            {upload.filename}
          </h1>
          <p className="text-xs text-foreground-secondary truncate">
            {upload.portfolio?.name ?? "Unassigned portfolio"} ·{" "}
            {formatDateRange(upload.statement_from, upload.statement_to)}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            bank.chipClass,
          )}
        >
          {bank.label}
        </span>
      </div>

      {upload.status === "failed" && upload.error_message && (
        <div className="rounded-xl border border-error/30 bg-error/5 p-3">
          <p className="text-sm font-semibold text-error">Parsing failed</p>
          <p className="text-xs text-foreground-secondary mt-0.5">{upload.error_message}</p>
        </div>
      )}

      {isPdf && upload.status === "parsed" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 dark:border-amber-800/50 dark:bg-amber-950/20">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            CSV exports usually give more reliable results than PDF statements.
          </p>
        </div>
      )}

      <MissingRentAlerts flags={flags} />

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Transactions</h2>
        <TransactionFeed transactions={transactions} />
      </div>
    </div>
  );
}
