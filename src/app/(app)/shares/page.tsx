import Link from "next/link";
import { Share2, Plus, Eye, Clock, Ban } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { listShares } from "@/features/property-shares/data/list";
import { deriveShareStatus, deriveShareScope } from "@/features/property-shares/domain/types";
import { STATUS_CONFIG } from "@/features/properties/domain/types";
import type { UnitStatus } from "@/features/properties/domain/types";

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function SharesPage() {
  await requireRole([...ADMIN_ROLES]);
  const shares = await listShares();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Property Shares</h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            {shares.length} {shares.length === 1 ? "share link" : "share links"}
          </p>
        </div>
        <Link
          href="/shares/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          New share
        </Link>
      </div>

      {shares.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-card py-16 text-center">
          <Share2 className="h-10 w-10 text-foreground-muted mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-foreground mb-1">No share links yet</p>
          <p className="text-xs text-foreground-secondary">Create a share link to expose live inventory to external partners</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
          <div className="grid grid-cols-[1.8fr_0.8fr_1.4fr_0.8fr_0.9fr_0.7fr_0.9fr] gap-3 px-4 py-2 border-b border-border/50 bg-surface-inset/30">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Name</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Scope</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Statuses</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Commission</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Status</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Views</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Created</div>
          </div>

          <div className="divide-y divide-border">
            {shares.map((share, i) => {
              const status = deriveShareStatus(share);
              const scope = deriveShareScope(share);
              const scopeText =
                scope.kind === "all"
                  ? "All"
                  : scope.kind === "portfolio"
                  ? "Portfolio"
                  : `${scope.property_ids.length} propert${scope.property_ids.length === 1 ? "y" : "ies"}`;
              return (
                <Link
                  key={share.id}
                  href={`/shares/${share.id}`}
                  className={`grid grid-cols-[1.8fr_0.8fr_1.4fr_0.8fr_0.9fr_0.7fr_0.9fr] gap-3 px-4 py-3 text-sm transition-colors hover:bg-surface-inset/40 ${
                    i % 2 === 1 ? "bg-surface-inset/20" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{share.name}</div>
                    {share.description && (
                      <p className="mt-0.5 text-xs text-foreground-muted line-clamp-1">
                        {share.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center">
                    <span className="inline-flex items-center rounded-full bg-surface-inset px-2 py-0.5 text-[11px] font-medium text-foreground-secondary">
                      {scopeText}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="flex flex-wrap gap-1">
                      {share.availability_statuses.map((s) => {
                        const cfg = STATUS_CONFIG[s as UnitStatus];
                        return (
                          <span
                            key={s}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg?.bg ?? "bg-slate-100"} ${cfg?.fg ?? "text-slate-700"}`}
                          >
                            {cfg?.label ?? s}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center font-medium tabular-nums text-foreground">
                    {share.commission_override_pct}%
                  </div>
                  <div className="flex items-center">
                    <StatusBadge status={status} />
                  </div>
                  <div className="flex items-center gap-1.5 text-foreground">
                    <Eye className="h-3.5 w-3.5 text-foreground-muted" />
                    <span className="font-medium tabular-nums">{share.view_count}</span>
                  </div>
                  <div className="flex items-center text-foreground-muted">
                    {DATE_FMT.format(new Date(share.created_at))}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "expired" | "revoked" }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
        <Clock className="h-3 w-3" />
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-800">
      <Ban className="h-3 w-3" />
      Revoked
    </span>
  );
}
