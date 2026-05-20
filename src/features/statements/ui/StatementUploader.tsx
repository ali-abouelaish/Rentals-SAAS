"use client";

import { useState, useRef, useTransition, type DragEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, UploadCloud, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { uploadStatement } from "../actions/upload";
import type { PortfolioOption } from "../data/queries";
import { BANK_META } from "./bank-meta";

interface UploadSummary {
  upload_id: string;
  bank_detected: string;
  transaction_count: number;
  credit_count: number;
  matched: number;
  missing: number;
}

export function StatementUploader({ portfolios }: { portfolios: PortfolioOption[] }) {
  const router = useRouter();
  const [portfolioId, setPortfolioId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | null) {
    if (!file) return;
    if (!portfolioId) {
      setError("Pick a portfolio first.");
      return;
    }
    setError(null);
    setSummary(null);
    setFileName(file.name);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("portfolio_id", portfolioId);

    startTransition(async () => {
      const result = await uploadStatement(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSummary({
        upload_id: result.upload_id,
        bank_detected: result.bank_detected,
        transaction_count: result.transaction_count,
        credit_count: result.credit_count,
        matched: result.match_summary.matched,
        missing: result.missing_rent_count,
      });
      router.refresh();
    });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file ?? null);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    handleFile(file ?? null);
    e.target.value = "";
  }

  const bankMeta = summary
    ? BANK_META[summary.bank_detected as keyof typeof BANK_META] ?? BANK_META.unknown
    : null;

  return (
    <div className="rounded-xl border border-border bg-surface-card p-5 space-y-4">
      <div>
        <label
          htmlFor="statement-portfolio"
          className="block text-xs font-semibold text-foreground mb-1.5"
        >
          Portfolio
        </label>
        <select
          id="statement-portfolio"
          value={portfolioId}
          onChange={(e) => setPortfolioId(e.target.value)}
          className="block w-full h-9 px-3 rounded-lg border border-border bg-surface-card text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-ring/40"
        >
          <option value="">Pick a portfolio…</option>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {portfolios.length === 0 && (
          <p className="text-xs text-foreground-muted mt-1">
            No portfolios yet. Create one in the Properties section.
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-foreground mb-1.5">
          Bank statement file
        </label>
        <div
          className={cn(
            "rounded-xl border-2 border-dashed transition-colors cursor-pointer",
            dragOver
              ? "border-brand bg-brand/5"
              : "border-border bg-surface-inset hover:border-border-strong",
            (!portfolioId || isPending) && "opacity-60 pointer-events-none",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.pdf,text/csv,application/pdf"
            className="hidden"
            onChange={onChange}
          />
          <div className="px-6 py-10 flex flex-col items-center text-center gap-2">
            {isPending ? (
              <Loader2 className="h-7 w-7 text-brand animate-spin" />
            ) : (
              <UploadCloud className="h-7 w-7 text-foreground-muted" />
            )}
            <p className="text-sm font-semibold text-foreground">
              {isPending
                ? `Parsing ${fileName ?? "statement"}…`
                : "Drop a CSV or PDF here, or click to browse"}
            </p>
            <p className="text-xs text-foreground-muted">
              Max 10MB · CSV exports give the most reliable results
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 flex items-start gap-2">
          <XCircle className="h-4 w-4 text-error flex-shrink-0 mt-0.5" />
          <p className="text-xs text-error font-medium">{error}</p>
        </div>
      )}

      {summary && bankMeta && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <p className="text-sm font-semibold text-foreground">Statement parsed</p>
            <span
              className={cn(
                "ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                bankMeta.chipClass,
              )}
            >
              {bankMeta.label}
            </span>
          </div>
          <p className="text-xs text-foreground-secondary">
            {summary.transaction_count} transactions · {summary.credit_count} credits ·{" "}
            <span className="text-success font-semibold">{summary.matched} matched</span> ·{" "}
            <span className={summary.missing > 0 ? "text-error font-semibold" : "text-foreground-secondary"}>
              {summary.missing} missing
            </span>
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/rent-collection/statements/${summary.upload_id}`)}
          >
            <FileUp className="h-3.5 w-3.5" />
            View details
          </Button>
        </div>
      )}
    </div>
  );
}
