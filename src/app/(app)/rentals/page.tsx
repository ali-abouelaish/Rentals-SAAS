import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AvatarCircle } from "@/components/shared/AvatarCircle";
import { LiveSearchInput } from "@/components/shared/LiveSearchInput";
import { getRentalCodes } from "@/features/rentals/data/rentals";
import { getAgents } from "@/features/agents/data/agents";
import { formatDate, formatCurrency } from "@/lib/utils/formatters";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { updateRentalStatus } from "@/features/rentals/actions/rentals";
import {
  Home,
  Filter,
  PoundSterling,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import { RealtimeRefresher } from "@/components/shared/RealtimeRefresher";
import { AgentFilterDropdown } from "@/features/rentals/ui/AgentFilterDropdown";
import { RentalsDateRangeFilter } from "@/features/rentals/ui/RentalsDateRangeFilter";

const statusLabels: Record<string, string> = {
  all: "All",
  pending: "Pending",
  approved: "Approved",
  paid: "Paid",
  refunded: "Refunded",
  need_more_info: "Need More Info",
};

export default async function RentalsPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string; page?: string; agent?: string; method?: string; start?: string; end?: string };
}) {
  const profile = await requireUserProfile();
  const activeStatus = searchParams?.status ?? "all";
  const activeAgent = searchParams?.agent ?? "all";
  const activeMethod = searchParams?.method ?? "all";
  const currentPage = parseInt(searchParams?.page ?? "1", 10);

  // Default to last 30 days
  const today = new Date();
  const defaultEnd = today.toISOString().slice(0, 10);
  const defaultStartDate = new Date(today);
  defaultStartDate.setDate(today.getDate() - 30);
  const defaultStart = defaultStartDate.toISOString().slice(0, 10);
  const activeStart = searchParams?.start ?? defaultStart;
  const activeEnd = searchParams?.end ?? defaultEnd;

  const isAdmin = profile.role.toLowerCase() === "admin";

  const [{ rentals, total, page, totalPages }, agents] = await Promise.all([
    getRentalCodes({
      search: searchParams?.q,
      status: activeStatus,
      agentId: activeAgent !== "all" ? activeAgent : undefined,
      paymentMethod: activeMethod !== "all" ? activeMethod : undefined,
      dateFrom: activeStart,
      dateTo: activeEnd,
      page: currentPage,
    }),
    getAgents(),
  ]);

  const methodEmoji: Record<string, string> = {
    cash: "💵",
    transfer: "⚡",
    card: "💳",
  };

  const statusFilters = ["all", "pending", "approved", "paid", "refunded", "need_more_info"];
  const methodFilters: { value: string; label: string }[] = [
    { value: "all", label: "All" },
    { value: "cash", label: "Cash 💵" },
    { value: "transfer", label: "Transfer ⚡" },
    { value: "card", label: "Card 💳" },
  ];

  // Build URL helper
  const makeHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const q = overrides.q ?? searchParams?.q;
    const s = overrides.status ?? activeStatus;
    const p = overrides.page ?? String(page);
    const a = overrides.agent ?? activeAgent;
    const m = overrides.method ?? activeMethod;
    const sd = overrides.start ?? searchParams?.start;
    const ed = overrides.end ?? searchParams?.end;
    if (q) params.set("q", q);
    if (s && s !== "all") params.set("status", s);
    if (a && a !== "all") params.set("agent", a);
    if (m && m !== "all") params.set("method", m);
    if (sd) params.set("start", sd);
    if (ed) params.set("end", ed);
    if (p && p !== "1") params.set("page", p);
    const qs = params.toString();
    return `/rentals${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-[var(--gap-bento)]">
      <RealtimeRefresher table="rental_codes" />
      {/* ── Inline header ──── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground-muted tracking-wide uppercase">
            <Home className="h-3.5 w-3.5" />
            Property Rentals
          </p>
          <h1 className="text-2xl font-bold text-foreground font-heading mt-0.5">
            Rentals
          </h1>
        </div>
        <Button asChild size="sm">
          <Link href="/clients">
            <Plus className="h-4 w-4 mr-1.5" />
            Create Rental
          </Link>
        </Button>
      </div>

      {/* ── Search & Filter — Bento card ──── */}
      <div className="rounded-bento bg-surface-card shadow-bento p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-lg bg-surface-inset">
            <Filter className="h-4 w-4 text-foreground-muted" strokeWidth={2} />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Search & Filter</h2>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <LiveSearchInput
            placeholder="Code, client name..."
            initialQuery={searchParams?.q ?? ""}
            preserveStatus={activeStatus !== "all" ? activeStatus : undefined}
            preserveAgent={activeAgent !== "all" ? activeAgent : undefined}
            preserveMethod={activeMethod !== "all" ? activeMethod : undefined}
            preserveStart={searchParams?.start}
            preserveEnd={searchParams?.end}
          />
        </div>

        {/* Agent filter */}
        {agents.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <label className="text-xs text-foreground-secondary">Agent:</label>
            <AgentFilterDropdown
              agents={agents.map((a: any) => ({
                id: a.user_id as string,
                name: ((a.user_profiles as { display_name?: string } | null)?.display_name ?? "Agent"),
              })).sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))}
              activeAgentId={activeAgent}
            />
          </div>
        )}

        {/* Pill filters */}
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((s) => (
            <Link
              key={s}
              href={makeHref({ status: s, page: "1" })}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeStatus === s
                  ? "bg-brand text-brand-fg shadow-sm"
                  : "bg-surface-inset text-foreground-secondary hover:bg-surface-highlight"
                }`}
            >
              {statusLabels[s] ?? s}
            </Link>
          ))}
        </div>

        {/* Payment method filter */}
        <div className="flex items-center gap-2 mt-4">
          <label className="text-xs text-foreground-secondary">Payment:</label>
          <div className="flex flex-wrap gap-2">
            {methodFilters.map((m) => (
              <Link
                key={m.value}
                href={makeHref({ method: m.value, page: "1" })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeMethod === m.value
                    ? "bg-brand text-brand-fg shadow-sm"
                    : "bg-surface-inset text-foreground-secondary hover:bg-surface-highlight"
                  }`}
              >
                {m.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Date range filter */}
        <div className="mt-4">
          <RentalsDateRangeFilter start={activeStart} end={activeEnd} />
        </div>
      </div>

      {/* ── Results count ──── */}
      <p className="text-sm text-foreground-secondary">
        Showing{" "}
        <span className="font-semibold text-foreground">{rentals.length}</span>{" "}
        of <span className="font-semibold text-foreground">{total}</span> rentals
      </p>

      {/* ── Card-based rental list ──── */}
      {rentals.length === 0 ? (
        <div className="rounded-bento bg-surface-card shadow-bento py-16 flex flex-col items-center justify-center gap-3">
          <Home className="h-12 w-12 text-foreground-muted" />
          <p className="text-foreground-secondary">No rentals found</p>
        </div>
      ) : (
        <div className="rounded-bento bg-surface-card shadow-bento divide-y divide-border overflow-hidden">
          {rentals.map((rental: any) => {
            const clientName = Array.isArray(rental.clients)
              ? rental.clients[0]?.full_name
              : (rental.clients as { full_name?: string })?.full_name ??
              rental.client_snapshot?.full_name;
            const assistedByName =
              rental.user_profiles?.display_name ??
              rental.assisted_by_agent_id ??
              "";

            return (
              <div
                key={rental.id}
                className="relative flex items-center gap-4 px-5 py-3.5 hover:bg-surface-inset transition-colors"
              >
                {/* Stretched link — entire row navigates to detail view */}
                <Link
                  href={`/rentals/${rental.id}`}
                  aria-label={`View rental ${rental.code}`}
                  className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-bento"
                />

                {/* Agent avatar */}
                <div className="shrink-0 relative z-[1] pointer-events-none">
                  <AvatarCircle name={assistedByName || clientName || "Agent"} size={32} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 relative z-[1] pointer-events-none">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-brand">
                      {rental.code}
                    </span>
                    <StatusBadge status={rental.status} size="sm" />
                  </div>
                  <p className="text-xs text-foreground-muted mt-0.5 truncate">
                    {clientName ?? "—"}
                    <span className="mx-1.5">·</span>
                    {formatDate(rental.created_at)}
                  </p>
                  <p className="text-xs text-foreground-muted mt-0.5 truncate">
                    <span className="font-medium text-foreground">Agent:</span>{" "}
                    {assistedByName || "—"}
                  </p>
                </div>

                {/* Amount + method */}
                <div className="text-right shrink-0 relative z-[1] pointer-events-none">
                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    {formatCurrency(rental.consultation_fee_amount)}
                    <span className="ml-1.5">
                      {methodEmoji[rental.payment_method] ?? ""}
                    </span>
                  </p>
                </div>

                {/* Actions — kept above the stretched link so they stay interactive */}
                <div
                  className="flex items-center gap-2 shrink-0 relative z-[2]"
                >
                  {isAdmin && rental.status === "approved" && (
                    <>
                      <form
                        action={async (formData) => {
                          "use server";
                          await updateRentalStatus(formData);
                        }}
                      >
                        <input type="hidden" name="rental_id" value={rental.id} />
                        <input type="hidden" name="status" value="paid" />
                        <Button type="submit" variant="success" size="xs">
                          <PoundSterling className="h-3 w-3 mr-0.5" />
                          Mark as paid
                        </Button>
                      </form>
                      <form
                        action={async (formData) => {
                          "use server";
                          await updateRentalStatus(formData);
                        }}
                      >
                        <input type="hidden" name="rental_id" value={rental.id} />
                        <input type="hidden" name="status" value="refunded" />
                        <Button type="submit" variant="outline" size="xs">
                          Refund
                        </Button>
                      </form>
                    </>
                  )}
                  <span
                    aria-hidden
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-foreground-muted"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ──── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Link
            href={makeHref({ page: String(Math.max(1, page - 1)) })}
            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${page <= 1
                ? "text-foreground-muted pointer-events-none opacity-40"
                : "text-foreground-secondary hover:bg-surface-highlight"
              }`}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={makeHref({ page: String(p) })}
              className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-medium transition-colors ${p === page
                  ? "bg-brand text-brand-fg shadow-sm"
                  : "text-foreground-secondary hover:bg-surface-highlight"
                }`}
            >
              {p}
            </Link>
          ))}
          <Link
            href={makeHref({ page: String(Math.min(totalPages, page + 1)) })}
            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${page >= totalPages
                ? "text-foreground-muted pointer-events-none opacity-40"
                : "text-foreground-secondary hover:bg-surface-highlight"
              }`}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
