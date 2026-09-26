import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatPeriod, billingPeriod } from "@/lib/billing/rates";
import {
  PlatformInvoicePdf,
  type PlatformInvoicePdfLine,
  type PlatformInvoicePdfProps,
} from "../pdf/PlatformInvoicePdf";

const BUCKET = "platform-invoices";

/**
 * How an agency pays. Free text so it can be changed without a deploy once the
 * real bank details are settled; `null` simply omits the block rather than
 * printing an empty card.
 */
const PAYMENT_NOTE = process.env.PLATFORM_INVOICE_PAYMENT_NOTE?.trim() || null;

type Admin = ReturnType<typeof createSupabaseAdminClient>;

async function ensureBucket(admin: Admin) {
  const { error } = await admin.storage.getBucket(BUCKET);
  if (error) {
    // Private: an invoice names an agency and what it owes. Reads go through
    // short-lived signed URLs, never a public path.
    await admin.storage.createBucket(BUCKET, { public: false });
  }
}

export type InvoicePdfRecord = {
  id: string;
  tenantId: string;
  invoiceNumber: string | null;
  status: "draft" | "issued" | "paid" | "void";
  pdfStoragePath: string | null;
  totalPence: number;
  periodLabel: string;
  agencyName: string;
  billingEmail: string | null;
};

/**
 * Gather everything the PDF needs for one invoice.
 *
 * Returns null when the invoice does not exist, rather than throwing, so
 * callers can produce their own message — "invoice not found" from a billing
 * screen is more useful than a stack trace.
 */
export async function loadInvoiceForPdf(
  invoiceId: string
): Promise<{ props: PlatformInvoicePdfProps; record: InvoicePdfRecord } | null> {
  const admin = createSupabaseAdminClient();

  const { data: invoice, error } = await admin
    .from("tenant_platform_invoices")
    .select(
      "id, tenant_id, invoice_number, period_year, period_month, period_start, period_end, subtotal_pence, vat_rate_bps, vat_pence, total_pence, status, issued_at, pdf_storage_path"
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (error || !invoice) return null;

  const [{ data: lines }, { data: tenant }, { data: billing }] = await Promise.all([
    admin
      .from("tenant_platform_invoice_lines")
      .select("kind, description, quantity, unit_price_pence, amount_pence")
      .eq("invoice_id", invoiceId)
      // Stable order so a regenerated PDF is byte-comparable with the last one
      // and doesn't appear to have changed when it hasn't.
      .order("kind", { ascending: true })
      .order("description", { ascending: true }),
    admin.from("tenants").select("name").eq("id", invoice.tenant_id).maybeSingle(),
    admin
      .from("tenant_billing_info")
      .select("billing_email, billing_name, billing_address")
      .eq("tenant_id", invoice.tenant_id)
      .maybeSingle(),
  ]);

  const agencyName = (tenant?.name as string) ?? "Agency";
  const period = billingPeriod(
    invoice.period_year as number,
    invoice.period_month as number
  );

  const props: PlatformInvoicePdfProps = {
    invoiceNumber: (invoice.invoice_number as string | null) ?? null,
    periodLabel: formatPeriod(period),
    periodStart: invoice.period_start as string,
    periodEnd: invoice.period_end as string,
    issuedAt: (invoice.issued_at as string | null) ?? null,
    status: invoice.status as PlatformInvoicePdfProps["status"],
    billTo: {
      agencyName,
      billingName: (billing?.billing_name as string | null) ?? null,
      billingEmail: (billing?.billing_email as string | null) ?? null,
      billingAddress: (billing?.billing_address as string | null) ?? null,
    },
    lines: (lines ?? []).map((line) => ({
      kind: line.kind as PlatformInvoicePdfLine["kind"],
      description: line.description as string,
      quantity: line.quantity as number,
      unitPricePence: line.unit_price_pence as number,
      amountPence: line.amount_pence as number,
    })),
    subtotalPence: invoice.subtotal_pence as number,
    vatRateBps: invoice.vat_rate_bps as number,
    vatPence: invoice.vat_pence as number,
    totalPence: invoice.total_pence as number,
    paymentNote: PAYMENT_NOTE,
  };

  return {
    props,
    record: {
      id: invoice.id as string,
      tenantId: invoice.tenant_id as string,
      invoiceNumber: (invoice.invoice_number as string | null) ?? null,
      status: invoice.status as InvoicePdfRecord["status"],
      pdfStoragePath: (invoice.pdf_storage_path as string | null) ?? null,
      totalPence: invoice.total_pence as number,
      periodLabel: formatPeriod(period),
      agencyName,
      billingEmail: (billing?.billing_email as string | null) ?? null,
    },
  };
}

export function invoiceFilename(record: InvoicePdfRecord): string {
  const base = record.invoiceNumber ?? record.periodLabel.replace(/\s+/g, "-").toLowerCase();
  return `harbor-ops-invoice-${base}.pdf`;
}

/**
 * Render the PDF to a buffer.
 *
 * Always renders fresh rather than reading the stored copy. A draft's figures
 * change every time it is regenerated, and handing back a cached PDF of
 * superseded numbers is worse than the cost of rendering.
 */
export async function renderInvoicePdf(props: PlatformInvoicePdfProps): Promise<Buffer> {
  const element = React.createElement(PlatformInvoicePdf, props);
  // @react-pdf types the parameter as ReactElement<DocumentProps>, which no
  // wrapper component satisfies — the element's props are the component's own,
  // not the <Document> it renders. Cast to the parameter type rather than
  // `any`, so a real signature change here still fails the build.
  return renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
}

/**
 * Render, store, and return the storage path.
 *
 * The stored copy is a cache, not the record: `pdf_storage_path` is
 * regenerated whenever it is missing, so losing the bucket loses nothing but
 * some CPU.
 */
export async function storeInvoicePdf(
  invoiceId: string
): Promise<{ path: string; buffer: Buffer; record: InvoicePdfRecord } | null> {
  const loaded = await loadInvoiceForPdf(invoiceId);
  if (!loaded) return null;

  const admin = createSupabaseAdminClient();
  const buffer = await renderInvoicePdf(loaded.props);

  await ensureBucket(admin);

  const path = `${loaded.record.tenantId}/${invoiceId}.pdf`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });

  if (error) throw new Error(error.message);

  await admin
    .from("tenant_platform_invoices")
    .update({ pdf_storage_path: path })
    .eq("id", invoiceId);

  return { path, buffer, record: loaded.record };
}

/**
 * A short-lived signed URL to the invoice PDF, regenerating it first.
 *
 * Always regenerates rather than trusting the stored copy — see
 * `renderInvoicePdf`. Ten minutes is long enough to open and save, short
 * enough that a URL pasted into a chat stops working quickly.
 */
export async function signedInvoicePdfUrl(
  invoiceId: string
): Promise<{ url: string; filename: string } | null> {
  const stored = await storeInvoicePdf(invoiceId);
  if (!stored) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(stored.path, 600, { download: invoiceFilename(stored.record) });

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not create a download link.");
  }

  return { url: data.signedUrl, filename: invoiceFilename(stored.record) };
}
