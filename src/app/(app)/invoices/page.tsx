import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getInvoices } from "@/features/invoices/data/queries";
import { InvoicesTableWithBulkDelete } from "@/features/invoices/ui/InvoicesTableWithBulkDelete";
import { viewInvoicePdf } from "@/features/invoices/actions/invoices";
import { requireUserProfile } from "@/lib/auth/requireRole";
import {
  Plus,
  Download,
  FileText,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string; page?: string };
}) {
  const profile = await requireUserProfile();
  const isAdmin = profile.role.toLowerCase() === "admin";
  const search = searchParams?.q ?? "";
  const status = searchParams?.status ?? "all";
  const currentPage = parseInt(searchParams?.page ?? "1", 10);

  const { invoices, total, page, totalPages } = await getInvoices({
    search,
    status,
    page: currentPage,
  });

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "draft", label: "Draft" },
    { value: "submitted", label: "Submitted" },
    { value: "approved", label: "Approved" },
    { value: "sent", label: "Sent" },
    { value: "paid", label: "Paid" },
    { value: "declined", label: "Declined" },
    { value: "void", label: "Void" },
  ];

  // Helper for pagination/filter links
  const makeHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const q = overrides.q ?? search;
    const s = overrides.status ?? status;
    const p = overrides.page ?? String(page);
    if (q) params.set("q", q);
    if (s && s !== "all") params.set("status", s);
    if (p && p !== "1") params.set("page", p);
    const qs = params.toString();
    return `/invoices${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-[var(--gap-bento)]">
      {/* ── Inline header ──── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground-muted tracking-wide uppercase">
            <FileText className="h-3.5 w-3.5" />
            Billing & Invoicing
          </p>
          <h1 className="text-2xl font-bold text-foreground font-heading mt-0.5">
            Invoices
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </Button>
          <Button asChild size="sm">
            <Link href="/invoices/new">
              <Plus className="h-4 w-4 mr-1.5" />
              New Invoice
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Search & Filter — Bento card ──── */}
      <div className="rounded-bento bg-surface-card shadow-bento p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-lg bg-surface-inset">
            <Filter className="h-4 w-4 text-foreground-muted" strokeWidth={2} />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Search & Filter</h2>
        </div>

        <form className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
            <Input
              name="q"
              placeholder="Invoice # or landlord..."
              defaultValue={search}
              className="pl-9"
            />
          </div>
          <div className="w-full md:w-48">
            <select
              name="status"
              defaultValue={status}
              className="flex h-10 w-full rounded-lg border bg-surface-card px-3 py-2 text-sm border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="outline" size="sm">
            Apply Filters
          </Button>
        </form>
      </div>

      {/* ── Results count ──── */}
      <p className="text-sm text-foreground-secondary">
        Showing{" "}
        <span className="font-semibold text-foreground">{invoices.length}</span>{" "}
        of <span className="font-semibold text-foreground">{total}</span> invoices
      </p>

      {/* ── Invoices List ──── */}
      <InvoicesTableWithBulkDelete
        invoices={invoices}
        isAdmin={isAdmin}
        currentUserId={profile.id}
        onViewPdf={viewInvoicePdf}
      />

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
