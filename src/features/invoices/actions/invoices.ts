"use server";

import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole, requireUserProfile } from "@/lib/auth/requireRole";
import { ADMIN_ROLES, isAdminRole } from "@/lib/auth/roles";
import { loadAgencyBrand, type AgencyBrand } from "@/lib/branding/agency-brand";
import { loadAgencyContactEmail } from "@/lib/email/contact";
import { notifyAgencyOfNewInvoice } from "@/lib/email/notify-creation";
import { sendEmail } from "@/lib/email/send";
import { getEmailProviderStatus } from "@/features/email-providers/data/provider";
import { hasFeature } from "@/lib/entitlements/requireFeature";
import { invoiceFromBonusesSchema, invoiceManualSchema } from "../domain/schemas";
import {
  INVOICE_EMAIL_TEMPLATE_KEY,
  invoiceEmailSchema,
  invoiceRecipientSchema,
  isSendableStatus,
  type InvoiceEmailValues,
  type InvoiceRecipientValues,
} from "../domain/email";
import { getInvoiceEmailTemplate } from "../data/emailTemplate";
import {
  composeInvoiceEmail,
  fillInvoiceTemplate,
  invoiceMergeContext,
  type InvoiceEmailSource,
} from "../lib/compose";
import { InvoicePdf } from "../pdf/InvoicePdf";

type InvoiceItemInput = {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function computeTotals<T extends InvoiceItemInput>(items: T[]) {
  const normalized = items.map((item) => ({
    ...item,
    amount: roundMoney(item.quantity * item.rate)
  }));
  const subtotal = normalized.reduce((sum, item) => sum + item.amount, 0);
  return {
    items: normalized,
    subtotal: roundMoney(subtotal),
    total: roundMoney(subtotal),
    balanceDue: roundMoney(subtotal)
  };
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function ensureBucketExists(bucketName: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.getBucket(bucketName);
  if (error) {
    await admin.storage.createBucket(bucketName, { public: false });
  }
}

export async function createInvoiceManual(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const itemsRaw = String(formData.get("items") ?? "[]");
  const input = invoiceManualSchema.parse({
    billing_profile_id: formData.get("billing_profile_id"),
    landlord_id: formData.get("landlord_id"),
    issue_date: formData.get("issue_date") ?? undefined,
    payment_terms_days: formData.get("payment_terms_days") ?? undefined,
    notes: formData.get("notes") ?? undefined,
    items: JSON.parse(itemsRaw)
  });

  const { data: billingProfile } = await supabase
    .from("billing_profiles")
    .select("default_payment_terms_days")
    .eq("id", input.billing_profile_id)
    .single();

  const paymentTermsDays =
    input.payment_terms_days ?? billingProfile?.default_payment_terms_days ?? 7;
  const issueDate = input.issue_date ? new Date(input.issue_date) : new Date();
  const dueDate = addDays(issueDate, paymentTermsDays);

  const { data: invoiceNumber, error: numberError } = await supabase.rpc(
    "next_invoice_number",
    { p_tenant_id: profile.tenant_id }
  );
  if (numberError) throw new Error(numberError.message);

  const totals = computeTotals(
    input.items.map((item) => ({
      ...item,
      amount: item.amount ?? item.quantity * item.rate
    }))
  );

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      tenant_id: profile.tenant_id,
      billing_profile_id: input.billing_profile_id,
      landlord_id: input.landlord_id,
      invoice_number: invoiceNumber,
      issue_date: issueDate.toISOString().slice(0, 10),
      payment_terms_days: paymentTermsDays,
      due_date: dueDate.toISOString().slice(0, 10),
      status: "draft",
      created_by_user_id: profile.id,
      notes: input.notes ?? null,
      subtotal: totals.subtotal,
      total: totals.total,
      balance_due: totals.balanceDue
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const items = totals.items.map((item, index) => ({
    tenant_id: profile.tenant_id,
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    rate: item.rate,
    amount: item.amount,
    sort_order: index
  }));
  const { error: itemError } = await supabase.from("invoice_items").insert(items);
  if (itemError) throw new Error(itemError.message);

  await notifyAgencyOfNewInvoice(invoice.id);

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function createInvoiceFromBonuses(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const bonusIdsRaw = String(formData.get("bonus_ids") ?? "[]");
  const input = invoiceFromBonusesSchema.parse({
    bonus_ids: JSON.parse(bonusIdsRaw),
    billing_profile_id: formData.get("billing_profile_id"),
    issue_date: formData.get("issue_date") ?? undefined,
    payment_terms_days: formData.get("payment_terms_days") ?? undefined
  });

  const { data: bonuses, error: bonusError } = await supabase
    .from("bonuses")
    .select("id, landlord_id, amount_owed, code, client_name, property_address, landlords(name, billing_address)")
    .in("id", input.bonus_ids);
  if (bonusError) throw new Error(bonusError.message);
  if (!bonuses || bonuses.length === 0) {
    throw new Error("No bonuses selected.");
  }

  const landlordId = bonuses[0].landlord_id;
  const allSame = bonuses.every((bonus) => bonus.landlord_id === landlordId);
  if (!allSame) {
    throw new Error("All selected bonuses must belong to the same landlord.");
  }

  const { data: billingProfile } = await supabase
    .from("billing_profiles")
    .select("default_payment_terms_days")
    .eq("id", input.billing_profile_id)
    .single();

  const paymentTermsDays =
    input.payment_terms_days ?? billingProfile?.default_payment_terms_days ?? 7;
  const issueDate = input.issue_date ? new Date(input.issue_date) : new Date();
  const dueDate = addDays(issueDate, paymentTermsDays);

  const { data: invoiceNumber, error: numberError } = await supabase.rpc(
    "next_invoice_number",
    { p_tenant_id: profile.tenant_id }
  );
  if (numberError) throw new Error(numberError.message);

  const items = bonuses.map((bonus, index) => ({
    description: `Landlord Bonus - ${bonus.code ?? bonus.id} - Landlord: ${Array.isArray(bonus.landlords)
      ? bonus.landlords[0]?.name
      : (bonus.landlords as any)?.name ?? "Landlord"
      } (${(bonus as any).property_address ?? "Address"}) - Client: ${(bonus as any).client_name ?? "Unknown"}`,
    quantity: 1,
    rate: Number(bonus.amount_owed ?? 0),
    amount: Number(bonus.amount_owed ?? 0),
    sort_order: index
  }));

  const totals = computeTotals(items);
  const bonusCodes = bonuses.map((bonus) => bonus.code ?? bonus.id).join(", ");

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      tenant_id: profile.tenant_id,
      billing_profile_id: input.billing_profile_id,
      landlord_id: landlordId,
      invoice_number: invoiceNumber,
      issue_date: issueDate.toISOString().slice(0, 10),
      payment_terms_days: paymentTermsDays,
      due_date: dueDate.toISOString().slice(0, 10),
      status: "draft",
      created_by_user_id: profile.id,
      notes: `Invoice generated from Landlord Bonuses: ${bonusCodes}`,
      subtotal: totals.subtotal,
      total: totals.total,
      balance_due: totals.balanceDue
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const itemRows = totals.items.map((item) => ({
    tenant_id: profile.tenant_id,
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    rate: item.rate,
    amount: item.amount,
    sort_order: item.sort_order
  }));
  const { error: itemError } = await supabase.from("invoice_items").insert(itemRows);
  if (itemError) throw new Error(itemError.message);

  const linkRows = bonuses.map((bonus) => ({
    tenant_id: profile.tenant_id,
    invoice_id: invoice.id,
    bonus_id: bonus.id
  }));
  const { error: linkError } = await supabase.from("invoice_bonus_links").insert(linkRows);
  if (linkError) throw new Error(linkError.message);

  await notifyAgencyOfNewInvoice(invoice.id);

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

/**
 * Draft → "Ready to send" (status `submitted`). This is the only way out of
 * draft, and drafts can never be emailed — finalising is the deliberate
 * "this is done" step that replaced admin approval. The creator or an admin
 * may finalise.
 */
export async function finaliseInvoice(invoiceId: string) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const { data: invoice, error: loadError } = await supabase
    .from("invoices")
    .select("id, status, created_by_user_id")
    .eq("id", invoiceId)
    .single();
  if (loadError) throw new Error(loadError.message);
  if (!isAdminRole(profile.role) && invoice.created_by_user_id !== profile.id) {
    throw new Error("You can only finalise invoices you created.");
  }
  if (invoice.status !== "draft") {
    throw new Error("Only draft invoices can be finalised.");
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("status", "draft");
  if (error) throw new Error(error.message);

  await refreshInvoicePdf(invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
}

export async function updateInvoiceDraft(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const invoiceId = String(formData.get("invoice_id") ?? "");
  const billingProfileId = String(formData.get("billing_profile_id") ?? "");
  const landlordId = String(formData.get("landlord_id") ?? "");
  const issueDateRaw = String(formData.get("issue_date") ?? "");
  const termsRaw = String(formData.get("payment_terms_days") ?? "");
  const notes = String(formData.get("notes") ?? "");

  if (!invoiceId) throw new Error("Missing invoice id.");

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, status, created_by_user_id")
    .eq("id", invoiceId)
    .single();
  if (invoiceError) throw new Error(invoiceError.message);
  const isAdmin = isAdminRole(profile.role);
  const editableStatus = invoice.status === "draft" || (isAdmin && invoice.status === "submitted");
  if (!editableStatus) {
    throw new Error("Only draft invoices can be edited.");
  }
  if (!isAdmin && invoice.created_by_user_id !== profile.id) {
    throw new Error("You do not have access to edit this invoice.");
  }

  const termsDays = Number(termsRaw);
  const paymentTermsDays = Number.isFinite(termsDays) && termsDays > 0 ? termsDays : 7;
  const issueDate = issueDateRaw ? new Date(issueDateRaw) : new Date();
  const dueDate = addDays(issueDate, paymentTermsDays);

  const { error } = await supabase
    .from("invoices")
    .update({
      billing_profile_id: billingProfileId,
      landlord_id: landlordId,
      issue_date: issueDate.toISOString().slice(0, 10),
      payment_terms_days: paymentTermsDays,
      due_date: dueDate.toISOString().slice(0, 10),
      notes: notes || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);

  // The stored PDF is a cache of the invoice — rebuild it so View PDF and the
  // email attachment match what was just saved.
  await refreshInvoicePdf(invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
}

/**
 * Rebuild the cached PDF after a change. A failure here must not undo the
 * change itself, so instead of throwing it clears the cache pointer — the next
 * View PDF or send then regenerates from scratch rather than serving a stale copy.
 */
async function refreshInvoicePdf(invoiceId: string) {
  try {
    await generateInvoicePdf(invoiceId);
  } catch (err) {
    console.error("[invoices] PDF refresh failed; clearing cached copy", { invoiceId, err });
    const profile = await requireUserProfile();
    await createSupabaseAdminClient()
      .from("invoices")
      .update({ pdf_storage_path: null })
      .eq("id", invoiceId)
      .eq("tenant_id", profile.tenant_id);
  }
}

export async function deleteInvoice(invoiceId: string) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, status, created_by_user_id")
    .eq("id", invoiceId)
    .single();
  if (invoiceError) throw new Error(invoiceError.message);
  if (isAdminRole(profile.role)) {
    if (!["draft", "submitted"].includes(invoice.status)) {
      throw new Error("Only draft or ready-to-send invoices can be deleted.");
    }
  } else if (invoice.created_by_user_id !== profile.id || invoice.status !== "draft") {
    // Mirrors the "invoices delete" RLS policy: agents may delete their own drafts.
    throw new Error("You can only delete your own draft invoices.");
  }

  await supabase.from("invoice_bonus_links").delete().eq("invoice_id", invoiceId);
  await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);

  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (error) throw new Error(error.message);

  revalidatePath("/invoices");
  redirect("/invoices");
}

async function deleteInvoicesByIds(invoiceIds: string[]) {
  const supabase = createSupabaseServerClient();
  await requireRole([...ADMIN_ROLES]);
  if (invoiceIds.length === 0) return;

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, status")
    .in("id", invoiceIds);
  if (error) throw new Error(error.message);

  const invalid = (invoices ?? []).filter((invoice) => !["draft", "submitted"].includes(invoice.status));
  if (invalid.length > 0) {
    throw new Error("Only draft or submitted invoices can be deleted.");
  }

  await supabase.from("invoice_bonus_links").delete().in("invoice_id", invoiceIds);
  await supabase.from("invoice_items").delete().in("invoice_id", invoiceIds);

  const { error: deleteError } = await supabase
    .from("invoices")
    .delete()
    .in("id", invoiceIds);
  if (deleteError) throw new Error(deleteError.message);

  revalidatePath("/invoices");
}

export async function bulkDeleteInvoicesAction(
  _prevState: { ok?: boolean; error?: string },
  formData: FormData
) {
  try {
    const idsRaw = String(formData.get("invoice_ids") ?? "[]");
    const parsed = JSON.parse(idsRaw);
    const invoiceIds = Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string")
      : [];
    await deleteInvoicesByIds(invoiceIds);
    return { ok: true };
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    return { error: "Unable to delete invoices." };
  }
}

export async function generateInvoicePdf(invoiceId: string) {
  const { path } = await renderAndStoreInvoicePdf(invoiceId);
  return path;
}

/**
 * Render the invoice PDF and overwrite the cached copy in storage. Access is
 * proven by the RLS-scoped read (creator or admin); the pointer write then
 * uses the admin client because agents cannot update a finalised invoice under
 * RLS, and the cache must still refresh for them.
 */
async function renderAndStoreInvoicePdf(invoiceId: string): Promise<{ path: string; buffer: Buffer }> {
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const profile = await requireUserProfile();
  const isAdmin = isAdminRole(profile.role);
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, landlords(*), billing_profiles(*), created_by:user_profiles!invoices_created_by_user_id_fkey(display_name)")
    .eq("id", invoiceId)
    .single();
  if (!invoice) throw new Error("Invoice not found.");
  if (!isAdmin && invoice.created_by_user_id !== profile.id) {
    throw new Error("You do not have access to this invoice.");
  }

  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: true });

  if (invoice.billing_profiles?.logo_url) {
    const logoPath = invoice.billing_profiles.logo_url;
    const { data: logoSigned } = await admin.storage
      .from("billing-logos")
      .createSignedUrl(logoPath, 3600);
    if (logoSigned?.signedUrl) {
      invoice.billing_profiles.logo_url = logoSigned.signedUrl;
    }
  }

  const pdfBuffer = await renderToBuffer(
    React.createElement(InvoicePdf, { invoice, items: items ?? [] }) as any
  );

  const path = `${invoice.tenant_id}/${invoice.id}/${invoice.invoice_number}.pdf`;
  await ensureBucketExists("invoices-pdf");
  const { error: uploadError } = await admin.storage
    .from("invoices-pdf")
    .upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { error: updateError } = await admin
    .from("invoices")
    .update({ pdf_storage_path: path })
    .eq("id", invoiceId)
    .eq("tenant_id", invoice.tenant_id);
  if (updateError) throw new Error(updateError.message);

  revalidatePath(`/invoices/${invoiceId}`);
  return { path, buffer: Buffer.from(pdfBuffer) };
}

export async function generateInvoicePdfAndRedirect(invoiceId: string) {
  const admin = createSupabaseAdminClient();
  const path = await generateInvoicePdf(invoiceId);
  const { data, error } = await admin.storage
    .from("invoices-pdf")
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Unable to generate PDF link.");
  }
  redirect(data.signedUrl);
}

export async function viewInvoicePdf(invoiceId: string) {
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  await requireUserProfile();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id, tenant_id, pdf_storage_path")
    .eq("id", invoiceId)
    .single();
  if (error || !invoice) {
    throw new Error(error?.message ?? "Invoice not found.");
  }

  let path = invoice.pdf_storage_path;
  if (!path) {
    path = await generateInvoicePdf(invoiceId);
  }

  const { data, error: signedError } = await admin.storage
    .from("invoices-pdf")
    .createSignedUrl(path, 3600);
  if (signedError || !data?.signedUrl) {
    throw new Error(signedError?.message ?? "Unable to fetch invoice PDF.");
  }

  redirect(data.signedUrl);
}

// ─── Emailing an invoice ────────────────────────────────────────────────────
//
// Anyone who can manage the invoice (its creator, or an admin) can email it —
// there is no approval step. Drafts are never sent: an invoice must be
// finalised first. Mail goes through sendEmail, so it leaves from the agency's
// connected mailbox (Microsoft 365 / Gmail / SMTP) when there is one, and from
// the Harbor mailer otherwise.

const INVOICE_EMAIL_SELECT =
  "*, landlords(id, name, email), billing_profiles(sender_company_name, sender_email)";

type InvoiceForEmail = InvoiceEmailSource & {
  id: string;
  tenant_id: string;
  status: string;
  created_by_user_id: string;
  landlord_id: string;
  landlords: { id: string; name: string | null; email: string | null } | null;
  billing_profiles: { sender_company_name: string | null; sender_email: string | null } | null;
};

export type InvoiceEmailDraft = {
  /** Null when the landlord has no usable email — the dialog asks for one. */
  to: string | null;
  landlordName: string;
  subject: string;
  body: string;
  previewHtml: string;
  /** {{keys}} in the template with nothing to fill them. */
  unknownKeys: string[];
  /** Human description of the mailbox this will send from. */
  sendingFrom: string;
  /** True when the invoice has already been emailed once. */
  isResend: boolean;
  /** Only admins can change the agency-wide template. */
  canEditTemplate: boolean;
  /** An admin, and Email Sending is switched on — the "Change mailbox" link. */
  canChangeMailbox: boolean;
};

export type InvoiceEmailDraftResult =
  | { ok: true; draft: InvoiceEmailDraft }
  | { ok: false; error: string };

export type InvoiceEmailSendResult =
  | { ok: true }
  | { ok: false; error: string; code?: "missing_email" };

/**
 * Load an invoice for emailing and enforce who may send it and when. The read
 * goes through the caller's RLS-scoped client, so an agent only ever sees
 * their own invoices here.
 */
async function loadInvoiceForEmail(
  invoiceId: string
): Promise<
  | { ok: true; invoice: InvoiceForEmail; profileId: string; tenantId: string; isAdmin: boolean }
  | { ok: false; error: string }
> {
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_EMAIL_SELECT)
    .eq("id", invoiceId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Invoice not found." };

  const invoice = data as unknown as InvoiceForEmail;
  const isAdmin = isAdminRole(profile.role);
  if (!isAdmin && invoice.created_by_user_id !== profile.id) {
    return { ok: false, error: "You can only send invoices you created." };
  }
  if (invoice.status === "draft") {
    return { ok: false, error: "Finalise this invoice before sending it." };
  }
  if (!isSendableStatus(invoice.status)) {
    return { ok: false, error: `A ${invoice.status} invoice can't be emailed.` };
  }
  return { ok: true, invoice, profileId: profile.id, tenantId: profile.tenant_id, isAdmin };
}

/** The landlord's email if it is present and valid, else null. */
function recipientFor(invoice: InvoiceForEmail): string | null {
  const parsed = invoiceRecipientSchema.safeParse({ email: invoice.landlords?.email ?? "" });
  return parsed.success ? parsed.data.email : null;
}

async function describeSendingMailbox(tenantId: string, emailSendingOn: boolean): Promise<string> {
  // Switched off, sendEmail ignores the connected mailbox — so must this.
  if (!emailSendingOn) return "the shared Harbor mailer";
  const provider = await getEmailProviderStatus(tenantId).catch(() => null);
  if (provider?.status === "active" && provider.fromAddress) {
    return `your mailbox (${provider.fromAddress})`;
  }
  return "the shared Harbor mailer";
}

type Branding = { brand: AgencyBrand; contactEmail: string | null };

async function loadBranding(tenantId: string): Promise<Branding | null> {
  const [brand, contactEmail] = await Promise.all([
    loadAgencyBrand(tenantId),
    loadAgencyContactEmail(tenantId).catch(() => null),
  ]);
  return brand ? { brand, contactEmail } : null;
}

function renderForInvoice(
  invoice: InvoiceForEmail,
  { brand, contactEmail }: Branding,
  values: InvoiceEmailValues
): { subject: string; html: string; text: string; unknownKeys: string[] } {
  const context = invoiceMergeContext(invoice, brand.displayName);
  const filled = fillInvoiceTemplate(values, context);
  const { html, text } = composeInvoiceEmail({
    brand,
    contactEmail,
    subject: filled.subject,
    body: filled.body,
    context,
  });
  return { subject: filled.subject, html, text, unknownKeys: filled.unknownKeys };
}

/**
 * Build the email the send dialog opens with: the agency's template filled in
 * for this invoice, plus a rendered preview. `to` is null when the landlord
 * has no email, which the dialog turns into an "add an email" step.
 */
export async function buildInvoiceEmailDraft(invoiceId: string): Promise<InvoiceEmailDraftResult> {
  const loaded = await loadInvoiceForEmail(invoiceId);
  if (!loaded.ok) return loaded;
  const { invoice, tenantId, isAdmin } = loaded;

  const emailSendingOn = await hasFeature("email_sending");
  const [template, branding, sendingFrom] = await Promise.all([
    getInvoiceEmailTemplate(tenantId),
    loadBranding(tenantId),
    describeSendingMailbox(tenantId, emailSendingOn),
  ]);
  if (!branding) return { ok: false, error: "Agency not found." };

  // The editable draft has the merge fields already filled for this invoice.
  const filled = fillInvoiceTemplate(
    template,
    invoiceMergeContext(invoice, branding.brand.displayName)
  );
  const rendered = renderForInvoice(invoice, branding, filled);

  return {
    ok: true,
    draft: {
      to: recipientFor(invoice),
      landlordName: invoice.landlords?.name?.trim() || "This landlord",
      subject: filled.subject,
      body: filled.body,
      previewHtml: rendered.html,
      unknownKeys: filled.unknownKeys,
      sendingFrom,
      isResend: invoice.status === "sent",
      canEditTemplate: isAdmin,
      canChangeMailbox: isAdmin && emailSendingOn,
    },
  };
}

/** Re-render the preview after an edit in the dialog. */
export async function previewInvoiceEmail(
  invoiceId: string,
  values: InvoiceEmailValues
): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const parsed = invoiceEmailSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email." };
  }
  const loaded = await loadInvoiceForEmail(invoiceId);
  if (!loaded.ok) return loaded;

  const branding = await loadBranding(loaded.tenantId);
  if (!branding) return { ok: false, error: "Agency not found." };
  return { ok: true, html: renderForInvoice(loaded.invoice, branding, parsed.data).html };
}

/**
 * Save an email address onto the invoice's landlord (from the send dialog's
 * "no email on file" step), then hand back a fresh draft addressed to it. The
 * address is kept on the landlord record so future invoices just work.
 */
export async function saveLandlordEmailForInvoice(
  invoiceId: string,
  values: InvoiceRecipientValues
): Promise<InvoiceEmailDraftResult> {
  const parsed = invoiceRecipientSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }
  const loaded = await loadInvoiceForEmail(invoiceId);
  if (!loaded.ok) return loaded;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("landlords")
    .update({ email: parsed.data.email })
    .eq("id", loaded.invoice.landlord_id)
    .eq("tenant_id", loaded.tenantId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/landlords");
  return buildInvoiceEmailDraft(invoiceId);
}

/**
 * Email the invoice to its landlord with a freshly rendered PDF attached.
 * `values` is what was on screen in the dialog, so last-minute edits are
 * honoured (and merge fields typed there still fill in).
 */
export async function sendInvoiceEmail(
  invoiceId: string,
  values: InvoiceEmailValues
): Promise<InvoiceEmailSendResult> {
  const parsed = invoiceEmailSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email." };
  }

  const loaded = await loadInvoiceForEmail(invoiceId);
  if (!loaded.ok) return loaded;
  const { invoice, tenantId, profileId } = loaded;

  const to = recipientFor(invoice);
  if (!to) {
    return {
      ok: false,
      code: "missing_email",
      error: "This landlord has no email address on file.",
    };
  }

  try {
    // Always re-render the PDF: the attachment must match the invoice as it is
    // now, never a cached copy from before an edit. Branding loads alongside.
    const [{ buffer }, branding] = await Promise.all([
      renderAndStoreInvoicePdf(invoiceId),
      loadBranding(tenantId),
    ]);
    if (!branding) return { ok: false, error: "Agency not found." };
    const rendered = renderForInvoice(invoice, branding, parsed.data);

    await sendEmail(tenantId, {
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: invoice.billing_profiles?.sender_email?.trim() || undefined,
      templateKey: INVOICE_EMAIL_TEMPLATE_KEY,
      attachments: [
        {
          filename: `${invoice.invoice_number}.pdf`,
          content: buffer,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (err) {
    // sendEmail has already written email_log + the error log.
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `The email could not be sent: ${message}` };
  }

  // Bookkeeping uses the admin client: agents may send their own invoices, but
  // RLS (rightly) won't let them flip a finalised invoice or a bonus status
  // directly. Access was proven by loadInvoiceForEmail above, and every write
  // is pinned to this tenant and this invoice.
  const admin = createSupabaseAdminClient();
  const wasSent = invoice.status === "sent";

  const { error: updateError } = await admin
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId);
  if (updateError) {
    return { ok: false, error: `The email was sent, but the invoice status could not be updated: ${updateError.message}` };
  }

  const markBonusesSent = async () => {
    const { data: links } = await admin
      .from("invoice_bonus_links")
      .select("bonus_id")
      .eq("invoice_id", invoiceId)
      .eq("tenant_id", tenantId);
    const bonusIds = (links ?? []).map((link) => link.bonus_id as string);
    if (bonusIds.length === 0) return;
    await admin
      .from("bonuses")
      .update({ status: "sent" })
      .in("id", bonusIds)
      .eq("tenant_id", tenantId)
      .in("status", ["pending", "approved", "sent"]);
  };

  await Promise.all([
    markBonusesSent(),
    admin.from("activity_log").insert({
      tenant_id: tenantId,
      actor_user_id: profileId,
      action: wasSent ? "invoice_resent" : "invoice_sent",
      entity_type: "invoice",
      entity_id: invoice.id,
      metadata: { invoice_number: invoice.invoice_number, to },
    }),
  ]);

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/bonuses");
  return { ok: true };
}

export async function markInvoicePaid(invoiceId: string) {
  const supabase = createSupabaseServerClient();
  await requireRole([...ADMIN_ROLES]);

  const { error } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);

  await supabase
    .from("bonuses")
    .update({ status: "paid" })
    .in(
      "id",
      (await supabase
        .from("invoice_bonus_links")
        .select("bonus_id")
        .eq("invoice_id", invoiceId)).data?.map((link) => link.bonus_id) ?? []
    );

  revalidatePath(`/invoices/${invoiceId}`);
}

export async function markInvoiceDeclined(invoiceId: string) {
  const supabase = createSupabaseServerClient();
  await requireRole([...ADMIN_ROLES]);

  const { error } = await supabase
    .from("invoices")
    .update({ status: "declined", declined_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);

  await supabase
    .from("bonuses")
    .update({ status: "declined" })
    .in(
      "id",
      (await supabase
        .from("invoice_bonus_links")
        .select("bonus_id")
        .eq("invoice_id", invoiceId)).data?.map((link) => link.bonus_id) ?? []
    );

  revalidatePath(`/invoices/${invoiceId}`);
}
