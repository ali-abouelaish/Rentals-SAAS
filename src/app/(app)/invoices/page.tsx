import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { getInvoices } from "@/features/invoices/data/queries";
import { Button } from "@/components/ui/button";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { viewInvoicePdf } from "@/features/invoices/actions/invoices";
import { InvoicesTableWithBulkDelete } from "@/features/invoices/ui/InvoicesTableWithBulkDelete";
import { Input } from "@/components/ui/input";

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
  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Manage landlord invoices"
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/invoices/from-bonuses">Generate from bonuses</Link>
            </Button>
            <Button asChild>
              <Link href="/invoices/new">New invoice</Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent>
          <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
            <div>
              <label className="text-xs text-gray-500">Search</label>
              <Input name="q" placeholder="Invoice # or landlord" defaultValue={search} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Status</label>
              <select
                name="status"
                defaultValue={status}
                className="h-10 w-full rounded-xl border border-muted bg-card px-3 text-sm shadow-sm"
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="declined">Declined</option>
                <option value="void">Void</option>
              </select>
            </div>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
          <InvoicesTableWithBulkDelete
            invoices={invoices}
            isAdmin={isAdmin}
            currentUserId={profile.id}
            onViewPdf={viewInvoicePdf}
          />
        </CardContent>
      </Card>
    </div>
  );
}
