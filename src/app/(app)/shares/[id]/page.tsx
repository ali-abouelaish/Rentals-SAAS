import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ChevronLeft, Eye, Calendar, Clock, Ban } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getShareWithStats } from "@/features/property-shares/data/list";
import { deriveShareStatus, deriveShareScope } from "@/features/property-shares/domain/types";
import { STATUS_CONFIG } from "@/features/properties/domain/types";
import type { UnitStatus } from "@/features/properties/domain/types";
import { ShareDetailActions } from "@/features/property-shares/ui/ShareDetailActions";

export const dynamic = "force-dynamic";

const DATE_TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function buildShareUrl(token: string): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const origin = envUrl ?? (host ? `${proto}://${host}` : "");
  return `${origin}/s/${token}`;
}

async function loadScopeLabel(share: {
  tenant_id: string;
  portfolio_id: string | null;
  property_ids: string[] | null;
}): Promise<string> {
  const scope = deriveShareScope(share);
  if (scope.kind === "all") return "All properties";

  const supabase = createSupabaseServerClient();
  if (scope.kind === "portfolio") {
    const { data } = await supabase
      .from("portfolios")
      .select("name")
      .eq("id", scope.portfolio_id)
      .eq("tenant_id", share.tenant_id)
      .maybeSingle();
    return data?.name ? `Portfolio: ${data.name}` : "Portfolio (missing)";
  }
  const { data } = await supabase
    .from("properties")
    .select("name")
    .eq("tenant_id", share.tenant_id)
    .in("id", scope.property_ids);
  const names = (data ?? []).map((p) => p.name);
  const count = scope.property_ids.length;
  return `${count} ${count === 1 ? "property" : "properties"}: ${names.join(", ")}`;
}

export default async function ShareDetailPage({ params }: { params: { id: string } }) {
  await requireRole([...ADMIN_ROLES]);
  const share = await getShareWithStats(params.id);
  if (!share) notFound();

  const status = deriveShareStatus(share);
  const shareUrl = buildShareUrl(share.token);
  const scopeLabel = await loadScopeLabel(share);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href="/shares"
          className="inline-flex items-center gap-1 text-xs font-medium text-foreground-muted hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to shares
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{share.name}</h1>
            {share.description && (
              <p className="text-sm text-foreground-secondary mt-0.5">{share.description}</p>
            )}
          </div>
          <StatusBadge status={status} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Eye className="h-4 w-4" />}
          label="Total views"
          value={String(share.view_count)}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Last viewed"
          value={share.last_viewed_at ? DATE_TIME_FMT.format(new Date(share.last_viewed_at)) : "Never"}
        />
        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          label="Created"
          value={DATE_TIME_FMT.format(new Date(share.created_at))}
        />
        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          label="Expires"
          value={share.expires_at ? DATE_TIME_FMT.format(new Date(share.expires_at)) : "No expiry"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface-card p-5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
            Commission
          </h3>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {share.commission_override_pct}%
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface-card p-5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
            Availability statuses
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {share.availability_statuses.map((s) => {
              const cfg = STATUS_CONFIG[s as UnitStatus];
              return (
                <span
                  key={s}
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg?.bg ?? "bg-slate-100"} ${cfg?.fg ?? "text-slate-700"}`}
                >
                  {cfg?.label ?? s}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-card p-5">
        <h3 className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
          Scope
        </h3>
        <p className="mt-2 text-sm text-foreground">{scopeLabel}</p>
      </div>

      <ShareDetailActions
        shareId={share.id}
        shareUrl={shareUrl}
        shareName={share.name}
        revoked={status === "revoked"}
      />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "expired" | "revoked" }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
        <Clock className="h-3.5 w-3.5" />
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-800">
      <Ban className="h-3.5 w-3.5" />
      Revoked
    </span>
  );
}
