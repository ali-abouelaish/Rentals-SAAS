import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getClients } from "@/features/clients/data/clients";
import { AgentQrCard } from "@/features/clients/ui/AgentQrCard";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { CreateClientDialog } from "@/features/clients/ui/CreateClientDialog";
import {
  Users,
  Phone,
  ArrowRight,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default async function ClientsPage({
  searchParams
}: {
  searchParams?: { q?: string; status?: string; page?: string };
}) {
  const profile = await requireUserProfile();
  const activeStatus = searchParams?.status ?? "all";
  const currentPage = Math.max(1, parseInt(searchParams?.page ?? "1", 10) || 1);

  const { clients, total, page, totalPages } = await getClients({
    search: searchParams?.q,
    status: activeStatus,
    page: currentPage,
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    `https://${process.env.VERCEL_URL ?? "localhost:3000"}`;
  const leadUrl = `${baseUrl}/public/lead/${profile.id}`;

  const statusFilters = ["all", "pending", "on_hold", "solved"];

  const statusLabel = (s: string) =>
    s === "all"
      ? "All"
      : s === "on_hold"
        ? "On Hold"
        : s.charAt(0).toUpperCase() + s.slice(1);

  // Build pagination URL preserving existing search params
  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams();
    if (searchParams?.q) params.set("q", searchParams.q);
    if (searchParams?.status) params.set("status", searchParams.status);
    params.set("page", String(p));
    return `/clients?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-foreground-secondary text-sm flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Client Management
          </p>
          <h1 className="text-2xl font-bold tracking-tight font-heading text-foreground">
            Clients
          </h1>
        </div>
        <CreateClientDialog />
      </div>

      {/* ── Bento Row: QR Card + Search & Filters ──── */}
      <div className="grid lg:grid-cols-5 gap-[var(--gap-bento)]">
        {/* QR Code — compact bento card */}
        <div className="lg:col-span-2 rounded-bento bg-surface-card shadow-bento p-5">
          <AgentQrCard url={leadUrl} />
        </div>

        {/* Search + Status Filters */}
        <div className="lg:col-span-3 rounded-bento bg-surface-card shadow-bento p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-lg bg-brand-subtle">
              <Filter className="h-4 w-4 text-brand" strokeWidth={2} />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Search & Filter</h2>
          </div>

          <form className="flex gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
              <Input
                name="q"
                placeholder="Search name or phone..."
                defaultValue={searchParams?.q}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">
              Search
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {statusFilters.map((status) => (
              <Link
                key={status}
                href={`/clients?status=${status}`}
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
      </div>

      {/* ── Results Count ─────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-secondary">
          Showing <span className="font-semibold text-foreground">{clients.length}</span> of{" "}
          <span className="font-semibold text-foreground">{total}</span> clients
        </p>
        {totalPages > 1 && (
          <p className="text-xs text-foreground-muted">
            Page {page} of {totalPages}
          </p>
        )}
      </div>

      {/* ── Client Cards ─────────────────── */}
      {clients.length > 0 ? (
        <div className="rounded-bento bg-surface-card shadow-bento overflow-hidden">
          <div className="divide-y divide-border">
            {clients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-surface-inset transition-colors duration-base group"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-xl bg-brand-subtle flex items-center justify-center group-hover:bg-brand group-hover:text-brand-fg transition-colors">
                    <span className="text-brand font-semibold text-sm group-hover:text-brand-fg">
                      {client.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                    </span>
                  </div>

                  {/* Info */}
                  <div>
                    <p className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors">
                      {client.full_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Phone className="h-3 w-3 text-foreground-muted" />
                      <span className="text-xs text-foreground-muted">{client.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <StatusBadge status={client.status} size="sm" />
                  <ArrowRight className="h-4 w-4 text-foreground-muted group-hover:text-brand transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-bento bg-surface-card shadow-bento py-16 text-center">
          <Users className="h-12 w-12 text-foreground-muted mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-lg font-semibold text-foreground mb-1">No clients found</p>
          <p className="text-sm text-foreground-secondary">
            Try adjusting your search or filters
          </p>
        </div>
      )}

      {/* ── Pagination ──────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {/* Previous */}
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

          {/* Page numbers */}
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

          {/* Next */}
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
