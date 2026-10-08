import { CheckCircle2, FileText, Lock, Trash2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { InvoiceStatusBadge } from "@/features/invoices/ui/InvoiceStatusBadge";
import { getInvoiceById } from "@/features/invoices/data/queries";
import {
  deleteInvoice,
  finaliseInvoice,
  markInvoiceDeclined,
  markInvoicePaid,
  viewInvoicePdf
} from "@/features/invoices/actions/invoices";
import { isSendableStatus } from "@/features/invoices/domain/email";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { isAdminRole } from "@/lib/auth/roles";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { InvoiceEditSection } from "@/features/invoices/ui/InvoiceEditSection";
import { SendInvoiceButton } from "@/features/invoices/ui/SendInvoiceButton";
import { ConnectMailboxNotice } from "@/features/email-providers/ui/ConnectMailboxNotice";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  const isAdmin = isAdminRole(profile.role);
  const isCreator = invoice.created_by_user_id === profile.id;
  // Creator or admin: may finalise and send. There is no approval step.
  const canManage = isAdmin || isCreator;
  const isDraft = invoice.status === "draft";

  const canEdit = (isDraft && canManage) || (isAdmin && invoice.status === "submitted");
  const canDelete = isAdmin
    ? ["draft", "submitted"].includes(invoice.status)
    : isDraft && isCreator;
  const canFinalise = isDraft && canManage;
  const canSend = canManage && isSendableStatus(invoice.status);
  const canMarkPaid = isAdmin && invoice.status === "sent";
  const canDecline = isAdmin && ["submitted", "approved", "sent"].includes(invoice.status);

  const supabase = createSupabaseServerClient();
  const [billingResult, landlordsResult] = canEdit
    ? await Promise.all([
        supabase.from("billing_profiles").select("id, name").order("name", { ascending: true }),
        supabase.from("landlords").select("id, name").order("name", { ascending: true })
      ])
    : [{ data: [] }, { data: [] }];
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
          <div className="flex items-center gap-3 flex-wrap">
            <InvoiceStatusBadge status={invoice.status} />
            <span className="text-sm text-foreground-secondary">
              Due {formatDate(invoice.due_date)}
            </span>
            {invoice.sent_at ? (
              <span className="text-sm text-foreground-secondary">
                · Last sent {formatDate(invoice.sent_at)}
              </span>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-3 text-sm text-foreground-secondary">
            <div>
              <p className="text-xs uppercase text-foreground-muted">Landlord</p>
              <p>{invoice.landlords?.name ?? "Landlord"}</p>
              <p className="text-xs text-foreground-muted">
                {invoice.landlords?.email || "No email on file"}
              </p>
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

      {canSend && isAdmin ? (
        <ConnectMailboxNotice tenantId={profile.tenant_id} emailKinds="Invoices" />
      ) : null}

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-navy">Actions</p>
          {isDraft ? (
            <p className="text-xs text-foreground-secondary">
              This invoice is a draft. Finalise it when it&apos;s complete — drafts can&apos;t be
              emailed.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {canFinalise ? (
              <form action={finaliseInvoice.bind(null, invoice.id)}>
                <Tooltip content="Locks the invoice as complete so it can be emailed to the landlord. Do this once the line items and dates are right.">
                  <Button type="submit" variant="secondary">
                    <Lock className="h-4 w-4" />
                    Finalise
                  </Button>
                </Tooltip>
              </form>
            ) : null}
            {canSend ? (
              <SendInvoiceButton
                invoiceId={invoice.id}
                invoiceNumber={invoice.invoice_number}
                isResend={invoice.status === "sent"}
              />
            ) : null}
            <form action={viewInvoicePdf.bind(null, invoice.id)}>
              <Button type="submit" variant="outline">
                <FileText className="h-4 w-4" />
                View PDF
              </Button>
            </form>
            {canMarkPaid ? (
              <form action={markInvoicePaid.bind(null, invoice.id)}>
                <Tooltip content="Record that the landlord has paid. Linked bonuses are marked paid too.">
                  <Button type="submit" variant="secondary">
                    <CheckCircle2 className="h-4 w-4" />
                    Mark paid
                  </Button>
                </Tooltip>
              </form>
            ) : null}
            {canDecline ? (
              <form action={markInvoiceDeclined.bind(null, invoice.id)}>
                <Tooltip content="Use when the landlord refuses to pay. Linked bonuses are marked declined too.">
                  <Button type="submit" variant="outline">
                    <XCircle className="h-4 w-4" />
                    Decline
                  </Button>
                </Tooltip>
              </form>
            ) : null}
            {canDelete ? (
              <ConfirmDeleteForm
                action={deleteInvoice.bind(null, invoice.id)}
                message="Delete this invoice? This cannot be undone."
              >
                <Button type="submit" variant="destructive">
                  <Trash2 className="h-4 w-4" />
                  Delete invoice
                </Button>
              </ConfirmDeleteForm>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {canEdit ? (
        <InvoiceEditSection
          invoice={invoice}
          billingProfiles={billingProfiles ?? []}
          landlords={landlords ?? []}
        />
      ) : null}
    </div>
  );
}
