"use client";

import { useEffect, useState } from "react";
import { X, ArrowRight } from "lucide-react";
import {
  KEY_PURPOSE_LABELS,
  type KeyAssignment,
} from "../domain/types";

const historyCache = new Map<string, KeyAssignment[]>();

export function prefetchKeyHistory(keyId: string): Promise<void> {
  if (historyCache.has(keyId)) return Promise.resolve();
  return fetch(`/api/keys/${keyId}/history`)
    .then((res) => (res.ok ? res.json() : null))
    .then((body) => {
      if (body?.history) historyCache.set(keyId, body.history);
    })
    .catch(() => {});
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function holderName(a: KeyAssignment): string {
  if (a.heldBy.kind === "user") return a.heldBy.name ?? "Internal agent";
  return a.heldBy.name || "Unknown";
}

function duration(start: string, end: string | null): string {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function HistorySkeleton() {
  return (
    <ol className="space-y-3">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="rounded-xl border border-border bg-surface-inset px-3 py-3 animate-pulse"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="h-3 w-24 rounded bg-foreground/10" />
            <div className="h-2.5 w-12 rounded bg-foreground/10" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-2.5 w-20 rounded bg-foreground/10" />
            <div className="h-2.5 w-20 rounded bg-foreground/10" />
            <div className="ml-auto h-2.5 w-10 rounded bg-foreground/10" />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function KeyHistoryDrawer({
  keyId,
  keyLabel,
  open,
  onClose,
}: {
  keyId: string;
  keyLabel: string;
  open: boolean;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<KeyAssignment[] | null>(
    () => historyCache.get(keyId) ?? null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const cached = historyCache.get(keyId);
    if (cached) {
      setHistory(cached);
    }
    setError(null);

    fetch(`/api/keys/${keyId}/history`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to load history");
        }
        return res.json();
      })
      .then((body) => {
        if (cancelled) return;
        const list: KeyAssignment[] = body.history ?? [];
        historyCache.set(keyId, list);
        setHistory(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load history");
      });

    return () => {
      cancelled = true;
    };
  }, [keyId, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 w-full sm:max-w-md bg-surface-card border-l border-border shadow-2xl flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Key history</h2>
            <p className="text-xs text-foreground-muted mt-0.5">{keyLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-foreground-secondary hover:text-foreground hover:bg-surface-inset transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
          {!error && history === null && <HistorySkeleton />}
          {!error && history && history.length === 0 && (
            <p className="text-xs text-foreground-muted">No history yet for this key.</p>
          )}
          {!error && history && history.length > 0 && (
            <ol className="space-y-3">
              {history.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-border bg-surface-inset px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{holderName(a)}</span>
                    <span className="text-[11px] uppercase tracking-wide text-foreground-muted">
                      {KEY_PURPOSE_LABELS[a.purpose]}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-foreground-secondary">
                    <span>{formatDate(a.checkedOutAt)}</span>
                    <ArrowRight size={12} className="opacity-60" />
                    <span>
                      {a.returnedAt ? formatDate(a.returnedAt) : "still out"}
                    </span>
                    <span className="ml-auto text-foreground-muted">
                      {duration(a.checkedOutAt, a.returnedAt)}
                    </span>
                  </div>
                  {a.heldBy.kind === "contact" && a.heldBy.phone && (
                    <p className="mt-1 text-[11px] text-foreground-muted">
                      {a.heldBy.phone}
                    </p>
                  )}
                  {a.returnedCondition && (
                    <p className="mt-1 text-[11px] text-foreground-muted">
                      Condition on return: <span className="text-foreground">{a.returnedCondition}</span>
                    </p>
                  )}
                  {a.notes && (
                    <p className="mt-2 text-xs text-foreground-secondary whitespace-pre-wrap">
                      {a.notes}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}
