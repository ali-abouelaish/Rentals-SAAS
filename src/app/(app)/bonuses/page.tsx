import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LiveSearchInput } from "@/components/shared/LiveSearchInput";
import { getBonuses } from "@/features/bonuses/data/bonuses";
import { SubmitBonusDialog } from "@/features/bonuses/ui/SubmitBonusDialog";
import { BonusesLandlordFilter } from "@/features/bonuses/ui/BonusesLandlordFilter";
import { BonusesTableWithInvoice } from "@/features/bonuses/ui/BonusesTableWithInvoice";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { FileText, Gift, Filter, ChevronLeft, ChevronRight } from "lucide-react";

export default async function BonusesPage({
  searchParams
}: {
  searchParams?: { q?: string; status?: string; landlord?: string; page?: string };
}) {
  const profile = await requireUserProfile();
  const isAdmin = profile.role.toLowerCase() === "admin";
  const supabase = createSupabaseServerClient();
  const search = searchParams?.q ?? "";
  const activeStatus = searchParams?.status ?? "all";
  const landlordFilter = searchParams?.landlord ?? "all";
  const currentPage = Math.max(1, parseInt(searchParams?.page ?? "1", 10) || 1);

  const [bonusesResult, { data: landlords }, { data: agents }] = await Promise.all([
    getBonuses({
      search,
      status: activeStatus,
      landlordId: landlordFilter,
      page: currentPage,
    }),
    supabase.from("landlords").select("id, name").order("name", { ascending: true }),
    supabase
      .from("user_profiles")
      .select("id, display_name")
      .eq("tenant_id", profile.tenant_id)
      .order("display_name", { ascending: true })
  ]);

  const { bonuses, total, page, totalPages } = bonusesResult;
  const invoiceEligible = bonuses.filter((bonus) =>
    ["approved", "pending"].includes(bonus.status)
  );

  const statusFilters = ["all", "pending", "approved", "sent", "paid", "declined"];

  const statusLabel = (s: string) =>
    s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1);

  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (activeStatus !== "all") params.set("status", activeStatus);
    if (landlordFilter !== "all") params.set("landlord", landlordFilter);
    params.set("page", String(p));
    return `/bonuses?${params.toString()}`;
  };

  const buildStatusUrl = (status: string) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (status && status !== "all") params.set("status", status);
    if (landlordFilter !== "all") params.set("landlord", landlordFilter);
    const qs = params.toString();
    return `/bonuses${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-foreground-secondary text-sm flex items-center gap-1.5">
            <Gift className="h-4 w-4" />
            Landlord Submissions
          </p>
          <h1 className="text-2xl font-bold tracking-tight font-heading text-foreground">
            Bonuses
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <SubmitBonusDialog
            landlords={(landlords ?? []).map((l) => ({
              id: l.id,
              name: l.name
            }))}
            agents={(agents ?? []).map((agent) => ({
              id: agent.id,
              name: agent.display_name ?? "Agent"
            }))}
            isAdmin={isAdmin}
            currentAgentId={profile.id}
          />
          <Link href="/invoices/from-bonuses">
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-1.5" />
              Create Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Search & Filter — Bento card ──── */}
      <div className="rounded-bento bg-surface-card shadow-bento p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-lg bg-brand-subtle">
            <Filter className="h-4 w-4 text-brand" strokeWidth={2} />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Search & Filter</h2>
        </div>

        <div className="flex flex-wrap gap-3 items-end mb-4">
          <LiveSearchInput
            placeholder="Code, client, property..."
            initialQuery={search}
            preserveStatus={activeStatus !== "all" ? activeStatus : undefined}
            preserveLandlord={landlordFilter !== "all" ? landlordFilter : undefined}
          />

          <BonusesLandlordFilter
            currentLandlord={landlordFilter}
            currentSearch={search}
            currentStatus={activeStatus}
            landlords={(landlords ?? []).map((l) => ({ id: l.id, name: l.name }))}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {statusFilters.map((status) => (
            <Link
              key={status}
              href={buildStatusUrl(status)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-base ${activeStatus === status
                ? "bg-brand text-brand-fg shadow-sm"
                : "bg-surface-inset text-foreground-secondary hover:bg-surface-highlight hover:text-foreground"
                }`}
            >
              {statusLabel(status)}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Invoice-eligible Section ──── */}
      <div className="rounded-bento bg-surface-card shadow-bento p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-subtle">
              <Gift className="h-4 w-4 text-brand" strokeWidth={2} />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Eligible for Invoicing</h3>
          </div>
          <span className="text-xs text-foreground-muted bg-surface-inset px-2.5 py-1 rounded-full">
            {invoiceEligible.length} bonus{invoiceEligible.length !== 1 ? "es" : ""}
          </span>
        </div>
        {invoiceEligible.length === 0 ? (
          <div className="text-center py-8">
            <Gift className="h-10 w-10 text-foreground-muted mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm text-foreground-secondary">No bonuses available for invoicing</p>
          </div>
        ) : (
          <BonusesTableWithInvoice bonuses={invoiceEligible} />
        )}
      </div>

      {/* ── Results Count ─────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-secondary">
          Showing <span className="font-semibold text-foreground">{bonuses.length}</span> of{" "}
          <span className="font-semibold text-foreground">{total}</span> total bonuses
        </p>
        {totalPages > 1 && (
          <p className="text-xs text-foreground-muted">
            Page {page} of {totalPages}
          </p>
        )}
      </div>

      {/* ── Pagination ──────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 ? (
            <Link
              href={buildPageUrl(page - 1)}
              className="h-9 w-9 rounded-xl bg-surface-card shadow-bento flex items-center justify-center hover:bg-surface-inset transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-foreground-secondary" />
            </Link>
          ) : (
            <span className="h-9 w-9 rounded-xl bg-surface-inset flex items-center justify-center opacity-40 cursor-not-allowed">
              <ChevronLeft className="h-4 w-4 text-foreground-muted" />
            </span>
          )}

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={buildPageUrl(p)}
              className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-medium transition-all duration-base ${p === page
                ? "bg-brand text-brand-fg shadow-sm"
                : "bg-surface-card shadow-bento text-foreground-secondary hover:bg-surface-inset"
                }`}
            >
              {p}
            </Link>
          ))}

          {page < totalPages ? (
            <Link
              href={buildPageUrl(page + 1)}
              className="h-9 w-9 rounded-xl bg-surface-card shadow-bento flex items-center justify-center hover:bg-surface-inset transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-foreground-secondary" />
            </Link>
          ) : (
            <span className="h-9 w-9 rounded-xl bg-surface-inset flex items-center justify-center opacity-40 cursor-not-allowed">
              <ChevronRight className="h-4 w-4 text-foreground-muted" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
