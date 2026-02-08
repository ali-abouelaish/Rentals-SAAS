import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterBar, FilterRow, FilterGroup, FilterActions } from "@/components/ui/filter-bar";
import { getInvoices } from "@/features/invoices/data/queries";
import { InvoicesTableWithBulkDelete } from "@/features/invoices/ui/InvoicesTableWithBulkDelete";
import { viewInvoicePdf } from "@/features/invoices/actions/invoices";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { Plus, Download } from "lucide-react";

export default async function InvoicesPage({
  searchParams
}: {
  searchParams?: { q?: string; status?: string };
}) {
  const profile = await requireUserProfile();
  const isAdmin = profile.role.toLowerCase() === "admin";
  const search = searchParams?.q ?? "";
  const status = searchParams?.status ?? "all";
  const invoices = await getInvoices({ search, status });

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "draft", label: "Draft" },
    { value: "submitted", label: "Submitted" },
    { value: "approved", label: "Approved" },
    { value: "sent", label: "Sent" },
    { value: "paid", label: "Paid" },
    { value: "declined", label: "Declined" },
    { value: "void", label: "Void" }
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        subtitle="Generate and manage invoices"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button asChild size="sm">
              <Link href="/invoices/new">
                <Plus className="h-4 w-4 mr-1" />
                New Invoice
              </Link>
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <FilterBar>
        <form method="get">
          <FilterRow>
            <FilterGroup label="Search">
              <Input
                name="q"
                placeholder="Invoice # or landlord..."
                defaultValue={search}
                className="w-64"
              />
            </FilterGroup>
            <FilterGroup label="Status">
              <select
                name="status"
                defaultValue={status}
                className="flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm border-slate-200 text-slate-700"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FilterGroup>
            <FilterActions>
              <Button type="submit" variant="outline" size="sm">
                Apply Filters
              </Button>
            </FilterActions>
          </FilterRow>
        </form>
      </FilterBar>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing <span className="font-medium text-slate-700">{invoices.length}</span> invoices
        </p>
      </div>

      {/* Invoices Table */}
      <InvoicesTableWithBulkDelete
        invoices={invoices}
        isAdmin={isAdmin}
        currentUserId={profile.id}
        onViewPdf={viewInvoicePdf}
      />
    </div>
  );
}
