import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { InvoiceStatusBadge } from "@/features/invoices/ui/InvoiceStatusBadge";
import { getInvoices } from "@/features/invoices/data/queries";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function InvoicesPage() {
  const invoices = await getInvoices();
  const supabase = createSupabaseServerClient();

  const signedUrls = await Promise.all(
    invoices.map((invoice) =>
      invoice.pdf_storage_path
        ? supabase.storage
            .from("invoices-pdf")
            .createSignedUrl(invoice.pdf_storage_path, 3600)
            .then((res) => res.data?.signedUrl ?? null)
        : Promise.resolve(null)
    )
  );

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
          <DataTable
            columns={["Invoice", "Landlord", "Status", "Total", "Due", "PDF", "Actions"]}
            rows={invoices.map((invoice, index) => [
              <span key={`${invoice.id}-number`} className="text-sm text-navy">
                {invoice.invoice_number}
              </span>,
              <span key={`${invoice.id}-landlord`} className="text-sm text-gray-600">
                {invoice.landlords?.name ?? "Landlord"}
              </span>,
              <InvoiceStatusBadge key={`${invoice.id}-status`} status={invoice.status} />,
              <span key={`${invoice.id}-total`} className="text-sm text-gray-600">
                {formatGBP(Number(invoice.total))}
              </span>,
              <span key={`${invoice.id}-due`} className="text-sm text-gray-600">
                {formatDate(invoice.due_date)}
              </span>,
              signedUrls[index] ? (
                <div key={`${invoice.id}-pdf`} className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <a href={signedUrls[index] ?? ""} target="_blank" rel="noreferrer">
                      View
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={signedUrls[index] ?? ""}
                      target="_blank"
                      rel="noreferrer"
                      download
                    >
                      Download
                    </a>
                  </Button>
                </div>
              ) : (
                <span key={`${invoice.id}-pdf`} className="text-xs text-gray-400">
                  —
                </span>
              ),
              <Link key={`${invoice.id}-action`} href={`/invoices/${invoice.id}`} className="text-navy">
                View
              </Link>
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
