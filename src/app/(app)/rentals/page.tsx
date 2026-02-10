import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getRentalCodes } from "@/features/rentals/data/rentals";
import { formatDate, formatCurrency } from "@/lib/utils/formatters";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { updateRentalStatus } from "@/features/rentals/actions/rentals";
import {
  Home,
  Search,
  Filter,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Plus,
} from "lucide-react";

export default async function RentalsPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string; page?: string };
}) {
  const profile = await requireUserProfile();
  const activeStatus = searchParams?.status ?? "all";
  const currentPage = parseInt(searchParams?.page ?? "1", 10);

  const { rentals, total, page, totalPages } = await getRentalCodes({
    search: searchParams?.q,
    status: activeStatus,
    page: currentPage,
  });

  const isAdmin = profile.role.toLowerCase() === "admin";
  const methodEmoji: Record<string, string> = {
    cash: "💵",
    transfer: "⚡",
    card: "💳",
  };

  const statusFilters = ["all", "pending", "approved", "paid", "refunded"];

  // Build URL helper
  const makeHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const q = overrides.q ?? searchParams?.q;
    const s = overrides.status ?? activeStatus;
    const p = overrides.page ?? String(page);
    if (q) params.set("q", q);
    if (s && s !== "all") params.set("status", s);
    if (p && p !== "1") params.set("page", p);
    const qs = params.toString();
    return `/rentals${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-[var(--gap-bento)]">
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

        <form className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
            <Input
              name="q"
              placeholder="Code, client name..."
              defaultValue={searchParams?.q}
              className="pl-9"
            />
          </div>
          {searchParams?.status && (
            <input type="hidden" name="status" value={searchParams.status} />
          )}
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>

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
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </Link>
          ))}
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
          {rentals.map((rental) => {
            const clientName = Array.isArray(rental.clients)
              ? rental.clients[0]?.full_name
              : (rental.clients as { full_name?: string })?.full_name ??
              rental.client_snapshot?.full_name;

            return (
              <div
                key={rental.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-inset transition-colors"
              >
                {/* Icon */}
                <div className="h-10 w-10 rounded-xl bg-surface-inset flex items-center justify-center shrink-0">
                  <Home className="h-4.5 w-4.5 text-foreground-muted" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/rentals/${rental.id}`}
                      className="text-sm font-semibold text-brand hover:underline"
                    >
                      {rental.code}
                    </Link>
                    <StatusBadge status={rental.status} size="sm" />
                  </div>
                  <p className="text-xs text-foreground-muted mt-0.5 truncate">
                    {clientName ?? "—"}
                    <span className="mx-1.5">·</span>
                    {formatDate(rental.created_at)}
                  </p>
                </div>

                {/* Amount + method */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    {formatCurrency(rental.consultation_fee_amount)}
                    <span className="ml-1.5">
                      {methodEmoji[rental.payment_method] ?? ""}
                    </span>
                  </p>
                </div>

                {/* Actions */}
                <div
                  className="flex items-center gap-2 shrink-0"
                >
                  {isAdmin && rental.status === "approved" && (
                    <form
                      action={async (formData) => {
                        "use server";
                        await updateRentalStatus(formData);
                      }}
                    >
                      <input type="hidden" name="rental_id" value={rental.id} />
                      <input type="hidden" name="status" value="paid" />
                      <Button type="submit" variant="success" size="xs">
                        <DollarSign className="h-3 w-3 mr-0.5" />
                        Paid
                      </Button>
                    </form>
                  )}
                  {isAdmin && rental.status === "paid" && (
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
                  )}
                  <Link
                    href={`/rentals/${rental.id}`}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-foreground-muted hover:bg-surface-highlight hover:text-foreground transition-colors"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
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
