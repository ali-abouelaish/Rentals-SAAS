"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Stethoscope,
  Table2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { columnMapSchema, keyColumnsSchema } from "../domain/schemas";
import { diagnoseLandlordSheet, type SheetDiagnostics } from "../actions/diagnose-sheet";
import type { ColumnMap, LandlordSheet, LandlordSheetRun, SheetPreview } from "../domain/types";
import {
  clearLandlordSheet,
  importLandlordSheet,
  previewLandlordSheet,
  saveSheetMapping,
} from "../actions/landlord-sheet";
import { MappingTable } from "./MappingTable";

const inputCls =
  "h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({ landlord }: { landlord: LandlordSheet }) {
  if (landlord.spreadsheet_last_status === "failed") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-500"
        title={landlord.spreadsheet_last_error ?? "The last read failed."}
      >
        <AlertCircle className="h-3 w-3" /> Last read failed
      </span>
    );
  }
  if (landlord.spreadsheet_last_status === "running") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-inset px-2.5 py-0.5 text-xs font-semibold text-foreground-secondary">
        <RefreshCw className="h-3 w-3 animate-spin" /> Reading…
      </span>
    );
  }
  if (landlord.spreadsheet_last_status === "success") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
        <CheckCircle2 className="h-3 w-3" /> Healthy
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-inset px-2.5 py-0.5 text-xs font-semibold text-foreground-secondary">
      <Clock className="h-3 w-3" /> Not read yet
    </span>
  );
}

/**
 * Step-by-step report of the photo pipeline. Photo import spans the sheet, the
 * Sheets API, the column mapping and Drive; every break looks the same from
 * outside ("no pictures"), so this names the failing step.
 */
function DiagnoseDialog({
  landlordId,
  open,
  onOpenChange,
}: {
  landlordId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [report, setReport] = useState<SheetDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, startRun] = useTransition();

  const run = () =>
    startRun(async () => {
      setError(null);
      const result = await diagnoseLandlordSheet(landlordId);
      if (!result.ok) {
        setError(result.error);
        setReport(null);
        return;
      }
      setReport(result.report);
    });

  // Same lesson as the mapping dialog: Radix's onOpenChange does not fire when
  // the parent opens the dialog, so drive the run from `open` itself.
  const started = useRef(false);
  useEffect(() => {
    if (!open) {
      started.current = false;
      return;
    }
    if (started.current) return;
    started.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const icon = (status: "ok" | "warn" | "fail") =>
    status === "ok" ? (
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
    ) : status === "warn" ? (
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
    ) : (
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Photo import check</DialogTitle>
          <DialogDescription>
            Follows the pipeline from the spreadsheet through to Drive and reports where it stops.
          </DialogDescription>
        </DialogHeader>

        {isRunning && !report && (
          <p className="py-8 text-center text-sm text-foreground-secondary">Checking…</p>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-500">
            {error}
          </div>
        )}

        {report && (
          <ol className="space-y-3">
            {report.steps.map((step, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-border p-3">
                {icon(step.status)}
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-foreground">{step.label}</p>
                  <p className="whitespace-pre-line break-words text-sm text-foreground-secondary">
                    {step.detail}
                  </p>
                  {step.fix && (
                    <p className="text-xs text-foreground-muted">
                      <span className="font-medium">Fix:</span> {step.fix}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" variant="secondary" loading={isRunning} onClick={run} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Re-check
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * How rows are identified across reads.
 *
 * Many sheets have no unique reference column, but a *combination* is unique —
 * address + room type, say. Ticking those columns builds the key from them, so
 * a re-read updates the same listing instead of creating a second one. Without
 * a selection we fall back to a mapped reference column, then the listing URL,
 * then a fingerprint of title/address/price (which breaks whenever any of those
 * are edited in the sheet).
 */
function RowIdentityPicker({
  headers,
  columnMap,
  keyColumns,
  onChange,
}: {
  headers: string[];
  columnMap: ColumnMap;
  keyColumns: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (header: string) => {
    onChange(
      keyColumns.includes(header)
        ? keyColumns.filter((h) => h !== header)
        : [...keyColumns, header]
    );
  };

  const mappedRef = Object.entries(columnMap).find(([, field]) => field === "external_ref")?.[0];
  const mappedUrl = Object.entries(columnMap).find(([, field]) => field === "url")?.[0];

  const fallback = mappedRef
    ? `the “${mappedRef}” column`
    : mappedUrl
      ? `the “${mappedUrl}” column`
      : "a fingerprint of title, address and price — which breaks if any of those are edited in the sheet";

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-inset p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Row identity</h3>
        <p className="mt-0.5 text-xs text-foreground-muted">
          Which columns, combined, make a row unique. Pick as many as you need — up to 5. Values are
          compared case-insensitively, so tidying spacing or capitalisation in the sheet won&apos;t
          duplicate a listing.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {headers.map((header) => {
          const selected = keyColumns.includes(header);
          const position = keyColumns.indexOf(header) + 1;
          return (
            <button
              key={header}
              type="button"
              onClick={() => toggle(header)}
              aria-pressed={selected}
              title={
                selected
                  ? `“${header}” is part of the row identity. Click to remove it.`
                  : `Add “${header}” to the combination that identifies a row.`
              }
              className={
                selected
                  ? "inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-fg"
                  : "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-card px-3 py-1 text-xs font-medium text-foreground-secondary hover:border-border-strong hover:text-foreground"
              }
            >
              {selected && <span className="opacity-70">{position}.</span>}
              {header}
            </button>
          );
        })}
      </div>

      <p className="pt-1 text-xs text-foreground-secondary">
        {keyColumns.length > 0 ? (
          <>
            Rows are matched on <span className="font-medium text-foreground">{keyColumns.join(" + ")}</span>.
            If two rows share those values the second is skipped and reported — add another column to
            tell them apart.
          </>
        ) : (
          <>No columns picked, so rows are identified by {fallback}.</>
        )}
      </p>
    </div>
  );
}

/**
 * Mapping review — opened from the landlord page when the auto-detected mapping
 * needs correcting. Re-reads the sheet on open so the columns shown are the ones
 * actually there today.
 */
function MappingDialog({
  landlordId,
  open,
  onOpenChange,
  onSaved,
}: {
  landlordId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [preview, setPreview] = useState<SheetPreview | null>(null);
  const [columnMap, setColumnMap] = useState<ColumnMap>({});
  const [keyColumns, setKeyColumns] = useState<string[]>([]);
  const [headerRow, setHeaderRow] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSaving] = useTransition();

  const load = (row?: number) =>
    startLoading(async () => {
      setError(null);
      const result = await previewLandlordSheet(landlordId, row);
      if (!result.ok) {
        setError(result.error);
        setPreview(null);
        return;
      }
      setPreview(result.preview);
      setHeaderRow(result.preview.header_row);

      // Prefer the mapping already confirmed for this landlord; fall back to
      // fresh suggestions for headers it does not cover.
      const saved = result.preview.saved_column_map ?? {};
      const kept: ColumnMap = {};
      for (const [header, field] of Object.entries(saved)) {
        if (result.preview.headers.includes(header)) kept[header] = field;
      }
      const suggested: ColumnMap = {};
      for (const suggestion of result.preview.suggestions) {
        if (suggestion.field) suggested[suggestion.header] = suggestion.field;
      }
      setColumnMap(Object.keys(kept).length > 0 ? { ...suggested, ...kept } : suggested);

      // Keep only identity columns the sheet still has, so a renamed header
      // shows as unticked rather than silently persisting a dead reference.
      setKeyColumns(
        (result.preview.saved_key_columns ?? []).filter((header) =>
          result.preview.headers.includes(header)
        )
      );
    });

  // Fetch when the dialog becomes open. This cannot hang off `onOpenChange` —
  // Radix only calls that when the dialog itself asks to close/open (Escape,
  // overlay click), not when the parent flips `open` from a button, so the
  // fetch would never fire. The ref makes it once-per-open: reopening after an
  // error retries, and React's double-invoked dev effects don't double-fetch.
  const loadedForOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      loadedForOpen.current = false;
      return;
    }
    if (loadedForOpen.current) return;
    loadedForOpen.current = true;
    load();
    // `load` is recreated each render; the ref guard is what controls re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSave = () =>
    startSaving(async () => {
      setMapError(null);
      const check = columnMapSchema.safeParse(columnMap);
      if (!check.success) {
        setMapError(check.error.errors[0]?.message ?? "Check the column mapping.");
        return;
      }
      const keyCheck = keyColumnsSchema.safeParse(keyColumns);
      if (!keyCheck.success) {
        setMapError(keyCheck.error.errors[0]?.message ?? "Check the row identity columns.");
        return;
      }

      const result = await saveSheetMapping(landlordId, {
        header_row: headerRow,
        column_map: columnMap,
        key_columns: keyColumns,
      });
      if (!result.ok) {
        setMapError(result.error);
        return;
      }
      if (result.run.ok) {
        toast.success(
          `Mapping saved — imported ${result.run.rows_created} new and updated ${result.run.rows_updated} listings.`
        );
      } else {
        toast.warning(`Mapping saved, but the re-import failed: ${result.run.error}`);
      }
      onSaved();
      onOpenChange(false);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Review spreadsheet columns</DialogTitle>
          <DialogDescription>
            Check what each column becomes. Saving stores the mapping and re-imports the sheet with
            it — every later read replays the same mapping.
          </DialogDescription>
        </DialogHeader>

        {isLoading && !preview && (
          <p className="py-8 text-center text-sm text-foreground-secondary">Reading the sheet…</p>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-500">
            {error}
          </div>
        )}

        {/* Catch-all: if we are not loading, have no error and no preview, the
            fetch never ran. Offer a way out rather than an empty dialog. */}
        {!isLoading && !error && !preview && (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-foreground-secondary">
              The spreadsheet hasn&apos;t been read yet.
            </p>
            <Button type="button" variant="secondary" onClick={() => load()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Read the sheet
            </Button>
          </div>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface-inset px-4 py-3 text-sm text-foreground-secondary">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <Table2 className="h-4 w-4" />
                  {preview.sheet_name ?? "Sheet"}
                </span>
                <span>{preview.total_rows} data rows</span>
                <span>{preview.headers.length} columns</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 sm:max-w-xs">
              <label htmlFor="sheet-header-row" className="text-sm font-medium text-foreground">
                Header row
              </label>
              <div className="flex gap-2">
                <input
                  id="sheet-header-row"
                  type="number"
                  min={1}
                  max={50}
                  value={headerRow}
                  onChange={(e) => setHeaderRow(Number(e.target.value))}
                  className={inputCls}
                  title="Sheets often start with a title or logo row. Set this to the row that actually contains the column headings."
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => load(headerRow)}
                  loading={isLoading}
                  className="shrink-0"
                >
                  Re-read
                </Button>
              </div>
              <p className="text-xs text-foreground-muted">
                Which spreadsheet row holds the column names. Change it and press Re-read.
              </p>
            </div>

            <MappingTable
              suggestions={preview.suggestions}
              columnMap={columnMap}
              onChange={(next) => {
                setColumnMap(next);
                setMapError(null);
              }}
            />
            {mapError && <p className="text-xs text-red-500">{mapError}</p>}

            <RowIdentityPicker
              headers={preview.headers}
              columnMap={columnMap}
              keyColumns={keyColumns}
              onChange={(next) => {
                setKeyColumns(next);
                setMapError(null);
              }}
            />

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                loading={isSaving}
                onClick={onSave}
                className="gap-2"
                title="Store this mapping and re-import the sheet with it straight away."
              >
                <Save className="h-4 w-4" />
                Save and re-import
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Spreadsheet panel on the landlord page. Renders only when the landlord has a
 * spreadsheet link — the link itself is edited in the landlord form, alongside
 * the SpareRoom profile URL.
 */
export function LandlordSheetCard({
  landlord,
  runs,
  listingCount,
}: {
  landlord: LandlordSheet;
  runs: LandlordSheetRun[];
  listingCount: number;
}) {
  const router = useRouter();
  const [reviewing, setReviewing] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [isImporting, startImport] = useTransition();
  const [isRemoving, startRemove] = useTransition();

  if (!landlord.spreadsheet_url) return null;

  const lastRun = runs[0] ?? null;
  const mappedColumns = Object.keys(landlord.spreadsheet_column_map ?? {}).length;

  const onImportNow = () =>
    startImport(async () => {
      const result = await importLandlordSheet(landlord.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.run.ok) {
        toast.success(
          `Read ${result.run.rows_seen} rows — ${result.run.rows_created} new, ${result.run.rows_updated} updated, ${result.run.rows_skipped} skipped.`
        );
      } else {
        toast.error(result.run.error ?? "The read failed.");
      }
      router.refresh();
    });

  const onRemove = () =>
    startRemove(async () => {
      const result = await clearLandlordSheet(landlord.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Spreadsheet removed. Its imported listings were kept.");
      setRemoving(false);
      router.refresh();
    });

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-brand">Listings spreadsheet</p>
              <StatusPill landlord={landlord} />
            </div>
            <a
              href={landlord.spreadsheet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-foreground-link hover:underline"
              title="Open the source spreadsheet in a new tab."
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{landlord.spreadsheet_url}</span>
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              loading={isImporting}
              onClick={onImportNow}
              title="Read the spreadsheet now instead of waiting for the daily run."
            >
              <RefreshCw className="h-4 w-4" />
              Import now
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setReviewing(true)}
              title="Check or correct which spreadsheet column fills which listing field."
            >
              <SlidersHorizontal className="h-4 w-4" />
              Review columns
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setDiagnosing(true)}
              title="Trace the photo import from the spreadsheet through to Google Drive and report where it stops."
            >
              <Stethoscope className="h-4 w-4" />
              Check photos
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => setRemoving(true)}
              title="Detach the spreadsheet. Listings it already imported are kept."
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-foreground-muted">Listings from sheet</dt>
            <dd className="font-medium text-foreground">{listingCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground-muted">Schedule</dt>
            <dd className="font-medium text-foreground">Daily</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground-muted">Last read</dt>
            <dd className="font-medium text-foreground">
              {formatWhen(landlord.spreadsheet_last_run_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-foreground-muted">Columns mapped</dt>
            <dd className="font-medium text-foreground">{mappedColumns}</dd>
          </div>
        </dl>

        {landlord.spreadsheet_last_status === "failed" && landlord.spreadsheet_last_error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-500">
            <span className="font-medium">Last read failed:</span> {landlord.spreadsheet_last_error}
          </div>
        )}

        {lastRun && lastRun.status === "success" && lastRun.notes?.length > 0 && (
          <details className="rounded-xl border border-border bg-surface-inset px-4 py-3 text-sm">
            {/* Not every note means a skipped row, so label on what happened. */}
            <summary className="cursor-pointer font-medium text-foreground">
              {lastRun.rows_skipped > 0
                ? `${lastRun.rows_skipped} row${lastRun.rows_skipped === 1 ? "" : "s"} skipped in the last read`
                : "Notes from the last read"}
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-foreground-secondary">
              {lastRun.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </details>
        )}

        {runs.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs font-medium text-foreground-secondary">
              Read history
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[520px] text-xs">
                <thead className="text-left text-foreground-muted">
                  <tr>
                    <th scope="col" className="py-1 font-medium">When</th>
                    <th scope="col" className="py-1 font-medium">Trigger</th>
                    <th scope="col" className="py-1 font-medium">Result</th>
                    <th scope="col" className="py-1 font-medium">New</th>
                    <th scope="col" className="py-1 font-medium">Updated</th>
                    <th scope="col" className="py-1 font-medium">Skipped</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td className="py-1.5">{formatWhen(run.started_at)}</td>
                      <td className="py-1.5 capitalize">{run.trigger}</td>
                      <td className="py-1.5">
                        {run.status === "failed" ? (
                          <span className="text-red-500" title={run.error_message ?? undefined}>
                            Failed
                          </span>
                        ) : run.status === "running" ? (
                          "Running"
                        ) : (
                          <span className="text-success">Success</span>
                        )}
                      </td>
                      <td className="py-1.5">{run.rows_created}</td>
                      <td className="py-1.5">{run.rows_updated}</td>
                      <td className="py-1.5">{run.rows_skipped}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </CardContent>

      <DiagnoseDialog
        landlordId={landlord.id}
        open={diagnosing}
        onOpenChange={setDiagnosing}
      />

      <MappingDialog
        landlordId={landlord.id}
        open={reviewing}
        onOpenChange={setReviewing}
        onSaved={() => router.refresh()}
      />

      <Dialog open={removing} onOpenChange={setRemoving}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this spreadsheet?</DialogTitle>
            <DialogDescription>
              The sheet stops being re-read and its column mapping is forgotten. The {listingCount}{" "}
              listings it already imported are kept — they may be attached to leads.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRemoving(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={isRemoving}
              onClick={onRemove}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Remove spreadsheet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
