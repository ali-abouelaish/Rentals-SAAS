import Link from "next/link";
import { Settings } from "lucide-react";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { isAdminRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLeads, getLeadStats } from "@/features/leads/data/leads";
import { getGmailConnection, getPlatformConfigs } from "@/features/leads/data/gmail";
import { LeadsBrowser } from "@/features/leads/ui/LeadsBrowser";
import { LeadFilters } from "@/features/leads/ui/LeadFilters";
import { LeadSyncStatsCard } from "@/features/leads/ui/LeadSyncStatsCard";
import { SyncPlatformsButton } from "@/features/leads/ui/SyncPlatformsButton";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string; source?: string; ref?: string; page?: string };
}) {
  const profile = await requireUserProfile();
  const currentPage = Math.max(1, parseInt(searchParams?.page ?? "1", 10) || 1);

  const [{ leads, total, totalPages }, stats, connection, platformConfigs] = await Promise.all([
    getLeads({
      search: searchParams?.q,
      status: searchParams?.status,
      source: searchParams?.source,
      ref: searchParams?.ref,
      page: currentPage,
    }),
    getLeadStats(),
    getGmailConnection(),
    getPlatformConfigs(),
  ]);

  const sources = [...new Set(platformConfigs.map((c) => c.platform_name))];

  // Agents list powers the assignment dropdown inside the lead drawer.
  let agents: { id: string; display_name: string | null }[] = [];
  if (isAdminRole(profile.role)) {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .eq("tenant_id", profile.tenant_id)
      .order("display_name");
    agents = data ?? [];
  }

  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams();
    if (searchParams?.q) params.set("q", searchParams.q);
    if (searchParams?.status) params.set("status", searchParams.status);
    if (searchParams?.source) params.set("source", searchParams.source);
    if (searchParams?.ref) params.set("ref", searchParams.ref);
    params.set("page", String(p));
    return `/leads?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-foreground-muted mt-0.5">Inbound from property portals</p>
        </div>
        {isAdminRole(profile.role) && (
          <div className="flex items-center gap-2">
            {connection && <SyncPlatformsButton />}
            <Link
              href="/leads/settings"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>
        )}
      </div>

      {/* Bento grid */}
      <div className="grid lg:grid-cols-5 gap-[var(--gap-bento)]">
        <div className="lg:col-span-2 rounded-bento bg-surface-card shadow-bento p-5">
          <LeadSyncStatsCard stats={stats} connection={connection} />
        </div>
        <div className="lg:col-span-3 rounded-bento bg-surface-card shadow-bento p-5">
          <LeadFilters sources={sources} />
        </div>
      </div>

      {/* Results count */}
      {total > 0 && (
        <p className="text-sm text-foreground-muted">
          {total} lead{total !== 1 ? "s" : ""}
        </p>
      )}

      {/* Lead list */}
      {leads.length > 0 ? (
        <LeadsBrowser leads={leads} agents={agents} isAdmin={isAdminRole(profile.role)} />
      ) : (
        <div className="rounded-bento bg-surface-card shadow-bento py-16 text-center">
          <p className="text-sm text-foreground-muted">No leads found.</p>
          {!connection && isAdminRole(profile.role) && (
            <p className="text-sm text-foreground-muted mt-1">
              <Link href="/leads/settings" className="text-accent hover:underline">
                Connect Gmail
              </Link>{" "}
              to start capturing leads.
            </p>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={buildPageUrl(currentPage - 1)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-foreground-muted">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={buildPageUrl(currentPage + 1)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
