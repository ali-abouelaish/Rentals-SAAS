import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { InvoiceStatusBadge } from "@/features/invoices/ui/InvoiceStatusBadge";
import { getInvoiceById } from "@/features/invoices/data/queries";
import {
  approveAndSendInvoice,
  approveInvoice,
  generateInvoicePdf,
  markInvoiceDeclined,
  markInvoicePaid,
  submitInvoice
} from "@/features/invoices/actions/invoices";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InvoiceSendForm } from "@/features/invoices/ui/InvoiceSendForm";
import { getEmailTemplate } from "@/features/invoices/actions/billingProfiles";

export default async function InvoiceDetailPage({
  params
}: {
  params: { id: string };
}) {
  const profile = await requireUserProfile();
  const { invoice, items } = await getInvoiceById(params.id);
  const isAdmin = profile.role.toLowerCase() === "admin";

  const supabase = createSupabaseServerClient();
  const signedUrl = invoice.pdf_storage_path
    ? await supabase.storage
        .from("invoices-pdf")
        .createSignedUrl(invoice.pdf_storage_path, 3600)
    : null;

  const template = await getEmailTemplate();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Invoice ${invoice.invoice_number}`}
        subtitle="Invoice detail and actions"
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <InvoiceStatusBadge status={invoice.status} />
            <span className="text-sm text-gray-500">
              Due {formatDate(invoice.due_date)}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3 text-sm text-gray-600">
            <div>
              <p className="text-xs uppercase text-gray-400">Landlord</p>
              <p>{invoice.landlords?.name ?? "Landlord"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Total</p>
              <p>{formatGBP(Number(invoice.total))}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Balance due</p>
              <p>{formatGBP(Number(invoice.balance_due))}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <DataTable
            columns={["Item", "Quantity", "Rate", "Amount"]}
            rows={items.map((item) => [
              <span key={`${item.id}-desc`}>{item.description}</span>,
              <span key={`${item.id}-qty`}>{item.quantity}</span>,
              <span key={`${item.id}-rate`}>{formatGBP(Number(item.rate))}</span>,
              <span key={`${item.id}-amount`}>{formatGBP(Number(item.amount))}</span>
            ])}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-navy">Actions</p>
          <div className="flex flex-wrap gap-2">
            {invoice.status === "draft" && invoice.created_by_user_id === profile.id ? (
              <form action={submitInvoice.bind(null, invoice.id)}>
                <Button type="submit" variant="secondary">
                  Submit for approval
                </Button>
              </form>
            ) : null}
            {isAdmin && invoice.status !== "approved" ? (
              <form action={approveInvoice.bind(null, invoice.id)}>
                <Button type="submit" variant="outline">
                  Approve
                </Button>
              </form>
            ) : null}
            {isAdmin && ["approved", "sent"].includes(invoice.status) ? (
              <form action={generateInvoicePdf.bind(null, invoice.id)}>
                <Button type="submit" variant="outline">
                  Generate PDF
                </Button>
              </form>
            ) : null}
            {signedUrl?.data?.signedUrl ? (
              <Button asChild variant="outline">
                <a href={signedUrl.data.signedUrl} target="_blank" rel="noreferrer">
                  Download PDF
                </a>
              </Button>
            ) : null}
            {isAdmin && ["approved", "sent"].includes(invoice.status) ? (
              <form action={approveAndSendInvoice.bind(null, invoice.id)}>
                <Button type="submit">Approve & Send</Button>
              </form>
            ) : null}
            {isAdmin && invoice.status === "sent" ? (
              <>
                <form action={markInvoicePaid.bind(null, invoice.id)}>
                  <Button type="submit" variant="secondary">
                    Mark paid
                  </Button>
                </form>
                <form action={markInvoiceDeclined.bind(null, invoice.id)}>
                  <Button type="submit" variant="outline">
                    Decline
                  </Button>
                </form>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {isAdmin && ["approved", "sent"].includes(invoice.status) ? (
        <InvoiceSendForm
          invoiceId={invoice.id}
          defaultSubject={template?.subject ?? `Invoice ${invoice.invoice_number}`}
          defaultBody={template?.body ?? "Please find your invoice attached."}
        />
      ) : null}
    </div>
  );
}
