import Link from "next/link";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { StatementUploader } from "./StatementUploader";
import { UploadHistoryTable } from "./UploadHistoryTable";
import type { PortfolioOption, StatementUploadRow } from "../data/queries";

export function StatementsPage({
  portfolios,
  uploads,
}: {
  portfolios: PortfolioOption[];
  uploads: StatementUploadRow[];
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/rent-collection"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-inset transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
          <FileSpreadsheet className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Bank Statements</h1>
          <p className="text-xs text-foreground-secondary">
            Upload a portfolio&apos;s bank statement to auto-match rent payments and flag missing income.
          </p>
        </div>
      </div>

      <StatementUploader portfolios={portfolios} />

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Upload history</h2>
        <UploadHistoryTable rows={uploads} />
      </div>
    </div>
  );
}
