"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSuperAdmin } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generatePlatformInvoices } from "@/lib/billing/generate";
import { billingPeriod, formatPeriod, invoiceTotals } from "@/lib/billing/rates";
import { formatPence } from "@/lib/envelopes/packs";
import { logPlatformAudit } from "@/lib/audit/platformAudit";
import { Resend } from "resend";
import { templates } from "@/lib/email/render";
import {
  invoiceFilename,
  loadInvoiceForPdf,
  renderInvoicePdf,
  signedInvoicePdfUrl,
} from "../lib/platformInvoicePdf";

const ADMIN_PATH = "/admin/billing";

type Result = { error: string } | { success: true; message: string };

/**
 * Read an invoice's identity for the audit row.
 *
 * Every money transition below records which agency and how much, not just an
 * invoice id — an audit line reading "invoice 3f2a… issued" is unreadable
 * without a second query, which is exactly when nobody makes it.
 */
async function invoiceAuditContext(invoiceId: string): Promise<{
  tenantId: string | null;
  metadata: Record<string, unknown>;
  label: string;
}> {
  try {
    const { data } = await createSupabaseAdminClient()
      .from("tenant_platform_invoices")
      .select("tenant_id, total_pence, period_year, period_month, status, tenants(name)")
      .eq("id", invoiceId)
      .maybeSingle();

    if (!data) return { tenantId: null, metadata: { invoice_id: invoiceId }, label: "Invoice" };

    // PostgREST returns the embedded relation as an object or a single-element
    // array depending on how it infers the relationship.
    const embedded = data.tenants as { name: string } | { name: string }[] | null;
    const tenant = Array.isArray(embedded) ? embedded[0] : embedded;
    const period = billingPeriod(data.period_year as number, data.period_month as number);

    return {
      tenantId: (data.tenant_id as string) ?? null,
      metadata: {
        invoice_id: invoiceId,
        total_pence: data.total_pence,
        period_year: data.period_year,
        period_month: data.period_month,
        status: data.status,
      },
      label: `${tenant?.name ?? "Agency"} ${formatPeriod(period)} (${formatPence(
        (data.total_pence as number) ?? 0
      )})`,
    };
  } catch {
    return { tenantId: null, metadata: { invoice_id: invoiceId }, label: "Invoice" };
  }
}

const periodSchema = z.object({
  year: z
    .number()
    .int()
    .min(2024, "Year looks wrong")
    .max(2100, "Year looks wrong"),
  month: z.number().int().min(1, "Month must be 1–12").max(12, "Month must be 1–12"),
});

/**
 * Build (or rebuild) the drafts for a period.
 *
 * Idempotent by design: drafts are rebuilt from source, and anything already
 * issued or paid is left alone. So this is safe to press twice, and safe for
 * the monthly cron to run over a month an admin has already touched.
 */
export async function generateInvoicesAction(input: {
  year: number;
  month: number;
}): Promise<Result> {
  const actor = await requireSuperAdmin();

  const parsed = periodSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid period" };
  }

  const period = billingPeriod(parsed.data.year, parsed.data.month);

  try {
    const result = await generatePlatformInvoices(period);

    await logPlatformAudit({
      actor: { id: actor.id },
      category: "billing",
      action: "platform_invoices_generated",
      // No subject tenant: a generation run touches every agency at once.
      summary: `Generated ${formatPeriod(period)} drafts — ${result.created} created, ${
        result.updated
      } rebuilt, ${formatPence(result.totalPence)} total`,
      entityType: "platform_invoice_run",
      entityId: `${period.year}-${String(period.month).padStart(2, "0")}`,
      metadata: {
        created: result.created,
        updated: result.updated,
        skipped_empty: result.skippedEmpty,
        skipped_locked: result.skippedLocked,
        total_pence: result.totalPence,
        failed: result.errors.length,
      },
      severity: result.errors.length > 0 ? "error" : "info",
    });

    revalidatePath(ADMIN_PATH);

    const parts = [
      `${result.created} created`,
      result.updated > 0 ? `${result.updated} rebuilt` : null,
      result.skippedLocked > 0 ? `${result.skippedLocked} already issued, left alone` : null,
      `${formatPence(result.totalPence)} total`,
    ].filter(Boolean);

    if (result.errors.length > 0) {
      return {
        error: `${result.errors.length} agencies failed: ${result.errors
          .slice(0, 3)
          .map((e) => e.error)
          .join("; ")}`,
      };
    }

    return {
      success: true,
      message: `${formatPeriod(period)} — ${parts.join(", ")}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Generation failed." };
  }
}

const transitionSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice"),
});

const emailInvoiceSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice"),
  // Optional override. Validated as an address either way — a typo here sends
  // an agency's bill to a stranger.
  to: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(254, "That address is too long")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/**
 * Issue a draft — the point at which it becomes the agency's bill.
 *
 * One-way from draft only. Re-issuing something already issued would move the
 * date on a bill the agency is holding, and issuing a void one would revive a
 * charge someone deliberately cancelled.
 */
export async function issueInvoiceAction(input: { invoiceId: string }): Promise<Result> {
  const actor = await requireSuperAdmin();

  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid invoice." };

  // Captured before the write: afterwards the status has already moved, and the
  // audit row wants to say what it moved from.
  const context = await invoiceAuditContext(parsed.data.invoiceId);

  // Through the RPC rather than a bare UPDATE: issuing also mints the
  // sequential invoice number, and the two have to happen in one statement.
  // Split, there is a window where an invoice is issued with no reference, and
  // a retry would mint a second number for the same document.
  const { data, error } = await createSupabaseAdminClient().rpc("issue_platform_invoice", {
    p_invoice_id: parsed.data.invoiceId,
  });

  if (error) return { error: error.message };

  const outcome = data as { ok: boolean; reason?: string; invoice_number?: string } | null;

  if (!outcome?.ok) {
    if (outcome?.reason === "not_found") return { error: "Invoice not found." };
    return { error: "That invoice isn't a draft any more — reload and check its status." };
  }

  await logPlatformAudit({
    actor: { id: actor.id },
    category: "billing",
    action: "invoice_issued",
    summary: `Invoice issued — ${context.label}`,
    tenantId: context.tenantId,
    entityType: "platform_invoice",
    entityId: parsed.data.invoiceId,
    before: { status: "draft" },
    after: { status: "issued", invoice_number: outcome.invoice_number },
    metadata: context.metadata,
  });

  revalidatePath(ADMIN_PATH);
  return {
    success: true,
    message: `Invoice ${outcome.invoice_number} issued. The agency can now see it.`,
  };
}

export async function markInvoicePaidAction(input: { invoiceId: string }): Promise<Result> {
  const actor = await requireSuperAdmin();

  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid invoice." };

  const context = await invoiceAuditContext(parsed.data.invoiceId);

  const { data, error } = await createSupabaseAdminClient()
    .from("tenant_platform_invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", parsed.data.invoiceId)
    .eq("status", "issued")
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Only an issued invoice can be marked paid." };
  }

  // Payment is recorded by hand — no processor confirms it — so who marked it
  // paid, and when, is the only evidence that the money arrived.
  await logPlatformAudit({
    actor: { id: actor.id },
    category: "billing",
    action: "invoice_marked_paid",
    summary: `Invoice marked paid — ${context.label}`,
    tenantId: context.tenantId,
    entityType: "platform_invoice",
    entityId: parsed.data.invoiceId,
    before: { status: "issued" },
    after: { status: "paid" },
    metadata: context.metadata,
  });

  revalidatePath(ADMIN_PATH);
  return { success: true, message: "Marked paid." };
}

/**
 * Void an invoice.
 *
 * Any envelope purchases it billed go back in the pool — otherwise voiding a
 * bill would quietly write those purchases off, and the agency would have
 * envelopes nobody ever charged for. They get picked up by the next run.
 *
 * Subscriptions need no equivalent: they are recurring and are re-derived from
 * the subscription row every time, so a voided month simply regenerates.
 */
export async function voidInvoiceAction(input: { invoiceId: string }): Promise<Result> {
  const actor = await requireSuperAdmin();

  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid invoice." };

  const admin = createSupabaseAdminClient();
  const context = await invoiceAuditContext(parsed.data.invoiceId);

  const { data, error } = await admin
    .from("tenant_platform_invoices")
    .update({ status: "void", void_at: new Date().toISOString() })
    .eq("id", parsed.data.invoiceId)
    .neq("status", "void")
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "That invoice is already void." };
  }

  // Voiding cancels a charge. If it was already issued, the agency is holding a
  // bill that no longer exists — the clearest case in this whole module for
  // wanting a record of who did it.
  await logPlatformAudit({
    actor: { id: actor.id },
    category: "billing",
    action: "invoice_voided",
    summary: `Invoice voided — ${context.label}`,
    tenantId: context.tenantId,
    entityType: "platform_invoice",
    entityId: parsed.data.invoiceId,
    before: { status: (context.metadata.status as string) ?? null },
    after: { status: "void" },
    metadata: context.metadata,
    severity: "warning",
  });

  const { error: releaseError } = await admin
    .from("tenant_envelope_purchases")
    .update({ invoiced_at: null, invoice_id: null })
    .eq("invoice_id", parsed.data.invoiceId);

  if (releaseError) {
    // The invoice is void either way; say so rather than pretending it failed,
    // but flag the purchases so they can be released by hand.
    console.error("[billing] invoice voided but purchases not released", {
      invoiceId: parsed.data.invoiceId,
      error: releaseError.message,
    });
    return {
      success: true,
      message: "Invoice voided, but its envelope purchases could not be released. Check the logs.",
    };
  }

  revalidatePath(ADMIN_PATH);
  return {
    success: true,
    message: "Invoice voided. Any envelope purchases on it will appear on the next run.",
  };
}

const adjustmentSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice"),
  description: z
    .string()
    .trim()
    .min(3, "Give a reason of at least 3 characters")
    .max(200, "Keep the reason under 200 characters"),
  amountPence: z
    .number({ invalid_type_error: "Enter an amount" })
    .int("Amount must be a whole number of pence")
    .refine((v) => v !== 0, "An adjustment of zero changes nothing")
    .refine((v) => Math.abs(v) <= 1_000_000, "That is over £10,000 — add it in smaller parts"),
});

/**
 * Add a manual credit or charge to a draft invoice.
 *
 * `kind = 'adjustment'` has been in the schema since platform invoicing landed
 * with nothing to create one, so the only way to apply a goodwill discount was
 * to edit the database by hand. A negative amount is a credit.
 *
 * DRAFTS ONLY. Adding a line to an issued invoice would change a total the
 * agency has already been given; correcting one of those is the void-and-reissue
 * path, exactly as it is for a regeneration.
 *
 * Note that a regeneration REBUILDS a draft's lines from source, which drops
 * adjustments — they have no source to rebuild from. The UI says so, and the
 * order of operations is therefore: generate, then adjust, then issue.
 */
export async function addInvoiceAdjustmentAction(input: {
  invoiceId: string;
  description: string;
  amountPence: number;
}): Promise<Result> {
  const actor = await requireSuperAdmin();

  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid adjustment" };
  }

  const { invoiceId, description, amountPence } = parsed.data;
  const admin = createSupabaseAdminClient();

  const { data: invoice, error: readError } = await admin
    .from("tenant_platform_invoices")
    .select("id, tenant_id, status, vat_rate_bps, period_year, period_month, tenants(name)")
    .eq("id", invoiceId)
    .maybeSingle();

  if (readError) return { error: readError.message };
  if (!invoice) return { error: "That invoice no longer exists." };
  if (invoice.status !== "draft") {
    return {
      error: `Only a draft can be adjusted — this one is ${invoice.status}. Void it and raise a corrected invoice instead.`,
    };
  }

  const { data: inserted, error: insertError } = await admin
    .from("tenant_platform_invoice_lines")
    .insert({
      invoice_id: invoiceId,
      kind: "adjustment",
      description,
      quantity: 1,
      unit_price_pence: amountPence,
      amount_pence: amountPence,
      // No source_kind: an adjustment is the one line type with no upstream
      // record to trace back to. That is what makes it an adjustment.
      source_kind: null,
      source_ref: null,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return { error: insertError?.message ?? "Could not add the adjustment." };
  }

  // Recompute from ALL lines rather than adding to the stored total: if a
  // previous write left the header out of step with its lines, this corrects it
  // instead of compounding the error.
  const { data: lines, error: linesError } = await admin
    .from("tenant_platform_invoice_lines")
    .select("amount_pence")
    .eq("invoice_id", invoiceId);

  if (linesError) return { error: linesError.message };

  const totals = invoiceTotals(
    (lines ?? []).map((line) => ({
      kind: "adjustment" as const,
      description: "",
      quantity: 1,
      unitPricePence: 0,
      amountPence: line.amount_pence as number,
    })),
    // The invoice's OWN frozen rate, not the current VAT_RATE_BPS — the whole
    // point of stamping it per invoice.
    (invoice.vat_rate_bps as number) ?? 0
  );

  if (totals.subtotalPence < 0) {
    // The invoice's CHECK would reject the header update anyway; caught here so
    // the operator gets an explanation rather than a constraint violation. The
    // line is removed BY ID so the invoice is not left inconsistent with its
    // header — matching on description and amount could delete a legitimate
    // earlier adjustment with the same reason and value.
    await admin
      .from("tenant_platform_invoice_lines")
      .delete()
      .eq("id", inserted.id as string);

    return {
      error: `That credit is larger than the invoice total (${formatPence(
        totals.subtotalPence - amountPence
      )}). An invoice cannot go below zero.`,
    };
  }

  const { error: updateError } = await admin
    .from("tenant_platform_invoices")
    .update({
      subtotal_pence: totals.subtotalPence,
      vat_pence: totals.vatPence,
      total_pence: totals.totalPence,
    })
    .eq("id", invoiceId)
    // Re-asserted: between the read above and this write someone could have
    // issued it from another tab.
    .eq("status", "draft");

  if (updateError) return { error: updateError.message };

  const embedded = invoice.tenants as { name: string } | { name: string }[] | null;
  const tenant = Array.isArray(embedded) ? embedded[0] : embedded;
  const isCredit = amountPence < 0;

  await logPlatformAudit({
    actor: { id: actor.id },
    category: "billing",
    action: isCredit ? "invoice_credit_added" : "invoice_charge_added",
    summary: `${isCredit ? "Credit" : "Charge"} of ${formatPence(
      Math.abs(amountPence)
    )} added to ${tenant?.name ?? "agency"} ${formatPeriod(
      billingPeriod(invoice.period_year as number, invoice.period_month as number)
    )} — ${description}`,
    tenantId: (invoice.tenant_id as string) ?? null,
    entityType: "platform_invoice",
    entityId: invoiceId,
    metadata: {
      invoice_id: invoiceId,
      description,
      amount_pence: amountPence,
      new_total_pence: totals.totalPence,
    },
    // A manual money movement with no upstream record. Always worth surfacing.
    severity: "warning",
  });

  revalidatePath(ADMIN_PATH);
  return {
    success: true,
    message: `${isCredit ? "Credit" : "Charge"} added. New total ${formatPence(
      totals.totalPence
    )}.`,
  };
}

// ============================================================
// The document: export and email
// ============================================================

/**
 * A short-lived signed URL to the invoice PDF.
 *
 * Returns a URL rather than the bytes: a server action serialises its return
 * value through the RSC payload, so sending a megabyte of PDF back that way
 * would be slow and would still need converting to a blob on the client. A
 * signed URL lets the browser download it directly.
 *
 * Works on any status, drafts included — a draft PDF is stamped DRAFT across
 * the top, which is exactly what someone reviewing figures before issuing
 * wants.
 */
export async function exportInvoicePdfAction(input: {
  invoiceId: string;
}): Promise<{ error: string } | { success: true; url: string; filename: string }> {
  const actor = await requireSuperAdmin();

  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid invoice." };

  try {
    const signed = await signedInvoicePdfUrl(parsed.data.invoiceId);
    if (!signed) return { error: "Invoice not found." };

    const context = await invoiceAuditContext(parsed.data.invoiceId);
    await logPlatformAudit({
      actor: { id: actor.id },
      category: "billing",
      action: "invoice_exported",
      summary: `Invoice PDF downloaded — ${context.label}`,
      tenantId: context.tenantId,
      entityType: "platform_invoice",
      entityId: parsed.data.invoiceId,
      metadata: context.metadata,
    });

    return { success: true, url: signed.url, filename: signed.filename };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not build the invoice PDF.",
    };
  }
}

/**
 * Email the invoice to the agency's billing contact, with the PDF attached.
 *
 * Only issued or paid invoices. A draft is our working copy and gets rebuilt by
 * the generator — emailing one would put a figure in somebody's inbox that we
 * are about to change, and there is no way to unsend it.
 *
 * Sent via raw Resend rather than the `sendEmail` dispatcher, matching the
 * owner-statement send: `EmailMessage` has no attachments field, so nothing
 * with a PDF can go through the per-tenant transports yet. That is also
 * correct here for a second reason — this is Harbor Ops writing to the agency,
 * so it should NOT go out through the agency's own mailbox.
 */
export async function emailInvoiceAction(input: {
  invoiceId: string;
  /** Override the billing contact for this send only. */
  to?: string;
}): Promise<Result> {
  const actor = await requireSuperAdmin();

  const parsed = emailInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }

  const loaded = await loadInvoiceForPdf(parsed.data.invoiceId);
  if (!loaded) return { error: "Invoice not found." };

  if (loaded.record.status === "draft") {
    return {
      error: "Issue the invoice first. A draft can still change, and an email can't be unsent.",
    };
  }
  if (loaded.record.status === "void") {
    return { error: "This invoice is void — there is nothing to send." };
  }

  const recipient = (parsed.data.to ?? loaded.record.billingEmail ?? "").trim();
  if (!recipient) {
    return {
      error:
        "This agency has no billing email set. Add one under their Billing info, or type an address here.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromDomain = process.env.EMAIL_FROM_DOMAIN?.trim();
  if (!apiKey || !fromDomain) {
    return { error: "Email is not configured on this environment (RESEND_API_KEY / EMAIL_FROM_DOMAIN)." };
  }

  let buffer: Buffer;
  try {
    buffer = await renderInvoicePdf(loaded.props);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not build the invoice PDF.",
    };
  }

  const html = templates.platformInvoice({
    agencyName: loaded.record.agencyName,
    invoiceNumber: loaded.record.invoiceNumber,
    periodLabel: loaded.record.periodLabel,
    totalAmount: formatPence(loaded.record.totalPence),
    // The PDF carries the full breakdown; the email shows enough to recognise
    // the charge without opening an attachment on a phone.
    lineSummary: loaded.props.lines.slice(0, 6).map((line) => ({
      description: line.description,
      amount: formatPence(line.amountPence),
    })),
    paymentNote: loaded.props.paymentNote,
  });

  const subject = loaded.record.invoiceNumber
    ? `Harbor Ops invoice ${loaded.record.invoiceNumber} — ${loaded.record.periodLabel}`
    : `Harbor Ops invoice — ${loaded.record.periodLabel}`;

  const admin = createSupabaseAdminClient();

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `Harbor Ops <billing@${fromDomain}>`,
      to: recipient,
      subject,
      html,
      attachments: [{ filename: invoiceFilename(loaded.record), content: buffer }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Recorded on the invoice, not just logged: the next person looking at this
    // row needs to know the send failed, or they will assume the agency has it.
    await admin
      .from("tenant_platform_invoices")
      .update({ email_error: message })
      .eq("id", parsed.data.invoiceId);
    return { error: `Could not send: ${message}` };
  }

  await admin
    .from("tenant_platform_invoices")
    .update({
      emailed_at: new Date().toISOString(),
      emailed_to: recipient,
      email_error: null,
    })
    .eq("id", parsed.data.invoiceId);

  const context = await invoiceAuditContext(parsed.data.invoiceId);
  await logPlatformAudit({
    actor: { id: actor.id },
    category: "billing",
    action: "invoice_emailed",
    summary: `Invoice emailed to ${recipient} — ${context.label}`,
    tenantId: context.tenantId,
    entityType: "platform_invoice",
    entityId: parsed.data.invoiceId,
    metadata: { ...context.metadata, to: recipient },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true, message: `Invoice emailed to ${recipient}.` };
}
