"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ImageOff, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import type { ESigningAgencyRow } from "../data/adminESigning";
import {
  adminRefreshSenderIdentityAction,
  adminSyncAgencyBrandAction,
} from "../actions/adminESigning";

function Pill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "muted";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "ok" && "bg-emerald-100 text-emerald-800",
        tone === "warn" && "bg-amber-100 text-amber-800",
        tone === "muted" && "bg-neutral-200 text-neutral-700"
      )}
    >
      {children}
    </span>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "never";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ESigningAgenciesManager({ agencies }: { agencies: ESigningAgencyRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyTenant, setBusyTenant] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return agencies;
    return agencies.filter(
      (row) =>
        row.tenant.name.toLowerCase().includes(term) ||
        row.tenant.slug.toLowerCase().includes(term)
    );
  }, [agencies, filter]);

  const unbranded = agencies.filter((row) => !row.brandId).length;
  const stale = agencies.filter((row) => row.brandingIsStale).length;

  const run = (tenantId: string, action: () => Promise<{ error: string } | { success: true; message: string }>) => {
    setBusyTenant(tenantId);
    startTransition(async () => {
      try {
        const result = await action();
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message);
        router.refresh();
      } finally {
        setBusyTenant(null);
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-foreground-secondary">
          {agencies.length} agencies · {unbranded} sending unbranded
          {stale > 0 && <> · {stale} out of date</>}
        </p>
        <div className="w-full sm:w-64">
          <label htmlFor="agencyFilter" className="sr-only">
            Filter agencies
          </label>
          <Input
            id="agencyFilter"
            placeholder="Filter by name or slug"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-foreground-secondary">No agencies match that filter.</p>
      ) : (
        filtered.map((row) => {
          const busy = isPending && busyTenant === row.tenant.id;
          return (
            <div
              key={row.tenant.id}
              className="rounded-xl border border-border bg-surface-card p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{row.tenant.name}</p>
                  <p className="text-[11px] text-foreground-muted">{row.tenant.slug}</p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {row.brandId ? (
                      <Pill tone={row.brandingIsStale ? "warn" : "ok"}>
                        {row.brandingIsStale ? "Branding out of date" : "Branded"}
                      </Pill>
                    ) : (
                      <Pill tone="muted">Unbranded</Pill>
                    )}

                    {!row.hasLogo && (
                      <Tooltip content="BoldSign requires a logo to create a brand. Upload one under this tenant's branding first.">
                        <span className="inline-flex">
                          <Pill tone="warn">
                            <ImageOff className="h-3 w-3" aria-hidden />
                            No logo
                          </Pill>
                        </span>
                      </Tooltip>
                    )}

                    {row.senderIdentityEmail && (
                      <Pill tone={row.senderIdentityState === "verified" ? "ok" : "warn"}>
                        {row.senderIdentityState === "verified"
                          ? "Own address verified"
                          : `Own address ${row.senderIdentityState}`}
                      </Pill>
                    )}

                    {row.brandId && !row.consentGivenAt && (
                      <Tooltip content="Branding was applied by an admin rather than by the agency. The agency hasn't confirmed it themselves.">
                        <span className="inline-flex">
                          <Pill tone="muted">No agency consent</Pill>
                        </span>
                      </Tooltip>
                    )}
                  </div>

                  <p className="mt-1.5 text-[11px] text-foreground-muted">
                    Last synced {formatDate(row.lastSyncedAt)}
                    {row.senderIdentityEmail && <> · sends from {row.senderIdentityEmail}</>}
                  </p>

                  {row.lastError && (
                    <p className="mt-1.5 flex gap-1.5 text-[11px] text-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" aria-hidden />
                      {row.lastError}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Tooltip
                    content={
                      !row.hasLogo && !row.brandId
                        ? "This agency has no logo, and the provider requires one to create a brand."
                        : row.brandId
                          ? "Re-reads this agency's Harbor Ops branding and pushes it."
                          : "Creates this agency's brand from its Harbor Ops branding. Emails nobody."
                    }
                  >
                    <span className="inline-block">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        loading={busy}
                        disabled={!row.hasLogo && !row.brandId}
                        onClick={() =>
                          run(row.tenant.id, () =>
                            adminSyncAgencyBrandAction({
                              tenantId: row.tenant.id,
                              force: row.brandingIsStale,
                            })
                          )
                        }
                      >
                        {row.brandId ? "Re-sync" : "Create brand"}
                      </Button>
                    </span>
                  </Tooltip>

                  {row.senderIdentityEmail && (
                    <Tooltip content="Re-reads the sender identity status from BoldSign. Read-only — sends no email.">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={busy}
                        onClick={() =>
                          run(row.tenant.id, () =>
                            adminRefreshSenderIdentityAction({ tenantId: row.tenant.id })
                          )
                        }
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
