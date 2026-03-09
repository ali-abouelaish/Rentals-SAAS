import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { InvoiceStatusBadge } from "@/features/invoices/ui/InvoiceStatusBadge";
import { getInvoiceById } from "@/features/invoices/data/queries";
import {
  approveAndSendInvoice,
  approveInvoice,
  deleteInvoice,
  markInvoiceDeclined,
  markInvoicePaid,
  updateInvoiceDraft,
  submitInvoice,
  viewInvoicePdf
} from "@/features/invoices/actions/invoices";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import { Button } from "@/components/ui/button";
import { InvoiceSendForm } from "@/features/invoices/ui/InvoiceSendForm";
import { getEmailTemplate } from "@/features/invoices/actions/billingProfiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDeleteForm } from "@/components/shared/ConfirmDeleteForm";

export default async function InvoiceDetailPage({
  params
}: {
  params: { id: string };
}) {
  const [profile, invoiceResult] = await Promise.all([
    requireUserProfile(),
    getInvoiceById(params.id)
  ]);
  const { invoice, items } = invoiceResult;
  const isAdmin = profile.role.toLowerCase() === "admin";
  const canEdit = invoice.status === "draft" && (isAdmin || invoice.created_by_user_id === profile.id);

  const supabase = createSupabaseServerClient();
  const [billingResult, landlordsResult, template] = await Promise.all([
    supabase.from("billing_profiles").select("id, name").order("name", { ascending: true }),
    supabase.from("landlords").select("id, name").order("name", { ascending: true }),
    getEmailTemplate()
  ]);
  const { data: billingProfiles } = billingResult;
  const { data: landlords } = landlordsResult;

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
            <span className="text-sm text-foreground-secondary">
              Due {formatDate(invoice.due_date)}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3 text-sm text-foreground-secondary">
            <div>
              <p className="text-xs uppercase text-foreground-muted">Landlord</p>
              <p>{invoice.landlords?.name ?? "Landlord"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-foreground-muted">Total</p>
              <p>{formatGBP(Number(invoice.total))}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-foreground-muted">Balance due</p>
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
            {canEdit ? (
              <ConfirmDeleteForm
                action={deleteInvoice.bind(null, invoice.id)}
                message="Delete this draft invoice? This cannot be undone."
              >
                <Button type="submit" variant="outline">
                  Delete draft
                </Button>
              </ConfirmDeleteForm>
            ) : null}
            {isAdmin && invoice.status !== "approved" ? (
              <form action={approveInvoice.bind(null, invoice.id)}>
                <Button type="submit" variant="outline">
                  Approve
                </Button>
              </form>
            ) : null}
            {(invoice.pdf_storage_path || isAdmin || (invoice.created_by_user_id === profile.id && invoice.status !== "draft")) ? (
              <form action={viewInvoicePdf.bind(null, invoice.id)}>
                <Button type="submit" variant="outline">
                  View PDF
                </Button>
              </form>
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

      {canEdit ? (
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium text-brand">Edit draft invoice</p>
            <form action={updateInvoiceDraft} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <div>
                <label className="text-xs text-foreground-secondary">Billing profile</label>
                <select
                  name="billing_profile_id"
                  defaultValue={invoice.billing_profile_id}
                  className="h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm"
                >
                  {(billingProfiles ?? []).map((profileItem) => (
                    <option key={profileItem.id} value={profileItem.id}>
                      {profileItem.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-foreground-secondary">Landlord</label>
                <select
                  name="landlord_id"
                  defaultValue={invoice.landlord_id}
                  className="h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm"
                >
                  {(landlords ?? []).map((landlord) => (
                    <option key={landlord.id} value={landlord.id}>
                      {landlord.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input name="issue_date" type="date" defaultValue={invoice.issue_date} />
              <Input
                name="payment_terms_days"
                type="number"
                defaultValue={invoice.payment_terms_days}
                placeholder="Payment terms (days)"
              />
              <div className="md:col-span-2">
                <Textarea name="notes" defaultValue={invoice.notes ?? ""} placeholder="Notes" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" variant="secondary">
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
