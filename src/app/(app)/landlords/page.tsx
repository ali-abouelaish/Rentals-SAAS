import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getLandlords } from "@/features/landlords/data/landlords";
import {
  Building,
  Check,
  X,
  Search,
  Filter,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default async function LandlordsPage({
  searchParams
}: {
  searchParams?: { q?: string; paying?: string; page?: string };
}) {
  const search = searchParams?.q ?? "";
  const paying = searchParams?.paying ?? "all";
  const currentPage = Math.max(1, parseInt(searchParams?.page ?? "1", 10) || 1);

  const { landlords, total, page, totalPages } = await getLandlords({
    search,
    paying,
    page: currentPage,
  });

  const payingFilters = [
    { value: "all", label: "All" },
    { value: "yes", label: "Paying" },
    { value: "no", label: "Not Paying" },
  ];

  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (paying !== "all") params.set("paying", paying);
    params.set("page", String(p));
    return `/landlords?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-foreground-secondary text-sm flex items-center gap-1.5">
            <Building className="h-4 w-4" />
            Partners & Listings
          </p>
          <h1 className="text-2xl font-bold tracking-tight font-heading text-foreground">
            Landlords
          </h1>
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

        <form className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
            <Input
              name="q"
              placeholder="Name, contact, email..."
              defaultValue={search}
              className="pl-9"
            />
          </div>

          <input type="hidden" name="paying" value={paying} />

          <div className="flex gap-2">
            {payingFilters.map((opt) => (
              <Link
                key={opt.value}
                href={`/landlords?q=${search}&paying=${opt.value}`}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-base ${paying === opt.value
                    ? "bg-brand text-brand-fg shadow-sm"
                    : "bg-surface-inset text-foreground-secondary hover:bg-surface-highlight hover:text-foreground"
                  }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>
      </div>

      {/* ── Results Count ─────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-secondary">
          Showing <span className="font-semibold text-foreground">{landlords.length}</span> of{" "}
          <span className="font-semibold text-foreground">{total}</span> landlords
        </p>
        {totalPages > 1 && (
          <p className="text-xs text-foreground-muted">
            Page {page} of {totalPages}
          </p>
        )}
      </div>

      {/* ── Landlord Cards ─────────────────── */}
      {landlords.length > 0 ? (
        <div className="rounded-bento bg-surface-card shadow-bento overflow-hidden">
          <div className="divide-y divide-border">
            {landlords.map((landlord) => (
              <Link
                key={landlord.id}
                href={`/landlords/${landlord.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-surface-inset transition-colors duration-base group"
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="h-10 w-10 rounded-xl bg-brand-subtle flex items-center justify-center group-hover:bg-brand transition-colors">
                    <Building className="h-4 w-4 text-brand group-hover:text-brand-fg transition-colors" />
                  </div>

                  {/* Info */}
                  <div>
                    <p className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors">
                      {landlord.name}
                    </p>
                    <p className="text-xs text-foreground-muted mt-0.5">
                      {landlord.contact ?? landlord.email ?? "No contact info"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  {/* Commission status */}
                  {landlord.pays_commission ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs font-medium text-success">
                        <Check className="h-3.5 w-3.5" />
                        Pays
                      </span>
                      <span className="text-xs text-foreground-muted">
                        {landlord.commission_term_text?.trim().length
                          ? landlord.commission_term_text
                          : `£${Number(landlord.commission_amount_gbp ?? 0).toFixed(2)}`}
                      </span>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-foreground-muted">
                      <X className="h-3.5 w-3.5" />
                      No commission
                    </span>
                  )}

                  <ArrowRight className="h-4 w-4 text-foreground-muted group-hover:text-brand transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-bento bg-surface-card shadow-bento py-16 text-center">
          <Building className="h-12 w-12 text-foreground-muted mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-lg font-semibold text-foreground mb-1">No landlords found</p>
          <p className="text-sm text-foreground-secondary">
            Try adjusting your search or filters
          </p>
        </div>
      )}

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
